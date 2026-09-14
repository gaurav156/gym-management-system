package com.gymapp.service;

import com.gymapp.dto.MemberDtos.MemberSummary;
import com.gymapp.dto.PageDtos.PageResponse;
import com.gymapp.dto.ProfileDtos.UpdateProfileRequest;
import com.gymapp.entity.Role;
import com.gymapp.entity.User;
import com.gymapp.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

// Powers the manager's "who am I recording this purchase/check-in for" lookups, and
// staff-facing edits to a member's basic info.
@Service
public class MemberDirectoryService {

    private final UserRepository userRepository;

    public MemberDirectoryService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public PageResponse<MemberSummary> listMembersForBranch(UUID branchId, String search, String status,
                                                            String sort, Pageable pageable) {
        String term = blankToNull(search);
        String statusParam = (status == null || status.isBlank()) ? "ALL" : status.toUpperCase();
        String sortParam = (sort == null || sort.isBlank()) ? "NAME" : sort.toUpperCase();
        Page<User> page = userRepository.findMembersForBranch(branchId, term, statusParam, sortParam, pageable);
        return PageResponse.from(page.map(this::toSummary));
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
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