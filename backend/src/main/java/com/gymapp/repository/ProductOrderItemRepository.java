package com.gymapp.repository;

import com.gymapp.entity.ProductOrderItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ProductOrderItemRepository extends JpaRepository<ProductOrderItem, UUID> {
    // Blocks hard-deleting a product that's part of order history - see ProductService.delete().
    // Derived from the `product` association's id, same as any *ById query on a relation.
    boolean existsByProductId(UUID productId);
}