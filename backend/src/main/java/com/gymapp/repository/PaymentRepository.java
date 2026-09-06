package com.gymapp.repository;

import com.gymapp.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {
    List<Payment> findByBranchIdOrderByCreatedAtDesc(UUID branchId);
    List<Payment> findByMemberIdOrderByCreatedAtDesc(UUID memberId);

    // Used to block deleting a staff account that has recorded payments for OTHER
    // members - removing them would break the audit trail on those payments/invoices.
    boolean existsByRecordedById(UUID recordedById);
}