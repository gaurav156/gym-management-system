package com.gymapp.invoice;

import com.gymapp.service.ProductOrderService;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

// Mirrors InvoicePurchaseListener - fires after the purchase transaction commits, off-
// thread, so a slow/failing mail server never delays or fails the purchase response.
@Component
public class ProductOrderInvoiceListener {

    private final ProductOrderService productOrderService;

    public ProductOrderInvoiceListener(ProductOrderService productOrderService) {
        this.productOrderService = productOrderService;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onProductOrderRecorded(ProductOrderRecordedEvent event) {
        try {
            productOrderService.sendInvoiceEmail(event.orderId());
        } catch (Exception e) {
            System.err.println("Failed to auto-email product order invoice " + event.orderId() + ": " + e.getMessage());
        }
    }
}