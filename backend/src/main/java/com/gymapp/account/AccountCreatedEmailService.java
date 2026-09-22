package com.gymapp.account;

import com.gymapp.entity.Role;
import com.gymapp.entity.User;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

// Mirrors InvoiceEmailService's approach (inline-styled table-based HTML + plain text
// fallback, same SMTP relay). Sent once, right after an account is created - whether the
// Owner created it directly (AuthService.createAccount) or the person self-registered
// (AuthService.registerMember). The PIN is otherwise only ever shown at reception (see
// MemberDashboard's comment on why it isn't displayed in the UI), so this email is the one
// place a self-registered member can actually learn it without a front-desk visit.
@Component
public class AccountCreatedEmailService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.from}")
    private String fromAddress;

    @Value("${app.mail.gym-name}")
    private String gymName;

    @Value("${app.mail.logo-url:}")
    private String logoUrl;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    public AccountCreatedEmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    // Throws on failure so the caller (AccountCreatedListener) can log it - never anything
    // the account-creation request itself waits on or fails because of.
    public void sendAccountCreatedEmail(User user) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(user.getEmail());
            helper.setSubject("Welcome to " + gymName + " - your check-in PIN");
            helper.setText(buildPlainText(user), buildHtml(user));
            mailSender.send(message);
        } catch (Exception e) {
            throw new RuntimeException("Failed to build/send account-created email", e);
        }
    }

    private String loginUrl() {
        return frontendUrl.replaceAll("/$", "") + "/login";
    }

    // Only a MEMBER's check-in is gated on having an active plan - Owner/Manager/Trainer
    // check-in is pure attendance tracking (see AttendanceService.checkin), so their PIN
    // works from the moment the account exists.
    private String accessNote(User user) {
        return user.getRole() == Role.MEMBER
                ? "You'll be able to check in with this PIN once an active membership plan is on your account - visit the front desk to get one set up."
                : "You can check in with this PIN right away.";
    }

    private String buildPlainText(User user) {
        return "Hi " + user.getName() + ",\n\n"
                + "Your " + gymName + " account has been created.\n\n"
                + "Check-in PIN: " + user.getCheckinPin() + "\n\n"
                + accessNote(user) + "\n"
                + "A QR code you can scan instead is also available on your dashboard.\n\n"
                + "Log in here: " + loginUrl() + "\n";
    }

    private String buildHtml(User user) {
        String safeName = HtmlUtils.htmlEscape(user.getName());
        String safeGymName = HtmlUtils.htmlEscape(gymName);
        String safeNote = HtmlUtils.htmlEscape(accessNote(user));
        String url = loginUrl();

        String logoHtml = (logoUrl != null && !logoUrl.isBlank())
                ? "<img src=\"" + HtmlUtils.htmlEscape(logoUrl) + "\" alt=\"" + safeGymName + "\" "
                + "width=\"48\" height=\"48\" style=\"display:block;border-radius:10px;margin:0 auto 12px;\" />"
                : "";

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
                +   "Your account has been created. Here's your check-in PIN:"
                + "</p>"

                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">"
                + "<tr><td align=\"center\" style=\"background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px 12px;\">"
                + "<div style=\"font-size:28px;font-weight:700;letter-spacing:6px;color:#e11d48;"
                +   "font-family:'SF Mono',Consolas,Menlo,monospace;white-space:nowrap;"
                +   "-webkit-text-size-adjust:100%;text-size-adjust:100%;\">"
                +   user.getCheckinPin()
                + "</div>"
                + "</td></tr>"
                + "</table>"

                + "<p style=\"margin:16px 0 0;font-size:13px;line-height:1.5;color:#6b7280;\">" + safeNote + "</p>"
                + "<p style=\"margin:8px 0 0;font-size:13px;line-height:1.5;color:#9ca3af;\">"
                +   "A QR code you can scan instead is also available on your dashboard."
                + "</p>"

                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin-top:24px;\">"
                + "<tr><td align=\"center\">"
                + "<a href=\"" + url + "\" "
                +   "style=\"display:inline-block;background-color:#e11d48;color:#ffffff;text-decoration:none;"
                +   "font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;\">"
                +   "Log in"
                + "</a>"
                + "</td></tr>"
                + "</table>"
                + "</td></tr>"

                + "<tr><td style=\"padding:20px 32px;border-top:1px solid #f3f4f6;text-align:center;\">"
                + "<p style=\"margin:0;font-size:12px;color:#9ca3af;\">This is an automated message from " + safeGymName + ". Please don't reply to this email.</p>"
                + "</td></tr>"

                + "</table>"
                + "</td></tr>"
                + "</table>"
                + "</body></html>";
    }
}