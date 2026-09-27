package com.gymapp.entity;

// Which purchase flow(s) a coupon is valid for. PRODUCT is the original/default (so every
// coupon created before this existed keeps working exactly as it did). Checked in
// CouponService before a coupon is allowed to apply to a given purchase.
public enum CouponAppliesTo {
    PRODUCT, MEMBERSHIP, BOTH
}