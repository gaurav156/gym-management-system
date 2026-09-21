package com.gymapp.storage;

import com.gymapp.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

// Removes stored images that no user row references any more - most commonly an image that
// was uploaded in an edit form which was then abandoned without saving. ImageRefs already
// deletes the OLD image when a save replaces it; this is the backstop for everything else
// (abandoned forms, failed deletes, rolled-back transactions).
//
// Safety rails, because a bug here deletes user data:
//  - only objects older than min-age-hours are touched, so an upload whose form is still open
//    (or was saved moments ago) is never at risk;
//  - only our own prefixes (avatars/, signatures/) are listed, never the whole bucket;
//  - if more than max-delete objects look orphaned the run aborts and logs an error - that
//    pattern means "wrong database" or "empty database", not genuinely abandoned uploads;
//  - dry-run logs what would be deleted without deleting anything.
// NEVER point two environments' databases at the same bucket while this job is enabled: each
// would treat the other's images as orphans.
@Component
@ConditionalOnProperty(name = "app.storage.cleanup.enabled", havingValue = "true", matchIfMissing = true)
public class OrphanImageCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(OrphanImageCleanupJob.class);

    private final StorageService storage;
    private final UserRepository userRepository;

    @Value("${app.storage.cleanup.min-age-hours:24}")
    private long minAgeHours;

    @Value("${app.storage.cleanup.max-delete:200}")
    private int maxDelete;

    @Value("${app.storage.cleanup.dry-run:false}")
    private boolean dryRun;

    public OrphanImageCleanupJob(StorageService storage, UserRepository userRepository) {
        this.storage = storage;
        this.userRepository = userRepository;
    }

    @Scheduled(cron = "${app.storage.cleanup.cron:0 30 3 * * *}")
    public void cleanupOrphans() {
        // Load references first, then list: anything saved after this point is newer than the
        // age cutoff, so it can't be selected below.
        Set<String> referenced = new HashSet<>(userRepository.findAllPhotoKeys());
        referenced.addAll(userRepository.findAllSignatureKeys());

        Instant cutoff = Instant.now().minus(minAgeHours, ChronoUnit.HOURS);
        List<String> orphans = new ArrayList<>();
        for (ImagePurpose purpose : ImagePurpose.values()) {
            for (StorageService.StoredObject obj : storage.list(purpose.prefix())) {
                if (!referenced.contains(obj.key()) && obj.lastModified().isBefore(cutoff)) {
                    orphans.add(obj.key());
                }
            }
        }

        if (orphans.isEmpty()) return;

        if (orphans.size() > maxDelete) {
            log.error("Orphan image cleanup ABORTED: {} unreferenced objects exceeds max-delete={}. " +
                    "This usually means the wrong/empty database or bucket. Review, then raise " +
                    "STORAGE_CLEANUP_MAX_DELETE if it's genuine.", orphans.size(), maxDelete);
            return;
        }

        if (dryRun) {
            log.info("Orphan image cleanup (dry run) - would delete {} object(s): {}", orphans.size(), orphans);
            return;
        }

        int deleted = 0;
        for (String key : orphans) {
            try {
                storage.delete(key);
                deleted++;
            } catch (Exception e) {
                log.warn("Failed to delete orphaned image {}: {}", key, e.getMessage());
            }
        }
        log.info("Orphan image cleanup: deleted {} of {} orphaned object(s)", deleted, orphans.size());
    }
}