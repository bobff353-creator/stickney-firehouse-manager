import { ensureDatabase } from "../../../db/bootstrap";

const ownerAdminEmails = ["bobff353@gmail.com"];
const isOfficer = (rank: string) => /(chief|captain|lieutenant)/i.test(rank);

async function viewer(db: Awaited<ReturnType<typeof ensureDatabase>>, request: Request) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  const employee = email ? await db.prepare("SELECT e.id, e.name, p.label AS rank, COALESCE(ep.is_admin, 0) AS isAdmin FROM employees e JOIN pay_scales p ON p.id = e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id = e.id WHERE e.active = 1 AND lower(ep.email) = ? LIMIT 1").bind(email).first<{ id: string; name: string; rank: string; isAdmin: number }>() : null;
  return { email, employeeId: employee?.id ?? null, name: employee?.name ?? (email || "Employee"), isAdmin: ownerAdminEmails.includes(email) || Boolean(employee?.isAdmin), rank: employee?.rank ?? "" };
}

function addDays(iso: string, count: number) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function payrollPeriod(workDate: string) {
  const date = new Date(`${workDate}T12:00:00Z`);
  const day = date.getUTCDate();
  if (day >= 26) return { start: `${workDate.slice(0, 8)}26`, end: addDays(`${workDate.slice(0, 8)}26`, 15) };
  if (day >= 11) return { start: `${workDate.slice(0, 8)}11`, end: addDays(`${workDate.slice(0, 8)}11`, 14) };
  const previous = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 26, 12));
  const start = previous.toISOString().slice(0, 10);
  return { start, end: addDays(start, 15) };
}

async function requestRows(db: Awaited<ReturnType<typeof ensureDatabase>>) {
  const requests = await db.prepare("SELECT w.id, w.work_date AS workDate, w.requesting_officer_id AS requestingOfficerId, ro.name AS requestingOfficerName, w.approver_id AS approverId, ap.name AS approverName, w.start_time AS startTime, w.end_time AS endTime, w.total_hours AS totalHours, w.work_type AS workType, w.description, w.certified, w.status, w.submitted_by AS submittedBy, w.submitted_at AS submittedAt, w.approved_by AS approvedBy, w.approved_at AS approvedAt, w.rejection_note AS rejectionNote FROM work_detail_requests w JOIN employees ro ON ro.id = w.requesting_officer_id JOIN employees ap ON ap.id = w.approver_id ORDER BY CASE w.status WHEN 'pending' THEN 0 ELSE 1 END, w.work_date DESC, w.submitted_at DESC LIMIT 100").all<Record<string, unknown>>();
  const rows = [];
  for (const item of requests.results) {
    const members = await db.prepare("SELECT e.id, e.name, p.label AS rank FROM work_detail_members m JOIN employees e ON e.id = m.employee_id JOIN pay_scales p ON p.id = e.pay_scale_id WHERE m.request_id = ? ORDER BY e.name COLLATE NOCASE").bind(String(item.id)).all();
    rows.push({ ...item, members: members.results });
  }
  return rows;
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const current = await viewer(db, request);
    if (!current.isAdmin && !current.employeeId) return Response.json({ error: "Your login is not connected to an employee record." }, { status: 403 });
    const employees = await db.prepare("SELECT e.id, e.name, p.label AS rank, COALESCE(ep.is_admin, 0) AS isAdmin FROM employees e JOIN pay_scales p ON p.id = e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id = e.id WHERE e.active = 1 ORDER BY e.name COLLATE NOCASE").all<{ id: string; name: string; rank: string; isAdmin: number }>();
    return Response.json({ viewer: current, employees: employees.results, officers: employees.results.filter((employee) => isOfficer(employee.rank)), approvers: employees.results.filter((employee) => employee.isAdmin || isOfficer(employee.rank)), requests: await requestRows(db) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load work details" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await ensureDatabase();
    const current = await viewer(db, request);
    if (!current.isAdmin && !current.employeeId) return Response.json({ error: "Your login is not connected to an employee record." }, { status: 403 });
    const payload = await request.json() as Record<string, unknown>;
    const action = String(payload.action ?? "submit");

    if (action === "submit") {
      const workDate = String(payload.workDate ?? ""), requestingOfficerId = String(payload.requestingOfficerId ?? ""), approverId = String(payload.approverId ?? ""), startTime = String(payload.startTime ?? ""), endTime = String(payload.endTime ?? ""), workType = String(payload.workType ?? "").trim(), description = String(payload.description ?? "").trim();
      const employeeIds = [...new Set(Array.isArray(payload.employeeIds) ? payload.employeeIds.map(String).filter(Boolean) : [])];
      const totalHours = Number(payload.totalHours);
      if ((startTime && !endTime) || (!startTime && endTime)) return Response.json({ error: "Enter both optional times or leave both blank." }, { status: 400 });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate) || !requestingOfficerId || !approverId || !workType || !description || !payload.certified || employeeIds.length === 0 || !Number.isFinite(totalHours) || totalHours <= 0) return Response.json({ error: "Complete every required field, enter total time, select at least one member, and certify the sheet." }, { status: 400 });
      const validEmployees = await db.prepare(`SELECT COUNT(*) AS count FROM employees WHERE active = 1 AND id IN (${employeeIds.map(() => "?").join(",")})`).bind(...employeeIds).first<{ count: number }>();
      const requestingOfficer = await db.prepare("SELECT p.label AS rank FROM employees e JOIN pay_scales p ON p.id = e.pay_scale_id WHERE e.id = ? AND e.active = 1").bind(requestingOfficerId).first<{ rank: string }>();
      const approver = await db.prepare("SELECT p.label AS rank, COALESCE(ep.is_admin, 0) AS isAdmin FROM employees e JOIN pay_scales p ON p.id = e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id = e.id WHERE e.id = ? AND e.active = 1").bind(approverId).first<{ rank: string; isAdmin: number }>();
      if (Number(validEmployees?.count ?? 0) !== employeeIds.length || !requestingOfficer || !isOfficer(requestingOfficer.rank) || !approver || (!approver.isAdmin && !isOfficer(approver.rank))) return Response.json({ error: "One or more selected personnel records are invalid." }, { status: 400 });
      const id = crypto.randomUUID();
      await db.batch([db.prepare("INSERT INTO work_detail_requests (id, work_date, requesting_officer_id, approver_id, start_time, end_time, total_hours, work_type, description, certified, status, submitted_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending', ?)").bind(id, workDate, requestingOfficerId, approverId, startTime, endTime, totalHours, workType, description, current.name), ...employeeIds.map((employeeId) => db.prepare("INSERT INTO work_detail_members (request_id, employee_id) VALUES (?, ?)").bind(id, employeeId))]);
      return Response.json({ ok: true, id });
    }

    const id = String(payload.id ?? "");
    const detail = await db.prepare("SELECT id, work_date AS workDate, approver_id AS approverId, total_hours AS totalHours, status FROM work_detail_requests WHERE id = ?").bind(id).first<{ id: string; workDate: string; approverId: string; totalHours: number; status: string }>();
    if (!detail) return Response.json({ error: "Work detail sheet was not found." }, { status: 404 });
    if (!current.isAdmin && current.employeeId !== detail.approverId) return Response.json({ error: "Only the selected approver or an administrator can review this sheet." }, { status: 403 });
    if (detail.status !== "pending") return Response.json({ error: "This work detail sheet has already been reviewed." }, { status: 409 });
    if (action === "reject") {
      const note = String(payload.note ?? "").trim();
      if (!note) return Response.json({ error: "Enter a reason before rejecting the sheet." }, { status: 400 });
      await db.prepare("UPDATE work_detail_requests SET status = 'rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP, rejection_note = ? WHERE id = ? AND status = 'pending'").bind(current.name, note, id).run();
      return Response.json({ ok: true });
    }
    if (action === "approve") {
      const members = await db.prepare("SELECT employee_id AS employeeId FROM work_detail_members WHERE request_id = ?").bind(id).all<{ employeeId: string }>();
      const period = payrollPeriod(detail.workDate);
      const statements = [db.prepare("INSERT OR IGNORE INTO pay_periods (start_date, end_date, status) VALUES (?, ?, 'draft')").bind(period.start, period.end)];
      for (const member of members.results) {
        statements.push(
          db.prepare("INSERT INTO time_entries (id, employee_id, period_start, work_date, category, hours, updated_at) SELECT ?, ?, ?, ?, 'workDetail', ?, CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM work_detail_postings WHERE request_id = ? AND employee_id = ?) ON CONFLICT(employee_id, work_date, category) DO UPDATE SET hours = time_entries.hours + excluded.hours, period_start = excluded.period_start, updated_at = CURRENT_TIMESTAMP").bind(crypto.randomUUID(), member.employeeId, period.start, detail.workDate, detail.totalHours, id, member.employeeId),
          db.prepare("INSERT OR IGNORE INTO work_detail_postings (request_id, employee_id, hours) VALUES (?, ?, ?)").bind(id, member.employeeId, detail.totalHours),
        );
      }
      statements.push(db.prepare("UPDATE work_detail_requests SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'").bind(current.name, id));
      await db.batch(statements);
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unsupported work detail action." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save work detail" }, { status: 500 });
  }
}
