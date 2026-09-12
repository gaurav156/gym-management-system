package com.gymapp.service;

import com.gymapp.dto.ProfileDtos.*;
import com.gymapp.entity.ChangePasswordOtp;
import com.gymapp.entity.OtpChannel;
import com.gymapp.entity.Role;
import com.gymapp.entity.User;
import com.gymapp.otp.OtpDeliveryRouter;
import com.gymapp.otp.OtpPurpose;
import com.gymapp.repository.ChangePasswordOtpRepository;
import com.gymapp.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class ProfileService {

    // Same shape as PasswordResetService's constants - kept as separate literals rather
    // than shared, since the two flows are intentionally decoupled (see
    // ChangePasswordOtp's class comment).
    private static final int OTP_LENGTH = 6;
    private static final int MAX_ATTEMPTS = 5;
    private static final int RESEND_COOLDOWN_SECONDS = 60;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ChangePasswordOtpRepository changePasswordOtpRepository;
    private final OtpDeliveryRouter otpDeliveryRouter;

    @Value("${app.otp.expiry-minutes}")
    private int expiryMinutes;

    public ProfileService(UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          ChangePasswordOtpRepository changePasswordOtpRepository,
                          OtpDeliveryRouter otpDeliveryRouter) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.changePasswordOtpRepository = changePasswordOtpRepository;
        this.otpDeliveryRouter = otpDeliveryRouter;
    }

    public ProfileResponse getProfile(UUID userId) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return toResponse(u);
    }

    @Transactional
    public ProfileResponse updateProfile(UUID userId, UpdateProfileRequest req) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (req.name() != null && !req.name().isBlank()) u.setName(req.name());
        if (req.phone() != null) u.setPhone(req.phone());
        if (req.address() != null) u.setAddress(req.address().isBlank() ? null : req.address());
        if (req.photo() != null) u.setPhoto(req.photo().isBlank() ? null : req.photo());

        if (req.signature() != null && (u.getRole() == Role.OWNER || u.getRole() == Role.MANAGER)) {
            u.setSignature(req.signature().isBlank() ? null : req.signature());
        }

        u = userRepository.save(u);
        return toResponse(u);
    }

    // Step 1 of change-password. Verifies the current password up front (so a wrong
    // password never even triggers an email send), then emails a fresh code to the
    // user's OWN address on file - req has no field for a destination, so this can't be
    // redirected anywhere else. Resend-cooldown pattern matches PasswordResetService.
    @Transactional
    public RequestPasswordChangeOtpResponse requestPasswordChangeOtp(UUID userId, RequestPasswordChangeOtpRequest req) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (!passwordEncoder.matches(req.currentPassword(), u.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }

        changePasswordOtpRepository.findFirstByUserIdAndConsumedAtIsNullOrderByCreatedAtDesc(userId)
                .filter(existing -> existing.getCreatedAt().isAfter(LocalDateTime.now().minusSeconds(RESEND_COOLDOWN_SECONDS)))
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Please wait a minute before requesting another code");
                });

        String otp = generateOtp();
        ChangePasswordOtp record = ChangePasswordOtp.builder()
                .user(u)
                .otpHash(passwordEncoder.encode(otp))
                .destination(u.getEmail())
                .expiresAt(LocalDateTime.now().plusMinutes(expiryMinutes))
                .attemptCount(0)
                .build();
        changePasswordOtpRepository.save(record);

        // Unlike PasswordResetService, a delivery failure here IS surfaced to the caller -
        // there's no enumeration risk (destination is always their own known email), and
        // silently swallowing it would leave someone stuck waiting for a code that never
        // arrives with no way to know why.
        try {
            otpDeliveryRouter.forChannel(OtpChannel.EMAIL).send(u, u.getEmail(), otp, OtpPurpose.CHANGE_PASSWORD);
        } catch (Exception e) {
            throw new IllegalArgumentException("Failed to send the verification code - please try again.");
        }

        return new RequestPasswordChangeOtpResponse(
                "A verification code has been sent to your email on file - it expires in " + expiryMinutes + " minutes.");
    }

    // Step 2 - now requires the current password (as before) AND a valid, unexpired,
    // not-yet-consumed OTP obtained via requestPasswordChangeOtp() above.
    @Transactional
    public ChangePasswordResponse changePassword(UUID userId, ChangePasswordRequest req) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (!passwordEncoder.matches(req.currentPassword(), u.getPasswordHash())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }
        if (passwordEncoder.matches(req.newPassword(), u.getPasswordHash())) {
            throw new IllegalArgumentException("New password must be different from your current password");
        }

        ChangePasswordOtp record = changePasswordOtpRepository
                .findFirstByUserIdAndConsumedAtIsNullOrderByCreatedAtDesc(userId)
                .orElseThrow(() -> new IllegalArgumentException("Please request a verification code first"));

        if (record.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Verification code expired - please request a new one");
        }
        if (record.getAttemptCount() >= MAX_ATTEMPTS) {
            throw new IllegalArgumentException("Too many attempts - please request a new code");
        }
        if (!passwordEncoder.matches(req.otp().trim(), record.getOtpHash())) {
            record.setAttemptCount(record.getAttemptCount() + 1);
            changePasswordOtpRepository.save(record);
            throw new IllegalArgumentException("Incorrect verification code");
        }

        record.setConsumedAt(LocalDateTime.now());
        changePasswordOtpRepository.save(record);

        u.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(u);
        return new ChangePasswordResponse("Password changed successfully.");
    }

    private String generateOtp() {
        SecureRandom random = new SecureRandom();
        int max = (int) Math.pow(10, OTP_LENGTH);
        return String.format("%0" + OTP_LENGTH + "d", random.nextInt(max));
    }

    private ProfileResponse toResponse(User u) {
        return new ProfileResponse(u.getId(), u.getName(), u.getEmail(), u.getPhone(), u.getAddress(),
                u.getPhoto(), u.getSignature(), u.getRole().name(), u.getEnrollmentDate(), u.getJoiningDate());
    }
}