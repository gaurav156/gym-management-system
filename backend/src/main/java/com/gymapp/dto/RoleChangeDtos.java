package com.gymapp.dto;

import com.gymapp.entity.Role;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.UUID;

public class RoleChangeDtos {

    // OWNER is deliberately not a valid target here - promoting/demoting to Owner isn't
    // supported through this endpoint (see RoleChangeService for the enforced rules).
    public record ChangeRoleRequest(
            @NotNull Role newRole
    ) {}

    public record ChangeRoleResponse(
            UUID userId,
            String previousRole,
            String newRole,
            String message
    ) {}

    public record RoleHistoryEntry(
            String previousRole,
            String newRole,
            String changedByName,
            LocalDateTime changedAt
    ) {}
}