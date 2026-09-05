package com.gymapp.otp;

import com.gymapp.entity.OtpChannel;
import com.gymapp.entity.User;
import org.springframework.stereotype.Component;

// Not wired to a real SMS provider yet - the request/verify flow already supports this
// channel end-to-end (see PasswordResetService and UserRepository.findFirstByPhone), so
// turning it on later is just replacing this method body with a call to whichever
// provider you pick and reading its credentials from env vars the same way
// EmailOtpDeliveryService does. Affordable pay-as-you-go options: Twilio, MSG91, or
// Fast2SMS (India) all charge a fraction of a cent per SMS - cheap enough for a single
// gym's OTP volume, though not literally free the way email is.
@Component
public class SmsOtpDeliveryService implements OtpDeliveryService {

    @Override
    public OtpChannel channel() {
        return OtpChannel.SMS;
    }

    @Override
    public void send(User user, String destination, String otp) {
        throw new IllegalArgumentException("SMS delivery is not yet configured - please use Email for now");
    }
}