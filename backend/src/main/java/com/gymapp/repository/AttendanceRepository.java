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

    // Today's existing record (if any) for this person at this specific branch - used to
    // decide whether a scan is a fresh check-in or a check-out against an existing one.
    // Scoped by branch as well as day: scanning at a different branch the same day starts
    // a separate record there, it doesn't check them out of the first branch.
    @Query("SELECT a FROM Attendance a WHERE a.member.id = :personId AND a.branch.id = :branchId "
            + "AND a.checkInTime >= :startOfDay AND a.checkInTime < :endOfDay ORDER BY a.checkInTime DESC")
    List<Attendance> findTodayRecordsForPersonAndBranch(@Param("personId") UUID personId, @Param("branchId") UUID branchId,
                                                        @Param("startOfDay") LocalDateTime startOfDay, @Param("endOfDay") LocalDateTime endOfDay);
}