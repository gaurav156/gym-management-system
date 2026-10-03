package com.gymapp.dto;

import jakarta.validation.constraints.NotNull;

public class MarketingDtos {

    // email is masked (o***@domain) - the unsubscribe page is public, so it never shows a full address.
    public record MarketingPreferenceResponse(String email, boolean subscribed) {}

    public record UpdateMarketingConsentRequest(@NotNull Boolean consent) {}
}