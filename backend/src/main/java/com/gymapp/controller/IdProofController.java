package com.gymapp.controller;

import com.gymapp.service.IdProofService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

// Falls through to .anyRequest().authenticated() in SecurityConfig; the real access check
// (self / Owner / Manager-for-Member-or-Trainer) is in IdProofService.
@RestController
@RequestMapping("/api/id-proofs")
public class IdProofController {

    private final IdProofService idProofService;

    public IdProofController(IdProofService idProofService) {
        this.idProofService = idProofService;
    }

    @GetMapping("/{userId}")
    public ResponseEntity<byte[]> view(@PathVariable UUID userId, Authentication authentication) {
        UUID callerId = UUID.fromString((String) authentication.getDetails());
        var file = idProofService.load(userId, callerId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.contentType()))
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .header("X-Content-Type-Options", "nosniff")
                .body(file.data());
    }
}