package com.gymapp.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class AuthDtos {

    public record RegisterMemberRequest(
            @NotBlank String name,
            @NotBlank @Email String email,
            String phone,
            @NotBlank @Size(min = 6) String password,
            @NotBlank java.util.UUID branchId
    ) {}

    public record LoginRequest(
            @NotBlank @Email String email,
            @NotBlank String password
    ) {}

    public record AuthResponse(
            String token,
            String userId,
            String name,
            String email,
            String role
    ) {}

    public record CreateManagerRequest(
            @NotBlank String name,
            @NotBlank @Email String email,
            String phone,
            @NotBlank @Size(min = 6) String password,
            @NotBlank java.util.UUID branchId
    ) {}
}
