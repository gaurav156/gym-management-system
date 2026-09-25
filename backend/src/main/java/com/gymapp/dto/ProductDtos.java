package com.gymapp.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class ProductDtos {

    public record BranchStockRequest(@NotNull UUID branchId, @NotNull @PositiveOrZero Integer stockQuantity) {}
    public record BranchStockResponse(UUID branchId, String branchName, Integer stockQuantity) {}
    public record CategoryRef(UUID id, String name) {}

    public record CreateProductRequest(
            @NotBlank String name,
            String description,
            @NotNull @PositiveOrZero BigDecimal price,
            BigDecimal discountPrice,
            LocalDateTime discountStartsAt,
            LocalDateTime discountEndsAt,
            List<String> imageUrls,
            @NotEmpty List<@Valid BranchStockRequest> branchStocks,
            List<UUID> categoryIds
    ) {}

    // All fields optional - null means "leave as is", same convention as
    // BranchDtos.UpdateBranchRequest. imageUrls, when supplied, REPLACES the full list
    // (simplest mental model for a multi-image field - partial add/remove happens
    // client-side against the full list, not here).
    public record UpdateProductRequest(
            String name,
            String description,
            BigDecimal price,
            BigDecimal discountPrice,
            LocalDateTime discountStartsAt,
            LocalDateTime discountEndsAt,
            Boolean active,
            List<String> imageUrls,
            List<UUID> categoryIds
    ) {}

    // Owner-only, kept separate from UpdateProductRequest - stock is edited from its own
    // per-branch table in the UI, not mixed into the general product-details form.
    public record UpdateStockRequest(
            @NotEmpty List<@Valid BranchStockRequest> branchStocks
    ) {}

    public record ProductResponse(
            UUID id,
            String name,
            String description,
            BigDecimal price,
            BigDecimal discountPrice,
            LocalDateTime discountStartsAt,
            LocalDateTime discountEndsAt,
            // Computed: discountPrice while now() is within the discount window, else
            // price. This is what a purchase should actually charge.
            BigDecimal effectivePrice,
            boolean discountActive,
            // stockQuantity/outOfStock are for the branch given in the request's branchId
            // param - null when no branch was supplied (the Owner's management list uses
            // branchStocks below instead, which carries every branch's count at once).
            Integer stockQuantity,
            Boolean outOfStock,
            boolean active,
            List<String> imageUrls,
            List<CategoryRef> categories,
            List<BranchStockResponse> branchStocks
    ) {}
}