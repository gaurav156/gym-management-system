package com.gymapp.service;

import com.gymapp.dto.MembershipDtos.*;
import com.gymapp.entity.*;
import com.gymapp.invoice.PaymentRecordedEvent;
import com.gymapp.repository.BranchRepository;
import com.gymapp.repository.CouponRepository;
import com.gymapp.repository.MembershipPlanRepository;
import com.gymapp.repository.MembershipRepository;
import com.gymapp.repository.PaymentRepository;
import com.gymapp.repository.UserRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
public class MembershipService {

    private final MembershipPlanRepository planRepository;
    private final MembershipRepository membershipRepository;
    private final BranchRepository branchRepository;
    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;
    private final CouponRepository couponRepository;
    private final CouponService couponService;
    private final ApplicationEventPublisher eventPublisher;

    public MembershipService(MembershipPlanRepository planRepository,
                             MembershipRepository membershipRepository,
                             BranchRepository branchRepository,
                             UserRepository userRepository,
                             PaymentRepository paymentRepository,
                             CouponRepository couponRepository,
                             CouponService couponService,
                             ApplicationEventPublisher eventPublisher) {
        this.planRepository = planRepository;
        this.membershipRepository = membershipRepository;
        this.branchRepository = branchRepository;
        this.userRepository = userRepository;
        this.paymentRepository = paymentRepository;
        this.couponRepository = couponRepository;
        this.couponService = couponService;
        this.eventPublisher = eventPublisher;
    }

    public PlanResponse createPlan(CreatePlanRequest req) {
        MembershipPlan plan = MembershipPlan.builder()
                .name(req.name())
                .durationMonths(req.durationMonths())
                .price(req.price())
                .discountPrice(req.discountPrice())
                .discountStartsAt(req.discountStartsAt())
                .discountEndsAt(req.discountEndsAt())
                .active(true)
                .build();
        plan = planRepository.save(plan);
        return toPlanResponse(plan);
    }

    // Owner-only (enforced at the controller). Same partial-update convention as
    // ProductService.update() - discount fields always follow what's sent (an explicit
    // null clears a configured discount).
    @Transactional
    public PlanResponse updatePlan(UUID planId, UpdatePlanRequest req) {
        MembershipPlan plan = planRepository.findById(planId)
                .orElseThrow(() -> new IllegalArgumentException("Plan not found"));
        if (req.name() != null && !req.name().isBlank()) plan.setName(req.name());
        if (req.durationMonths() != null) plan.setDurationMonths(req.durationMonths());
        if (req.price() != null) plan.setPrice(req.price());
        plan.setDiscountPrice(req.discountPrice());
        plan.setDiscountStartsAt(req.discountStartsAt());
        plan.setDiscountEndsAt(req.discountEndsAt());
        if (req.active() != null) plan.setActive(req.active());
        plan = planRepository.save(plan);
        return toPlanResponse(plan);
    }

    public List<PlanResponse> listPlans() {
        return planRepository.findByActiveTrue().stream()
                .map(this::toPlanResponse).toList();
    }

    // Called by a manager/owner after collecting payment at the front desk. Each purchase
    // becomes its own row. If the member already has paid-for time that hasn't lapsed yet,
    // this new purchase queues up starting the day after that time runs out, regardless of
    // any startDate supplied.
    //
    // Partial payment: amountPaid may be less than the plan's effective (post-discount,
    // post-coupon) price. The membership is still created ACTIVE immediately - the
    // shortfall is tracked as a balance due by balanceDueDate, and if it isn't cleared by
    // then, MembershipDueJob auto-pauses the membership (denying check-in) the same way a
    // manual pause would.
    @Transactional
    public MembershipResponse purchase(UUID memberId, PurchaseRequest req, UUID recordedByUserId) {
        User member = userRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("Member not found"));
        MembershipPlan plan = planRepository.findById(req.planId())
                .orElseThrow(() -> new IllegalArgumentException("Plan not found"));
        User recordedBy = userRepository.findById(recordedByUserId)
                .orElseThrow(() -> new IllegalArgumentException("Recording user not found"));
        Branch branch = branchRepository.findById(req.branchId())
                .orElseThrow(() -> new IllegalArgumentException("Branch not found"));

        if (!branch.isActive()) throw new IllegalArgumentException(branch.getName() + " is inactive");

        LocalDate today = LocalDate.now();
        LocalDate latestQueuedEnd = membershipRepository.findLatestQueuedEndDate(memberId, today);

        LocalDate start = latestQueuedEnd != null
                ? latestQueuedEnd.plusDays(1)
                : (req.startDate() != null ? req.startDate() : today);
        LocalDate end = start.plusMonths(plan.getDurationMonths());

        BigDecimal planPrice = effectivePrice(plan);

        Coupon coupon = null;
        BigDecimal discountAmount = BigDecimal.ZERO;
        if (req.couponCode() != null && !req.couponCode().isBlank()) {
            coupon = couponRepository.findByCode(req.couponCode().trim().toUpperCase())
                    .orElseThrow(() -> new IllegalArgumentException("Coupon not found"));
            String reason = couponService.membershipIneligibilityReason(coupon, memberId);
            if (reason != null) throw new IllegalArgumentException(reason);
            discountAmount = couponService.computeDiscount(coupon, planPrice);
            coupon.setTimesRedeemed(coupon.getTimesRedeemed() + 1);
            couponRepository.save(coupon);
        }

        BigDecimal totalAmount = planPrice.subtract(discountAmount);
        BigDecimal amountPaid = req.amountPaid() != null ? req.amountPaid() : totalAmount;

        if (amountPaid.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount paid must be greater than zero");
        }
        if (amountPaid.compareTo(totalAmount) > 0) {
            throw new IllegalArgumentException("Amount paid cannot exceed the plan's total price");
        }

        boolean fullyPaid = amountPaid.compareTo(totalAmount) >= 0;
        PaymentStatus paymentStatus = fullyPaid ? PaymentStatus.PAID : PaymentStatus.PARTIAL;
        LocalDate balanceDueDate = null;
        if (!fullyPaid) {
            balanceDueDate = req.balanceDueDate() != null ? req.balanceDueDate() : start.plusMonths(1);
            if (!balanceDueDate.isAfter(today)) {
                throw new IllegalArgumentException("The balance due date must be in the future");
            }
        }

        Membership membership = Membership.builder()
                .member(member)
                .plan(plan)
                .branch(branch)
                .startDate(start)
                .endDate(end)
                .status(MembershipStatus.ACTIVE)
                .totalAmount(totalAmount)
                .amountPaid(amountPaid)
                .paymentStatus(paymentStatus)
                .balanceDueDate(balanceDueDate)
                .coupon(coupon)
                .discountAmount(discountAmount)
                .build();
        membership = membershipRepository.save(membership);

        Payment payment = Payment.builder()
                .member(member)
                .branch(branch)
                .recordedBy(recordedBy)
                .membership(membership)
                .amount(amountPaid)
                .type(PaymentType.MEMBERSHIP)
                .mode(req.mode())
                .build();
        paymentRepository.save(payment);

        // Fires after this transaction commits - the purchase itself never waits on or
        // fails because of mail delivery.
        eventPublisher.publishEvent(new PaymentRecordedEvent(payment.getId()));

        // Enrollment date is the date of the member's FIRST purchase ever, set once and
        // never changed again - not tied to the plan's start date, since that can be
        // future-dated (they enrolled today even if their access begins later).
        if (member.getEnrollmentDate() == null) {
            member.setEnrollmentDate(LocalDate.now());
            userRepository.save(member);
        }

        return toMembershipResponse(membership);
    }

    // Owner/Manager clearing some or all of an outstanding balance. Fully clearing it also
    // auto-resumes a membership that MembershipDueJob paused for nonpayment - restoring
    // the paused days to endDate, same as a manual resume() - but never touches a
    // membership paused MANUALLY; that only ever clears via the explicit resume() action.
    @Transactional
    public MembershipAdminResponse recordAdditionalPayment(UUID membershipId, RecordMembershipPaymentRequest req, UUID recordedByUserId) {
        Membership m = membershipRepository.findById(membershipId)
                .orElseThrow(() -> new IllegalArgumentException("Membership not found"));
        if (m.getPaymentStatus() == PaymentStatus.PAID) {
            throw new IllegalArgumentException("This membership has no outstanding balance");
        }
        User recordedBy = userRepository.findById(recordedByUserId)
                .orElseThrow(() -> new IllegalArgumentException("Recording user not found"));
        Branch branch = branchRepository.findById(req.branchId())
                .orElseThrow(() -> new IllegalArgumentException("Branch not found"));

        BigDecimal remaining = m.getTotalAmount().subtract(m.getAmountPaid());
        if (req.amount().compareTo(remaining) > 0) {
            throw new IllegalArgumentException("Amount exceeds the balance due (" + remaining + ")");
        }

        m.setAmountPaid(m.getAmountPaid().add(req.amount()));

        boolean nowFullyPaid = m.getAmountPaid().compareTo(m.getTotalAmount()) >= 0;
        if (nowFullyPaid) {
            m.setPaymentStatus(PaymentStatus.PAID);
            m.setBalanceDueDate(null);

            if (m.getStatus() == MembershipStatus.PAUSED && m.getPausedReason() == PausedReason.NONPAYMENT) {
                long daysPaused = ChronoUnit.DAYS.between(m.getPausedAt(), LocalDate.now());
                m.setEndDate(m.getEndDate().plusDays(daysPaused));
                m.setStatus(MembershipStatus.ACTIVE);
                m.setPausedAt(null);
                m.setPausedReason(null);
            }
        }
        m = membershipRepository.save(m);

        Payment payment = Payment.builder()
                .member(m.getMember())
                .branch(branch)
                .recordedBy(recordedBy)
                .membership(m)
                .amount(req.amount())
                .type(PaymentType.MEMBERSHIP)
                .mode(req.mode())
                .build();
        paymentRepository.save(payment);
        eventPublisher.publishEvent(new PaymentRecordedEvent(payment.getId()));

        return toAdminResponse(m);
    }

    @Transactional
    public MembershipAdminResponse cancel(UUID membershipId) {
        Membership m = membershipRepository.findById(membershipId)
                .orElseThrow(() -> new IllegalArgumentException("Membership not found"));
        m.setStatus(MembershipStatus.CANCELLED);
        m = membershipRepository.save(m);
        return toAdminResponse(m);
    }

    // Pausing only makes sense for the segment that's actually running right now.
    @Transactional
    public MembershipAdminResponse pause(UUID membershipId) {
        Membership m = membershipRepository.findById(membershipId)
                .orElseThrow(() -> new IllegalArgumentException("Membership not found"));
        LocalDate today = LocalDate.now();
        if (m.getStatus() != MembershipStatus.ACTIVE
                || m.getStartDate().isAfter(today) || m.getEndDate().isBefore(today)) {
            throw new IllegalArgumentException("Only the currently running membership can be paused");
        }
        m.setStatus(MembershipStatus.PAUSED);
        m.setPausedAt(today);
        m.setPausedReason(PausedReason.MANUAL);
        m = membershipRepository.save(m);
        return toAdminResponse(m);
    }

    // Resuming adds back however many days the membership was paused, so a member never
    // loses paid-for time by pausing - regardless of whether the pause was manual or
    // (unusually) resumed by hand while still owing money.
    @Transactional
    public MembershipAdminResponse resume(UUID membershipId) {
        Membership m = membershipRepository.findById(membershipId)
                .orElseThrow(() -> new IllegalArgumentException("Membership not found"));
        if (m.getStatus() != MembershipStatus.PAUSED || m.getPausedAt() == null) {
            throw new IllegalArgumentException("Membership is not currently paused");
        }
        long daysPaused = ChronoUnit.DAYS.between(m.getPausedAt(), LocalDate.now());
        m.setEndDate(m.getEndDate().plusDays(daysPaused));
        m.setStatus(MembershipStatus.ACTIVE);
        m.setPausedAt(null);
        m.setPausedReason(null);
        m = membershipRepository.save(m);
        return toAdminResponse(m);
    }

    // Manual correction tool for a manager/owner - e.g. fixing a mis-entered date. Deliberately
    // minimal (dates only) rather than allowing arbitrary field edits. Status is never edited
    // directly here - it's derived from these dates wherever it's displayed, so correcting the
    // dates is enough to correct the displayed status too.
    @Transactional
    public MembershipAdminResponse edit(UUID membershipId, EditMembershipRequest req) {
        Membership m = membershipRepository.findById(membershipId)
                .orElseThrow(() -> new IllegalArgumentException("Membership not found"));

        LocalDate newStart = req.startDate() != null ? req.startDate() : m.getStartDate();
        LocalDate newEnd = req.endDate() != null ? req.endDate() : m.getEndDate();
        if (newEnd.isBefore(newStart)) {
            throw new IllegalArgumentException("End date cannot be before start date");
        }

        m.setStartDate(newStart);
        m.setEndDate(newEnd);
        m = membershipRepository.save(m);
        return toAdminResponse(m);
    }

    @Transactional(readOnly = true)
    public List<MembershipResponse> listForMember(UUID memberId) {
        return membershipRepository.findByMemberId(memberId).stream()
                .map(this::toMembershipResponse).toList();
    }

    // Staff-facing version of listForMember - same underlying rows, admin-shaped response
    // (includes memberId/memberName so this can reuse the same rendering as the branch-wide
    // list). Deliberately NOT branch-scoped: a member's plans are visible from any branch
    // they're assigned to, not just the one where the purchase happened to be recorded.
    @Transactional(readOnly = true)
    public List<MembershipAdminResponse> listAdminForMember(UUID memberId) {
        return membershipRepository.findByMemberId(memberId).stream()
                .map(this::toAdminResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<MembershipAdminResponse> listForBranch(UUID branchId) {
        return membershipRepository.findByMemberAssignedToBranch(branchId).stream()
                .map(this::toAdminResponse).toList();
    }

    boolean isPlanDiscountActive(MembershipPlan p) {
        if (p.getDiscountPrice() == null) return false;
        LocalDateTime now = LocalDateTime.now();
        if (p.getDiscountStartsAt() != null && now.isBefore(p.getDiscountStartsAt())) return false;
        if (p.getDiscountEndsAt() != null && now.isAfter(p.getDiscountEndsAt())) return false;
        return true;
    }

    BigDecimal effectivePrice(MembershipPlan p) {
        return isPlanDiscountActive(p) ? p.getDiscountPrice() : p.getPrice();
    }

    private PlanResponse toPlanResponse(MembershipPlan p) {
        return new PlanResponse(p.getId(), p.getName(), p.getDurationMonths(), p.getPrice(),
                p.getDiscountPrice(), p.getDiscountStartsAt(), p.getDiscountEndsAt(),
                effectivePrice(p), isPlanDiscountActive(p));
    }

    private MembershipResponse toMembershipResponse(Membership m) {
        return new MembershipResponse(m.getId(), m.getPlan().getName(), m.getStartDate(),
                m.getEndDate(), m.getStatus().name(), m.getPausedAt(),
                m.getTotalAmount(), m.getAmountPaid(), m.getTotalAmount().subtract(m.getAmountPaid()),
                m.getPaymentStatus().name(), m.getBalanceDueDate());
    }

    private MembershipAdminResponse toAdminResponse(Membership m) {
        return new MembershipAdminResponse(m.getId(), m.getMember().getId(), m.getMember().getName(),
                m.getPlan().getName(), m.getStartDate(), m.getEndDate(), m.getStatus().name(), m.getPausedAt(),
                m.getTotalAmount(), m.getAmountPaid(), m.getTotalAmount().subtract(m.getAmountPaid()),
                m.getPaymentStatus().name(), m.getBalanceDueDate());
    }
}