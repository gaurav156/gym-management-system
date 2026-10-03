package com.gymapp.broadcast;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

// Stateless, unforgeable unsubscribe tokens: base64url(userId) + "." + base64url(HMAC(userId)).
// Keyed from the JWT secret with a domain-separation prefix, so a token can never double as
// anything else. No table needed; the token never expires, since an unsubscribe link in an old
// email must keep working.
@Component
public class UnsubscribeTokenService {

    private static final String DOMAIN = "unsubscribe:";

    @Value("${app.jwt.secret}")
    private String secret;

    public String generate(UUID userId) {
        String id = userId.toString();
        return b64(id.getBytes(StandardCharsets.UTF_8)) + "." + b64(hmac(id));
    }

    public Optional<UUID> verify(String token) {
        try {
            if (token == null) return Optional.empty();
            String[] parts = token.split("\\.");
            if (parts.length != 2) return Optional.empty();
            String id = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
            byte[] given = Base64.getUrlDecoder().decode(parts[1]);
            if (!MessageDigest.isEqual(hmac(id), given)) return Optional.empty();
            return Optional.of(UUID.fromString(id));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private byte[] hmac(String id) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return mac.doFinal((DOMAIN + id).getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("HMAC unavailable", e);
        }
    }

    private String b64(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}