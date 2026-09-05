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

import java.util.HashSet;
import java.util.List;
import java.util.Set;
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
        Branch branch = Branch.builder().name(req.name()).address(req.address()).phone(req.phone()).build();
        branch = branchRepository.save(branch);
        return toResponse(branch);
    }

    // Owner-only (enforced at the controller). Blank strings clear the field to null,
    // consistent with how ProfileService treats blank address/photo submissions.
    @Transactional
    public BranchResponse update(UUID branchId, UpdateBranchRequest req) {
        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new IllegalArgumentException("Branch not found"));

        if (req.name() != null && !req.name().isBlank()) branch.setName(req.name());
        if (req.address() != null) branch.setAddress(req.address().isBlank() ? null : req.address());
        if (req.phone() != null) branch.setPhone(req.phone().isBlank() ? null : req.phone());

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
    //
    // Deliberately diffs against the existing rows rather than delete-all-then-reinsert:
    // Hibernate flushes inserts before deletes by default, so re-inserting a branch that's
    // already assigned (e.g. keeping an existing checkbox checked) would violate the
    // (user_id, branch_id) unique constraint before the stale delete actually lands.
    @Transactional
    public List<BranchResponse> updateAssignments(UUID userId, UpdateAssignmentsRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<Branch> branches = branchRepository.findAllById(req.branchIds());
        if (branches.size() != req.branchIds().size()) {
            throw new IllegalArgumentException("One or more branches not found");
        }

        List<BranchAssignment> existing = branchAssignmentRepository.findByUserId(userId);
        Set<UUID> existingBranchIds = new HashSet<>();
        for (BranchAssignment a : existing) {
            existingBranchIds.add(a.getBranch().getId());
        }
        Set<UUID> desiredBranchIds = new HashSet<>(req.branchIds());

        for (BranchAssignment a : existing) {
            if (!desiredBranchIds.contains(a.getBranch().getId())) {
                branchAssignmentRepository.delete(a);
            }
        }

        for (Branch branch : branches) {
            if (!existingBranchIds.contains(branch.getId())) {
                branchAssignmentRepository.save(BranchAssignment.builder()
                        .user(user)
                        .branch(branch)
                        .build());
            }
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
        return new BranchResponse(b.getId(), b.getName(), b.getAddress(), b.getPhone());
    }
}