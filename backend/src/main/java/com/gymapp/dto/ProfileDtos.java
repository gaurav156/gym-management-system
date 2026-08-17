package com.gymapp.dto;

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
            String photo
    ) {}
}