package com.gymapp.service;

import com.gymapp.dto.AttendanceDtos.*;
import com.gymapp.entity.*;
import com.gymapp.repository.AttendanceRepository;
import com.gymapp.repository.BranchAssignmentRepository;
import com.gymapp.repository.BranchRepository;
import com.gymapp.repository.MembershipRepository;
import com.gymapp.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class AttendanceService {

    private static final Logger log = LoggerFactory.getLogger(AttendanceService.class);

    // A visit with no check-out scan is treated as ended after this many hours - both by
    // the scheduled auto-checkout job below, and (defensively, so there's no display lag
    // between visits) by the occupancy calculation in hourlySummary(). Kept as a single
    // constant so the two stay in sync if this window is ever tuned.
    private static final int AUTO_CHECKOUT_HOURS = 2;

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

        // Staff who have left (leftDate set, in the past or today) shouldn't be able to
        // check in as staff even if their role hasn't been changed yet - see
        // RoleChangeService for the preferred long-term fix (changing their role away
        // from TRAINER/MANAGER entirely), this is the fallback for anyone still holding
        // the role with just leftDate set.
        if ((person.getRole() == Role.TRAINER || person.getRole() == Role.MANAGER)
                && person.getLeftDate() != null && !person.getLeftDate().isAfter(LocalDate.now())) {
            throw new IllegalArgumentException(person.getName() + " is no longer active staff - check-in denied");
        }

        if (req.branchId() == null) {
            throw new IllegalArgumentException("branchId is required");
        }
        Branch branch = branchRepository.findById(req.branchId())
                .orElseThrow(() -> new IllegalArgumentException("Branch not found"));

        // The Owner has implicit access to every branch (no branch_assignments row of
        // their own - see BranchService) so they're exempt from this check. Everyone
        // else - Manager, Trainer, Member - must actually be assigned to the branch
        // they're checking in at.
        boolean assignedToBranch = person.getRole() == Role.OWNER
                || branchAssignmentRepository.findByUserIdAndBranchId(person.getId(), branch.getId()).isPresent();
        if (!assignedToBranch) {
            throw new IllegalArgumentException(person.getName() + " is not assigned to " + branch.getName());
        }

        // Only Members need an active membership to check in - Owner/Manager/Trainer are
        // staff, their check-in is about attendance tracking, not gym access control.
        if (person.getRole() == Role.MEMBER) {
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

    // Runs every 15 minutes - closes out any attendance record that's still open
    // (checkOutTime IS NULL) more than AUTO_CHECKOUT_HOURS after check-in. Handles the
    // common case of someone scanning in, working out, and simply leaving without
    // scanning again on the way out. checkOutTime is set to checkInTime + the window
    // (not "now") so the recorded visit duration reflects the assumed length of a gym
    // session, not however long it happened to take this job to run and notice.
    @Scheduled(fixedRate = 15 * 60 * 1000)
    @Transactional
    public void autoCheckoutStaleRecords() {
        LocalDateTime cutoff = LocalDateTime.now().minusHours(AUTO_CHECKOUT_HOURS);
        List<Attendance> stale = attendanceRepository.findOpenRecordsCheckedInBefore(cutoff);
        if (stale.isEmpty()) return;

        for (Attendance a : stale) {
            a.setCheckOutTime(a.getCheckInTime().plusHours(AUTO_CHECKOUT_HOURS));
        }
        attendanceRepository.saveAll(stale);
        log.info("Auto checked-out {} stale attendance record(s) after {}h", stale.size(), AUTO_CHECKOUT_HOURS);
    }

    // Powers the "busy hours" chart for MEMBERS only - staff check-ins shouldn't skew
    // what's meant to represent how busy the floor is for members. Unlike a simple
    // "how many people checked in during hour X" count, this reflects actual OCCUPANCY:
    // a member who checked in at 9:15 and checked out at 11:20 is counted as present
    // during the 9, 10, AND 11 o'clock buckets, not just the 9 o'clock one they scanned
    // in during - this is what makes the chart behave like Google Maps' popular-times
    // graph rather than a raw check-in histogram. A member still checked in (no
    // check-out yet) is counted as present from their check-in hour up to now, capped at
    // AUTO_CHECKOUT_HOURS after check-in - this cap is what stops someone who forgot to
    // scan out from appearing "present" for the rest of the day; it also covers the
    // (at most 15-minute) gap before the scheduled auto-checkout job actually runs and
    // writes a real checkOutTime. Always returns all 24 hours (zero-filled) so the
    // frontend never has to guess which hours are missing.
    @Transactional(readOnly = true)
    public List<HourlyCount> hourlySummary(UUID branchId) {
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);
        LocalDateTime now = LocalDateTime.now();

        List<Attendance> records = attendanceRepository
                .findByBranchIdAndCheckInTimeBetweenOrderByCheckInTimeDesc(branchId, startOfDay, endOfDay)
                .stream()
                .filter(a -> a.getMember().getRole() == Role.MEMBER)
                .toList();

        int[] occupancy = new int[24];
        for (Attendance a : records) {
            LocalDateTime effectiveEnd;
            if (a.getCheckOutTime() != null) {
                effectiveEnd = a.getCheckOutTime();
            } else {
                LocalDateTime autoCheckoutAt = a.getCheckInTime().plusHours(AUTO_CHECKOUT_HOURS);
                effectiveEnd = autoCheckoutAt.isBefore(now) ? autoCheckoutAt : now;
            }

            int startHour = a.getCheckInTime().getHour();
            int endHour = effectiveEnd.toLocalDate().isAfter(a.getCheckInTime().toLocalDate())
                    ? 23 // rolled past midnight - cap at the end of the check-in day
                    : effectiveEnd.getHour();
            if (endHour < startHour) endHour = startHour;

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
    // the same branch, or by the auto-checkout job if they never did; otherwise it's
    // null (visit still in progress, within the auto-checkout window).
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