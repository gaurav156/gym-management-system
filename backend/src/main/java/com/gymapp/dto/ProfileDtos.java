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

    // Self-service password change - requires proving knowledge of the current password
    // rather than trusting the caller's JWT alone, since a JWT can be valid but the
    // person at the keyboard right now may not be the account owner (shared/unlocked
    // device, session left open, etc.). This is separate from the OTP-based reset flow,
    // which is for when the person can't log in at all.
    public record ChangePasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 6) String newPassword
    ) {}

    public record ChangePasswordResponse(
            String message
    ) {}
}