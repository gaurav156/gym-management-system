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
        User person;

        if (req.method() == CheckinMethod.QR) {
            person = userRepository.findByQrToken(req.qrToken())
                    .orElseThrow(() -> new IllegalArgumentException("Invalid QR code"));
        } else if (req.method() == CheckinMethod.PIN) {
            // In this simple version the kiosk supplies branchId + the 4-digit PIN;
            // in a real deployment you'd look up by a scanned member ID + PIN, but this
            // keeps the flow demoable without a card reader.
            person = userRepository.findAll().stream()
                    .filter(u -> req.pin() != null && req.pin().equals(u.getCheckinPin()))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Invalid PIN"));
        } else {
            throw new IllegalArgumentException("Unsupported check-in method for this endpoint yet");
        }

        if (!person.isActive()) {
            throw new IllegalArgumentException("This account is inactive");
        }

        Branch branch;

        if (person.getRole() == Role.TRAINER) {
            // Trainers are staff - just log attendance for monitoring, no membership to check.
            branch = req.branchId() != null
                    ? branchRepository.findById(req.branchId()).orElseThrow(() -> new IllegalArgumentException("Branch not found"))
                    : null;
            if (branch == null) {
                throw new IllegalArgumentException("branchId is required for staff check-in");
            }
        } else {
            LocalDate today = LocalDate.now();
            Membership usableMembership = membershipRepository
                    .findCurrentlyUsable(person.getId(), today)
                    .orElseGet(() -> {
                        var upcoming = membershipRepository.findFirstByMemberIdAndStatusAndStartDateAfterOrderByStartDateAsc(
                                person.getId(), MembershipStatus.ACTIVE, today);
                        if (upcoming.isPresent()) {
                            throw new IllegalArgumentException(
                                    "Membership not yet active - starts on " + upcoming.get().getStartDate());
                        }
                        throw new IllegalArgumentException("No active membership - access denied");
                    });
            branch = req.branchId() != null
                    ? branchRepository.findById(req.branchId()).orElseThrow(() -> new IllegalArgumentException("Branch not found"))
                    : usableMembership.getBranch();
        }

        Attendance attendance = Attendance.builder()
                .member(person)
                .branch(branch)
                .checkInTime(LocalDateTime.now())
                .method(req.method())
                .build();
        attendance = attendanceRepository.save(attendance);

        return new CheckinResponse(attendance.getId(), person.getName(), attendance.getCheckInTime(),
                "Welcome, " + person.getName() + "!");
    }

    // Powers the "which slot is crowded" view for MEMBERS only - staff check-ins shouldn't
    // skew what's meant to represent how busy the floor is for members.
    @Transactional(readOnly = true)
    public List<HourlyCount> hourlySummary(UUID branchId) {
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);

        List<Attendance> records = attendanceRepository
                .findByBranchIdAndCheckInTimeBetweenOrderByCheckInTimeDesc(branchId, startOfDay, endOfDay)
                .stream()
                .filter(a -> a.getMember().getRole() == Role.MEMBER)
                .toList();

        Map<Integer, Long> grouped = records.stream()
                .collect(Collectors.groupingBy(a -> a.getCheckInTime().getHour(), Collectors.counting()));

        return grouped.entrySet().stream()
                .map(e -> new HourlyCount(e.getKey(), e.getValue()))
                .sorted(Comparator.comparingInt(HourlyCount::hour))
                .toList();
    }

    // Full check-in history for one person (member or trainer) - powers the modal's
    // Attendance tab. checkOutTime will always be null for now - there's no check-out
    // action implemented yet.
    @Transactional(readOnly = true)
    public List<AttendanceLogEntry> historyFor(UUID personId) {
        return attendanceRepository.findByMemberIdOrderByCheckInTimeDesc(personId).stream()
                .map(a -> new AttendanceLogEntry(a.getId(), a.getCheckInTime(), a.getCheckOutTime(), a.getMethod().name()))
                .toList();
    }

    // Today's check-ins at a branch, members and trainers together - the frontend splits
    // this into two tabs by the role field rather than needing two separate calls.
    @Transactional(readOnly = true)
    public List<TodayAttendanceEntry> todayAttendance(UUID branchId) {
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);

        return attendanceRepository
                .findByBranchIdAndCheckInTimeBetweenOrderByCheckInTimeDesc(branchId, startOfDay, endOfDay)
                .stream()
                .map(a -> new TodayAttendanceEntry(
                        a.getMember().getId(), a.getMember().getName(), a.getMember().getRole().name(),
                        a.getCheckInTime(), a.getCheckOutTime(), a.getMethod().name()))
                .toList();
    }

    // Powers the "last visit" column on the Members table without an N+1 call per member.
    @Transactional(readOnly = true)
    public List<LastCheckinEntry> lastCheckins(UUID branchId) {
        return attendanceRepository.findLastCheckInPerMember(branchId).stream()
                .map(row -> new LastCheckinEntry((UUID) row[0], (LocalDateTime) row[1]))
                .toList();
    }
}