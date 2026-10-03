package com.gymapp.broadcast;

import java.util.UUID;

// Published after the broadcast + its recipient snapshot are committed - the dispatcher runs
// off-thread so the Owner's request returns immediately regardless of how many are queued.
public record BroadcastCreatedEvent(UUID broadcastId) {}