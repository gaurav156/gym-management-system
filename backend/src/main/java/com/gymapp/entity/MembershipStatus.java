package com.gymapp.entity;

public enum MembershipStatus {
    ACTIVE,
    EXPIRED,
    CANCELLED,
    // Temporarily suspended by a manager/owner - gym access is denied while paused (the
    // attendance check-in query only looks for ACTIVE), and resuming extends the end date
    // by however many days it was paused, so the member doesn't lose paid-for time.
    PAUSED
}