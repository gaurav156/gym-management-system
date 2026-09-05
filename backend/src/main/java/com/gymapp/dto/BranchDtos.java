package com.gymapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public class BranchDtos {

    public record CreateBranchRequest(
            @NotBlank String name,
            String address,
            String phone
    ) {}

    public record BranchResponse(
            UUID id,
            String name,
            String address,
            String phone
    ) {}

    // Owner-only: edits an existing branch's details. All fields optional/nullable so a
    // client can send just the field(s) changing - null means "leave as is", matching the
    // pattern already used by UpdateProfileRequest.
    public record UpdateBranchRequest(
            String name,
            String address,
            String phone
    ) {}

    // Replaces the old single from/to transfer - sets a person's branch assignments to
    // exactly this list (one or more), supporting Members, Trainers, and Managers alike.
    public record UpdateAssignmentsRequest(
            @NotEmpty List<UUID> branchIds
    ) {}

    // Owner-facing lookup so they can pick anyone by role without first knowing which
    // branch(es) that person is currently assigned to.
    public record PersonSummary(
            UUID id,
            String name,
            String email,
            String role
    ) {}
}