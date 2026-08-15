package com.gymapp.service;

import com.gymapp.dto.MembershipDtos.*;
import com.gymapp.entity.*;
import com.gymapp.repository.BranchRepository;
import com.gymapp.repository.MembershipPlanRepository;
import com.gymapp.repository.MembershipRepository;
import com.gymapp.repository.PaymentRepository;
import com.gymapp.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
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

    public MembershipService(MembershipPlanRepository planRepository,
                             MembershipRepository membershipRepository,
                             BranchRepository branchRepository,
                             UserRepository userRepository,
                             PaymentRepository paymentRepository) {
        this.planRepository = planRepository;
        this.membershipRepository = membershipRepository;
        this.branchRepository = branchRepository;
        this.userRepository = userRepository;
        this.paymentRepository = paymentRepository;
    }

    public PlanResponse createPlan(CreatePlanRequest req) {
        Branch branch = branchRepository.findById(req.branchId())
                .orElseThrow(() -> new IllegalArgumentException("Branch not found"));
        MembershipPlan plan = MembershipPlan.builder()
                .branch(branch)
                .name(req.name())
                .durationMonths(req.durationMonths())
                .price(req.price())
                .active(true)
                .build();
        plan = planRepository.save(plan);
        return toPlanResponse(plan);
    }

    public List<PlanResponse> listPlans(UUID branchId) {
        return planRepository.findByBranchIdAndActiveTrue(branchId).stream()
                .map(this::toPlanResponse).toList();
    }

    // Called by a manager/owner after collecting payment at the front desk. If the member
    // already has an active, unexpired membership, we extend it (ignoring any supplied
    // startDate - it always continues the day after the current one ends). Otherwise a new
    // membership starts on the given startDate, or today if none was supplied.
    // recordedByUserId is the authenticated manager/owner's own ID (from the JWT), never
    // trusted from the request body, so the Payment audit trail can't be spoofed.
    @Transactional
    public MembershipResponse purchase(UUID memberId, PurchaseRequest req, UUID recordedByUserId) {
        User member = userRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("Member not found"));
        MembershipPlan plan = planRepository.findById(req.planId())
                .orElseThrow(() -> new IllegalArgumentException("Plan not found"));
        User recordedBy = userRepository.findById(recordedByUserId)
                .orElseThrow(() -> new IllegalArgumentException("Recording user not found"));

        var existingActive = membershipRepository
                .findFirstByMemberIdAndStatusOrderByEndDateDesc(memberId, MembershipStatus.ACTIVE)
                .filter(m -> !m.getEndDate().isBefore(LocalDate.now()));

        Membership membership;
        if (existingActive.isPresent()) {
            membership = existingActive.get();
            // Deliberately NOT overwriting membership.plan or applying req.startDate() here -
            // the label shown to the member should stay as their original plan, and a renewal
            // always continues from the current end date regardless of any date supplied.
            membership.setEndDate(membership.getEndDate().plusMonths(plan.getDurationMonths()));
        } else {
            LocalDate start = req.startDate() != null ? req.startDate() : LocalDate.now();
            LocalDate end = start.plusMonths(plan.getDurationMonths());
            membership = Membership.builder()
                    .member(member)
                    .plan(plan)
                    .branch(plan.getBranch())
                    .startDate(start)
                    .endDate(end)
                    .status(MembershipStatus.ACTIVE)
                    .build();
        }
        membership = membershipRepository.save(membership);

        Payment payment = Payment.builder()
                .member(member)
                .branch(plan.getBranch())
                .recordedBy(recordedBy)
                .membership(membership)
                .amount(plan.getPrice())
                .type(PaymentType.MEMBERSHIP)
                .mode(req.mode())
                .build();
        paymentRepository.save(payment);

        return toMembershipResponse(membership);
    }

    @Transactional
    public MembershipAdminResponse cancel(UUID membershipId) {
        Membership m = membershipRepository.findById(membershipId)
                .orElseThrow(() -> new IllegalArgumentException("Membership not found"));
        m.setStatus(MembershipStatus.CANCELLED);
        m = membershipRepository.save(m);
        return toAdminResponse(m);
    }

    @Transactional
    public MembershipAdminResponse pause(UUID membershipId) {
        Membership m = membershipRepository.findById(membershipId)
                .orElseThrow(() -> new IllegalArgumentException("Membership not found"));
        if (m.getStatus() != MembershipStatus.ACTIVE) {
            throw new IllegalArgumentException("Only an active membership can be paused");
        }
        m.setStatus(MembershipStatus.PAUSED);
        m.setPausedAt(LocalDate.now());
        m = membershipRepository.save(m);
        return toAdminResponse(m);
    }

    // Resuming adds back however many days the membership was paused, so a member never
    // loses paid-for time by pausing.
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
        m = membershipRepository.save(m);
        return toAdminResponse(m);
    }

    // Manual correction tool for a manager/owner - e.g. fixing a mis-entered date. Deliberately
    // minimal (dates only) rather than allowing arbitrary field edits.
    @Transactional
    public MembershipAdminResponse edit(UUID membershipId, EditMembershipRequest req) {
        Membership m = membershipRepository.findById(membershipId)
                .orElseThrow(() -> new IllegalArgumentException("Membership not found"));
        if (req.startDate() != null) m.setStartDate(req.startDate());
        if (req.endDate() != null) m.setEndDate(req.endDate());
        m = membershipRepository.save(m);
        return toAdminResponse(m);
    }

    @Transactional(readOnly = true)
    public List<MembershipResponse> listForMember(UUID memberId) {
        return membershipRepository.findByMemberId(memberId).stream()
                .map(this::toMembershipResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<MembershipAdminResponse> listForBranch(UUID branchId) {
        return membershipRepository.findByBranchIdOrderByEndDateDesc(branchId).stream()
                .map(this::toAdminResponse).toList();
    }

    private PlanResponse toPlanResponse(MembershipPlan p) {
        return new PlanResponse(p.getId(), p.getName(), p.getDurationMonths(), p.getPrice());
    }

    private MembershipResponse toMembershipResponse(Membership m) {
        return new MembershipResponse(m.getId(), m.getPlan().getName(), m.getStartDate(),
                m.getEndDate(), m.getStatus().name(), m.getPausedAt());
    }

    private MembershipAdminResponse toAdminResponse(Membership m) {
        return new MembershipAdminResponse(m.getId(), m.getMember().getId(), m.getMember().getName(),
                m.getPlan().getName(), m.getStartDate(), m.getEndDate(), m.getStatus().name(), m.getPausedAt());
    }
}