package com.gymapp.service;

import com.gymapp.broadcast.UnsubscribeTokenService;
import com.gymapp.dto.MarketingDtos.MarketingPreferenceResponse;
import com.gymapp.entity.User;
import com.gymapp.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class MarketingConsentService {

    private static final String INVALID_LINK = "This link is invalid";

    private final UserRepository userRepository;
    private final UnsubscribeTokenService tokens;

    public MarketingConsentService(UserRepository userRepository, UnsubscribeTokenService tokens) {
        this.userRepository = userRepository;
        this.tokens = tokens;
    }

    @Transactional(readOnly = true)
    public MarketingPreferenceResponse describe(String token) {
        return toResponse(userForToken(token));
    }

    @Transactional
    public MarketingPreferenceResponse unsubscribe(String token) {
        return apply(userForToken(token), false);
    }

    @Transactional
    public MarketingPreferenceResponse resubscribe(String token) {
        return apply(userForToken(token), true);
    }

    // Logged-in path (Profile page toggle).
    @Transactional
    public MarketingPreferenceResponse setConsent(UUID userId, boolean consent) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return apply(u, consent);
    }

    private MarketingPreferenceResponse apply(User u, boolean consent) {
        if (u.isMarketingConsent() != consent) {
            u.setMarketingConsent(consent);
            u.setMarketingConsentUpdatedAt(LocalDateTime.now());
            userRepository.save(u);
        }
        return toResponse(u);
    }

    private User userForToken(String token) {
        UUID id = tokens.verify(token).orElseThrow(() -> new IllegalArgumentException(INVALID_LINK));
        return userRepository.findById(id).orElseThrow(() -> new IllegalArgumentException(INVALID_LINK));
    }

    private MarketingPreferenceResponse toResponse(User u) {
        String email = u.getEmail();
        int at = email.indexOf('@');
        String masked = at <= 1 ? email : email.charAt(0) + "***" + email.substring(at);
        return new MarketingPreferenceResponse(masked, u.isMarketingConsent());
    }
}