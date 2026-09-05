package com.gymapp.otp;

import com.gymapp.entity.OtpChannel;
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

    public OtpDeliveryService forChannel(OtpChannel channel) {
        OtpDeliveryService service = servicesByChannel.get(channel);
        if (service == null) {
            throw new IllegalArgumentException("No OTP delivery configured for channel " + channel);
        }
        return service;
    }
}