package com.gymapp.controller;

import com.gymapp.dto.AttendanceDtos.*;
import com.gymapp.service.AttendanceService;
import jakarta.validation.Valid;
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
}
