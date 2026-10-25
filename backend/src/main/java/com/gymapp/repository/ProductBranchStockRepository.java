package com.gymapp.repository;

import com.gymapp.entity.ProductBranchStock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProductBranchStockRepository extends JpaRepository<ProductBranchStock, UUID> {
    List<ProductBranchStock> findByProductId(UUID productId);
    Optional<ProductBranchStock> findByProductIdAndBranchId(UUID productId, UUID branchId);
    @Query("SELECT s FROM ProductBranchStock s JOIN FETCH s.branch WHERE s.product.id IN :ids")
    List<ProductBranchStock> findByProductIdIn(@Param("ids") Collection<UUID> ids);
}