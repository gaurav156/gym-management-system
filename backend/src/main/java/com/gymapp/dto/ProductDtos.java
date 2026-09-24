package com.gymapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class ProductDtos {

    public record CreateProductRequest(
            @NotBlank String name,
            String description,
            @NotNull @PositiveOrZero BigDecimal price,
            BigDecimal discountPrice,
            LocalDateTime discountStartsAt,
            LocalDateTime discountEndsAt,
            @NotNull @PositiveOrZero Integer stockQuantity,
            // URLs already uploaded via POST /api/files/images?purpose=PRODUCT - same
            // two-step upload-then-save pattern PhotoUploadButton already uses.
            List<String> imageUrls
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
            Integer stockQuantity,
            Boolean active,
            List<String> imageUrls
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
            Integer stockQuantity,
            // Computed: stockQuantity <= 0. Never a stored flag - see Product's class comment.
            boolean outOfStock,
            boolean active,
            List<String> imageUrls
    ) {}
}