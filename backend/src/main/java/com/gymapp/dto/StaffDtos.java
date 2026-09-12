package com.gymapp.dto;

import java.time.LocalDate;
import java.util.UUID;

public class StaffDtos {

    // Unified shape for Owner + Manager + Trainer - used by the Manager dashboard's
    // "Staff" tab now that all three roles can check in/out and need to be visible
    // together, not just Trainers. joiningDate/leftDate are only meaningful for
    // TRAINER rows (see AuthService/TrainerDirectoryService) - null for OWNER/MANAGER.
    public record StaffSummary(
            UUID id,
            String name,
            String email,
            String phone,
            String address,
            String photo,
            String checkinPin,
            String role,
            LocalDate joiningDate,
            LocalDate leftDate
    ) {}
}