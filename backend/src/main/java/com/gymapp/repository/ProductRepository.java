package com.gymapp.repository;

import com.gymapp.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, UUID> {
    // CAST(:search AS text) IS NULL - not bare ":search IS NULL" - avoids Postgres/JDBC
    // inferring an untyped parameter as bytea when it's also used inside LOWER(...) below
    // (same fix as UserRepository.findMembersForBranch; see that class's comment).
    @Query("SELECT p FROM Product p WHERE p.active = true " +
            "AND (CAST(:search AS text) IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%'))) " +
            "ORDER BY p.name")
    Page<Product> findActiveCatalog(@Param("search") String search, Pageable pageable);

    @Query("SELECT p FROM Product p " +
            "WHERE (CAST(:search AS text) IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', CAST(:search AS text), '%'))) " +
            "ORDER BY p.name")
    Page<Product> findAllForManagement(@Param("search") String search, Pageable pageable);
}