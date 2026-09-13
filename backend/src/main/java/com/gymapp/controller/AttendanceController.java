package com.gymapp.controller;

import com.gymapp.dto.AttendanceDtos.*;
import com.gymapp.dto.PageDtos.PageResponse;
import com.gymapp.service.AttendanceService;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

    private final AttendanceService attendanceService;

    public AttendanceController(AttendanceService attendanceService) {
        this.attendanceService = attendanceService;
    }

    // Called from: the reception kiosk (PIN), the member's own QR screen (QR), and later
    // a biometric device's sync agent (BIOMETRIC) - same contract for all three.
    @PostMapping("/checkin")
    public CheckinResponse checkin(@Valid @RequestBody CheckinRequest req) {
        return attendanceService.checkin(req);
    }

    @GetMapping("/summary/{branchId}")
    public List<HourlyCount> hourlySummary(@PathVariable UUID branchId) {
        return attendanceService.hourlySummary(branchId);
    }

    // Self-service: a Member or Trainer viewing their own attendance log. Identity comes
    // from the caller's own JWT, never a path/query param, so there's no way to view
    // anyone else's history through this endpoint.
    @GetMapping("/mine")
    public PageResponse<AttendanceLogEntry> mine(Authentication authentication,
                                                          @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        UUID callerId = UUID.fromString((String) authentication.getDetails());
        return attendanceService.historyFor(callerId, PageRequest.of(page, size));
    }

    @GetMapping("/history/{personId}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public PageResponse<AttendanceLogEntry> history(@PathVariable UUID personId,
                                                    @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return attendanceService.historyFor(personId, PageRequest.of(page, size));
    }

    @GetMapping("/today/{branchId}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public List<TodayAttendanceEntry> today(@PathVariable UUID branchId) {
        return attendanceService.todayAttendance(branchId);
    }

    @GetMapping("/last-checkin/{branchId}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public List<LastCheckinEntry> lastCheckins(@PathVariable UUID branchId) {
        return attendanceService.lastCheckins(branchId);
    }
}