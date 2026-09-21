package com.gymapp.storage;

import jakarta.annotation.PreDestroy;
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
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

// One implementation covers MinIO, Cloudflare R2, AWS S3, Backblaze B2, Supabase Storage -
// only endpoint/region/credentials/path-style differ (all env vars, see application.yml).
@Component
@ConditionalOnProperty(name = "app.storage.provider", havingValue = "s3", matchIfMissing = true)
public class S3StorageService implements StorageService {

    private final S3Client s3;
    private final String bucket;
    private final String publicBaseUrl;

    public S3StorageService(@Value("${app.storage.s3.endpoint:}") String endpoint,
                            @Value("${app.storage.s3.region}") String region,
                            @Value("${app.storage.s3.bucket}") String bucket,
                            @Value("${app.storage.s3.access-key}") String accessKey,
                            @Value("${app.storage.s3.secret-key}") String secretKey,
                            @Value("${app.storage.s3.path-style:false}") boolean pathStyle,
                            @Value("${app.storage.public-base-url}") String publicBaseUrl) {
        this.bucket = bucket;
        this.publicBaseUrl = publicBaseUrl.replaceAll("/+$", "");

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

    @Override
    public void put(String key, byte[] data, String contentType) {
        s3.putObject(PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(key)
                        .contentType(contentType)
                        // Keys contain a random UUID and are never overwritten, so they're safe to cache forever.
                        .cacheControl("public, max-age=31536000, immutable")
                        .build(),
                RequestBody.fromBytes(data));
    }

    @Override
    public void delete(String key) {
        s3.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
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
           s3.listObjectsV2Paginator(ListObjectsV2Request.builder().bucket(bucket).prefix(prefix).build())
               .contents()
               .forEach(o -> out.add(new StoredObject(o.key(), o.lastModified())));
           return out;
    }

    @PreDestroy
    void close() {
        s3.close();
    }
}