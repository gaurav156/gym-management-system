package com.gymapp.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;
import java.util.UUID;

// One row per Owner-initiated role change - e.g. a Manager/Trainer being moved to
// MEMBER when they leave staff, or a Member being promoted to TRAINER. This is what
// backs the "past roles" list in a person's detail view.
@Entity
@Table(name = "role_change_history")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoleChangeHistory {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "previous_role", nullable = false)
    private Role previousRole;

    @Enumerated(EnumType.STRING)
    @Column(name = "new_role", nullable = false)
    private Role newRole;

    // Always the Owner - only the Owner can call this (enforced at the controller).
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by", nullable = false)
    private User changedBy;

    @Column(updatable = false)
    private LocalDateTime changedAt;

    @PrePersist
    protected void onCreate() {
        this.changedAt = LocalDateTime.now();
    }
}