package com.gymapp.controller;

import com.gymapp.dto.AuthDtos.*;
import com.gymapp.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    // Public: visitors on the landing page register themselves as members
    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterMemberRequest req) {
        return authService.registerMember(req);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        return authService.login(req);
    }

    // Owner-only: create a manager account for a branch
    @PostMapping("/owner/create-manager")
    @PreAuthorize("hasRole('OWNER')")
    public AuthResponse createManager(@Valid @RequestBody CreateManagerRequest req) {
        return authService.createManager(req);
    }
}
