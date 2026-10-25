package com.gymapp.service;

import com.gymapp.dto.MemberDtos.MemberSummary;
import com.gymapp.dto.PageDtos.PageResponse;
import com.gymapp.dto.ProfileDtos.UpdateProfileRequest;
import com.gymapp.entity.Membership;
import com.gymapp.entity.MembershipStatus;
import com.gymapp.entity.Role;
import com.gymapp.entity.User;
import com.gymapp.repository.MembershipRepository;
import com.gymapp.repository.UserRepository;
import com.gymapp.storage.ImageRefs;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

// Powers the manager's "who am I recording this purchase/check-in for" lookups, and
// staff-facing edits to a member's basic info.
@Service
public class MemberDirectoryService {

    private final UserRepository userRepository;
    private final ImageRefs imageRefs;
    private final ProfileDetailsUpdater profileDetailsUpdater;
    private final MembershipRepository membershipRepository;

    public MemberDirectoryService(UserRepository userRepository, ImageRefs imageRefs, ProfileDetailsUpdater profileDetailsUpdater, MembershipRepository membershipRepository) {
        this.userRepository = userRepository;
        this.imageRefs = imageRefs;
        this.profileDetailsUpdater = profileDetailsUpdater;
        this.membershipRepository = membershipRepository;
    }

    @Transactional(readOnly = true)
    public PageResponse<MemberSummary> listMembersForBranch(UUID branchId, String search, String status,
                                                            String sort, Pageable pageable) {
        String term = blankToNull(search);
        String statusParam = (status == null || status.isBlank()) ? "ALL" : status.toUpperCase();
        String sortParam = (sort == null || sort.isBlank()) ? "NAME" : sort.toUpperCase();
        Page<User> page = userRepository.findMembersForBranch(branchId, term, statusParam, sortParam, pageable);

        Map<UUID, List<Membership>> byMember = membershipRepository
                .findByMemberIdIn(page.getContent().stream().map(User::getId).toList())
                .stream().collect(Collectors.groupingBy(m -> m.getMember().getId()));
        LocalDate today = LocalDate.now();
        return PageResponse.from(page.map(u -> toSummary(u, statusOf(byMember.getOrDefault(u.getId(), List.of()), today))));
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

        profileDetailsUpdater.applyDetails(u, req);
        profileDetailsUpdater.applyIdProof(u, req, false);

        u = userRepository.save(u);
        return toSummary(u, statusOf(membershipRepository.findByMemberId(u.getId()), LocalDate.now()));
    }

    private String statusOf(List<Membership> list, LocalDate today) {
        boolean scheduled = false, paused = false;
        for (Membership m : list) {
            if (m.getStatus() == MembershipStatus.PAUSED) paused = true;
            else if (m.getStatus() == MembershipStatus.ACTIVE) {
                if (!m.getStartDate().isAfter(today) && !m.getEndDate().isBefore(today)) return "ACTIVE";
                if (m.getStartDate().isAfter(today)) scheduled = true;
            }
        }
        return scheduled ? "SCHEDULED" : paused ? "PAUSED" : "NONE";
    }

    private MemberSummary toSummary(User u, String status) {
        return new MemberSummary(u.getId(), u.getName(), u.getEmail(), u.getPhone(), imageRefs.toUrl(u.getPhoto()),
                u.getAddress(), u.getCheckinPin(), u.getEnrollmentDate(),
                u.getGender(), u.getDateOfBirth(), u.getIdProofKey() != null, status);
    }
}