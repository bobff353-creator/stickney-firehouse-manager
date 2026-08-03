import { ensureDatabase } from "../../../db/bootstrap";
import { holidayForDate } from "../../holidays";
import { normalizeScheduleTime } from "../../schedule-time";

const ownerAdminEmails = ["bobff353@gmail.com"];
const iso = /^\d{4}-\d{2}-\d{2}$/;
type Db = Awaited<ReturnType<typeof ensureDatabase>>;
type Assignment = {
  id: string; employeeId: string | null; employeeName?: string; workDate: string; startTime: string; endTime: string;
  role: string; source: string; status: string; emergency: number; requiredRank: string; claimDeadline: string; notes: string;
};
type CoverageRule = {
  id: string; planId: string; name: string; role: string; minimumStaff: number; startTime: string; endTime: string; daysOfWeek: string; active: number;
};
type ShiftPattern = {
  id: string; name: string; color: string; startDate: string; startTime: string; endTime: string;
  recurrenceDays: number; coveragePlanId: string; active: number;
};
type StaffingOverride = {
  id: string; patternId: string; name: string; conditionType: string; role: string; minimumStaff: number; active: number;
};
const officerRole = (role: string) => /\b(officer|acting\s+officer|ao|oic)\b/i.test(role);
const officerRank = (rank: string) => /\b(chief|captain|lieutenant)\b/i.test(rank);
const qualifiedForRole = (role: string, rank: string, actingOfficerEligible: number | boolean) =>
  !officerRole(role) || officerRank(rank) || Boolean(actingOfficerEligible);

async function viewer(db: Db, request: Request) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  const employee = email
    ? await db.prepare("SELECT e.id,e.name,p.label rank,COALESCE(ep.email,'') profileEmail,COALESCE(ep.phone,'') phone,COALESCE(ep.schedule_sms_opt_in,0) smsOptIn,COALESCE(ep.acting_officer_eligible,0) actingOfficerEligible,COALESCE(ep.is_admin,0) isAdmin FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND lower(ep.email)=? LIMIT 1").bind(email).first<{id:string;name:string;rank:string;profileEmail:string;phone:string;smsOptIn:number;actingOfficerEligible:number;isAdmin:number}>()
    : null;
  return {
    email,
    employeeId: employee?.id ?? null,
    name: employee?.name ?? (email || "Employee"),
    rank: employee?.rank ?? "",
    profileEmail: employee?.profileEmail ?? email,
    phone: employee?.phone ?? "",
    smsOptIn: Boolean(employee?.smsOptIn),
    actingOfficerEligible: Boolean(employee?.actingOfficerEligible),
    isAdmin: ownerAdminEmails.includes(email) || Boolean(employee?.isAdmin),
  };
}

const addDays = (value: string, count: number) => {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
};
const spanDays = (a: string, b: string) => Math.floor((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
const patternOccurs = (pattern: ShiftPattern, date: string) => {
  const offset = spanDays(pattern.startDate, date);
  return Boolean(pattern.active) && offset >= 0 && offset % pattern.recurrenceDays === 0;
};
const chicagoNow = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date()).reduce<Record<string,string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

const timingHours: Record<string, number> = { "48_hours_before": 48, "24_hours_before": 24, "12_hours_before": 12, "2_hours_before": 2 };
async function notify(db: Db, ids: string[], title: string, message: string, eventType = "general", eventAt = "") {
  const rule = await db.prepare("SELECT active,email_enabled emailEnabled,sms_enabled smsEnabled,delivery_timings deliveryTimings FROM schedule_notification_rules WHERE event_type=? LIMIT 1").bind(eventType).first<{active:number;emailEnabled:number;smsEnabled:number;deliveryTimings:string}>();
  if (rule && !rule.active) return;
  let timings = ["immediate"];
  try { timings = JSON.parse(rule?.deliveryTimings || '["immediate"]'); } catch { /* Keep immediate delivery. */ }
  const eventTimestamp = eventAt ? Date.parse(eventAt) : Number.NaN;
  for (const employeeId of [...new Set(ids.filter(Boolean))]) {
    const contact = await db.prepare("SELECT COALESCE(email,'') email,COALESCE(phone,'') phone,COALESCE(schedule_sms_opt_in,0) smsOptIn FROM employee_profiles WHERE employee_id=?").bind(employeeId).first<{email:string;phone:string;smsOptIn:number}>();
    const writes = timings.map((timing) => {
      const hours = timingHours[timing];
      const scheduledFor = timing === "immediate" || !Number.isFinite(eventTimestamp)
        ? new Date().toISOString()
        : new Date(eventTimestamp - hours * 3600000).toISOString();
      if (Date.parse(scheduledFor) < Date.now() - 60000) return null;
      return db.prepare("INSERT INTO schedule_notifications(id,employee_id,title,message,in_app,event_type,email,sms,delivery_status,scheduled_for) VALUES(?,?,?,?,1,?,?,?,'queued',?)")
        .bind(crypto.randomUUID(), employeeId, title, message, eventType, rule?.emailEnabled !== 0 && contact?.email ? 1 : 0, Boolean(rule?.smsEnabled && contact?.phone && contact.smsOptIn) ? 1 : 0, scheduledFor);
    }).filter(Boolean) as ReturnType<Db["prepare"]>[];
    if (writes.length) await db.batch(writes);
  }
}

async function admins(db: Db) {
  const rows = await db.prepare("SELECT e.id FROM employees e LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND (ep.is_admin=1 OR lower(ep.email)='bobff353@gmail.com')").all<{id:string}>();
  return rows.results.map((row) => row.id);
}

function coverageGaps(assignments: Assignment[], rules: CoverageRule[], patterns: ShiftPattern[], overrides: StaffingOverride[]) {
  const today = chicagoNow().slice(0, 10);
  const gaps: Array<{date:string;ruleId:string;name:string;role:string;startTime:string;endTime:string;minimumStaff:number;scheduled:number;shortBy:number}> = [];
  const minutes = (value:string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const overlaps = (assignment:Assignment, rule:CoverageRule) => {
    const assignmentStart = minutes(assignment.startTime);
    const ruleStart = minutes(rule.startTime);
    const assignmentEnd = minutes(assignment.endTime) <= assignmentStart ? minutes(assignment.endTime) + 1440 : minutes(assignment.endTime);
    const ruleEnd = minutes(rule.endTime) <= ruleStart ? minutes(rule.endTime) + 1440 : minutes(rule.endTime);
    return assignmentStart < ruleEnd && ruleStart < assignmentEnd;
  };
  for (let offset = 0; offset <= 62; offset += 1) {
    const date = addDays(today, offset);
    const day = new Date(`${date}T12:00:00Z`).getUTCDay();
    const occurringPatterns = patterns.filter((pattern) => patternOccurs(pattern, date));
    const referencedPlans = new Set(patterns.filter((pattern) => pattern.active).map((pattern) => pattern.coveragePlanId));
    const requirements = new Map<string, CoverageRule>();
    for (const rule of rules.filter((item) => item.active)) {
      const appliesThroughPattern = occurringPatterns.some((pattern) => pattern.coveragePlanId === (rule.planId || rule.id));
      const appliesAsLegacyRule = !referencedPlans.has(rule.planId || rule.id) && rule.daysOfWeek.split(",").map(Number).includes(day);
      if (appliesThroughPattern || appliesAsLegacyRule) requirements.set(`${rule.role.toLowerCase()}|${rule.startTime}|${rule.endTime}`, { ...rule });
    }
    for (const override of overrides.filter((item) => item.active && occurringPatterns.some((pattern) => pattern.id === item.patternId))) {
      const specialDay = override.conditionType === "weekend" ? day === 0 || day === 6 : override.conditionType === "holiday" ? Boolean(holidayForDate(date)) : false;
      if (!specialDay) continue;
      const pattern = occurringPatterns.find((item) => item.id === override.patternId);
      if (!pattern) continue;
      const base = [...requirements.values()].find((item) => item.role.toLowerCase() === override.role.toLowerCase());
      const key = `${override.role.toLowerCase()}|${base?.startTime || pattern.startTime}|${base?.endTime || pattern.endTime}`;
      requirements.set(key, {
        id: override.id, planId: pattern.coveragePlanId, name: override.name, role: override.role,
        minimumStaff: Math.max(base?.minimumStaff || 0, override.minimumStaff),
        startTime: base?.startTime || pattern.startTime, endTime: base?.endTime || pattern.endTime, daysOfWeek: String(day), active: 1,
      });
    }
    for (const rule of requirements.values()) {
      const scheduled = new Set(assignments.filter((item) =>
        item.workDate === date && item.status === "assigned" && item.employeeId &&
        item.role.trim().toLowerCase() === rule.role.trim().toLowerCase() && overlaps(item, rule),
      ).map((item) => item.employeeId)).size;
      if (scheduled < rule.minimumStaff) gaps.push({
        date, ruleId: rule.id, name: rule.name, role: rule.role, startTime: rule.startTime, endTime: rule.endTime,
        minimumStaff: rule.minimumStaff, scheduled, shortBy: rule.minimumStaff - scheduled,
      });
    }
  }
  return gaps;
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const current = await viewer(db, request);
    if (!current.isAdmin && !current.employeeId) return Response.json({ error: "Your login is not connected to an employee record." }, { status: 403 });
    const requestedTestEmployeeId = current.isAdmin ? new URL(request.url).searchParams.get("testEmployeeId") ?? "" : "";
    const employeeId = requestedTestEmployeeId || current.employeeId || "";
    const [employees, assignments, rotations, requests, notifications, rules, patterns, overrides, notificationRules] = await Promise.all([
      db.prepare("SELECT e.id,e.name,p.label rank,COALESCE(ep.email,'') email,COALESCE(ep.phone,'') phone,COALESCE(ep.schedule_sms_opt_in,0) scheduleSmsOptIn,COALESCE(ep.acting_officer_eligible,0) actingOfficerEligible FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 ORDER BY e.name COLLATE NOCASE").all(),
      current.isAdmin
        ? db.prepare("SELECT a.id,a.employee_id employeeId,e.name employeeName,a.work_date workDate,a.start_time startTime,a.end_time endTime,a.role,a.source,a.status,a.emergency,a.required_rank requiredRank,a.claim_deadline claimDeadline,a.notes FROM schedule_assignments a LEFT JOIN employees e ON e.id=a.employee_id WHERE date(a.work_date)>=date('now','-45 day') ORDER BY a.work_date,a.start_time").all<Assignment>()
        : db.prepare("SELECT a.id,a.employee_id employeeId,e.name employeeName,a.work_date workDate,a.start_time startTime,a.end_time endTime,a.role,a.source,a.status,a.emergency,a.required_rank requiredRank,a.claim_deadline claimDeadline,a.notes FROM schedule_assignments a LEFT JOIN employees e ON e.id=a.employee_id WHERE date(a.work_date)>=date('now','-45 day') AND (a.employee_id=? OR a.status='open') ORDER BY a.work_date,a.start_time").bind(employeeId).all<Assignment>(),
      db.prepare("SELECT r.id,r.name,r.start_date startDate,r.end_date endDate,r.start_time startTime,r.end_time endTime,r.cycle_days cycleDays,r.duty_days dutyDays,r.role,r.coverage_plan_id coveragePlanId,r.active,GROUP_CONCAT(e.name,', ') members FROM schedule_rotations r LEFT JOIN schedule_rotation_members m ON m.rotation_id=r.id LEFT JOIN employees e ON e.id=m.employee_id GROUP BY r.id ORDER BY r.active DESC,r.start_date DESC").all(),
      current.isAdmin
        ? db.prepare("SELECT q.id,q.request_type requestType,q.employee_id employeeId,e.name employeeName,q.assignment_id assignmentId,q.target_employee_id targetEmployeeId,te.name targetEmployeeName,q.start_date startDate,q.end_date endDate,q.start_time startTime,q.end_time endTime,q.role,q.repeat_mode repeatMode,q.repeat_interval repeatInterval,q.status,q.target_status targetStatus,q.notes,q.reviewed_by reviewedBy,q.created_at createdAt FROM schedule_requests q JOIN employees e ON e.id=q.employee_id LEFT JOIN employees te ON te.id=q.target_employee_id ORDER BY CASE q.status WHEN 'pending' THEN 0 ELSE 1 END,q.created_at DESC LIMIT 150").all()
        : db.prepare("SELECT q.id,q.request_type requestType,q.employee_id employeeId,e.name employeeName,q.assignment_id assignmentId,q.target_employee_id targetEmployeeId,te.name targetEmployeeName,q.start_date startDate,q.end_date endDate,q.start_time startTime,q.end_time endTime,q.role,q.repeat_mode repeatMode,q.repeat_interval repeatInterval,q.status,q.target_status targetStatus,q.notes,q.reviewed_by reviewedBy,q.created_at createdAt FROM schedule_requests q JOIN employees e ON e.id=q.employee_id LEFT JOIN employees te ON te.id=q.target_employee_id WHERE q.employee_id=? OR q.target_employee_id=? ORDER BY q.created_at DESC").bind(employeeId, employeeId).all(),
      employeeId
        ? db.prepare("SELECT id,title,message,email,sms,delivery_status deliveryStatus,read_at readAt,created_at createdAt FROM schedule_notifications WHERE employee_id=? ORDER BY created_at DESC LIMIT 50").bind(employeeId).all()
        : Promise.resolve({ results: [] }),
      current.isAdmin
        ? db.prepare("SELECT id,plan_id planId,name,role,minimum_staff minimumStaff,start_time startTime,end_time endTime,days_of_week daysOfWeek,active FROM schedule_coverage_rules ORDER BY active DESC,name COLLATE NOCASE").all<CoverageRule>()
        : Promise.resolve({ results: [] as CoverageRule[] }),
      db.prepare("SELECT id,name,color,start_date startDate,start_time startTime,end_time endTime,recurrence_days recurrenceDays,coverage_plan_id coveragePlanId,active FROM schedule_shift_patterns WHERE active=1 ORDER BY start_date,name COLLATE NOCASE").all<ShiftPattern>(),
      current.isAdmin
        ? db.prepare("SELECT id,pattern_id patternId,name,condition_type conditionType,role,minimum_staff minimumStaff,active FROM schedule_staffing_overrides WHERE active=1 ORDER BY name COLLATE NOCASE,role").all<StaffingOverride>()
        : Promise.resolve({ results: [] as StaffingOverride[] }),
      current.isAdmin
        ? db.prepare("SELECT event_type eventType,label,active,email_enabled emailEnabled,sms_enabled smsEnabled,delivery_timings deliveryTimings,updated_at updatedAt FROM schedule_notification_rules ORDER BY label").all()
        : Promise.resolve({ results: [] }),
    ]);
    return Response.json({
      viewer: current,
      employees: employees.results,
      assignments: assignments.results,
      rotations: rotations.results,
      requests: requests.results,
      notifications: notifications.results,
      coverageRules: rules.results,
      shiftPatterns: patterns.results,
      staffingOverrides: overrides.results,
      notificationRules: notificationRules.results,
      coverageGaps: current.isAdmin ? coverageGaps(assignments.results, rules.results, patterns.results, overrides.results) : [],
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load scheduling" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await ensureDatabase();
    const current = await viewer(db, request);
    const payload = await request.json() as Record<string,unknown>;
    const action = String(payload.action ?? "");
    if (!current.isAdmin && !current.employeeId) return Response.json({ error: "Your login is not connected to an employee record." }, { status: 403 });
    const testEmployeeId = current.isAdmin ? String(payload.testEmployeeId ?? "") : "";
    const actingEmployeeId = testEmployeeId || current.employeeId || "";
    const actingEmployee = testEmployeeId
      ? await db.prepare("SELECT id,name FROM employees WHERE id=? AND active=1").bind(testEmployeeId).first<{id:string;name:string}>()
      : null;
    if (testEmployeeId && !actingEmployee) return Response.json({ error: "The selected Test View employee is unavailable." }, { status: 404 });
    const actingName = actingEmployee?.name ?? current.name;

    if (action === "saveNotificationRules") {
      if (!current.isAdmin) return Response.json({ error: "Administrator access is required." }, { status: 403 });
      const rules = Array.isArray(payload.rules) ? payload.rules : [];
      const allowedTimings = new Set(["immediate", ...Object.keys(timingHours)]);
      if (!rules.length) return Response.json({ error: "Choose at least one notification rule." }, { status: 400 });
      const writes = rules.map((entry) => {
        const rule = entry as Record<string, unknown>;
        const eventType = String(rule.eventType ?? "");
        const timings = [...new Set(Array.isArray(rule.deliveryTimings) ? rule.deliveryTimings.map(String).filter((timing) => allowedTimings.has(timing)) : [])];
        if (!eventType || !timings.length) throw new Error("Each notification needs at least one delivery time.");
        return db.prepare("UPDATE schedule_notification_rules SET active=?,email_enabled=?,sms_enabled=?,delivery_timings=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE event_type=?")
          .bind(rule.active ? 1 : 0, rule.emailEnabled ? 1 : 0, rule.smsEnabled ? 1 : 0, JSON.stringify(timings), current.name, eventType);
      });
      await db.batch(writes);
      return Response.json({ ok: true });
    }

    if (action === "saveMyNotificationPreferences") {
      if (!actingEmployeeId) return Response.json({ error: "Your login is not connected to an employee record." }, { status: 403 });
      const smsOptIn = Boolean(payload.smsOptIn);
      const profile = await db.prepare("SELECT COALESCE(email,'') email,COALESCE(phone,'') phone FROM employee_profiles WHERE employee_id=?").bind(actingEmployeeId).first<{email:string;phone:string}>();
      if (smsOptIn && !profile?.phone) return Response.json({ error: "Add a mobile phone number to Employee Information before enabling text updates." }, { status: 400 });
      await db.prepare("UPDATE employee_profiles SET schedule_sms_opt_in=?,updated_at=CURRENT_TIMESTAMP WHERE employee_id=?").bind(smsOptIn ? 1 : 0, actingEmployeeId).run();
      return Response.json({ ok: true, email: profile?.email ?? "", smsOptIn });
    }

    if (action === "createRotation") {
      if (!current.isAdmin) return Response.json({ error: "Administrator access is required." }, { status: 403 });
      const name = String(payload.name ?? "").trim();
      const coveragePlanId = String(payload.coveragePlanId ?? "").trim();
      const startDate = String(payload.startDate ?? "");
      const endDate = String(payload.endDate ?? "");
      const role = String(payload.role ?? "").trim();
      const cycleDays = Number(payload.cycleDays);
      const employeeIds = [...new Set(Array.isArray(payload.employeeIds) ? payload.employeeIds.map(String).filter(Boolean) : [])];
      const span = spanDays(startDate, endDate);
      if (!["Red", "Gold", "Black"].includes(name) || !coveragePlanId || !iso.test(startDate) || !iso.test(endDate) || span < 0 || span > 730 || !role || !Number.isInteger(cycleDays) || cycleDays < 1 || cycleDays > 60 || employeeIds.length !== 1) {
        return Response.json({ error: "Choose one employee, a staffing plan and position, a start date, and how often the shift repeats." }, { status: 400 });
      }
      const requiredPosition = await db.prepare("SELECT id,plan_id planId,name,start_time startTime,end_time endTime,role FROM schedule_coverage_rules WHERE active=1 AND lower(role)=lower(?) AND ((plan_id<>'' AND plan_id=?) OR id=?) LIMIT 1").bind(role, coveragePlanId, coveragePlanId).first<{id:string;planId:string;name:string;startTime:string;endTime:string;role:string}>();
      if (!requiredPosition) return Response.json({ error: "Choose a position from the selected active minimum staffing plan." }, { status: 400 });
      const employee = await db.prepare("SELECT e.id,p.label rank,COALESCE(ep.acting_officer_eligible,0) actingOfficerEligible FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.id=? AND e.active=1").bind(employeeIds[0]).first<{id:string;rank:string;actingOfficerEligible:number}>();
      if (!employee) return Response.json({ error: "Choose an active employee." }, { status: 400 });
      if (!qualifiedForRole(requiredPosition.role, employee.rank, employee.actingOfficerEligible)) return Response.json({ error: "This employee is not eligible to work the selected Officer/AO position." }, { status: 403 });
      const rotationId = crypto.randomUUID();
      await db.prepare("INSERT INTO schedule_rotations(id,name,start_date,end_date,start_time,end_time,cycle_days,duty_days,role,coverage_plan_id,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
        .bind(rotationId, name, startDate, endDate, requiredPosition.startTime, requiredPosition.endTime, cycleDays, "0", requiredPosition.role, requiredPosition.planId || requiredPosition.id, current.name).run();
      await db.batch(employeeIds.map((id) => db.prepare("INSERT INTO schedule_rotation_members(rotation_id,employee_id) VALUES(?,?)").bind(rotationId, id)));
      const writes = [];
      for (let offset = 0; offset <= span; offset += 1) {
        if (offset % cycleDays !== 0) continue;
        for (const id of employeeIds) writes.push(
          db.prepare("INSERT OR IGNORE INTO schedule_assignments(id,employee_id,work_date,start_time,end_time,role,source,rotation_id,status,created_by) VALUES(?,?,?,?,?,?,'rotation',?,'assigned',?)")
            .bind(crypto.randomUUID(), id, addDays(startDate, offset), requiredPosition.startTime, requiredPosition.endTime, requiredPosition.role, rotationId, current.name),
        );
      }
      for (let index = 0; index < writes.length; index += 75) await db.batch(writes.slice(index, index + 75));
      await notify(db, employeeIds, "New rotating schedule", `${name} shift · ${requiredPosition.name} · ${requiredPosition.role} was assigned every ${cycleDays} day${cycleDays === 1 ? "" : "s"} from ${startDate} through ${endDate}.`, "rotation", `${startDate}T${requiredPosition.startTime}:00-05:00`);
      return Response.json({ ok: true, assignmentsCreated: writes.length });
    }

    if (action === "deactivateRotation") {
      if (!current.isAdmin) return Response.json({ error: "Administrator access is required." }, { status: 403 });
      const id = String(payload.id ?? "");
      const rotation = await db.prepare("SELECT name FROM schedule_rotations WHERE id=? AND active=1").bind(id).first<{name:string}>();
      if (!rotation) return Response.json({ error: "Rotation is already inactive or unavailable." }, { status: 409 });
      const members = await db.prepare("SELECT employee_id employeeId FROM schedule_rotation_members WHERE rotation_id=?").bind(id).all<{employeeId:string}>();
      const today = chicagoNow().slice(0, 10);
      await db.batch([
        db.prepare("UPDATE schedule_rotations SET active=0 WHERE id=?").bind(id),
        db.prepare("DELETE FROM schedule_assignments WHERE rotation_id=? AND work_date>=?").bind(id, today),
      ]);
      await notify(db, members.results.map((item) => item.employeeId), "Rotation ended", `${rotation.name} was ended. Future generated assignments were removed; past schedule history was preserved.`, "rotation");
      return Response.json({ ok: true });
    }

    if (action === "saveCoverageRule") {
      if (!current.isAdmin) return Response.json({ error: "Administrator access is required." }, { status: 403 });
      const name = String(payload.name ?? "").trim();
      const startTime = normalizeScheduleTime(String(payload.startTime ?? ""));
      const endTime = normalizeScheduleTime(String(payload.endTime ?? ""));
      const days = [...new Set(Array.isArray(payload.daysOfWeek) ? payload.daysOfWeek.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6) : [])].sort();
      const positions = Array.isArray(payload.positions)
        ? payload.positions.map((item) => {
          const position = item as Record<string,unknown>;
          return { role: String(position.role ?? "").trim(), minimumStaff: Number(position.minimumStaff) };
        })
        : [{ role: String(payload.role ?? "").trim(), minimumStaff: Number(payload.minimumStaff) }];
      const uniqueRoles = new Set(positions.map((position) => position.role.toLowerCase()));
      if (!name || !startTime || !endTime || !days.length || !positions.length ||
        positions.some((position) => !position.role || !Number.isInteger(position.minimumStaff) || position.minimumStaff < 1 || position.minimumStaff > 50) ||
        uniqueRoles.size !== positions.length) {
        return Response.json({ error: "Complete every staffing position, use each position once, and select at least one day." }, { status: 400 });
      }
      const planId = crypto.randomUUID();
      await db.batch(positions.map((position) =>
        db.prepare("INSERT INTO schedule_coverage_rules(id,plan_id,name,role,minimum_staff,start_time,end_time,days_of_week,created_by) VALUES(?,?,?,?,?,?,?,?,?)")
          .bind(crypto.randomUUID(), planId, name, position.role, position.minimumStaff, startTime, endTime, days.join(","), current.name),
      ));
      return Response.json({ ok: true, rulesCreated: positions.length });
    }

    if (action === "deleteCoverageRule") {
      if (!current.isAdmin) return Response.json({ error: "Administrator access is required." }, { status: 403 });
      const ids = [...new Set(Array.isArray(payload.ids) ? payload.ids.map(String).filter(Boolean) : [String(payload.id ?? "")].filter(Boolean))];
      if (!ids.length) return Response.json({ error: "Choose a staffing plan." }, { status: 400 });
      await db.batch(ids.map((id) => db.prepare("UPDATE schedule_coverage_rules SET active=0 WHERE id=?").bind(id)));
      return Response.json({ ok: true });
    }

    if (action === "saveShiftPattern") {
      if (!current.isAdmin) return Response.json({ error: "Administrator access is required." }, { status: 403 });
      const name = String(payload.name ?? "").trim();
      const color = String(payload.color ?? "").trim().toLowerCase();
      const startDate = String(payload.startDate ?? "");
      const recurrenceDays = Number(payload.recurrenceDays);
      const coveragePlanId = String(payload.coveragePlanId ?? "");
      const allowedColors = ["red", "black", "gold", "blue", "green", "purple", "orange"];
      const plan = await db.prepare("SELECT MIN(start_time) startTime,MIN(end_time) endTime FROM schedule_coverage_rules WHERE active=1 AND (plan_id=? OR id=?)").bind(coveragePlanId, coveragePlanId).first<{startTime:string;endTime:string}>();
      if (!name || !allowedColors.includes(color) || !iso.test(startDate) || !Number.isInteger(recurrenceDays) || recurrenceDays < 1 || recurrenceDays > 365 || !plan?.startTime || !plan?.endTime) {
        return Response.json({ error: "Enter a shift reference, color, start date, recurrence from 1 to 365 days, and an active staffing plan." }, { status: 400 });
      }
      await db.prepare("INSERT INTO schedule_shift_patterns(id,name,color,start_date,start_time,end_time,recurrence_days,coverage_plan_id,created_by) VALUES(?,?,?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), name, color, startDate, plan.startTime, plan.endTime, recurrenceDays, coveragePlanId, current.name).run();
      return Response.json({ ok: true });
    }

    if (action === "deactivateShiftPattern") {
      if (!current.isAdmin) return Response.json({ error: "Administrator access is required." }, { status: 403 });
      const id = String(payload.id ?? "");
      await db.batch([
        db.prepare("UPDATE schedule_shift_patterns SET active=0 WHERE id=?").bind(id),
        db.prepare("UPDATE schedule_staffing_overrides SET active=0 WHERE pattern_id=?").bind(id),
      ]);
      return Response.json({ ok: true });
    }

    if (action === "saveStaffingOverride") {
      if (!current.isAdmin) return Response.json({ error: "Administrator access is required." }, { status: 403 });
      const patternId = String(payload.patternId ?? "");
      const conditionType = String(payload.conditionType ?? "");
      const role = String(payload.role ?? "").trim();
      const minimumStaff = Number(payload.minimumStaff);
      const pattern = await db.prepare("SELECT id,name FROM schedule_shift_patterns WHERE id=? AND active=1").bind(patternId).first<{id:string;name:string}>();
      if (!pattern || !["weekend", "holiday"].includes(conditionType) || !role || !Number.isInteger(minimumStaff) || minimumStaff < 1 || minimumStaff > 50) {
        return Response.json({ error: "Choose an active shift reference, weekend or holiday, a position, and its required minimum." }, { status: 400 });
      }
      const name = `${pattern.name} ${conditionType === "weekend" ? "weekend" : "holiday"} staffing`;
      await db.prepare("INSERT INTO schedule_staffing_overrides(id,pattern_id,name,condition_type,role,minimum_staff,created_by) VALUES(?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), patternId, name, conditionType, role, minimumStaff, current.name).run();
      return Response.json({ ok: true });
    }

    if (action === "deleteStaffingOverride") {
      if (!current.isAdmin) return Response.json({ error: "Administrator access is required." }, { status: 403 });
      await db.prepare("UPDATE schedule_staffing_overrides SET active=0 WHERE id=?").bind(String(payload.id ?? "")).run();
      return Response.json({ ok: true });
    }

    if (action === "createShift") {
      if (!current.isAdmin) return Response.json({ error: "Administrator access is required." }, { status: 403 });
      const employeeId = String(payload.employeeId ?? "");
      const workDate = String(payload.workDate ?? "");
      const startTime = normalizeScheduleTime(String(payload.startTime ?? ""));
      const endTime = normalizeScheduleTime(String(payload.endTime ?? ""));
      const role = String(payload.role ?? "").trim();
      const requiredRank = employeeId ? "" : String(payload.requiredRank ?? "").trim();
      const claimDeadline = employeeId ? "" : String(payload.claimDeadline ?? "").trim();
      const notes = String(payload.notes ?? "").trim();
      const emergency = Boolean(payload.emergency);
      if (!iso.test(workDate) || !startTime || !endTime || !role || (claimDeadline && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(claimDeadline))) {
        return Response.json({ error: "Enter a date, times, position, and a valid response deadline." }, { status: 400 });
      }
      if (employeeId) {
        const employee = await db.prepare("SELECT p.label rank,COALESCE(ep.acting_officer_eligible,0) actingOfficerEligible FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.id=? AND e.active=1").bind(employeeId).first<{rank:string;actingOfficerEligible:number}>();
        if (!employee) return Response.json({ error: "Choose an active employee." }, { status: 400 });
        if (!qualifiedForRole(role, employee.rank, employee.actingOfficerEligible)) return Response.json({ error: "This employee is not eligible to work an Officer/AO assignment." }, { status: 403 });
      }
      await db.prepare("INSERT INTO schedule_assignments(id,employee_id,work_date,start_time,end_time,role,source,status,emergency,required_rank,claim_deadline,notes,created_by) VALUES(?,NULLIF(?,''),?,?,?,?,'manual',?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), employeeId, workDate, startTime, endTime, role, employeeId ? "assigned" : "open", emergency ? 1 : 0, requiredRank, claimDeadline, notes, current.name).run();
      const recipients = employeeId
        ? [employeeId]
        : (await db.prepare("SELECT e.id FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND (?='' OR lower(p.label)=lower(?)) AND (?=0 OR lower(p.label) LIKE '%chief%' OR lower(p.label) LIKE '%captain%' OR lower(p.label) LIKE '%lieutenant%' OR COALESCE(ep.acting_officer_eligible,0)=1)").bind(requiredRank, requiredRank, officerRole(role) ? 1 : 0).all<{id:string}>()).results.map((row) => row.id);
      await notify(db, recipients, emergency ? "Emergency coverage needed" : employeeId ? "Schedule assignment" : "Open shift available", `${workDate} ${startTime}-${endTime} · ${role}${requiredRank ? ` · ${requiredRank} required` : ""}${notes ? ` · ${notes}` : ""}`, employeeId ? "schedule_assignment" : "open_shift", `${workDate}T${startTime}:00-05:00`);
      return Response.json({ ok: true });
    }

    if (action === "submitRequest") {
      const employeeId = testEmployeeId || (current.isAdmin && payload.employeeId ? String(payload.employeeId) : current.employeeId ?? "");
      const requestType = String(payload.requestType ?? "");
      const assignmentId = String(payload.assignmentId ?? "");
      const targetEmployeeId = String(payload.targetEmployeeId ?? "");
      const startDate = String(payload.startDate ?? "");
      const endDate = String(payload.endDate ?? startDate);
      const repeatMode = String(payload.repeatMode ?? "none");
      const repeatInterval = repeatMode === "interval" ? Number(payload.repeatInterval) : 0;
      if (!employeeId || !["availability", "time_off", "shift_claim", "trade"].includes(requestType) || !iso.test(startDate) || !iso.test(endDate)) {
        return Response.json({ error: "Complete the schedule request." }, { status: 400 });
      }
      if (["availability", "time_off"].includes(requestType) && (spanDays(startDate, endDate) < 0 || (repeatMode === "interval" && (!Number.isInteger(repeatInterval) || repeatInterval < 2 || repeatInterval > 365)) || !["none", "interval"].includes(repeatMode))) {
        return Response.json({ error: "Choose a valid date range and a repeat interval from 2 to 365 days." }, { status: 400 });
      }
      if (requestType === "trade" && (!assignmentId || !targetEmployeeId || targetEmployeeId === employeeId)) {
        return Response.json({ error: "Choose your shift and the member who must accept the trade." }, { status: 400 });
      }
      if (requestType === "trade") {
        const ownedShift = await db.prepare("SELECT id,role FROM schedule_assignments WHERE id=? AND employee_id=? AND status='assigned'").bind(assignmentId, employeeId).first<{id:string;role:string}>();
        if (!ownedShift) return Response.json({ error: "Choose one of your currently assigned shifts." }, { status: 403 });
        const targetEmployee = await db.prepare("SELECT p.label rank,COALESCE(ep.acting_officer_eligible,0) actingOfficerEligible FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.id=? AND e.active=1").bind(targetEmployeeId).first<{rank:string;actingOfficerEligible:number}>();
        if (!targetEmployee || !qualifiedForRole(ownedShift.role, targetEmployee.rank, targetEmployee.actingOfficerEligible)) return Response.json({ error: "The selected member is not eligible to work this Officer/AO shift." }, { status: 403 });
      }
      if (requestType === "shift_claim") {
        const openShift = await db.prepare("SELECT a.status,a.role,a.required_rank requiredRank,a.claim_deadline claimDeadline,p.label employeeRank,COALESCE(ep.acting_officer_eligible,0) actingOfficerEligible FROM schedule_assignments a JOIN employees e ON e.id=? JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE a.id=?").bind(employeeId, assignmentId).first<{status:string;role:string;requiredRank:string;claimDeadline:string;employeeRank:string;actingOfficerEligible:number}>();
        if (!openShift || openShift.status !== "open") return Response.json({ error: "That shift is no longer open." }, { status: 409 });
        if (openShift.claimDeadline && openShift.claimDeadline < chicagoNow()) return Response.json({ error: "The response deadline for that shift has passed." }, { status: 409 });
        if (openShift.requiredRank && openShift.requiredRank.toLowerCase() !== openShift.employeeRank.toLowerCase()) return Response.json({ error: `This shift requires ${openShift.requiredRank}.` }, { status: 403 });
        if (!qualifiedForRole(openShift.role, openShift.employeeRank, openShift.actingOfficerEligible)) return Response.json({ error: "Your employee record is not marked eligible for Officer/AO shifts." }, { status: 403 });
        const existing = await db.prepare("SELECT id FROM schedule_requests WHERE assignment_id=? AND employee_id=? AND request_type='shift_claim' AND status='pending'").bind(assignmentId, employeeId).first();
        if (existing) return Response.json({ error: "You already requested this shift." }, { status: 409 });
      }
      const targetStatus = requestType === "trade" ? "pending" : "not_required";
      await db.prepare("INSERT INTO schedule_requests(id,request_type,employee_id,assignment_id,target_employee_id,start_date,end_date,start_time,end_time,role,repeat_mode,repeat_interval,status,target_status,notes) VALUES(?,?,?,NULLIF(?,''),NULLIF(?,''),?,?,?,?,?,?,?,'pending',?,?)")
        .bind(crypto.randomUUID(), requestType, employeeId, assignmentId, targetEmployeeId, startDate, endDate, String(payload.startTime ?? ""), String(payload.endTime ?? ""), String(payload.role ?? ""), repeatMode, repeatInterval, targetStatus, String(payload.notes ?? "")).run();
      if (requestType === "trade") {
        await notify(db, [targetEmployeeId], "Trade needs your response", `${actingName} requested a shift trade for ${startDate}. Accept or decline it in Scheduling.`, "trade", `${startDate}T12:00:00-05:00`);
      }
      await notify(db, await admins(db), "New schedule request", `${actingName} submitted a ${requestType.replace("_", " ")} request for ${startDate}.`, "shift_request", `${startDate}T12:00:00-05:00`);
      return Response.json({ ok: true });
    }

    if (action === "respondTrade") {
      const id = String(payload.id ?? "");
      const decision = String(payload.decision ?? "");
      if (!actingEmployeeId || !["accepted", "declined"].includes(decision)) return Response.json({ error: "Choose accept or decline." }, { status: 400 });
      const trade = await db.prepare("SELECT q.employee_id employeeId,a.role,p.label rank,COALESCE(ep.acting_officer_eligible,0) actingOfficerEligible FROM schedule_requests q JOIN schedule_assignments a ON a.id=q.assignment_id JOIN employees e ON e.id=q.target_employee_id JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE q.id=? AND q.request_type='trade' AND q.target_employee_id=? AND q.status='pending' AND q.target_status='pending'").bind(id, actingEmployeeId).first<{employeeId:string;role:string;rank:string;actingOfficerEligible:number}>();
      if (!trade) return Response.json({ error: "This trade is no longer waiting for your response." }, { status: 409 });
      if (decision === "accepted" && !qualifiedForRole(trade.role, trade.rank, trade.actingOfficerEligible)) return Response.json({ error: "Your employee record is not eligible for this Officer/AO shift." }, { status: 403 });
      await db.prepare(`UPDATE schedule_requests SET target_status=?${decision === "declined" ? ",status='denied'" : ""} WHERE id=?`).bind(decision, id).run();
      await notify(db, [trade.employeeId, ...(decision === "accepted" ? await admins(db) : [])], `Trade ${decision}`, `${actingName} ${decision} the proposed trade.`, "trade");
      return Response.json({ ok: true });
    }

    if (action === "reviewRequest") {
      if (!current.isAdmin) return Response.json({ error: "Administrator access is required." }, { status: 403 });
      const id = String(payload.id ?? "");
      const decision = String(payload.decision ?? "");
      if (!["approved", "denied"].includes(decision)) return Response.json({ error: "Choose approve or deny." }, { status: 400 });
      const item = await db.prepare("SELECT request_type requestType,employee_id employeeId,assignment_id assignmentId,target_employee_id targetEmployeeId,target_status targetStatus FROM schedule_requests WHERE id=? AND status='pending'")
        .bind(id).first<{requestType:string;employeeId:string;assignmentId:string|null;targetEmployeeId:string|null;targetStatus:string}>();
      if (!item) return Response.json({ error: "Request is no longer pending." }, { status: 409 });
      if (decision === "approved" && item.requestType === "trade" && item.targetStatus !== "accepted") return Response.json({ error: "The requested member must accept the trade before approval." }, { status: 409 });
      if (decision === "approved" && item.assignmentId && item.requestType === "shift_claim") {
        const qualification = await db.prepare("SELECT a.role,p.label rank,COALESCE(ep.acting_officer_eligible,0) actingOfficerEligible FROM schedule_assignments a JOIN employees e ON e.id=? JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE a.id=?").bind(item.employeeId, item.assignmentId).first<{role:string;rank:string;actingOfficerEligible:number}>();
        if (!qualification || !qualifiedForRole(qualification.role, qualification.rank, qualification.actingOfficerEligible)) return Response.json({ error: "The employee is not eligible for this Officer/AO shift." }, { status: 403 });
        const result = await db.prepare("UPDATE schedule_assignments SET employee_id=?,status='assigned' WHERE id=? AND status='open'").bind(item.employeeId, item.assignmentId).run();
        if (!result.meta.changes) return Response.json({ error: "That shift was already filled." }, { status: 409 });
      }
      if (decision === "approved" && item.assignmentId && item.requestType === "trade" && item.targetEmployeeId) {
        const qualification = await db.prepare("SELECT a.role,p.label rank,COALESCE(ep.acting_officer_eligible,0) actingOfficerEligible FROM schedule_assignments a JOIN employees e ON e.id=? JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE a.id=?").bind(item.targetEmployeeId, item.assignmentId).first<{role:string;rank:string;actingOfficerEligible:number}>();
        if (!qualification || !qualifiedForRole(qualification.role, qualification.rank, qualification.actingOfficerEligible)) return Response.json({ error: "The requested member is not eligible for this Officer/AO shift." }, { status: 403 });
        await db.prepare("UPDATE schedule_assignments SET employee_id=? WHERE id=? AND employee_id=?").bind(item.targetEmployeeId, item.assignmentId, item.employeeId).run();
      }
      await db.prepare("UPDATE schedule_requests SET status=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?").bind(decision, current.name, id).run();
      await notify(db, [item.employeeId, ...(item.targetEmployeeId ? [item.targetEmployeeId] : [])], `Schedule request ${decision}`, `Your request was ${decision} by ${current.name}.`, "shift_request");
      return Response.json({ ok: true });
    }

    if (action === "markRead" && actingEmployeeId) {
      await db.prepare("UPDATE schedule_notifications SET read_at=CURRENT_TIMESTAMP WHERE id=? AND employee_id=?").bind(String(payload.id ?? ""), actingEmployeeId).run();
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unsupported scheduling action." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save scheduling" }, { status: 500 });
  }
}
