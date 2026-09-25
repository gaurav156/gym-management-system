package com.gymapp.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

public class ProductCategoryDtos {
    public record CreateCategoryRequest(@NotBlank String name) {}
    public record CategoryResponse(UUID id, String name, long productCount) {}
}