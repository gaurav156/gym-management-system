package com.gymapp.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

// Single place that translates between what's stored in the DB (an object key, or - for
// not-yet-migrated rows - a legacy base64 data URI) and what the API exposes (a URL).
@Component
public class ImageRefs {

    private static final Logger log = LoggerFactory.getLogger(ImageRefs.class);

    private final StorageService storage;

    public ImageRefs(StorageService storage) {
        this.storage = storage;
    }

    // DB value -> API value. Legacy data: URIs pass through untouched until migrated.
    public String toUrl(String stored) {
        if (stored == null || stored.isBlank()) return null;
        if (isLegacy(stored)) return stored;
        return storage.publicUrl(stored);
    }

    // Same null/blank semantics the profile edits already had: null = leave unchanged,
    // blank = clear, anything else = new value. Returns what should be persisted and
    // schedules deletion of the replaced object once the surrounding transaction commits.
    public String resolveForSave(String current, String incoming, ImagePurpose purpose) {
        if (incoming == null) return current;
        if (incoming.isBlank()) {
            deleteAfterCommit(current);
            return null;
        }
        // Client echoing back exactly what it was given (including a legacy data: URI).
        if (current != null && incoming.equals(toUrl(current))) return current;

        if (isLegacy(incoming)) {
            throw new IllegalArgumentException("Upload the image first, then save.");
        }
        String key = storage.keyFromUrl(incoming).orElse(incoming);
        if (!key.startsWith(purpose.prefix()) || key.contains("..")) {
            throw new IllegalArgumentException("Invalid image reference");
        }
        if (!key.equals(current)) deleteAfterCommit(current);
        return key;
    }

    // Safe to call from inside a @Transactional method - the delete only runs if it commits.
    public void deleteAfterCommit(String stored) {
        if (stored == null || stored.isBlank() || isLegacy(stored)) return;
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() { deleteQuietly(stored); }
            });
        } else {
            deleteQuietly(stored);
        }
    }

    private void deleteQuietly(String key) {
        try {
            storage.delete(key);
        } catch (Exception e) {
            // An orphaned object is harmless; failing the user's request over it isn't.
            log.warn("Failed to delete stored image {}: {}", key, e.getMessage());
        }
    }

    private boolean isLegacy(String value) {
        return value.startsWith("data:");
    }
}