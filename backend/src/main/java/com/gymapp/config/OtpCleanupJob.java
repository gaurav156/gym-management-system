package com.gymapp.config;

import com.gymapp.repository.PasswordResetOtpRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

// Keeps password_reset_otp from growing forever. A row is safe to delete once it's
// either been consumed (successfully used - no longer needed for anything) or expired
// (can never be verified again regardless of consumed state) - see
// PasswordResetOtpRepository.deleteConsumedOrExpired(). Runs once a day; OTP volume for a
// single gym is low enough that this never needs to be more frequent, and a stray
// leftover row for at most ~24h is harmless (PasswordResetService already rejects
// expired OTPs on verify regardless of whether this job has run yet).
@Component
public class OtpCleanupJob {

    private final PasswordResetOtpRepository otpRepository;

    public OtpCleanupJob(PasswordResetOtpRepository otpRepository) {
        this.otpRepository = otpRepository;
    }

    @Scheduled(cron = "0 0 3 * * *") // 3:00 AM server time, daily
    @Transactional
    public void cleanupExpiredOtps() {
        int deleted = otpRepository.deleteConsumedOrExpired(LocalDateTime.now());
        if (deleted > 0) {
            System.out.println("OtpCleanupJob: removed " + deleted + " consumed/expired password reset OTP row(s)");
        }
    }
}