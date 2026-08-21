package com.gymapp.controller;

import com.gymapp.dto.BranchDtos.*;
import com.gymapp.entity.Role;
import com.gymapp.service.BranchService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/branches")
public class BranchController {

    private final BranchService branchService;

    public BranchController(BranchService branchService) {
        this.branchService = branchService;
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public BranchResponse create(@Valid @RequestBody CreateBranchRequest req) {
        return branchService.create(req);
    }

    // Owner sees every branch; a manager should call /mine instead
    @GetMapping
    @PreAuthorize("hasRole('OWNER')")
    public List<BranchResponse> listAll() {
        return branchService.listAll();
    }

    @GetMapping("/mine")
    public List<BranchResponse> listMine(@RequestParam UUID userId) {
        return branchService.listForUser(userId);
    }

    // Owner-only: pick anyone by role to manage their branch assignments, without first
    // needing to know which branch(es) they're currently on.
    @GetMapping("/people")
    @PreAuthorize("hasRole('OWNER')")
    public List<PersonSummary> listPeople(@RequestParam Role role) {
        return branchService.listPeopleByRole(role);
    }

    // Owner-only: sets a person's branch assignments to exactly this list - works for
    // Members, Trainers, and Managers. Replaces the old single from/to transfer.
    @PutMapping("/assignments/{userId}")
    @PreAuthorize("hasRole('OWNER')")
    public List<BranchResponse> updateAssignments(@PathVariable UUID userId, @Valid @RequestBody UpdateAssignmentsRequest req) {
        return branchService.updateAssignments(userId, req);
    }
}