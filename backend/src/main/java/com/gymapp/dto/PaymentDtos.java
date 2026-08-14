package com.gymapp.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

public class PaymentDtos {

    public record PaymentResponse(
            UUID id,
            String memberName,
            String recordedByName,
            String planName,
            BigDecimal amount,
            String type,
            String mode,
            LocalDateTime createdAt
    ) {}
}