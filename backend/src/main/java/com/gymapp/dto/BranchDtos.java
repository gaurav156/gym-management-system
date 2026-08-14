package com.gymapp.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

public class BranchDtos {

    public record CreateBranchRequest(
            @NotBlank String name,
            String address
    ) {}

    public record BranchResponse(
            UUID id,
            String name,
            String address
    ) {}

    public record TransferRequest(
            @NotBlank UUID userId,
            @NotBlank UUID fromBranchId,
            @NotBlank UUID toBranchId
    ) {}
}
