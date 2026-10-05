package com.gymapp.controller;

import com.gymapp.dto.FinanceDtos.*;
import com.gymapp.dto.PageDtos.PageResponse;
import com.gymapp.service.FinanceExcelExportService;
import com.gymapp.service.FinanceReportService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.springframework.format.annotation.DateTimeFormat.ISO.DATE;

// Owner-only Income & Profit reporting for the dashboard - see FinanceReportService for
// how the figures are computed. Not exposed to Manager: unlike per-branch Payments/
// Expenses, this report can span every branch at once (branchId omitted), which is
// chain-wide financial visibility reserved for the Owner.
@RestController
@RequestMapping("/api/finance")
public class FinanceController {

    private final FinanceReportService financeReportService;
    private final FinanceExcelExportService financeExcelExportService;

    public FinanceController(FinanceReportService financeReportService,
                             FinanceExcelExportService financeExcelExportService) {
        this.financeReportService = financeReportService;
        this.financeExcelExportService = financeExcelExportService;
    }

    @GetMapping("/report")
    @PreAuthorize("hasRole('OWNER')")
    public FinanceReportResponse report(
            @RequestParam ReportGranularity granularity,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DATE) LocalDate date,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer quarter,
            @RequestParam(required = false) @DateTimeFormat(iso = DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DATE) LocalDate toDate) {
        return financeReportService.generateReport(
                new FinanceReportQuery(granularity, branchId, date, year, month, quarter, fromDate, toDate));
    }

    @GetMapping("/report/export")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<byte[]> exportReport(
            @RequestParam ReportGranularity granularity,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DATE) LocalDate date,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer quarter,
            @RequestParam(required = false) @DateTimeFormat(iso = DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DATE) LocalDate toDate,
            @RequestParam(defaultValue = "false") boolean details,
            @RequestParam(defaultValue = "ASC") String sort) {
        FinanceReportQuery query = new FinanceReportQuery(granularity, branchId, date, year, month, quarter, fromDate, toDate);
        FinanceReportResponse report = financeReportService.generateReport(query);
        List<FinanceTransactionRow> transactions = details
                ? financeReportService.listAllTransactions(query, !"DESC".equalsIgnoreCase(sort))
                : null;
        byte[] excel = financeExcelExportService.export(report, transactions);

        String filename = "income-profit-" + report.fromDate() + "-to-" + report.toDate()
                + (details ? "-details" : "") + ".xlsx";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(excel);
    }

    @GetMapping("/transactions")
    @PreAuthorize("hasRole('OWNER')")
    public PageResponse<FinanceTransactionRow> transactions(
            @RequestParam ReportGranularity granularity,
            @RequestParam(required = false) UUID branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DATE) LocalDate date,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer quarter,
            @RequestParam(required = false) @DateTimeFormat(iso = DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DATE) LocalDate toDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(defaultValue = "ASC") String sort) {
        return financeReportService.listTransactions(
                new FinanceReportQuery(granularity, branchId, date, year, month, quarter, fromDate, toDate),
                page, size, !"DESC".equalsIgnoreCase(sort));
    }
}