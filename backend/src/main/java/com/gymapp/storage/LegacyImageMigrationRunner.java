package com.gymapp.storage;

import com.gymapp.entity.User;
import com.gymapp.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Base64;
import java.util.List;
import java.util.UUID;

// One-shot: set STORAGE_MIGRATE_LEGACY=true, start the app once, then set it back to false.
// Idempotent - migrated rows no longer match the "data:" query, and one user failing
// doesn't stop the rest. Back up the DB first.
@Component
@ConditionalOnProperty(name = "app.storage.migrate-legacy", havingValue = "true")
public class LegacyImageMigrationRunner implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(LegacyImageMigrationRunner.class);

    private final UserRepository userRepository;
    private final ImageUploadService imageUploadService;
    private final TransactionTemplate tx;

    public LegacyImageMigrationRunner(UserRepository userRepository,
                                      ImageUploadService imageUploadService,
                                      PlatformTransactionManager transactionManager) {
        this.userRepository = userRepository;
        this.imageUploadService = imageUploadService;
        this.tx = new TransactionTemplate(transactionManager);
    }

    @Override
    public void run(String... args) {
        List<UUID> ids = userRepository.findIdsWithLegacyImages();
        log.info("Legacy image migration: {} user(s) to convert", ids.size());
        int ok = 0, failed = 0;

        for (UUID id : ids) {
            try {
                tx.executeWithoutResult(status -> {
                    User u = userRepository.findById(id).orElseThrow();
                    if (isLegacy(u.getPhoto())) u.setPhoto(migrate(u.getPhoto(), ImagePurpose.PHOTO));
                    if (isLegacy(u.getSignature())) u.setSignature(migrate(u.getSignature(), ImagePurpose.SIGNATURE));
                    userRepository.save(u);
                });
                ok++;
            } catch (Exception e) {
                failed++;
                log.error("Legacy image migration failed for user {}: {}", id, e.getMessage());
            }
        }
        log.info("Legacy image migration done: {} converted, {} failed. Set STORAGE_MIGRATE_LEGACY=false now.", ok, failed);
    }

    private boolean isLegacy(String v) {
        return v != null && v.startsWith("data:");
    }

    private String migrate(String dataUri, ImagePurpose purpose) {
        int comma = dataUri.indexOf(',');
        if (comma < 0 || !dataUri.substring(0, comma).contains(";base64")) {
            throw new IllegalArgumentException("Unrecognised data URI");
        }
        byte[] bytes = Base64.getMimeDecoder().decode(dataUri.substring(comma + 1));
        return imageUploadService.storeBytes(bytes, purpose);
    }
}