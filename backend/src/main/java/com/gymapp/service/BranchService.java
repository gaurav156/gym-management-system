package com.gymapp.service;

import com.gymapp.dto.BranchDtos.*;
import com.gymapp.entity.Branch;
import com.gymapp.entity.BranchAssignment;
import com.gymapp.repository.BranchAssignmentRepository;
import com.gymapp.repository.BranchRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class BranchService {

    private final BranchRepository branchRepository;
    private final BranchAssignmentRepository branchAssignmentRepository;

    public BranchService(BranchRepository branchRepository, BranchAssignmentRepository branchAssignmentRepository) {
        this.branchRepository = branchRepository;
        this.branchAssignmentRepository = branchAssignmentRepository;
    }

    public BranchResponse create(CreateBranchRequest req) {
        Branch branch = Branch.builder().name(req.name()).address(req.address()).build();
        branch = branchRepository.save(branch);
        return toResponse(branch);
    }

    public List<BranchResponse> listAll() {
        return branchRepository.findAll().stream().map(this::toResponse).toList();
    }

    // Used to scope a MANAGER's dashboard to only the branches they're assigned to
    @Transactional(readOnly = true)
    public List<BranchResponse> listForUser(UUID userId) {
        return branchAssignmentRepository.findByUserId(userId).stream()
                .map(BranchAssignment::getBranch)
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public void transferUser(TransferRequest req) {
        branchAssignmentRepository.deleteByUserIdAndBranchId(req.userId(), req.fromBranchId());

        var user = branchAssignmentRepository.findByUserId(req.userId()).stream()
                .findFirst()
                .map(BranchAssignment::getUser)
                .orElseThrow(() -> new IllegalArgumentException("User has no existing branch assignment"));

        Branch toBranch = branchRepository.findById(req.toBranchId())
                .orElseThrow(() -> new IllegalArgumentException("Target branch not found"));

        branchAssignmentRepository.save(BranchAssignment.builder()
                .user(user)
                .branch(toBranch)
                .build());
    }

    private BranchResponse toResponse(Branch b) {
        return new BranchResponse(b.getId(), b.getName(), b.getAddress());
    }
}
