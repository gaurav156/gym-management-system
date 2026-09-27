package com.gymapp.dto;

import com.gymapp.entity.PaymentMode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public class MembershipDtos {

    // No longer branch-scoped - a plan created here is purchasable and valid at every
    // branch, which is what makes cross-branch access work correctly for a transferred
    // or multi-branch member.
    public record CreatePlanRequest(
            @NotBlank String name,
            @Positive Integer durationMonths,
            @NotNull BigDecimal price,
            BigDecimal discountPrice,
            LocalDateTime discountStartsAt,
            LocalDateTime discountEndsAt
    ) {}

    // All fields optional/nullable - null means "leave as is", same convention as
    // UpdateProductRequest, except discountPrice/discountStartsAt/discountEndsAt which
    // always follow what's sent (an explicit null clears a configured discount).
    public record UpdatePlanRequest(
            String name,
            Integer durationMonths,
            BigDecimal price,
            BigDecimal discountPrice,
            LocalDateTime discountStartsAt,
            LocalDateTime discountEndsAt,
            Boolean active
    ) {}

    public record PlanResponse(
            UUID id,
            String name,
            Integer durationMonths,
            BigDecimal price,
            BigDecimal discountPrice,
            LocalDateTime discountStartsAt,
            LocalDateTime discountEndsAt,
            BigDecimal effectivePrice,
            boolean discountActive
    ) {}

    public record PurchaseRequest(
            @NotNull UUID planId,
            @NotNull PaymentMode mode,
            // Which branch processed this sale - used for the Payment/Membership record,
            // not as an access restriction (plans are chain-wide, so this is purely
            // "where did the cash change hands" bookkeeping).
            @NotNull UUID branchId,
            // Only used when the member has no current unexpired ACTIVE membership.
            LocalDate startDate,
            // Null means "paid in full" (the plan's effective price minus any coupon
            // discount). A lower amount records a partial payment - the difference becomes
            // the membership's balance due.
            BigDecimal amountPaid,
            // Only meaningful when amountPaid is a partial payment. Null defaults to one
            // month after the membership's start date.
            LocalDate balanceDueDate,
            String couponCode
    ) {}

    // Owner/Manager recording a later payment against an already-purchased membership's
    // outstanding balance.
    public record RecordMembershipPaymentRequest(
            @NotNull @Positive BigDecimal amount,
            @NotNull PaymentMode mode,
            @NotNull UUID branchId
    ) {}

    // Returned from the member's own "my memberships" view.
    public record MembershipResponse(
            UUID id,
            String planName,
            LocalDate startDate,
            LocalDate endDate,
            String status,
            LocalDate pausedAt,
            BigDecimal totalAmount,
            BigDecimal amountPaid,
            BigDecimal balanceDue,
            String paymentStatus,
            LocalDate balanceDueDate
    ) {}

    // Returned from manager/owner-facing endpoints.
    public record MembershipAdminResponse(
            UUID id,
            UUID memberId,
            String memberName,
            String planName,
            LocalDate startDate,
            LocalDate endDate,
            String status,
            LocalDate pausedAt,
            BigDecimal totalAmount,
            BigDecimal amountPaid,
            BigDecimal balanceDue,
            String paymentStatus,
            LocalDate balanceDueDate
    ) {}

    public record EditMembershipRequest(
            LocalDate startDate,
            LocalDate endDate
    ) {}
}