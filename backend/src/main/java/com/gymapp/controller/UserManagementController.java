package com.gymapp.controller;

import com.gymapp.dto.RoleChangeDtos.*;
import com.gymapp.service.RoleChangeService;
import com.gymapp.service.UserManagementService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

// Owner-only account deletion and role management. Deliberately placed under
// /api/owner/** so it's covered by the existing hasRole('OWNER') matcher in
// SecurityConfig - no security config change needed.
@RestController
@RequestMapping("/api/owner/users")
public class UserManagementController {

    private final UserManagementService userManagementService;
    private final RoleChangeService roleChangeService;

    public UserManagementController(UserManagementService userManagementService,
                                    RoleChangeService roleChangeService) {
        this.userManagementService = userManagementService;
        this.roleChangeService = roleChangeService;
    }

    @DeleteMapping("/{userId}")
    @PreAuthorize("hasRole('OWNER')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteUser(@PathVariable UUID userId, Authentication authentication) {
        UUID callerId = UUID.fromString((String) authentication.getDetails());
        userManagementService.deleteUser(userId, callerId);
    }

    // Step 1 of any change that crosses the Owner boundary. If the target is currently an
    // Owner (demotion) the code goes to OWNER_EMAIL; otherwise (promotion) to the caller.
    @PostMapping("/{userId}/role/request-otp")
    @PreAuthorize("hasRole('OWNER')")
    public RequestOwnerPromotionOtpResponse requestRoleChangeOtp(@PathVariable UUID userId,
                                                                 Authentication authentication) {
        UUID callerId = UUID.fromString((String) authentication.getDetails());
        return roleChangeService.requestOtp(callerId, userId);
    }

    @PutMapping("/{userId}/role")
    @PreAuthorize("hasRole('OWNER')")
    public ChangeRoleResponse changeRole(@PathVariable UUID userId, @Valid @RequestBody ChangeRoleRequest req,
                                         Authentication authentication) {
        UUID callerId = UUID.fromString((String) authentication.getDetails());
        return roleChangeService.changeRole(userId, req.newRole(), callerId, req.otp(), req.branchIds());
    }

    @GetMapping("/{userId}/role-history")
    @PreAuthorize("hasRole('OWNER')")
    public List<RoleHistoryEntry> roleHistory(@PathVariable UUID userId) {
        return roleChangeService.historyFor(userId);
    }
}