package com.gymapp.repository;

import com.gymapp.entity.OwnerDemotionOtp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

public interface OwnerDemotionOtpRepository extends JpaRepository<OwnerDemotionOtp, UUID> {
    Optional<OwnerDemotionOtp> findFirstByRequestedByIdAndTargetUserIdAndConsumedAtIsNullOrderByCreatedAtDesc(
            UUID requestedById, UUID targetUserId);

    // Mirrors the other OTP repositories - see OtpCleanupJob.
    @Modifying
    @Query("DELETE FROM OwnerDemotionOtp o WHERE o.consumedAt IS NOT NULL OR o.expiresAt < :now")
    int deleteConsumedOrExpired(@Param("now") LocalDateTime now);
}