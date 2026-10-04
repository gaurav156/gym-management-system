package com.gymapp.backup;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.MappingIterator;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.gymapp.entity.User;
import com.gymapp.repository.UserRepository;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.io.BufferedInputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.ResultSetMetaData;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

// Streams the zip: entry -> row (one JSON line) -> JDBC batch. Whole import is ONE transaction,
// so a bad file or a constraint failure leaves the database exactly as it was.
@Service
public class BackupImportService {

    public enum Mode { MERGE, REPLACE }

    public record TableResult(String table, long read, long inserted) {}
    public record ImportResult(String mode, String backupCreatedAt, String preset, List<TableResult> tables) {}

    private static final int BATCH = 500;
    private static final Pattern ENTRY = Pattern.compile("^data/([a-z_]+)\\.ndjson$");
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private record Col(String type, int sqlType) {}

    private final JdbcTemplate jdbc;
    private final PlatformTransactionManager txManager;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public BackupImportService(DataSource dataSource, PlatformTransactionManager txManager,
                               UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.jdbc = new JdbcTemplate(dataSource);
        this.txManager = txManager;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // Destructive operation - re-confirm the Owner's password. Surfaces as 400, never 403
    // (api/client.ts treats 403 as "access changed" and logs the user out).
    public void verifyOwnerPassword(UUID ownerId, String password) {
        User u = userRepository.findById(ownerId).orElseThrow(() -> new IllegalArgumentException("Caller not found"));
        if (password == null || !passwordEncoder.matches(password, u.getPasswordHash())) {
            throw new IllegalArgumentException("Incorrect password");
        }
    }

    public ImportResult importBackup(InputStream raw, Mode mode) {
        try (ZipInputStream zin = new ZipInputStream(new BufferedInputStream(raw))) {
            ZipEntry first = zin.getNextEntry();
            if (first == null || !first.getName().equals("manifest.json")) {
                throw new IllegalArgumentException("This is not a valid backup file");
            }
            JsonNode manifest = MAPPER.readTree(shield(zin));
            if (!BackupExportService.FORMAT.equals(manifest.path("format").asText())) {
                throw new IllegalArgumentException("Unsupported backup format");
            }
            String current = BackupTables.schemaVersion(jdbc);
            String backupVersion = manifest.path("schemaVersion").asText();
            if (!current.equals(backupVersion)) {
                throw new IllegalArgumentException("Schema version mismatch - backup is v" + backupVersion
                        + " but this database is v" + current + ". Run the same app version on both sides.");
            }

            List<TableResult> results = new TransactionTemplate(txManager)
                    .execute(status -> run(zin, mode));
            return new ImportResult(mode.name(), manifest.path("createdAt").asText(null),
                    manifest.path("preset").asText(null), results);
        } catch (IOException | UncheckedIOException e) {
            throw new IllegalArgumentException("The backup file is unreadable or incomplete");
        } catch (DataAccessException e) {
            Throwable root = e.getMostSpecificCause();
            throw new IllegalArgumentException("Import failed and was rolled back: " + root.getMessage());
        }
    }

    private List<TableResult> run(ZipInputStream zin, Mode mode) {
        try {
            if (mode == Mode.REPLACE) {
                // CASCADE also clears the OTP tables that reference users.
                jdbc.execute("TRUNCATE TABLE " + String.join(", ", BackupTables.NAMES) + " CASCADE");
            }

            Map<String, long[]> stats = new LinkedHashMap<>();
            JsonNode summary = null;
            ZipEntry e;
            while ((e = zin.getNextEntry()) != null) {
                if (e.getName().equals("summary.json")) {
                    summary = MAPPER.readTree(shield(zin));
                    continue;
                }
                Matcher m = ENTRY.matcher(e.getName());
                if (!m.matches() || !BackupTables.NAMES.contains(m.group(1))) {
                    throw new IllegalArgumentException("Unexpected entry in backup: " + e.getName());
                }
                stats.put(m.group(1), loadTable(m.group(1), shield(zin), mode));
            }

            if (summary == null) throw new IllegalArgumentException("The backup file is incomplete (no summary)");
            JsonNode expected = summary.path("rowCounts");
            for (BackupTables.Spec spec : BackupTables.ORDERED) {
                long read = stats.getOrDefault(spec.table(), new long[]{0, 0})[0];
                if (expected.path(spec.table()).asLong(-1) != read) {
                    throw new IllegalArgumentException("Row count mismatch for " + spec.table() + " - the file is corrupted");
                }
            }

            // Rows were inserted with explicit invoice numbers - move the sequences past them.
            jdbc.execute("SELECT setval('invoice_seq', GREATEST((SELECT COALESCE(MAX(invoice_seq), 0) FROM payments), 1))");
            jdbc.execute("SELECT setval('product_order_seq', GREATEST((SELECT COALESCE(MAX(invoice_seq), 0) FROM product_orders), 1))");

            List<TableResult> out = new ArrayList<>();
            stats.forEach((t, s) -> out.add(new TableResult(t, s[0], s[1])));
            return out;
        } catch (IOException ex) {
            throw new UncheckedIOException(ex);
        }
    }

    // returns {rowsRead, rowsInserted}
    private long[] loadTable(String table, InputStream in, Mode mode) throws IOException {
        Map<String, Col> cols = columnsOf(table);
        long[] stats = {0, 0};

        try (MappingIterator<ObjectNode> rows = MAPPER.readerFor(ObjectNode.class).readValues(in)) {
            jdbc.execute((java.sql.Connection con) -> {
                PreparedStatement ps = null;
                List<String> names = null;
                int pending = 0;
                try {
                    while (rows.hasNextValue()) {
                        ObjectNode row = rows.nextValue();
                        if (ps == null) {
                            names = new ArrayList<>();
                            row.fieldNames().forEachRemaining(names::add);
                            for (String n : names) {
                                if (!cols.containsKey(n)) throw new IllegalArgumentException("Unknown column " + table + "." + n);
                            }
                            StringBuilder sql = new StringBuilder("INSERT INTO ").append(table).append(" (");
                            sql.append(String.join(",", names.stream().map(n -> "\"" + n + "\"").toList()));
                            sql.append(") VALUES (").append("?,".repeat(names.size()), 0, names.size() * 2 - 1).append(")");
                            if (mode == Mode.MERGE) sql.append(" ON CONFLICT DO NOTHING");
                            ps = con.prepareStatement(sql.toString());
                        }
                        if (row.size() != names.size()) throw new IllegalArgumentException("Inconsistent rows in " + table);
                        for (int i = 0; i < names.size(); i++) {
                            Col c = cols.get(names.get(i));
                            Object v = convert(row.get(names.get(i)), c.type());
                            if (v == null) ps.setNull(i + 1, c.sqlType()); else ps.setObject(i + 1, v);
                        }
                        ps.addBatch();
                        stats[0]++;
                        if (++pending == BATCH) { stats[1] += flush(ps); pending = 0; }
                    }
                    if (pending > 0) stats[1] += flush(ps);
                } catch (IOException e) {
                    throw new UncheckedIOException(e);
                } finally {
                    if (ps != null) ps.close();
                }
                return null;
            });
        }
        return stats;
    }

    private static long flush(PreparedStatement ps) throws java.sql.SQLException {
        long inserted = 0;
        for (int r : ps.executeBatch()) if (r != 0) inserted++;   // 0 = skipped by ON CONFLICT
        return inserted;
    }

    // Column names/types come from the live table, never from the file.
    private Map<String, Col> columnsOf(String table) {
        return jdbc.query("SELECT * FROM " + table + " WHERE false", rs -> {
            ResultSetMetaData md = rs.getMetaData();
            Map<String, Col> m = new LinkedHashMap<>();
            for (int i = 1; i <= md.getColumnCount(); i++) {
                m.put(md.getColumnName(i), new Col(md.getColumnTypeName(i).toLowerCase(), md.getColumnType(i)));
            }
            return m;
        });
    }

    private static Object convert(JsonNode v, String type) {
        if (v == null || v.isNull()) return null;
        return switch (type) {
            case "uuid" -> UUID.fromString(v.asText());
            case "timestamp", "timestamptz" -> LocalDateTime.parse(v.asText());
            case "date" -> LocalDate.parse(v.asText());
            case "numeric" -> new BigDecimal(v.asText());
            case "int2", "int4" -> (int) v.asLong();
            case "int8" -> v.asLong();
            case "bool" -> v.asBoolean();
            default -> v.asText();
        };
    }

    // Jackson / the zip must not close the shared ZipInputStream between entries.
    private static InputStream shield(InputStream in) {
        return new FilterInputStream(in) { @Override public void close() { } };
    }
}