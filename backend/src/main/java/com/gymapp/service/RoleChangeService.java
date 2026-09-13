package com.gymapp.service;

import com.gymapp.dto.RoleChangeDtos.*;
import com.gymapp.entity.Role;
import com.gymapp.entity.RoleChangeHistory;
import com.gymapp.entity.User;
import com.gymapp.repository.RoleChangeHistoryRepository;
import com.gymapp.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

// Owner-only. Unifies what used to be two separate ideas - "mark a Trainer as left" and
// "change someone's role" - into one action with automatic joiningDate/leftDate side
// effects, so the two can never drift out of sync with each other.
//
// IMPORTANT CAVEAT: this updates the User row, but an already-issued JWT keeps whatever
// role it was signed with until it expires (see app.jwt.expiration-ms) or the person
// logs in again. This is not instant revocation - if that's ever needed, it requires a
// server-side token blocklist or much shorter-lived tokens, which this does not add.
@Service
public class RoleChangeService {

    private final UserRepository userRepository;
    private final RoleChangeHistoryRepository roleChangeHistoryRepository;

    public RoleChangeService(UserRepository userRepository,
                             RoleChangeHistoryRepository roleChangeHistoryRepository) {
        this.userRepository = userRepository;
        this.roleChangeHistoryRepository = roleChangeHistoryRepository;
    }

    @Transactional
    public ChangeRoleResponse changeRole(UUID userId, Role newRole, UUID callerId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        User caller = userRepository.findById(callerId)
                .orElseThrow(() -> new IllegalArgumentException("Caller not found"));

        if (user.getRole() == Role.OWNER) {
            throw new IllegalArgumentException("The Owner's role cannot be changed");
        }
        if (newRole == Role.OWNER) {
            throw new IllegalArgumentException("Cannot change anyone's role to Owner");
        }
        if (user.getId().equals(callerId)) {
            throw new IllegalArgumentException("You cannot change your own role");
        }
        if (user.getRole() == newRole) {
            throw new IllegalArgumentException(user.getName() + " already has that role");
        }

        Role previousRole = user.getRole();

        roleChangeHistoryRepository.save(RoleChangeHistory.builder()
                .user(user)
                .previousRole(previousRole)
                .newRole(newRole)
                .changedBy(caller)
                .build());

        boolean wasStaff = previousRole == Role.TRAINER || previousRole == Role.MANAGER;
        boolean becomingStaff = newRole == Role.TRAINER || newRole == Role.MANAGER;

        if (becomingStaff && !wasStaff) {
            // (Re)joining staff - fresh joining date, clear any old leave date so they
            // don't show up as "left" the moment they're promoted.
            user.setJoiningDate(LocalDate.now());
            user.setLeftDate(null);
        } else if (wasStaff && !becomingStaff) {
            // Leaving staff - record when, but only if this is the first time (don't
            // overwrite an existing leftDate if one was already set some other way).
            if (user.getLeftDate() == null) {
                user.setLeftDate(LocalDate.now());
            }
            if (newRole == Role.MEMBER && user.getEnrollmentDate() == null) {
                user.setEnrollmentDate(LocalDate.now());
            }
        }
        // TRAINER <-> MANAGER (staff to staff) intentionally leaves joiningDate/leftDate
        // untouched - they never stopped being staff.

        user.setRole(newRole);
        userRepository.save(user);

        return new ChangeRoleResponse(user.getId(), previousRole.name(), newRole.name(),
                "Role changed from " + previousRole + " to " + newRole + ". Note: anyone already " +
                        "logged in keeps their old access until their session expires or they log in again.");
    }

    @Transactional(readOnly = true)
    public List<RoleHistoryEntry> historyFor(UUID userId) {
        return roleChangeHistoryRepository.findByUserIdOrderByChangedAtDesc(userId).stream()
                .map(h -> new RoleHistoryEntry(h.getPreviousRole().name(), h.getNewRole().name(),
                        h.getChangedBy().getName(), h.getChangedAt()))
                .toList();
    }
}