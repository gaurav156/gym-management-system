package com.gymapp.service;

import com.gymapp.dto.FinanceDtos.*;
import com.gymapp.entity.Branch;
import com.gymapp.repository.BranchRepository;
import com.gymapp.repository.ExpenseRepository;
import com.gymapp.repository.PaymentRepository;
import com.gymapp.repository.ProductOrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;

// Powers the Owner dashboard's Income & Profit report. Income is membership payments
// (Payment) plus completed product sales (ProductOrder, excluding CANCELLED); profit is
// that income minus logged Expenses. Nothing here is stored - it's computed on demand
// from the same rows the Payments/Store/Expenses tabs already write, so the report can
// never drift out of sync with them.
@Service
public class FinanceReportService {

    // Above this many days, a CUSTOM range is bucketed by month instead of by day -
    // otherwise a multi-year custom range would return thousands of near-empty rows.
    private static final long CUSTOM_RANGE_DAILY_LIMIT_DAYS = 92;

    private static final DateTimeFormatter DAY_LABEL = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter MONTH_LABEL = DateTimeFormatter.ofPattern("MMM yyyy");

    private final PaymentRepository paymentRepository;
    private final ProductOrderRepository productOrderRepository;
    private final ExpenseRepository expenseRepository;
    private final BranchRepository branchRepository;

    public FinanceReportService(PaymentRepository paymentRepository,
                                ProductOrderRepository productOrderRepository,
                                ExpenseRepository expenseRepository,
                                BranchRepository branchRepository) {
        this.paymentRepository = paymentRepository;
        this.productOrderRepository = productOrderRepository;
        this.expenseRepository = expenseRepository;
        this.branchRepository = branchRepository;
    }

    @Transactional(readOnly = true)
    public FinanceReportResponse generateReport(FinanceReportQuery query) {
        DateRange range = resolveRange(query);
        String unit = resolveBucketUnit(query.granularity(), range);

        String branchName = null;
        if (query.branchId() != null) {
            Branch branch = branchRepository.findById(query.branchId())
                    .orElseThrow(() -> new IllegalArgumentException("Branch not found"));
            branchName = branch.getName();
        }

        LocalDateTime fromTs = range.from().atStartOfDay();
        LocalDateTime toTsExclusive = range.to().plusDays(1).atStartOfDay();

        Map<LocalDate, BigDecimal> membership = toBucketMap(
                paymentRepository.sumMembershipIncomeByBucket(unit, fromTs, toTsExclusive, query.branchId()));
        Map<LocalDate, BigDecimal> product = toBucketMap(
                productOrderRepository.sumProductIncomeByBucket(unit, fromTs, toTsExclusive, query.branchId()));
        Map<LocalDate, BigDecimal> expense = toBucketMap(
                expenseRepository.sumExpensesByBucket(unit, range.from(), range.to().plusDays(1), query.branchId()));

        TreeSet<LocalDate> buckets = new TreeSet<>();
        buckets.addAll(membership.keySet());
        buckets.addAll(product.keySet());
        buckets.addAll(expense.keySet());

        List<FinanceReportRow> rows = new ArrayList<>();
        BigDecimal totalMembership = BigDecimal.ZERO;
        BigDecimal totalProduct = BigDecimal.ZERO;
        BigDecimal totalExpense = BigDecimal.ZERO;

        for (LocalDate bucket : buckets) {
            BigDecimal mem = membership.getOrDefault(bucket, BigDecimal.ZERO);
            BigDecimal prod = product.getOrDefault(bucket, BigDecimal.ZERO);
            BigDecimal exp = expense.getOrDefault(bucket, BigDecimal.ZERO);
            BigDecimal income = mem.add(prod);
            rows.add(new FinanceReportRow(formatLabel(bucket, unit), mem, prod, income, exp, income.subtract(exp)));
            totalMembership = totalMembership.add(mem);
            totalProduct = totalProduct.add(prod);
            totalExpense = totalExpense.add(exp);
        }

        BigDecimal totalIncome = totalMembership.add(totalProduct);
        return new FinanceReportResponse(range.from(), range.to(), query.granularity().name(), branchName,
                totalMembership, totalProduct, totalIncome, totalExpense, totalIncome.subtract(totalExpense), rows);
    }

    private DateRange resolveRange(FinanceReportQuery q) {
        LocalDate today = LocalDate.now();
        return switch (q.granularity()) {
            case DAILY -> {
                LocalDate d = q.date() != null ? q.date() : today;
                yield new DateRange(d, d);
            }
            case MONTHLY -> {
                int y = q.year() != null ? q.year() : today.getYear();
                int m = q.month() != null ? q.month() : today.getMonthValue();
                if (m < 1 || m > 12) throw new IllegalArgumentException("month must be between 1 and 12");
                YearMonth ym = YearMonth.of(y, m);
                yield new DateRange(ym.atDay(1), ym.atEndOfMonth());
            }
            case QUARTERLY -> {
                int y = q.year() != null ? q.year() : today.getYear();
                int quarter = q.quarter() != null ? q.quarter() : ((today.getMonthValue() - 1) / 3) + 1;
                if (quarter < 1 || quarter > 4) throw new IllegalArgumentException("quarter must be between 1 and 4");
                LocalDate start = LocalDate.of(y, (quarter - 1) * 3 + 1, 1);
                yield new DateRange(start, start.plusMonths(3).minusDays(1));
            }
            case YEARLY -> {
                int y = q.year() != null ? q.year() : today.getYear();
                yield new DateRange(LocalDate.of(y, 1, 1), LocalDate.of(y, 12, 31));
            }
            case CUSTOM -> {
                if (q.fromDate() == null || q.toDate() == null) {
                    throw new IllegalArgumentException("fromDate and toDate are required for a custom range");
                }
                if (q.toDate().isBefore(q.fromDate())) {
                    throw new IllegalArgumentException("toDate cannot be before fromDate");
                }
                yield new DateRange(q.fromDate(), q.toDate());
            }
        };
    }

    private String resolveBucketUnit(ReportGranularity g, DateRange range) {
        return switch (g) {
            case DAILY, MONTHLY -> "day";
            case QUARTERLY, YEARLY -> "month";
            case CUSTOM -> ChronoUnit.DAYS.between(range.from(), range.to()) > CUSTOM_RANGE_DAILY_LIMIT_DAYS
                    ? "month" : "day";
        };
    }

    private String formatLabel(LocalDate bucket, String unit) {
        return unit.equals("month") ? bucket.format(MONTH_LABEL) : bucket.format(DAY_LABEL);
    }

    // Native date_trunc() rows come back as [Timestamp-or-LocalDateTime, Number-or-null] -
    // the exact Java type varies slightly by driver/Hibernate version, so several are
    // handled rather than assumed.
    private Map<LocalDate, BigDecimal> toBucketMap(List<Object[]> rows) {
        Map<LocalDate, BigDecimal> map = new HashMap<>();
        for (Object[] row : rows) {
            LocalDate bucket = toLocalDate(row[0]);
            BigDecimal total = row[1] == null ? BigDecimal.ZERO : new BigDecimal(row[1].toString());
            map.put(bucket, total);
        }
        return map;
    }

    private LocalDate toLocalDate(Object value) {
        if (value instanceof Timestamp ts) return ts.toLocalDateTime().toLocalDate();
        if (value instanceof LocalDateTime ldt) return ldt.toLocalDate();
        if (value instanceof LocalDate ld) return ld;
        if (value instanceof java.sql.Date d) return d.toLocalDate();
        throw new IllegalStateException("Unexpected bucket type: " + value.getClass());
    }

    private record DateRange(LocalDate from, LocalDate to) {}
}