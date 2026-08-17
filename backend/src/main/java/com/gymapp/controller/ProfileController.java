package com.gymapp.controller;

import com.gymapp.dto.ProfileDtos.*;
import com.gymapp.service.ProfileService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

// "Mine" endpoints - identity always comes from the caller's own JWT, never a request
// param, so there's no way to view or edit anyone else's profile through this controller.
@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private final ProfileService profileService;

    public ProfileController(ProfileService profileService) {
        this.profileService = profileService;
    }

    @GetMapping("/me")
    public ProfileResponse me(Authentication authentication) {
        return profileService.getProfile(callerId(authentication));
    }

    @PutMapping("/me")
    public ProfileResponse updateMe(@RequestBody UpdateProfileRequest req, Authentication authentication) {
        return profileService.updateProfile(callerId(authentication), req);
    }

    private UUID callerId(Authentication authentication) {
        return UUID.fromString((String) authentication.getDetails());
    }
}