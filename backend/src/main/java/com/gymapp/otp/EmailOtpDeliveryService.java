package com.gymapp.otp;

import com.gymapp.entity.OtpChannel;
import com.gymapp.entity.User;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

// Free channel - works with any SMTP relay, including Gmail's free SMTP (smtp.gmail.com,
// port 587, with an "app password" as SMTP_PASSWORD - see
// https://myaccount.google.com/apppasswords), which comfortably covers a single gym's OTP
// volume at zero cost. Swap SMTP_HOST/PORT/USERNAME/PASSWORD in .env for a different
// provider (SendGrid, Brevo, Mailgun, etc.) without touching this class.
//
// Sends HTML with a plain-text fallback (MimeMessageHelper multipart) rather than
// SimpleMailMessage - modern OTP emails from established senders are HTML with a
// visually distinct code box, and some corporate mail filters flag plain-text-only
// transactional email as more spam-like than a well-formed multipart message.
@Component
public class EmailOtpDeliveryService implements OtpDeliveryService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.from}")
    private String fromAddress;

    @Value("${app.mail.gym-name}")
    private String gymName;

    // Optional - blank is a valid, expected configuration (falls back to a text-only
    // header), not a misconfiguration, so this is never validated as required.
    @Value("${app.mail.logo-url:}")
    private String logoUrl;

    @Value("${app.otp.expiry-minutes}")
    private int expiryMinutes;

    public EmailOtpDeliveryService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @Override
    public OtpChannel channel() {
        return OtpChannel.EMAIL;
    }

    @Override
    public void send(User user, String destination, String otp) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            // multipart=true is required for setText(plain, html) to attach both parts -
            // without it, only the last setText call wins.
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(destination);
            helper.setSubject("Your " + gymName + " verification code");
            helper.setText(buildPlainText(user, otp), buildHtml(user, otp));
            mailSender.send(message);
        } catch (Exception e) {
            // Caller (PasswordResetService) deliberately swallows this and logs it -
            // delivery failure must never change what the HTTP caller sees.
            throw new RuntimeException("Failed to build/send OTP email", e);
        }
    }

    private String buildPlainText(User user, String otp) {
        return "Hi " + user.getName() + ",\n\n"
                + "Your " + gymName + " verification code is: " + otp + "\n"
                + "This code expires in " + expiryMinutes + " minutes and can only be used once.\n\n"
                + "If you didn't request this, you can safely ignore this email.\n";
    }

    // All CSS is inline (style="...") rather than in a <style> block - most email clients
    // (Gmail, Outlook, Apple Mail) strip <style> tags or ignore external stylesheets, so
    // inline styles are the only reliable way to control appearance across clients. Table-
    // based layout for the same reason: flexbox/grid support is inconsistent in email
    // clients, tables are not.
    private String buildHtml(User user, String otp) {
        String safeName = HtmlUtils.htmlEscape(user.getName());
        String safeGymName = HtmlUtils.htmlEscape(gymName);
        String otpSpaced = String.join(" ", otp.split(""));

        String logoHtml = (logoUrl != null && !logoUrl.isBlank())
                ? "<img src=\"" + HtmlUtils.htmlEscape(logoUrl) + "\" alt=\"" + safeGymName + "\" "
                + "width=\"48\" height=\"48\" "
                + "style=\"display:block;border-radius:10px;margin:0 auto 12px;\" />"
                : "";

        return "<!DOCTYPE html>"
                + "<html><body style=\"margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:#f4f4f5;padding:32px 16px;\">"
                + "<tr><td align=\"center\">"
                + "<table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" "
                +   "style=\"max-width:480px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);\">"

                // Header
                + "<tr><td style=\"background-color:#111827;padding:28px 32px;text-align:center;\">"
                + logoHtml
                + "<div style=\"color:#ffffff;font-size:18px;font-weight:600;letter-spacing:-0.01em;\">" + safeGymName + "</div>"
                + "</td></tr>"

                // Body
                + "<tr><td style=\"padding:32px;\">"
                + "<p style=\"margin:0 0 4px;font-size:15px;color:#111827;\">Hi " + safeName + ",</p>"
                + "<p style=\"margin:0 0 24px;font-size:15px;line-height:1.5;color:#4b5563;\">"
                +   "Use the code below to reset your password. This code is valid for "
                +   expiryMinutes + " minutes and can only be used once."
                + "</p>"

                // OTP box
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">"
                + "<tr><td align=\"center\" style=\"background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px 16px;\">"
                + "<div style=\"font-size:32px;font-weight:700;letter-spacing:8px;color:#e11d48;font-family:'SF Mono',Consolas,Menlo,monospace;\">"
                +   otpSpaced
                + "</div>"
                + "</td></tr>"
                + "</table>"

                + "<p style=\"margin:24px 0 0;font-size:13px;line-height:1.5;color:#9ca3af;\">"
                +   "Didn't request this? You can safely ignore this email - your password won't be changed."
                + "</p>"
                + "</td></tr>"

                // Footer
                + "<tr><td style=\"padding:20px 32px;border-top:1px solid #f3f4f6;text-align:center;\">"
                + "<p style=\"margin:0;font-size:12px;color:#9ca3af;\">This is an automated message from " + safeGymName + ". Please don't reply to this email.</p>"
                + "</td></tr>"

                + "</table>"
                + "</td></tr>"
                + "</table>"
                + "</body></html>";
    }
}