package com.gymapp.entity;

// CONFIRMED: stock already decremented, payment collected/confirmed - this is also the
// terminal state for a manual cash sale that's handed over on the spot (see
// ProductOrderService.purchase), which is why COMPLETED is a separate, optional step
// rather than something every order passes through.
// COMPLETED: picked up at the branch - only meaningful once a future online-payment flow
// creates an order that isn't handed over at creation time.
// CANCELLED: refunded: stock is restored, refund is recorded.
public enum ProductOrderStatus {
    CONFIRMED, COMPLETED, CANCELLED
}