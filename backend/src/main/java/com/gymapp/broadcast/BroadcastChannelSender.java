package com.gymapp.broadcast;

import com.gymapp.entity.BroadcastChannel;

// Implemented once per delivery channel - same idea as OtpDeliveryService. Wiring up SMS or
// WhatsApp later is replacing a stub's send() and flipping isAvailable() to true.
public interface BroadcastChannelSender {

    BroadcastChannel channel();

    // false = channel not configured yet; the Owner can't select it (UI) or send on it (API).
    default boolean isAvailable() { return true; }

    // destination is an email address or phone number depending on channel(). subject is
    // only meaningful for email. Throw on failure - the dispatcher records it per recipient.
    // Throw on failure - the dispatcher records it per recipient.
    void send(BroadcastDelivery delivery);
}