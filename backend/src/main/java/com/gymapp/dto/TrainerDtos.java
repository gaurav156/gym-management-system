package com.gymapp.dto;

import java.util.UUID;

public class TrainerDtos {

    public record TrainerSummary(
            UUID id,
            String name,
            String email,
            String phone,
            String checkinPin
    ) {}
}