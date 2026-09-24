package com.gymapp.controller;

import com.gymapp.dto.PageDtos.PageResponse;
import com.gymapp.dto.ProductDtos.*;
import com.gymapp.service.ProductService;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    // Chain-wide catalog, like /api/plans - Owner-only to create/edit, no longer
    // Manager-creatable, same rationale as membership plans.
    @PostMapping("/manage")
    @PreAuthorize("hasRole('OWNER')")
    public ProductResponse create(@Valid @RequestBody CreateProductRequest req) {
        return productService.create(req);
    }

    @PutMapping("/manage/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ProductResponse update(@PathVariable UUID id, @RequestBody UpdateProductRequest req) {
        return productService.update(id, req);
    }

    // Any authenticated role (Members browsing to purchase, staff browsing to record a
    // sale) - active products only.
    @GetMapping
    public PageResponse<ProductResponse> listCatalog(@RequestParam(required = false) String search,
                                                     @RequestParam(defaultValue = "0") int page,
                                                     @RequestParam(defaultValue = "20") int size) {
        return productService.listCatalog(search, PageRequest.of(page, size));
    }

    // Owner-facing management list - includes inactive products.
    @GetMapping("/manage")
    @PreAuthorize("hasRole('OWNER')")
    public PageResponse<ProductResponse> listForManagement(@RequestParam(required = false) String search,
                                                           @RequestParam(defaultValue = "0") int page,
                                                           @RequestParam(defaultValue = "20") int size) {
        return productService.listForManagement(search, PageRequest.of(page, size));
    }

    @GetMapping("/{id}")
    public ProductResponse get(@PathVariable UUID id) {
        return productService.get(id);
    }
}