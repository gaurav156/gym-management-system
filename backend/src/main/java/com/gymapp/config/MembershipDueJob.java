package com.gymapp.config;

import com.gymapp.entity.Membership;
import com.gymapp.entity.MembershipStatus;
import com.gymapp.entity.PausedReason;
import com.gymapp.entity.PaymentStatus;
import com.gymapp.repository.MembershipRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

// Auto-pauses any ACTIVE membership that's still PARTIAL once its balanceDueDate has
// passed - same effect as a manual pause (gym access denied, since
// AttendanceService.checkin()'s membership lookup only ever finds ACTIVE rows), tagged
// PausedReason.NONPAYMENT so MembershipService.recordAdditionalPayment() knows it's safe
// to auto-resume once the balance clears, without touching a genuinely manual pause.
@Component
public class MembershipDueJob {

    private static final Logger log = LoggerFactory.getLogger(MembershipDueJob.class);

    private final MembershipRepository membershipRepository;

    public MembershipDueJob(MembershipRepository membershipRepository) {
        this.membershipRepository = membershipRepository;
    }

    @Scheduled(cron = "0 30 2 * * *") // 2:30 AM server time, daily - ahead of OtpCleanupJob's 3:00 AM
    @Transactional
    public void pauseOverdueMemberships() {
        LocalDate today = LocalDate.now();
        List<Membership> overdue = membershipRepository.findByStatusAndPaymentStatusAndBalanceDueDateBefore(
                MembershipStatus.ACTIVE, PaymentStatus.PARTIAL, today);
        if (overdue.isEmpty()) return;

        for (Membership m : overdue) {
            m.setStatus(MembershipStatus.PAUSED);
            m.setPausedAt(today);
            m.setPausedReason(PausedReason.NONPAYMENT);
        }
        membershipRepository.saveAll(overdue);
        log.info("MembershipDueJob: auto-paused {} membership(s) for an overdue balance", overdue.size());
    }
}