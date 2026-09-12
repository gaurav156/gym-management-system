package com.gymapp.otp;

// What a verification code is actually for - lets the delivery channel render accurate
// copy instead of a one-size-fits-all message. In particular, "your password won't be
// changed" is only true for PASSWORD_RESET/CHANGE_PASSWORD; it's misleading for
// REGISTRATION, where there's no password action being confirmed at all.
public enum OtpPurpose {
    PASSWORD_RESET,
    CHANGE_PASSWORD,
    REGISTRATION
}