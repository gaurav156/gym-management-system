package com.gymapp.repository;

import com.gymapp.entity.Expense;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ExpenseRepository extends JpaRepository<Expense, UUID> {
    Page<Expense> findByBranchIdOrderByExpenseDateDescCreatedAtDesc(UUID branchId, Pageable pageable);

    // Used by UserManagementService to block deleting a staff account that has recorded
    // expenses - same audit-protection pattern as PaymentRepository.existsByRecordedById.
    boolean existsByRecordedById(UUID recordedById);

    // Expenses, bucketed by day or month - see FinanceReportService. Grouped on
    // expense_date (when the cost was actually incurred), not created_at (when it was
    // logged), so a bill entered late still lands in the month it belongs to.
    @Query(value = "SELECT date_trunc(:unit, e.expense_date::timestamp) AS bucket, SUM(e.amount) AS total " +
            "FROM expenses e " +
            "WHERE e.expense_date >= :from AND e.expense_date < :to " +
            "AND (CAST(:branchId AS uuid) IS NULL OR e.branch_id = :branchId) " +
            "GROUP BY bucket ORDER BY bucket",
            nativeQuery = true)
    List<Object[]> sumExpensesByBucket(@Param("unit") String unit,
                                       @Param("from") java.time.LocalDate from,
                                       @Param("to") java.time.LocalDate to,
                                       @Param("branchId") UUID branchId);

    // Used by OrphanImageCleanupJob - bill uploads must count as "referenced".
    @Query("SELECT e.billKey FROM Expense e WHERE e.billKey IS NOT NULL")
    List<String> findAllBillKeys();
}