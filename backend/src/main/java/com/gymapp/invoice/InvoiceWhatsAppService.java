package com.gymapp.invoice;

import com.gymapp.dto.PaymentDtos.InvoiceResponse;
import org.springframework.stereotype.Component;

// Not wired to a real provider yet - same story as WhatsAppOtpDeliveryService. Turning
// this on later is just replacing the method body with a call to whichever WhatsApp
// provider you pick (Meta Cloud API, Twilio, etc.), building a message from the same
// InvoiceResponse fields InvoiceEmailService already uses.
@Component
public class InvoiceWhatsAppService {

    public void sendInvoiceWhatsApp(InvoiceResponse inv) {
        throw new IllegalArgumentException("WhatsApp delivery is not yet configured - please use Email for now");
    }
}