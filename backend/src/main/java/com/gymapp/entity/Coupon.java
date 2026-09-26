package com.gymapp.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "coupons")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Coupon {

    @Id
    @GeneratedValue
    private UUID id;

    // Stored upper-cased/trimmed (see CouponService) so lookups at redemption time are
    // case-insensitive without needing a citext column.
    @Column(nullable = false, unique = true)
    private String code;

    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DiscountType discountType;

    // PERCENTAGE: 0-100. FIXED: a flat currency amount, capped at the order subtotal so a
    // coupon can never make a total go negative (see ProductOrderService).
    @Column(nullable = false)
    private BigDecimal discountValue;

    // Both nullable - null means unbounded on that side, same convention as Product's
    // discount window.
    private LocalDateTime startsAt;
    private LocalDateTime endsAt;

    @Builder.Default
    private boolean active = true;

    // Restricts redemption to a member with no prior COMPLETED/CONFIRMED product order -
    // enforced in ProductOrderService, not here.
    @Builder.Default
    private boolean firstTimeBuyersOnly = false;

    // Nullable - no cap on total redemptions.
    private Integer maxRedemptions;

    @Builder.Default
    private int timesRedeemed = 0;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    // Only meaningful for discountType = PERCENTAGE - caps the absolute amount taken off
    // (e.g. "20% off, up to Rs. 500"). Null means uncapped. Ignored for FIXED coupons,
    // where discountValue already is the fixed amount.
    private BigDecimal maxDiscountAmount;
}