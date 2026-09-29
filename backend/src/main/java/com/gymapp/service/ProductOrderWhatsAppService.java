package com.gymapp.service;

import com.gymapp.dto.ProductOrderDtos.OrderInvoiceResponse;
import org.springframework.stereotype.Component;

// Not wired to a real provider yet - same story as InvoiceWhatsAppService for
// membership payments. Turning this on later is just replacing the method body with a
// call to whichever WhatsApp provider you pick, building a message from the same
// OrderInvoiceResponse fields ProductOrderInvoiceEmailService already uses.
@Component
public class ProductOrderWhatsAppService {

    public void sendInvoiceWhatsApp(OrderInvoiceResponse inv) {
        throw new IllegalArgumentException("WhatsApp delivery is not yet configured - please use Email for now");
    }
}