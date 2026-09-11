package com.gymapp.repository;

import com.gymapp.entity.ChangePasswordOtp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

public interface ChangePasswordOtpRepository extends JpaRepository<ChangePasswordOtp, UUID> {
    Optional<ChangePasswordOtp> findFirstByUserIdAndConsumedAtIsNullOrderByCreatedAtDesc(UUID userId);

    // Mirrors PasswordResetOtpRepository.deleteConsumedOrExpired - see OtpCleanupJob.
    @Modifying
    @Query("DELETE FROM ChangePasswordOtp o WHERE o.consumedAt IS NOT NULL OR o.expiresAt < :now")
    int deleteConsumedOrExpired(@Param("now") LocalDateTime now);
}