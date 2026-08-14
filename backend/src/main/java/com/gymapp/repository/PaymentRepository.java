package com.gymapp.repository;

import com.gymapp.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {
    List<Payment> findByBranchIdOrderByCreatedAtDesc(UUID branchId);
    List<Payment> findByMemberIdOrderByCreatedAtDesc(UUID memberId);
}