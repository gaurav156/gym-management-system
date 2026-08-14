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

    // NOTE: this creates the membership record marked ACTIVE directly - in Phase 2 wire this
    // through a Payment record first (cash recorded by a manager, or online via a gateway),
    // then flip status to ACTIVE only once payment is confirmed.
    @Transactional
    public MembershipResponse purchase(UUID memberId, PurchaseRequest req) {
        User member = userRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("Member not found"));
        MembershipPlan plan = planRepository.findById(req.planId())
                .orElseThrow(() -> new IllegalArgumentException("Plan not found"));

        LocalDate start = LocalDate.now();
        LocalDate end = start.plusMonths(plan.getDurationMonths());

        Membership membership = Membership.builder()
                .member(member)
                .plan(plan)
                .branch(plan.getBranch())
                .startDate(start)
                .endDate(end)
                .status(MembershipStatus.ACTIVE)
                .build();
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
