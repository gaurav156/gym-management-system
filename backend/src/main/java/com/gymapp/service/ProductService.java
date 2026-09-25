package com.gymapp.service;

import com.gymapp.dto.PageDtos.PageResponse;
import com.gymapp.dto.ProductDtos.*;
import com.gymapp.entity.Branch;
import com.gymapp.entity.Product;
import com.gymapp.entity.ProductBranchStock;
import com.gymapp.entity.ProductCategory;
import com.gymapp.repository.BranchRepository;
import com.gymapp.repository.ProductBranchStockRepository;
import com.gymapp.repository.ProductCategoryRepository;
import com.gymapp.repository.ProductOrderItemRepository;
import com.gymapp.repository.ProductRepository;
import com.gymapp.storage.ImagePurpose;
import com.gymapp.storage.ImageRefs;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class ProductService {

    private final ProductRepository productRepository;
    private final ProductOrderItemRepository productOrderItemRepository;
    private final ProductBranchStockRepository branchStockRepository;
    private final ProductCategoryRepository categoryRepository;
    private final BranchRepository branchRepository;
    private final ImageRefs imageRefs;

    public ProductService(ProductRepository productRepository,
                          ProductOrderItemRepository productOrderItemRepository,
                          ProductBranchStockRepository branchStockRepository,
                          ProductCategoryRepository categoryRepository,
                          BranchRepository branchRepository,
                          ImageRefs imageRefs) {
        this.productRepository = productRepository;
        this.productOrderItemRepository = productOrderItemRepository;
        this.branchStockRepository = branchStockRepository;
        this.categoryRepository = categoryRepository;
        this.branchRepository = branchRepository;
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
                .active(true)
                .imageKeys(resolveNewImageKeys(req.imageUrls()))
                .categories(resolveCategories(req.categoryIds()))
                .build();
        product = productRepository.save(product);
        upsertStock(product, req.branchStocks());
        return toResponse(product, null);
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
        if (req.active() != null) product.setActive(req.active());
        if (req.categoryIds() != null) product.setCategories(resolveCategories(req.categoryIds()));

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
        return toResponse(product, null);
    }

    // Owner-only. Stock is branch-specific (see V17 migration) - each row is upserted
    // independently so the request only needs to include the branches actually changing.
    @Transactional
    public ProductResponse updateStock(UUID productId, UpdateStockRequest req) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));
        upsertStock(product, req.branchStocks());
        return toResponse(product, null);
    }

    private void upsertStock(Product product, List<BranchStockRequest> branchStocks) {
        for (BranchStockRequest bs : branchStocks) {
            Branch branch = branchRepository.findById(bs.branchId())
                    .orElseThrow(() -> new IllegalArgumentException("Branch not found"));
            ProductBranchStock stock = branchStockRepository.findByProductIdAndBranchId(product.getId(), branch.getId())
                    .orElseGet(() -> ProductBranchStock.builder().product(product).branch(branch).stockQuantity(0).build());
            stock.setStockQuantity(bs.stockQuantity());
            branchStockRepository.save(stock);
        }
    }

    private Set<ProductCategory> resolveCategories(List<UUID> categoryIds) {
        if (categoryIds == null || categoryIds.isEmpty()) return new HashSet<>();
        List<ProductCategory> found = categoryRepository.findAllById(categoryIds);
        if (found.size() != new HashSet<>(categoryIds).size()) {
            throw new IllegalArgumentException("One or more categories not found");
        }
        return new HashSet<>(found);
    }

    @Transactional
    public void delete(UUID productId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));

        if (productOrderItemRepository.existsByProductId(productId)) {
            throw new IllegalArgumentException(
                    "This product has order history - deleting it would break those invoices. " +
                            "Deactivate it instead so it stops appearing in the catalog.");
        }

        List<String> imageKeys = new ArrayList<>(product.getImageKeys());
        productRepository.delete(product);
        imageKeys.forEach(imageRefs::deleteAfterCommit);
    }

    // branchId computes stockQuantity/outOfStock for that specific branch - Member and
    // front-desk browsing both always supply one, since they're picking up from a chosen
    // branch. categoryId is optional; null means "all categories".
    @Transactional(readOnly = true)
    public PageResponse<ProductResponse> listCatalog(String search, UUID categoryId, UUID branchId, Pageable pageable) {
        Page<Product> page = productRepository.findActiveCatalog(blankToNull(search), categoryId, pageable);
        return PageResponse.from(page.map(p -> toResponse(p, branchId)));
    }

    // Management list shows every branch's stock at once via branchStocks, not one
    // branch's number.
    @Transactional(readOnly = true)
    public PageResponse<ProductResponse> listForManagement(String search, UUID categoryId, Pageable pageable) {
        Page<Product> page = productRepository.findAllForManagement(blankToNull(search), categoryId, pageable);
        return PageResponse.from(page.map(p -> toResponse(p, null)));
    }

    @Transactional(readOnly = true)
    public ProductResponse get(UUID productId, UUID branchId) {
        return toResponse(productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found")), branchId);
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

    private ProductResponse toResponse(Product p, UUID branchId) {
        boolean discountActive = isDiscountActive(p);
        List<String> urls = p.getImageKeys().stream().map(imageRefs::toUrl).toList();
        List<CategoryRef> categories = p.getCategories().stream()
                .map(c -> new CategoryRef(c.getId(), c.getName()))
                .sorted(Comparator.comparing(CategoryRef::name))
                .toList();
        List<BranchStockResponse> branchStocks = branchStockRepository.findByProductId(p.getId()).stream()
                .map(bs -> new BranchStockResponse(bs.getBranch().getId(), bs.getBranch().getName(), bs.getStockQuantity()))
                .sorted(Comparator.comparing(BranchStockResponse::branchName))
                .toList();

        Integer stockQuantity = null;
        Boolean outOfStock = null;
        if (branchId != null) {
            int qty = branchStockRepository.findByProductIdAndBranchId(p.getId(), branchId)
                    .map(ProductBranchStock::getStockQuantity).orElse(0);
            stockQuantity = qty;
            outOfStock = qty <= 0;
        }

        return new ProductResponse(
                p.getId(), p.getName(), p.getDescription(), p.getPrice(), p.getDiscountPrice(),
                p.getDiscountStartsAt(), p.getDiscountEndsAt(), effectivePrice(p), discountActive,
                stockQuantity, outOfStock, p.isActive(), urls, categories, branchStocks
        );
    }
}