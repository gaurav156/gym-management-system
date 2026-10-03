package com.gymapp.broadcast;

import com.gymapp.entity.BroadcastChannel;
import org.springframework.stereotype.Component;

// Not wired to a real provider yet - same story as WhatsAppOtpDeliveryService. NOTE: with the
// WhatsApp Cloud API, business-initiated bulk messages must use pre-approved templates, and
// promotional templates are billed per message.
@Component
public class WhatsAppBroadcastSender implements BroadcastChannelSender {

    @Override
    public BroadcastChannel channel() { return BroadcastChannel.WHATSAPP; }

    @Override
    public boolean isAvailable() { return false; }

    @Override
    public void send(BroadcastDelivery delivery) {
        throw new IllegalArgumentException("WhatsApp delivery is not yet configured - please use Email for now");
    }
}