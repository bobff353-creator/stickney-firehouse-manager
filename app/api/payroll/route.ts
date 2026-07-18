import { ensureDatabase } from "../../../db/bootstrap";

const categories = ["shift", "drill", "workDetail", "callback", "actingOfficer", "holiday", "dpw"] as const;
const ownerAdminEmails = ["bobff353@gmail.com"];

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

    const employeeSelect = "SELECT e.id, e.name, e.pay_scale_id AS payScaleId, e.active, p.label AS rank, p.regular_rate AS regularRate, p.overtime_rate AS overtimeRate, p.holiday_rate AS holidayRate, ep.employee_number AS employeeNumber, ep.start_date AS startDate, ep.end_date AS endDate, ep.date_of_birth AS dateOfBirth, ep.phone, ep.email, ep.address_line_1 AS addressLine1, ep.city, ep.state, ep.postal_code AS postalCode, COALESCE(ep.employment_type, 'Part-time') AS employmentType, COALESCE(ep.is_dpw, 0) AS isDpw, COALESCE(ep.driver_status, '') AS driverStatus, COALESCE(ep.is_admin, 0) AS isAdmin, ep.emergency_name AS emergencyName, ep.emergency_relationship AS emergencyRelationship, ep.emergency_phone AS emergencyPhone, ep.notes FROM employees e JOIN pay_scales p ON p.id = e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id = e.id WHERE e.active = 1";
    const employeeQuery = viewer.isAdmin ? db.prepare(`${employeeSelect} ORDER BY e.sort_order, e.name`).all() : db.prepare("SELECT e.id, e.name, e.pay_scale_id AS payScaleId, e.active, p.label AS rank, p.regular_rate AS regularRate, p.overtime_rate AS overtimeRate, p.holiday_rate AS holidayRate, ep.start_date AS startDate, ep.end_date AS endDate, COALESCE(ep.employment_type, 'Part-time') AS employmentType, COALESCE(ep.is_dpw, 0) AS isDpw FROM employees e JOIN pay_scales p ON p.id = e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id = e.id WHERE e.active = 1 AND e.id = ?").bind(viewer.employeeId).all();
    const entryQuery = viewer.isAdmin ? db.prepare("SELECT id, employee_id AS employeeId, work_date AS workDate, category, hours FROM time_entries WHERE period_start = ? ORDER BY work_date").bind(start).all() : db.prepare("SELECT id, employee_id AS employeeId, work_date AS workDate, category, hours FROM time_entries WHERE period_start = ? AND employee_id = ? ORDER BY work_date").bind(start, viewer.employeeId).all();
    const scaleQuery = viewer.isAdmin ? db.prepare("SELECT id, label, regular_rate AS regularRate, overtime_rate AS overtimeRate, holiday_rate AS holidayRate FROM pay_scales ORDER BY sort_order").all() : db.prepare("SELECT p.id, p.label, p.regular_rate AS regularRate, p.overtime_rate AS overtimeRate, p.holiday_rate AS holidayRate FROM pay_scales p JOIN employees e ON e.pay_scale_id = p.id WHERE e.id = ?").bind(viewer.employeeId).all();
    const [employeeRows, entryRows, scaleRows, settingsRow, periodRow] = await Promise.all([
      employeeQuery,
      entryQuery,
      scaleQuery,
      db.prepare("SELECT overtime_threshold AS overtimeThreshold, acting_officer_premium AS actingOfficerPremium, dpw_multiplier AS dpwMultiplier FROM payroll_settings WHERE id = 1").first(),
      db.prepare("SELECT start_date AS startDate, end_date AS endDate, status FROM pay_periods WHERE start_date = ?").bind(start).first(),
    ]);

    return Response.json({
      period: periodRow,
      employees: employeeRows.results,
      entries: entryRows.results,
      payScales: scaleRows.results,
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
      if (hours === 0) {
        await db.prepare("DELETE FROM time_entries WHERE employee_id = ? AND work_date = ? AND category = ?").bind(employeeId, workDate, category).run();
      } else {
        await db.prepare("INSERT INTO time_entries (id, employee_id, period_start, work_date, category, hours, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(employee_id, work_date, category) DO UPDATE SET hours = excluded.hours, period_start = excluded.period_start, updated_at = CURRENT_TIMESTAMP").bind(crypto.randomUUID(), employeeId, periodStart, workDate, category, hours).run();
      }
      return Response.json({ ok: true });
    }

    if (action === "saveRules") {
      const overtimeThreshold = Number(payload.overtimeThreshold);
      const actingOfficerPremium = Number(payload.actingOfficerPremium);
      const dpwMultiplier = Number(payload.dpwMultiplier);
      if (![overtimeThreshold, actingOfficerPremium, dpwMultiplier].every(Number.isFinite)) return Response.json({ error: "Invalid payroll rules" }, { status: 400 });
      await db.prepare("UPDATE payroll_settings SET overtime_threshold = ?, acting_officer_premium = ?, dpw_multiplier = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1").bind(overtimeThreshold, actingOfficerPremium, dpwMultiplier).run();
      const scales = Array.isArray(payload.payScales) ? payload.payScales as Array<Record<string, unknown>> : [];
      for (const scale of scales) {
        const regularRate = Number(scale.regularRate);
        const premiumRate = Math.round(regularRate * 1.5 * 100) / 100;
        await db.prepare("UPDATE pay_scales SET regular_rate = ?, overtime_rate = ?, holiday_rate = ? WHERE id = ?").bind(regularRate, premiumRate, premiumRate, String(scale.id)).run();
      }
      return Response.json({ ok: true });
    }

    if (action === "saveEmployee") {
      const id = String(payload.id || crypto.randomUUID());
      const name = String(payload.name ?? "").trim();
      const payScaleId = String(payload.payScaleId ?? "");
      if (!name || !payScaleId) return Response.json({ error: "Employee name and pay scale are required" }, { status: 400 });
      await db.prepare("INSERT INTO employees (id, name, pay_scale_id, active, sort_order) VALUES (?, ?, ?, 1, 999) ON CONFLICT(id) DO UPDATE SET name = excluded.name, pay_scale_id = excluded.pay_scale_id, active = 1").bind(id, name, payScaleId).run();
      await db.prepare("INSERT INTO employee_profiles (employee_id, employee_number, start_date, end_date, date_of_birth, phone, email, address_line_1, city, state, postal_code, employment_type, is_dpw, driver_status, is_admin, emergency_name, emergency_relationship, emergency_phone, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(employee_id) DO UPDATE SET employee_number = excluded.employee_number, start_date = excluded.start_date, end_date = excluded.end_date, date_of_birth = excluded.date_of_birth, phone = excluded.phone, email = excluded.email, address_line_1 = excluded.address_line_1, city = excluded.city, state = excluded.state, postal_code = excluded.postal_code, employment_type = excluded.employment_type, is_dpw = excluded.is_dpw, driver_status = excluded.driver_status, is_admin = excluded.is_admin, emergency_name = excluded.emergency_name, emergency_relationship = excluded.emergency_relationship, emergency_phone = excluded.emergency_phone, notes = excluded.notes, updated_at = CURRENT_TIMESTAMP").bind(id, String(payload.employeeNumber ?? "").trim() || null, String(payload.startDate ?? "") || null, String(payload.endDate ?? "") || null, String(payload.dateOfBirth ?? "") || null, String(payload.phone ?? "").trim() || null, String(payload.email ?? "").trim().toLowerCase() || null, String(payload.addressLine1 ?? "").trim() || null, String(payload.city ?? "").trim() || null, String(payload.state ?? "").trim() || null, String(payload.postalCode ?? "").trim() || null, String(payload.employmentType ?? "Part-time"), payload.isDpw ? 1 : 0, String(payload.driverStatus ?? ""), payload.isAdmin ? 1 : 0, String(payload.emergencyName ?? "").trim() || null, String(payload.emergencyRelationship ?? "").trim() || null, String(payload.emergencyPhone ?? "").trim() || null, String(payload.notes ?? "").trim() || null).run();
      return Response.json({ ok: true, id });
    }

    if (action === "setPeriodStatus") {
      const periodStart = cleanStart(String(payload.periodStart ?? ""));
      const status = String(payload.status ?? "draft");
      if (!['draft', 'reviewed', 'finalized'].includes(status)) return Response.json({ error: "Invalid status" }, { status: 400 });
      await db.prepare("INSERT INTO pay_periods (start_date, end_date, status, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(start_date) DO UPDATE SET status = excluded.status, updated_at = CURRENT_TIMESTAMP").bind(periodStart, periodEnd(periodStart), status).run();
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save payroll" }, { status: 500 });
  }
}
