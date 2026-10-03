package com.gymapp.repository;

import com.gymapp.entity.Broadcast;
import com.gymapp.entity.BroadcastStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface BroadcastRepository extends JpaRepository<Broadcast, UUID> {
    Page<Broadcast> findAllByOrderByCreatedAtDesc(Pageable pageable);

    boolean existsByStatus(BroadcastStatus status);

    List<Broadcast> findByStatus(BroadcastStatus status);

    // Progress/finish are bulk updates rather than entity saves - the dispatcher runs outside
    // any transaction and these never touch the (immutable) subject/body.
    @Modifying
    @Transactional
    @Query("UPDATE Broadcast b SET b.sentCount = :sent, b.failedCount = :failed WHERE b.id = :id")
    int updateProgress(@Param("id") UUID id, @Param("sent") int sent, @Param("failed") int failed);

    @Modifying
    @Transactional
    @Query("UPDATE Broadcast b SET b.sentCount = :sent, b.failedCount = :failed, b.status = :status, " +
            "b.completedAt = :completedAt WHERE b.id = :id")
    int finish(@Param("id") UUID id, @Param("sent") int sent, @Param("failed") int failed,
               @Param("status") BroadcastStatus status, @Param("completedAt") LocalDateTime completedAt);

    // Used by OrphanImageCleanupJob - every file any broadcast references must count as "referenced".
    @Query("SELECT k FROM Broadcast b JOIN b.assetKeys k")
    List<String> findAllAssetKeys();
}