package com.gymapp.captcha;

// Implemented once per CAPTCHA provider - swapping Turnstile for hCaptcha/reCAPTCHA
// later, or adding a second provider, is a new implementation of this interface. Nothing
// else (controllers, FailedAttemptTracker) needs to change.
public interface CaptchaVerificationService {
    // token is what the frontend widget produced; remoteIp is the resolved client IP,
    // passed through to the provider for extra signal. Returns false for "not verified"
    // for any reason - invalid token, network failure, or provider-reported failure -
    // callers never need to distinguish why.
    boolean verify(String token, String remoteIp);
}