package com.gymapp.service;

import com.gymapp.entity.Role;
import com.gymapp.entity.User;
import com.gymapp.repository.PaymentRepository;
import com.gymapp.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

// Owner-only "delete account entirely" - a real delete, not the existing `active` flag
// toggle. Works for MANAGER, TRAINER, and MEMBER accounts alike. Branch assignments,
// attendance history, and (for a member) their own memberships/payments all cascade-
// delete along with the user row (see V8 migration). What this explicitly guards
// against: deleting a Manager/Owner who has RECORDED payments for other members - that
// would silently break those members' invoice/audit history, so it's blocked with a
// clear message rather than allowed to corrupt data or fail as a raw SQL error.
@Service
public class UserManagementService {

    private final UserRepository userRepository;
    private final PaymentRepository paymentRepository;

    public UserManagementService(UserRepository userRepository, PaymentRepository paymentRepository) {
        this.userRepository = userRepository;
        this.paymentRepository = paymentRepository;
    }

    @Transactional
    public void deleteUser(UUID userId, UUID callerId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (user.getRole() == Role.OWNER) {
            throw new IllegalArgumentException("The Owner account cannot be deleted");
        }
        if (user.getId().equals(callerId)) {
            throw new IllegalArgumentException("You cannot delete your own account");
        }
        if (paymentRepository.existsByRecordedById(userId)) {
            throw new IllegalArgumentException(
                    "This account has recorded payments for other members - deleting it would break " +
                            "their invoice history. Deactivate the account instead if they should no longer have access.");
        }

        userRepository.delete(user);
    }
}