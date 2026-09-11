package com.gymapp.repository;

import com.gymapp.entity.RegistrationOtp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

public interface RegistrationOtpRepository extends JpaRepository<RegistrationOtp, UUID> {
    Optional<RegistrationOtp> findFirstByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(String email);

    // Mirrors PasswordResetOtpRepository/ChangePasswordOtpRepository - see OtpCleanupJob.
    @Modifying
    @Query("DELETE FROM RegistrationOtp o WHERE o.consumedAt IS NOT NULL OR o.expiresAt < :now")
    int deleteConsumedOrExpired(@Param("now") LocalDateTime now);
}