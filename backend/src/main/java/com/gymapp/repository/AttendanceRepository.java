package com.gymapp.repository;

import com.gymapp.entity.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface AttendanceRepository extends JpaRepository<Attendance, UUID> {
    List<Attendance> findByBranchIdAndCheckInTimeBetweenOrderByCheckInTimeDesc(UUID branchId, LocalDateTime from, LocalDateTime to);
    List<Attendance> findByMemberIdOrderByCheckInTimeDesc(UUID memberId);

    // MAX(checkInTime) per person at a branch, ever - used for the "last visit" column so
    // it doesn't require fetching every attendance row per member on the frontend.
    @Query("SELECT a.member.id, MAX(a.checkInTime) FROM Attendance a WHERE a.branch.id = :branchId GROUP BY a.member.id")
    List<Object[]> findLastCheckInPerMember(@Param("branchId") UUID branchId);
}