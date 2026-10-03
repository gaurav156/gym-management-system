package com.gymapp.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "broadcasts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Broadcast {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(nullable = false)
    private String createdByName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BroadcastChannel channel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BroadcastAudience audience;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BroadcastType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "content_format", nullable = false)
    private BroadcastFormat contentFormat;

    private String subject;

    // PLAIN: text. DESIGNER: toolbar markup (see richText.tsx / RichMarkupConverter). HTML: the
    // Owner's raw HTML - sanitized at render time, never trusted as stored.
    @Column(columnDefinition = "TEXT", nullable = false)
    private String body;

    // Object key of the DESIGNER banner image (see ImagePurpose.BROADCAST_IMAGE).
    @Column(name = "banner_key", columnDefinition = "TEXT")
    private String bannerKey;

    private String ctaLabel;
    private String ctaUrl;
    private String accentColor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BroadcastStatus status;

    @Column(nullable = false)
    private int totalRecipients;

    @Column(nullable = false)
    private int sentCount;

    @Column(nullable = false)
    private int failedCount;

    // In the audience but no email/phone for this channel.
    @Column(nullable = false)
    private int skippedCount;

    // PROMOTIONAL only: in the audience but hasn't consented to marketing.
    @Column(nullable = false)
    private int optedOutCount;

    @ElementCollection
    @CollectionTable(name = "broadcast_assets", joinColumns = @JoinColumn(name = "broadcast_id"))
    @Column(name = "asset_key", nullable = false)
    @Builder.Default
    private List<String> assetKeys = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "broadcast_attachments", joinColumns = @JoinColumn(name = "broadcast_id"))
    @OrderColumn(name = "sort_order")
    @Builder.Default
    private List<BroadcastAttachment> attachments = new ArrayList<>();

    @Column(updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime completedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}