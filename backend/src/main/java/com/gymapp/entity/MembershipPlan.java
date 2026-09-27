package com.gymapp.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "membership_plans")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MembershipPlan {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String name;               // e.g. "1 Month", "3 Month", "Annual"

    @Column(nullable = false)
    private Integer durationMonths;

    @Column(nullable = false)
    private BigDecimal price;

    // Nullable - no discount configured. Only actually applied while now() falls within
    // discountStartsAt/discountEndsAt (either bound optional - null means unbounded on
    // that side), computed at read time in MembershipService, never stored as a flag.
    // Mirrors Product's discount fields exactly.
    private BigDecimal discountPrice;
    private LocalDateTime discountStartsAt;
    private LocalDateTime discountEndsAt;

    @Builder.Default
    private boolean active = true;
}