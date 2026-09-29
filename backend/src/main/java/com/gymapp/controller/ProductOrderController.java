package com.gymapp.controller;

import com.gymapp.dto.PageDtos.PageResponse;
import com.gymapp.dto.ProductOrderDtos.*;
import com.gymapp.service.ProductOrderService;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/product-orders")
public class ProductOrderController {

    private final ProductOrderService productOrderService;

    public ProductOrderController(ProductOrderService productOrderService) {
        this.productOrderService = productOrderService;
    }

    @PostMapping("/purchase")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public ProductOrderResponse purchase(@RequestParam UUID memberId,
                                         @Valid @RequestBody CreateProductOrderRequest req,
                                         Authentication authentication) {
        UUID recordedBy = UUID.fromString((String) authentication.getDetails());
        return productOrderService.purchase(memberId, req, recordedBy);
    }

    @PostMapping("/{id}/complete")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public ProductOrderResponse complete(@PathVariable UUID id) {
        return productOrderService.markCompleted(id);
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public ProductOrderResponse cancel(@PathVariable UUID id, @Valid @RequestBody CancelProductOrderRequest req,
                                       Authentication authentication) {
        UUID refundedBy = UUID.fromString((String) authentication.getDetails());
        return productOrderService.cancel(id, req, refundedBy);
    }

    @GetMapping("/branch/{branchId}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public PageResponse<ProductOrderResponse> listForBranch(@PathVariable UUID branchId,
                                                            @RequestParam(defaultValue = "0") int page,
                                                            @RequestParam(defaultValue = "20") int size) {
        return productOrderService.listForBranch(branchId, PageRequest.of(page, size));
    }

    // Member's own order history - ownership checked against the caller's own JWT, same
    // pattern as PaymentController.mine().
    @GetMapping("/mine")
    public PageResponse<ProductOrderResponse> mine(@RequestParam UUID memberId, Authentication authentication,
                                                   @RequestParam(defaultValue = "0") int page,
                                                   @RequestParam(defaultValue = "20") int size) {
        UUID requesterId = UUID.fromString((String) authentication.getDetails());
        if (!requesterId.equals(memberId)) {
            throw new IllegalArgumentException("You can only view your own order history");
        }
        return productOrderService.listForMember(memberId, PageRequest.of(page, size));
    }

    // Any of the four roles can call this - the service itself enforces that a non-staff
    // caller (Member or Trainer) may only fetch their OWN invoice, so a stolen order id
    // can't leak someone else's purchase. TRAINER was missing here after staff became
    // buyers too - Members and Managers worked because they were explicitly listed,
    // Trainers weren't, so their own valid JWT was rejected before getInvoice() ever ran.
    @GetMapping("/{orderId}/invoice")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','MEMBER','TRAINER')")
    public com.gymapp.dto.ProductOrderDtos.OrderInvoiceResponse invoice(@PathVariable UUID orderId, Authentication authentication) {
        UUID requesterId = UUID.fromString((String) authentication.getDetails());
        boolean isStaff = authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_OWNER") || a.getAuthority().equals("ROLE_MANAGER"));
        return productOrderService.getInvoice(orderId, requesterId, isStaff);
    }

    @PostMapping("/{orderId}/send-email")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public java.util.Map<String, String> sendEmail(@PathVariable UUID orderId) {
        productOrderService.sendInvoiceEmail(orderId);
        return java.util.Map.of("message", "Invoice emailed.");
    }

    // Staff-facing: view a specific person's (member OR staff) product purchase history -
    // mirrors PaymentController.memberHistory. personId is deliberately not restricted to
    // MEMBER role, since staff can now purchase products for themselves too.
    @GetMapping("/member/{personId}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public PageResponse<ProductOrderResponse> memberHistory(@PathVariable UUID personId,
                                                            @RequestParam(defaultValue = "0") int page,
                                                            @RequestParam(defaultValue = "20") int size) {
        return productOrderService.listForMember(personId, PageRequest.of(page, size));
    }
}