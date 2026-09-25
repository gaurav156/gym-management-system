package com.gymapp.service;

import com.gymapp.dto.ProductCategoryDtos.*;
import com.gymapp.entity.ProductCategory;
import com.gymapp.repository.ProductCategoryRepository;
import com.gymapp.repository.ProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class ProductCategoryService {

    private final ProductCategoryRepository categoryRepository;
    private final ProductRepository productRepository;

    public ProductCategoryService(ProductCategoryRepository categoryRepository, ProductRepository productRepository) {
        this.categoryRepository = categoryRepository;
        this.productRepository = productRepository;
    }

    @Transactional
    public CategoryResponse create(CreateCategoryRequest req) {
        String name = req.name().trim();
        if (categoryRepository.findByNameIgnoreCase(name).isPresent()) {
            throw new IllegalArgumentException("A category with this name already exists");
        }
        ProductCategory category = categoryRepository.save(ProductCategory.builder().name(name).build());
        return toResponse(category);
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> list() {
        return categoryRepository.findAllByOrderByNameAsc().stream().map(this::toResponse).toList();
    }

    // Deleting a category just detaches it from every product (the join table cascades) -
    // no product is ever deleted or hidden as a side effect.
    @Transactional
    public void delete(UUID categoryId) {
        ProductCategory category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new IllegalArgumentException("Category not found"));
        categoryRepository.delete(category);
    }

    private CategoryResponse toResponse(ProductCategory c) {
        return new CategoryResponse(c.getId(), c.getName(), productRepository.countByCategoryId(c.getId()));
    }
}