package com.gymapp.controller;

import com.gymapp.dto.BranchDtos.BranchResponse;
import com.gymapp.service.BranchService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/public")
public class PublicController {

    private final BranchService branchService;

    public PublicController(BranchService branchService) {
        this.branchService = branchService;
    }

    @GetMapping("/branches")
    public ResponseEntity<List<BranchResponse>> listBranches() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES).cachePublic())
                .body(branchService.listActive());
    }
}