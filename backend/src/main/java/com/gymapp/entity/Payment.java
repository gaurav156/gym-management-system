package com.gymapp.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.hibernate.annotations.Generated;
import org.hibernate.annotations.GenerationTime;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "payments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Payment {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private User member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branch_id", nullable = false)
    private Branch branch;

    // The manager/owner who actually collected the cash - taken from the JWT of whoever
    // called the purchase endpoint, never a client-supplied value, so this can't be spoofed.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recorded_by", nullable = false)
    private User recordedBy;

    // Nullable - only populated for MEMBERSHIP-type payments. A future PRODUCT-type
    // payment will reference an Order instead rather than overloading this field.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "membership_id")
    private Membership membership;

    @Column(nullable = false)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentMode mode;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    // DB-assigned via the invoice_seq sequence (see V6 migration). insertable/updatable
    // false means we never write this from Java - Postgres fills it on INSERT via the
    // column default, and Hibernate reads it back on any fresh SELECT (which is all we
    // need, since the invoice number is only rendered later on-demand, not right after
    // the purchase transaction).
    @Column(name = "invoice_seq", insertable = false, updatable = false)
    private Long invoiceSeq;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}