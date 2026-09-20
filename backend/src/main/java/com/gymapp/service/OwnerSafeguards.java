package com.gymapp.service;

import com.gymapp.entity.Role;
import com.gymapp.entity.User;
import com.gymapp.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.UUID;

// Single source of truth for the rules protecting Owner accounts - used by the OTP request
// (fail before emailing anything), the role change itself, and account deletion, so the
// three can never disagree about what's allowed.
//
// The "primary Owner" is whichever account has the email in OWNER_EMAIL (the same value
// DataSeeder uses). It can't be demoted or deleted while that value matches. To retire it,
// change OWNER_EMAIL in the server config and restart first - deliberately a config-level
// action, not something anyone can do from the UI.
@Component
public class OwnerSafeguards {

    private final UserRepository userRepository;

    @Value("${app.seed.owner-email}")
    private String primaryOwnerEmail;

    public OwnerSafeguards(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public String primaryOwnerEmail() {
        return primaryOwnerEmail.trim();
    }

    public boolean isPrimaryOwner(User user) {
        return user.getEmail() != null && user.getEmail().trim().equalsIgnoreCase(primaryOwnerEmail());
    }

    public void assertOwnerCanBeDemoted(User target, UUID callerId) {
        if (target.getRole() != Role.OWNER) {
            throw new IllegalArgumentException("This account is not an Owner");
        }
        if (target.getId().equals(callerId)) {
            throw new IllegalArgumentException("You cannot change your own role");
        }
        if (isPrimaryOwner(target)) {
            throw new IllegalArgumentException(
                    "This is the primary Owner account (the email set as OWNER_EMAIL) and can't be demoted or deleted. " +
                            "To retire it, first change OWNER_EMAIL in the server configuration.");
        }
        if (userRepository.countByRoleAndActiveTrueAndIdNot(Role.OWNER, target.getId()) < 1) {
            throw new IllegalArgumentException(
                    "There must be at least one other active Owner before an Owner can be demoted");
        }
    }
}