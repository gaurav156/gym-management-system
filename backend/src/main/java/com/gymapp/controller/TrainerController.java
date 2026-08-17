package com.gymapp.controller;

import com.gymapp.dto.TrainerDtos.SetLeftDateRequest;
import com.gymapp.dto.TrainerDtos.TrainerSummary;
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

    // leftDate may be null in the body to clear a previously-set leave date.
    @PutMapping("/api/trainers/{id}/left-date")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public TrainerSummary setLeftDate(@PathVariable UUID id, @RequestBody SetLeftDateRequest req) {
        return trainerDirectoryService.setLeftDate(id, req);
    }
}