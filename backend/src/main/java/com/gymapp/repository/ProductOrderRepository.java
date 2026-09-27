package com.gymapp.repository;

import com.gymapp.entity.ProductOrder;
import com.gymapp.entity.ProductOrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ProductOrderRepository extends JpaRepository<ProductOrder, UUID> {
    Page<ProductOrder> findByBranchIdOrderByCreatedAtDesc(UUID branchId, Pageable pageable);
    Page<ProductOrder> findByMemberIdOrderByCreatedAtDesc(UUID memberId, Pageable pageable);

    // "First-time buyer" coupon eligibility - a member with no non-cancelled order yet.
    boolean existsByMemberIdAndStatusNot(UUID memberId, ProductOrderStatus status);

    // Blocks deleting a staff account that recorded product sales - same audit-integrity
    // pattern as PaymentRepository.existsByRecordedById / ExpenseRepository.existsByRecordedById.
    boolean existsByRecordedById(UUID recordedById);

    // Product-sale income, bucketed the same way as PaymentRepository's method above.
    // Cancelled orders are excluded - a refunded sale isn't income.
    @Query(value =
            "SELECT date_trunc(:unit, o.created_at) AS bucket, SUM(o.total_amount) AS total " +
                    "FROM product_orders o " +
                    "WHERE o.created_at >= :from AND o.created_at < :to " +
                    "AND o.status <> 'CANCELLED' " +
                    "AND (CAST(:branchId AS uuid) IS NULL OR o.branch_id = :branchId) " +
                    "GROUP BY bucket ORDER BY bucket",
            nativeQuery = true)
    List<Object[]> sumProductIncomeByBucket(@Param("unit") String unit,
                                            @Param("from") java.time.LocalDateTime from,
                                            @Param("to") java.time.LocalDateTime to,
                                            @Param("branchId") UUID branchId);
}