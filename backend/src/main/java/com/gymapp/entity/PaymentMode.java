package com.gymapp.entity;

// ONLINE is reserved for a future payment gateway integration (e.g. Razorpay) - the cash
// flow and the online flow both just write a Payment row with a different mode.
public enum PaymentMode {
    CASH, ONLINE
}