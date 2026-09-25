package com.gymapp.service;

import com.gymapp.dto.ProductOrderDtos.OrderInvoiceResponse;
import com.gymapp.dto.ProductOrderDtos.OrderItemResponse;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

// Mirrors InvoiceEmailService for membership payments - same inline-styled table layout
// and SMTP relay, an item table instead of a single plan row.
@Component
public class ProductOrderInvoiceEmailService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.from}")
    private String fromAddress;

    @Value("${app.mail.gym-name}")
    private String gymName;

    @Value("${app.mail.logo-url:}")
    private String logoUrl;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    public ProductOrderInvoiceEmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendInvoiceEmail(OrderInvoiceResponse inv) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(inv.memberEmail());
            helper.setSubject(gymName + " - Order " + inv.invoiceNumber());
            helper.setText(buildPlainText(inv), buildHtml(inv));
            mailSender.send(message);
        } catch (Exception e) {
            throw new RuntimeException("Failed to build/send product order invoice email", e);
        }
    }

    private String invoiceUrl(OrderInvoiceResponse inv) {
        return frontendUrl.replaceAll("/$", "") + "/product-invoice/" + inv.orderId();
    }

    private String buildPlainText(OrderInvoiceResponse inv) {
        StringBuilder sb = new StringBuilder();
        sb.append("Hi ").append(inv.memberName()).append(",\n\n")
                .append("Thanks for your purchase at ").append(inv.branchName()).append(".\n\n")
                .append("Order: ").append(inv.invoiceNumber()).append("\n");
        for (OrderItemResponse item : inv.items()) {
            sb.append("  - ").append(item.productName()).append(" x").append(item.quantity())
                    .append(" = Rs. ").append(item.lineTotal()).append("\n");
        }
        sb.append("Total: Rs. ").append(inv.totalAmount()).append("\n")
                .append("Mode: ").append(inv.mode().replace("_", " ")).append("\n")
                .append("\nView or download your invoice here: ").append(invoiceUrl(inv)).append("\n");
        return sb.toString();
    }

    private String buildHtml(OrderInvoiceResponse inv) {
        String safeName = HtmlUtils.htmlEscape(inv.memberName());
        String safeGymName = HtmlUtils.htmlEscape(gymName);
        String safeBranch = HtmlUtils.htmlEscape(inv.branchName());
        String url = invoiceUrl(inv);

        String logoHtml = (logoUrl != null && !logoUrl.isBlank())
                ? "<img src=\"" + HtmlUtils.htmlEscape(logoUrl) + "\" alt=\"" + safeGymName + "\" "
                + "width=\"48\" height=\"48\" style=\"display:block;border-radius:10px;margin:0 auto 12px;\" />"
                : "";

        StringBuilder itemRows = new StringBuilder();
        for (OrderItemResponse item : inv.items()) {
            itemRows.append(row(HtmlUtils.htmlEscape(item.productName()) + " x" + item.quantity(), "Rs. " + item.lineTotal()));
        }

        return "<!DOCTYPE html>"
                + "<html><body style=\"margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f5;padding:32px 16px;\">"
                + "<tr><td align=\"center\">"
                + "<table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" "
                +   "style=\"max-width:480px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);\">"
                + "<tr><td style=\"background-color:#111827;padding:28px 32px;text-align:center;\">"
                + logoHtml
                + "<div style=\"color:#ffffff;font-size:18px;font-weight:600;letter-spacing:-0.01em;\">" + safeGymName + "</div>"
                + "</td></tr>"
                + "<tr><td style=\"padding:32px;\">"
                + "<p style=\"margin:0 0 4px;font-size:15px;color:#111827;\">Hi " + safeName + ",</p>"
                + "<p style=\"margin:0 0 24px;font-size:15px;line-height:1.5;color:#4b5563;\">"
                +   "Thanks for your purchase at " + safeBranch + ". Here's your order summary:"
                + "</p>"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" "
                +   "style=\"background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;\">"
                + row("Order #", inv.invoiceNumber())
                + itemRows
                + row("Total", "Rs. " + inv.totalAmount())
                + row("Mode", HtmlUtils.htmlEscape(inv.mode().replace("_", " ")))
                + "</table>"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-top:24px;\">"
                + "<tr><td align=\"center\">"
                + "<a href=\"" + url + "\" "
                +   "style=\"display:inline-block;background-color:#e11d48;color:#ffffff;text-decoration:none;"
                +   "font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;\">"
                +   "View / Download Invoice"
                + "</a>"
                + "</td></tr>"
                + "</table>"
                + "<p style=\"margin:24px 0 0;font-size:13px;line-height:1.5;color:#9ca3af;\">"
                +   "You can also view this any time from your Store tab under Your purchases."
                + "</p>"
                + "</td></tr>"
                + "<tr><td style=\"padding:20px 32px;border-top:1px solid #f3f4f6;text-align:center;\">"
                + "<p style=\"margin:0;font-size:12px;color:#9ca3af;\">This is an automated message from " + safeGymName + ". Please don't reply to this email.</p>"
                + "</td></tr>"
                + "</table>"
                + "</td></tr>"
                + "</table>"
                + "</body></html>";
    }

    private String row(String label, String value) {
        return "<tr>"
                + "<td style=\"padding:12px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #eef0f2;\">" + label + "</td>"
                + "<td style=\"padding:12px 16px;font-size:13px;color:#111827;font-weight:600;text-align:right;border-bottom:1px solid #eef0f2;\">" + value + "</td>"
                + "</tr>";
    }
}