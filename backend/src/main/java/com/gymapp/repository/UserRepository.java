package com.gymapp.repository;

import com.gymapp.entity.Role;
import com.gymapp.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    Optional<User> findByQrToken(String qrToken);
    boolean existsByEmail(String email);
    List<User> findByRole(Role role);

    // Used by the SMS/WhatsApp OTP channels once they're wired to a real provider - phone
    // isn't unique the way email is, so this is "first match" rather than "the" match.
    Optional<User> findFirstByPhone(String phone);

    // Members roster for a branch - filtering, status, and sort all run in the database
    // so they apply across the WHOLE roster, not just the page currently in memory.
    // `status` is ALL/ACTIVE/SCHEDULED/PAUSED/NONE (never null - the controller
    // defaults it), derived the same way MembershipRepository/utils/membership.ts do:
    // ACTIVE = an ACTIVE row whose range covers today; SCHEDULED = an ACTIVE row not
    // started yet; PAUSED = a PAUSED row; NONE = none of those. `sort` STATUS orders
    // by the same alphabetical priority (ACTIVE, NONE, PAUSED, SCHEDULED) the frontend
    // used to sort by client-side, then by name.
    @Query(value = "SELECT u.* FROM users u " +
            "WHERE u.role = 'MEMBER' " +
            "AND u.id IN (SELECT ba.user_id FROM branch_assignments ba WHERE ba.branch_id = :branchId) " +
            "AND (CAST(:search AS text) IS NULL " +
            "     OR LOWER(u.name) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) " +
            "     OR LOWER(u.email) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%'))) " +
            "AND (:status = 'ALL' " +
            "  OR (:status = 'ACTIVE' AND EXISTS (SELECT 1 FROM memberships m WHERE m.member_id = u.id " +
            "        AND m.status = 'ACTIVE' AND m.start_date <= CURRENT_DATE AND m.end_date >= CURRENT_DATE)) " +
            "  OR (:status = 'SCHEDULED' AND EXISTS (SELECT 1 FROM memberships m WHERE m.member_id = u.id " +
            "        AND m.status = 'ACTIVE' AND m.start_date > CURRENT_DATE)) " +
            "  OR (:status = 'PAUSED' AND EXISTS (SELECT 1 FROM memberships m WHERE m.member_id = u.id " +
            "        AND m.status = 'PAUSED')) " +
            "  OR (:status = 'NONE' AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.member_id = u.id " +
            "        AND ((m.status = 'ACTIVE' AND m.start_date <= CURRENT_DATE AND m.end_date >= CURRENT_DATE) " +
            "          OR (m.status = 'ACTIVE' AND m.start_date > CURRENT_DATE) " +
            "          OR (m.status = 'PAUSED'))))) " +
            "ORDER BY " +
            "  CASE WHEN :sort = 'STATUS' THEN " +
            "    CASE " +
            "      WHEN EXISTS (SELECT 1 FROM memberships m WHERE m.member_id = u.id AND m.status = 'ACTIVE' " +
            "             AND m.start_date <= CURRENT_DATE AND m.end_date >= CURRENT_DATE) THEN 0 " +
            "      WHEN NOT EXISTS (SELECT 1 FROM memberships m WHERE m.member_id = u.id " +
            "             AND ((m.status = 'ACTIVE' AND m.start_date <= CURRENT_DATE AND m.end_date >= CURRENT_DATE) " +
            "               OR (m.status = 'ACTIVE' AND m.start_date > CURRENT_DATE) OR (m.status = 'PAUSED'))) THEN 1 " +
            "      WHEN EXISTS (SELECT 1 FROM memberships m WHERE m.member_id = u.id AND m.status = 'PAUSED') THEN 2 " +
            "      ELSE 3 " +
            "    END " +
            "  ELSE 0 END, " +
            "  u.name",
            countQuery = "SELECT count(u.*) FROM users u " +
                    "WHERE u.role = 'MEMBER' " +
                    "AND u.id IN (SELECT ba.user_id FROM branch_assignments ba WHERE ba.branch_id = :branchId) " +
                    "AND (CAST(:search AS text) IS NULL " +
                    "     OR LOWER(u.name) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%')) " +
                    "     OR LOWER(u.email) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%'))) " +
                    "AND (:status = 'ALL' " +
                    "  OR (:status = 'ACTIVE' AND EXISTS (SELECT 1 FROM memberships m WHERE m.member_id = u.id " +
                    "        AND m.status = 'ACTIVE' AND m.start_date <= CURRENT_DATE AND m.end_date >= CURRENT_DATE)) " +
                    "  OR (:status = 'SCHEDULED' AND EXISTS (SELECT 1 FROM memberships m WHERE m.member_id = u.id " +
                    "        AND m.status = 'ACTIVE' AND m.start_date > CURRENT_DATE)) " +
                    "  OR (:status = 'PAUSED' AND EXISTS (SELECT 1 FROM memberships m WHERE m.member_id = u.id " +
                    "        AND m.status = 'PAUSED')) " +
                    "  OR (:status = 'NONE' AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.member_id = u.id " +
                    "        AND ((m.status = 'ACTIVE' AND m.start_date <= CURRENT_DATE AND m.end_date >= CURRENT_DATE) " +
                    "          OR (m.status = 'ACTIVE' AND m.start_date > CURRENT_DATE) " +
                    "          OR (m.status = 'PAUSED')))))",
            nativeQuery = true)
    Page<User> findMembersForBranch(@Param("branchId") UUID branchId, @Param("search") String search,
                                    @Param("status") String status, @Param("sort") String sort, Pageable pageable);

    // Staff roster - Owner always included (implicit access to every branch), Manager/
    // Trainer only if assigned to this branch. `role` is ALL/OWNER/MANAGER/TRAINER,
    // `includeLeft` mirrors the old "Show all trainers/managers (including left)"
    // checkbox, `sort` ROLE orders by seniority (Owner, Manager, Trainer) then name.
    @Query(value = "SELECT u.* FROM users u " +
            "WHERE (u.role = 'OWNER' " +
            "  OR (u.role IN ('MANAGER', 'TRAINER') " +
            "      AND u.id IN (SELECT ba.user_id FROM branch_assignments ba WHERE ba.branch_id = :branchId))) " +
            "AND (:role = 'ALL' OR u.role = :role) " +
            "AND (u.role = 'OWNER' OR :includeLeft = true OR u.left_date IS NULL) " +
            "ORDER BY " +
            "  CASE WHEN :sort = 'ROLE' THEN " +
            "    CASE u.role WHEN 'OWNER' THEN 0 WHEN 'MANAGER' THEN 1 ELSE 2 END " +
            "  ELSE 0 END, " +
            "  u.name",
            countQuery = "SELECT count(u.*) FROM users u " +
                    "WHERE (u.role = 'OWNER' " +
                    "  OR (u.role IN ('MANAGER', 'TRAINER') " +
                    "      AND u.id IN (SELECT ba.user_id FROM branch_assignments ba WHERE ba.branch_id = :branchId))) " +
                    "AND (:role = 'ALL' OR u.role = :role) " +
                    "AND (u.role = 'OWNER' OR :includeLeft = true OR u.left_date IS NULL)",
            nativeQuery = true)
    Page<User> findStaffForBranch(@Param("branchId") UUID branchId, @Param("role") String role,
                                  @Param("includeLeft") boolean includeLeft, @Param("sort") String sort, Pageable pageable);
}