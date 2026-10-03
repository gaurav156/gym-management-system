package com.gymapp.storage;

public enum ImagePurpose {
    PHOTO("avatars/"),
    SIGNATURE("signatures/"),
    // Bills/invoices attached to an expense - unlike PHOTO/SIGNATURE this may be a PDF,
    // not just an image (see ImageUploadService.sniff()).
    BILL("bills/"),
    // Identity documents (image or PDF). Unlike every other purpose these are never
    // returned as public URLs - see FileController and IdProofService.
    ID_PROOF("id-proofs/"),
    // Product catalog images - unlike PHOTO/SIGNATURE a product can have several, held as
    // an ordered list on the entity (see Product.imageKeys) rather than a single field.
    PRODUCT("products/"),
    // Owner-only broadcast files. Images are public (emails load them by URL); attachments live in
    // the same public bucket under unguessable names. Both are protected from the orphan job via
    // broadcast_assets - see OrphanImageCleanupJob.
    BROADCAST_IMAGE("broadcast-images/"),
    BROADCAST_ATTACHMENT("broadcast-attachments/");

    private final String prefix;

    ImagePurpose(String prefix) { this.prefix = prefix; }

    public String prefix() { return prefix; }
}