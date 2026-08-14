package com.gymapp.dto;

import com.gymapp.entity.CheckinMethod;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.UUID;

public class AttendanceDtos {

    // Either pin+branchId (PIN check-in from a reception kiosk) or qrToken (member scans
    // their own QR) is supplied. This single endpoint shape is also what a future
    // biometric device adapter will call - it just sends method=BIOMETRIC instead.
    public record CheckinRequest(
            String pin,
            String qrToken,
            UUID branchId,
            @NotNull CheckinMethod method
    ) {}

    public record CheckinResponse(
            UUID attendanceId,
            String memberName,
            LocalDateTime checkInTime,
            String message
    ) {}

    public record HourlyCount(
            int hour,
            long count
    ) {}
}
