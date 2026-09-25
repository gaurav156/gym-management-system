// backend/src/main/java/com/gymapp/entity/Product.java
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
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

// Chain-wide catalog entry - what varies by branch (stock) now lives in
// ProductBranchStock, not here (see V17/V18 migration).
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

    // NOTE: no stockQuantity field here anymore - it moved to ProductBranchStock.
    // If you still see it in your local file, delete it; its presence is exactly what
    // makes Hibernate expect a products.stock_quantity column that the migration dropped.

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

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "product_category_map",
            joinColumns = @JoinColumn(name = "product_id"),
            inverseJoinColumns = @JoinColumn(name = "category_id"))
    @Builder.Default
    private Set<ProductCategory> categories = new HashSet<>();

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}