package com.gymapp.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;
import java.util.UUID;

// Authenticated-flow OTP - only ever sent to the caller's own email (see
// ProfileService.requestPasswordChangeOtp), never a request-supplied identifier. Kept
// separate from PasswordResetOtp because that flow's "generic response regardless of
// outcome" behavior is specifically an anti-enumeration measure for an UNauthenticated
// caller; this flow has no such concern and can surface real errors.
@Entity
@Table(name = "change_password_otp")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChangePasswordOtp {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String otpHash;

    // Always the user's own email at time of send - kept for audit even though it should
    // never differ from user.getEmail().
    @Column(nullable = false)
    private String destination;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    private LocalDateTime consumedAt;

    @Builder.Default
    private int attemptCount = 0;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}