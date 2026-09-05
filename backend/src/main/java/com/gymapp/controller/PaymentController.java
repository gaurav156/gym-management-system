package com.gymapp.controller;

import com.gymapp.dto.PaymentDtos.InvoiceResponse;
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

    // Staff-facing: view a specific member's payment history (for the member details modal)
    @GetMapping("/member/{memberId}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public List<PaymentResponse> memberHistory(@PathVariable UUID memberId) {
        return paymentService.listForMember(memberId);
    }

    // Any of the three roles can call this - the service itself enforces that a MEMBER
    // may only fetch their own invoice, so a stolen payment id can't leak someone else's.
    @GetMapping("/{paymentId}/invoice")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','MEMBER')")
    public InvoiceResponse invoice(@PathVariable UUID paymentId, Authentication authentication) {
        UUID requesterId = UUID.fromString((String) authentication.getDetails());
        boolean isStaff = authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_OWNER") || a.getAuthority().equals("ROLE_MANAGER"));
        return paymentService.getInvoice(paymentId, requesterId, isStaff);
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