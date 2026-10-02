package com.gymapp.repository;

import com.gymapp.entity.Payment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {
    Page<Payment> findByBranchIdOrderByCreatedAtDesc(UUID branchId, Pageable pageable);
    Page<Payment> findByMemberIdOrderByCreatedAtDesc(UUID memberId, Pageable pageable);

    // Used to block deleting a staff account that has recorded payments for OTHER
    // members - removing them would break the audit trail on those payments/invoices.
    boolean existsByRecordedById(UUID recordedById);

    // Membership income, bucketed by day or month (see FinanceReportService). branchId
    // null means every branch combined - only the Owner is ever allowed to request that.
    @Query(value = "SELECT date_trunc(:unit, p.created_at) AS bucket, SUM(p.amount) AS total " +
            "FROM payments p " +
            "WHERE p.created_at >= :from AND p.created_at < :to " +
            "AND (CAST(:branchId AS uuid) IS NULL OR p.branch_id = :branchId) " +
            "GROUP BY bucket ORDER BY bucket",
            nativeQuery = true)
    List<Object[]> sumMembershipIncomeByBucket(@Param("unit") String unit,
                                               @Param("from") java.time.LocalDateTime from,
                                               @Param("to") java.time.LocalDateTime to,
                                               @Param("branchId") UUID branchId);

    boolean existsByBranchId(UUID branchId);
}