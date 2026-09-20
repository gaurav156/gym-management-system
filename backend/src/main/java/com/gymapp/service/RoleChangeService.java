package com.gymapp.service;

import com.gymapp.dto.RoleChangeDtos.*;
import com.gymapp.entity.Branch;
import com.gymapp.entity.BranchAssignment;
import com.gymapp.entity.Role;
import com.gymapp.entity.RoleChangeHistory;
import com.gymapp.entity.User;
import com.gymapp.repository.BranchAssignmentRepository;
import com.gymapp.repository.BranchRepository;
import com.gymapp.repository.RoleChangeHistoryRepository;
import com.gymapp.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

// Owner-only. Unifies what used to be two separate ideas - "mark a Trainer as left" and
// "change someone's role" - into one action with automatic joiningDate/leftDate side
// effects, so the two can never drift out of sync with each other.
//
// Both directions across the Owner boundary need a fresh email OTP:
//  - promoting to OWNER: code goes to the acting Owner (OwnerPromotionOtpService)
//  - demoting an OWNER: code goes to OWNER_EMAIL (OwnerDemotionOtpService), and the
//    OwnerSafeguards rules apply (not yourself, not the primary Owner, another active
//    Owner must exist)
//
// IMPORTANT CAVEAT: this updates the User row, but an already-issued JWT keeps whatever
// role it was signed with until it expires (see app.jwt.expiration-ms) or the person
// logs in again - unless JwtAuthFilter resolves the role from the database.
@Service
public class RoleChangeService {

    private final UserRepository userRepository;
    private final RoleChangeHistoryRepository roleChangeHistoryRepository;
    private final OwnerPromotionOtpService ownerPromotionOtpService;
    private final OwnerDemotionOtpService ownerDemotionOtpService;
    private final OwnerSafeguards ownerSafeguards;
    private final BranchRepository branchRepository;
    private final BranchAssignmentRepository branchAssignmentRepository;

    public RoleChangeService(UserRepository userRepository,
                             RoleChangeHistoryRepository roleChangeHistoryRepository,
                             OwnerPromotionOtpService ownerPromotionOtpService,
                             OwnerDemotionOtpService ownerDemotionOtpService,
                             OwnerSafeguards ownerSafeguards,
                             BranchRepository branchRepository,
                             BranchAssignmentRepository branchAssignmentRepository) {
        this.userRepository = userRepository;
        this.roleChangeHistoryRepository = roleChangeHistoryRepository;
        this.ownerPromotionOtpService = ownerPromotionOtpService;
        this.ownerDemotionOtpService = ownerDemotionOtpService;
        this.ownerSafeguards = ownerSafeguards;
        this.branchRepository = branchRepository;
        this.branchAssignmentRepository = branchAssignmentRepository;
    }

    // One request-otp endpoint for both directions: the target's CURRENT role decides which
    // flow (and which mailbox) applies. Deliberately not @Transactional - each delegate
    // owns its own transaction.
    public RequestOwnerPromotionOtpResponse requestOtp(UUID callerId, UUID targetUserId) {
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return target.getRole() == Role.OWNER
                ? ownerDemotionOtpService.requestOtp(callerId, targetUserId)
                : ownerPromotionOtpService.requestOtp(callerId, targetUserId);
    }

    // noRollbackFor: every validation below throws BEFORE any write, so this only changes
    // one thing - a wrong OTP guess throws IllegalArgumentException after the OTP service
    // has bumped the attempt counter, and that increment must survive. Once the OTP is
    // verified, nothing else in this method throws IllegalArgumentException, so it can
    // never commit a consumed OTP without the role change.
    @Transactional(noRollbackFor = IllegalArgumentException.class)
    public ChangeRoleResponse changeRole(UUID userId, Role newRole, UUID callerId, String otp, List<UUID> branchIds) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        User caller = userRepository.findById(callerId)
                .orElseThrow(() -> new IllegalArgumentException("Caller not found"));

        if (user.getId().equals(callerId)) {
            throw new IllegalArgumentException("You cannot change your own role");
        }
        if (user.getRole() == newRole) {
            throw new IllegalArgumentException(user.getName() + " already has that role");
        }

        boolean demotingOwner = user.getRole() == Role.OWNER;
        List<Branch> branchesToAssign = List.of();

        if (demotingOwner) {
            ownerSafeguards.assertOwnerCanBeDemoted(user, callerId);
            branchesToAssign = resolveBranchesForDemotion(userId, branchIds);
            ownerDemotionOtpService.verifyAndConsume(callerId, userId, otp);
        } else if (newRole == Role.OWNER) {
            ownerPromotionOtpService.verifyAndConsume(callerId, userId, otp);
        }

        Role previousRole = user.getRole();

        roleChangeHistoryRepository.save(RoleChangeHistory.builder()
                .user(user)
                .previousRole(previousRole)
                .newRole(newRole)
                .changedBy(caller)
                .build());

        if (newRole == Role.OWNER) {
            // Owners aren't "staff" for joining/left-date purposes (they can't leave via
            // this system) - just make sure a promoted ex-staff member doesn't carry a
            // stale left date. joiningDate is left untouched.
            user.setLeftDate(null);
        } else {
            boolean wasStaff = previousRole == Role.TRAINER || previousRole == Role.MANAGER;
            boolean becomingStaff = newRole == Role.TRAINER || newRole == Role.MANAGER;

            if (becomingStaff && !wasStaff) {
                // (Re)joining staff - fresh joining date, clear any old leave date so they
                // don't show up as "left" the moment they're promoted. This is also the
                // path for a demoted Owner becoming a Trainer/Manager.
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
        }

        user.setRole(newRole);
        userRepository.save(user);

        if (!branchesToAssign.isEmpty()) {
            Set<UUID> alreadyAssigned = branchAssignmentRepository.findByUserId(userId).stream()
                    .map(a -> a.getBranch().getId())
                    .collect(Collectors.toSet());
            for (Branch branch : branchesToAssign) {
                if (!alreadyAssigned.contains(branch.getId())) {
                    branchAssignmentRepository.save(BranchAssignment.builder()
                            .user(user)
                            .branch(branch)
                            .build());
                }
            }
        }

        return new ChangeRoleResponse(user.getId(), previousRole.name(), newRole.name(),
                "Role changed from " + previousRole + " to " + newRole);
    }

    // An Owner has implicit access to every branch, so they may have no branch_assignments
    // rows at all. Staff/Members lists only show people assigned to a branch, so without at
    // least one assignment a demoted Owner would vanish from the UI (and could never be
    // deleted). Existing assignments count; requested ones are added on top.
    private List<Branch> resolveBranchesForDemotion(UUID userId, List<UUID> branchIds) {
        List<UUID> requested = branchIds == null ? List.of() : branchIds.stream().distinct().toList();
        if (requested.isEmpty() && branchAssignmentRepository.findByUserId(userId).isEmpty()) {
            throw new IllegalArgumentException(
                    "Select at least one branch to assign this person to - without one they wouldn't appear in the Staff or Members lists");
        }
        List<Branch> branches = branchRepository.findAllById(requested);
        if (branches.size() != requested.size()) {
            throw new IllegalArgumentException("One or more branches not found");
        }
        return branches;
    }

    @Transactional(readOnly = true)
    public List<RoleHistoryEntry> historyFor(UUID userId) {
        return roleChangeHistoryRepository.findByUserIdOrderByChangedAtDesc(userId).stream()
                .map(h -> new RoleHistoryEntry(h.getPreviousRole().name(), h.getNewRole().name(),
                        h.getChangedBy().getName(), h.getChangedAt()))
                .toList();
    }
}