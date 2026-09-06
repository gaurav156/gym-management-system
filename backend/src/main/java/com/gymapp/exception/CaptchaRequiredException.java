package com.gymapp.exception;

// Thrown when an endpoint requires a CAPTCHA to proceed (either because a token wasn't
// supplied, or the supplied token failed verification). Kept distinct from
// IllegalArgumentException so GlobalExceptionHandler can flag the response with
// captchaRequired=true - the frontend needs to tell "wrong password" apart from "please
// solve a CAPTCHA and retry" to know whether to render the widget.
public class CaptchaRequiredException extends RuntimeException {
    public CaptchaRequiredException(String message) {
        super(message);
    }
}