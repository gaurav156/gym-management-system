package com.gymapp.invoice;

import java.util.UUID;

// Published after a payment is committed - InvoicePurchaseListener uses this to
// auto-email the invoice without making the purchase request wait on mail delivery.
public record PaymentRecordedEvent(UUID paymentId) {}