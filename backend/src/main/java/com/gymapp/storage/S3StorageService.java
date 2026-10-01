package com.gymapp.storage;

import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

// One implementation covers MinIO, Cloudflare R2, AWS S3, Backblaze B2, Supabase Storage -
// only endpoint/region/credentials/path-style differ (all env vars, see application.yml).
//
// Two buckets, same endpoint and credentials: the main (public-read) bucket for avatars,
// signatures, products and bills, and an optional PRIVATE bucket for ID proofs. A key is
// routed by its prefix (see bucketFor), so callers never choose a bucket. The private
// bucket must never have public read - ID proofs are only served through
// GET /api/id-proofs/{userId}, which checks who is asking.
@Component
@ConditionalOnProperty(name = "app.storage.provider", havingValue = "s3", matchIfMissing = true)
public class S3StorageService implements StorageService {

    private static final Logger log = LoggerFactory.getLogger(S3StorageService.class);
    private static final String PRIVATE_PREFIX = ImagePurpose.ID_PROOF.prefix();

    private final S3Client s3;
    private final String bucket;
    private final String privateBucket; // null = not configured, ID proofs share the main bucket
    private final String publicBaseUrl;

    public S3StorageService(@Value("${app.storage.s3.endpoint:}") String endpoint,
                            @Value("${app.storage.s3.region}") String region,
                            @Value("${app.storage.s3.bucket}") String bucket,
                            @Value("${app.storage.s3.private-bucket:}") String privateBucket,
                            @Value("${app.storage.s3.access-key}") String accessKey,
                            @Value("${app.storage.s3.secret-key}") String secretKey,
                            @Value("${app.storage.s3.path-style:false}") boolean pathStyle,
                            @Value("${app.storage.public-base-url}") String publicBaseUrl) {
        this.bucket = bucket;
        this.privateBucket = (privateBucket == null || privateBucket.isBlank()) ? null : privateBucket.trim();
        this.publicBaseUrl = publicBaseUrl.replaceAll("/+$", "");

        if (this.privateBucket == null) {
            log.warn("STORAGE_S3_PRIVATE_BUCKET is not set - ID proofs will be stored in the main bucket '{}'. " +
                    "Make sure '{}' is NOT publicly readable there, or set a private bucket.", bucket, PRIVATE_PREFIX);
        }

        S3ClientBuilder builder = S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(pathStyle).build())
                // Newer SDKs add CRC checksums by default, which several S3-compatible
                // services (older MinIO, B2, some R2 setups) reject - only send when required.
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED);
        if (endpoint != null && !endpoint.isBlank()) {
            builder.endpointOverride(URI.create(endpoint));
        }
        this.s3 = builder.build();
    }

    // Works for a full key or just a prefix (list()).
    private String bucketFor(String keyOrPrefix) {
        return privateBucket != null && keyOrPrefix.startsWith(PRIVATE_PREFIX) ? privateBucket : bucket;
    }

    @Override
    public void put(String key, byte[] data, String contentType) {
        boolean isPrivate = bucketFor(key).equals(privateBucket);
        s3.putObject(PutObjectRequest.builder()
                        .bucket(bucketFor(key))
                        .key(key)
                        .contentType(contentType)
                        // Public objects have random-UUID keys that are never overwritten, so
                        // they're safe to cache forever. Private ones must never be cached.
                        .cacheControl(isPrivate ? "private, no-store" : "public, max-age=31536000, immutable")
                        .build(),
                RequestBody.fromBytes(data));
    }

    @Override
    public void delete(String key) {
        s3.deleteObject(DeleteObjectRequest.builder().bucket(bucketFor(key)).key(key).build());
    }

    @Override
    public StoredFile get(String key) {
        var resp = s3.getObjectAsBytes(GetObjectRequest.builder().bucket(bucketFor(key)).key(key).build());
        String type = resp.response().contentType();
        return new StoredFile(resp.asByteArray(), type != null ? type : "application/octet-stream");
    }

    @Override
    public String publicUrl(String key) {
        return publicBaseUrl + "/" + key;
    }

    @Override
    public Optional<String> keyFromUrl(String url) {
        String prefix = publicBaseUrl + "/";
        return url.startsWith(prefix) ? Optional.of(url.substring(prefix.length())) : Optional.empty();
    }

    @Override
    public List<StoredObject> list(String prefix) {
        List<StoredObject> out = new ArrayList<>();
        s3.listObjectsV2Paginator(ListObjectsV2Request.builder().bucket(bucketFor(prefix)).prefix(prefix).build())
                .contents()
                .forEach(o -> out.add(new StoredObject(o.key(), o.lastModified())));
        return out;
    }

    @PreDestroy
    void close() {
        s3.close();
    }
}