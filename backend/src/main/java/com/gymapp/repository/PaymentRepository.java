package com.gymapp.repository;

import com.gymapp.entity.Payment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {
    Page<Payment> findByBranchIdOrderByCreatedAtDesc(UUID branchId, Pageable pageable);
    Page<Payment> findByMemberIdOrderByCreatedAtDesc(UUID memberId, Pageable pageable);

    // Used to block deleting a staff account that has recorded payments for OTHER
    // members - removing them would break the audit trail on those payments/invoices.
    boolean existsByRecordedById(UUID recordedById);
}