package com.gymapp.controller;

import com.gymapp.dto.PageDtos.PageResponse;
import com.gymapp.dto.StaffDtos.StaffSummary;
import com.gymapp.service.StaffDirectoryService;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

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
    public PageResponse<StaffSummary> listStaff(@RequestParam UUID branchId,
                                                         @RequestParam(required = false) String search,
                                                         @RequestParam(defaultValue = "0") int page,
                                                         @RequestParam(defaultValue = "20") int size) {
        return staffDirectoryService.listStaffForBranch(branchId, search, PageRequest.of(page, size));
    }
}