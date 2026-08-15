package com.gymapp.repository;

import com.gymapp.entity.Membership;
import com.gymapp.entity.MembershipStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MembershipRepository extends JpaRepository<Membership, UUID> {
    List<Membership> findByMemberId(UUID memberId);
    Optional<Membership> findFirstByMemberIdAndStatusOrderByEndDateDesc(UUID memberId, MembershipStatus status);
    List<Membership> findByStatus(MembershipStatus status);
    List<Membership> findByBranchIdOrderByEndDateDesc(UUID branchId);
}