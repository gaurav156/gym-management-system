package com.gymapp.controller;

import com.gymapp.dto.ExpenseDtos.*;
import com.gymapp.dto.PageDtos.PageResponse;
import com.gymapp.service.ExpenseService;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/expenses")
public class ExpenseController {

    private final ExpenseService expenseService;

    public ExpenseController(ExpenseService expenseService) {
        this.expenseService = expenseService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public ExpenseResponse create(@Valid @RequestBody CreateExpenseRequest req, Authentication authentication) {
        UUID recordedBy = UUID.fromString((String) authentication.getDetails());
        return expenseService.create(req, recordedBy);
    }

    @GetMapping("/branch/{branchId}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public PageResponse<ExpenseResponse> listForBranch(@PathVariable UUID branchId, Authentication authentication,
                                                       @RequestParam(defaultValue = "0") int page,
                                                       @RequestParam(defaultValue = "20") int size) {
        UUID callerId = UUID.fromString((String) authentication.getDetails());
        return expenseService.listForBranch(branchId, callerId, PageRequest.of(page, size));
    }

    // Owner-only - a Manager can record and view expenses but not delete them, matching
    // the pattern of other destructive/audit-sensitive actions in this app.
    @DeleteMapping("/{expenseId}")
    @PreAuthorize("hasRole('OWNER')")
    public void delete(@PathVariable UUID expenseId, Authentication authentication) {
        UUID callerId = UUID.fromString((String) authentication.getDetails());
        expenseService.delete(expenseId, callerId);
    }
}