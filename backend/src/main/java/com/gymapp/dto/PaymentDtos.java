package com.gymapp.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public class PaymentDtos {

    public record PaymentResponse(
            UUID id,
            String invoiceNumber,
            String memberName,
            String recordedByName,
            String planName,
            BigDecimal amount,
            String type,
            String mode,
            LocalDateTime createdAt
    ) {}

    // Full detail needed to render the invoice document. The four membership* fields are
    // null unless this payment is tied to a membership - when present, they show the
    // membership's overall payment picture (not just this one transaction's amount),
    // which is what lets the invoice show a running balance due for a partially-paid plan.
    public record InvoiceResponse(
            UUID paymentId,
            String invoiceNumber,
            LocalDateTime invoiceDate,
            String branchName,
            String branchAddress,
            String branchPhone,
            String memberName,
            String memberEmail,
            String memberPhone,
            String memberAddress,
            String planName,
            LocalDate membershipStartDate,
            LocalDate membershipEndDate,
            BigDecimal amount,
            String mode,
            String recordedByName,
            String recordedBySignature,
            BigDecimal membershipTotalAmount,
            BigDecimal membershipAmountPaid,
            BigDecimal membershipBalanceDue,
            String membershipPaymentStatus,
            // Coupon discount applied at purchase, if any - membershipTotalAmount already
            // has this subtracted, so membershipTotalAmount + membershipDiscountAmount is
            // the plan's pre-discount price. Both null unless a coupon was actually used.
            BigDecimal membershipDiscountAmount,
            String membershipCouponCode
    ) {}
}