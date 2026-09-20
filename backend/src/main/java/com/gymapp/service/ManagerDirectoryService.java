package com.gymapp.service;

import com.gymapp.dto.ProfileDtos.UpdateProfileRequest;
import com.gymapp.dto.TrainerDtos.TrainerSummary;
import com.gymapp.dto.TrainerDtos.UpdateTrainerDatesRequest;
import com.gymapp.entity.Role;
import com.gymapp.entity.User;
import com.gymapp.repository.UserRepository;
import com.gymapp.storage.ImagePurpose;
import com.gymapp.storage.ImageRefs;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

// Owner-only basic info edit for a Manager account (name/phone/address/photo) - same
// field set as TrainerDirectoryService.updateTrainerInfo, but restricted to OWNER only
// (not OWNER+MANAGER) since a Manager editing another Manager's account isn't a use
// case here, only the Owner manages staff accounts this way.
@Service
public class ManagerDirectoryService {

    private final UserRepository userRepository;
    private final ImageRefs imageRefs;

    public ManagerDirectoryService(UserRepository userRepository, ImageRefs imageRefs) {
        this.userRepository = userRepository;
        this.imageRefs = imageRefs;
    }

    // Reuses TrainerSummary's shape (name/email/phone/address/photo/checkinPin +
    // joiningDate/leftDate, which are simply null for a Manager) rather than adding a
    // near-identical ManagerSummary record - StaffTab already renders from this shape.
    @Transactional
    public TrainerSummary updateManagerInfo(UUID managerId, UpdateProfileRequest req) {
        User manager = userRepository.findById(managerId)
                .orElseThrow(() -> new IllegalArgumentException("Manager not found"));
        if (manager.getRole() != Role.MANAGER) {
            throw new IllegalArgumentException("This account is not a manager");
        }

        if (req.name() != null && !req.name().isBlank()) manager.setName(req.name());
        if (req.phone() != null) manager.setPhone(req.phone());
        if (req.address() != null) manager.setAddress(req.address().isBlank() ? null : req.address());
        manager.setPhoto(imageRefs.resolveForSave(manager.getPhoto(), req.photo(), ImagePurpose.PHOTO));

        manager = userRepository.save(manager);
        return toSummary(manager);
    }

    private TrainerSummary toSummary(User u) {
        return new TrainerSummary(u.getId(), u.getName(), u.getEmail(), u.getPhone(), u.getAddress(), imageRefs.toUrl(u.getPhoto()),
                u.getCheckinPin(), u.getJoiningDate(), u.getLeftDate());
    }

    // Owner-only, mirrors TrainerDirectoryService.updateDates() - lets the Owner correct
    // a Manager's joining date or mark/clear a left date, same as for Trainers.
    @Transactional
    public TrainerSummary updateManagerDates(UUID managerId, UpdateTrainerDatesRequest req) {
        User manager = userRepository.findById(managerId)
                .orElseThrow(() -> new IllegalArgumentException("Manager not found"));
        if (manager.getRole() != Role.MANAGER) {
            throw new IllegalArgumentException("This account is not a manager");
        }
        if (req.joiningDate() != null) manager.setJoiningDate(req.joiningDate());
        manager.setLeftDate(req.leftDate());
        manager = userRepository.save(manager);
        return toSummary(manager);
    }
}