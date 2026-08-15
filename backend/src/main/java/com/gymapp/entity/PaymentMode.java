package com.gymapp.entity;

// CASH, UPI, CARD, CHEQUE, BANK_TRANSFER are all manually recorded by a manager at the
// front desk right now. ONLINE is reserved for a future payment-gateway integration
// (e.g. Razorpay) where the mode would be set automatically rather than picked from a
// dropdown - kept as a separate value now so that later change doesn't need a migration.
public enum PaymentMode {
    CASH, UPI, CARD, CHEQUE, BANK_TRANSFER, ONLINE
}