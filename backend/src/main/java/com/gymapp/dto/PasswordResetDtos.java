package com.gymapp.dto;

import com.gymapp.entity.OtpChannel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class PasswordResetDtos {

    // identifier is an email today (the only live channel) but kept as a generic name
    // rather than "email" so a phone number works the same way once SMS/WhatsApp are
    // switched on, with no request-shape change needed.
    public record RequestOtpRequest(
            @NotBlank String identifier,
            @NotNull OtpChannel channel
    ) {}

    // Deliberately generic wording - never confirms/denies whether the identifier is
    // registered, so this endpoint can't be used to enumerate accounts.
    public record RequestOtpResponse(
            String message
    ) {}

    public record ResetPasswordRequest(
            @NotBlank String identifier,
            @NotNull OtpChannel channel,
            @NotBlank String otp,
            @NotBlank @Size(min = 6) String newPassword
    ) {}

    public record ResetPasswordResponse(
            String message
    ) {}
}