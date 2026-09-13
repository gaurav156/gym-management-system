package com.gymapp.service;

import com.gymapp.dto.PageDtos.PageResponse;
import com.gymapp.dto.StaffDtos.StaffSummary;
import com.gymapp.entity.User;
import com.gymapp.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

// Powers the Manager dashboard's "Staff" tab. Combines Owner + Manager + Trainer for a
// given branch, since attendance/check-in now applies to all three, not just Trainers.
@Service
public class StaffDirectoryService {

    private final UserRepository userRepository;

    public StaffDirectoryService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    // The Owner has no branch_assignments row of their own (implicit access to every
    // branch - see BranchService), so they're always included regardless of which
    // branch is selected. Managers and Trainers only show up here if actually assigned
    // to this specific branch.
    @Transactional(readOnly = true)
    public PageResponse<StaffSummary> listStaffForBranch(UUID branchId, String search, Pageable pageable) {
        String term = blankToNull(search);
        Page<User> page = term == null
                ? userRepository.findStaffForBranch(branchId, pageable)
                : userRepository.findStaffForBranchWithSearch(branchId, term, pageable);
        return PageResponse.from(page.map(this::toSummary));
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private StaffSummary toSummary(User u) {
        return new StaffSummary(u.getId(), u.getName(), u.getEmail(), u.getPhone(), u.getAddress(), u.getPhoto(),
                u.getCheckinPin(), u.getRole().name(), u.getJoiningDate(), u.getLeftDate());
    }
}