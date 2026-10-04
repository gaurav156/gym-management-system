package com.gymapp.controller;

import com.gymapp.backup.BackupExcelService;
import com.gymapp.backup.BackupExportService;
import com.gymapp.backup.BackupImportService;
import com.gymapp.backup.BackupImportService.ImportResult;
import com.gymapp.backup.BackupImportService.Mode;
import com.gymapp.backup.BackupRange;
import com.gymapp.backup.BackupRange.Preset;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.springframework.format.annotation.DateTimeFormat.ISO.DATE;

// Owner-only (covered by /api/owner/** in SecurityConfig; @PreAuthorize is belt-and-braces).
// One backup/export/import at a time - they are long-running and the whole point is to stay light.
@RestController
@RequestMapping("/api/owner/backup")
@PreAuthorize("hasRole('OWNER')")
public class BackupController {

    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmm");

    private final BackupExportService exportService;
    private final BackupExcelService excelService;
    private final BackupImportService importService;
    private final AtomicBoolean busy = new AtomicBoolean(false);

    public BackupController(BackupExportService exportService, BackupExcelService excelService,
                            BackupImportService importService) {
        this.exportService = exportService;
        this.excelService = excelService;
        this.importService = importService;
    }

    @GetMapping("/export")
    public void export(@RequestParam(defaultValue = "ALL") Preset preset,
                       @RequestParam(required = false) @DateTimeFormat(iso = DATE) LocalDate from,
                       @RequestParam(required = false) @DateTimeFormat(iso = DATE) LocalDate to,
                       HttpServletResponse response) throws IOException {
        BackupRange range = BackupRange.of(preset, from, to);   // validates before any bytes are written
        acquire();
        try {
            response.setContentType("application/zip");
            response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"gym-backup-"
                    + preset.name().toLowerCase() + "-" + LocalDateTime.now().format(STAMP) + ".zip\"");
            exportService.export(range, response.getOutputStream());
        } finally {
            busy.set(false);
        }
    }

    @GetMapping("/excel")
    public void excel(@RequestParam(defaultValue = "ALL") Preset preset,
                      @RequestParam(required = false) @DateTimeFormat(iso = DATE) LocalDate from,
                      @RequestParam(required = false) @DateTimeFormat(iso = DATE) LocalDate to,
                      HttpServletResponse response) throws IOException {
        BackupRange range = BackupRange.of(preset, from, to);
        acquire();
        try {
            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"gym-data-"
                    + LocalDateTime.now().format(STAMP) + ".xlsx\"");
            excelService.export(range, response.getOutputStream());
        } finally {
            busy.set(false);
        }
    }

    // Body is the raw .zip (application/octet-stream), streamed - not multipart, so the 5MB multipart
    // limit doesn't apply and nothing is spooled to disk. Default mode is the non-destructive MERGE.
    @PostMapping("/import")
    public ImportResult importBackup(@RequestParam(defaultValue = "MERGE") Mode mode,
                                     @RequestHeader("X-Backup-Password") String password,
                                     HttpServletRequest request, Authentication authentication) throws IOException {
        UUID ownerId = UUID.fromString((String) authentication.getDetails());
        importService.verifyOwnerPassword(ownerId, password);
        acquire();
        try {
            return importService.importBackup(request.getInputStream(), mode);
        } finally {
            busy.set(false);
        }
    }

    private void acquire() {
        if (!busy.compareAndSet(false, true)) {
            throw new IllegalArgumentException("Another backup, export or import is already running - please wait for it to finish");
        }
    }
}