package com.gymapp.repository;

import com.gymapp.entity.ProductBranchStock;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProductBranchStockRepository extends JpaRepository<ProductBranchStock, UUID> {
    List<ProductBranchStock> findByProductId(UUID productId);
    Optional<ProductBranchStock> findByProductIdAndBranchId(UUID productId, UUID branchId);
}