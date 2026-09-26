package com.gymapp.dto;

import com.gymapp.entity.DiscountType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public class CouponDtos {

    public record CreateCouponRequest(
            @NotBlank String code,
            String description,
            @NotNull DiscountType discountType,
            @NotNull @Positive BigDecimal discountValue,
            // Only applied when discountType = PERCENTAGE; ignored (and should be left
            // null) for FIXED.
            BigDecimal maxDiscountAmount,
            LocalDateTime startsAt,
            LocalDateTime endsAt,
            boolean firstTimeBuyersOnly,
            Integer maxRedemptions
    ) {}

    // All fields optional/nullable - null means "leave as is", EXCEPT maxDiscountAmount,
    // which follows Product's discountPrice convention: always set from what's sent, so
    // an explicit null is how the Owner clears a previously-configured cap.
    public record UpdateCouponRequest(
            String code,
            String description,
            DiscountType discountType,
            BigDecimal discountValue,
            BigDecimal maxDiscountAmount,
            LocalDateTime startsAt,
            LocalDateTime endsAt,
            Boolean active,
            Boolean firstTimeBuyersOnly,
            Integer maxRedemptions
    ) {}

    public record CouponResponse(
            UUID id,
            String code,
            String description,
            DiscountType discountType,
            BigDecimal discountValue,
            BigDecimal maxDiscountAmount,
            LocalDateTime startsAt,
            LocalDateTime endsAt,
            boolean active,
            boolean firstTimeBuyersOnly,
            Integer maxRedemptions,
            int timesRedeemed,
            // Computed: active AND within the date window AND (no cap or not yet reached).
            // Doesn't check first-time-buyer eligibility, since that's member-specific.
            boolean currentlyValid
    ) {}

    // Front-desk "does this code work for this member" check, called before purchase so
    // a mistyped or expired code surfaces immediately rather than at order submission.
    public record ValidateCouponRequest(
            @NotBlank String code,
            @NotNull UUID memberId
    ) {}

    // discountAmount is now included - the front desk (and the frontend's subtotal
    // display) can show the real amount taken off immediately, rather than recomputing
    // percentage-vs-cap logic client-side and risking it drifting from the server's math.
    public record ValidateCouponResponse(
            boolean valid,
            String message,
            DiscountType discountType,
            BigDecimal discountValue,
            BigDecimal maxDiscountAmount
    ) {}
}