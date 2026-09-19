package com.gymapp.service;

import com.gymapp.dto.RoleChangeDtos.RequestOwnerPromotionOtpResponse;
import com.gymapp.entity.OtpChannel;
import com.gymapp.entity.OwnerPromotionOtp;
import com.gymapp.entity.Role;
import com.gymapp.entity.User;
import com.gymapp.otp.OtpDeliveryRouter;
import com.gymapp.otp.OtpPurpose;
import com.gymapp.repository.OwnerPromotionOtpRepository;
import com.gymapp.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.UUID;

// Step-up verification for granting Owner access. Kept separate from RoleChangeService
// (one OTP flow, one table, one service - same as the other flows). Authenticated flow,
// so real errors are surfaced rather than generic messages.
@Service
public class OwnerPromotionOtpService {

    private static final int OTP_LENGTH = 6;
    private static final int MAX_ATTEMPTS = 5;
    private static final int RESEND_COOLDOWN_SECONDS = 60;

    private final UserRepository userRepository;
    private final OwnerPromotionOtpRepository otpRepository;
    private final OtpDeliveryRouter otpDeliveryRouter;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.otp.expiry-minutes}")
    private int expiryMinutes;

    public OwnerPromotionOtpService(UserRepository userRepository,
                                    OwnerPromotionOtpRepository otpRepository,
                                    OtpDeliveryRouter otpDeliveryRouter,
                                    PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.otpRepository = otpRepository;
        this.otpDeliveryRouter = otpDeliveryRouter;
        this.passwordEncoder = passwordEncoder;
    }

    // Emails a code to the ACTING owner's own address - req has no destination field, so
    // it can't be redirected. If sending fails, the exception rolls back the saved row so
    // a failed send doesn't leave a cooldown-triggering record behind.
    @Transactional
    public RequestOwnerPromotionOtpResponse requestOtp(UUID ownerId, UUID targetUserId) {
        User owner = userRepository.findById(ownerId)
                .orElseThrow(() -> new IllegalArgumentException("Caller not found"));
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (target.getRole() == Role.OWNER) {
            throw new IllegalArgumentException(target.getName() + " is already an Owner");
        }

        otpRepository.findFirstByOwnerIdAndTargetUserIdAndConsumedAtIsNullOrderByCreatedAtDesc(ownerId, targetUserId)
                .filter(existing -> existing.getCreatedAt().isAfter(LocalDateTime.now().minusSeconds(RESEND_COOLDOWN_SECONDS)))
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Please wait a minute before requesting another code");
                });

        String otp = generateOtp();
        otpRepository.save(OwnerPromotionOtp.builder()
                .owner(owner)
                .targetUser(target)
                .otpHash(passwordEncoder.encode(otp))
                .destination(owner.getEmail())
                .expiresAt(LocalDateTime.now().plusMinutes(expiryMinutes))
                .attemptCount(0)
                .build());

        try {
            otpDeliveryRouter.forChannel(OtpChannel.EMAIL).send(owner, owner.getEmail(), otp, OtpPurpose.OWNER_PROMOTION);
        } catch (Exception e) {
            throw new IllegalArgumentException("Failed to send the verification code - please try again.");
        }

        return new RequestOwnerPromotionOtpResponse(
                "A verification code has been sent to your email on file - it expires in " + expiryMinutes + " minutes.");
    }

    // noRollbackFor is deliberate: the failed-attempt increment below must actually be
    // persisted even though we then throw - otherwise the MAX_ATTEMPTS lockout could never
    // trigger. RoleChangeService.changeRole declares the same, since this joins its
    // transaction and a default-rollback boundary here would mark it rollback-only.
    @Transactional(noRollbackFor = IllegalArgumentException.class)
    public void verifyAndConsume(UUID ownerId, UUID targetUserId, String otp) {
        if (otp == null || otp.isBlank()) {
            throw new IllegalArgumentException("A verification code is required to grant Owner access");
        }

        OwnerPromotionOtp record = otpRepository
                .findFirstByOwnerIdAndTargetUserIdAndConsumedAtIsNullOrderByCreatedAtDesc(ownerId, targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("Please request a verification code first"));

        if (record.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Verification code expired - please request a new one");
        }
        if (record.getAttemptCount() >= MAX_ATTEMPTS) {
            throw new IllegalArgumentException("Too many attempts - please request a new code");
        }
        if (!passwordEncoder.matches(otp.trim(), record.getOtpHash())) {
            record.setAttemptCount(record.getAttemptCount() + 1);
            otpRepository.save(record);
            throw new IllegalArgumentException("Incorrect verification code");
        }

        record.setConsumedAt(LocalDateTime.now());
        otpRepository.save(record);
    }

    private String generateOtp() {
        SecureRandom random = new SecureRandom();
        int max = (int) Math.pow(10, OTP_LENGTH);
        return String.format("%0" + OTP_LENGTH + "d", random.nextInt(max));
    }
}