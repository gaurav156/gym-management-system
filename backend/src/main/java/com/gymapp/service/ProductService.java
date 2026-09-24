package com.gymapp.service;

import com.gymapp.dto.PageDtos.PageResponse;
import com.gymapp.dto.ProductDtos.*;
import com.gymapp.entity.Product;
import com.gymapp.repository.ProductRepository;
import com.gymapp.storage.ImagePurpose;
import com.gymapp.storage.ImageRefs;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final ImageRefs imageRefs;

    public ProductService(ProductRepository productRepository, ImageRefs imageRefs) {
        this.productRepository = productRepository;
        this.imageRefs = imageRefs;
    }

    // Owner-only (enforced at the controller).
    @Transactional
    public ProductResponse create(CreateProductRequest req) {
        Product product = Product.builder()
                .name(req.name())
                .description(req.description())
                .price(req.price())
                .discountPrice(req.discountPrice())
                .discountStartsAt(req.discountStartsAt())
                .discountEndsAt(req.discountEndsAt())
                .stockQuantity(req.stockQuantity())
                .active(true)
                .imageKeys(resolveNewImageKeys(req.imageUrls()))
                .build();
        product = productRepository.save(product);
        return toResponse(product);
    }

    @Transactional
    public ProductResponse update(UUID productId, UpdateProductRequest req) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));

        if (req.name() != null && !req.name().isBlank()) product.setName(req.name());
        if (req.description() != null) product.setDescription(req.description());
        if (req.price() != null) product.setPrice(req.price());
        // discountPrice has no "leave as is" null-skip - an explicit null in the request
        // is how the Owner clears a configured discount, same as UpdateBranchRequest's
        // blank-string-clears-the-field convention but for a nullable numeric field.
        product.setDiscountPrice(req.discountPrice());
        product.setDiscountStartsAt(req.discountStartsAt());
        product.setDiscountEndsAt(req.discountEndsAt());
        if (req.stockQuantity() != null) product.setStockQuantity(req.stockQuantity());
        if (req.active() != null) product.setActive(req.active());

        if (req.imageUrls() != null) {
            List<String> oldKeys = new ArrayList<>(product.getImageKeys());
            product.setImageKeys(resolveNewImageKeys(req.imageUrls()));
            // Delete any image no longer referenced by the new list - mirrors
            // ImageRefs.resolveForSave's single-field replace-then-cleanup pattern.
            for (String oldKey : oldKeys) {
                if (!product.getImageKeys().contains(oldKey)) imageRefs.deleteAfterCommit(oldKey);
            }
        }

        product = productRepository.save(product);
        return toResponse(product);
    }

    @Transactional(readOnly = true)
    public PageResponse<ProductResponse> listCatalog(String search, Pageable pageable) {
        Page<Product> page = productRepository.findActiveCatalog(blankToNull(search), pageable);
        return PageResponse.from(page.map(this::toResponse));
    }

    @Transactional(readOnly = true)
    public PageResponse<ProductResponse> listForManagement(String search, Pageable pageable) {
        Page<Product> page = productRepository.findAllForManagement(blankToNull(search), pageable);
        return PageResponse.from(page.map(this::toResponse));
    }

    @Transactional(readOnly = true)
    public ProductResponse get(UUID productId) {
        return toResponse(productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found")));
    }

    private List<String> resolveNewImageKeys(List<String> imageUrls) {
        if (imageUrls == null) return new ArrayList<>();
        List<String> keys = new ArrayList<>();
        for (String url : imageUrls) {
            if (url == null || url.isBlank()) continue;
            keys.add(imageRefs.resolveForSave(null, url, ImagePurpose.PRODUCT));
        }
        return keys;
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    boolean isDiscountActive(Product p) {
        if (p.getDiscountPrice() == null) return false;
        LocalDateTime now = LocalDateTime.now();
        if (p.getDiscountStartsAt() != null && now.isBefore(p.getDiscountStartsAt())) return false;
        if (p.getDiscountEndsAt() != null && now.isAfter(p.getDiscountEndsAt())) return false;
        return true;
    }

    BigDecimal effectivePrice(Product p) {
        return isDiscountActive(p) ? p.getDiscountPrice() : p.getPrice();
    }

    private ProductResponse toResponse(Product p) {
        boolean discountActive = isDiscountActive(p);
        List<String> urls = p.getImageKeys().stream().map(imageRefs::toUrl).toList();
        return new ProductResponse(
                p.getId(), p.getName(), p.getDescription(), p.getPrice(), p.getDiscountPrice(),
                p.getDiscountStartsAt(), p.getDiscountEndsAt(), effectivePrice(p), discountActive,
                p.getStockQuantity(), p.getStockQuantity() <= 0, p.isActive(), urls
        );
    }
}