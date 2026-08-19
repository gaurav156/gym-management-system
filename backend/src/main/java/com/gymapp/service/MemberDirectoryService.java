package com.gymapp.service;

import com.gymapp.dto.MemberDtos.MemberSummary;
import com.gymapp.dto.ProfileDtos.UpdateProfileRequest;
import com.gymapp.entity.BranchAssignment;
import com.gymapp.entity.Role;
import com.gymapp.entity.User;
import com.gymapp.repository.BranchAssignmentRepository;
import com.gymapp.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

// Powers the manager's "who am I recording this purchase/check-in for" lookups, and
// staff-facing edits to a member's basic info.
@Service
public class MemberDirectoryService {

    private final BranchAssignmentRepository branchAssignmentRepository;
    private final UserRepository userRepository;

    public MemberDirectoryService(BranchAssignmentRepository branchAssignmentRepository,
                                  UserRepository userRepository) {
        this.branchAssignmentRepository = branchAssignmentRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<MemberSummary> listMembersForBranch(UUID branchId) {
        return branchAssignmentRepository.findByBranchId(branchId).stream()
                .map(BranchAssignment::getUser)
                .filter(u -> u.getRole() == Role.MEMBER)
                .map(this::toSummary)
                .toList();
    }

    // Owner/Manager only (enforced at the controller) - name/phone/address/photo, same
    // fields a member could edit about themselves. Email is deliberately never editable
    // here, and enrollmentDate is untouched regardless of what's sent, since
    // UpdateProfileRequest has no field for it.
    @Transactional
    public MemberSummary updateMember(UUID memberId, UpdateProfileRequest req) {
        User u = userRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("Member not found"));
        if (u.getRole() != Role.MEMBER) {
            throw new IllegalArgumentException("This account is not a member");
        }

        if (req.name() != null && !req.name().isBlank()) u.setName(req.name());
        if (req.phone() != null) u.setPhone(req.phone());
        if (req.address() != null) u.setAddress(req.address().isBlank() ? null : req.address());
        if (req.photo() != null) u.setPhoto(req.photo().isBlank() ? null : req.photo());

        u = userRepository.save(u);
        return toSummary(u);
    }

    private MemberSummary toSummary(User u) {
        return new MemberSummary(u.getId(), u.getName(), u.getEmail(), u.getPhone(), u.getPhoto(),
                u.getAddress(), u.getCheckinPin(), u.getEnrollmentDate());
    }
}