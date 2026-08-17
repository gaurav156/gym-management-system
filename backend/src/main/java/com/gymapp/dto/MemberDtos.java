package com.gymapp.dto;

import java.time.LocalDate;
import java.util.UUID;

public class MemberDtos {

    // checkinPin is included so a manager can see it right in the member picker instead
    // of needing a separate DB lookup at the reception kiosk. enrollmentDate is set
    // automatically on the member's first purchase - null until then.
    public record MemberSummary(
            UUID id,
            String name,
            String email,
            String phone,
            String photo,
            String address,
            String checkinPin,
            LocalDate enrollmentDate
    ) {}
}