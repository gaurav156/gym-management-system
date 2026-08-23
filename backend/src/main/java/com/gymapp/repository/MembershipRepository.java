package com.gymapp.repository;

import com.gymapp.entity.Membership;
import com.gymapp.entity.MembershipStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MembershipRepository extends JpaRepository<Membership, UUID> {
    List<Membership> findByMemberId(UUID memberId);
    List<Membership> findByStatus(MembershipStatus status);

    // Scoped by branch ASSIGNMENT, not by which branch happened to process the purchase -
    // a manager viewing branch X needs to see the full membership picture (including
    // ACTIVE status) for everyone assigned to X, even if their plan was purchased
    // elsewhere. This is what the Members table's status column and the membership admin
    // table both rely on.
    @Query("SELECT m FROM Membership m WHERE m.member.id IN "
            + "(SELECT ba.user.id FROM BranchAssignment ba WHERE ba.branch.id = :branchId) "
            + "ORDER BY m.endDate DESC")
    List<Membership> findByMemberAssignedToBranch(@Param("branchId") UUID branchId);

    // The membership that's actually usable RIGHT NOW - status=ACTIVE and today falls
    // within its date range. This is what gym access (check-in) and the "your current
    // plan" display should both use - NOT just "any row marked ACTIVE", since a member
    // can have a future-dated (not yet started) ACTIVE row queued up too.
    @Query("SELECT m FROM Membership m WHERE m.member.id = :memberId AND m.status = 'ACTIVE' "
            + "AND m.startDate <= :today AND m.endDate >= :today")
    Optional<Membership> findCurrentlyUsable(@Param("memberId") UUID memberId, @Param("today") LocalDate today);

    // The soonest not-yet-started ACTIVE membership, if any - used to give a helpful
    // "starts on <date>" message when check-in is denied rather than a bare "no access".
    Optional<Membership> findFirstByMemberIdAndStatusAndStartDateAfterOrderByStartDateAsc(
            UUID memberId, MembershipStatus status, LocalDate today);

    // How far a member's paid-for time already extends, ignoring anything cancelled or
    // already lapsed - a new purchase queues up starting the day after this, so back-to-
    // back plans stack in order instead of overlapping or clobbering each other.
    @Query("SELECT MAX(m.endDate) FROM Membership m WHERE m.member.id = :memberId "
            + "AND m.status = 'ACTIVE' AND m.endDate >= :today")
    LocalDate findLatestQueuedEndDate(@Param("memberId") UUID memberId, @Param("today") LocalDate today);
}