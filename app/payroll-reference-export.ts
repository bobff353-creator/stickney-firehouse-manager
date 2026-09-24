import { payrollExportRows, type PayrollExportEmployee, type PayrollExportEntry } from "./payroll-export.ts";
import { PAYROLL_PREMIUM_MULTIPLIER, summarizePayroll, type PayrollRules } from "./payroll-calculation.ts";
import { compareEmployeeNames, formatEmployeeName } from "./employee-names.ts";
import { roundPayrollToCent } from "./payroll-rounding.ts";

export type PayrollExportPeriod = { startDate: string; endDate: string; status: string };
export type PayrollExportMember = { employee: PayrollExportEmployee; entries: PayrollExportEntry[] };
export type ReferencePayRow = { kind: string; cells: Array<string | number> };

// Match the department's two reference sheets, using this period's saved data only.
export function buildPayrollReference(period: PayrollExportPeriod, members: PayrollExportMember[], rules: PayrollRules) {
  const rows: ReferencePayRow[] = [];
  let grossCents = 0;
  let workedHours = 0;
  for (const { employee, entries } of [...members].sort((a, b) => compareEmployeeNames(a.employee.name, b.employee.name))) {
    const summary = summarizePayroll(employee, entries, rules);
    grossCents += Math.round(summary.gross * 100);
    workedHours += summary.hours;
    const keys = summary.lines.filter(line => line.hours > 0 || (line.key === "regular" && summary.lines.every(item => item.hours === 0))).map(line => line.key);
    const employeeRows = payrollExportRows(employee, entries, rules.overtimeThreshold, rules.dpwMultiplier, rules.actingOfficerPremium)
      .map((cells, index) => ({ kind: keys[index], cells }));
    const base = employeeRows.find(row => row.kind === "regular");
    const detail = employeeRows.find(row => row.kind === "workDetail");
    if (base && detail) {
      const hours = roundPayrollToCent(Number(base.cells[9]) + Number(detail.cells[9]));
      const amount = roundPayrollToCent(Number(base.cells[11]) + Number(detail.cells[11]));
      // Rare fractional-cent cases retain two rows so every row and the app still agree.
      if (roundPayrollToCent(hours * Number(base.cells[10])) === amount) {
        base.cells[4] = detail.cells[4];
        base.cells[9] = hours;
        base.cells[11] = amount;
        employeeRows.splice(employeeRows.indexOf(detail), 1);
      }
    } else if (detail) {
      detail.kind = "regular";
    }
    for (const row of employeeRows) {
      const suffix = ({ overtime: "Overtime", holiday: "Holiday", dpw: "DPW", actingOfficer: "Acting Officer", workDetail: "Work Detail" } as Record<string, string>)[row.kind];
      row.cells[0] = `${formatEmployeeName(employee.name)}${suffix ? ` (${suffix})` : ""}`;
      row.cells[1] = row.kind === "actingOfficer" ? "Acting Officer" : row.kind === "holiday" ? `${employee.rank} Holiday` : employee.rank;
      row.cells[10] = Number(row.cells[10]);
      row.cells[11] = Number(row.cells[11]);
      rows.push(row);
    }
  }
  const hasDpw = rows.some(row => Number(row.cells[8]) !== 0);
  const headers = ["Name", "Rank", "Shift", "Drill", "Work Detail", "Call Back", "Acting Officer", "Holiday", ...(hasDpw ? ["DPW"] : []), "Total", "Rate", "Pay"];
  if (!hasDpw) rows.forEach(row => row.cells.splice(8, 1));
  const totalColumn = headers.length - 3;
  const totals: Array<string | number> = headers.map((_, column) => column === 1 ? "Totals" : column >= 2 && column < totalColumn ? roundPayrollToCent(rows.reduce((sum, row) => sum + Number(row.cells[column]), 0)) : column === totalColumn || column === totalColumn + 1 ? "x" : column === headers.length - 1 ? grossCents / 100 : "");
  const formatDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const rates = [...new Map(members.map(({ employee }) => [`${employee.rank}\u0000${employee.regularRate}`, { rank: employee.rank, regular: employee.regularRate, premium: Number((employee.regularRate * PAYROLL_PREMIUM_MULTIPLIER).toFixed(4)) }])).values()]
    .sort((a, b) => b.regular - a.regular || a.rank.localeCompare(b.rank));
  return { period, title: `${formatDate(period.startDate)} – ${formatDate(period.endDate)}`, headers, rows, totals, hasDpw, rates, rules, workedHours: roundPayrollToCent(workedHours), employeeCount: members.length, gross: grossCents / 100 };
}

export type PayrollReference = ReturnType<typeof buildPayrollReference>;

export function payrollReferenceCsv(report: PayrollReference) {
  const rows = [[report.title], report.headers, ...report.rows.map(row => row.cells), [], report.totals];
  return "\uFEFF" + rows.map(row => row.map((cell, column) => {
    const text = typeof cell === "number" && column === report.headers.length - 1 ? cell.toFixed(2) : typeof cell === "number" && column === report.headers.length - 2 ? cell.toFixed(cell === roundPayrollToCent(cell) ? 2 : 4) : String(cell);
    // Names and ranks must remain text when Excel opens a CSV.
    const safe = typeof cell === "string" && /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  }).join(",")).join("\r\n");
}
