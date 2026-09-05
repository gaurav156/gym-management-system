package com.gymapp.otp;

import com.gymapp.entity.OtpChannel;
import com.gymapp.entity.User;
import org.springframework.stereotype.Component;

// Not wired to a real provider yet - same story as SmsOtpDeliveryService. Meta's own
// WhatsApp Cloud API has a free monthly allowance for utility-template conversations
// (which an OTP message qualifies as), and Twilio's WhatsApp sandbox is free for testing -
// either is a reasonable "essentially free" option to wire in here later.
@Component
public class WhatsAppOtpDeliveryService implements OtpDeliveryService {

    @Override
    public OtpChannel channel() {
        return OtpChannel.WHATSAPP;
    }

    @Override
    public void send(User user, String destination, String otp) {
        throw new IllegalArgumentException("WhatsApp delivery is not yet configured - please use Email for now");
    }
}