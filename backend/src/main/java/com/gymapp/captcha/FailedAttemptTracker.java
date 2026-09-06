package com.gymapp.captcha;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// Tracks recent attempts per key (client IP, currently) to decide when a CAPTCHA should
// be demanded - fully in-memory, no DB table, since this is a lightweight/ephemeral
// signal (losing it on a restart just means everyone's counter resets to zero, which is
// harmless). NOTE: this only works correctly on a single backend instance - if the app
// is later scaled to multiple instances behind a load balancer, this map should move to
// something shared (e.g. Redis) so an attacker can't dodge the limit by landing on a
// different instance each request. Not a concern at this project's current scale.
@Component
public class FailedAttemptTracker {

    @Value("${app.captcha.enabled}")
    private boolean enabled;

    @Value("${app.captcha.max-attempts}")
    private int maxAttempts;

    @Value("${app.captcha.window-minutes}")
    private long windowMinutes;

    private record Attempt(int count, Instant windowStart) {}

    private final Map<String, Attempt> attempts = new ConcurrentHashMap<>();

    public boolean isCaptchaRequired(String key) {
        if (!enabled) return false;
        Attempt a = attempts.get(key);
        if (a == null || isExpired(a)) return false;
        return a.count() >= maxAttempts;
    }

    // Called on every relevant attempt for volumetric endpoints (e.g. OTP request, where
    // "success" doesn't mean legitimate - the response is deliberately generic regardless
    // of whether the account exists), or on failure only for endpoints where a genuine
    // user's eventual success should clear their count (see reset()).
    public void increment(String key) {
        Instant now = Instant.now();
        attempts.compute(key, (k, existing) -> {
            if (existing == null || isExpired(existing)) {
                return new Attempt(1, now);
            }
            return new Attempt(existing.count() + 1, existing.windowStart());
        });
    }

    // Clears a key entirely - used after a genuine successful login/registration so a
    // legitimate user who mistyped their password a couple of times isn't left carrying
    // an elevated count indefinitely.
    public void reset(String key) {
        attempts.remove(key);
    }

    private boolean isExpired(Attempt a) {
        return a.windowStart().isBefore(Instant.now().minus(windowMinutes, ChronoUnit.MINUTES));
    }

    // Prevents the map from growing forever from one-off/expired entries. Runs hourly -
    // cheap, and correctness never depends on this having run recently (isCaptchaRequired
    // already treats an expired entry as "no captcha needed" on its own).
    @Scheduled(cron = "0 0 * * * *")
    public void cleanupExpired() {
        attempts.entrySet().removeIf(e -> isExpired(e.getValue()));
    }
}