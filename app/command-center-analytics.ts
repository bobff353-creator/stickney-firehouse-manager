import { holidayForDate } from "./holidays.ts";
import { summarizePayroll, type PayrollCategory } from "./payroll-calculation.ts";
import { roundPayrollToCent } from "./payroll-rounding.ts";

export type StaffingSourceRow = {
  date: string;
  shiftKey: string;
  filled: number;
};

export type StaffingDetail = StaffingSourceRow & {
  shiftLabel: string;
  timeRange: string;
  required: number;
  gaps: number;
  holidayName: string | null;
};

const shiftMeta: Record<string, { label: string; timeRange: string }> = {
  morning: { label: "Morning", timeRange: "06:00–12:00" },
  afternoon: { label: "Afternoon", timeRange: "12:00–18:00" },
  overnight: { label: "Overnight", timeRange: "18:00–06:00" },
};

export function buildStaffingDetails(rows: StaffingSourceRow[], required = 4): StaffingDetail[] {
  return rows.map((row) => {
    const meta = shiftMeta[row.shiftKey] ?? { label: row.shiftKey, timeRange: "Not recorded" };
    const holiday = holidayForDate(row.date);
    const appliesToShift = holiday && (!holiday.overnightOnly || row.shiftKey === "overnight");
    return {
      ...row,
      filled: Number(row.filled || 0),
      shiftLabel: meta.label,
      timeRange: meta.timeRange,
      required,
      gaps: Math.max(0, required - Number(row.filled || 0)),
      holidayName: appliesToShift ? holiday.name : null,
    };
  });
}

export type PayrollSourceRow = {
  employeeId: string;
  periodStart: string;
  date: string;
  category: string;
  hours: number;
  rank: string;
  payScaleId: string;
  regularRate: number;
  overtimeRate: number;
  holidayRate: number;
  isDpw?: number | boolean;
};

export type RateHistoryRow = {
  payScaleId: string;
  effectiveDate: string;
  regularRate: number;
  overtimeRate: number;
  holidayRate: number;
};

export type PayrollSettings = {
  overtimeThreshold: number;
  actingOfficerPremium: number;
  dpwMultiplier: number;
};

export type PayrollDetail = {
  employeeId: string;
  date: string;
  rank: string;
  category: string;
  hours: number;
  cost: number;
  overtimeHours: number;
  overtimeCost: number;
};

function normalizedCategory(category: string) {
  return category === "dailyLogDpw" ? "dpw" : category;
}

function effectiveRate(row: PayrollSourceRow, history: RateHistoryRow[]) {
  const match = history
    .filter((rate) => rate.payScaleId === row.payScaleId && rate.effectiveDate <= row.periodStart)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
  return {
    regularRate: Number(match?.regularRate ?? row.regularRate ?? 0),
    overtimeRate: Number(match?.overtimeRate ?? row.overtimeRate ?? 0),
    holidayRate: Number(match?.holidayRate ?? row.holidayRate ?? 0),
  };
}

export function buildPayrollDetails(
  rows: PayrollSourceRow[],
  history: RateHistoryRow[],
  settings: PayrollSettings,
): PayrollDetail[] {
  const running = new Map<string, Map<PayrollCategory, number>>();

  return rows.map((row) => {
    const sourceCategory = normalizedCategory(row.category) as PayrollCategory;
    const category = row.isDpw && sourceCategory !== "actingOfficer" ? "dpw" : sourceCategory;
    const hours = Number(row.hours || 0);
    const rates = effectiveRate(row, history);
    const key = `${row.employeeId}:${row.periodStart}`;
    const totals = running.get(key) ?? new Map<PayrollCategory, number>();
    const calculate = () => summarizePayroll({ rank: row.rank, regularRate: rates.regularRate, isDpw: row.isDpw }, [...totals].map(([category, hours]) => ({ category, hours })), settings);
    const before = calculate();
    totals.set(sourceCategory, (totals.get(sourceCategory) ?? 0) + hours);
    running.set(key, totals);
    const after = calculate();
    // Allocate rounded period pay to days without accumulating rounding drift.
    const cost = roundPayrollToCent(after.gross - before.gross);
    const overtimeHours = roundPayrollToCent(after.overtimeHours - before.overtimeHours);
    const overtimeCost = roundPayrollToCent(after.lines.find(line => line.key === "overtime")!.amount - before.lines.find(line => line.key === "overtime")!.amount);

    return {
      employeeId: row.employeeId,
      date: row.date,
      rank: row.rank || "Unassigned rank",
      category,
      hours,
      cost,
      overtimeHours,
      overtimeCost,
    };
  });
}
