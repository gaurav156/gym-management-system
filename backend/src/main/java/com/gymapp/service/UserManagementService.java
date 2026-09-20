package com.gymapp.service;

import com.gymapp.entity.Role;
import com.gymapp.entity.User;
import com.gymapp.repository.PaymentRepository;
import com.gymapp.repository.UserRepository;
import com.gymapp.storage.ImageRefs;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

// Owner-only "delete account entirely" - a real delete, not the existing `active` flag
// toggle. Works for MANAGER, TRAINER, and MEMBER accounts. An Owner can't be deleted
// directly: demote them first (RoleChangeService - OTP-gated), then delete. The primary
// Owner (OWNER_EMAIL) can never be deleted while that config value matches it.
//
// Branch assignments, attendance history, and (for a member) their own memberships/
// payments all cascade-delete along with the user row (see V9 migration). What this
// explicitly guards against: deleting a Manager/Owner who has RECORDED payments for other
// members - that would silently break those members' invoice/audit history, so it's
// blocked with a clear message rather than allowed to corrupt data or fail as a raw SQL
// error.
@Service
public class UserManagementService {

    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;
    private final OwnerSafeguards ownerSafeguards;
    private final ImageRefs imageRefs;

    public UserManagementService(UserRepository userRepository,
                                 PaymentRepository paymentRepository,
                                 OwnerSafeguards ownerSafeguards,
                                 ImageRefs imageRefs) {
        this.userRepository = userRepository;
        this.paymentRepository = paymentRepository;
        this.ownerSafeguards = ownerSafeguards;
        this.imageRefs = imageRefs;
    }

    @Transactional
    public void deleteUser(UUID userId, UUID callerId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (ownerSafeguards.isPrimaryOwner(user)) {
            throw new IllegalArgumentException(
                    "This is the primary Owner account (the email set as OWNER_EMAIL) and can't be deleted. " +
                            "To retire it, first change OWNER_EMAIL in the server configuration.");
        }
        if (user.getRole() == Role.OWNER) {
            throw new IllegalArgumentException(
                    "An Owner account can't be deleted directly - change their role first (requires a " +
                            "verification code), then delete the account.");
        }
        if (user.getId().equals(callerId)) {
            throw new IllegalArgumentException("You cannot delete your own account");
        }
        if (paymentRepository.existsByRecordedById(userId)) {
            throw new IllegalArgumentException(
                    "This account has recorded payments for other members - deleting it would break " +
                            "their invoice history. Deactivate the account instead if they should no longer have access.");
        }

        String photo = user.getPhoto();
        String signature = user.getSignature();
        userRepository.delete(user);
        imageRefs.deleteAfterCommit(photo);
        imageRefs.deleteAfterCommit(signature);
    }
}