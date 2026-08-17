package com.gymapp.dto;

import java.time.LocalDate;
import java.util.UUID;

public class TrainerDtos {

    // Staff-facing view - includes leftDate, which a trainer never sees about themselves.
    public record TrainerSummary(
            UUID id,
            String name,
            String email,
            String phone,
            String address,
            String checkinPin,
            LocalDate joiningDate,
            LocalDate leftDate
    ) {}

    // leftDate may be null to clear a previously-set leave date (e.g. the trainer rejoined).
    public record SetLeftDateRequest(
            LocalDate leftDate
    ) {}
}