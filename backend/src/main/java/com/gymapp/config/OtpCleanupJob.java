package com.gymapp.config;

import com.gymapp.repository.ChangePasswordOtpRepository;
import com.gymapp.repository.OwnerPromotionOtpRepository;
import com.gymapp.repository.PasswordResetOtpRepository;
import com.gymapp.repository.RegistrationOtpRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

// Keeps the OTP tables from growing forever. A row is safe to delete once it's either been
// consumed or expired. Runs once a day; a stray leftover row for at most ~24h is harmless
// since every verify step already rejects expired OTPs on its own.
@Component
public class OtpCleanupJob {

    private final PasswordResetOtpRepository otpRepository;
    private final ChangePasswordOtpRepository changePasswordOtpRepository;
    private final RegistrationOtpRepository registrationOtpRepository;
    private final OwnerPromotionOtpRepository ownerPromotionOtpRepository;

    public OtpCleanupJob(PasswordResetOtpRepository otpRepository,
                         ChangePasswordOtpRepository changePasswordOtpRepository,
                         RegistrationOtpRepository registrationOtpRepository,
                         OwnerPromotionOtpRepository ownerPromotionOtpRepository) {
        this.otpRepository = otpRepository;
        this.changePasswordOtpRepository = changePasswordOtpRepository;
        this.registrationOtpRepository = registrationOtpRepository;
        this.ownerPromotionOtpRepository = ownerPromotionOtpRepository;
    }

    @Scheduled(cron = "0 0 3 * * *") // 3:00 AM server time, daily
    @Transactional
    public void cleanupExpiredOtps() {
        int deletedResets = otpRepository.deleteConsumedOrExpired(LocalDateTime.now());
        if (deletedResets > 0) {
            System.out.println("OtpCleanupJob: removed " + deletedResets + " consumed/expired password reset OTP row(s)");
        }
        int deletedChanges = changePasswordOtpRepository.deleteConsumedOrExpired(LocalDateTime.now());
        if (deletedChanges > 0) {
            System.out.println("OtpCleanupJob: removed " + deletedChanges + " consumed/expired change-password OTP row(s)");
        }
        int deletedRegistrations = registrationOtpRepository.deleteConsumedOrExpired(LocalDateTime.now());
        if (deletedRegistrations > 0) {
            System.out.println("OtpCleanupJob: removed " + deletedRegistrations + " consumed/expired registration OTP row(s)");
        }
        int deletedPromotions = ownerPromotionOtpRepository.deleteConsumedOrExpired(LocalDateTime.now());
        if (deletedPromotions > 0) {
            System.out.println("OtpCleanupJob: removed " + deletedPromotions + " consumed/expired owner-promotion OTP row(s)");
        }
    }
}