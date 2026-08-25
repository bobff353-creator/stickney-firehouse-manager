import { holidayForDate } from "./holidays.ts";
import { ACTING_OFFICER_STIPEND_PER_HOUR, workDetailRateForRank } from "./payroll-calculation.ts";

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
    .filter((rate) => rate.payScaleId === row.payScaleId && rate.effectiveDate <= row.date)
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
  const running = new Map<string, number>();
  const threshold = Number(settings.overtimeThreshold || 106);
  const dpwMultiplier = Number(settings.dpwMultiplier || 1.5);
  const aoPremium = Number(settings.actingOfficerPremium || ACTING_OFFICER_STIPEND_PER_HOUR);

  return rows.map((row) => {
    const category = normalizedCategory(row.category);
    const hours = Number(row.hours || 0);
    const rates = effectiveRate(row, history);
    let cost = 0;
    let overtimeHours = 0;
    let overtimeCost = 0;

    if (category === "actingOfficer") {
      cost = hours * aoPremium;
    } else if (category === "holiday") {
      cost = hours * rates.holidayRate;
    } else if (category === "dpw") {
      cost = hours * rates.regularRate * dpwMultiplier;
    } else if (category === "workDetail") {
      cost = hours * workDetailRateForRank(row.rank, rates.regularRate, rates.overtimeRate);
    } else {
      const key = `${row.employeeId}:${row.periodStart}`;
      const before = running.get(key) || 0;
      overtimeHours = Math.max(0, before + hours - threshold) - Math.max(0, before - threshold);
      running.set(key, before + hours);
      overtimeCost = overtimeHours * rates.regularRate * 1.5;
      cost = (hours - overtimeHours) * rates.regularRate + overtimeCost;
    }

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
