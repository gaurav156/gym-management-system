package com.gymapp.repository;

import com.gymapp.entity.PasswordResetOtp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

public interface PasswordResetOtpRepository extends JpaRepository<PasswordResetOtp, UUID> {
    // The most recent not-yet-used OTP for this person - both the resend-cooldown check
    // and the verify step only ever care about this one row.
    Optional<PasswordResetOtp> findFirstByUserIdAndConsumedAtIsNullOrderByCreatedAtDesc(UUID userId);

    // Used by OtpCleanupJob - removes rows that are no longer useful for anything:
    // already consumed (successfully used), or expired regardless of whether they were
    // ever consumed. Kept as a bulk @Modifying query rather than loading + deleting
    // entities one by one, since this can run over a large accumulated table.
    @Modifying
    @Query("DELETE FROM PasswordResetOtp o WHERE o.consumedAt IS NOT NULL OR o.expiresAt < :now")
    int deleteConsumedOrExpired(@Param("now") LocalDateTime now);
}