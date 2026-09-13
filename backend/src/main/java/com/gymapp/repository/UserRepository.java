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

    // No-search variant - used whenever the caller hasn't typed anything. Deliberately
    // separate from the *WithSearch variant below rather than a single query with
    // "(:search IS NULL OR ...)": Postgres can't infer a type for a literal NULL bound
    // into CONCAT(), and defaults it to bytea, which then blows up on LOWER(bytea).
    // Splitting into two queries means :search is only ever bound as a real String.
    @Query("SELECT u FROM User u WHERE u.role = :role " +
            "AND u.id IN (SELECT ba.user.id FROM BranchAssignment ba WHERE ba.branch.id = :branchId) " +
            "ORDER BY u.name")
    Page<User> findByRoleAssignedToBranch(@Param("role") Role role, @Param("branchId") UUID branchId, Pageable pageable);

    @Query("SELECT u FROM User u WHERE u.role = :role " +
            "AND u.id IN (SELECT ba.user.id FROM BranchAssignment ba WHERE ba.branch.id = :branchId) " +
            "AND (LOWER(u.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "     OR LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%'))) " +
            "ORDER BY u.name")
    Page<User> findByRoleAssignedToBranchWithSearch(@Param("role") Role role, @Param("branchId") UUID branchId,
                                                    @Param("search") String search, Pageable pageable);

    // Same split for the Staff directory query.
    @Query("SELECT u FROM User u WHERE " +
            "(u.role = com.gymapp.entity.Role.OWNER " +
            " OR (u.role IN (com.gymapp.entity.Role.MANAGER, com.gymapp.entity.Role.TRAINER) " +
            "     AND u.id IN (SELECT ba.user.id FROM BranchAssignment ba WHERE ba.branch.id = :branchId))) " +
            "ORDER BY CASE u.role WHEN com.gymapp.entity.Role.OWNER THEN 0 " +
            "  WHEN com.gymapp.entity.Role.MANAGER THEN 1 ELSE 2 END, u.name")
    Page<User> findStaffForBranch(@Param("branchId") UUID branchId, Pageable pageable);

    @Query("SELECT u FROM User u WHERE " +
            "(u.role = com.gymapp.entity.Role.OWNER " +
            " OR (u.role IN (com.gymapp.entity.Role.MANAGER, com.gymapp.entity.Role.TRAINER) " +
            "     AND u.id IN (SELECT ba.user.id FROM BranchAssignment ba WHERE ba.branch.id = :branchId))) " +
            "AND (LOWER(u.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
            "     OR LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%'))) " +
            "ORDER BY CASE u.role WHEN com.gymapp.entity.Role.OWNER THEN 0 " +
            "  WHEN com.gymapp.entity.Role.MANAGER THEN 1 ELSE 2 END, u.name")
    Page<User> findStaffForBranchWithSearch(@Param("branchId") UUID branchId, @Param("search") String search, Pageable pageable);
}