package com.gymapp.service;

import com.gymapp.dto.StaffDtos.StaffSummary;
import com.gymapp.entity.BranchAssignment;
import com.gymapp.entity.Role;
import com.gymapp.entity.User;
import com.gymapp.repository.BranchAssignmentRepository;
import com.gymapp.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

// Powers the Manager dashboard's "Staff" tab. Combines Owner + Manager + Trainer for a
// given branch, since attendance/check-in now applies to all three, not just Trainers.
@Service
public class StaffDirectoryService {

    private final BranchAssignmentRepository branchAssignmentRepository;
    private final UserRepository userRepository;

    public StaffDirectoryService(BranchAssignmentRepository branchAssignmentRepository,
                                 UserRepository userRepository) {
        this.branchAssignmentRepository = branchAssignmentRepository;
        this.userRepository = userRepository;
    }

    // The Owner has no branch_assignments row of their own (implicit access to every
    // branch - see BranchService), so they're always included regardless of which
    // branch is selected. Managers and Trainers only show up here if actually assigned
    // to this specific branch.
    @Transactional(readOnly = true)
    public List<StaffSummary> listStaffForBranch(UUID branchId) {
        List<StaffSummary> result = new ArrayList<>();

        userRepository.findByRole(Role.OWNER).stream()
                .findFirst()
                .ifPresent(owner -> result.add(toSummary(owner)));

        branchAssignmentRepository.findByBranchId(branchId).stream()
                .map(BranchAssignment::getUser)
                .filter(u -> u.getRole() == Role.MANAGER || u.getRole() == Role.TRAINER)
                .map(this::toSummary)
                .forEach(result::add);

        return result;
    }

    private StaffSummary toSummary(User u) {
        return new StaffSummary(u.getId(), u.getName(), u.getEmail(), u.getPhone(), u.getAddress(), u.getPhoto(),
                u.getCheckinPin(), u.getRole().name(), u.getJoiningDate(), u.getLeftDate());
    }
}