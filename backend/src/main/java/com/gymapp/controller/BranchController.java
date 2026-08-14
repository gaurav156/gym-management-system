package com.gymapp.controller;

import com.gymapp.dto.BranchDtos.*;
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

    @PostMapping("/transfer")
    @PreAuthorize("hasRole('OWNER')")
    public void transfer(@Valid @RequestBody TransferRequest req) {
        branchService.transferUser(req);
    }
}
