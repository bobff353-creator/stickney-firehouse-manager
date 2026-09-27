import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { ACTING_OFFICER_STIPEND_PER_HOUR, PAYROLL_PREMIUM_MULTIPLIER } from "./payroll-calculation";
import type { ensureDatabase } from "../db/bootstrap";
import { addPayDays, payPeriodEnd, type PayrollSources, type PayEmployee, type PayEntry, type PayAdjustment, type SavedSubmission } from "./payroll-submission";
import type { DepartmentScheduleAssignment } from "./department-schedule";

type Database = Awaited<ReturnType<typeof ensureDatabase>>;
export const payrollFingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
// The existing SQL gateway has a 200 KB statement limit and safely encodes
// quoted text. Compress larger audit documents instead of raising that limit.
export function encodePayrollDocument(value: unknown) {
  return JSON.stringify({ format: "payroll-gzip-v1", data: gzipSync(JSON.stringify(value)).toString("base64") });
}
export function decodePayrollDocument<T>(value: string): T {
  const parsed = JSON.parse(value);
  return parsed?.format === "payroll-gzip-v1" ? JSON.parse(gunzipSync(Buffer.from(parsed.data, "base64"), { maxOutputLength: 20 * 1024 * 1024 }).toString("utf8")) : parsed;
}
export async function sourceVersion(db: Database) {
  const row = await db.prepare("SELECT version FROM payroll_source_version WHERE id=1").first<{ version: number }>();
  if (!row || !Number.isSafeInteger(Number(row.version))) throw new Error("Payroll submission database setup is not installed.");
  return Number(row.version);
}
export async function loadSubmission(db: Database, period: string): Promise<SavedSubmission | null> {
  const row = await db.prepare("SELECT id,period_start AS period,document,created_by AS createdBy,created_at AS createdAt FROM payroll_submissions WHERE period_start=?").bind(period).first<Omit<SavedSubmission, "document"> & { document: string }>();
  return row ? { ...row, document: decodePayrollDocument(row.document) } : null;
}
export async function loadAdjustments(db: Database, period: string, direction: "incoming" | "outgoing") {
  const rows = await db.prepare(`SELECT document FROM payroll_adjustments WHERE ${direction === "incoming" ? "target_period" : "source_period"}=? ORDER BY source_period,employee_id,sequence`).bind(period).all<{ document: string }>();
  return rows.results.map(row => decodePayrollDocument<PayAdjustment>(row.document));
}
export async function loadPayrollSources(db: Database, period: string): Promise<PayrollSources> {
  const end = payPeriodEnd(period), version = await sourceVersion(db);
  const [employees, rates, settings, entries, schedule, logs, staffing, approvals, status] = await Promise.all([
    db.prepare("SELECT e.id,e.name,e.pay_scale_id AS payScaleId,p.label AS rank,p.regular_rate AS regularRate,p.overtime_rate AS overtimeRate,p.holiday_rate AS holidayRate,COALESCE(ep.is_dpw,0) AS isDpw FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id ORDER BY e.id").all<PayEmployee>(),
    db.prepare("SELECT pay_scale_id AS payScaleId,regular_rate AS regularRate,overtime_rate AS overtimeRate,holiday_rate AS holidayRate FROM pay_rate_history WHERE effective_date<=? ORDER BY effective_date DESC,id").bind(period).all<{ payScaleId: string; regularRate: number; overtimeRate: number; holidayRate: number }>(),
    db.prepare("SELECT overtime_threshold AS overtimeThreshold,dpw_multiplier AS dpwMultiplier FROM payroll_settings WHERE id=1").first<PayrollSources["settings"]>(),
    db.prepare("SELECT id,employee_id AS employeeId,work_date AS workDate,category,hours FROM time_entries WHERE period_start=? ORDER BY employee_id,work_date,category,id").bind(period).all<PayEntry>(),
    db.prepare("SELECT s.id,s.employee_id AS employeeId,en.entry_date AS workDate,COALESCE(NULLIF(s.start_time,''),t.start_time) AS startTime,COALESCE(NULLIF(s.end_time,''),t.end_time) AS endTime,s.role,'assigned' AS status FROM station_shift_slots s JOIN station_schedule_entries en ON en.id=s.entry_id JOIN station_shift_types t ON t.id=en.shift_type_id WHERE s.status='filled' AND t.active=1 AND en.entry_date BETWEEN ? AND ? ORDER BY en.entry_date,s.id").bind(addPayDays(period, -1), addPayDays(end, 1)).all<DepartmentScheduleAssignment>(),
    db.prepare("SELECT log_date AS logDate,updated_by AS updatedBy FROM daily_logs WHERE log_date BETWEEN ? AND ? ORDER BY log_date").bind(period, end).all<PayrollSources["logs"][number]>(),
    db.prepare("SELECT employee_id AS employeeId,log_date AS logDate,shift_key AS shiftKey,time_in AS timeIn,time_out AS timeOut FROM daily_log_staffing WHERE log_date BETWEEN ? AND ? ORDER BY log_date,id").bind(period, end).all<PayrollSources["staffing"][number]>(),
    db.prepare("SELECT log_date AS logDate,shift_key AS shiftKey,sign_out_at AS signOutAt FROM daily_log_approvals WHERE log_date BETWEEN ? AND ? ORDER BY log_date,shift_key").bind(period, end).all<PayrollSources["approvals"][number]>(),
    db.prepare("SELECT status FROM pay_periods WHERE start_date=?").bind(period).first<{ status: string }>(),
  ]);
  if (!settings) throw new Error("Payroll settings are missing. No pay rules were assumed.");
  if (version !== await sourceVersion(db)) throw new Error("SAVE_CONFLICT: Records changed during review. Refresh the preview.");
  const numeric = (value: unknown) => value == null || value === "" ? Number.NaN : Number(value);
  return { version, period, status: status?.status ?? "draft", employees: employees.results.map(e => {
    const rate = rates.results.find(r => r.payScaleId === e.payScaleId) ?? e;
    return { ...e, regularRate: numeric(rate.regularRate), overtimeRate: numeric(rate.regularRate) * PAYROLL_PREMIUM_MULTIPLIER, holidayRate: numeric(rate.regularRate) * PAYROLL_PREMIUM_MULTIPLIER };
  }), settings: { overtimeThreshold: numeric(settings.overtimeThreshold), dpwMultiplier: PAYROLL_PREMIUM_MULTIPLIER, actingOfficerPremium: ACTING_OFFICER_STIPEND_PER_HOUR }, entries: entries.results.map(e => ({ ...e, hours: numeric(e.hours) })), schedule: schedule.results, logs: logs.results, staffing: staffing.results, approvals: approvals.results };
}
export function payrollVersionGuard(db: Database, version: number) {
  return db.prepare("UPDATE payroll_source_version SET version=version WHERE id=1 AND version=?").bind(version).expectChanges(1);
}
