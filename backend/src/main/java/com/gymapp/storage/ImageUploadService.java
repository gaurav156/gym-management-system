package com.gymapp.storage;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

@Service
public class ImageUploadService {

    private static final long MAX_BYTES = 2L * 1024 * 1024;

    private record Sniffed(String extension, String contentType) {}

    private final StorageService storage;

    public ImageUploadService(StorageService storage) {
        this.storage = storage;
    }

    // Returns the object KEY (callers convert to a URL via ImageRefs).
    public String upload(MultipartFile file, ImagePurpose purpose) throws IOException {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("No file provided");
        if (file.getSize() > MAX_BYTES) throw new IllegalArgumentException("Image is too large - please use one under 2MB.");
        return storeBytes(file.getBytes(), purpose);
    }

    // Also used by the legacy base64 migrator. Type is decided from the file's magic bytes,
    // never from the client-supplied Content-Type or filename. SVG is deliberately rejected
    // (it can carry scripts).
    public String storeBytes(byte[] data, ImagePurpose purpose) {
        Sniffed type = sniff(data);
        String key = purpose.prefix() + UUID.randomUUID() + "." + type.extension();
        storage.put(key, data, type.contentType());
        return key;
    }

    private Sniffed sniff(byte[] d) {
        if (d.length > 12) {
            if ((d[0] & 0xFF) == 0xFF && (d[1] & 0xFF) == 0xD8 && (d[2] & 0xFF) == 0xFF) {
                return new Sniffed("jpg", "image/jpeg");
            }
            if ((d[0] & 0xFF) == 0x89 && d[1] == 'P' && d[2] == 'N' && d[3] == 'G') {
                return new Sniffed("png", "image/png");
            }
            if (d[0] == 'R' && d[1] == 'I' && d[2] == 'F' && d[3] == 'F'
                    && d[8] == 'W' && d[9] == 'E' && d[10] == 'B' && d[11] == 'P') {
                return new Sniffed("webp", "image/webp");
            }
        }
        throw new IllegalArgumentException("Unsupported image - please use a JPG, PNG or WebP file.");
    }
}