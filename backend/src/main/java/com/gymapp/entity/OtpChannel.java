package com.gymapp.entity;

// EMAIL is live today (free via SMTP). SMS/WHATSAPP already flow end-to-end through
// PasswordResetService and the controller - switching one on later is purely a matter of
// giving it a real com.gymapp.otp.OtpDeliveryService implementation (see that package),
// no changes needed here or in the request/verify endpoints.
public enum OtpChannel {
    EMAIL, SMS, WHATSAPP
}