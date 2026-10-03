package com.gymapp.entity;

// ACTIVE_MEMBERS = a MEMBER with an ACTIVE plan covering today (same rule as check-in access).
// INACTIVE_MEMBERS = every other MEMBER (no plan, expired, paused, or only a future plan).
public enum BroadcastAudience {
    ALL_USERS, ALL_MEMBERS, ACTIVE_MEMBERS, INACTIVE_MEMBERS,
    ALL_STAFF, ALL_TRAINERS, ALL_MANAGERS, ALL_OWNERS
}