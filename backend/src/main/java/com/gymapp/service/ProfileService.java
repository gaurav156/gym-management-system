package com.gymapp.service;

import com.gymapp.dto.ProfileDtos.*;
import com.gymapp.entity.Role;
import com.gymapp.entity.User;
import com.gymapp.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class ProfileService {

    private final UserRepository userRepository;

    public ProfileService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public ProfileResponse getProfile(UUID userId) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return toResponse(u);
    }

    // Only name/phone/address/photo are settable for everyone - enrollmentDate,
    // joiningDate, and leftDate are never touched by this method, regardless of what a
    // client sends, because UpdateProfileRequest simply has no fields for them.
    // signature is settable ONLY for OWNER/MANAGER - silently ignored for other roles
    // rather than erroring, so a MEMBER submitting the same form shape (with signature
    // left null) still works normally.
    @Transactional
    public ProfileResponse updateProfile(UUID userId, UpdateProfileRequest req) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (req.name() != null && !req.name().isBlank()) u.setName(req.name());
        if (req.phone() != null) u.setPhone(req.phone());
        if (req.address() != null) u.setAddress(req.address().isBlank() ? null : req.address());
        if (req.photo() != null) u.setPhoto(req.photo().isBlank() ? null : req.photo());

        if (req.signature() != null && (u.getRole() == Role.OWNER || u.getRole() == Role.MANAGER)) {
            u.setSignature(req.signature().isBlank() ? null : req.signature());
        }

        u = userRepository.save(u);
        return toResponse(u);
    }

    private ProfileResponse toResponse(User u) {
        return new ProfileResponse(u.getId(), u.getName(), u.getEmail(), u.getPhone(), u.getAddress(),
                u.getPhoto(), u.getSignature(), u.getRole().name(), u.getEnrollmentDate(), u.getJoiningDate());
    }
}