package com.gymapp.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

public class PaymentDtos {

    public record PaymentResponse(
            UUID id,
            String invoiceNumber,
            String memberName,
            String recordedByName,
            String planName,
            BigDecimal amount,
            String type,
            String mode,
            LocalDateTime createdAt
    ) {}

    // Full detail needed to render the invoice document - fetched on-demand via
    // GET /api/payments/{id}/invoice rather than embedded in every list row, since
    // branch/member address fields aren't needed until someone actually opens an invoice.
    public record InvoiceResponse(
            UUID paymentId,
            String invoiceNumber,
            LocalDateTime invoiceDate,
            String branchName,
            String branchAddress,
            String branchPhone,
            String memberName,
            String memberEmail,
            String memberPhone,
            String memberAddress,
            String planName,
            LocalDate membershipStartDate,
            LocalDate membershipEndDate,
            BigDecimal amount,
            String mode,
            String recordedByName,
            String recordedBySignature
    ) {}
}