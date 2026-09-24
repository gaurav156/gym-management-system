package com.gymapp.storage;

public enum ImagePurpose {
    PHOTO("avatars/"),
    SIGNATURE("signatures/"),
    // Bills/invoices attached to an expense - unlike PHOTO/SIGNATURE this may be a PDF,
    // not just an image (see ImageUploadService.sniff()).
    BILL("bills/"),
    // Product catalog images - unlike PHOTO/SIGNATURE a product can have several, held as
    // an ordered list on the entity (see Product.imageKeys) rather than a single field.
    PRODUCT("products/");

    private final String prefix;

    ImagePurpose(String prefix) { this.prefix = prefix; }

    public String prefix() { return prefix; }
}