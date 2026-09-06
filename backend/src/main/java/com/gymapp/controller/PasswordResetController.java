package com.gymapp.controller;

import com.gymapp.captcha.CaptchaVerificationService;
import com.gymapp.captcha.FailedAttemptTracker;
import com.gymapp.dto.PasswordResetDtos.*;
import com.gymapp.exception.CaptchaRequiredException;
import com.gymapp.security.ClientIpResolver;
import com.gymapp.service.PasswordResetService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

// Public - no auth token exists yet for someone who's locked out. Sits under
// /api/auth/**, already permitAll in SecurityConfig, so no security-rule change needed.
@RestController
@RequestMapping("/api/auth/password-reset")
public class PasswordResetController {

    private final PasswordResetService passwordResetService;
    private final FailedAttemptTracker failedAttemptTracker;
    private final CaptchaVerificationService captchaVerificationService;

    public PasswordResetController(PasswordResetService passwordResetService,
                                   FailedAttemptTracker failedAttemptTracker,
                                   CaptchaVerificationService captchaVerificationService) {
        this.passwordResetService = passwordResetService;
        this.failedAttemptTracker = failedAttemptTracker;
        this.captchaVerificationService = captchaVerificationService;
    }

    // requestOtp() is the real DOS target here (each call can trigger an outbound email
    // send), and unlike login/register it always returns a generic "if an account
    // exists..." message regardless of outcome - so counting only *failures* would miss
    // volumetric abuse entirely (a script spamming valid-looking requests would never
    // fail). Every call from an IP counts toward the threshold instead, win or lose.
    @PostMapping("/request-otp")
    public RequestOtpResponse requestOtp(@Valid @RequestBody RequestOtpRequest req, HttpServletRequest request) {
        String ip = ClientIpResolver.resolve(request);
        failedAttemptTracker.increment(ip);
        if (failedAttemptTracker.isCaptchaRequired(ip)) {
            if (req.captchaToken() == null || req.captchaToken().isBlank()
                    || !captchaVerificationService.verify(req.captchaToken(), ip)) {
                throw new CaptchaRequiredException("Please complete the CAPTCHA to continue.");
            }
        }
        return passwordResetService.requestOtp(req);
    }

    @PostMapping("/confirm")
    public ResetPasswordResponse confirm(@Valid @RequestBody ResetPasswordRequest req) {
        return passwordResetService.resetPassword(req);
    }
}