package com.gymapp.service;

import com.gymapp.dto.TrainerDtos.TrainerSummary;
import com.gymapp.entity.BranchAssignment;
import com.gymapp.entity.Role;
import com.gymapp.repository.BranchAssignmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class TrainerDirectoryService {

    private final BranchAssignmentRepository branchAssignmentRepository;

    public TrainerDirectoryService(BranchAssignmentRepository branchAssignmentRepository) {
        this.branchAssignmentRepository = branchAssignmentRepository;
    }

    @Transactional(readOnly = true)
    public List<TrainerSummary> listTrainersForBranch(UUID branchId) {
        return branchAssignmentRepository.findByBranchId(branchId).stream()
                .map(BranchAssignment::getUser)
                .filter(u -> u.getRole() == Role.TRAINER)
                .map(u -> new TrainerSummary(u.getId(), u.getName(), u.getEmail(), u.getPhone(), u.getCheckinPin()))
                .toList();
    }
}