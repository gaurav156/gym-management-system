package com.gymapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public class ProfileDtos {

    // Self-view - deliberately excludes leftDate even for a trainer viewing their own
    // profile; that field is staff-only (see TrainerDtos.TrainerSummary).
    public record ProfileResponse(
            UUID id,
            String name,
            String email,
            String phone,
            String address,
            String photo,
            String signature,
            String role,
            LocalDate enrollmentDate,
            LocalDate joiningDate
    ) {}

    // Deliberately does not include email, password, or any of the staff-controlled dates -
    // this is a self-service profile edit, not an account-recovery or HR flow.
    public record UpdateProfileRequest(
            String name,
            String phone,
            String address,
            String photo,
            String signature
    ) {}

    // Now requires proving both the current password AND a freshly emailed OTP - see
    // RequestPasswordChangeOtpRequest, which must be called first to generate one.
    public record ChangePasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 6) String newPassword,
            @NotBlank String otp
    ) {}

    public record ChangePasswordResponse(
            String message
    ) {}

    // Step 1 of the change-password flow - verifies currentPassword, then emails a
    // 6-digit code to the caller's OWN email on file (never a request-supplied address).
    public record RequestPasswordChangeOtpRequest(
            @NotBlank String currentPassword
    ) {}

    public record RequestPasswordChangeOtpResponse(
            String message
    ) {}
}