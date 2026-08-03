import { ACTING_OFFICER_STIPEND_PER_HOUR } from "./payroll-calculation.ts";

export type PayrollExportEmployee = {
  name: string;
  rank: string;
  regularRate: number;
  overtimeRate: number;
  holidayRate: number;
  isDpw?: number | boolean;
};

export type PayrollExportEntry = {
  category: "shift" | "drill" | "workDetail" | "callback" | "actingOfficer" | "holiday" | "dpw";
  hours: number;
};

function numberCell(value: number) {
  return Number(value.toFixed(2));
}

function moneyCell(value: number) {
  return value.toFixed(2);
}

export function payrollExportRows(
  employee: PayrollExportEmployee,
  entries: PayrollExportEntry[],
  overtimeThreshold: number,
  dpwMultiplier: number,
) {
  const total = (category: PayrollExportEntry["category"]) =>
    entries.filter((entry) => entry.category === category).reduce((sum, entry) => sum + entry.hours, 0);

  const shift = total("shift");
  const drill = total("drill");
  const workDetail = total("workDetail");
  const callback = total("callback");
  const actingOfficer = total("actingOfficer");
  const holiday = total("holiday");
  const dpw = total("dpw");
  const baseHours = shift + drill + workDetail + callback;
  const overtimeHours = Math.max(baseHours - overtimeThreshold, 0);
  const regularHours = Math.max(baseHours - overtimeHours, 0);
  const rows: Array<Array<string | number>> = [];

  rows.push([
    employee.name,
    employee.rank,
    numberCell(shift),
    numberCell(drill),
    numberCell(workDetail),
    numberCell(callback),
    0,
    numberCell(holiday),
    numberCell(regularHours + holiday + dpw),
    moneyCell(employee.regularRate),
    moneyCell(regularHours * employee.regularRate + holiday * employee.holidayRate + dpw * employee.regularRate * dpwMultiplier),
  ]);

  if (overtimeHours > 0) {
    rows.push([
      `${employee.name} (Overtime)`,
      `${employee.rank} Overtime`,
      0, 0, 0, 0, 0, 0,
      numberCell(overtimeHours),
      moneyCell(employee.overtimeRate),
      moneyCell(overtimeHours * employee.overtimeRate),
    ]);
  }

  if (actingOfficer > 0) {
    rows.push([
      `${employee.name} (Acting Officer)`,
      "Acting Officer",
      0, 0, 0, 0,
      numberCell(actingOfficer),
      0,
      numberCell(actingOfficer),
      moneyCell(ACTING_OFFICER_STIPEND_PER_HOUR),
      moneyCell(actingOfficer * ACTING_OFFICER_STIPEND_PER_HOUR),
    ]);
  }

  return rows;
}
