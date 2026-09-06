package com.gymapp.controller;

import com.gymapp.service.UserManagementService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

// Owner-only account deletion for Managers, Trainers, and Members. Deliberately placed
// under /api/owner/** so it's covered by the existing hasRole('OWNER') matcher in
// SecurityConfig - no security config change needed.
@RestController
@RequestMapping("/api/owner/users")
public class UserManagementController {

    private final UserManagementService userManagementService;

    public UserManagementController(UserManagementService userManagementService) {
        this.userManagementService = userManagementService;
    }

    @DeleteMapping("/{userId}")
    @PreAuthorize("hasRole('OWNER')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteUser(@PathVariable UUID userId, Authentication authentication) {
        UUID callerId = UUID.fromString((String) authentication.getDetails());
        userManagementService.deleteUser(userId, callerId);
    }
}