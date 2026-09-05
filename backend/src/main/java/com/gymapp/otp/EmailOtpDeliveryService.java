package com.gymapp.otp;

import com.gymapp.entity.OtpChannel;
import com.gymapp.entity.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

// Free channel - works with any SMTP relay, including Gmail's free SMTP (smtp.gmail.com,
// port 587, with an "app password" as SMTP_PASSWORD - see
// https://myaccount.google.com/apppasswords), which comfortably covers a single gym's OTP
// volume at zero cost. Swap SMTP_HOST/PORT/USERNAME/PASSWORD in .env for a different
// provider (SendGrid, Brevo, Mailgun, etc.) without touching this class.
@Component
public class EmailOtpDeliveryService implements OtpDeliveryService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.from}")
    private String fromAddress;

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
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(destination);
        message.setSubject("Your password reset code");
        message.setText(
                "Hi " + user.getName() + ",\n\n"
                        + "Your one-time password reset code is: " + otp + "\n"
                        + "This code expires in " + expiryMinutes + " minutes and can only be used once.\n\n"
                        + "If you didn't request this, you can safely ignore this email.\n"
        );
        mailSender.send(message);
    }
}