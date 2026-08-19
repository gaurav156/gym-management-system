package com.gymapp.controller;

import com.gymapp.dto.ProfileDtos.UpdateProfileRequest;
import com.gymapp.dto.TrainerDtos.TrainerSummary;
import com.gymapp.dto.TrainerDtos.UpdateTrainerDatesRequest;
import com.gymapp.service.TrainerDirectoryService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
public class TrainerController {

    private final TrainerDirectoryService trainerDirectoryService;

    public TrainerController(TrainerDirectoryService trainerDirectoryService) {
        this.trainerDirectoryService = trainerDirectoryService;
    }

    @GetMapping("/api/trainers")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public List<TrainerSummary> listTrainers(@RequestParam UUID branchId) {
        return trainerDirectoryService.listTrainersForBranch(branchId);
    }

    // Owner or Manager: basic info edit (name/phone/address/photo). Deliberately a
    // different path than /dates, which stays Owner-only.
    @PutMapping("/api/trainers/{id}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public TrainerSummary updateInfo(@PathVariable UUID id, @RequestBody UpdateProfileRequest req) {
        return trainerDirectoryService.updateTrainerInfo(id, req);
    }

    // Owner-only: joining date correction and marking/clearing a trainer as left - a
    // Manager must not be able to do either of these.
    @PutMapping("/api/trainers/{id}/dates")
    @PreAuthorize("hasRole('OWNER')")
    public TrainerSummary updateDates(@PathVariable UUID id, @RequestBody UpdateTrainerDatesRequest req) {
        return trainerDirectoryService.updateDates(id, req);
    }
}