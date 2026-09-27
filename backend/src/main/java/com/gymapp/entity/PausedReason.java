package com.gymapp.entity;

// Why a membership is currently PAUSED. MANUAL = a manager/owner paused it by hand
// (MembershipService.pause()). NONPAYMENT = MembershipDueJob auto-paused it after its
// balanceDueDate passed with money still owed. Kept distinct so resuming behaves
// correctly: a NONPAYMENT pause auto-clears itself once the balance is paid off (see
// MembershipService.recordAdditionalPayment()); a MANUAL pause only ever clears via the
// explicit resume() action.
public enum PausedReason {
    MANUAL, NONPAYMENT
}