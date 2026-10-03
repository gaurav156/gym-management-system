package com.gymapp.broadcast;

import com.gymapp.entity.BroadcastRecipient;
import com.gymapp.entity.BroadcastRecipientStatus;
import com.gymapp.entity.BroadcastStatus;
import com.gymapp.repository.BroadcastRecipientRepository;
import com.gymapp.repository.BroadcastRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

// Deliberately NOT @Transactional: each recipient's result is saved on its own, so a crash
// part-way keeps everything already sent. Only PENDING recipients are processed, so calling
// this again resumes safely (see BroadcastStartupRecovery).
@Component
public class BroadcastDispatcher {

    private static final Logger log = LoggerFactory.getLogger(BroadcastDispatcher.class);
    private static final int PROGRESS_EVERY = 10;
    private static final int MAX_ERROR_LENGTH = 500;

    private final BroadcastRepository broadcastRepository;
    private final BroadcastRecipientRepository recipientRepository;
    private final BroadcastSenderRouter senderRouter;
    private final BroadcastLoader loader;

    @Value("${app.broadcast.send-delay-ms:150}")
    private long sendDelayMs;

    public BroadcastDispatcher(BroadcastRepository broadcastRepository,
                               BroadcastRecipientRepository recipientRepository,
                               BroadcastSenderRouter senderRouter,
                               BroadcastLoader loader) {
        this.broadcastRepository = broadcastRepository;
        this.recipientRepository = recipientRepository;
        this.senderRouter = senderRouter;
        this.loader = loader;
    }

    @Async
    public void dispatch(UUID broadcastId) {
        BroadcastLoader.Loaded loaded;
        try {
            loaded = loader.load(broadcastId);
        } catch (Exception e) {
            // e.g. an attachment was deleted from storage - nothing can be sent.
            failAll(broadcastId, "Could not load the message or its attachments: " + rootMessage(e));
            return;
        }
        if (loaded == null || loaded.status() != BroadcastStatus.SENDING) return;

        BroadcastChannelSender sender = senderRouter.forChannel(loaded.channel());
        List<BroadcastRecipient> pending =
                recipientRepository.findByBroadcastIdAndStatus(broadcastId, BroadcastRecipientStatus.PENDING);

        int sent = (int) recipientRepository.countByBroadcastIdAndStatus(broadcastId, BroadcastRecipientStatus.SENT);
        int failed = (int) recipientRepository.countByBroadcastIdAndStatus(broadcastId, BroadcastRecipientStatus.FAILED);

        int processed = 0;
        for (BroadcastRecipient r : pending) {
            try {
                sender.send(new BroadcastDelivery(r.getRecipientName(), r.getDestination(), r.getUserId(), loaded.message()));
                r.setStatus(BroadcastRecipientStatus.SENT);
                r.setSentAt(LocalDateTime.now());
                sent++;
            } catch (Exception e) {
                r.setStatus(BroadcastRecipientStatus.FAILED);
                r.setErrorMessage(truncate(rootMessage(e)));
                failed++;
                log.warn("Broadcast {} failed for {}: {}", broadcastId, r.getDestination(), e.getMessage());
            }
            recipientRepository.save(r);

            if (++processed % PROGRESS_EVERY == 0) {
                broadcastRepository.updateProgress(broadcastId, sent, failed);
            }
            pause();
        }

        BroadcastStatus finalStatus = (sent == 0 && failed > 0) ? BroadcastStatus.FAILED : BroadcastStatus.COMPLETED;
        broadcastRepository.finish(broadcastId, sent, failed, finalStatus, LocalDateTime.now());
        log.info("Broadcast {} finished: {} sent, {} failed", broadcastId, sent, failed);
    }

    private void failAll(UUID broadcastId, String reason) {
        List<BroadcastRecipient> pending =
                recipientRepository.findByBroadcastIdAndStatus(broadcastId, BroadcastRecipientStatus.PENDING);
        for (BroadcastRecipient r : pending) {
            r.setStatus(BroadcastRecipientStatus.FAILED);
            r.setErrorMessage(truncate(reason));
        }
        recipientRepository.saveAll(pending);
        int sent = (int) recipientRepository.countByBroadcastIdAndStatus(broadcastId, BroadcastRecipientStatus.SENT);
        int failed = (int) recipientRepository.countByBroadcastIdAndStatus(broadcastId, BroadcastRecipientStatus.FAILED);
        broadcastRepository.finish(broadcastId, sent, failed, BroadcastStatus.FAILED, LocalDateTime.now());
        log.error("Broadcast {} failed before sending: {}", broadcastId, reason);
    }

    private void pause() {
        if (sendDelayMs <= 0) return;
        try {
            Thread.sleep(sendDelayMs);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private String rootMessage(Throwable e) {
        Throwable t = e;
        while (t.getCause() != null) t = t.getCause();
        return t.getMessage() != null ? t.getMessage() : t.getClass().getSimpleName();
    }

    private String truncate(String s) {
        return s.length() > MAX_ERROR_LENGTH ? s.substring(0, MAX_ERROR_LENGTH) : s;
    }
}