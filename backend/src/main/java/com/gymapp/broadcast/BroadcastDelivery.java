package com.gymapp.broadcast;

import java.util.UUID;

public record BroadcastDelivery(String recipientName, String destination, UUID userId, BroadcastMessage message) {}