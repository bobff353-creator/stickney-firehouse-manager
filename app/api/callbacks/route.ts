import { ensureDatabase } from "../../../db/bootstrap";
import { employeeWasOnDutyAtCall } from "../../callback-duty";
import { hasPermission } from "../../server-permissions";

type DutyRow = { employeeId: string | null; employeeName: string; rank: string; timeIn: string; timeOut: string };
const actorEmail = (request: Request) => request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() || "";

async function actorEmployeeId(request: Request, db: Awaited<ReturnType<typeof ensureDatabase>>) {
  const email = actorEmail(request);
  if (!email) return null;
  return (await db.prepare("SELECT e.id FROM employees e JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND lower(trim(ep.email))=? LIMIT 1").bind(email).first<{ id: string }>())?.id ?? null;
}

async function reviewerSetting(db: Awaited<ReturnType<typeof ensureDatabase>>) {
  return db.prepare("SELECT s.reviewer_employee_id AS reviewerEmployeeId,e.name AS reviewerName,p.label AS reviewerRank FROM callback_review_settings s JOIN employees e ON e.id=s.reviewer_employee_id JOIN pay_scales p ON p.id=e.pay_scale_id WHERE s.id='default' LIMIT 1").first<{ reviewerEmployeeId: string; reviewerName: string; reviewerRank: string }>();
}

async function dutyRows(db: Awaited<ReturnType<typeof ensureDatabase>>, date: string) {
  return (await db.prepare("SELECT s.employee_id AS employeeId,e.name AS employeeName,p.label AS rank,s.time_in AS timeIn,s.time_out AS timeOut FROM daily_log_staffing s JOIN employees e ON e.id=s.employee_id JOIN pay_scales p ON p.id=e.pay_scale_id WHERE s.log_date=? AND e.active=1 ORDER BY e.name COLLATE NOCASE").bind(date).all<DutyRow>()).results;
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const url = new URL(request.url);
    if (url.searchParams.get("scope") === "review") {
      if (!await hasPermission(request, db, "payroll.manage")) return Response.json({ error: "Callback review access is not enabled for this account." }, { status: 403 });
      const [submissions, setting, reviewers] = await Promise.all([
        db.prepare("SELECT c.id,c.log_date AS logDate,c.call_id AS callId,c.report_number AS reportNumber,c.status,c.submitted_at AS submittedAt,c.reviewed_at AS reviewedAt,c.review_note AS reviewNote,e.name AS employeeName,p.label AS employeeRank,r.name AS reviewerName FROM daily_log_callback_submissions c JOIN employees e ON e.id=c.employee_id JOIN pay_scales p ON p.id=e.pay_scale_id JOIN employees r ON r.id=c.reviewer_employee_id ORDER BY CASE c.status WHEN 'pending' THEN 0 ELSE 1 END,c.submitted_at DESC").all(),
        reviewerSetting(db),
        db.prepare("SELECT e.id,e.name,p.label AS rank FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND (lower(p.label) IN ('lieutenant','captain','chief','deputy chief','assistant chief') OR COALESCE(ep.acting_officer_eligible,0)=1) ORDER BY e.name COLLATE NOCASE").all(),
      ]);
      return Response.json({ submissions: submissions.results, setting, reviewers: reviewers.results });
    }

    if (!await hasPermission(request, db, "daily_log.view")) return Response.json({ error: "Daily Log access is not enabled for this account." }, { status: 403 });
    const date = url.searchParams.get("date") ?? "";
    const callId = url.searchParams.get("callId") ?? "";
    const call = await db.prepare("SELECT id,report_number AS reportNumber,time_out AS timeOut FROM daily_log_calls WHERE id=? AND log_date=? LIMIT 1").bind(callId, date).first<{ id: string; reportNumber: string; timeOut: string }>();
    if (!call) return Response.json({ error: "Save the call before submitting callback attendance." }, { status: 404 });
    const [rows, submissions, setting] = await Promise.all([
      dutyRows(db, date),
      db.prepare("SELECT c.id,c.employee_id AS employeeId,c.status,c.submitted_at AS submittedAt,c.review_note AS reviewNote,e.name AS employeeName FROM daily_log_callback_submissions c JOIN employees e ON e.id=c.employee_id WHERE c.call_id=? AND c.log_date=? ORDER BY e.name COLLATE NOCASE").bind(callId, date).all(),
      reviewerSetting(db),
    ]);
    const unique = new Map<string, DutyRow>();
    for (const row of rows) if (employeeWasOnDutyAtCall(row, call.timeOut) && row.employeeId) unique.set(row.employeeId, row);
    return Response.json({ call, eligibleEmployees: [...unique.values()], submissions: submissions.results, setting });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load callback attendance." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await ensureDatabase();
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "submit");
    const actor = actorEmail(request) || "System";

    if (action === "setReviewer") {
      if (!await hasPermission(request, db, "permissions.manage")) return Response.json({ error: "Administrator permission is required to change the callback reviewer." }, { status: 403 });
      const reviewerId = String(body.reviewerEmployeeId ?? "");
      const reviewer = await db.prepare("SELECT e.id FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.id=? AND e.active=1 AND (lower(p.label) IN ('lieutenant','captain','chief','deputy chief','assistant chief') OR COALESCE(ep.acting_officer_eligible,0)=1) LIMIT 1").bind(reviewerId).first();
      if (!reviewer) return Response.json({ error: "Select an active officer or Acting Officer eligible member." }, { status: 400 });
      await db.prepare("INSERT INTO callback_review_settings(id,reviewer_employee_id,updated_by,updated_at) VALUES('default',?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET reviewer_employee_id=excluded.reviewer_employee_id,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP").bind(reviewerId, actor).run();
      return Response.json({ ok: true });
    }

    if (action === "review") {
      if (!await hasPermission(request, db, "payroll.manage")) return Response.json({ error: "Callback review access is not enabled for this account." }, { status: 403 });
      const status = String(body.status ?? "");
      if (!['approved', 'denied'].includes(status)) return Response.json({ error: "Choose Approve or Deny." }, { status: 400 });
      await db.prepare("UPDATE daily_log_callback_submissions SET status=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,review_note=? WHERE id=?").bind(status, actor, String(body.reviewNote ?? "").trim(), String(body.id ?? "")).run();
      return Response.json({ ok: true });
    }

    if (!await hasPermission(request, db, "daily_log.manage")) return Response.json({ error: "Daily Log editing is not enabled for this account." }, { status: 403 });
    const logDate = String(body.logDate ?? "");
    const callId = String(body.callId ?? "");
    const employeeIds = [...new Set((Array.isArray(body.employeeIds) ? body.employeeIds : []).map(String).filter(Boolean))];
    if (!employeeIds.length) return Response.json({ error: "Select at least one on-duty member." }, { status: 400 });
    const call = await db.prepare("SELECT id,report_number AS reportNumber,time_out AS timeOut FROM daily_log_calls WHERE id=? AND log_date=? LIMIT 1").bind(callId, logDate).first<{ id: string; reportNumber: string; timeOut: string }>();
    if (!call) return Response.json({ error: "Save the call before submitting callback attendance." }, { status: 404 });
    const setting = await reviewerSetting(db);
    if (!setting) return Response.json({ error: "An administrator must choose a callback reviewer first." }, { status: 409 });
    const eligible = new Set((await dutyRows(db, logDate)).filter((row) => employeeWasOnDutyAtCall(row, call.timeOut)).map((row) => row.employeeId));
    const ineligible = employeeIds.filter((id) => !eligible.has(id));
    if (ineligible.length) return Response.json({ error: "One or more selected members were not on duty when this call was generated. Refresh and try again." }, { status: 409 });
    for (const employeeId of employeeIds) {
      await db.prepare("INSERT INTO daily_log_callback_submissions(id,log_date,call_id,report_number,employee_id,reviewer_employee_id,status,submitted_by,submitted_at) VALUES(?,?,?,?,?,?,'pending',?,CURRENT_TIMESTAMP) ON CONFLICT(call_id,employee_id) DO NOTHING").bind(crypto.randomUUID(), logDate, callId, call.reportNumber, employeeId, setting.reviewerEmployeeId, actor).run();
    }
    return Response.json({ ok: true, submitted: employeeIds.length, reviewer: setting });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save callback attendance." }, { status: 500 });
  }
}

