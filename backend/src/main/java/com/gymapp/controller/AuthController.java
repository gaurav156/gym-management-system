package com.gymapp.controller;

import com.gymapp.captcha.CaptchaVerificationService;
import com.gymapp.captcha.FailedAttemptTracker;
import com.gymapp.dto.AuthDtos.*;
import com.gymapp.exception.CaptchaRequiredException;
import com.gymapp.security.ClientIpResolver;
import com.gymapp.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final FailedAttemptTracker failedAttemptTracker;
    private final CaptchaVerificationService captchaVerificationService;

    public AuthController(AuthService authService,
                          FailedAttemptTracker failedAttemptTracker,
                          CaptchaVerificationService captchaVerificationService) {
        this.authService = authService;
        this.failedAttemptTracker = failedAttemptTracker;
        this.captchaVerificationService = captchaVerificationService;
    }

    // Public: visitors on the landing page register themselves as members. Rate-limited
    // by IP - after a few failed attempts (e.g. scripted bulk sign-ups repeatedly hitting
    // a duplicate-email or validation error), a CAPTCHA is required before trying again.
    // See FailedAttemptTracker for the threshold/window.
    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterMemberRequest req, HttpServletRequest request) {
        String ip = ClientIpResolver.resolve(request);
        requireCaptchaIfNeeded(ip, req.captchaToken());
        try {
            AuthResponse response = authService.registerMember(req);
            failedAttemptTracker.reset(ip);
            return response;
        } catch (IllegalArgumentException e) {
            failedAttemptTracker.increment(ip);
            throw e;
        }
    }

    // Rate-limited by IP the same way as register() - after a few failed logins (wrong
    // password, unknown email, etc.) from the same IP, a CAPTCHA is required before the
    // next attempt is even checked against the database. This is on top of, not instead
    // of, the normal password hashing already handled by AuthService.
    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req, HttpServletRequest request) {
        String ip = ClientIpResolver.resolve(request);
        requireCaptchaIfNeeded(ip, req.captchaToken());
        try {
            AuthResponse response = authService.login(req);
            failedAttemptTracker.reset(ip);
            return response;
        } catch (IllegalArgumentException e) {
            failedAttemptTracker.increment(ip);
            throw e;
        }
    }

    // Owner-only: create a manager account, assigned to one or more branches
    @PostMapping("/owner/create-manager")
    @PreAuthorize("hasRole('OWNER')")
    public AuthResponse createManager(@Valid @RequestBody CreateManagerRequest req) {
        return authService.createManager(req);
    }

    // Owner-only: create a trainer account, assigned to one or more branches
    @PostMapping("/owner/create-trainer")
    @PreAuthorize("hasRole('OWNER')")
    public AuthResponse createTrainer(@Valid @RequestBody CreateTrainerRequest req) {
        return authService.createTrainer(req);
    }

    // Shared by login() and register() - throws before the real service call runs at all
    // if this IP has too many recent failures and hasn't supplied a token that verifies.
    // Doing this ahead of any DB/service work is the point: it's what keeps a flood of
    // bad requests cheap to reject.
    private void requireCaptchaIfNeeded(String ip, String captchaToken) {
        if (!failedAttemptTracker.isCaptchaRequired(ip)) {
            return;
        }
        if (captchaToken == null || captchaToken.isBlank()
                || !captchaVerificationService.verify(captchaToken, ip)) {
            throw new CaptchaRequiredException("Please complete the CAPTCHA to continue.");
        }
    }
}