package com.gymapp.dto;

import com.gymapp.entity.Role;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.UUID;

public class RoleChangeDtos {

    // otp is only required (and only checked) when newRole is OWNER - see
    // RoleChangeService / OwnerPromotionOtpService. Null is fine for every other role.
    public record ChangeRoleRequest(
            @NotNull Role newRole,
            String otp
    ) {}

    public record ChangeRoleResponse(
            UUID userId,
            String previousRole,
            String newRole,
            String message
    ) {}

    public record RequestOwnerPromotionOtpResponse(
            String message
    ) {}

    public record RoleHistoryEntry(
            String previousRole,
            String newRole,
            String changedByName,
            LocalDateTime changedAt
    ) {}
}