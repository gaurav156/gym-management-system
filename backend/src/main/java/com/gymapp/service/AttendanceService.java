package com.gymapp.service;

import com.gymapp.dto.AttendanceDtos.*;
import com.gymapp.entity.*;
import com.gymapp.repository.AttendanceRepository;
import com.gymapp.repository.BranchRepository;
import com.gymapp.repository.MembershipRepository;
import com.gymapp.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AttendanceService {

    private final AttendanceRepository attendanceRepository;
    private final UserRepository userRepository;
    private final BranchRepository branchRepository;
    private final MembershipRepository membershipRepository;

    public AttendanceService(AttendanceRepository attendanceRepository,
                              UserRepository userRepository,
                              BranchRepository branchRepository,
                              MembershipRepository membershipRepository) {
        this.attendanceRepository = attendanceRepository;
        this.userRepository = userRepository;
        this.branchRepository = branchRepository;
        this.membershipRepository = membershipRepository;
    }

    @Transactional
    public CheckinResponse checkin(CheckinRequest req) {
        User member;

        if (req.method() == CheckinMethod.QR) {
            member = userRepository.findByQrToken(req.qrToken())
                    .orElseThrow(() -> new IllegalArgumentException("Invalid QR code"));
        } else if (req.method() == CheckinMethod.PIN) {
            // In this simple version the kiosk supplies branchId + the 4-digit PIN;
            // in a real deployment you'd look up by a scanned member ID + PIN, but this
            // keeps the flow demoable without a card reader.
            member = userRepository.findAll().stream()
                    .filter(u -> req.pin() != null && req.pin().equals(u.getCheckinPin()))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Invalid PIN"));
        } else {
            throw new IllegalArgumentException("Unsupported check-in method for this endpoint yet");
        }

        if (!member.isActive()) {
            throw new IllegalArgumentException("This member account is inactive");
        }

        Membership activeMembership = membershipRepository
                .findFirstByMemberIdAndStatusOrderByEndDateDesc(member.getId(), MembershipStatus.ACTIVE)
                .orElseThrow(() -> new IllegalArgumentException("No active membership - access denied"));

        if (activeMembership.getEndDate().isBefore(LocalDate.now())) {
            activeMembership.setStatus(MembershipStatus.EXPIRED);
            membershipRepository.save(activeMembership);
            throw new IllegalArgumentException("Membership has expired - access denied");
        }

        Branch branch = req.branchId() != null
                ? branchRepository.findById(req.branchId()).orElseThrow(() -> new IllegalArgumentException("Branch not found"))
                : activeMembership.getBranch();

        Attendance attendance = Attendance.builder()
                .member(member)
                .branch(branch)
                .checkInTime(LocalDateTime.now())
                .method(req.method())
                .build();
        attendance = attendanceRepository.save(attendance);

        return new CheckinResponse(attendance.getId(), member.getName(), attendance.getCheckInTime(),
                "Welcome, " + member.getName() + "!");
    }

    // Powers the "which slot is crowded" view - counts check-ins per hour for a branch, today
    public List<HourlyCount> hourlySummary(UUID branchId) {
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);

        List<Attendance> records = attendanceRepository.findByBranchIdAndCheckInTimeBetween(branchId, startOfDay, endOfDay);

        Map<Integer, Long> grouped = records.stream()
                .collect(Collectors.groupingBy(a -> a.getCheckInTime().getHour(), Collectors.counting()));

        return grouped.entrySet().stream()
                .map(e -> new HourlyCount(e.getKey(), e.getValue()))
                .sorted(Comparator.comparingInt(HourlyCount::hour))
                .toList();
    }
}
