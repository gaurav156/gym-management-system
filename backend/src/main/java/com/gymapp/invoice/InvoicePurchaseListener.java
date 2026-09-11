package com.gymapp.invoice;

import com.gymapp.service.PaymentService;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

// AFTER_COMMIT + @Async: fires only once the purchase transaction has actually
// committed (so the Payment/Membership rows are visible to this new thread's own read),
// and runs off-thread so a slow or failing mail server never delays or fails the
// purchase response - MembershipService.purchase() has already returned by the time
// this runs.
@Component
public class InvoicePurchaseListener {

    private final PaymentService paymentService;
    private final InvoiceEmailService invoiceEmailService;

    public InvoicePurchaseListener(PaymentService paymentService, InvoiceEmailService invoiceEmailService) {
        this.paymentService = paymentService;
        this.invoiceEmailService = invoiceEmailService;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onPaymentRecorded(PaymentRecordedEvent event) {
        try {
            var invoice = paymentService.getInvoiceInternal(event.paymentId());
            invoiceEmailService.sendInvoiceEmail(invoice);
        } catch (Exception e) {
            // Fire-and-forget by design - a failed auto-email must never surface to the
            // member or manager as a purchase failure. Logged so it's still visible.
            System.err.println("Failed to auto-email invoice for payment " + event.paymentId() + ": " + e.getMessage());
        }
    }
}