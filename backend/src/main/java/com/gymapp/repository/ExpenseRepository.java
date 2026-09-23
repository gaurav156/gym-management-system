package com.gymapp.repository;

import com.gymapp.entity.Expense;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ExpenseRepository extends JpaRepository<Expense, UUID> {
    Page<Expense> findByBranchIdOrderByExpenseDateDescCreatedAtDesc(UUID branchId, Pageable pageable);

    // Used by UserManagementService to block deleting a staff account that has recorded
    // expenses - same audit-protection pattern as PaymentRepository.existsByRecordedById.
    boolean existsByRecordedById(UUID recordedById);
}