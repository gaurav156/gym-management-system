package com.gymapp.dto;

import java.util.UUID;

public class ProfileDtos {

    public record ProfileResponse(
            UUID id,
            String name,
            String email,
            String phone,
            String photo,
            String role
    ) {}

    // Deliberately does not include email or password - this is a self-service profile
    // edit, not an account-recovery flow. photo is a base64 data URI, or null to leave
    // the existing photo unchanged (an empty string would explicitly clear it).
    public record UpdateProfileRequest(
            String name,
            String phone,
            String photo
    ) {}
}