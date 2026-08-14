package com.gymapp.entity;

// PRODUCT is reserved for when Products/Inventory + Orders lands - orders will write
// Payment rows the same way membership purchases do now, just with type=PRODUCT.
public enum PaymentType {
    MEMBERSHIP, PRODUCT
}