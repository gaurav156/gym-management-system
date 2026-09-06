package com.gymapp.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public class AuthDtos {

    // captchaToken is optional/nullable - only required when FailedAttemptTracker says
    // this IP has too many recent failures (see AuthController.requireCaptchaIfNeeded).
    // A normal, first-time registration never needs to supply it.
    public record RegisterMemberRequest(
            @NotBlank String name,
            @NotBlank @Email String email,
            String phone,
            @NotBlank @Size(min = 6) String password,
            @NotNull UUID branchId,
            String captchaToken
    ) {}

    // Same optional-captchaToken pattern as RegisterMemberRequest.
    public record LoginRequest(
            @NotBlank @Email String email,
            @NotBlank String password,
            String captchaToken
    ) {}

    public record AuthResponse(
            String token,
            String userId,
            String name,
            String email,
            String role
    ) {}

    // Manager/Trainer creation now supports multiple initial branch assignments in one go,
    // rather than needing separate transfer calls afterward.
    public record CreateManagerRequest(
            @NotBlank String name,
            @NotBlank @Email String email,
            String phone,
            @NotBlank @Size(min = 6) String password,
            @NotEmpty List<UUID> branchIds
    ) {}

    public record CreateTrainerRequest(
            @NotBlank String name,
            @NotBlank @Email String email,
            String phone,
            @NotBlank @Size(min = 6) String password,
            @NotEmpty List<UUID> branchIds
    ) {}
}