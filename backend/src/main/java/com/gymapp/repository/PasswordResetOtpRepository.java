package com.gymapp.repository;

import com.gymapp.entity.PasswordResetOtp;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PasswordResetOtpRepository extends JpaRepository<PasswordResetOtp, UUID> {
    // The most recent not-yet-used OTP for this person - both the resend-cooldown check
    // and the verify step only ever care about this one row.
    Optional<PasswordResetOtp> findFirstByUserIdAndConsumedAtIsNullOrderByCreatedAtDesc(UUID userId);
}