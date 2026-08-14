package com.gymapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public class MembershipDtos {

    public record CreatePlanRequest(
            @NotBlank UUID branchId,
            @NotBlank String name,
            @Positive Integer durationMonths,
            @NotNull BigDecimal price
    ) {}

    public record PlanResponse(
            UUID id,
            String name,
            Integer durationMonths,
            BigDecimal price
    ) {}

    public record PurchaseRequest(
            @NotBlank UUID planId
    ) {}

    public record MembershipResponse(
            UUID id,
            String planName,
            LocalDate startDate,
            LocalDate endDate,
            String status
    ) {}
}
