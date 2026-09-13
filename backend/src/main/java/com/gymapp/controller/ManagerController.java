package com.gymapp.controller;

import com.gymapp.dto.ProfileDtos.UpdateProfileRequest;
import com.gymapp.dto.TrainerDtos.TrainerSummary;
import com.gymapp.dto.TrainerDtos.UpdateTrainerDatesRequest;
import com.gymapp.service.ManagerDirectoryService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/managers")
public class ManagerController {

    private final ManagerDirectoryService managerDirectoryService;

    public ManagerController(ManagerDirectoryService managerDirectoryService) {
        this.managerDirectoryService = managerDirectoryService;
    }

    // Owner-only: basic info edit (name/phone/address/photo). Account deletion for a
    // Manager already goes through the existing /api/owner/users/{id} DELETE endpoint -
    // no new endpoint needed for that.
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public TrainerSummary updateInfo(@PathVariable UUID id, @RequestBody UpdateProfileRequest req) {
        return managerDirectoryService.updateManagerInfo(id, req);
    }

    // Owner-only, mirrors TrainerController's /dates endpoint.
    @PutMapping("/{id}/dates")
    @PreAuthorize("hasRole('OWNER')")
    public TrainerSummary updateDates(@PathVariable UUID id, @RequestBody UpdateTrainerDatesRequest req) {
        return managerDirectoryService.updateManagerDates(id, req);
    }
}