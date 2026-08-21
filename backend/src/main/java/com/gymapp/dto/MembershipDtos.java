package com.gymapp.dto;

import com.gymapp.entity.PaymentMode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public class MembershipDtos {

    // No longer branch-scoped - a plan created here is purchasable and valid at every
    // branch, which is what makes cross-branch access work correctly for a transferred
    // or multi-branch member.
    public record CreatePlanRequest(
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
            @NotNull UUID planId,
            @NotNull PaymentMode mode,
            // Which branch processed this sale - used for the Payment/Membership record,
            // not as an access restriction (plans are chain-wide, so this is purely
            // "where did the cash change hands" bookkeeping).
            @NotNull UUID branchId,
            // Only used when the member has no current unexpired ACTIVE membership - if
            // they do, the new plan always starts the day after the current one ends and
            // this is ignored, regardless of what's supplied here.
            LocalDate startDate
    ) {}

    // Returned from the member's own "my memberships" view - deliberately does NOT
    // surface which specific plan was purchased as the headline label (status + expiry
    // date is all a member needs; which plan contributed to that date is visible in
    // their payment history instead, where it belongs).
    public record MembershipResponse(
            UUID id,
            String planName,
            LocalDate startDate,
            LocalDate endDate,
            String status,
            LocalDate pausedAt
    ) {}

    // Returned from manager/owner-facing endpoints, where knowing the member and plan
    // matters for day-to-day front-desk operations.
    public record MembershipAdminResponse(
            UUID id,
            UUID memberId,
            String memberName,
            String planName,
            LocalDate startDate,
            LocalDate endDate,
            String status,
            LocalDate pausedAt
    ) {}

    public record EditMembershipRequest(
            LocalDate startDate,
            LocalDate endDate
    ) {}
}