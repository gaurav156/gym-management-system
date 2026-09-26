package com.gymapp.service;

import com.gymapp.dto.PageDtos.PageResponse;
import com.gymapp.dto.ProductOrderDtos.*;
import com.gymapp.entity.*;
import com.gymapp.invoice.ProductOrderRecordedEvent;
import com.gymapp.repository.*;
import com.gymapp.storage.ImageRefs;
import org.springframework.context.ApplicationEventPublisher;
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
    private final ProductBranchStockRepository branchStockRepository;
    private final BranchRepository branchRepository;
    private final UserRepository userRepository;
    private final CouponRepository couponRepository;
    private final ProductService productService;
    private final CouponService couponService;
    private final ImageRefs imageRefs;
    private final ApplicationEventPublisher eventPublisher;
    private final ProductOrderInvoiceEmailService invoiceEmailService;

    public ProductOrderService(ProductOrderRepository productOrderRepository,
                               ProductRepository productRepository,
                               ProductBranchStockRepository branchStockRepository,
                               BranchRepository branchRepository,
                               UserRepository userRepository,
                               CouponRepository couponRepository,
                               ProductService productService,
                               CouponService couponService,
                               ImageRefs imageRefs,
                               ApplicationEventPublisher eventPublisher,
                               ProductOrderInvoiceEmailService invoiceEmailService) {
        this.productOrderRepository = productOrderRepository;
        this.productRepository = productRepository;
        this.branchStockRepository = branchStockRepository;
        this.branchRepository = branchRepository;
        this.userRepository = userRepository;
        this.couponRepository = couponRepository;
        this.productService = productService;
        this.couponService = couponService;
        this.imageRefs = imageRefs;
        this.eventPublisher = eventPublisher;
        this.invoiceEmailService = invoiceEmailService;
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

            // Stock is checked and decremented against THIS pickup branch's row only -
            // never a shared/global count (see V17 migration).
            ProductBranchStock stock = branchStockRepository.findByProductIdAndBranchId(product.getId(), branch.getId())
                    .orElseThrow(() -> new IllegalArgumentException(
                            product.getName() + " is not stocked at " + branch.getName()));
            if (stock.getStockQuantity() < itemReq.quantity()) {
                throw new IllegalArgumentException("Not enough stock for " + product.getName() + " at " + branch.getName()
                        + " (" + stock.getStockQuantity() + " available)");
            }

            BigDecimal unitPrice = productService.effectivePrice(product);
            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(itemReq.quantity()));
            subtotal = subtotal.add(lineTotal);

            stock.setStockQuantity(stock.getStockQuantity() - itemReq.quantity());
            branchStockRepository.save(stock);

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

        // Fires after this transaction commits - never blocks the purchase response.
        eventPublisher.publishEvent(new ProductOrderRecordedEvent(order.getId()));

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
            branchStockRepository.findByProductIdAndBranchId(item.getProduct().getId(), order.getBranch().getId())
                    .ifPresent(stock -> {
                        stock.setStockQuantity(stock.getStockQuantity() + item.getQuantity());
                        branchStockRepository.save(stock);
                    });
        }

        order.setStatus(ProductOrderStatus.CANCELLED);
        order.setCancelledAt(LocalDateTime.now());
        order.setRefundAmount(req.refundAmount());
        order.setRefundMode(req.refundMode());
        order.setRefundNote(req.refundNote());
        order.setRefundedBy(refundedBy);

        order = productOrderRepository.save(order);

        // Same event/listener as purchase() - fires AFTER_COMMIT + @Async, so a slow/
        // failing mail server never delays or fails the cancellation response. The
        // listener rebuilds the invoice from the order's current (now cancelled) state.
        eventPublisher.publishEvent(new ProductOrderRecordedEvent(order.getId()));

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

    // Mirrors PaymentService.getInvoice - isStaff comes from the JWT, never a client flag.
    @Transactional(readOnly = true)
    public OrderInvoiceResponse getInvoice(UUID orderId, UUID requesterId, boolean isStaff) {
        ProductOrder o = productOrderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        if (!isStaff && !o.getMember().getId().equals(requesterId)) {
            throw new IllegalArgumentException("You can only view your own invoice");
        }
        return toInvoiceResponse(o);
    }

    @Transactional(readOnly = true)
    public OrderInvoiceResponse getInvoiceInternal(UUID orderId) {
        ProductOrder o = productOrderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        return toInvoiceResponse(o);
    }

    @Transactional(readOnly = true)
    public void sendInvoiceEmail(UUID orderId) {
        invoiceEmailService.sendInvoiceEmail(getInvoiceInternal(orderId));
    }

    private OrderInvoiceResponse toInvoiceResponse(ProductOrder o) {
        List<OrderItemResponse> items = o.getItems().stream()
                .map(i -> new OrderItemResponse(i.getProduct().getId(), i.getProductNameSnapshot(),
                        i.getQuantity(), i.getUnitPrice(), i.getLineTotal()))
                .toList();
        return new OrderInvoiceResponse(
                o.getId(),
                String.format("PORD-%d-%06d", o.getCreatedAt().getYear(), o.getInvoiceSeq()),
                o.getCreatedAt(),
                o.getBranch().getName(), o.getBranch().getAddress(), o.getBranch().getPhone(),
                o.getMember().getName(), o.getMember().getEmail(), o.getMember().getPhone(), o.getMember().getAddress(),
                items, o.getSubtotal(), o.getDiscountAmount(),
                o.getCoupon() != null ? o.getCoupon().getCode() : null,
                o.getTotalAmount(), o.getMode().name(),
                o.getRecordedBy() != null ? o.getRecordedBy().getName() : null,
                o.getRecordedBy() != null ? imageRefs.toUrl(o.getRecordedBy().getSignature()) : null,
                o.getStatus().name(),
                o.getCancelledAt(),
                o.getRefundAmount(),
                o.getRefundMode() != null ? o.getRefundMode().name() : null,
                o.getRefundNote()
        );
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