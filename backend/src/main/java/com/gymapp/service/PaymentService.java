package com.gymapp.service;

import com.gymapp.dto.PaymentDtos.PaymentResponse;
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

    // @Transactional here isn't optional - toResponse() walks member/recordedBy/membership,
    // all lazy relationships, and open-in-view is disabled.
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

    private PaymentResponse toResponse(Payment p) {
        return new PaymentResponse(
                p.getId(),
                p.getMember().getName(),
                p.getRecordedBy().getName(),
                p.getMembership() != null ? p.getMembership().getPlan().getName() : null,
                p.getAmount(),
                p.getType().name(),
                p.getMode().name(),
                p.getCreatedAt()
        );
    }
}