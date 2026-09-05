package com.gymapp.service;

import com.gymapp.dto.PaymentDtos.InvoiceResponse;
import com.gymapp.dto.PaymentDtos.PaymentResponse;
import com.gymapp.entity.Membership;
import com.gymapp.entity.Payment;
import com.gymapp.repository.PaymentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class PaymentService {

    private final PaymentRepository paymentRepository;

    public PaymentService(PaymentRepository paymentRepository) {
        this.paymentRepository = paymentRepository;
    }

    @Transactional(readOnly = true)
    public List<PaymentResponse> listForBranch(UUID branchId) {
        return paymentRepository.findByBranchIdOrderByCreatedAtDesc(branchId).stream()
                .map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<PaymentResponse> listForMember(UUID memberId) {
        return paymentRepository.findByMemberIdOrderByCreatedAtDesc(memberId).stream()
                .map(this::toResponse).toList();
    }

    // isStaff comes from the caller's JWT authorities (OWNER/MANAGER), never a client flag -
    // a MEMBER can only ever fetch their own invoice, checked against their own JWT id.
    @Transactional(readOnly = true)
    public InvoiceResponse getInvoice(UUID paymentId, UUID requesterId, boolean isStaff) {
        Payment p = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("Payment not found"));
        if (!isStaff && !p.getMember().getId().equals(requesterId)) {
            throw new IllegalArgumentException("You can only view your own invoice");
        }

        Membership m = p.getMembership();
        return new InvoiceResponse(
                p.getId(),
                formatInvoiceNumber(p),
                p.getCreatedAt(),
                p.getBranch().getName(),
                p.getBranch().getAddress(),
                p.getBranch().getPhone(),
                p.getMember().getName(),
                p.getMember().getEmail(),
                p.getMember().getPhone(),
                p.getMember().getAddress(),
                m != null ? m.getPlan().getName() : null,
                m != null ? m.getStartDate() : null,
                m != null ? m.getEndDate() : null,
                p.getAmount(),
                p.getMode().name(),
                p.getRecordedBy().getName()
        );
    }

    private PaymentResponse toResponse(Payment p) {
        return new PaymentResponse(
                p.getId(),
                formatInvoiceNumber(p),
                p.getMember().getName(),
                p.getRecordedBy().getName(),
                p.getMembership() != null ? p.getMembership().getPlan().getName() : null,
                p.getAmount(),
                p.getType().name(),
                p.getMode().name(),
                p.getCreatedAt()
        );
    }

    private String formatInvoiceNumber(Payment p) {
        return String.format("INV-%d-%06d", p.getCreatedAt().getYear(), p.getInvoiceSeq());
    }
}