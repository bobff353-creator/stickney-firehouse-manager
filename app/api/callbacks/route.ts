import { ensureDatabase } from "../../../db/bootstrap";
import { employeeWasOnDutyAtCall } from "../../callback-duty";
import {
  evaluateCallbackRules,
  parseCallbackRuleList,
  type CallbackRuleCall,
} from "../../callback-rules";
import { holidayForDate } from "../../holidays";
import { hasPermission } from "../../server-permissions";

type Database = Awaited<ReturnType<typeof ensureDatabase>>;
type DutyRow = { employeeId: string | null; employeeName: string; rank: string; timeIn: string; timeOut: string };
type ActorEmployee = { id: string; name: string; rank: string; payScaleId: string };
type CallbackSnapshotRow = CallbackRuleCall & { employeeId: string; status: string };

const actorEmail = (request: Request) => request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() || "";
const isDeputyChief = (employee: ActorEmployee | null) => Boolean(employee && (employee.payScaleId.startsWith("deputy-chief") || employee.rank.toLowerCase().includes("deputy chief")));

async function actorEmployee(request: Request, db: Database) {
  const email = actorEmail(request);
  if (!email) return null;
  return db.prepare("SELECT e.id,e.name,p.label AS rank,p.id AS payScaleId FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND lower(trim(ep.email))=? LIMIT 1").bind(email).first<ActorEmployee>();
}

async function reviewerSetting(db: Database) {
  const row = await db.prepare("SELECT s.reviewer_employee_id AS reviewerEmployeeId,s.rules_json AS rulesJson,e.name AS reviewerName,p.label AS reviewerRank FROM callback_review_settings s JOIN employees e ON e.id=s.reviewer_employee_id JOIN pay_scales p ON p.id=e.pay_scale_id WHERE s.id='default' LIMIT 1").first<{ reviewerEmployeeId: string; reviewerName: string; reviewerRank: string; rulesJson: string }>();
  if (!row) return null;
  try { return { ...row, rules: JSON.parse(row.rulesJson || "{}") }; }
  catch { return { ...row, rules: {} }; }
}

async function dutyRows(db: Database, date: string) {
  return (await db.prepare("SELECT s.employee_id AS employeeId,e.name AS employeeName,p.label AS rank,s.time_in AS timeIn,s.time_out AS timeOut FROM daily_log_staffing s JOIN employees e ON e.id=s.employee_id JOIN pay_scales p ON p.id=e.pay_scale_id WHERE s.log_date=? AND e.active=1 ORDER BY e.name COLLATE NOCASE").bind(date).all<DutyRow>()).results;
}

function nearbyDates(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return [date, date, date];
  const value = (offset: number) => {
    const next = new Date(parsed);
    next.setUTCDate(next.getUTCDate() + offset);
    return next.toISOString().slice(0, 10);
  };
  return [value(-1), value(0), value(1)];
}

async function callsNearDate(db: Database, date: string) {
  const dates = nearbyDates(date);
  return (await db.prepare("SELECT id,log_date AS logDate,time_out AS timeOut,time_in AS timeIn,call_type AS callType FROM daily_log_calls WHERE log_date IN (?,?,?)").bind(...dates).all<CallbackRuleCall>()).results;
}

async function callbackSnapshotsNearDate(db: Database, date: string) {
  const dates = nearbyDates(date);
  return (await db.prepare("SELECT s.employee_id AS employeeId,s.status,c.id,c.log_date AS logDate,c.time_out AS timeOut,c.time_in AS timeIn,c.call_type AS callType FROM daily_log_callback_submissions s JOIN daily_log_calls c ON c.id=s.call_id WHERE c.log_date IN (?,?,?) AND s.status<>'denied'").bind(...dates).all<CallbackSnapshotRow>()).results;
}

function payrollPeriod(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  const day = parsed.getUTCDate();
  let start: string;
  if (day >= 26) start = `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-26`;
  else if (day >= 11) start = `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-11`;
  else {
    parsed.setUTCMonth(parsed.getUTCMonth() - 1);
    start = `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-26`;
  }
  const endDate = new Date(`${start}T12:00:00Z`);
  if (endDate.getUTCDate() === 11) endDate.setUTCDate(25);
  else { endDate.setUTCMonth(endDate.getUTCMonth() + 1); endDate.setUTCDate(10); }
  return { start, end: endDate.toISOString().slice(0, 10) };
}

async function ensureCallbackPayrollIsEditable(db: Database, workDate: string) {
  const period = payrollPeriod(workDate);
  const existing = await db.prepare("SELECT status FROM pay_periods WHERE start_date=? LIMIT 1").bind(period.start).first<{ status: string }>();
  if (existing?.status === "finalized") throw new Error("This payroll period is finalized. Reopen it before approving callback hours.");
  await db.prepare("INSERT OR IGNORE INTO pay_periods(start_date,end_date,status) VALUES(?,?,'draft')").bind(period.start, period.end).run();
  return period;
}

async function rebuildCallbackPayroll(db: Database, employeeId: string, workDate: string, periodStart: string, actor: string) {
  const baseline = await db.prepare("SELECT manual_baseline_hours AS manualBaselineHours FROM callback_payroll_aggregates WHERE employee_id=? AND work_date=? LIMIT 1").bind(employeeId, workDate).first<{ manualBaselineHours: number }>();
  const approved = await db.prepare("SELECT COALESCE(SUM(approved_hours),0) AS approvedHours FROM daily_log_callback_submissions WHERE employee_id=? AND log_date=? AND status='approved'").bind(employeeId, workDate).first<{ approvedHours: number }>();
  const total = Math.round(((Number(baseline?.manualBaselineHours) || 0) + (Number(approved?.approvedHours) || 0)) * 100) / 100;
  if (total > 0) {
    await db.prepare("INSERT INTO time_entries(id,employee_id,period_start,work_date,category,hours,updated_at) VALUES(?,?,?,?, 'callback',?,CURRENT_TIMESTAMP) ON CONFLICT(employee_id,work_date,category) DO UPDATE SET hours=excluded.hours,period_start=excluded.period_start,updated_at=CURRENT_TIMESTAMP").bind(crypto.randomUUID(), employeeId, periodStart, workDate, total).run();
  } else {
    await db.prepare("DELETE FROM time_entries WHERE employee_id=? AND work_date=? AND category='callback'").bind(employeeId, workDate).run();
  }
  await db.prepare("UPDATE pay_periods SET updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE start_date=?").bind(actor, periodStart).run();
}

function formatSubmission(row: Record<string, unknown>) {
  return {
    ...row,
    matches: parseCallbackRuleList(row.ruleMatches),
    flags: parseCallbackRuleList(row.ruleFlags),
    suggestedHours: Number(row.suggestedHours) || 2,
    approvedHours: Number(row.approvedHours) || 0,
    actualMinutes: row.actualMinutes === null || row.actualMinutes === undefined ? null : Number(row.actualMinutes),
  };
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const url = new URL(request.url);
    if (url.searchParams.get("scope") === "review") {
      if (!await hasPermission(request, db, "payroll.manage")) return Response.json({ error: "Callback review access is not enabled for this account." }, { status: 403 });
      const [submissions, setting, reviewers] = await Promise.all([
        db.prepare("SELECT c.id,c.log_date AS logDate,c.call_id AS callId,c.report_number AS reportNumber,c.call_type AS callType,c.call_time_out AS callTimeOut,c.call_time_in AS callTimeIn,c.status,c.submitted_at AS submittedAt,c.reviewed_at AS reviewedAt,c.review_note AS reviewNote,c.rule_matches AS ruleMatches,c.rule_flags AS ruleFlags,c.suggested_hours AS suggestedHours,c.actual_minutes AS actualMinutes,c.approved_hours AS approvedHours,c.submitted_by AS submittedBy,c.submitted_by_rank AS submittedByRank,e.name AS employeeName,p.label AS employeeRank,r.name AS reviewerName FROM daily_log_callback_submissions c JOIN employees e ON e.id=c.employee_id JOIN pay_scales p ON p.id=e.pay_scale_id JOIN employees r ON r.id=c.reviewer_employee_id ORDER BY CASE c.status WHEN 'pending' THEN 0 ELSE 1 END,c.submitted_at DESC").all(),
        reviewerSetting(db),
        db.prepare("SELECT e.id,e.name,p.label AS rank FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND (lower(p.label) IN ('lieutenant','captain','chief','deputy chief','assistant chief') OR lower(p.id) LIKE 'deputy-chief%' OR COALESCE(ep.acting_officer_eligible,0)=1) ORDER BY e.name COLLATE NOCASE").all(),
      ]);
      return Response.json({ submissions: submissions.results.map((row) => formatSubmission(row as Record<string, unknown>)), setting, reviewers: reviewers.results });
    }

    if (!await hasPermission(request, db, "daily_log.view")) return Response.json({ error: "Daily Log access is not enabled for this account." }, { status: 403 });
    const date = url.searchParams.get("date") ?? "";
    const callId = url.searchParams.get("callId") ?? "";
    const call = await db.prepare("SELECT id,log_date AS logDate,report_number AS reportNumber,time_out AS timeOut,time_in AS timeIn,call_type AS callType FROM daily_log_calls WHERE id=? AND log_date=? LIMIT 1").bind(callId, date).first<CallbackRuleCall & { reportNumber: string }>();
    if (!call) return Response.json({ error: "Save the call before submitting callback attendance." }, { status: 404 });
    const [staffing, employees, submissions, setting, nearbyCalls, callbackSnapshots, submitter] = await Promise.all([
      dutyRows(db, date),
      db.prepare("SELECT e.id AS employeeId,e.name AS employeeName,p.label AS rank FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND (ep.end_date IS NULL OR trim(ep.end_date)='' OR ep.end_date>=?) ORDER BY e.name COLLATE NOCASE").bind(date).all<{ employeeId: string; employeeName: string; rank: string }>(),
      db.prepare("SELECT c.id,c.employee_id AS employeeId,c.status,c.submitted_at AS submittedAt,c.review_note AS reviewNote,e.name AS employeeName FROM daily_log_callback_submissions c JOIN employees e ON e.id=c.employee_id WHERE c.call_id=? AND c.log_date=? ORDER BY e.name COLLATE NOCASE").bind(callId, date).all(),
      reviewerSetting(db),
      callsNearDate(db, date),
      callbackSnapshotsNearDate(db, date),
      actorEmployee(request, db),
    ]);
    const holiday = holidayForDate(date);
    const employeeRows = employees.results.map((employee) => {
      const onDuty = staffing.some((row) => row.employeeId === employee.employeeId && employeeWasOnDutyAtCall(row, call.timeOut));
      return {
        ...employee,
        onDuty,
        evaluation: evaluateCallbackRules({
          call,
          holidayName: holiday?.name,
          otherCalls: nearbyCalls,
          employeeOnDuty: onDuty,
          submitterIsDeputyChief: isDeputyChief(submitter),
          employeeCallbackCalls: callbackSnapshots.filter((snapshot) => snapshot.employeeId === employee.employeeId),
        }),
      };
    });
    return Response.json({ call, eligibleEmployees: employeeRows, submissions: submissions.results, setting });
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
    const actorRecord = await actorEmployee(request, db);

    if (action === "setReviewer") {
      if (!await hasPermission(request, db, "permissions.manage")) return Response.json({ error: "Administrator permission is required to change the callback reviewer." }, { status: 403 });
      const reviewerId = String(body.reviewerEmployeeId ?? "");
      const reviewer = await db.prepare("SELECT e.id FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.id=? AND e.active=1 AND (lower(p.label) IN ('lieutenant','captain','chief','deputy chief','assistant chief') OR lower(p.id) LIKE 'deputy-chief%' OR COALESCE(ep.acting_officer_eligible,0)=1) LIMIT 1").bind(reviewerId).first();
      if (!reviewer) return Response.json({ error: "Select an active officer or Acting Officer eligible member." }, { status: 400 });
      await db.prepare("INSERT INTO callback_review_settings(id,reviewer_employee_id,updated_by,updated_at) VALUES('default',?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET reviewer_employee_id=excluded.reviewer_employee_id,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP").bind(reviewerId, actor).run();
      return Response.json({ ok: true });
    }

    if (action === "review") {
      if (!await hasPermission(request, db, "payroll.manage")) return Response.json({ error: "Callback review access is not enabled for this account." }, { status: 403 });
      const status = String(body.status ?? "");
      if (!["approved", "denied"].includes(status)) return Response.json({ error: "Choose Approve or Deny." }, { status: 400 });
      const id = String(body.id ?? "");
      const submission = await db.prepare("SELECT id,employee_id AS employeeId,reviewer_employee_id AS reviewerEmployeeId,log_date AS logDate,status,suggested_hours AS suggestedHours FROM daily_log_callback_submissions WHERE id=? LIMIT 1").bind(id).first<{ id: string; employeeId: string; reviewerEmployeeId: string; logDate: string; status: string; suggestedHours: number }>();
      if (!submission) return Response.json({ error: "Callback submission was not found." }, { status: 404 });
      const isAdministrator = await hasPermission(request, db, "permissions.manage");
      if (actorRecord?.id !== submission.reviewerEmployeeId && !isAdministrator) return Response.json({ error: "Only the assigned reviewer or an administrator can review this callback." }, { status: 403 });
      if (submission.status === "denied" || (submission.status === "approved" && status === "denied")) return Response.json({ error: "This callback has already been reviewed." }, { status: 409 });

      if (status === "denied") {
        await db.prepare("UPDATE daily_log_callback_submissions SET status='denied',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,review_note=? WHERE id=? AND status='pending'").bind(actor, String(body.reviewNote ?? "").trim(), id).run();
        return Response.json({ ok: true });
      }

      const requestedHours = Number(body.approvedHours ?? submission.suggestedHours);
      const approvedHours = Math.round(requestedHours * 4) / 4;
      if (!Number.isFinite(approvedHours) || approvedHours < 0.25 || approvedHours > 24) return Response.json({ error: "Approved callback hours must be between 0.25 and 24 in quarter-hour increments." }, { status: 400 });
      const period = await ensureCallbackPayrollIsEditable(db, submission.logDate);
      await db.prepare("INSERT INTO callback_payroll_aggregates(employee_id,work_date,manual_baseline_hours,updated_at) SELECT ?,?,COALESCE((SELECT hours FROM time_entries WHERE employee_id=? AND work_date=? AND category='callback' LIMIT 1),0),CURRENT_TIMESTAMP WHERE NOT EXISTS (SELECT 1 FROM callback_payroll_aggregates WHERE employee_id=? AND work_date=?)").bind(submission.employeeId, submission.logDate, submission.employeeId, submission.logDate, submission.employeeId, submission.logDate).run();
      await db.prepare("UPDATE daily_log_callback_submissions SET status='approved',approved_hours=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,review_note=? WHERE id=? AND status IN ('pending','approved')").bind(approvedHours, actor, String(body.reviewNote ?? "").trim(), id).run();
      await rebuildCallbackPayroll(db, submission.employeeId, submission.logDate, period.start, actor);
      return Response.json({ ok: true, periodStart: period.start, approvedHours });
    }

    const canManageDailyLog = await hasPermission(request, db, "daily_log.manage");
    if (!canManageDailyLog && !isDeputyChief(actorRecord)) return Response.json({ error: "Daily Log editing or Deputy Chief access is required to submit callback attendance." }, { status: 403 });
    const logDate = String(body.logDate ?? "");
    const callId = String(body.callId ?? "");
    const employeeIds = [...new Set((Array.isArray(body.employeeIds) ? body.employeeIds : []).map(String).filter(Boolean))];
    if (!employeeIds.length) return Response.json({ error: "Select at least one member." }, { status: 400 });
    const call = await db.prepare("SELECT id,log_date AS logDate,report_number AS reportNumber,time_out AS timeOut,time_in AS timeIn,call_type AS callType FROM daily_log_calls WHERE id=? AND log_date=? LIMIT 1").bind(callId, logDate).first<CallbackRuleCall & { reportNumber: string }>();
    if (!call) return Response.json({ error: "Save the call before submitting callback attendance." }, { status: 404 });
    const setting = await reviewerSetting(db);
    if (!setting) return Response.json({ error: "An administrator must choose a callback reviewer first." }, { status: 409 });
    const [activeEmployees, staffing, nearbyCalls, callbackSnapshots] = await Promise.all([
      db.prepare("SELECT e.id FROM employees e LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND e.id IN (" + employeeIds.map(() => "?").join(",") + ") AND (ep.end_date IS NULL OR trim(ep.end_date)='' OR ep.end_date>=?)").bind(...employeeIds, logDate).all<{ id: string }>(),
      dutyRows(db, logDate),
      callsNearDate(db, logDate),
      callbackSnapshotsNearDate(db, logDate),
    ]);
    const active = new Set(activeEmployees.results.map((employee) => employee.id));
    if (employeeIds.some((id) => !active.has(id))) return Response.json({ error: "One or more selected members are not active employees for this call date." }, { status: 409 });
    const holiday = holidayForDate(logDate);
    const evaluations = [];
    for (const employeeId of employeeIds) {
      const onDuty = staffing.some((row) => row.employeeId === employeeId && employeeWasOnDutyAtCall(row, call.timeOut));
      const evaluation = evaluateCallbackRules({
        call,
        holidayName: holiday?.name,
        otherCalls: nearbyCalls,
        employeeOnDuty: onDuty,
        submitterIsDeputyChief: isDeputyChief(actorRecord),
        employeeCallbackCalls: callbackSnapshots.filter((snapshot) => snapshot.employeeId === employeeId),
      });
      await db.prepare("INSERT INTO daily_log_callback_submissions(id,log_date,call_id,report_number,employee_id,reviewer_employee_id,status,submitted_by,submitted_at,call_type,call_time_out,call_time_in,rule_version,rule_matches,rule_flags,suggested_hours,actual_minutes,submitted_by_employee_id,submitted_by_rank) VALUES(?,?,?,?,?,?,'pending',?,CURRENT_TIMESTAMP,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(call_id,employee_id) DO NOTHING").bind(crypto.randomUUID(), logDate, callId, call.reportNumber, employeeId, setting.reviewerEmployeeId, actor, call.callType, call.timeOut, call.timeIn, evaluation.ruleVersion, JSON.stringify(evaluation.matches), JSON.stringify(evaluation.flags), evaluation.suggestedHours, evaluation.actualMinutes, actorRecord?.id ?? null, actorRecord?.rank ?? "").run();
      evaluations.push({ employeeId, ...evaluation });
    }
    return Response.json({ ok: true, submitted: employeeIds.length, reviewer: setting, evaluations });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save callback attendance." }, { status: 500 });
  }
}
