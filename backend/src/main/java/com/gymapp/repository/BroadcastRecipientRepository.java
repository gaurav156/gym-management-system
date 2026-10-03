package com.gymapp.repository;

import com.gymapp.entity.BroadcastRecipient;
import com.gymapp.entity.BroadcastRecipientStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BroadcastRecipientRepository extends JpaRepository<BroadcastRecipient, UUID> {
    List<BroadcastRecipient> findByBroadcastIdAndStatus(UUID broadcastId, BroadcastRecipientStatus status);
    long countByBroadcastIdAndStatus(UUID broadcastId, BroadcastRecipientStatus status);
    Page<BroadcastRecipient> findByBroadcastIdOrderByRecipientNameAsc(UUID broadcastId, Pageable pageable);
    Page<BroadcastRecipient> findByBroadcastIdAndStatusOrderByRecipientNameAsc(UUID broadcastId,
                                                                               BroadcastRecipientStatus status,
                                                                               Pageable pageable);
}