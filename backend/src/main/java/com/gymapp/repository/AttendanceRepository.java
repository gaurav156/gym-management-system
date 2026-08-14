package com.gymapp.repository;

import com.gymapp.entity.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface AttendanceRepository extends JpaRepository<Attendance, UUID> {
    List<Attendance> findByBranchIdAndCheckInTimeBetween(UUID branchId, LocalDateTime from, LocalDateTime to);
    List<Attendance> findByMemberIdOrderByCheckInTimeDesc(UUID memberId);
}
