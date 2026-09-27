package com.gymapp.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "memberships")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Membership {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private User member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    private MembershipPlan plan;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branch_id", nullable = false)
    private Branch branch;

    @Column(nullable = false)
    private LocalDate startDate;

    @Column(nullable = false)
    private LocalDate endDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MembershipStatus status;

    // Set when status = PAUSED - used to compute how many days to add back to endDate
    // on resume, so pausing doesn't cost the member any paid-for time.
    private LocalDate pausedAt;

    // Total amount actually owed for this membership after any coupon/plan-sale discount -
    // frozen at purchase time (same reasoning as ProductOrderItem's price snapshot), so a
    // later plan price or discount change never rewrites what a past purchase actually cost.
    @Column(nullable = false)
    private BigDecimal totalAmount;

    // Running total of every Payment recorded against this membership (the purchase
    // payment, plus any later "record payment" calls) - kept as its own column rather than
    // summed from Payment rows on every read, since that history isn't loaded most places
    // this is displayed.
    @Column(nullable = false)
    @Builder.Default
    private BigDecimal amountPaid = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private PaymentStatus paymentStatus = PaymentStatus.PAID;

    // Only meaningful while paymentStatus = PARTIAL - the day by which the remaining
    // balance must be paid. MembershipDueJob auto-pauses this membership once it passes.
    // Comes from the purchase request, defaulting to one month after the start date.
    private LocalDate balanceDueDate;

    // Only meaningful while status = PAUSED - see PausedReason.
    @Enumerated(EnumType.STRING)
    private PausedReason pausedReason;

    // The coupon redeemed at purchase, if any - kept for reference/audit, same pattern as
    // ProductOrder.coupon.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "coupon_id")
    private Coupon coupon;

    @Column(nullable = false)
    @Builder.Default
    private BigDecimal discountAmount = BigDecimal.ZERO;
}