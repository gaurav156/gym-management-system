package com.gymapp.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users", uniqueConstraints = {
        @UniqueConstraint(columnNames = "email")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    private String phone;

    @Column(nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    // 4-digit PIN used for gym check-in (member-facing, separate from login password)
    @Column(length = 4)
    private String checkinPin;

    // Unique token encoded into the member's QR code for check-in
    @Column(unique = true)
    private String qrToken;

    @Builder.Default
    private boolean active = true;

    // Base64 data URI (e.g. "data:image/jpeg;base64,...") - simplest storage that needs no
    // extra service/API keys. Worth moving to Cloudinary or S3 before this has many users;
    // storing images in Postgres doesn't scale well.
    @Column(columnDefinition = "TEXT")
    private String photo;

    // Base64 data URI, same pattern as photo. OWNER/MANAGER only - captured once in their
    // profile and stamped onto every invoice for payments they record, so it isn't
    // re-uploaded per transaction.
    @Column(columnDefinition = "TEXT")
    private String signature;

    private String address;

    // Members only - set automatically on their first membership purchase
    // (MembershipService.purchase()), never editable directly. Null until then.
    private LocalDate enrollmentDate;

    // Trainers only - set automatically when the Owner creates the account
    // (AuthService.createTrainer()), never editable by the trainer themselves.
    private LocalDate joiningDate;

    // Trainers only - null while active. Settable only by Owner/Manager (never by the
    // trainer's own profile edit), and deliberately excluded from the trainer's own
    // "my profile" response - only staff-facing views can see it.
    private LocalDate leftDate;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}