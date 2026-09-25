package com.gymapp.dto;

import com.gymapp.entity.PaymentMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class ProductOrderDtos {

    public record OrderItemRequest(
            @NotNull UUID productId,
            @NotNull @Positive Integer quantity
    ) {}

    public record CreateProductOrderRequest(
            // Pickup branch - shown/selected before purchase (no home delivery yet).
            @NotNull UUID branchId,
            @NotNull PaymentMode mode,
            String couponCode,
            @NotEmpty List<@Valid OrderItemRequest> items
    ) {}

    public record CancelProductOrderRequest(
            @NotNull @Positive BigDecimal refundAmount,
            @NotNull PaymentMode refundMode,
            String refundNote
    ) {}

    public record OrderItemResponse(
            UUID productId,
            String productName,
            Integer quantity,
            BigDecimal unitPrice,
            BigDecimal lineTotal
    ) {}

    public record ProductOrderResponse(
            UUID id,
            String invoiceNumber,
            UUID memberId,
            String memberName,
            UUID branchId,
            String branchName,
            List<OrderItemResponse> items,
            BigDecimal subtotal,
            BigDecimal discountAmount,
            String couponCode,
            BigDecimal totalAmount,
            String mode,
            String status,
            String recordedByName,
            LocalDateTime createdAt,
            LocalDateTime completedAt,
            LocalDateTime cancelledAt,
            BigDecimal refundAmount,
            String refundedByName,
            String refundNote
    ) {}

    public record OrderInvoiceResponse(
            UUID orderId,
            String invoiceNumber,
            java.time.LocalDateTime invoiceDate,
            String branchName,
            String branchAddress,
            String branchPhone,
            String memberName,
            String memberEmail,
            String memberPhone,
            String memberAddress,
            List<OrderItemResponse> items,
            BigDecimal subtotal,
            BigDecimal discountAmount,
            String couponCode,
            BigDecimal totalAmount,
            String mode,
            String recordedByName,
            String recordedBySignature
    ) {}
}