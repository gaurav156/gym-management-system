package com.gymapp.service;

import com.gymapp.dto.ExpenseDtos.*;
import com.gymapp.dto.PageDtos.PageResponse;
import com.gymapp.entity.Branch;
import com.gymapp.entity.Expense;
import com.gymapp.entity.Role;
import com.gymapp.entity.User;
import com.gymapp.repository.BranchAssignmentRepository;
import com.gymapp.repository.BranchRepository;
import com.gymapp.repository.ExpenseRepository;
import com.gymapp.repository.UserRepository;
import com.gymapp.storage.ImagePurpose;
import com.gymapp.storage.ImageRefs;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final BranchRepository branchRepository;
    private final UserRepository userRepository;
    private final BranchAssignmentRepository branchAssignmentRepository;
    private final ImageRefs imageRefs;

    public ExpenseService(ExpenseRepository expenseRepository,
                          BranchRepository branchRepository,
                          UserRepository userRepository,
                          BranchAssignmentRepository branchAssignmentRepository,
                          ImageRefs imageRefs) {
        this.expenseRepository = expenseRepository;
        this.branchRepository = branchRepository;
        this.userRepository = userRepository;
        this.branchAssignmentRepository = branchAssignmentRepository;
        this.imageRefs = imageRefs;
    }

    // Owner has implicit access to every branch (same rule BranchService/AttendanceService
    // use). A Manager must actually be assigned to the branch - expenses are financial
    // records, so this is enforced here rather than left to the frontend's branch picker
    // alone (which already restricts a Manager to their own branches, but shouldn't be the
    // only thing stopping them from reading/writing another branch's expenses).
    private void assertBranchAccess(User caller, UUID branchId) {
        if (caller.getRole() == Role.OWNER) return;
        boolean assigned = branchAssignmentRepository.findByUserIdAndBranchId(caller.getId(), branchId).isPresent();
        if (!assigned) {
            throw new IllegalArgumentException("You are not assigned to this branch");
        }
    }

    @Transactional
    public ExpenseResponse create(CreateExpenseRequest req, UUID recordedByUserId) {
        User recordedBy = userRepository.findById(recordedByUserId)
                .orElseThrow(() -> new IllegalArgumentException("Recording user not found"));
        Branch branch = branchRepository.findById(req.branchId())
                .orElseThrow(() -> new IllegalArgumentException("Branch not found"));
        assertBranchAccess(recordedBy, branch.getId());

        String billKey = (req.billUrl() == null || req.billUrl().isBlank())
                ? null
                : imageRefs.resolveForSave(null, req.billUrl(), ImagePurpose.BILL);

        Expense expense = Expense.builder()
                .branch(branch)
                .recordedBy(recordedBy)
                .category(req.category())
                .amount(req.amount())
                .expenseDate(req.expenseDate())
                .remark(req.remark())
                .billKey(billKey)
                .build();
        expense = expenseRepository.save(expense);
        return toResponse(expense);
    }

    @Transactional(readOnly = true)
    public PageResponse<ExpenseResponse> listForBranch(UUID branchId, UUID callerId, Pageable pageable) {
        User caller = userRepository.findById(callerId)
                .orElseThrow(() -> new IllegalArgumentException("Caller not found"));
        assertBranchAccess(caller, branchId);
        return PageResponse.from(expenseRepository.findByBranchIdOrderByExpenseDateDescCreatedAtDesc(branchId, pageable)
                .map(this::toResponse));
    }

    // Owner-only at the controller - deletion isn't exposed to a Manager, only recording.
    @Transactional
    public void delete(UUID expenseId, UUID callerId) {
        User caller = userRepository.findById(callerId)
                .orElseThrow(() -> new IllegalArgumentException("Caller not found"));
        Expense expense = expenseRepository.findById(expenseId)
                .orElseThrow(() -> new IllegalArgumentException("Expense not found"));
        assertBranchAccess(caller, expense.getBranch().getId());

        String bill = expense.getBillKey();
        expenseRepository.delete(expense);
        imageRefs.deleteAfterCommit(bill);
    }

    private ExpenseResponse toResponse(Expense e) {
        return new ExpenseResponse(
                e.getId(),
                e.getBranch().getId(),
                e.getBranch().getName(),
                e.getCategory().name(),
                e.getAmount(),
                e.getExpenseDate(),
                e.getRemark(),
                imageRefs.toUrl(e.getBillKey()),
                e.getRecordedBy().getName(),
                e.getCreatedAt()
        );
    }
}