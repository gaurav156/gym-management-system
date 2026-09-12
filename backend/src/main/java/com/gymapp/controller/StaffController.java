package com.gymapp.controller;

import com.gymapp.dto.StaffDtos.StaffSummary;
import com.gymapp.service.StaffDirectoryService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/staff")
public class StaffController {

    private final StaffDirectoryService staffDirectoryService;

    public StaffController(StaffDirectoryService staffDirectoryService) {
        this.staffDirectoryService = staffDirectoryService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public List<StaffSummary> listStaff(@RequestParam UUID branchId) {
        return staffDirectoryService.listStaffForBranch(branchId);
    }
}