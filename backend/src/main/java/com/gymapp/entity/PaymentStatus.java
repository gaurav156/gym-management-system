package com.gymapp.entity;

// Whether a membership has been paid for in full or only partially - see
// MembershipService.purchase()/recordAdditionalPayment() and the V20 migration. Distinct
// from MembershipStatus (ACTIVE/PAUSED/etc.), which tracks gym-access lifecycle, not money.
public enum PaymentStatus {
    PAID, PARTIAL
}