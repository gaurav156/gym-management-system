package com.gymapp.service;

import com.gymapp.dto.AttendanceDtos.*;
import com.gymapp.entity.*;
import com.gymapp.repository.AttendanceRepository;
import com.gymapp.repository.BranchAssignmentRepository;
import com.gymapp.repository.BranchRepository;
import com.gymapp.repository.MembershipRepository;
import com.gymapp.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class AttendanceService {

    private final AttendanceRepository attendanceRepository;
    private final UserRepository userRepository;
    private final BranchRepository branchRepository;
    private final MembershipRepository membershipRepository;
    private final BranchAssignmentRepository branchAssignmentRepository;

    public AttendanceService(AttendanceRepository attendanceRepository,
                             UserRepository userRepository,
                             BranchRepository branchRepository,
                             MembershipRepository membershipRepository,
                             BranchAssignmentRepository branchAssignmentRepository) {
        this.attendanceRepository = attendanceRepository;
        this.userRepository = userRepository;
        this.branchRepository = branchRepository;
        this.membershipRepository = membershipRepository;
        this.branchAssignmentRepository = branchAssignmentRepository;
    }

    @Transactional
    public CheckinResponse checkin(CheckinRequest req) {
        User person;

        if (req.method() == CheckinMethod.QR) {
            // The QR code rendered on the Member/Trainer dashboard encodes their raw
            // userId (see QRCodeSVG value={user.userId}), not the separate qrToken
            // column - so this looks the person up by ID, not by qrToken. qrToken stays
            // on the User entity for now but is unused by this flow.
            UUID scannedId;
            try {
                scannedId = UUID.fromString(req.qrToken());
            } catch (Exception e) {
                throw new IllegalArgumentException("Invalid QR code");
            }
            person = userRepository.findById(scannedId)
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

        if (req.branchId() == null) {
            throw new IllegalArgumentException("branchId is required");
        }
        Branch branch = branchRepository.findById(req.branchId())
                .orElseThrow(() -> new IllegalArgumentException("Branch not found"));

        // Applies to members and trainers alike - you can only check in at a branch
        // you're actually assigned to, regardless of membership status or role.
        boolean assignedToBranch = branchAssignmentRepository
                .findByUserIdAndBranchId(person.getId(), branch.getId())
                .isPresent();
        if (!assignedToBranch) {
            throw new IllegalArgumentException(person.getName() + " is not assigned to " + branch.getName());
        }

        if (person.getRole() != Role.TRAINER) {
            LocalDate today = LocalDate.now();
            membershipRepository.findCurrentlyUsable(person.getId(), today)
                    .orElseGet(() -> {
                        var upcoming = membershipRepository.findFirstByMemberIdAndStatusAndStartDateAfterOrderByStartDateAsc(
                                person.getId(), MembershipStatus.ACTIVE, today);
                        if (upcoming.isPresent()) {
                            throw new IllegalArgumentException(
                                    "Membership not yet active - starts on " + upcoming.get().getStartDate());
                        }
                        throw new IllegalArgumentException("No active membership - access denied");
                    });
        }

        // First scan of the day at this branch = check-in (new record). Any subsequent
        // scan that same day at the same branch updates checkOutTime on that SAME record
        // (overwritten each time), so what's stored is always first-check-in/last-checkout
        // for that person, branch, and day - not a new row per scan.
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);

        List<Attendance> todayRecords = attendanceRepository
                .findTodayRecordsForPersonAndBranch(person.getId(), branch.getId(), startOfDay, endOfDay);

        Attendance attendance;
        String action;
        String message;

        if (todayRecords.isEmpty()) {
            attendance = Attendance.builder()
                    .member(person)
                    .branch(branch)
                    .checkInTime(now)
                    .method(req.method())
                    .build();
            action = "CHECK_IN";
            message = "Welcome, " + person.getName() + "!";
        } else {
            attendance = todayRecords.get(0);
            attendance.setCheckOutTime(now);
            action = "CHECK_OUT";
            message = "Goodbye, " + person.getName() + " - see you next time!";
        }
        attendance = attendanceRepository.save(attendance);

        return new CheckinResponse(attendance.getId(), person.getName(), attendance.getCheckInTime(),
                attendance.getCheckOutTime(), action, message);
    }

    // Powers the "busy hours" chart for MEMBERS only - staff check-ins shouldn't skew
    // what's meant to represent how busy the floor is for members. Unlike a simple
    // "how many people checked in during hour X" count, this reflects actual OCCUPANCY:
    // a member who checked in at 9:15 and checked out at 11:20 is counted as present
    // during the 9, 10, AND 11 o'clock buckets, not just the 9 o'clock one they scanned
    // in during - this is what makes the chart behave like Google Maps' popular-times
    // graph rather than a raw check-in histogram. A member still checked in (no
    // check-out yet) is counted as present from their check-in hour through the current
    // hour, since they're presumably still on the floor. Always returns all 24 hours
    // (zero-filled) so the frontend never has to guess which hours are missing.
    @Transactional(readOnly = true)
    public List<HourlyCount> hourlySummary(UUID branchId) {
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);
        LocalDateTime now = LocalDateTime.now();
        int currentHour = now.getHour();

        List<Attendance> records = attendanceRepository
                .findByBranchIdAndCheckInTimeBetweenOrderByCheckInTimeDesc(branchId, startOfDay, endOfDay)
                .stream()
                .filter(a -> a.getMember().getRole() == Role.MEMBER)
                .toList();

        int[] occupancy = new int[24];
        for (Attendance a : records) {
            int startHour = a.getCheckInTime().getHour();
            int endHour = a.getCheckOutTime() != null
                    ? a.getCheckOutTime().getHour()
                    : currentHour; // still checked in - counted as present up through now
            if (endHour < startHour) endHour = startHour; // defensive, shouldn't happen same-day
            if (endHour > 23) endHour = 23;
            for (int h = startHour; h <= endHour; h++) {
                occupancy[h]++;
            }
        }

        List<HourlyCount> result = new ArrayList<>(24);
        for (int h = 0; h < 24; h++) {
            result.add(new HourlyCount(h, occupancy[h]));
        }
        return result;
    }

    // Full check-in history for one person (member or trainer) - powers the modal's
    // Attendance tab. checkOutTime is populated when they scanned again the same day at
    // the same branch; otherwise it's null (they haven't checked out yet).
    @Transactional(readOnly = true)
    public List<AttendanceLogEntry> historyFor(UUID personId) {
        return attendanceRepository.findByMemberIdOrderByCheckInTimeDesc(personId).stream()
                .map(a -> new AttendanceLogEntry(a.getId(), a.getCheckInTime(), a.getCheckOutTime(),
                        a.getMethod().name(), a.getBranch().getName()))
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