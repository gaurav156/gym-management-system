package com.gymapp.controller;

import com.gymapp.dto.BroadcastDtos.*;
import com.gymapp.dto.PageDtos.PageResponse;
import com.gymapp.entity.BroadcastAudience;
import com.gymapp.entity.BroadcastChannel;
import com.gymapp.entity.BroadcastRecipientStatus;
import com.gymapp.entity.BroadcastType;
import com.gymapp.service.BroadcastService;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

// Owner-only. Lives under /api/owner/** so the existing hasRole('OWNER') matcher in
// SecurityConfig already covers it; @PreAuthorize is belt-and-braces.
@RestController
@RequestMapping("/api/owner/broadcasts")
@PreAuthorize("hasRole('OWNER')")
public class BroadcastController {

    private final BroadcastService broadcastService;

    public BroadcastController(BroadcastService broadcastService) {
        this.broadcastService = broadcastService;
    }

    @PostMapping
    public BroadcastResponse create(@Valid @RequestBody CreateBroadcastRequest req, Authentication authentication) {
        UUID ownerId = UUID.fromString((String) authentication.getDetails());
        return broadcastService.create(ownerId, req);
    }

    @GetMapping
    public PageResponse<BroadcastResponse> list(@RequestParam(defaultValue = "0") int page,
                                                @RequestParam(defaultValue = "10") int size) {
        return broadcastService.list(PageRequest.of(page, size));
    }

    @GetMapping("/channels")
    public List<ChannelAvailability> channels() {
        return broadcastService.channels();
    }

    @GetMapping("/preview")
    public BroadcastPreviewResponse preview(@RequestParam BroadcastAudience audience,
                                            @RequestParam BroadcastChannel channel,
                                            @RequestParam BroadcastType type) {
        return broadcastService.preview(audience, channel, type);
    }

    // Exact HTML/text a recipient would get - powers the live preview.
    @PostMapping("/render")
    public RenderedBroadcastResponse render(@Valid @RequestBody CreateBroadcastRequest req) {
        return broadcastService.render(req);
    }

    // Emails the rendered message to the Owner's own address only.
    @PostMapping("/test")
    public java.util.Map<String, String> test(@Valid @RequestBody CreateBroadcastRequest req, Authentication authentication) {
        UUID ownerId = UUID.fromString((String) authentication.getDetails());
        broadcastService.sendTest(ownerId, req);
        return java.util.Map.of("message", "Test email sent to your own address.");
    }

    @GetMapping("/{id}/recipients")
    public PageResponse<BroadcastRecipientResponse> recipients(@PathVariable UUID id,
                                                               @RequestParam(required = false) BroadcastRecipientStatus status,
                                                               @RequestParam(defaultValue = "0") int page,
                                                               @RequestParam(defaultValue = "10") int size) {
        return broadcastService.listRecipients(id, status, PageRequest.of(page, size));
    }
}