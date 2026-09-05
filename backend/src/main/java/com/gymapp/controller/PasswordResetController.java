package com.gymapp.controller;

import com.gymapp.dto.PasswordResetDtos.*;
import com.gymapp.service.PasswordResetService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

// Public - no auth token exists yet for someone who's locked out. Sits under
// /api/auth/**, already permitAll in SecurityConfig, so no security-rule change needed.
@RestController
@RequestMapping("/api/auth/password-reset")
public class PasswordResetController {

    private final PasswordResetService passwordResetService;

    public PasswordResetController(PasswordResetService passwordResetService) {
        this.passwordResetService = passwordResetService;
    }

    @PostMapping("/request-otp")
    public RequestOtpResponse requestOtp(@Valid @RequestBody RequestOtpRequest req) {
        return passwordResetService.requestOtp(req);
    }

    @PostMapping("/confirm")
    public ResetPasswordResponse confirm(@Valid @RequestBody ResetPasswordRequest req) {
        return passwordResetService.resetPassword(req);
    }
}