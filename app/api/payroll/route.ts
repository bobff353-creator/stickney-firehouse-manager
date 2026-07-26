import { ensureDatabase } from "../../../db/bootstrap";
import { employeeNameFromParts, formatEmployeeName } from "../../employee-names";
import { roundPayrollUpToCent } from "../../payroll-rounding";
import { ACTING_OFFICER_STIPEND_PER_HOUR } from "../../payroll-calculation";

const categories = ["shift", "drill", "workDetail", "callback", "actingOfficer", "holiday", "dpw"] as const;
const ownerAdminEmails = ["bobff353@gmail.com"];
async function addRevision(db: Awaited<ReturnType<typeof ensureDatabase>>, id: string, action: string, summary: string, actor: string) { await db.prepare("INSERT INTO record_revisions (id, record_type, record_id, revision_number, action, summary, actor) SELECT ?, 'payroll', ?, COALESCE(MAX(revision_number), 0) + 1, ?, ?, ? FROM record_revisions WHERE record_type = 'payroll' AND record_id = ?").bind(crypto.randomUUID(), id, action, summary, actor, id).run(); }

async function getViewer(db: Awaited<ReturnType<typeof ensureDatabase>>, request: Request) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  const employee = email ? await db.prepare("SELECT e.id, e.name, COALESCE(ep.is_admin, 0) AS isAdmin FROM employees e JOIN employee_profiles ep ON ep.employee_id = e.id WHERE e.active = 1 AND lower(ep.email) = ? LIMIT 1").bind(email).first<{ id: string; name: string; isAdmin: number }>() : null;
  const isAdmin = ownerAdminEmails.includes(email) || Boolean(employee?.isAdmin);
  return { email, isAdmin, employeeId: employee?.id ?? null, displayName: employee?.name ?? (email || "Employee") };
}

function addDays(iso: string, count: number) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function periodEnd(start: string) {
  const day = Number(start.slice(8, 10));
  if (day === 11) return addDays(start, 14);
  if (day === 26) {
    const date = new Date(`${start}T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + 1, 10);
    return date.toISOString().slice(0, 10);
  }
  throw new Error("Pay periods must start on the 11th or 26th");
}

function cleanStart(value: string | null) {
  return /^\d{4}-\d{2}-(11|26)$/.test(value ?? "") ? value! : "2026-07-11";
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const viewer = await getViewer(db, request);
    if (!viewer.isAdmin && !viewer.employeeId) return Response.json({ error: "Your login email is not connected to an employee record. Ask an administrator to add the same email to Employee Information." }, { status: 403 });
    const url = new URL(request.url);
    const start = cleanStart(url.searchParams.get("period"));
    const end = periodEnd(start);
    await db.prepare("INSERT OR IGNORE INTO pay_periods (start_date, end_date, status) VALUES (?, ?, 'draft')").bind(start, end).run();

    const employeeSelect = "SELECT e.id, e.name, e.pay_scale_id AS payScaleId, e.active, p.label AS rank, p.regular_rate AS regularRate, p.overtime_rate AS overtimeRate, p.holiday_rate AS holidayRate, ep.employee_number AS employeeNumber, ep.start_date AS startDate, ep.end_date AS endDate, ep.date_of_birth AS dateOfBirth, ep.phone, ep.email, ep.address_line_1 AS addressLine1, ep.city, ep.state, ep.postal_code AS postalCode, COALESCE(ep.employment_type, 'Part-time') AS employmentType, COALESCE(ep.is_dpw, 0) AS isDpw, COALESCE(ep.driver_status, '') AS driverStatus, COALESCE(ep.is_admin, 0) AS isAdmin, ep.emergency_name AS emergencyName, ep.emergency_relationship AS emergencyRelationship, ep.emergency_phone AS emergencyPhone, ep.photo_updated_at AS photoUpdatedAt, ep.notes FROM employees e JOIN pay_scales p ON p.id = e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id = e.id WHERE e.active = 1";
    const employeeQuery = viewer.isAdmin ? db.prepare(`${employeeSelect} ORDER BY e.name COLLATE NOCASE`).all() : db.prepare("SELECT e.id, e.name, e.pay_scale_id AS payScaleId, e.active, p.label AS rank, p.regular_rate AS regularRate, p.overtime_rate AS overtimeRate, p.holiday_rate AS holidayRate, ep.start_date AS startDate, ep.end_date AS endDate, COALESCE(ep.employment_type, 'Part-time') AS employmentType, COALESCE(ep.is_dpw, 0) AS isDpw FROM employees e JOIN pay_scales p ON p.id = e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id = e.id WHERE e.active = 1 AND e.id = ?").bind(viewer.employeeId).all();
    const entrySelect = "SELECT MIN(id) AS id, employee_id AS employeeId, work_date AS workDate, CASE WHEN category = 'dailyLogDpw' THEN 'dpw' ELSE category END AS category, SUM(hours) AS hours FROM time_entries";
    const entryGroup = "GROUP BY employee_id, work_date, CASE WHEN category = 'dailyLogDpw' THEN 'dpw' ELSE category END ORDER BY work_date";
    const entryQuery = viewer.isAdmin ? db.prepare(`${entrySelect} WHERE period_start = ? ${entryGroup}`).bind(start).all() : db.prepare(`${entrySelect} WHERE period_start = ? AND employee_id = ? ${entryGroup}`).bind(start, viewer.employeeId).all();
    const scaleQuery = viewer.isAdmin ? db.prepare("SELECT id, label, regular_rate AS regularRate, overtime_rate AS overtimeRate, holiday_rate AS holidayRate FROM pay_scales ORDER BY sort_order").all() : db.prepare("SELECT p.id, p.label, p.regular_rate AS regularRate, p.overtime_rate AS overtimeRate, p.holiday_rate AS holidayRate FROM pay_scales p JOIN employees e ON e.pay_scale_id = p.id WHERE e.id = ?").bind(viewer.employeeId).all();
    const [employeeRows, entryRows, scaleRows, settingsRow, periodRow, rateHistoryRows] = await Promise.all([
      employeeQuery,
      entryQuery,
      scaleQuery,
      db.prepare("SELECT overtime_threshold AS overtimeThreshold, acting_officer_premium AS actingOfficerPremium, dpw_multiplier AS dpwMultiplier FROM payroll_settings WHERE id = 1").first(),
      db.prepare("SELECT start_date AS startDate, end_date AS endDate, status, created_by AS createdBy, COALESCE(created_at, updated_at) AS createdAt, updated_by AS updatedBy, updated_at AS updatedAt, finalized_by AS finalizedBy, finalized_at AS finalizedAt FROM pay_periods WHERE start_date = ?").bind(start).first(),
      db.prepare("SELECT h.id, h.pay_scale_id AS payScaleId, p.label, h.effective_date AS effectiveDate, h.regular_rate AS regularRate, h.overtime_rate AS overtimeRate, h.holiday_rate AS holidayRate, h.created_by AS createdBy, h.created_at AS createdAt FROM pay_rate_history h JOIN pay_scales p ON p.id = h.pay_scale_id ORDER BY h.effective_date DESC, p.sort_order").all(),
    ]);

    const rateHistory = rateHistoryRows.results as Array<{ payScaleId: string; effectiveDate: string; regularRate: number; overtimeRate: number; holidayRate: number }>;
    const rateFor = (payScaleId: string) => rateHistory.find((rate) => rate.payScaleId === payScaleId && rate.effectiveDate <= start);
    const employeesForPeriod = (employeeRows.results as Array<Record<string, unknown>>).map((employee) => {
      const rate = rateFor(String(employee.payScaleId));
      return rate ? { ...employee, regularRate: rate.regularRate, overtimeRate: rate.overtimeRate, holidayRate: rate.holidayRate } : employee;
    });
    const scalesForPeriod = (scaleRows.results as Array<Record<string, unknown>>).map((scale) => {
      const rate = rateFor(String(scale.id));
      return rate ? { ...scale, regularRate: rate.regularRate, overtimeRate: rate.overtimeRate, holidayRate: rate.holidayRate } : scale;
    });
    const revisions = await db.prepare("SELECT revision_number AS revisionNumber, action, summary, actor, changed_at AS changedAt FROM record_revisions WHERE record_type = 'payroll' AND record_id = ? ORDER BY revision_number DESC").bind(start).all();
    return Response.json({
      period: { ...(periodRow as object), revisions: revisions.results },
      employees: employeesForPeriod,
      entries: entryRows.results,
      payScales: scalesForPeriod,
      rateHistory: viewer.isAdmin ? rateHistoryRows.results : [],
      settings: settingsRow,
      viewer,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load payroll" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await ensureDatabase();
    const viewer = await getViewer(db, request);
    if (!viewer.isAdmin) return Response.json({ error: "Administrator privileges are required to change payroll information." }, { status: 403 });
    const payload = await request.json() as Record<string, unknown>;
    const action = String(payload.action ?? "");

    if (action === "saveEntry") {
      const periodStart = cleanStart(String(payload.periodStart ?? ""));
      const employeeId = String(payload.employeeId ?? "");
      const workDate = String(payload.workDate ?? "");
      const category = String(payload.category ?? "");
      const hours = Number(payload.hours ?? 0);
      if (!employeeId || !/^\d{4}-\d{2}-\d{2}$/.test(workDate) || !categories.includes(category as typeof categories[number]) || !Number.isFinite(hours) || hours < 0 || hours > 48) {
        return Response.json({ error: "Invalid time entry" }, { status: 400 });
      }
      await db.prepare("INSERT OR IGNORE INTO pay_periods (start_date, end_date, status) VALUES (?, ?, 'draft')").bind(periodStart, periodEnd(periodStart)).run();
      const automaticDpw = category === "dpw"
        ? Number((await db.prepare("SELECT COALESCE(SUM(hours), 0) AS hours FROM time_entries WHERE employee_id = ? AND work_date = ? AND category = 'dailyLogDpw'").bind(employeeId, workDate).first<{ hours: number }>())?.hours ?? 0)
        : 0;
      if (category === "dpw" && hours < automaticDpw) {
        return Response.json({ error: `The Daily Log already supplies ${automaticDpw} DPW hours for this date. Correct the Daily Log to reduce that time.` }, { status: 409 });
      }
      const manualHours = category === "dpw" ? Math.round((hours - automaticDpw) * 100) / 100 : hours;
      if (manualHours === 0) {
        await db.prepare("DELETE FROM time_entries WHERE employee_id = ? AND work_date = ? AND category = ?").bind(employeeId, workDate, category).run();
      } else {
        await db.prepare("INSERT INTO time_entries (id, employee_id, period_start, work_date, category, hours, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(employee_id, work_date, category) DO UPDATE SET hours = excluded.hours, period_start = excluded.period_start, updated_at = CURRENT_TIMESTAMP").bind(crypto.randomUUID(), employeeId, periodStart, workDate, category, manualHours).run();
      }
      await db.prepare("UPDATE pay_periods SET updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE start_date = ?").bind(viewer.displayName, periodStart).run();
      await addRevision(db, periodStart, "Hours updated", `${workDate} ${category} entry updated to ${hours} total hours`, viewer.displayName);
      return Response.json({ ok: true });
    }

    if (action === "saveRules") {
      const overtimeThreshold = Number(payload.overtimeThreshold);
      const dpwMultiplier = Number(payload.dpwMultiplier);
      const effectiveDate = String(payload.effectiveDate ?? "");
      if (![overtimeThreshold, dpwMultiplier].every(Number.isFinite)) return Response.json({ error: "Invalid payroll rules" }, { status: 400 });
      if (!/^\d{4}-\d{2}-(11|26)$/.test(effectiveDate)) return Response.json({ error: "Rate effective date must be the first day of a payroll period—the 11th or 26th." }, { status: 400 });
      await db.prepare("UPDATE payroll_settings SET overtime_threshold = ?, acting_officer_premium = ?, dpw_multiplier = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1").bind(overtimeThreshold, ACTING_OFFICER_STIPEND_PER_HOUR, dpwMultiplier).run();
      const scales = Array.isArray(payload.payScales) ? payload.payScales as Array<Record<string, unknown>> : [];
      for (const scale of scales) {
        const regularRate = Number(scale.regularRate);
        if (!Number.isFinite(regularRate) || regularRate < 0) return Response.json({ error: "Every pay rate must be a valid amount." }, { status: 400 });
        const premiumRate = roundPayrollUpToCent(regularRate * 1.5);
        const payScaleId = String(scale.id);
        await db.prepare("INSERT INTO pay_rate_history (id, pay_scale_id, effective_date, regular_rate, overtime_rate, holiday_rate, created_by) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(pay_scale_id, effective_date) DO UPDATE SET regular_rate = excluded.regular_rate, overtime_rate = excluded.overtime_rate, holiday_rate = excluded.holiday_rate, created_by = excluded.created_by, created_at = CURRENT_TIMESTAMP").bind(crypto.randomUUID(), payScaleId, effectiveDate, regularRate, premiumRate, premiumRate, viewer.displayName).run();
        await db.prepare("UPDATE pay_scales SET regular_rate = (SELECT regular_rate FROM pay_rate_history WHERE pay_scale_id = ? AND effective_date <= date('now') ORDER BY effective_date DESC LIMIT 1), overtime_rate = (SELECT overtime_rate FROM pay_rate_history WHERE pay_scale_id = ? AND effective_date <= date('now') ORDER BY effective_date DESC LIMIT 1), holiday_rate = (SELECT holiday_rate FROM pay_rate_history WHERE pay_scale_id = ? AND effective_date <= date('now') ORDER BY effective_date DESC LIMIT 1) WHERE id = ?").bind(payScaleId, payScaleId, payScaleId, payScaleId).run();
      }
      await addRevision(db, effectiveDate, "Rates updated", `Pay rates saved effective ${effectiveDate}`, viewer.displayName);
      return Response.json({ ok: true, effectiveDate });
    }

    if (action === "saveEmployee") {
      const id = String(payload.id || crypto.randomUUID());
      const lastName = String(payload.lastName ?? "").trim();
      const firstName = String(payload.firstName ?? "").trim();
      const name = lastName && firstName ? employeeNameFromParts(lastName, firstName) : formatEmployeeName(String(payload.name ?? ""));
      const payScaleId = String(payload.payScaleId ?? "");
      if (!lastName || !firstName || !payScaleId) return Response.json({ error: "Last name, first name, and pay scale are required" }, { status: 400 });
      await db.prepare("INSERT INTO employees (id, name, pay_scale_id, active, sort_order) VALUES (?, ?, ?, 1, 999) ON CONFLICT(id) DO UPDATE SET name = excluded.name, pay_scale_id = excluded.pay_scale_id, active = 1").bind(id, name, payScaleId).run();
      await db.prepare("INSERT INTO employee_profiles (employee_id, employee_number, start_date, end_date, date_of_birth, phone, email, address_line_1, city, state, postal_code, employment_type, is_dpw, driver_status, is_admin, emergency_name, emergency_relationship, emergency_phone, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(employee_id) DO UPDATE SET employee_number = excluded.employee_number, start_date = excluded.start_date, end_date = excluded.end_date, date_of_birth = excluded.date_of_birth, phone = excluded.phone, email = excluded.email, address_line_1 = excluded.address_line_1, city = excluded.city, state = excluded.state, postal_code = excluded.postal_code, employment_type = excluded.employment_type, is_dpw = excluded.is_dpw, driver_status = excluded.driver_status, is_admin = excluded.is_admin, emergency_name = excluded.emergency_name, emergency_relationship = excluded.emergency_relationship, emergency_phone = excluded.emergency_phone, notes = excluded.notes, updated_at = CURRENT_TIMESTAMP").bind(id, String(payload.employeeNumber ?? "").trim() || null, String(payload.startDate ?? "") || null, String(payload.endDate ?? "") || null, String(payload.dateOfBirth ?? "") || null, String(payload.phone ?? "").trim() || null, String(payload.email ?? "").trim().toLowerCase() || null, String(payload.addressLine1 ?? "").trim() || null, String(payload.city ?? "").trim() || null, String(payload.state ?? "").trim() || null, String(payload.postalCode ?? "").trim() || null, String(payload.employmentType ?? "Part-time"), payload.isDpw ? 1 : 0, String(payload.driverStatus ?? ""), payload.isAdmin ? 1 : 0, String(payload.emergencyName ?? "").trim() || null, String(payload.emergencyRelationship ?? "").trim() || null, String(payload.emergencyPhone ?? "").trim() || null, String(payload.notes ?? "").trim() || null).run();
      return Response.json({ ok: true, id });
    }

    if (action === "deleteEmployee") {
      const employeeId = String(payload.employeeId ?? "");
      if (!employeeId) return Response.json({ error: "Employee is required" }, { status: 400 });
      const employee = await db.prepare("SELECT name FROM employees WHERE id = ? AND active = 1").bind(employeeId).first<{ name: string }>();
      if (!employee) return Response.json({ error: "Employee was not found" }, { status: 404 });
      const history = await db.prepare("SELECT (SELECT COUNT(*) FROM time_entries WHERE employee_id = ?) + (SELECT COUNT(*) FROM daily_log_staffing WHERE employee_id = ?) + (SELECT COUNT(*) FROM daily_log_approvals WHERE sign_in_officer_id = ? OR sign_out_officer_id = ?) AS count").bind(employeeId, employeeId, employeeId, employeeId).first<{ count: number }>();
      if (Number(history?.count ?? 0) > 0) {
        return Response.json({ error: "This employee has payroll or Daily Log history and cannot be permanently deleted. Add a Last day of work instead to keep department records intact." }, { status: 409 });
      }
      await db.prepare("INSERT INTO system_meta (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP").bind(`employee_deleted:${employeeId}`, viewer.displayName).run();
      await db.prepare("DELETE FROM employee_profiles WHERE employee_id = ?").bind(employeeId).run();
      await db.prepare("DELETE FROM employees WHERE id = ?").bind(employeeId).run();
      return Response.json({ ok: true, name: employee.name });
    }

    if (action === "setPeriodStatus") {
      const periodStart = cleanStart(String(payload.periodStart ?? ""));
      const status = String(payload.status ?? "draft");
      if (!['draft', 'reviewed', 'finalized'].includes(status)) return Response.json({ error: "Invalid status" }, { status: 400 });
      await db.prepare("INSERT INTO pay_periods (start_date, end_date, status, created_by, updated_by, updated_at, finalized_by, finalized_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CASE WHEN ? = 'finalized' THEN ? END, CASE WHEN ? = 'finalized' THEN CURRENT_TIMESTAMP END) ON CONFLICT(start_date) DO UPDATE SET status = excluded.status, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP, finalized_by = CASE WHEN excluded.status = 'finalized' THEN excluded.updated_by ELSE pay_periods.finalized_by END, finalized_at = CASE WHEN excluded.status = 'finalized' THEN CURRENT_TIMESTAMP ELSE pay_periods.finalized_at END").bind(periodStart, periodEnd(periodStart), status, viewer.displayName, viewer.displayName, status, viewer.displayName, status).run();
      await addRevision(db, periodStart, status === "finalized" ? "Finalized" : "Status changed", `Payroll status changed to ${status}`, viewer.displayName);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save payroll" }, { status: 500 });
  }
}
