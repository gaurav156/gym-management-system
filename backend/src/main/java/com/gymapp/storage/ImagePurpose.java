package com.gymapp.storage;

public enum ImagePurpose {
    PHOTO("avatars/"),
    SIGNATURE("signatures/"),
    // Bills/invoices attached to an expense - unlike PHOTO/SIGNATURE this may be a PDF,
    // not just an image (see ImageUploadService.sniff()).
    BILL("bills/");

    private final String prefix;

    ImagePurpose(String prefix) { this.prefix = prefix; }

    public String prefix() { return prefix; }
}