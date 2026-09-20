package com.gymapp.storage;

import java.util.Optional;

// Everything provider-specific lives behind this. Adding Cloudinary/GCS/etc. later is a
// new @Component with @ConditionalOnProperty(app.storage.provider=<name>) - nothing else changes.
public interface StorageService {

    void put(String key, byte[] data, String contentType);

    // Missing keys are not an error.
    void delete(String key);

    String publicUrl(String key);

    // Reverse of publicUrl - lets clients send back the URL they were given.
    Optional<String> keyFromUrl(String url);
}