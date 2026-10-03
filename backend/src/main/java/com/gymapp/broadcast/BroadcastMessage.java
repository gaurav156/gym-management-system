package com.gymapp.broadcast;

import com.gymapp.entity.BroadcastFormat;
import com.gymapp.entity.BroadcastType;

import java.util.List;

// Everything a channel needs to render one message (recipient-independent). Attachments are
// already downloaded once per broadcast so 500 recipients don't mean 1,500 storage reads.
public record BroadcastMessage(
        String subject,
        String body,
        BroadcastFormat format,
        BroadcastType type,
        String bannerUrl,
        String ctaLabel,
        String ctaUrl,
        String accentColor,
        List<Attachment> attachments
) {
    public record Attachment(String filename, byte[] data, String contentType) {}
}