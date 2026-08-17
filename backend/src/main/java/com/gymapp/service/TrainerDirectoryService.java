package com.gymapp.service;

import com.gymapp.dto.TrainerDtos.SetLeftDateRequest;
import com.gymapp.dto.TrainerDtos.TrainerSummary;
import com.gymapp.entity.BranchAssignment;
import com.gymapp.entity.Role;
import com.gymapp.entity.User;
import com.gymapp.repository.BranchAssignmentRepository;
import com.gymapp.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class TrainerDirectoryService {

    private final BranchAssignmentRepository branchAssignmentRepository;
    private final UserRepository userRepository;

    public TrainerDirectoryService(BranchAssignmentRepository branchAssignmentRepository,
                                   UserRepository userRepository) {
        this.branchAssignmentRepository = branchAssignmentRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<TrainerSummary> listTrainersForBranch(UUID branchId) {
        return branchAssignmentRepository.findByBranchId(branchId).stream()
                .map(BranchAssignment::getUser)
                .filter(u -> u.getRole() == Role.TRAINER)
                .map(this::toSummary)
                .toList();
    }

    // Owner/Manager only (enforced at the controller) - a trainer can never set this on
    // themselves, and it's excluded entirely from their own profile response.
    @Transactional
    public TrainerSummary setLeftDate(UUID trainerId, SetLeftDateRequest req) {
        User trainer = userRepository.findById(trainerId)
                .orElseThrow(() -> new IllegalArgumentException("Trainer not found"));
        if (trainer.getRole() != Role.TRAINER) {
            throw new IllegalArgumentException("This account is not a trainer");
        }
        trainer.setLeftDate(req.leftDate());
        trainer = userRepository.save(trainer);
        return toSummary(trainer);
    }

    private TrainerSummary toSummary(User u) {
        return new TrainerSummary(u.getId(), u.getName(), u.getEmail(), u.getPhone(), u.getAddress(),
                u.getCheckinPin(), u.getJoiningDate(), u.getLeftDate());
    }
}