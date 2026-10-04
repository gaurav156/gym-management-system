package com.gymapp.backup;

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.StreamWriteFeature;
import com.fasterxml.jackson.core.io.SerializedString;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.sql.ResultSetMetaData;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

// Streams a consistent snapshot straight into the response: cursor-based reads (fetchSize) ->
// one JSON line per row -> zip -> socket. Nothing is accumulated, so memory stays flat.
@Service
public class BackupExportService {

    static final String FORMAT = "gym-backup-v1";
    private static final int FETCH_SIZE = 500;
    private static final JsonFactory JSON = JsonFactory.builder()
            .disable(StreamWriteFeature.AUTO_CLOSE_TARGET)
            .build();
    private static final ObjectMapper MAPPER = new ObjectMapper().findAndRegisterModules();

    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate named;
    private final PlatformTransactionManager txManager;

    public BackupExportService(DataSource dataSource, PlatformTransactionManager txManager) {
        this.jdbc = new JdbcTemplate(dataSource);
        this.jdbc.setFetchSize(FETCH_SIZE);
        this.named = new NamedParameterJdbcTemplate(jdbc);
        this.txManager = txManager;
    }

    public void export(BackupRange range, OutputStream out) throws IOException {
        TransactionTemplate tx = new TransactionTemplate(txManager);
        tx.setReadOnly(true);
        // One snapshot for the whole export, so related tables are always consistent.
        tx.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);

        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            tx.executeWithoutResult(status -> {
                try {
                    writeAll(zip, range);
                } catch (IOException e) {
                    throw new UncheckedIOException(e);
                }
            });
        } catch (UncheckedIOException e) {
            throw e.getCause();
        }
    }

    private void writeAll(ZipOutputStream zip, BackupRange range) throws IOException {
        Map<String, Object> manifest = new LinkedHashMap<>();
        manifest.put("format", FORMAT);
        manifest.put("createdAt", LocalDateTime.now().toString());
        manifest.put("schemaVersion", BackupTables.schemaVersion(jdbc));
        manifest.put("preset", range.preset().name());
        manifest.put("from", range.from() == null ? null : range.from().toString());
        manifest.put("to", range.to() == null ? null : range.to().toString());
        manifest.put("tables", BackupTables.ORDERED.stream().map(BackupTables.Spec::table).toList());
        zip.putNextEntry(new ZipEntry("manifest.json"));
        zip.write(MAPPER.writeValueAsBytes(manifest));
        zip.closeEntry();

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("fromTs", range.fromTs()).addValue("toTs", range.toTsExclusive())
                .addValue("fromD", range.fromD()).addValue("toD", range.toD());

        Map<String, Long> counts = new LinkedHashMap<>();
        for (BackupTables.Spec spec : BackupTables.ORDERED) {
            zip.putNextEntry(new ZipEntry("data/" + spec.table() + ".ndjson"));
            counts.put(spec.table(), writeTable(zip, range.isAll() ? spec.all() : spec.ranged(), params));
            zip.closeEntry();
        }

        // Written last: import uses it to detect a truncated/incomplete file.
        zip.putNextEntry(new ZipEntry("summary.json"));
        zip.write(MAPPER.writeValueAsBytes(Map.of("rowCounts", counts)));
        zip.closeEntry();
    }

    private long writeTable(ZipOutputStream zip, String sql, MapSqlParameterSource params) throws IOException {
        long[] count = {0};
        try (JsonGenerator g = JSON.createGenerator(zip)) {
            g.setRootValueSeparator(new SerializedString("\n"));
            String[][] meta = new String[2][];   // [0] = names, [1] = type names

            named.query(sql, params, rs -> {
                try {
                    if (meta[0] == null) {
                        ResultSetMetaData md = rs.getMetaData();
                        int n = md.getColumnCount();
                        meta[0] = new String[n];
                        meta[1] = new String[n];
                        for (int i = 0; i < n; i++) {
                            meta[0][i] = md.getColumnName(i + 1);
                            meta[1][i] = md.getColumnTypeName(i + 1).toLowerCase();
                        }
                    }
                    g.writeStartObject();
                    for (int i = 0; i < meta[0].length; i++) {
                        g.writeFieldName(meta[0][i]);
                        writeValue(g, rs, i + 1, meta[1][i]);
                    }
                    g.writeEndObject();
                    count[0]++;
                } catch (IOException e) {
                    throw new UncheckedIOException(e);
                }
            });
            g.flush();
        }
        return count[0];
    }

    // Every value is written in a form that round-trips exactly: numerics and temporals as
    // strings, so there is no float or timezone drift between databases.
    private static void writeValue(JsonGenerator g, java.sql.ResultSet rs, int i, String type)
            throws java.sql.SQLException, IOException {
        switch (type) {
            case "timestamp", "timestamptz" -> {
                LocalDateTime v = rs.getObject(i, LocalDateTime.class);
                if (v == null) g.writeNull(); else g.writeString(v.toString());
            }
            case "date" -> {
                LocalDate v = rs.getObject(i, LocalDate.class);
                if (v == null) g.writeNull(); else g.writeString(v.toString());
            }
            case "numeric" -> {
                java.math.BigDecimal v = rs.getBigDecimal(i);
                if (v == null) g.writeNull(); else g.writeString(v.toPlainString());
            }
            case "int2", "int4", "int8", "serial", "bigserial" -> {
                long v = rs.getLong(i);
                if (rs.wasNull()) g.writeNull(); else g.writeNumber(v);
            }
            case "bool" -> {
                boolean v = rs.getBoolean(i);
                if (rs.wasNull()) g.writeNull(); else g.writeBoolean(v);
            }
            default -> {
                String v = rs.getString(i);
                if (v == null) g.writeNull(); else g.writeString(v);
            }
        }
    }
}