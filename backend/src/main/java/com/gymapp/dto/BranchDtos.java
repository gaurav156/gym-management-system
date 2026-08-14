package com.gymapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

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
            @NotNull UUID userId,
            @NotNull UUID fromBranchId,
            @NotNull UUID toBranchId
    ) {}
}
