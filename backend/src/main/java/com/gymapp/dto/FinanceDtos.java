package com.gymapp.dto;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class FinanceDtos {

    // DAILY/MONTHLY/QUARTERLY/YEARLY pick a period via date/year+month/year+quarter/year;
    // CUSTOM takes an explicit fromDate/toDate range. Kept as one enum (rather than
    // separate endpoints) so the frontend's single filter control drives everything.
    public enum ReportGranularity {
        DAILY, MONTHLY, QUARTERLY, YEARLY, CUSTOM
    }

    // All period fields are optional and default to "today" (or the current month/
    // quarter/year) when omitted - only the fields relevant to the chosen granularity
    // are actually read; the others are ignored. branchId is optional - null means
    // "every branch combined", which the Owner (and only the Owner) may request.
    public record FinanceReportQuery(
            @NotNull ReportGranularity granularity,
            UUID branchId,
            LocalDate date,
            Integer year,
            Integer month,
            Integer quarter,
            LocalDate fromDate,
            LocalDate toDate
    ) {}

    // One row per bucket (a day or a month, depending on how coarse the requested range
    // is - see FinanceReportService.resolveBucketUnit). label is pre-formatted for
    // display (e.g. "2026-09-14" or "Sep 2026") so the frontend never has to reparse it.
    public record FinanceReportRow(
            String label,
            BigDecimal membershipIncome,
            BigDecimal productIncome,
            BigDecimal totalIncome,
            BigDecimal totalExpense,
            BigDecimal profit
    ) {}

    public record FinanceReportResponse(
            LocalDate fromDate,
            LocalDate toDate,
            String granularity,
            String branchName,   // null when branchId was null ("All branches")
            BigDecimal totalMembershipIncome,
            BigDecimal totalProductIncome,
            BigDecimal totalIncome,
            BigDecimal totalExpense,
            BigDecimal totalProfit,
            List<FinanceReportRow> breakdown
    ) {}
}