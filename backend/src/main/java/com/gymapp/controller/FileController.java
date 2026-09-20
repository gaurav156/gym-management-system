package com.gymapp.controller;

import com.gymapp.dto.FileDtos.UploadResponse;
import com.gymapp.storage.ImagePurpose;
import com.gymapp.storage.ImageRefs;
import com.gymapp.storage.ImageUploadService;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

// Any authenticated user may upload a photo (their own profile, or - for staff - someone
// they're editing). Signatures are stamped on invoices, so only Owner/Manager may upload one.
// Covered by `.anyRequest().authenticated()` in SecurityConfig, no rule change needed.
@RestController
@RequestMapping("/api/files")
public class FileController {

    private final ImageUploadService imageUploadService;
    private final ImageRefs imageRefs;

    public FileController(ImageUploadService imageUploadService, ImageRefs imageRefs) {
        this.imageUploadService = imageUploadService;
        this.imageRefs = imageRefs;
    }

    @PostMapping(value = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public UploadResponse uploadImage(@RequestParam("file") MultipartFile file,
                                      @RequestParam(defaultValue = "PHOTO") ImagePurpose purpose,
                                      Authentication authentication) throws IOException {
        if (purpose == ImagePurpose.SIGNATURE) {
            boolean isStaff = authentication.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equals("ROLE_OWNER") || a.getAuthority().equals("ROLE_MANAGER"));
            if (!isStaff) throw new IllegalArgumentException("Only an Owner or Manager can upload a signature");
        }
        String key = imageUploadService.upload(file, purpose);
        return new UploadResponse(imageRefs.toUrl(key));
    }
}