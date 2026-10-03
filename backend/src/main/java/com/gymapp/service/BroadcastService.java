package com.gymapp.service;

import com.gymapp.broadcast.*;
import com.gymapp.dto.BroadcastDtos.*;
import com.gymapp.dto.PageDtos.PageResponse;
import com.gymapp.entity.*;
import com.gymapp.repository.BroadcastRecipientRepository;
import com.gymapp.repository.BroadcastRepository;
import com.gymapp.repository.UserRepository;
import com.gymapp.storage.ImagePurpose;
import com.gymapp.storage.ImageRefs;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

// Owner-only (enforced at the controller/security config). Resolves the audience ONCE into a
// persisted recipient snapshot, then hands off to BroadcastDispatcher after commit.
@Service
public class BroadcastService {

    private static final int SMS_MAX_CHARS = 600;
    private static final int DESIGNER_MAX_CHARS = 5000;
    private static final int HTML_MAX_CHARS = 50000;
    private static final int MAX_ATTACHMENTS = 3;
    private static final String PREVIEW_NAME = "Alex";

    private final BroadcastRepository broadcastRepository;
    private final BroadcastRecipientRepository recipientRepository;
    private final UserRepository userRepository;
    private final BroadcastAudienceResolver audienceResolver;
    private final BroadcastSenderRouter senderRouter;
    private final BroadcastEmailRenderer renderer;
    private final BroadcastLoader loader;
    private final ImageRefs imageRefs;
    private final ApplicationEventPublisher eventPublisher;

    @Value("${app.broadcast.max-recipients:500}")
    private int maxRecipients;

    public BroadcastService(BroadcastRepository broadcastRepository,
                            BroadcastRecipientRepository recipientRepository,
                            UserRepository userRepository,
                            BroadcastAudienceResolver audienceResolver,
                            BroadcastSenderRouter senderRouter,
                            BroadcastEmailRenderer renderer,
                            BroadcastLoader loader,
                            ImageRefs imageRefs,
                            ApplicationEventPublisher eventPublisher) {
        this.broadcastRepository = broadcastRepository;
        this.recipientRepository = recipientRepository;
        this.userRepository = userRepository;
        this.audienceResolver = audienceResolver;
        this.senderRouter = senderRouter;
        this.renderer = renderer;
        this.loader = loader;
        this.imageRefs = imageRefs;
        this.eventPublisher = eventPublisher;
    }

    public List<ChannelAvailability> channels() {
        return senderRouter.all().stream()
                .sorted(Comparator.comparing(s -> s.channel().ordinal()))
                .map(s -> new ChannelAvailability(s.channel().name(), s.isAvailable()))
                .toList();
    }

    @Transactional(readOnly = true)
    public BroadcastPreviewResponse preview(BroadcastAudience audience, BroadcastChannel channel, BroadcastType type) {
        List<User> users = audienceResolver.resolve(audience);
        List<User> consenting = applyConsent(users, type);
        int eligible = (int) consenting.stream().filter(u -> destinationFor(u, channel) != null).count();
        return new BroadcastPreviewResponse(eligible, consenting.size() - eligible, users.size() - consenting.size());
    }

    // Live preview - the exact HTML/text a recipient would get (sample name, no real recipient).
    @Transactional(readOnly = true)
    public RenderedBroadcastResponse render(CreateBroadcastRequest req) {
        validateContent(req, false);
        BroadcastMessage message = buildMessage(req, bannerUrlFor(req), List.of(), "");
        BroadcastEmailRenderer.Rendered r = renderer.render(message, PREVIEW_NAME, "#");
        return new RenderedBroadcastResponse(r.html(), r.text());
    }

    // Sends the real, fully-rendered email to the Owner's own address only - no broadcast row,
    // no recipients. The best way to check how custom HTML looks in a real inbox.
    @Transactional(readOnly = true)
    public void sendTest(UUID ownerId, CreateBroadcastRequest req) {
        User owner = userRepository.findById(ownerId)
                .orElseThrow(() -> new IllegalArgumentException("Caller not found"));
        if (req.channel() != BroadcastChannel.EMAIL) {
            throw new IllegalArgumentException("Test sends are only available for email");
        }
        validateContent(req, true);

        List<BroadcastMessage.Attachment> attachments = new ArrayList<>();
        for (AttachmentRequest a : attachmentsOf(req)) {
            String key = imageRefs.resolveForSave(null, a.url(), ImagePurpose.BROADCAST_ATTACHMENT);
            attachments.add(loader.resolveAttachment(key, cleanFilename(a.filename())));
        }
        BroadcastMessage message = buildMessage(req, bannerUrlFor(req), attachments, "[TEST] ");
        try {
            senderRouter.forChannel(BroadcastChannel.EMAIL)
                    .send(new BroadcastDelivery(owner.getName(), owner.getEmail(), owner.getId(), message));
        } catch (Exception e) {
            throw new IllegalArgumentException("Failed to send the test email - check your SMTP settings.");
        }
    }

    @Transactional
    public BroadcastResponse create(UUID ownerId, CreateBroadcastRequest req) {
        User owner = userRepository.findById(ownerId)
                .orElseThrow(() -> new IllegalArgumentException("Caller not found"));

        BroadcastChannelSender sender = senderRouter.forChannel(req.channel());
        if (!sender.isAvailable()) {
            throw new IllegalArgumentException(channelLabel(req.channel())
                    + " delivery is not yet configured - please use Email for now");
        }
        validateContent(req, true);

        if (broadcastRepository.existsByStatus(BroadcastStatus.SENDING)) {
            throw new IllegalArgumentException("Another broadcast is still being sent - please wait for it to finish");
        }

        List<User> audience = audienceResolver.resolve(req.audience());
        List<User> consenting = applyConsent(audience, req.type());
        int optedOut = audience.size() - consenting.size();
        List<User> reachable = consenting.stream().filter(u -> destinationFor(u, req.channel()) != null).toList();
        int skipped = consenting.size() - reachable.size();

        if (reachable.isEmpty()) {
            throw new IllegalArgumentException(optedOut > 0 && consenting.isEmpty()
                    ? "Everyone in this audience has opted out of promotional messages"
                    : "No one in this audience has a " + (req.channel() == BroadcastChannel.EMAIL ? "email address" : "phone number") + " on file");
        }
        if (reachable.size() > maxRecipients) {
            throw new IllegalArgumentException("This audience has " + reachable.size()
                    + " recipients, above the per-broadcast limit of " + maxRecipients
                    + ". Pick a smaller audience, or raise BROADCAST_MAX_RECIPIENTS if your mail provider allows it.");
        }

        boolean designer = req.format() == BroadcastFormat.DESIGNER;
        String body = req.body().trim();
        boolean email = req.channel() == BroadcastChannel.EMAIL;

        String bannerKey = (designer && !isBlank(req.bannerUrl()))
                ? imageRefs.resolveForSave(null, req.bannerUrl(), ImagePurpose.BROADCAST_IMAGE) : null;

        List<BroadcastAttachment> attachments = new ArrayList<>();
        for (AttachmentRequest a : attachmentsOf(req)) {
            attachments.add(new BroadcastAttachment(
                    imageRefs.resolveForSave(null, a.url(), ImagePurpose.BROADCAST_ATTACHMENT),
                    cleanFilename(a.filename())));
        }

        // Everything stored that this broadcast references - protects it from the orphan cleanup job.
        Set<String> assetKeys = new LinkedHashSet<>();
        if (bannerKey != null) assetKeys.add(bannerKey);
        attachments.forEach(a -> assetKeys.add(a.getAssetKey()));

        if (req.format() == BroadcastFormat.HTML || req.format() == BroadcastFormat.DESIGNER) {
            assetKeys.addAll(renderer.extractInlineImageKeys(body));
        }

        boolean hasCta = designer && !isBlank(req.ctaLabel()) && !isBlank(req.ctaUrl());

        Broadcast broadcast = broadcastRepository.save(Broadcast.builder()
                .createdBy(owner)
                .createdByName(owner.getName())
                .channel(req.channel())
                .audience(req.audience())
                .type(req.type())
                .contentFormat(req.format())
                .subject(email ? req.subject().trim() : null)
                .body(body)
                .bannerKey(bannerKey)
                .ctaLabel(hasCta ? req.ctaLabel().trim() : null)
                .ctaUrl(hasCta ? req.ctaUrl().trim() : null)
                .accentColor(designer ? BroadcastEmailRenderer.accentOrDefault(req.accentColor()) : null)
                .status(BroadcastStatus.SENDING)
                .totalRecipients(reachable.size())
                .skippedCount(skipped)
                .optedOutCount(optedOut)
                .assetKeys(new ArrayList<>(assetKeys))
                .attachments(attachments)
                .build());

        recipientRepository.saveAll(reachable.stream()
                .map(u -> BroadcastRecipient.builder()
                        .broadcast(broadcast)
                        .user(u)
                        .recipientName(u.getName())
                        .destination(destinationFor(u, req.channel()))
                        .build())
                .toList());

        eventPublisher.publishEvent(new BroadcastCreatedEvent(broadcast.getId()));
        return toResponse(broadcast);
    }

    @Transactional(readOnly = true)
    public PageResponse<BroadcastResponse> list(Pageable pageable) {
        return PageResponse.from(broadcastRepository.findAllByOrderByCreatedAtDesc(pageable).map(this::toResponse));
    }

    @Transactional(readOnly = true)
    public PageResponse<BroadcastRecipientResponse> listRecipients(UUID broadcastId,
                                                                   BroadcastRecipientStatus status,
                                                                   Pageable pageable) {
        if (!broadcastRepository.existsById(broadcastId)) {
            throw new IllegalArgumentException("Broadcast not found");
        }
        var page = status == null
                ? recipientRepository.findByBroadcastIdOrderByRecipientNameAsc(broadcastId, pageable)
                : recipientRepository.findByBroadcastIdAndStatusOrderByRecipientNameAsc(broadcastId, status, pageable);
        return PageResponse.from(page.map(r -> new BroadcastRecipientResponse(
                r.getId(), r.getRecipientName(), r.getDestination(), r.getStatus().name(),
                r.getErrorMessage(), r.getSentAt())));
    }

    // ---- helpers ----

    // PROMOTIONAL only goes to people who've agreed to marketing; ANNOUNCEMENT ignores consent.
    private List<User> applyConsent(List<User> users, BroadcastType type) {
        return type == BroadcastType.PROMOTIONAL ? users.stream().filter(User::isMarketingConsent).toList() : users;
    }

    private void validateContent(CreateBroadcastRequest req, boolean requireSubject) {
        boolean email = req.channel() == BroadcastChannel.EMAIL;
        if (!email && req.format() != BroadcastFormat.PLAIN) {
            throw new IllegalArgumentException("Formatted messages are only available for email");
        }
        if (!email && !attachmentsOf(req).isEmpty()) {
            throw new IllegalArgumentException("Attachments are only available for email");
        }
        if (email && requireSubject && isBlank(req.subject())) {
            throw new IllegalArgumentException("A subject is required for email broadcasts");
        }
        String body = req.body().trim();
        int max = req.format() == BroadcastFormat.HTML ? HTML_MAX_CHARS
                : req.format() == BroadcastFormat.DESIGNER ? DESIGNER_MAX_CHARS : DESIGNER_MAX_CHARS;
        if (body.length() > max) {
            throw new IllegalArgumentException("Message is too long (max " + max + " characters for this format)");
        }
        if (req.channel() == BroadcastChannel.SMS && body.length() > SMS_MAX_CHARS) {
            throw new IllegalArgumentException("SMS messages are limited to " + SMS_MAX_CHARS + " characters");
        }
        if (attachmentsOf(req).size() > MAX_ATTACHMENTS) {
            throw new IllegalArgumentException("You can attach at most " + MAX_ATTACHMENTS + " files");
        }
        if (req.format() == BroadcastFormat.DESIGNER) {
            boolean hasLabel = !isBlank(req.ctaLabel());
            boolean hasUrl = !isBlank(req.ctaUrl());
            if (hasLabel != hasUrl) {
                throw new IllegalArgumentException("Enter both a button label and a button link, or neither");
            }
            if (hasUrl && !req.ctaUrl().trim().matches("(?i)^https?://\\S+$")) {
                throw new IllegalArgumentException("The button link must start with http:// or https://");
            }
        }
        if (!isBlank(req.accentColor()) && !BroadcastEmailRenderer.isValidAccent(req.accentColor())) {
            throw new IllegalArgumentException("Accent colour must be a hex value like #e11d48");
        }
    }

    private BroadcastMessage buildMessage(CreateBroadcastRequest req, String bannerUrl,
                                          List<BroadcastMessage.Attachment> attachments, String subjectPrefix) {
        boolean designer = req.format() == BroadcastFormat.DESIGNER;
        boolean hasCta = designer && !isBlank(req.ctaLabel()) && !isBlank(req.ctaUrl());
        return new BroadcastMessage(
                subjectPrefix + (req.subject() == null ? "" : req.subject().trim()),
                req.body().trim(), req.format(), req.type(),
                designer ? bannerUrl : null,
                hasCta ? req.ctaLabel().trim() : null,
                hasCta ? req.ctaUrl().trim() : null,
                BroadcastEmailRenderer.accentOrDefault(req.accentColor()),
                attachments);
    }

    // Validated through ImageRefs so only our own broadcast images can be used as a banner.
    private String bannerUrlFor(CreateBroadcastRequest req) {
        if (req.format() != BroadcastFormat.DESIGNER || isBlank(req.bannerUrl())) return null;
        return imageRefs.toUrl(imageRefs.resolveForSave(null, req.bannerUrl(), ImagePurpose.BROADCAST_IMAGE));
    }

    private List<AttachmentRequest> attachmentsOf(CreateBroadcastRequest req) {
        return req.attachments() == null ? List.of() : req.attachments();
    }

    private String cleanFilename(String name) {
        String cleaned = name.replaceAll("[\\\\/\\r\\n\"]", "_").trim();
        return cleaned.isEmpty() ? "attachment" : cleaned;
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private String destinationFor(User u, BroadcastChannel channel) {
        String value = channel == BroadcastChannel.EMAIL ? u.getEmail() : u.getPhone();
        return (value == null || value.isBlank()) ? null : value.trim();
    }

    private String channelLabel(BroadcastChannel c) {
        return c == BroadcastChannel.SMS ? "SMS" : c == BroadcastChannel.WHATSAPP ? "WhatsApp" : "Email";
    }

    private BroadcastResponse toResponse(Broadcast b) {
        return new BroadcastResponse(b.getId(), b.getChannel().name(), b.getAudience().name(), b.getType().name(),
                b.getContentFormat().name(), b.getSubject(), b.getBody(), b.getStatus().name(), b.getTotalRecipients(),
                b.getSentCount(), b.getFailedCount(), b.getSkippedCount(), b.getOptedOutCount(),
                b.getAttachments().stream().map(BroadcastAttachment::getFilename).toList(),
                b.getCreatedByName(), b.getCreatedAt(), b.getCompletedAt());
    }
}