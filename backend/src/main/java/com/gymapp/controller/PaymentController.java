package com.gymapp.controller;

import com.gymapp.dto.PaymentDtos.PaymentResponse;
import com.gymapp.service.PaymentService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @GetMapping("/branch/{branchId}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public List<PaymentResponse> branchHistory(@PathVariable UUID branchId) {
        return paymentService.listForBranch(branchId);
    }

    // A member can only ever see their own payment history - memberId is checked against
    // the caller's own JWT, not trusted as given, since this is financial data.
    @GetMapping("/mine")
    public List<PaymentResponse> mine(@RequestParam UUID memberId, Authentication authentication) {
        UUID requesterId = UUID.fromString((String) authentication.getDetails());
        if (!requesterId.equals(memberId)) {
            throw new IllegalArgumentException("You can only view your own payment history");
        }
        return paymentService.listForMember(memberId);
    }
}