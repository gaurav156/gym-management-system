package com.gymapp.service;

import com.gymapp.dto.BranchDtos.*;
import com.gymapp.entity.Branch;
import com.gymapp.entity.BranchAssignment;
import com.gymapp.entity.Role;
import com.gymapp.entity.User;
import com.gymapp.repository.BranchAssignmentRepository;
import com.gymapp.repository.BranchRepository;
import com.gymapp.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class BranchService {

    private final BranchRepository branchRepository;
    private final BranchAssignmentRepository branchAssignmentRepository;
    private final UserRepository userRepository;

    public BranchService(BranchRepository branchRepository,
                         BranchAssignmentRepository branchAssignmentRepository,
                         UserRepository userRepository) {
        this.branchRepository = branchRepository;
        this.branchAssignmentRepository = branchAssignmentRepository;
        this.userRepository = userRepository;
    }

    public BranchResponse create(CreateBranchRequest req) {
        Branch branch = Branch.builder().name(req.name()).address(req.address()).build();
        branch = branchRepository.save(branch);
        return toResponse(branch);
    }

    public List<BranchResponse> listAll() {
        return branchRepository.findAll().stream().map(this::toResponse).toList();
    }

    // Used to scope a MANAGER's dashboard to only the branches they're assigned to.
    // @Transactional keeps the Hibernate session open long enough to resolve the
    // lazy branch_assignments -> branch relationship (open-in-view is disabled).
    @Transactional(readOnly = true)
    public List<BranchResponse> listForUser(UUID userId) {
        return branchAssignmentRepository.findByUserId(userId).stream()
                .map(BranchAssignment::getBranch)
                .map(this::toResponse)
                .toList();
    }

    // Owner-only (enforced at the controller). Replaces ALL of this person's branch
    // assignments with exactly the given list - works for Members, Trainers, and
    // Managers alike, since they all use the same branch_assignments table. Because
    // membership plans are chain-wide now, a member keeps valid access at every branch
    // they're assigned to without anything else needing to change.
    @Transactional
    public List<BranchResponse> updateAssignments(UUID userId, UpdateAssignmentsRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<Branch> branches = branchRepository.findAllById(req.branchIds());
        if (branches.size() != req.branchIds().size()) {
            throw new IllegalArgumentException("One or more branches not found");
        }

        branchAssignmentRepository.deleteByUserId(userId);
        for (Branch branch : branches) {
            branchAssignmentRepository.save(BranchAssignment.builder()
                    .user(user)
                    .branch(branch)
                    .build());
        }

        return branches.stream().map(this::toResponse).toList();
    }

    // Owner-only - lets them pick anyone by role without needing to already know which
    // branch(es) that person is on, for the branch-assignment management screen.
    @Transactional(readOnly = true)
    public List<PersonSummary> listPeopleByRole(Role role) {
        return userRepository.findByRole(role).stream()
                .map(u -> new PersonSummary(u.getId(), u.getName(), u.getEmail(), u.getRole().name()))
                .toList();
    }

    private BranchResponse toResponse(Branch b) {
        return new BranchResponse(b.getId(), b.getName(), b.getAddress());
    }
}