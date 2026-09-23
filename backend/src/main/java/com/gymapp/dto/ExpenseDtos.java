package com.gymapp.dto;

import com.gymapp.entity.ExpenseCategory;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public class ExpenseDtos {

    // billUrl is optional - the URL returned by POST /api/files/images?purpose=BILL,
    // uploaded separately BEFORE this request (same two-step pattern PhotoUploadButton
    // already uses for photos/signatures).
    public record CreateExpenseRequest(
            @NotNull UUID branchId,
            @NotNull ExpenseCategory category,
            @NotNull @Positive BigDecimal amount,
            @NotNull LocalDate expenseDate,
            String remark,
            String billUrl
    ) {}

    public record ExpenseResponse(
            UUID id,
            UUID branchId,
            String branchName,
            String category,
            BigDecimal amount,
            LocalDate expenseDate,
            String remark,
            String billUrl,
            String recordedByName,
            LocalDateTime createdAt
    ) {}
}