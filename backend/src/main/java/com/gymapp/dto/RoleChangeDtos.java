package com.gymapp.dto;

import com.gymapp.entity.Role;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class RoleChangeDtos {

    // otp is required (and checked) when newRole is OWNER (promotion) or when the target is
    // currently an OWNER (demotion) - see RoleChangeService. branchIds is only used when
    // demoting an Owner: Owners have implicit access to every branch and may have no
    // assignments, so the Owner picks where the demoted person should appear.
    public record ChangeRoleRequest(
            @NotNull Role newRole,
            String otp,
            List<UUID> branchIds
    ) {}

    public record ChangeRoleResponse(
            UUID userId,
            String previousRole,
            String newRole,
            String message
    ) {}

    // Used for both promotion and demotion codes - only the message differs.
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