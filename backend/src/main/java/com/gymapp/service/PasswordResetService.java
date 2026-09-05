package com.gymapp.service;

import com.gymapp.dto.PasswordResetDtos.*;
import com.gymapp.entity.OtpChannel;
import com.gymapp.entity.PasswordResetOtp;
import com.gymapp.entity.User;
import com.gymapp.otp.OtpDeliveryRouter;
import com.gymapp.repository.PasswordResetOtpRepository;
import com.gymapp.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Optional;

// Channel-agnostic on purpose - EMAIL is the only channel actually wired to a delivery
// provider today (see EmailOtpDeliveryService), but this request/verify flow already
// works for SMS/WHATSAPP too. Switching one on later is purely an OtpDeliveryService
// implementation change; nothing here needs to be touched.
@Service
public class PasswordResetService {

    private static final int OTP_LENGTH = 6;
    private static final int MAX_ATTEMPTS = 5;
    private static final int RESEND_COOLDOWN_SECONDS = 60;

    private final UserRepository userRepository;
    private final PasswordResetOtpRepository otpRepository;
    private final OtpDeliveryRouter otpDeliveryRouter;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.otp.expiry-minutes}")
    private int expiryMinutes;

    public PasswordResetService(UserRepository userRepository,
                                PasswordResetOtpRepository otpRepository,
                                OtpDeliveryRouter otpDeliveryRouter,
                                PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.otpRepository = otpRepository;
        this.otpDeliveryRouter = otpDeliveryRouter;
        this.passwordEncoder = passwordEncoder;
    }

    // Always returns the same generic message regardless of whether the identifier
    // matches an account, whether the channel is configured, or whether sending actually
    // succeeded - none of that should be observable to the caller, otherwise this
    // endpoint becomes an account-enumeration or channel-probing oracle.
    @Transactional
    public RequestOtpResponse requestOtp(RequestOtpRequest req) {
        RequestOtpResponse generic = new RequestOtpResponse(
                "If an account exists for that " + describeIdentifier(req.channel()) + ", a code has been sent.");

        Optional<User> userOpt = findUserByIdentifier(req.identifier().trim(), req.channel());
        if (userOpt.isEmpty()) {
            return generic;
        }
        User user = userOpt.get();

        otpRepository.findFirstByUserIdAndConsumedAtIsNullOrderByCreatedAtDesc(user.getId())
                .filter(existing -> existing.getCreatedAt().isAfter(LocalDateTime.now().minusSeconds(RESEND_COOLDOWN_SECONDS)))
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Please wait a minute before requesting another code");
                });

        String otp = generateOtp();
        PasswordResetOtp record = PasswordResetOtp.builder()
                .user(user)
                .otpHash(passwordEncoder.encode(otp))
                .channel(req.channel())
                .destination(req.identifier().trim())
                .expiresAt(LocalDateTime.now().plusMinutes(expiryMinutes))
                .attemptCount(0)
                .build();
        otpRepository.save(record);

        try {
            otpDeliveryRouter.forChannel(req.channel()).send(user, req.identifier().trim(), otp);
        } catch (Exception e) {
            // Delivery failure shouldn't leak into the response either - log it server-side
            // and still return the generic message; the person can just retry.
            System.err.println("Failed to send OTP via " + req.channel() + ": " + e.getMessage());
        }

        return generic;
    }

    @Transactional
    public ResetPasswordResponse resetPassword(ResetPasswordRequest req) {
        String genericError = "Invalid or expired code";

        User user = findUserByIdentifier(req.identifier().trim(), req.channel())
                .orElseThrow(() -> new IllegalArgumentException(genericError));

        PasswordResetOtp record = otpRepository
                .findFirstByUserIdAndConsumedAtIsNullOrderByCreatedAtDesc(user.getId())
                .orElseThrow(() -> new IllegalArgumentException(genericError));

        if (record.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException(genericError);
        }
        if (record.getAttemptCount() >= MAX_ATTEMPTS) {
            throw new IllegalArgumentException("Too many attempts - please request a new code");
        }

        if (!passwordEncoder.matches(req.otp().trim(), record.getOtpHash())) {
            record.setAttemptCount(record.getAttemptCount() + 1);
            otpRepository.save(record);
            throw new IllegalArgumentException(genericError);
        }

        record.setConsumedAt(LocalDateTime.now());
        otpRepository.save(record);

        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(user);

        return new ResetPasswordResponse("Password updated - you can now log in with your new password.");
    }

    private Optional<User> findUserByIdentifier(String identifier, OtpChannel channel) {
        return switch (channel) {
            case EMAIL -> userRepository.findByEmail(identifier);
            case SMS, WHATSAPP -> userRepository.findFirstByPhone(identifier);
        };
    }

    private String generateOtp() {
        SecureRandom random = new SecureRandom();
        int max = (int) Math.pow(10, OTP_LENGTH);
        return String.format("%0" + OTP_LENGTH + "d", random.nextInt(max));
    }

    private String describeIdentifier(OtpChannel channel) {
        return switch (channel) {
            case EMAIL -> "email address";
            case SMS, WHATSAPP -> "phone number";
        };
    }
}