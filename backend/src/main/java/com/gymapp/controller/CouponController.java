package com.gymapp.controller;

import com.gymapp.dto.CouponDtos.*;
import com.gymapp.service.CouponService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/coupons")
public class CouponController {

    private final CouponService couponService;

    public CouponController(CouponService couponService) {
        this.couponService = couponService;
    }

    @PostMapping("/manage")
    @PreAuthorize("hasRole('OWNER')")
    public CouponResponse create(@Valid @RequestBody CreateCouponRequest req) {
        return couponService.create(req);
    }

    @PutMapping("/manage/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public CouponResponse update(@PathVariable UUID id, @RequestBody UpdateCouponRequest req) {
        return couponService.update(id, req);
    }

    @GetMapping("/manage")
    @PreAuthorize("hasRole('OWNER')")
    public List<CouponResponse> list() {
        return couponService.list();
    }

    // Owner/Manager at the front desk checking a code before recording a sale.
    @PostMapping("/validate")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public ValidateCouponResponse validate(@Valid @RequestBody ValidateCouponRequest req) {
        return couponService.validate(req.code(), req.memberId());
    }

    @DeleteMapping("/manage/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public void delete(@PathVariable UUID id) {
        couponService.delete(id);
    }
}