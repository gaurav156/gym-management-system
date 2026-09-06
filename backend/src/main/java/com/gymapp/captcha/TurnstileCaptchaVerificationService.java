package com.gymapp.captcha;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

// Cloudflare Turnstile - free, no usage caps at this project's scale, and the widget
// rarely shows an interactive challenge to real users (mostly a silent background
// check). Verification is one server-to-server POST - uses the JDK's built-in HttpClient
// and the ObjectMapper Spring Boot already provides, so no new dependency is needed.
//
// The default secret key below (1x0000...AA) is Cloudflare's published TEST secret: it
// always returns success, paired with the equally well-known test site key on the
// frontend. This lets the whole CAPTCHA flow be exercised locally with zero Cloudflare
// account setup. Replace both TURNSTILE_SECRET_KEY (backend) and VITE_TURNSTILE_SITE_KEY
// (frontend) with real keys from https://dash.cloudflare.com/?to=/:account/turnstile
// before this is exposed on the internet - the test keys provide no real protection.
@Component
public class TurnstileCaptchaVerificationService implements CaptchaVerificationService {

    private static final String VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ObjectMapper objectMapper;

    @Value("${app.captcha.turnstile.secret-key}")
    private String secretKey;

    public TurnstileCaptchaVerificationService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean verify(String token, String remoteIp) {
        if (token == null || token.isBlank()) {
            return false;
        }
        try {
            String form = "secret=" + URLEncoder.encode(secretKey, StandardCharsets.UTF_8)
                    + "&response=" + URLEncoder.encode(token, StandardCharsets.UTF_8)
                    + "&remoteip=" + URLEncoder.encode(remoteIp, StandardCharsets.UTF_8);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(VERIFY_URL))
                    .timeout(Duration.ofSeconds(5))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(form))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode json = objectMapper.readTree(response.body());
            return json.path("success").asBoolean(false);
        } catch (Exception e) {
            // Fail closed - a network hiccup or malformed response should never be treated
            // as "captcha passed". Logged so a persistent failure (e.g. outbound network
            // blocked, wrong secret key) is diagnosable rather than silently rejecting
            // everyone forever.
            System.err.println("Turnstile verification failed: " + e.getMessage());
            return false;
        }
    }
}