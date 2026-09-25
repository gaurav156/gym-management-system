package com.gymapp.repository;

import com.gymapp.entity.ProductCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProductCategoryRepository extends JpaRepository<ProductCategory, UUID> {
    Optional<ProductCategory> findByNameIgnoreCase(String name);
    List<ProductCategory> findAllByOrderByNameAsc();
}