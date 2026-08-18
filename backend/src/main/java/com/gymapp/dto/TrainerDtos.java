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
            String photo,
            String checkinPin,
            LocalDate joiningDate,
            LocalDate leftDate
    ) {}

    // Owner-only correction tool - joiningDate is otherwise set automatically at account
    // creation and never editable by anyone else; leftDate can only be set/cleared by the
    // Owner, never a Manager. leftDate may be null to clear a previously-set leave date.
    public record UpdateTrainerDatesRequest(
            LocalDate joiningDate,
            LocalDate leftDate
    ) {}
}