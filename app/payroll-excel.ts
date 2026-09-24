import ExcelJS from "exceljs";
import type { PayrollReference } from "./payroll-reference-export.ts";

const money = '"$"#,##0.00';
const rateFormat = (rate: number) => Math.abs(rate * 100 - Math.round(rate * 100)) > 1e-7 ? '"$"#,##0.0000' : money;
const colors: Record<string, string> = { overtime: "FF00B0F0", actingOfficer: "FFFFFF00", holiday: "FF92D050", dpw: "FFE4D7F5" };

// Loaded only after Export Excel is clicked; generation needs no database request.
export function createPayrollWorkbook(report: PayrollReference) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Stickney Firehouse Manager";
  workbook.title = `Stickney Payroll · ${report.title}`;
  workbook.calcProperties.fullCalcOnLoad = true;
  const sheet = workbook.addWorksheet("Payroll", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 2, showGridLines: false }],
    // OOXML 1 is US Letter; ExcelJS's type enum omits this standard value.
    pageSetup: { paperSize: 1 as ExcelJS.PaperSize, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: .25, right: .25, top: .4, bottom: .4, header: .15, footer: .15 } },
  });
  const count = report.headers.length;
  const totalCol = count - 2;
  const rateCol = count - 1;
  const letter = (column: number) => sheet.getColumn(column).letter;
  const widths = [43, 24, 8, 8, 12, 11, 16, 10, ...(report.hasDpw ? [10] : []), 10, 13, 16];
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  sheet.mergeCells(1, 1, 1, count);
  sheet.getCell("A1").value = report.title;
  sheet.addRow(report.headers);
  report.rows.forEach(({ kind, cells }) => {
    const row = sheet.addRow(cells);
    const n = row.number;
    row.getCell(totalCol).value = { formula: `ROUND(SUM(C${n}:${letter(totalCol - 1)}${n}),2)`, result: Number(cells[totalCol - 1]) };
    row.getCell(count).value = { formula: `ROUND(${letter(totalCol)}${n}*${letter(rateCol)}${n},2)`, result: Number(cells[count - 1]) };
    if (colors[kind]) row.eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors[kind] } }; });
  });
  const lastDataRow = sheet.rowCount;
  sheet.addRow([]);
  const totals = sheet.addRow(report.totals.map(value => value === "" ? null : value));
  const lastRow = totals.number;
  for (let col = 3; col <= count; col++) {
    if (col === totalCol || col === rateCol) continue;
    totals.getCell(col).value = report.rows.length ? { formula: `ROUND(SUM(${letter(col)}3:${letter(col)}${lastDataRow}),2)`, result: Number(report.totals[col - 1]) } : 0;
  }
  sheet.eachRow((row, rowNumber) => {
    row.height = rowNumber <= 2 ? 28 : String(row.getCell(1).value ?? "").length > 40 ? 32 : 22;
    if (rowNumber === lastDataRow + 1) { row.height = 12; return; }
    for (let col = 1; col <= count; col++) {
      const cell = row.getCell(col);
      cell.font = { name: "Calibri", size: rowNumber === 1 ? 13 : 11, bold: rowNumber <= 2 || rowNumber === lastRow, color: { argb: "FF000000" } };
      cell.alignment = { vertical: "middle", horizontal: col <= 2 || rowNumber <= 2 ? "center" : "right", wrapText: true };
      const side = { style: rowNumber === lastRow ? "medium" as const : "thin" as const, color: { argb: "FF000000" } };
      cell.border = { top: side, bottom: side, left: side, right: side };
      if (rowNumber > 2) cell.numFmt = col === count || col === rateCol ? money : "General";
    }
  });
  // Rate precision must be visible, including half-cent premiums.
  report.rows.forEach(({ cells }, index) => {
    const rate = Number(cells[rateCol - 1]);
    sheet.getCell(index + 3, rateCol).numFmt = rateFormat(rate);
  });
  sheet.pageSetup.printArea = `A1:${letter(count)}${lastRow}`;
  sheet.pageSetup.printTitlesRow = "1:2";
  sheet.headerFooter.oddFooter = `&LStickney Fire Department · ${report.period.status}&RPage &P of &N`;

  const notes = workbook.addWorksheet("Rates & notes", { views: [{ showGridLines: false }] });
  notes.columns = [{ width: 38 }, { width: 24 }, { width: 29 }];
  notes.addRows([
    ["Stickney payroll export"], [report.title], ["Payroll status", report.period.status], ["Employees", report.employeeCount], ["Worked hours (excludes AO allowance)", report.workedHours], ["Calculated gross", report.gross], [],
    ["Rank / pay scale", "Regular / Work Detail", "Overtime / Holiday / DPW"],
    ...report.rates.map(rate => [rate.rank, rate.regular, rate.premium]),
    ["Acting Officer allowance", report.rules.actingOfficerPremium], [],
    ["Blue", "Overtime"], ["Yellow", "Acting Officer allowance"], ["Green", "Holiday"], ...(report.hasDpw ? [["Purple", "DPW"]] : []), [],
    ["Overtime threshold", report.rules.overtimeThreshold],
    ["Work Detail", "Normal hourly rate"],
    ["DPW", "1.5 × base rate, once"],
    ["Acting Officer", "Allowance, not extra worked hours"],
    ["Source", "Selected payroll period in the app"],
    ["Scope", "All employees on this payroll; search filters do not limit the export."],
    ["Export", "A copy only. Editing this file does not change app records."],
    ["Rounding", "A separate Work Detail row is retained when combining would change pay by a cent."],
  ]);
  notes.eachRow((row, number) => {
    row.height = number >= 8 + report.rates.length ? 32 : 24;
    row.eachCell((cell, col) => {
      cell.font = { name: "Calibri", size: 11, bold: number === 1 || number === 8, color: { argb: "FF000000" } };
      cell.alignment = { vertical: "middle", wrapText: true };
      if (number >= 9 && number <= 9 + report.rates.length && col > 1) cell.numFmt = rateFormat(Number(cell.value));
    });
  });
  notes.getCell("B6").numFmt = money;
  for (let row = 9 + report.rates.length + 2; row <= notes.rowCount; row++) {
    notes.mergeCells(row, 2, row, 3);
  }
  return workbook;
}

export async function payrollExcelBytes(report: PayrollReference) {
  const buffer = await createPayrollWorkbook(report).xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
