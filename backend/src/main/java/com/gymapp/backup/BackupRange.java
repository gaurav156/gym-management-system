package com.gymapp.backup;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record BackupRange(Preset preset, LocalDate from, LocalDate to) {

    public enum Preset { ALL, LAST_6_MONTHS, LAST_12_MONTHS, CUSTOM }

    private static final LocalDate MIN = LocalDate.of(1900, 1, 1);
    private static final LocalDate MAX = LocalDate.of(2999, 12, 31);

    public static BackupRange of(Preset preset, LocalDate from, LocalDate to) {
        LocalDate today = LocalDate.now();
        return switch (preset) {
            case ALL -> new BackupRange(preset, null, null);
            case LAST_6_MONTHS -> new BackupRange(preset, today.minusMonths(6), today);
            case LAST_12_MONTHS -> new BackupRange(preset, today.minusYears(1), today);
            case CUSTOM -> {
                if (from == null || to == null) throw new IllegalArgumentException("Select both a start and an end date");
                if (to.isBefore(from)) throw new IllegalArgumentException("End date cannot be before start date");
                yield new BackupRange(preset, from, to);
            }
        };
    }

    public boolean isAll() { return preset == Preset.ALL; }

    // Date-range bounds used by the SQL specs. "All" maps to sentinel bounds (used by Excel only).
    public LocalDate fromD() { return from != null ? from : MIN; }
    public LocalDate toD() { return to != null ? to : MAX; }
    public LocalDateTime fromTs() { return fromD().atStartOfDay(); }
    public LocalDateTime toTsExclusive() { return toD().plusDays(1).atStartOfDay(); }
}