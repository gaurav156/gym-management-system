package com.gymapp.backup;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

// Parent -> child order. Export writes in this order and import relies on it for FK validity.
// Params available to `ranged`: :fromTs / :toTs (timestamp, toTs exclusive), :fromD / :toD (date, inclusive).
// OTP tables are deliberately excluded - they are short-lived and meaningless after a restore.
// When you add a new table in a migration, add it here too.
final class BackupTables {

    record Spec(String table, String all, String ranged) {}

    private static Spec full(String t) { return new Spec(t, "SELECT * FROM " + t, "SELECT * FROM " + t); }

    private static final String ORDER_IDS = "SELECT id FROM product_orders WHERE created_at >= :fromTs AND created_at < :toTs";
    private static final String BROADCAST_IDS = "SELECT id FROM broadcasts WHERE created_at >= :fromTs AND created_at < :toTs";

    static final List<Spec> ORDERED = List.of(
            full("branches"),
            full("users"),
            full("branch_assignments"),
            full("membership_plans"),
            full("coupons"),
            new Spec("memberships", "SELECT * FROM memberships",
                    "SELECT * FROM memberships m WHERE (m.start_date <= :toD AND m.end_date >= :fromD) "
                            + "OR m.id IN (SELECT p.membership_id FROM payments p WHERE p.created_at >= :fromTs AND p.created_at < :toTs)"),
            new Spec("payments", "SELECT * FROM payments",
                    "SELECT * FROM payments WHERE created_at >= :fromTs AND created_at < :toTs"),
            new Spec("attendance", "SELECT * FROM attendance",
                    "SELECT * FROM attendance WHERE check_in_time >= :fromTs AND check_in_time < :toTs"),
            full("product_categories"),
            full("products"),
            full("product_images"),
            full("product_category_map"),
            full("product_branch_stock"),
            new Spec("product_orders", "SELECT * FROM product_orders",
                    "SELECT * FROM product_orders WHERE created_at >= :fromTs AND created_at < :toTs"),
            new Spec("product_order_items", "SELECT * FROM product_order_items",
                    "SELECT * FROM product_order_items WHERE order_id IN (" + ORDER_IDS + ")"),
            new Spec("expenses", "SELECT * FROM expenses",
                    "SELECT * FROM expenses WHERE expense_date >= :fromD AND expense_date <= :toD"),
            new Spec("role_change_history", "SELECT * FROM role_change_history",
                    "SELECT * FROM role_change_history WHERE changed_at >= :fromTs AND changed_at < :toTs"),
            new Spec("broadcasts", "SELECT * FROM broadcasts",
                    "SELECT * FROM broadcasts WHERE created_at >= :fromTs AND created_at < :toTs"),
            new Spec("broadcast_assets", "SELECT * FROM broadcast_assets",
                    "SELECT * FROM broadcast_assets WHERE broadcast_id IN (" + BROADCAST_IDS + ")"),
            new Spec("broadcast_attachments", "SELECT * FROM broadcast_attachments",
                    "SELECT * FROM broadcast_attachments WHERE broadcast_id IN (" + BROADCAST_IDS + ")"),
            new Spec("broadcast_recipients", "SELECT * FROM broadcast_recipients",
                    "SELECT * FROM broadcast_recipients WHERE broadcast_id IN (" + BROADCAST_IDS + ")")
    );

    static final Set<String> NAMES = ORDERED.stream().map(Spec::table).collect(Collectors.toUnmodifiableSet());

    static String schemaVersion(JdbcTemplate jdbc) {
        return jdbc.queryForObject(
                "SELECT version FROM flyway_schema_history WHERE success = true AND version IS NOT NULL "
                        + "ORDER BY installed_rank DESC LIMIT 1", String.class);
    }

    private BackupTables() {}
}