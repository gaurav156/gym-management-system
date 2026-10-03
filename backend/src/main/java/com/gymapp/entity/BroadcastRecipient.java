package com.gymapp.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "broadcast_recipients")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BroadcastRecipient {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "broadcast_id", nullable = false)
    private Broadcast broadcast;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    // Read-only copy of the FK so the dispatcher can read it without touching the lazy `user`.
    @Column(name = "user_id", insertable = false, updatable = false)
    private UUID userId;

    // Snapshot - copied at send time so history survives profile edits/deletion.
    @Column(nullable = false)
    private String recipientName;

    // Email address, or phone number for SMS/WhatsApp.
    @Column(nullable = false)
    private String destination;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private BroadcastRecipientStatus status = BroadcastRecipientStatus.PENDING;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    private LocalDateTime sentAt;
}