package com.gymapp.repository;

import com.gymapp.entity.BranchAssignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BranchAssignmentRepository extends JpaRepository<BranchAssignment, UUID> {
    List<BranchAssignment> findByUserId(UUID userId);
    List<BranchAssignment> findByBranchId(UUID branchId);
    Optional<BranchAssignment> findByUserIdAndBranchId(UUID userId, UUID branchId);
    void deleteByUserIdAndBranchId(UUID userId, UUID branchId);
}