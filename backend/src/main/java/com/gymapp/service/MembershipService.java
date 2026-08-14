package com.gymapp.service;

import com.gymapp.dto.MembershipDtos.*;
import com.gymapp.entity.*;
import com.gymapp.repository.BranchRepository;
import com.gymapp.repository.MembershipPlanRepository;
import com.gymapp.repository.MembershipRepository;
import com.gymapp.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class MembershipService {

    private final MembershipPlanRepository planRepository;
    private final MembershipRepository membershipRepository;
    private final BranchRepository branchRepository;
    private final UserRepository userRepository;

    public MembershipService(MembershipPlanRepository planRepository,
                             MembershipRepository membershipRepository,
                             BranchRepository branchRepository,
                             UserRepository userRepository) {
        this.planRepository = planRepository;
        this.membershipRepository = membershipRepository;
        this.branchRepository = branchRepository;
        this.userRepository = userRepository;
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

    // Called by a manager/owner after collecting cash payment (see SecurityConfig - this
    // is no longer member-self-service). If the member already has an active, unexpired
    // membership, we extend it rather than create a second row that's simultaneously
    // "ACTIVE" - simplest correct behavior for now. This does mean we lose a distinct
    // purchase history per transaction; a proper Payment/audit-trail entity (Phase 2)
    // is the right place to preserve that, this just keeps membership status unambiguous.
    @Transactional
    public MembershipResponse purchase(UUID memberId, PurchaseRequest req) {
        User member = userRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("Member not found"));
        MembershipPlan plan = planRepository.findById(req.planId())
                .orElseThrow(() -> new IllegalArgumentException("Plan not found"));

        var existingActive = membershipRepository
                .findFirstByMemberIdAndStatusOrderByEndDateDesc(memberId, MembershipStatus.ACTIVE)
                .filter(m -> !m.getEndDate().isBefore(LocalDate.now()));

        Membership membership;
        if (existingActive.isPresent()) {
            membership = existingActive.get();
            membership.setPlan(plan);
            membership.setBranch(plan.getBranch());
            membership.setEndDate(membership.getEndDate().plusMonths(plan.getDurationMonths()));
        } else {
            LocalDate start = LocalDate.now();
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
        return toMembershipResponse(membership);
    }

    @Transactional(readOnly = true)
    public List<MembershipResponse> listForMember(UUID memberId) {
        return membershipRepository.findByMemberId(memberId).stream()
                .map(this::toMembershipResponse).toList();
    }

    private PlanResponse toPlanResponse(MembershipPlan p) {
        return new PlanResponse(p.getId(), p.getName(), p.getDurationMonths(), p.getPrice());
    }

    private MembershipResponse toMembershipResponse(Membership m) {
        return new MembershipResponse(m.getId(), m.getPlan().getName(), m.getStartDate(), m.getEndDate(), m.getStatus().name());
    }
}