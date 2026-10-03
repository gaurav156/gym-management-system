package com.gymapp.broadcast;

import com.gymapp.entity.BroadcastChannel;
import org.springframework.stereotype.Component;

// Not wired to a real provider yet - same story as SmsOtpDeliveryService. Replace send() with a
// call to your SMS provider (MSG91, Twilio, Fast2SMS...) and return true from isAvailable().
// NOTE for India: promotional SMS needs DLT-registered sender IDs/templates with the provider.
@Component
public class SmsBroadcastSender implements BroadcastChannelSender {

    @Override
    public BroadcastChannel channel() { return BroadcastChannel.SMS; }

    @Override
    public boolean isAvailable() { return false; }

    @Override
    public void send(BroadcastDelivery delivery) {
        throw new IllegalArgumentException("SMS delivery is not yet configured - please use Email for now");
    }
}