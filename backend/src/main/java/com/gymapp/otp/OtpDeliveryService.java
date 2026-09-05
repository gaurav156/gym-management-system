package com.gymapp.otp;

import com.gymapp.entity.OtpChannel;
import com.gymapp.entity.User;

// Implemented once per delivery channel. Adding a new channel later, or swapping the
// SMS/WhatsApp stubs for a real provider, is just a new @Component implementing this
// interface - PasswordResetService and PasswordResetController never change.
public interface OtpDeliveryService {

    OtpChannel channel();

    // destination is the resolved email/phone to send to. Implementations should throw
    // if delivery fails, so the caller can log it - but see PasswordResetService, which
    // deliberately never lets a delivery failure change what the HTTP caller sees.
    void send(User user, String destination, String otp);
}