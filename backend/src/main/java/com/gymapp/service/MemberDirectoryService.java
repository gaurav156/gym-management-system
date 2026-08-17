package com.gymapp.service;

import com.gymapp.dto.MemberDtos.MemberSummary;
import com.gymapp.entity.BranchAssignment;
import com.gymapp.entity.Role;
import com.gymapp.repository.BranchAssignmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

// Powers the manager's "who am I recording this purchase/check-in for" lookups.
@Service
public class MemberDirectoryService {

    private final BranchAssignmentRepository branchAssignmentRepository;

    public MemberDirectoryService(BranchAssignmentRepository branchAssignmentRepository) {
        this.branchAssignmentRepository = branchAssignmentRepository;
    }

    @Transactional(readOnly = true)
    public List<MemberSummary> listMembersForBranch(UUID branchId) {
        return branchAssignmentRepository.findByBranchId(branchId).stream()
                .map(BranchAssignment::getUser)
                .filter(u -> u.getRole() == Role.MEMBER)
                .map(u -> new MemberSummary(u.getId(), u.getName(), u.getEmail(), u.getPhone(), u.getPhoto(),
                        u.getAddress(), u.getCheckinPin(), u.getEnrollmentDate()))
                .toList();
    }
}