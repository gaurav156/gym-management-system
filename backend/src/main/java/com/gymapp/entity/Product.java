package com.gymapp.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

// Chain-wide, like MembershipPlan - a product created here is purchasable/pickupable at
// any branch. "Out of stock" is deliberately NOT a stored flag: it's always
// stockQuantity <= 0, computed wherever it's displayed, so it can never drift out of sync
// with the actual count (same reasoning as frontend/utils/membership.ts's effective status).
@Entity
@Table(name = "products")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Product {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private BigDecimal price;

    // Nullable - no discount configured. Only actually applied while now() falls within
    // discountStartsAt/discountEndsAt (both optional - a null bound means unbounded on
    // that side), computed at read time in ProductService, never stored as a flag.
    private BigDecimal discountPrice;
    private LocalDateTime discountStartsAt;
    private LocalDateTime discountEndsAt;

    @Column(nullable = false)
    private Integer stockQuantity;

    // Owner-facing catalog visibility toggle - lets a product be pulled from sale without
    // deleting it (order history references it, so hard delete isn't offered - same
    // pattern as MembershipPlan.active).
    @Builder.Default
    private boolean active = true;

    @ElementCollection
    @CollectionTable(name = "product_images", joinColumns = @JoinColumn(name = "product_id"))
    @OrderColumn(name = "display_order")
    @Column(name = "image_key", nullable = false)
    @Builder.Default
    private List<String> imageKeys = new ArrayList<>();

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}