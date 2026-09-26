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
                .maxDiscountAmount(req.discountType() == DiscountType.PERCENTAGE ? req.maxDiscountAmount() : null)
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

        if (req.code() != null && !req.code().isBlank()) {
            String newCode = req.code().trim().toUpperCase();
            if (!newCode.equals(coupon.getCode())) {
                couponRepository.findByCode(newCode).ifPresent(existing -> {
                    throw new IllegalArgumentException("A coupon with this code already exists");
                });
                coupon.setCode(newCode);
            }
        }
        if (req.description() != null) coupon.setDescription(req.description());
        if (req.discountType() != null) coupon.setDiscountType(req.discountType());
        if (req.discountValue() != null) coupon.setDiscountValue(req.discountValue());
        // maxDiscountAmount always follows what's sent (including null-to-clear), same
        // convention as Product.discountPrice - but only meaningful for PERCENTAGE, so a
        // switch to FIXED clears it regardless of what was supplied.
        DiscountType effectiveType = req.discountType() != null ? req.discountType() : coupon.getDiscountType();
        coupon.setMaxDiscountAmount(effectiveType == DiscountType.PERCENTAGE ? req.maxDiscountAmount() : null);
        coupon.setStartsAt(req.startsAt());
        coupon.setEndsAt(req.endsAt());
        if (req.active() != null) coupon.setActive(req.active());
        if (req.firstTimeBuyersOnly() != null) coupon.setFirstTimeBuyersOnly(req.firstTimeBuyersOnly());
        coupon.setMaxRedemptions(req.maxRedemptions());

        coupon = couponRepository.save(coupon);
        return toResponse(coupon);
    }

    // Owner-only (enforced at the controller). A coupon that's already been redeemed
    // stays available for historical invoices' record even after being pulled from
    // active use - so a real delete is only offered when it's never been redeemed;
    // otherwise the Owner is pointed at deactivating instead, same "can't delete, can
    // deactivate" pattern used for products and staff accounts elsewhere.
    @Transactional
    public void delete(UUID couponId) {
        Coupon coupon = couponRepository.findById(couponId)
                .orElseThrow(() -> new IllegalArgumentException("Coupon not found"));
        if (coupon.getTimesRedeemed() > 0) {
            throw new IllegalArgumentException(
                    "This coupon has been redeemed at least once - deleting it would break those orders' " +
                            "discount record. Deactivate it instead so it stops being offered.");
        }
        couponRepository.delete(coupon);
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
            return new ValidateCouponResponse(false, "Coupon not found", null, null, null);
        }
        String reason = ineligibilityReason(coupon.get(), memberId);
        if (reason != null) {
            return new ValidateCouponResponse(false, reason, null, null, null);
        }
        return new ValidateCouponResponse(true, "Coupon applied", coupon.get().getDiscountType(),
                coupon.get().getDiscountValue(), coupon.get().getMaxDiscountAmount());
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

    // Capped at the subtotal (never negative), and for PERCENTAGE also capped at
    // maxDiscountAmount when one is set.
    BigDecimal computeDiscount(Coupon coupon, BigDecimal subtotal) {
        BigDecimal raw = coupon.getDiscountType() == DiscountType.PERCENTAGE
                ? subtotal.multiply(coupon.getDiscountValue()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
                : coupon.getDiscountValue();
        if (coupon.getDiscountType() == DiscountType.PERCENTAGE && coupon.getMaxDiscountAmount() != null) {
            raw = raw.min(coupon.getMaxDiscountAmount());
        }
        return raw.min(subtotal);
    }

    private CouponResponse toResponse(Coupon c) {
        boolean currentlyValid = c.isActive()
                && (c.getStartsAt() == null || !LocalDateTime.now().isBefore(c.getStartsAt()))
                && (c.getEndsAt() == null || !LocalDateTime.now().isAfter(c.getEndsAt()))
                && (c.getMaxRedemptions() == null || c.getTimesRedeemed() < c.getMaxRedemptions());
        return new CouponResponse(c.getId(), c.getCode(), c.getDescription(), c.getDiscountType(),
                c.getDiscountValue(), c.getMaxDiscountAmount(), c.getStartsAt(), c.getEndsAt(), c.isActive(),
                c.isFirstTimeBuyersOnly(), c.getMaxRedemptions(), c.getTimesRedeemed(), currentlyValid);
    }
}