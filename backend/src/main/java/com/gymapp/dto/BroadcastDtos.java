package com.gymapp.dto;

import com.gymapp.entity.BroadcastAudience;
import com.gymapp.entity.BroadcastChannel;
import com.gymapp.entity.BroadcastFormat;
import com.gymapp.entity.BroadcastType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class BroadcastDtos {

    // url = what POST /api/files/images?purpose=BROADCAST_ATTACHMENT returned; filename = what the
    // recipient sees on the attachment.
    public record AttachmentRequest(
            @NotBlank String url,
            @NotBlank @Size(max = 200) String filename
    ) {}

    // The SAME shape is used for create, live preview (/render) and test send (/test), so the
    // three can never drift. bannerUrl/ctaLabel/ctaUrl/accentColor only apply to DESIGNER format.
    public record CreateBroadcastRequest(
            @NotNull BroadcastChannel channel,
            @NotNull BroadcastAudience audience,
            @NotNull BroadcastType type,
            @NotNull BroadcastFormat format,
            @Size(max = 200) String subject,
            @NotBlank @Size(max = 50000) String body,
            String bannerUrl,
            @Size(max = 60) String ctaLabel,
            @Size(max = 500) String ctaUrl,
            @Size(max = 9) String accentColor,
            @Size(max = 3) List<@Valid AttachmentRequest> attachments
    ) {}

    // eligibleRecipients = would receive it; missingContact = no email/phone for this channel;
    // optedOut = PROMOTIONAL only - hasn't agreed to marketing.
    public record BroadcastPreviewResponse(int eligibleRecipients, int missingContact, int optedOut) {}

    public record RenderedBroadcastResponse(String html, String text) {}

    public record ChannelAvailability(String channel, boolean available) {}

    public record BroadcastResponse(
            UUID id,
            String channel,
            String audience,
            String type,
            String format,
            String subject,
            String body,
            String status,
            int totalRecipients,
            int sentCount,
            int failedCount,
            int skippedCount,
            int optedOutCount,
            List<String> attachmentNames,
            String createdByName,
            LocalDateTime createdAt,
            LocalDateTime completedAt
    ) {}

    public record BroadcastRecipientResponse(
            UUID id,
            String recipientName,
            String destination,
            String status,
            String errorMessage,
            LocalDateTime sentAt
    ) {}
}