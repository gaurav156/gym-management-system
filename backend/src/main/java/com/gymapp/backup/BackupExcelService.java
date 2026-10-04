package com.gymapp.backup;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.streaming.SXSSFSheet;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

// Human-friendly workbook for the Owner (joined names instead of ids, no password hashes).
// SXSSFWorkbook keeps only 100 rows in memory per sheet and spills the rest to a temp file.
@Service
public class BackupExcelService {

    private static final String P = "p.created_at >= :fromTs AND p.created_at < :toTs";

    private static final Map<String, String> SHEETS = new LinkedHashMap<>();
    static {
        SHEETS.put("Summary (monthly)",
                "SELECT t.m AS \"Month\", SUM(t.mem) AS \"Membership Income\", SUM(t.store) AS \"Store Income\", "
                        + "SUM(t.exp) AS \"Expenses\", SUM(t.mem) + SUM(t.store) - SUM(t.exp) AS \"Profit\" FROM ("
                        + " SELECT to_char(p.created_at, 'YYYY-MM') AS m, p.amount AS mem, 0 AS store, 0 AS exp FROM payments p WHERE " + P
                        + " UNION ALL SELECT to_char(o.created_at, 'YYYY-MM'), 0, o.total_amount, 0 FROM product_orders o"
                        + "  WHERE o.status <> 'CANCELLED' AND o.created_at >= :fromTs AND o.created_at < :toTs"
                        + " UNION ALL SELECT to_char(e.expense_date, 'YYYY-MM'), 0, 0, e.amount FROM expenses e"
                        + "  WHERE e.expense_date >= :fromD AND e.expense_date <= :toD"
                        + ") t GROUP BY t.m ORDER BY t.m");

        SHEETS.put("Members",
                "SELECT u.name AS \"Name\", u.email AS \"Email\", u.phone AS \"Phone\", u.gender AS \"Gender\", "
                        + "u.date_of_birth AS \"Date of Birth\", u.address AS \"Address\", u.enrollment_date AS \"Enrolled On\", "
                        + "u.active AS \"Active\", u.marketing_consent AS \"Marketing Consent\", "
                        + "(SELECT string_agg(b.name, ', ') FROM branch_assignments ba JOIN branches b ON b.id = ba.branch_id "
                        + " WHERE ba.user_id = u.id) AS \"Branches\" "
                        + "FROM users u WHERE u.role = 'MEMBER' ORDER BY u.name");

        SHEETS.put("Staff",
                "SELECT u.name AS \"Name\", u.role AS \"Role\", u.email AS \"Email\", u.phone AS \"Phone\", "
                        + "u.joining_date AS \"Joined\", u.left_date AS \"Left\", u.active AS \"Active\" "
                        + "FROM users u WHERE u.role <> 'MEMBER' ORDER BY u.role, u.name");

        SHEETS.put("Memberships",
                "SELECT mu.name AS \"Member\", pl.name AS \"Plan\", b.name AS \"Branch\", m.start_date AS \"Start\", "
                        + "m.end_date AS \"End\", m.status AS \"Status\", m.total_amount AS \"Total\", m.amount_paid AS \"Paid\", "
                        + "m.total_amount - m.amount_paid AS \"Balance Due\", m.payment_status AS \"Payment Status\", "
                        + "m.balance_due_date AS \"Balance Due By\", m.discount_amount AS \"Discount\" "
                        + "FROM memberships m JOIN users mu ON mu.id = m.member_id JOIN membership_plans pl ON pl.id = m.plan_id "
                        + "JOIN branches b ON b.id = m.branch_id "
                        + "WHERE m.start_date <= :toD AND m.end_date >= :fromD ORDER BY m.start_date");

        SHEETS.put("Payments",
                "SELECT 'INV-' || to_char(p.created_at, 'YYYY') || '-' || lpad(CAST(p.invoice_seq AS text), 6, '0') AS \"Invoice\", "
                        + "p.created_at AS \"Date\", mu.name AS \"Member\", b.name AS \"Branch\", pl.name AS \"Plan\", "
                        + "p.amount AS \"Amount\", p.mode AS \"Mode\", p.type AS \"Type\", rb.name AS \"Recorded By\" "
                        + "FROM payments p JOIN users mu ON mu.id = p.member_id JOIN branches b ON b.id = p.branch_id "
                        + "JOIN users rb ON rb.id = p.recorded_by "
                        + "LEFT JOIN memberships ms ON ms.id = p.membership_id LEFT JOIN membership_plans pl ON pl.id = ms.plan_id "
                        + "WHERE " + P + " ORDER BY p.created_at");

        SHEETS.put("Product Orders",
                "SELECT 'PORD-' || to_char(o.created_at, 'YYYY') || '-' || lpad(CAST(o.invoice_seq AS text), 6, '0') AS \"Invoice\", "
                        + "o.created_at AS \"Date\", mu.name AS \"Buyer\", b.name AS \"Branch\", o.subtotal AS \"Subtotal\", "
                        + "o.discount_amount AS \"Discount\", o.total_amount AS \"Total\", o.mode AS \"Mode\", o.status AS \"Status\", "
                        + "o.refund_amount AS \"Refunded\", rb.name AS \"Recorded By\" "
                        + "FROM product_orders o JOIN users mu ON mu.id = o.member_id JOIN branches b ON b.id = o.branch_id "
                        + "LEFT JOIN users rb ON rb.id = o.recorded_by "
                        + "WHERE o.created_at >= :fromTs AND o.created_at < :toTs ORDER BY o.created_at");

        SHEETS.put("Order Items",
                "SELECT 'PORD-' || to_char(o.created_at, 'YYYY') || '-' || lpad(CAST(o.invoice_seq AS text), 6, '0') AS \"Invoice\", "
                        + "o.created_at AS \"Date\", i.product_name_snapshot AS \"Product\", i.quantity AS \"Qty\", "
                        + "i.unit_price AS \"Unit Price\", i.line_total AS \"Line Total\", o.status AS \"Order Status\" "
                        + "FROM product_order_items i JOIN product_orders o ON o.id = i.order_id "
                        + "WHERE o.created_at >= :fromTs AND o.created_at < :toTs ORDER BY o.created_at");

        SHEETS.put("Expenses",
                "SELECT e.expense_date AS \"Date\", b.name AS \"Branch\", e.category AS \"Category\", e.amount AS \"Amount\", "
                        + "e.remark AS \"Remark\", rb.name AS \"Recorded By\" "
                        + "FROM expenses e JOIN branches b ON b.id = e.branch_id JOIN users rb ON rb.id = e.recorded_by "
                        + "WHERE e.expense_date >= :fromD AND e.expense_date <= :toD ORDER BY e.expense_date");

        SHEETS.put("Attendance",
                "SELECT u.name AS \"Person\", u.role AS \"Role\", b.name AS \"Branch\", a.check_in_time AS \"Check-in\", "
                        + "a.check_out_time AS \"Check-out\", a.method AS \"Method\" "
                        + "FROM attendance a JOIN users u ON u.id = a.member_id JOIN branches b ON b.id = a.branch_id "
                        + "WHERE a.check_in_time >= :fromTs AND a.check_in_time < :toTs ORDER BY a.check_in_time");
    }

    private final NamedParameterJdbcTemplate named;
    private final PlatformTransactionManager txManager;

    public BackupExcelService(DataSource dataSource, PlatformTransactionManager txManager) {
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        jdbc.setFetchSize(500);
        this.named = new NamedParameterJdbcTemplate(jdbc);
        this.txManager = txManager;
    }

    public void export(BackupRange range, OutputStream out) throws IOException {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("fromTs", range.fromTs()).addValue("toTs", range.toTsExclusive())
                .addValue("fromD", range.fromD()).addValue("toD", range.toD());

        SXSSFWorkbook wb = new SXSSFWorkbook(100);
        try {
            Styles st = new Styles(wb);
            TransactionTemplate tx = new TransactionTemplate(txManager);
            tx.setReadOnly(true);
            tx.executeWithoutResult(s -> SHEETS.forEach((name, sql) -> writeSheet(wb, st, name, sql, params)));
            wb.write(out);
        } catch (UncheckedIOException e) {
            throw e.getCause();
        } finally {
            wb.dispose();   // deletes the temp files SXSSF spilled to
            wb.close();
        }
    }

    private record Styles(CellStyle header, CellStyle date, CellStyle dateTime, CellStyle money) {
        Styles(SXSSFWorkbook wb) {
            this(make(wb, null, true), make(wb, "yyyy-mm-dd", false),
                    make(wb, "yyyy-mm-dd hh:mm", false), make(wb, "#,##0.00", false));
        }
        private static CellStyle make(SXSSFWorkbook wb, String format, boolean bold) {
            CellStyle s = wb.createCellStyle();
            if (format != null) s.setDataFormat(wb.createDataFormat().getFormat(format));
            if (bold) {
                Font f = wb.createFont();
                f.setBold(true);
                s.setFont(f);
            }
            return s;
        }
    }

    private void writeSheet(SXSSFWorkbook wb, Styles st, String name, String sql, MapSqlParameterSource params) {
        SXSSFSheet sheet = wb.createSheet(name);
        int[] rowNum = {0};
        String[][] typeHolder = new String[1][];

        named.query(sql, params, (ResultSet rs) -> {
            try {
                ResultSetMetaData md = rs.getMetaData();
                int n = md.getColumnCount();
                if (typeHolder[0] == null) {
                    typeHolder[0] = new String[n];
                    Row h = sheet.createRow(rowNum[0]++);
                    for (int i = 0; i < n; i++) {
                        typeHolder[0][i] = md.getColumnTypeName(i + 1).toLowerCase();
                        Cell c = h.createCell(i);
                        c.setCellValue(md.getColumnLabel(i + 1));
                        c.setCellStyle(st.header());
                        sheet.setColumnWidth(i, 20 * 256);
                    }
                    sheet.createFreezePane(0, 1);
                }
                Row row = sheet.createRow(rowNum[0]++);
                for (int i = 0; i < n; i++) writeCell(row.createCell(i), rs, i + 1, typeHolder[0][i], st);
            } catch (java.sql.SQLException e) {
                throw new org.springframework.jdbc.UncategorizedSQLException("excel", sql, e);
            }
        });
    }

    private static void writeCell(Cell cell, ResultSet rs, int i, String type, Styles st) throws java.sql.SQLException {
        switch (type) {
            case "timestamp", "timestamptz" -> {
                LocalDateTime v = rs.getObject(i, LocalDateTime.class);
                if (v != null) { cell.setCellValue(v); cell.setCellStyle(st.dateTime()); }
            }
            case "date" -> {
                LocalDate v = rs.getObject(i, LocalDate.class);
                if (v != null) { cell.setCellValue(v); cell.setCellStyle(st.date()); }
            }
            case "numeric" -> {
                java.math.BigDecimal v = rs.getBigDecimal(i);
                if (v != null) { cell.setCellValue(v.doubleValue()); cell.setCellStyle(st.money()); }
            }
            case "int2", "int4", "int8" -> {
                long v = rs.getLong(i);
                if (!rs.wasNull()) cell.setCellValue(v);
            }
            case "bool" -> {
                boolean v = rs.getBoolean(i);
                if (!rs.wasNull()) cell.setCellValue(v ? "Yes" : "No");
            }
            default -> {
                String v = rs.getString(i);
                if (v != null) cell.setCellValue(v.length() > 32000 ? v.substring(0, 32000) : v);
            }
        }
    }
}