package com.gymapp.service;

import com.gymapp.dto.RoleChangeDtos.RequestOwnerPromotionOtpResponse;
import com.gymapp.entity.OtpChannel;
import com.gymapp.entity.OwnerDemotionOtp;
import com.gymapp.entity.User;
import com.gymapp.otp.OtpDeliveryRouter;
import com.gymapp.otp.OtpPurpose;
import com.gymapp.repository.OwnerDemotionOtpRepository;
import com.gymapp.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.UUID;

// Step-up verification for demoting an existing Owner. The code goes to OWNER_EMAIL (the
// primary Owner's mailbox), not the acting Owner - so removing an Owner always needs
// someone with access to that mailbox, even if the acting Owner isn't the primary one.
// Same shape as OwnerPromotionOtpService, kept as its own table/service per the one-OTP-
// flow-per-table convention.
@Service
public class OwnerDemotionOtpService {

    private static final int OTP_LENGTH = 6;
    private static final int MAX_ATTEMPTS = 5;
    private static final int RESEND_COOLDOWN_SECONDS = 60;

    private final UserRepository userRepository;
    private final OwnerDemotionOtpRepository otpRepository;
    private final OtpDeliveryRouter otpDeliveryRouter;
    private final PasswordEncoder passwordEncoder;
    private final OwnerSafeguards ownerSafeguards;

    @Value("${app.otp.expiry-minutes}")
    private int expiryMinutes;

    public OwnerDemotionOtpService(UserRepository userRepository,
                                   OwnerDemotionOtpRepository otpRepository,
                                   OtpDeliveryRouter otpDeliveryRouter,
                                   PasswordEncoder passwordEncoder,
                                   OwnerSafeguards ownerSafeguards) {
        this.userRepository = userRepository;
        this.otpRepository = otpRepository;
        this.otpDeliveryRouter = otpDeliveryRouter;
        this.passwordEncoder = passwordEncoder;
        this.ownerSafeguards = ownerSafeguards;
    }

    // Runs the same guard as the role change itself first, so nobody gets an email for a
    // demotion that would be refused anyway. A failed send rolls back the saved row.
    @Transactional
    public RequestOwnerPromotionOtpResponse requestOtp(UUID requesterId, UUID targetUserId) {
        User requester = userRepository.findById(requesterId)
                .orElseThrow(() -> new IllegalArgumentException("Caller not found"));
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        ownerSafeguards.assertOwnerCanBeDemoted(target, requesterId);

        otpRepository.findFirstByRequestedByIdAndTargetUserIdAndConsumedAtIsNullOrderByCreatedAtDesc(requesterId, targetUserId)
                .filter(existing -> existing.getCreatedAt().isAfter(LocalDateTime.now().minusSeconds(RESEND_COOLDOWN_SECONDS)))
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Please wait a minute before requesting another code");
                });

        String destination = ownerSafeguards.primaryOwnerEmail();
        // Greeting name only - falls back to a placeholder if no account matches exactly.
        User recipient = userRepository.findByEmail(destination)
                .orElseGet(() -> User.builder().name("Owner").build());

        String otp = generateOtp();
        otpRepository.save(OwnerDemotionOtp.builder()
                .requestedBy(requester)
                .targetUser(target)
                .otpHash(passwordEncoder.encode(otp))
                .destination(destination)
                .expiresAt(LocalDateTime.now().plusMinutes(expiryMinutes))
                .attemptCount(0)
                .build());

        try {
            otpDeliveryRouter.forChannel(OtpChannel.EMAIL).send(recipient, destination, otp, OtpPurpose.OWNER_DEMOTION);
        } catch (Exception e) {
            throw new IllegalArgumentException("Failed to send the verification code - please try again.");
        }

        return new RequestOwnerPromotionOtpResponse(
                "A verification code has been sent to the primary Owner's email (" + mask(destination)
                        + ") - it expires in " + expiryMinutes + " minutes.");
    }

    // noRollbackFor: same reasoning as OwnerPromotionOtpService - the failed-attempt
    // increment must survive the exception, and this joins RoleChangeService's transaction.
    @Transactional(noRollbackFor = IllegalArgumentException.class)
    public void verifyAndConsume(UUID requesterId, UUID targetUserId, String otp) {
        if (otp == null || otp.isBlank()) {
            throw new IllegalArgumentException("A verification code is required to demote an Owner");
        }

        OwnerDemotionOtp record = otpRepository
                .findFirstByRequestedByIdAndTargetUserIdAndConsumedAtIsNullOrderByCreatedAtDesc(requesterId, targetUserId)
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

    // "owner@mygym.com" -> "o***@mygym.com"
    private String mask(String email) {
        int at = email.indexOf('@');
        return at <= 1 ? email : email.charAt(0) + "***" + email.substring(at);
    }

    private String generateOtp() {
        SecureRandom random = new SecureRandom();
        int max = (int) Math.pow(10, OTP_LENGTH);
        return String.format("%0" + OTP_LENGTH + "d", random.nextInt(max));
    }
}