package com.gymapp.dto;

import java.util.UUID;

public class MemberDtos {

    // checkinPin is included so a manager can see it right in the member picker instead
    // of needing a separate DB lookup at the reception kiosk.
    public record MemberSummary(
            UUID id,
            String name,
            String email,
            String checkinPin
    ) {}
}