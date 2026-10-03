package com.gymapp.broadcast;

import com.gymapp.entity.*;
import com.gymapp.repository.BroadcastRepository;
import com.gymapp.storage.ImageRefs;
import com.gymapp.storage.StorageService;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Component
public class BroadcastLoader {

    public record Loaded(BroadcastStatus status, BroadcastChannel channel, BroadcastMessage message) {}

    private final BroadcastRepository broadcastRepository;
    private final StorageService storage;
    private final ImageRefs imageRefs;

    public BroadcastLoader(BroadcastRepository broadcastRepository, StorageService storage, ImageRefs imageRefs) {
        this.broadcastRepository = broadcastRepository;
        this.storage = storage;
        this.imageRefs = imageRefs;
    }

    // Attachments are downloaded ONCE here, not once per recipient.
    @Transactional(readOnly = true)
    public Loaded load(UUID id) {
        Broadcast b = broadcastRepository.findById(id).orElse(null);
        if (b == null) return null;

        List<BroadcastMessage.Attachment> attachments = new ArrayList<>();
        for (BroadcastAttachment a : b.getAttachments()) {
            attachments.add(resolveAttachment(a.getAssetKey(), a.getFilename()));
        }
        BroadcastMessage message = new BroadcastMessage(b.getSubject(), b.getBody(), b.getContentFormat(), b.getType(),
                imageRefs.toUrl(b.getBannerKey()), b.getCtaLabel(), b.getCtaUrl(), b.getAccentColor(), attachments);
        return new Loaded(b.getStatus(), b.getChannel(), message);
    }

    public BroadcastMessage.Attachment resolveAttachment(String key, String filename) {
        StorageService.StoredFile f = storage.get(key);
        return new BroadcastMessage.Attachment(filename, f.data(), f.contentType());
    }
}