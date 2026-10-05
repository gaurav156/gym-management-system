package com.gymapp.repository;

import com.gymapp.dto.FinanceDtos.FinanceTransactionRow;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import javax.sql.DataSource;
import java.sql.Types;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

// Every income/expense row in a date range as one chronological feed - powers the
// "show details" view of the Income & Profit report. Same inclusion rules as the summary
// queries (PaymentRepository / ProductOrderRepository / ExpenseRepository): all payments,
// product orders except CANCELLED, expenses by expense_date.
@Repository
public class FinanceTransactionRepository {

    private static final String UNION = """
            SELECT CAST(p.id AS text) AS id, p.created_at AS ts, 'MEMBERSHIP' AS kind,
                   'INV-' || to_char(p.created_at, 'YYYY') || '-' || lpad(CAST(p.invoice_seq AS text), 6, '0') AS reference,
                   mu.name AS person, b.name AS branch,
                   COALESCE(pl.name, 'Membership payment') AS description,
                   p.mode AS mode, p.amount AS income, CAST(0 AS numeric) AS expense
            FROM payments p
            JOIN users mu ON mu.id = p.member_id
            JOIN branches b ON b.id = p.branch_id
            LEFT JOIN memberships ms ON ms.id = p.membership_id
            LEFT JOIN membership_plans pl ON pl.id = ms.plan_id
            WHERE p.created_at >= :fromTs AND p.created_at < :toTs
              AND (CAST(:branchId AS uuid) IS NULL OR p.branch_id = CAST(:branchId AS uuid))
            UNION ALL
            SELECT CAST(o.id AS text), o.created_at, 'STORE',
                   'PORD-' || to_char(o.created_at, 'YYYY') || '-' || lpad(CAST(o.invoice_seq AS text), 6, '0'),
                   mu.name, b.name,
                   COALESCE((SELECT string_agg(i.product_name_snapshot || ' x' || i.quantity, ', ')
                             FROM product_order_items i WHERE i.order_id = o.id), 'Store order'),
                   o.mode, o.total_amount, CAST(0 AS numeric)
            FROM product_orders o
            JOIN users mu ON mu.id = o.member_id
            JOIN branches b ON b.id = o.branch_id
            WHERE o.created_at >= :fromTs AND o.created_at < :toTs
              AND o.status <> 'CANCELLED'
              AND (CAST(:branchId AS uuid) IS NULL OR o.branch_id = CAST(:branchId AS uuid))
            UNION ALL
            SELECT CAST(e.id AS text), CAST(e.expense_date AS timestamp), 'EXPENSE', CAST(NULL AS text),
                   rb.name, b.name,
                   e.category || COALESCE(' - ' || e.remark, ''),
                   CAST(NULL AS text), CAST(0 AS numeric), e.amount
            FROM expenses e
            JOIN branches b ON b.id = e.branch_id
            JOIN users rb ON rb.id = e.recorded_by
            WHERE e.expense_date >= :fromD AND e.expense_date <= :toD
              AND (CAST(:branchId AS uuid) IS NULL OR e.branch_id = CAST(:branchId AS uuid))
            """;

    private final NamedParameterJdbcTemplate jdbc;

    public FinanceTransactionRepository(DataSource dataSource) {
        this.jdbc = new NamedParameterJdbcTemplate(dataSource);
    }

    public long count(LocalDate from, LocalDate to, UUID branchId) {
        Long n = jdbc.queryForObject("SELECT count(*) FROM (" + UNION + ") t", params(from, to, branchId), Long.class);
        return n == null ? 0 : n;
    }

    public List<FinanceTransactionRow> page(LocalDate from, LocalDate to, UUID branchId, int limit, long offset) {
        MapSqlParameterSource p = params(from, to, branchId).addValue("limit", limit).addValue("offset", offset);
        return jdbc.query("SELECT * FROM (" + UNION + ") t ORDER BY ts DESC, id LIMIT :limit OFFSET :offset", p,
                (rs, i) -> new FinanceTransactionRow(
                        rs.getString("id"),
                        rs.getObject("ts", LocalDateTime.class),
                        rs.getString("kind"),
                        rs.getString("reference"),
                        rs.getString("person"),
                        rs.getString("branch"),
                        rs.getString("description"),
                        rs.getString("mode"),
                        rs.getBigDecimal("income"),
                        rs.getBigDecimal("expense")));
    }

    private MapSqlParameterSource params(LocalDate from, LocalDate to, UUID branchId) {
        return new MapSqlParameterSource()
                .addValue("fromTs", from.atStartOfDay())
                .addValue("toTs", to.plusDays(1).atStartOfDay())
                .addValue("fromD", from)
                .addValue("toD", to)
                .addValue("branchId", branchId == null ? null : branchId.toString(), Types.VARCHAR);
    }
}