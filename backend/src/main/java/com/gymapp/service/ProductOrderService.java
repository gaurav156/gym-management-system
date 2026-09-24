// backend/src/main/java/com/gymapp/service/ProductOrderService.java
package com.gymapp.service;

import com.gymapp.dto.PageDtos.PageResponse;
import com.gymapp.dto.ProductOrderDtos.*;
import com.gymapp.entity.*;
import com.gymapp.repository.BranchRepository;
import com.gymapp.repository.CouponRepository;
import com.gymapp.repository.ProductOrderRepository;
import com.gymapp.repository.ProductRepository;
import com.gymapp.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

// Manual front-desk purchase only for now - a Manager/Owner records the sale the same way
// MembershipService.purchase() records a plan purchase. Stock is decremented right here at
// creation (see ProductOrder's class comment / V16 migration), and the order is created
// straight into COMPLETED since a cash sale is handed over on the spot. The CONFIRMED
// status and complete()/cancel() machinery below exist so a future online-payment flow
// (order created CONFIRMED, then completed at pickup) is a new creation path, not a new
// status model - see InvoiceWhatsAppService for the same "build the shape now, wire the
// provider later" approach.
//
// NOTE ON CONCURRENCY: the stock check-then-decrement below isn't protected against two
// concurrent purchases racing past the check simultaneously - same caveat as
// FailedAttemptTracker's in-memory counter. Fine at this project's current scale; a
// SELECT ... FOR UPDATE (or a DB-level CHECK (stock_quantity >= 0) as a hard backstop)
// would be the next step if concurrent front-desk sales become a real risk.
@Service
public class ProductOrderService {

    private final ProductOrderRepository productOrderRepository;
    private final ProductRepository productRepository;
    private final BranchRepository branchRepository;
    private final UserRepository userRepository;
    private final CouponRepository couponRepository;
    private final ProductService productService;
    private final CouponService couponService;

    public ProductOrderService(ProductOrderRepository productOrderRepository,
                               ProductRepository productRepository,
                               BranchRepository branchRepository,
                               UserRepository userRepository,
                               CouponRepository couponRepository,
                               ProductService productService,
                               CouponService couponService) {
        this.productOrderRepository = productOrderRepository;
        this.productRepository = productRepository;
        this.branchRepository = branchRepository;
        this.userRepository = userRepository;
        this.couponRepository = couponRepository;
        this.productService = productService;
        this.couponService = couponService;
    }

    @Transactional
    public ProductOrderResponse purchase(UUID memberId, CreateProductOrderRequest req, UUID recordedByUserId) {
        User member = userRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("Member not found"));
        Branch branch = branchRepository.findById(req.branchId())
                .orElseThrow(() -> new IllegalArgumentException("Branch not found"));
        User recordedBy = userRepository.findById(recordedByUserId)
                .orElseThrow(() -> new IllegalArgumentException("Recording user not found"));

        ProductOrder order = ProductOrder.builder()
                .member(member)
                .branch(branch)
                .recordedBy(recordedBy)
                .mode(req.mode())
                .status(ProductOrderStatus.COMPLETED)
                .completedAt(LocalDateTime.now())
                .build();

        BigDecimal subtotal = BigDecimal.ZERO;
        for (OrderItemRequest itemReq : req.items()) {
            Product product = productRepository.findById(itemReq.productId())
                    .orElseThrow(() -> new IllegalArgumentException("Product not found"));
            if (!product.isActive()) {
                throw new IllegalArgumentException(product.getName() + " is no longer available");
            }
            if (product.getStockQuantity() < itemReq.quantity()) {
                throw new IllegalArgumentException("Not enough stock for " + product.getName()
                        + " (" + product.getStockQuantity() + " available)");
            }

            BigDecimal unitPrice = productService.effectivePrice(product);
            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(itemReq.quantity()));
            subtotal = subtotal.add(lineTotal);

            product.setStockQuantity(product.getStockQuantity() - itemReq.quantity());
            productRepository.save(product);

            order.getItems().add(ProductOrderItem.builder()
                    .order(order)
                    .product(product)
                    .productNameSnapshot(product.getName())
                    .quantity(itemReq.quantity())
                    .unitPrice(unitPrice)
                    .lineTotal(lineTotal)
                    .build());
        }

        BigDecimal discountAmount = BigDecimal.ZERO;
        Coupon coupon = null;
        if (req.couponCode() != null && !req.couponCode().isBlank()) {
            coupon = couponRepository.findByCode(req.couponCode().trim().toUpperCase())
                    .orElseThrow(() -> new IllegalArgumentException("Coupon not found"));
            String reason = couponService.ineligibilityReason(coupon, memberId);
            if (reason != null) throw new IllegalArgumentException(reason);

            discountAmount = couponService.computeDiscount(coupon, subtotal);
            coupon.setTimesRedeemed(coupon.getTimesRedeemed() + 1);
            couponRepository.save(coupon);
        }

        order.setCoupon(coupon);
        order.setSubtotal(subtotal);
        order.setDiscountAmount(discountAmount);
        order.setTotalAmount(subtotal.subtract(discountAmount));

        order = productOrderRepository.save(order);
        return toResponse(order);
    }

    // For a future online-payment flow: moves a CONFIRMED (paid, awaiting pickup) order to
    // COMPLETED once the member collects it at the branch. Not reachable today since
    // purchase() above always creates orders as COMPLETED directly.
    @Transactional
    public ProductOrderResponse markCompleted(UUID orderId) {
        ProductOrder order = productOrderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        if (order.getStatus() != ProductOrderStatus.CONFIRMED) {
            throw new IllegalArgumentException("Only a confirmed, not-yet-completed order can be marked completed");
        }
        order.setStatus(ProductOrderStatus.COMPLETED);
        order.setCompletedAt(LocalDateTime.now());
        order = productOrderRepository.save(order);
        return toResponse(order);
    }

    // Restores stock for every item and records a cash refund - automatic refund-to-source
    // is future work once online payment lands (see class comment).
    @Transactional
    public ProductOrderResponse cancel(UUID orderId, CancelProductOrderRequest req, UUID refundedByUserId) {
        ProductOrder order = productOrderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        if (order.getStatus() == ProductOrderStatus.CANCELLED) {
            throw new IllegalArgumentException("This order is already cancelled");
        }
        User refundedBy = userRepository.findById(refundedByUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        for (ProductOrderItem item : order.getItems()) {
            Product product = item.getProduct();
            product.setStockQuantity(product.getStockQuantity() + item.getQuantity());
            productRepository.save(product);
        }

        order.setStatus(ProductOrderStatus.CANCELLED);
        order.setCancelledAt(LocalDateTime.now());
        order.setRefundAmount(req.refundAmount());
        order.setRefundMode(req.refundMode());
        order.setRefundNote(req.refundNote());
        order.setRefundedBy(refundedBy);

        order = productOrderRepository.save(order);
        return toResponse(order);
    }

    @Transactional(readOnly = true)
    public PageResponse<ProductOrderResponse> listForBranch(UUID branchId, Pageable pageable) {
        Page<ProductOrder> page = productOrderRepository.findByBranchIdOrderByCreatedAtDesc(branchId, pageable);
        return PageResponse.from(page.map(this::toResponse));
    }

    @Transactional(readOnly = true)
    public PageResponse<ProductOrderResponse> listForMember(UUID memberId, Pageable pageable) {
        Page<ProductOrder> page = productOrderRepository.findByMemberIdOrderByCreatedAtDesc(memberId, pageable);
        return PageResponse.from(page.map(this::toResponse));
    }

    private ProductOrderResponse toResponse(ProductOrder o) {
        List<OrderItemResponse> items = o.getItems().stream()
                .map(i -> new OrderItemResponse(i.getProduct().getId(), i.getProductNameSnapshot(),
                        i.getQuantity(), i.getUnitPrice(), i.getLineTotal()))
                .toList();
        return new ProductOrderResponse(
                o.getId(),
                String.format("PORD-%d-%06d", o.getCreatedAt().getYear(), o.getInvoiceSeq()),
                o.getMember().getId(), o.getMember().getName(),
                o.getBranch().getId(), o.getBranch().getName(),
                items, o.getSubtotal(), o.getDiscountAmount(),
                o.getCoupon() != null ? o.getCoupon().getCode() : null,
                o.getTotalAmount(), o.getMode().name(), o.getStatus().name(),
                o.getRecordedBy() != null ? o.getRecordedBy().getName() : null,
                o.getCreatedAt(), o.getCompletedAt(), o.getCancelledAt(),
                o.getRefundAmount(), o.getRefundedBy() != null ? o.getRefundedBy().getName() : null,
                o.getRefundNote()
        );
    }
}