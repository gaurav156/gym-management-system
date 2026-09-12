package com.gymapp.otp;

import com.gymapp.entity.OtpChannel;
import com.gymapp.entity.User;

// Implemented once per delivery channel. Adding a new channel later, or swapping the
// SMS/WhatsApp stubs for a real provider, is just a new @Component implementing this
// interface - PasswordResetService and PasswordResetController never change.
public interface OtpDeliveryService {

    OtpChannel channel();

    // purpose lets the implementation render accurate copy (see OtpPurpose) - e.g. the
    // email channel uses it to pick the right subject line and reassurance footer rather
    // than a generic message that may not apply to every flow.
    void send(User user, String destination, String otp, OtpPurpose purpose);
}