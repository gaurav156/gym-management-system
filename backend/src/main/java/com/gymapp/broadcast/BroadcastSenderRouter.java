package com.gymapp.broadcast;

import com.gymapp.entity.BroadcastChannel;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class BroadcastSenderRouter {

    private final Map<BroadcastChannel, BroadcastChannelSender> sendersByChannel;

    public BroadcastSenderRouter(List<BroadcastChannelSender> senders) {
        this.sendersByChannel = senders.stream()
                .collect(Collectors.toMap(BroadcastChannelSender::channel, Function.identity()));
    }

    @PostConstruct
    public void logRegisteredChannels() {
        System.out.println("BroadcastSenderRouter: registered channels = " + sendersByChannel.keySet());
    }

    public BroadcastChannelSender forChannel(BroadcastChannel channel) {
        BroadcastChannelSender sender = sendersByChannel.get(channel);
        if (sender == null) {
            throw new IllegalArgumentException("No broadcast delivery configured for channel " + channel);
        }
        return sender;
    }

    public List<BroadcastChannelSender> all() {
        return List.copyOf(sendersByChannel.values());
    }
}