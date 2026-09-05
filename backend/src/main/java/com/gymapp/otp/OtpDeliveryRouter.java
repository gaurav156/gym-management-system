package com.gymapp.otp;

import com.gymapp.entity.OtpChannel;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

// Picks the right OtpDeliveryService for a requested channel. Spring hands us every
// OtpDeliveryService bean in the context - registering a new channel later is just
// adding one more @Component, nothing here needs to change.
@Component
public class OtpDeliveryRouter {

    private final Map<OtpChannel, OtpDeliveryService> servicesByChannel;

    public OtpDeliveryRouter(List<OtpDeliveryService> services) {
        this.servicesByChannel = services.stream()
                .collect(Collectors.toMap(OtpDeliveryService::channel, Function.identity()));
    }

    // Prints what's actually wired up every time the app starts - if EMAIL (or any
    // expected channel) is missing from this line, the bean never got created, which is
    // the fastest way to tell "OTP delivery is broken" apart from "the mail server itself
    // rejected the send".
    @PostConstruct
    public void logRegisteredChannels() {
        System.out.println("OtpDeliveryRouter: registered OTP channels = " + servicesByChannel.keySet());
    }

    public OtpDeliveryService forChannel(OtpChannel channel) {
        OtpDeliveryService service = servicesByChannel.get(channel);
        if (service == null) {
            throw new IllegalArgumentException("No OTP delivery configured for channel " + channel);
        }
        return service;
    }
}