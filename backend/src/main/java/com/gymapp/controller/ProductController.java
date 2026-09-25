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

    @PutMapping("/manage/{id}/stock")
    @PreAuthorize("hasRole('OWNER')")
    public ProductResponse updateStock(@PathVariable UUID id, @Valid @RequestBody UpdateStockRequest req) {
        return productService.updateStock(id, req);
    }

    // branchId is required - both Members and staff browse "for pickup at <branch>".
    @GetMapping
    public PageResponse<ProductResponse> listCatalog(@RequestParam UUID branchId,
                                                     @RequestParam(required = false) String search,
                                                     @RequestParam(required = false) UUID categoryId,
                                                     @RequestParam(defaultValue = "0") int page,
                                                     @RequestParam(defaultValue = "20") int size) {
        return productService.listCatalog(search, categoryId, branchId, PageRequest.of(page, size));
    }

    // Owner-facing management list - includes inactive products.
    @GetMapping("/manage")
    @PreAuthorize("hasRole('OWNER')")
    public PageResponse<ProductResponse> listForManagement(@RequestParam(required = false) String search,
                                                           @RequestParam(required = false) UUID categoryId,
                                                           @RequestParam(defaultValue = "0") int page,
                                                           @RequestParam(defaultValue = "20") int size) {
        return productService.listForManagement(search, categoryId, PageRequest.of(page, size));
    }

    @GetMapping("/{id}")
    public ProductResponse get(@PathVariable UUID id, @RequestParam(required = false) UUID branchId) {
        return productService.get(id, branchId);
    }

    @DeleteMapping("/manage/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public void delete(@PathVariable UUID id) {
        productService.delete(id);
    }
}