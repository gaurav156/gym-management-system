package com.gymapp.service;

import com.gymapp.dto.ProfileDtos.*;
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

    @Transactional
    public ProfileResponse updateProfile(UUID userId, UpdateProfileRequest req) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (req.name() != null && !req.name().isBlank()) u.setName(req.name());
        if (req.phone() != null) u.setPhone(req.phone());
        if (req.photo() != null) u.setPhoto(req.photo().isBlank() ? null : req.photo());

        u = userRepository.save(u);
        return toResponse(u);
    }

    private ProfileResponse toResponse(User u) {
        return new ProfileResponse(u.getId(), u.getName(), u.getEmail(), u.getPhone(), u.getPhoto(), u.getRole().name());
    }
}