package com.gymapp.account;

import java.util.UUID;

// Published after a new account is committed - AccountCreatedListener uses this to email
// the person their check-in PIN without making account creation wait on mail delivery.
public record AccountCreatedEvent(UUID userId) {}