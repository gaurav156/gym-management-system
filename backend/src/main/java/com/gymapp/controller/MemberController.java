package com.gymapp.controller;

import com.gymapp.dto.MemberDtos.MemberSummary;
import com.gymapp.dto.PageDtos.PageResponse;
import com.gymapp.dto.ProfileDtos.UpdateProfileRequest;
import com.gymapp.service.MemberDirectoryService;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
public class MemberController {

    private final MemberDirectoryService memberDirectoryService;

    public MemberController(MemberDirectoryService memberDirectoryService) {
        this.memberDirectoryService = memberDirectoryService;
    }

    @GetMapping("/api/members")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public PageResponse<MemberSummary> listMembers(@RequestParam UUID branchId,
                                                            @RequestParam(required = false) String search,
                                                            @RequestParam(defaultValue = "0") int page,
                                                            @RequestParam(defaultValue = "20") int size) {
        return memberDirectoryService.listMembersForBranch(branchId, search, PageRequest.of(page, size));
    }

    // Staff-facing basic info edit (name/phone/address/photo) - deliberately reuses the
    // same request shape as the member's own self-service profile edit, since the editable
    // fields are identical. Email is never editable here.
    @PutMapping("/api/members/{id}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public MemberSummary updateMember(@PathVariable UUID id, @RequestBody UpdateProfileRequest req) {
        return memberDirectoryService.updateMember(id, req);
    }
}