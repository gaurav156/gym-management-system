package com.gymapp.dto;

import com.gymapp.entity.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public class AuthDtos {

    // Public: sent before registerMember() - verifies the email is real/reachable and
    // not already registered. captchaToken is optional/nullable, same pattern as
    // RegisterMemberRequest - only required once FailedAttemptTracker flags the IP.
    public record RequestRegistrationOtpRequest(
            @NotBlank @Email String email,
            String captchaToken
    ) {}

    public record RequestRegistrationOtpResponse(
            String message
    ) {}

    // captchaToken is optional/nullable - only required when FailedAttemptTracker says
    // this IP has too many recent failures (see AuthController.requireCaptchaIfNeeded).
    // A normal, first-time registration never needs to supply it.
    // otp is now required - must be a valid, unconsumed code obtained via
    // RequestRegistrationOtpRequest for this exact email.
    public record RegisterMemberRequest(
            @NotBlank String name,
            @NotBlank @Email String email,
            String phone,
            @NotBlank @Size(min = 6) String password,
            @NotNull UUID branchId,
            @NotBlank String otp,
            String captchaToken
    ) {}

    // Same optional-captchaToken pattern as RegisterMemberRequest. rememberMe is
    // optional/nullable and defaults to false-ish (treated as null/false) - when true,
    // AuthService issues a longer-lived token (see app.jwt.remember-me-expiration-ms)
    // instead of the normal short-lived one.
    public record LoginRequest(
            @NotBlank @Email String email,
            @NotBlank String password,
            Boolean rememberMe,
            String captchaToken
    ) {}

    public record AuthResponse(
            String token,
            String userId,
            String name,
            String email,
            String role
    ) {}

    // Owner-only. One request shape for every creatable role. OWNER is deliberately not
    // creatable here - Owners come from promoting an existing account, which requires
    // OTP verification (see RoleChangeService).
    public record CreateAccountRequest(
            @NotBlank String name,
            @NotBlank @Email String email,
            String phone,
            @NotBlank @Size(min = 6) String password,
            @NotNull Role role,
            @NotEmpty List<UUID> branchIds
    ) {}

    // No JWT here (the old create-manager/create-trainer responses handed the Owner a live
    // token for the new account, which nothing used). The PIN is what the Owner needs to
    // hand over.
    public record CreateAccountResponse(
            UUID userId,
            String name,
            String email,
            String role,
            String checkinPin
    ) {}
}