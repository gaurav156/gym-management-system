package com.gymapp.service;

import com.gymapp.dto.FinanceDtos.FinanceReportResponse;
import com.gymapp.dto.FinanceDtos.FinanceReportRow;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;

// Builds the Owner's "Download Excel" export for the Income & Profit report - same data
// FinanceReportService already computed, just laid out as a spreadsheet instead of JSON.
@Component
public class FinanceExcelExportService {

    public byte[] export(FinanceReportResponse report) {
        try (XSSFWorkbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet("Income & Profit");

            CellStyle boldStyle = workbook.createCellStyle();
            Font boldFont = workbook.createFont();
            boldFont.setBold(true);
            boldStyle.setFont(boldFont);

            CellStyle currencyStyle = workbook.createCellStyle();
            currencyStyle.setDataFormat(workbook.createDataFormat().getFormat("#,##0.00"));

            int r = 0;
            r = writeTitleRow(sheet, r, "Income & Profit Report", boldStyle);
            r = writeLabelRow(sheet, r, "Period", report.granularity() + "  (" + report.fromDate() + " to " + report.toDate() + ")");
            r = writeLabelRow(sheet, r, "Branch", report.branchName() != null ? report.branchName() : "All branches");
            r++; // blank separator row

            r = writeSummaryRow(sheet, r, "Total Membership Income", report.totalMembershipIncome(), boldStyle, currencyStyle);
            r = writeSummaryRow(sheet, r, "Total Product Income", report.totalProductIncome(), boldStyle, currencyStyle);
            r = writeSummaryRow(sheet, r, "Total Income", report.totalIncome(), boldStyle, currencyStyle);
            r = writeSummaryRow(sheet, r, "Total Expenses", report.totalExpense(), boldStyle, currencyStyle);
            r = writeSummaryRow(sheet, r, "Total Profit", report.totalProfit(), boldStyle, currencyStyle);
            r++; // blank separator row

            String[] headers = {"Period", "Membership Income", "Product Income", "Total Income", "Expenses", "Profit"};
            Row headerRow = sheet.createRow(r++);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(boldStyle);
            }

            for (FinanceReportRow row : report.breakdown()) {
                Row dataRow = sheet.createRow(r++);
                dataRow.createCell(0).setCellValue(row.label());
                setCurrency(dataRow.createCell(1), row.membershipIncome(), currencyStyle);
                setCurrency(dataRow.createCell(2), row.productIncome(), currencyStyle);
                setCurrency(dataRow.createCell(3), row.totalIncome(), currencyStyle);
                setCurrency(dataRow.createCell(4), row.totalExpense(), currencyStyle);
                setCurrency(dataRow.createCell(5), row.profit(), currencyStyle);
            }

            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            workbook.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate Excel report", e);
        }
    }

    private int writeTitleRow(Sheet sheet, int r, String title, CellStyle style) {
        Cell cell = sheet.createRow(r).createCell(0);
        cell.setCellValue(title);
        cell.setCellStyle(style);
        return r + 1;
    }

    private int writeLabelRow(Sheet sheet, int r, String label, String value) {
        Row row = sheet.createRow(r);
        row.createCell(0).setCellValue(label + ":");
        row.createCell(1).setCellValue(value);
        return r + 1;
    }

    private int writeSummaryRow(Sheet sheet, int r, String label, BigDecimal value,
                                CellStyle labelStyle, CellStyle currencyStyle) {
        Row row = sheet.createRow(r);
        Cell labelCell = row.createCell(0);
        labelCell.setCellValue(label);
        labelCell.setCellStyle(labelStyle);
        setCurrency(row.createCell(1), value, currencyStyle);
        return r + 1;
    }

    private void setCurrency(Cell cell, BigDecimal value, CellStyle style) {
        cell.setCellValue(value.doubleValue());
        cell.setCellStyle(style);
    }
}