package com.gymapp.controller;

import com.gymapp.dto.ProductCategoryDtos.*;
import com.gymapp.service.ProductCategoryService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/product-categories")
public class ProductCategoryController {

    private final ProductCategoryService categoryService;

    public ProductCategoryController(ProductCategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public CategoryResponse create(@Valid @RequestBody CreateCategoryRequest req) {
        return categoryService.create(req);
    }

    // Any authenticated role - Members/staff both need this to browse/filter by category.
    @GetMapping
    public List<CategoryResponse> list() {
        return categoryService.list();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public void delete(@PathVariable UUID id) {
        categoryService.delete(id);
    }
}