package com.gymapp.controller;

import com.gymapp.dto.BranchDtos.BranchResponse;
import com.gymapp.service.BranchService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/public")
public class PublicController {

    private final BranchService branchService;

    public PublicController(BranchService branchService) {
        this.branchService = branchService;
    }

    @GetMapping("/branches")
    public List<BranchResponse> listBranches() {
        return branchService.listAll();
    }
}