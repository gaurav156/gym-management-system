package com.gymapp.service;

import com.gymapp.dto.ProfileDtos.UpdateProfileRequest;
import com.gymapp.dto.TrainerDtos.TrainerSummary;
import com.gymapp.dto.TrainerDtos.UpdateTrainerDatesRequest;
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

    // Owner-only (enforced at the controller/security config, not here) - a Manager can
    // never call this, and a trainer can never set either date on themselves. leftDate
    // may be null to clear a previously-set leave date.
    @Transactional
    public TrainerSummary updateDates(UUID trainerId, UpdateTrainerDatesRequest req) {
        User trainer = userRepository.findById(trainerId)
                .orElseThrow(() -> new IllegalArgumentException("Trainer not found"));
        if (trainer.getRole() != Role.TRAINER) {
            throw new IllegalArgumentException("This account is not a trainer");
        }
        if (req.joiningDate() != null) trainer.setJoiningDate(req.joiningDate());
        trainer.setLeftDate(req.leftDate());
        trainer = userRepository.save(trainer);
        return toSummary(trainer);
    }

    // Owner OR Manager (enforced at the controller) - name/phone/address/photo only.
    // Deliberately separate from updateDates(), which stays Owner-only - basic info and
    // employment dates have different edit permissions for a reason, don't merge them.
    @Transactional
    public TrainerSummary updateTrainerInfo(UUID trainerId, UpdateProfileRequest req) {
        User trainer = userRepository.findById(trainerId)
                .orElseThrow(() -> new IllegalArgumentException("Trainer not found"));
        if (trainer.getRole() != Role.TRAINER) {
            throw new IllegalArgumentException("This account is not a trainer");
        }

        if (req.name() != null && !req.name().isBlank()) trainer.setName(req.name());
        if (req.phone() != null) trainer.setPhone(req.phone());
        if (req.address() != null) trainer.setAddress(req.address().isBlank() ? null : req.address());
        if (req.photo() != null) trainer.setPhoto(req.photo().isBlank() ? null : req.photo());

        trainer = userRepository.save(trainer);
        return toSummary(trainer);
    }

    private TrainerSummary toSummary(User u) {
        return new TrainerSummary(u.getId(), u.getName(), u.getEmail(), u.getPhone(), u.getAddress(), u.getPhoto(),
                u.getCheckinPin(), u.getJoiningDate(), u.getLeftDate());
    }
}