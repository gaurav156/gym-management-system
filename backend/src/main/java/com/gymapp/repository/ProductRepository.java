package com.gymapp.repository;

import com.gymapp.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, UUID> {
    // CAST(:search AS text) IS NULL avoids the LOWER(bytea) bug (see the earlier fix);
    // categoryId is compared directly since it's never passed through LOWER(...).
    @Query("SELECT DISTINCT p FROM Product p LEFT JOIN p.categories c WHERE p.active = true " +
            "AND (:categoryId IS NULL OR c.id = :categoryId) " +
            "AND (CAST(:search AS text) IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%'))) " +
            "ORDER BY p.name")
    Page<Product> findActiveCatalog(@Param("search") String search, @Param("categoryId") UUID categoryId, Pageable pageable);

    @Query("SELECT DISTINCT p FROM Product p LEFT JOIN p.categories c WHERE " +
            "(:categoryId IS NULL OR c.id = :categoryId) " +
            "AND (CAST(:search AS text) IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%'))) " +
            "ORDER BY p.name")
    Page<Product> findAllForManagement(@Param("search") String search, @Param("categoryId") UUID categoryId, Pageable pageable);

    @Query("SELECT COUNT(p) FROM Product p JOIN p.categories c WHERE c.id = :categoryId")
    long countByCategoryId(@Param("categoryId") UUID categoryId);
}