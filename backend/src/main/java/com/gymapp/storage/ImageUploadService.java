package com.gymapp.storage;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

@Service
public class ImageUploadService {

    private static final long MAX_IMAGE_BYTES = 2L * 1024 * 1024;
    // Bills are often scanned/photographed invoices - a bit more headroom than a profile
    // photo, capped by the multipart max-request-size in application.yml (5MB).
    private static final long MAX_BILL_BYTES = 5L * 1024 * 1024;

    private record Sniffed(String extension, String contentType) {}

    private final StorageService storage;

    public ImageUploadService(StorageService storage) {
        this.storage = storage;
    }

    // Returns the object KEY (callers convert to a URL via ImageRefs).
    public String upload(MultipartFile file, ImagePurpose purpose) throws IOException {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("No file provided");
        long max = purpose == ImagePurpose.BILL ? MAX_BILL_BYTES : MAX_IMAGE_BYTES;
        if (file.getSize() > max) {
            throw new IllegalArgumentException("File is too large - please use one under "
                    + (max / (1024 * 1024)) + "MB.");
        }
        return storeBytes(file.getBytes(), purpose);
    }

    // Also used by the legacy base64 migrator (PHOTO/SIGNATURE only). Type is decided
    // from the file's magic bytes, never from the client-supplied Content-Type or
    // filename. SVG is deliberately rejected everywhere (it can carry scripts).
    public String storeBytes(byte[] data, ImagePurpose purpose) {
        Sniffed type = sniff(data, purpose);
        String key = purpose.prefix() + UUID.randomUUID() + "." + type.extension();
        storage.put(key, data, type.contentType());
        return key;
    }

    private Sniffed sniff(byte[] d, ImagePurpose purpose) {
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
        // PDF only accepted for bills - a profile photo/signature masquerading as a PDF
        // would break every <img> that renders that stored key elsewhere in the app.
        if (purpose == ImagePurpose.BILL && d.length > 4
                && d[0] == '%' && d[1] == 'P' && d[2] == 'D' && d[3] == 'F') {
            return new Sniffed("pdf", "application/pdf");
        }
        throw new IllegalArgumentException(purpose == ImagePurpose.BILL
                ? "Unsupported file - please use a JPG, PNG, WebP or PDF file."
                : "Unsupported image - please use a JPG, PNG or WebP file.");
    }
}