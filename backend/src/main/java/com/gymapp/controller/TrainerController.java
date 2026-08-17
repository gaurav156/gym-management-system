package com.gymapp.controller;

import com.gymapp.dto.TrainerDtos.TrainerSummary;
import com.gymapp.service.TrainerDirectoryService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

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
}