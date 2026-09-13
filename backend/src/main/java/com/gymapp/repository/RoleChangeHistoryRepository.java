package com.gymapp.repository;

import com.gymapp.entity.RoleChangeHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RoleChangeHistoryRepository extends JpaRepository<RoleChangeHistory, UUID> {
    List<RoleChangeHistory> findByUserIdOrderByChangedAtDesc(UUID userId);
}