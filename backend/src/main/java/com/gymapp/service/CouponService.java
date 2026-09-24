package com.gymapp.service;

import com.gymapp.dto.CouponDtos.*;
import com.gymapp.entity.Coupon;
import com.gymapp.entity.DiscountType;
import com.gymapp.repository.CouponRepository;
import com.gymapp.repository.ProductOrderRepository;
import com.gymapp.entity.ProductOrderStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class CouponService {

    private final CouponRepository couponRepository;
    private final ProductOrderRepository productOrderRepository;

    public CouponService(CouponRepository couponRepository, ProductOrderRepository productOrderRepository) {
        this.couponRepository = couponRepository;
        this.productOrderRepository = productOrderRepository;
    }

    // Owner-only (enforced at the controller).
    @Transactional
    public CouponResponse create(CreateCouponRequest req) {
        String code = req.code().trim().toUpperCase();
        if (couponRepository.findByCode(code).isPresent()) {
            throw new IllegalArgumentException("A coupon with this code already exists");
        }
        Coupon coupon = Coupon.builder()
                .code(code)
                .description(req.description())
                .discountType(req.discountType())
                .discountValue(req.discountValue())
                .startsAt(req.startsAt())
                .endsAt(req.endsAt())
                .active(true)
                .firstTimeBuyersOnly(req.firstTimeBuyersOnly())
                .maxRedemptions(req.maxRedemptions())
                .timesRedeemed(0)
                .build();
        coupon = couponRepository.save(coupon);
        return toResponse(coupon);
    }

    @Transactional
    public CouponResponse update(UUID couponId, UpdateCouponRequest req) {
        Coupon coupon = couponRepository.findById(couponId)
                .orElseThrow(() -> new IllegalArgumentException("Coupon not found"));

        if (req.description() != null) coupon.setDescription(req.description());
        if (req.discountType() != null) coupon.setDiscountType(req.discountType());
        if (req.discountValue() != null) coupon.setDiscountValue(req.discountValue());
        coupon.setStartsAt(req.startsAt());
        coupon.setEndsAt(req.endsAt());
        if (req.active() != null) coupon.setActive(req.active());
        if (req.firstTimeBuyersOnly() != null) coupon.setFirstTimeBuyersOnly(req.firstTimeBuyersOnly());
        coupon.setMaxRedemptions(req.maxRedemptions());

        coupon = couponRepository.save(coupon);
        return toResponse(coupon);
    }

    @Transactional(readOnly = true)
    public List<CouponResponse> list() {
        return couponRepository.findAllByOrderByCreatedAtDesc().stream().map(this::toResponse).toList();
    }

    // Called from the front desk before submitting a purchase, and again internally by
    // ProductOrderService right before redeeming - the second check is what actually
    // gates the discount; this one is just fast feedback in the UI.
    @Transactional(readOnly = true)
    public ValidateCouponResponse validate(String code, UUID memberId) {
        var coupon = couponRepository.findByCode(code.trim().toUpperCase());
        if (coupon.isEmpty()) {
            return new ValidateCouponResponse(false, "Coupon not found", null, null);
        }
        String reason = ineligibilityReason(coupon.get(), memberId);
        if (reason != null) {
            return new ValidateCouponResponse(false, reason, null, null);
        }
        return new ValidateCouponResponse(true, "Coupon applied", coupon.get().getDiscountType(), coupon.get().getDiscountValue());
    }

    // Returns null when eligible, otherwise a human-readable reason - used by both
    // validate() above and ProductOrderService.purchase() so the two can never disagree.
    String ineligibilityReason(Coupon coupon, UUID memberId) {
        if (!coupon.isActive()) return "This coupon is no longer active";
        LocalDateTime now = LocalDateTime.now();
        if (coupon.getStartsAt() != null && now.isBefore(coupon.getStartsAt())) return "This coupon isn't active yet";
        if (coupon.getEndsAt() != null && now.isAfter(coupon.getEndsAt())) return "This coupon has expired";
        if (coupon.getMaxRedemptions() != null && coupon.getTimesRedeemed() >= coupon.getMaxRedemptions()) {
            return "This coupon has already been fully redeemed";
        }
        if (coupon.isFirstTimeBuyersOnly()
                && productOrderRepository.existsByMemberIdAndStatusNot(memberId, ProductOrderStatus.CANCELLED)) {
            return "This coupon is only for first-time buyers";
        }
        return null;
    }

    // Capped at the subtotal so a FIXED coupon (or a misconfigured >100% PERCENTAGE one)
    // can never push the total below zero.
    BigDecimal computeDiscount(Coupon coupon, BigDecimal subtotal) {
        BigDecimal raw = coupon.getDiscountType() == DiscountType.PERCENTAGE
                ? subtotal.multiply(coupon.getDiscountValue()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
                : coupon.getDiscountValue();
        return raw.min(subtotal);
    }

    private CouponResponse toResponse(Coupon c) {
        boolean currentlyValid = c.isActive()
                && (c.getStartsAt() == null || !LocalDateTime.now().isBefore(c.getStartsAt()))
                && (c.getEndsAt() == null || !LocalDateTime.now().isAfter(c.getEndsAt()))
                && (c.getMaxRedemptions() == null || c.getTimesRedeemed() < c.getMaxRedemptions());
        return new CouponResponse(c.getId(), c.getCode(), c.getDescription(), c.getDiscountType(),
                c.getDiscountValue(), c.getStartsAt(), c.getEndsAt(), c.isActive(), c.isFirstTimeBuyersOnly(),
                c.getMaxRedemptions(), c.getTimesRedeemed(), currentlyValid);
    }
}