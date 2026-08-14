package com.gymapp.controller;

import com.gymapp.dto.MembershipDtos.*;
import com.gymapp.service.MembershipService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class MembershipController {

    private final MembershipService membershipService;

    public MembershipController(MembershipService membershipService) {
        this.membershipService = membershipService;
    }

    @PostMapping("/plans/manage")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public PlanResponse createPlan(@Valid @RequestBody CreatePlanRequest req) {
        return membershipService.createPlan(req);
    }

    @GetMapping("/plans")
    public List<PlanResponse> listPlans(@RequestParam UUID branchId) {
        return membershipService.listPlans(branchId);
    }

    @PostMapping("/memberships/purchase")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public MembershipResponse purchase(@RequestParam UUID memberId,
                                       @Valid @RequestBody PurchaseRequest req,
                                       Authentication authentication) {
        UUID recordedBy = UUID.fromString((String) authentication.getDetails());
        return membershipService.purchase(memberId, req, recordedBy);
    }

    @GetMapping("/memberships/mine")
    public List<MembershipResponse> mine(@RequestParam UUID memberId) {
        return membershipService.listForMember(memberId);
    }
}