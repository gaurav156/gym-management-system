package com.gymapp.controller;

import com.gymapp.dto.MemberDtos.MemberSummary;
import com.gymapp.service.MemberDirectoryService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
public class MemberController {

    private final MemberDirectoryService memberDirectoryService;

    public MemberController(MemberDirectoryService memberDirectoryService) {
        this.memberDirectoryService = memberDirectoryService;
    }

    @GetMapping("/api/members")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public List<MemberSummary> listMembers(@RequestParam UUID branchId) {
        return memberDirectoryService.listMembersForBranch(branchId);
    }
}