package com.gymapp.controller;

import com.gymapp.dto.MarketingDtos.MarketingPreferenceResponse;
import com.gymapp.service.MarketingConsentService;
import org.springframework.web.bind.annotation.*;

// Public - the token in the email link IS the credential (signed, unforgeable). Changes are POST
// so mail-scanner link prefetching (GET) can never unsubscribe anyone by accident.
@RestController
@RequestMapping("/api/public/marketing")
public class MarketingPreferenceController {

    private final MarketingConsentService service;

    public MarketingPreferenceController(MarketingConsentService service) {
        this.service = service;
    }

    @GetMapping("/preference")
    public MarketingPreferenceResponse preference(@RequestParam String token) {
        return service.describe(token);
    }

    @PostMapping("/unsubscribe")
    public MarketingPreferenceResponse unsubscribe(@RequestParam String token) {
        return service.unsubscribe(token);
    }

    @PostMapping("/resubscribe")
    public MarketingPreferenceResponse resubscribe(@RequestParam String token) {
        return service.resubscribe(token);
    }
}