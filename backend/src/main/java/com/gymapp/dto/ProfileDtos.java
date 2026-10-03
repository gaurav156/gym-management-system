package com.gymapp.dto;

import com.gymapp.entity.Gender;
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
            LocalDate joiningDate,
            Gender gender,
            LocalDate dateOfBirth,
            boolean idProofUploaded,
            // True once a Member/Trainer/Manager has used their one self-edit - the UI
            // disables the details fields. Always false for the Owner.
            boolean detailsLocked,
            boolean marketingConsent
    ) {}

    // Deliberately does not include email, password, or any of the staff-controlled dates -
    // this is a self-service profile edit, not an account-recovery or HR flow.
    // idProof is the key returned by POST /api/files/images?purpose=ID_PROOF. Null = leave
    // as is. Gender/dateOfBirth null = leave as is.
    public record UpdateProfileRequest(
            String name,
            String phone,
            String address,
            String photo,
            String signature,
            Gender gender,
            LocalDate dateOfBirth,
            String idProof
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