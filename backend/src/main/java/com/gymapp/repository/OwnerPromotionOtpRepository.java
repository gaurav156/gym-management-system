package com.gymapp.repository;

import com.gymapp.entity.OwnerPromotionOtp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

public interface OwnerPromotionOtpRepository extends JpaRepository<OwnerPromotionOtp, UUID> {
    Optional<OwnerPromotionOtp> findFirstByOwnerIdAndTargetUserIdAndConsumedAtIsNullOrderByCreatedAtDesc(
            UUID ownerId, UUID targetUserId);

    // Mirrors the other OTP repositories - see OtpCleanupJob.
    @Modifying
    @Query("DELETE FROM OwnerPromotionOtp o WHERE o.consumedAt IS NOT NULL OR o.expiresAt < :now")
    int deleteConsumedOrExpired(@Param("now") LocalDateTime now);
}