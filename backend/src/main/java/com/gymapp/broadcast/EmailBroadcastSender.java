package com.gymapp.broadcast;

import com.gymapp.entity.BroadcastChannel;
import com.gymapp.entity.BroadcastType;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeUtility;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class EmailBroadcastSender implements BroadcastChannelSender {

    private final JavaMailSender mailSender;
    private final BroadcastEmailRenderer renderer;
    private final UnsubscribeTokenService tokens;

    @Value("${app.mail.from}")
    private String fromAddress;

    @Value("${app.mail.gym-name}")
    private String gymName;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    public EmailBroadcastSender(JavaMailSender mailSender, BroadcastEmailRenderer renderer, UnsubscribeTokenService tokens) {
        this.mailSender = mailSender;
        this.renderer = renderer;
        this.tokens = tokens;
    }

    @Override
    public BroadcastChannel channel() {
        return BroadcastChannel.EMAIL;
    }

    @Override
    public void send(BroadcastDelivery d) {
        try {
            BroadcastMessage m = d.message();

            String unsubscribeUrl = null;
            if (m.type() == BroadcastType.PROMOTIONAL) {
                // A promotional email without a working unsubscribe link must never go out.
                if (d.userId() == null) throw new IllegalStateException("Recipient account no longer exists");
                unsubscribeUrl = unsubscribeUrl(d.userId());
            }

            BroadcastEmailRenderer.Rendered r = renderer.render(m, d.recipientName(), unsubscribeUrl);

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(d.destination());
            helper.setSubject(gymName + " - " + m.subject());
            helper.setText(r.text(), r.html());
            for (BroadcastMessage.Attachment a : m.attachments()) {
                helper.addAttachment(MimeUtility.encodeText(a.filename()), new ByteArrayResource(a.data()), a.contentType());
            }
            // Lets Gmail/Outlook show their own "Unsubscribe" control next to the sender.
            if (unsubscribeUrl != null) message.addHeader("List-Unsubscribe", "<" + unsubscribeUrl + ">");

            mailSender.send(message);
        } catch (Exception e) {
            throw new RuntimeException("Failed to build/send broadcast email", e);
        }
    }

    private String unsubscribeUrl(UUID userId) {
        return frontendUrl.replaceAll("/$", "") + "/unsubscribe?token=" + tokens.generate(userId);
    }
}