package com.gymapp.repository;

import com.gymapp.entity.ProductOrder;
import com.gymapp.entity.ProductOrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ProductOrderRepository extends JpaRepository<ProductOrder, UUID> {
    Page<ProductOrder> findByBranchIdOrderByCreatedAtDesc(UUID branchId, Pageable pageable);
    Page<ProductOrder> findByMemberIdOrderByCreatedAtDesc(UUID memberId, Pageable pageable);

    // "First-time buyer" coupon eligibility - a member with no non-cancelled order yet.
    boolean existsByMemberIdAndStatusNot(UUID memberId, ProductOrderStatus status);

    // Blocks deleting a staff account that recorded product sales - same audit-integrity
    // pattern as PaymentRepository.existsByRecordedById / ExpenseRepository.existsByRecordedById.
    boolean existsByRecordedById(UUID recordedById);
}