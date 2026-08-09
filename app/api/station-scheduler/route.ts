import { ensureDatabase } from "../../../db/bootstrap";
import { normalizeScheduleTime } from "../../schedule-time";
import {
  autoDistribute,
  buildCallList,
  classifyAward,
  daysBetween,
  rankByCriteria,
  recurringShiftDates,
  sameRecurringPattern,
  seniorityFromStartDate,
  type DistributionEmployee,
  type OpenSlot,
  type OtCriterion,
  type OtEmployee,
  type OtMode,
  type OtSettings,
} from "../../station-scheduler-logic";

const ownerAdminEmails = ["bobff353@gmail.com"];
const iso = /^\d{4}-\d{2}-\d{2}$/;
type Db = Awaited<ReturnType<typeof ensureDatabase>>;
type ScheduleBoundValue = string | number | null;

const STATION_ROLES = ["Officer/AO", "Engine Driver", "Ambulance Driver", "FF/Attendant"] as const;
type StationRole = (typeof STATION_ROLES)[number];
const isStationRole = (value: string): value is StationRole => (STATION_ROLES as readonly string[]).includes(value);
const ONE_DAY_POSITION_ROLES = [...STATION_ROLES, "Firefighter", "Training/Orientation"] as const;
type OneDayPositionRole = (typeof ONE_DAY_POSITION_ROLES)[number];
const isOneDayPositionRole = (value: string): value is OneDayPositionRole => (ONE_DAY_POSITION_ROLES as readonly string[]).includes(value);
const isGeneralOneDayPosition = (role: string) => role === "Firefighter" || role === "Training/Orientation";
const officerRank = (rank: string) => /\b(chief|captain|lieutenant)\b/i.test(rank);

type EmployeeRow = {
  id: string; name: string; rank: string; email: string; phone: string;
  roles: string; startDate: string; actingOfficerEligible: number;
  otHours: number; mandatoryHours: number; hoursThisPeriod: number;
  offDuty: number; lastMandated: string; consecutiveMandatory: number;
  notifyEmail: number; notifyText: number;
};

function parseRoles(value: string): string[] {
  try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed.map(String) : []; }
  catch { return []; }
}

/** Whether an employee may work a role. Roster & Assignments is authoritative for firefighter Officer/AO clearance. */
function eligibleForRole(role: string, emp: { roles: string[]; rank: string; actingOfficerEligible: boolean }): boolean {
  if (role === "Officer/AO") return officerRank(emp.rank) || emp.roles.includes(role);
  return emp.roles.includes(role);
}

async function viewer(db: Db, request: Request) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  const employee = email
    ? await db.prepare("SELECT e.id,e.name,p.label rank,COALESCE(ep.email,'') email,COALESCE(ep.is_admin,0) isAdmin,COALESCE(ep.station_roles,'[]') roles,COALESCE(ep.acting_officer_eligible,0) actingOfficerEligible FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND lower(ep.email)=? LIMIT 1").bind(email).first<{ id: string; name: string; rank: string; email: string; isAdmin: number; roles: string; actingOfficerEligible: number }>()
    : null;
  const actingOfficerEligible = Boolean(employee?.actingOfficerEligible);
  const roles = parseRoles(employee?.roles ?? "[]");
  if (officerRank(employee?.rank ?? "") && !roles.includes("Officer/AO")) roles.push("Officer/AO");
  return {
    email,
    employeeId: employee?.id ?? null,
    name: employee?.name ?? (email || "Employee"),
    rank: employee?.rank ?? "",
    roles,
    actingOfficerEligible,
    isAdmin: ownerAdminEmails.includes(email) || Boolean(employee?.isAdmin),
  };
}

const chicagoToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const shiftHours = (startTime: string, endTime: string) => {
  const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  let span = toMinutes(endTime) - toMinutes(startTime);
  if (span <= 0) span += 1440;
  return span / 60;
};

async function loadEmployees(db: Db): Promise<EmployeeRow[]> {
  const rows = await db.prepare(
    "SELECT e.id,e.name,p.label rank,COALESCE(ep.email,'') email,COALESCE(ep.phone,'') phone,COALESCE(ep.station_roles,'[]') roles,COALESCE(ep.start_date,'') startDate,COALESCE(ep.acting_officer_eligible,0) actingOfficerEligible,COALESCE(ep.station_ot_hours,0) otHours,COALESCE(ep.station_mandatory_hours,0) mandatoryHours,COALESCE(ep.station_hours_this_period,0) hoursThisPeriod,COALESCE(ep.station_off_duty,0) offDuty,COALESCE(ep.station_last_mandated,'') lastMandated,COALESCE(ep.station_consecutive_mandatory,0) consecutiveMandatory,COALESCE(ep.station_notify_email,1) notifyEmail,COALESCE(ep.station_notify_text,0) notifyText FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND COALESCE(TRIM(ep.end_date),'')='' ORDER BY e.name COLLATE NOCASE",
  ).all<EmployeeRow>();
  return rows.results;
}

async function isSchedulableEmployee(db: Db, employeeId: string): Promise<boolean> {
  if (!employeeId) return false;
  const employee = await db.prepare("SELECT e.id FROM employees e LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.id=? AND e.active=1 AND COALESCE(TRIM(ep.end_date),'')='' LIMIT 1")
    .bind(employeeId).first<{ id: string }>();
  return Boolean(employee);
}

async function isEligibleEmployeeForRole(db: Db, employeeId: string, role: string): Promise<boolean> {
  if (isGeneralOneDayPosition(role)) return isSchedulableEmployee(db, employeeId);
  const employee = await db.prepare("SELECT e.id,p.label rank,COALESCE(ep.station_roles,'[]') roles,COALESCE(ep.acting_officer_eligible,0) actingOfficerEligible FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.id=? AND e.active=1 AND COALESCE(TRIM(ep.end_date),'')='' LIMIT 1")
    .bind(employeeId).first<{ id: string; rank: string; roles: string; actingOfficerEligible: number }>();
  return Boolean(employee && eligibleForRole(role, {
    roles: parseRoles(employee.roles),
    rank: employee.rank,
    actingOfficerEligible: Boolean(employee.actingOfficerEligible),
  }));
}

async function otSettings(db: Db, mode: OtMode): Promise<OtSettings> {
  const row = await db.prepare("SELECT exempt_off_duty exemptOffDuty,exempt_already_scheduled exemptAlreadyScheduled,exempt_declined exemptDeclined,exempt_recently_mandated exemptRecentlyMandated,recent_days recentDays,exempt_max_consecutive exemptMaxConsecutive,max_consecutive maxConsecutive,priority_order priorityOrder FROM station_ot_settings WHERE mode=?").bind(mode)
    .first<{ exemptOffDuty: number; exemptAlreadyScheduled: number; exemptDeclined: number; exemptRecentlyMandated: number; recentDays: number; exemptMaxConsecutive: number; maxConsecutive: number; priorityOrder: string }>();
  let priority: OtCriterion[] = [];
  try { priority = JSON.parse(row?.priorityOrder || "[]"); } catch { priority = []; }
  return {
    exemptOffDuty: Boolean(row?.exemptOffDuty),
    exemptAlreadyScheduled: Boolean(row?.exemptAlreadyScheduled),
    exemptDeclined: Boolean(row?.exemptDeclined),
    exemptRecentlyMandated: Boolean(row?.exemptRecentlyMandated),
    recentDays: row?.recentDays ?? 14,
    exemptMaxConsecutive: Boolean(row?.exemptMaxConsecutive),
    maxConsecutive: row?.maxConsecutive ?? 2,
    priorityOrder: priority,
  };
}

/** Employees already occupying a slot on a given date (assigned anywhere that day). */
async function busyEmployeesByDate(db: Db, dates: string[]): Promise<Record<string, Set<string>>> {
  const busy: Record<string, Set<string>> = {};
  if (!dates.length) return busy;
  const placeholders = dates.map(() => "?").join(",");
  const rows = await db.prepare(
    `SELECT en.entry_date entryDate,s.employee_id employeeId FROM station_shift_slots s JOIN station_schedule_entries en ON en.id=s.entry_id WHERE s.employee_id IS NOT NULL AND en.entry_date IN (${placeholders})`,
  ).bind(...dates).all<{ entryDate: string; employeeId: string }>();
  for (const row of rows.results) (busy[row.entryDate] ??= new Set()).add(row.employeeId);
  return busy;
}

// --- GET: aggregate scheduler state -----------------------------------------

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const current = await viewer(db, request);
    if (!current.isAdmin && !current.employeeId) return Response.json({ error: "Your login is not connected to an employee record." }, { status: 403 });
    const today = chicagoToday();
    const employees = await loadEmployees(db);

    const [shiftTypes, shiftTypeRoles, entries, slots, standing, trades, claims, timeOff, timeOffDates, reminderRules, timing, weights, interest, offers] = await Promise.all([
      db.prepare("SELECT id,name,start_time startTime,end_time endTime,anchor_date anchorDate,repeat_every_days repeatEveryDays,color,active,sort_order sortOrder FROM station_shift_types ORDER BY active DESC,sort_order,name COLLATE NOCASE").all(),
      db.prepare("SELECT id,shift_type_id shiftTypeId,role,count FROM station_shift_type_roles").all(),
      db.prepare("SELECT id,entry_date entryDate,shift_type_id shiftTypeId FROM station_schedule_entries WHERE date(entry_date)>=date(?, '-45 day') ORDER BY entry_date").bind(today).all(),
      db.prepare("SELECT s.id,s.entry_id entryId,s.role,s.employee_id employeeId,e.name employeeName,s.status,s.sort_order sortOrder,COALESCE(NULLIF(s.start_time,''),t.start_time) startTime,COALESCE(NULLIF(s.end_time,''),t.end_time) endTime,CASE WHEN COALESCE(s.start_time,'')<>'' OR COALESCE(s.end_time,'')<>'' THEN 1 ELSE 0 END hasTimeOverride,s.is_extra isExtra,en.entry_date entryDate,en.shift_type_id shiftTypeId FROM station_shift_slots s JOIN station_schedule_entries en ON en.id=s.entry_id JOIN station_shift_types t ON t.id=en.shift_type_id LEFT JOIN employees e ON e.id=s.employee_id WHERE date(en.entry_date)>=date(?, '-45 day') ORDER BY en.entry_date,s.sort_order").bind(today).all(),
      db.prepare("SELECT sa.id,sa.employee_id employeeId,e.name employeeName,sa.shift_type_id shiftTypeId,sa.role,sa.active FROM station_standing_assignments sa JOIN employees e ON e.id=sa.employee_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE sa.active=1 AND e.active=1 AND COALESCE(TRIM(ep.end_date),'')='' ORDER BY e.name COLLATE NOCASE").all(),
      db.prepare("SELECT t.id,t.slot_id slotId,t.role,t.from_employee_id fromEmployeeId,fe.name fromEmployeeName,t.target_employee_id targetEmployeeId,te.name targetEmployeeName,t.accepted_by_employee_id acceptedByEmployeeId,t.note,t.status,t.created_at createdAt,en.entry_date entryDate FROM station_trade_requests t JOIN station_shift_slots s ON s.id=t.slot_id JOIN station_schedule_entries en ON en.id=s.entry_id JOIN employees fe ON fe.id=t.from_employee_id LEFT JOIN employees te ON te.id=t.target_employee_id ORDER BY CASE t.status WHEN 'pending' THEN 0 WHEN 'awaiting_acceptance' THEN 0 ELSE 1 END,t.created_at DESC LIMIT 200").all(),
      db.prepare("SELECT c.id,c.slot_id slotId,c.role,c.employee_id employeeId,e.name employeeName,c.note,c.status,c.created_at createdAt,en.entry_date entryDate FROM station_shift_claims c JOIN station_shift_slots s ON s.id=c.slot_id JOIN station_schedule_entries en ON en.id=s.entry_id JOIN employees e ON e.id=c.employee_id ORDER BY CASE c.status WHEN 'pending' THEN 0 ELSE 1 END,c.created_at DESC LIMIT 200").all(),
      db.prepare("SELECT r.id,r.employee_id employeeId,e.name employeeName,r.type,r.approver_employee_id approverEmployeeId,ap.name approverName,r.note,r.status,r.created_at createdAt FROM station_time_off_requests r JOIN employees e ON e.id=r.employee_id LEFT JOIN employees ap ON ap.id=r.approver_employee_id ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 200").all(),
      db.prepare("SELECT request_id requestId,off_date offDate FROM station_time_off_dates").all(),
      db.prepare("SELECT id,type,label,offsets,email_enabled emailEnabled,text_enabled textEnabled,target,enabled FROM station_reminder_rules ORDER BY label").all(),
      db.prepare("SELECT award_days_out awardDaysOut,complete_by_days_out completeByDaysOut FROM station_ot_timing WHERE id=1").first<{ awardDaysOut: number; completeByDaysOut: number }>(),
      db.prepare("SELECT seniority_weight seniorityWeight,hours_weight hoursWeight,custom_weight customWeight,custom_label customLabel FROM station_distribution_weights WHERE id=1").first(),
      db.prepare("SELECT id,slot_id slotId,employee_id employeeId,response,responded_at respondedAt FROM station_ot_interest").all(),
      db.prepare("SELECT o.id,o.slot_id slotId,o.employee_id employeeId,e.name employeeName,o.mode,o.status,o.rank,o.offered_at offeredAt,o.responded_at respondedAt FROM station_ot_offers o JOIN employees e ON e.id=o.employee_id ORDER BY o.slot_id,o.rank").all(),
    ]);

    const [voluntary, mandatory] = await Promise.all([otSettings(db, "voluntary"), otSettings(db, "mandatory")]);
    const otTiming = { awardDaysOut: timing?.awardDaysOut ?? 7, completeByDaysOut: timing?.completeByDaysOut ?? 2 };

    // Annotate open slots with their award window relative to today.
    type SlotRow = { id: string; entryDate: string; status: string; role: string; employeeId: string | null };
    const openSlots = (slots.results as SlotRow[]).filter((s) => s.status === "open");
    const awardBySlot: Record<string, { daysUntil: number; window: string }> = {};
    for (const slot of openSlots) {
      const daysUntil = daysBetween(today, slot.entryDate);
      awardBySlot[slot.id] = { daysUntil, window: classifyAward(daysUntil, otTiming) };
    }

    // OT standings by role (voluntary + mandatory ranked lists over the roster).
    const otEmployees: OtEmployee[] = employees.map((e) => ({
      employeeId: e.id, name: e.name, otHours: e.otHours, mandatoryHours: e.mandatoryHours,
      seniority: seniorityFromStartDate(e.startDate, today),
    }));
    const standings: Record<string, { voluntary: string[]; mandatory: string[] }> = {};
    for (const role of STATION_ROLES) {
      const eligible = otEmployees.filter((oe) => {
        const emp = employees.find((e) => e.id === oe.employeeId)!;
        return eligibleForRole(role, { roles: parseRoles(emp.roles), rank: emp.rank, actingOfficerEligible: Boolean(emp.actingOfficerEligible) });
      });
      standings[role] = {
        voluntary: rankByCriteria(eligible, voluntary.priorityOrder).map((e) => e.employeeId),
        mandatory: rankByCriteria(eligible, mandatory.priorityOrder).map((e) => e.employeeId),
      };
    }

    return Response.json({
      viewer: current,
      today,
      roles: STATION_ROLES,
      dayPositionRoles: ONE_DAY_POSITION_ROLES,
      employees: current.isAdmin
        ? employees
        : employees.map((e) => ({ id: e.id, name: e.name, rank: e.rank, roles: e.roles, actingOfficerEligible: e.actingOfficerEligible })),
      shiftTypes: shiftTypes.results,
      shiftTypeRoles: shiftTypeRoles.results,
      entries: entries.results,
      slots: slots.results,
      standingAssignments: standing.results,
      trades: current.isAdmin ? trades.results : (trades.results as { fromEmployeeId: string; targetEmployeeId: string | null }[]).filter((t) => t.fromEmployeeId === current.employeeId || t.targetEmployeeId === current.employeeId || t.targetEmployeeId === null),
      claims: current.isAdmin ? claims.results : (claims.results as { employeeId: string }[]).filter((c) => c.employeeId === current.employeeId),
      timeOff: current.isAdmin ? timeOff.results : (timeOff.results as { employeeId: string; approverEmployeeId: string }[]).filter((r) => r.employeeId === current.employeeId || r.approverEmployeeId === current.employeeId),
      timeOffDates: timeOffDates.results,
      reminderRules: current.isAdmin ? reminderRules.results : [],
      otSettings: current.isAdmin ? { voluntary, mandatory } : null,
      otTiming,
      distributionWeights: weights ?? { seniorityWeight: 1, hoursWeight: 1, customWeight: 0, customLabel: "Cross-trained" },
      otInterest: interest.results,
      otOffers: offers.results,
      awardBySlot,
      otStandings: standings,
      notice: {
        openShifts: openSlots.length,
        overdueShifts: openSlots.filter((s) => awardBySlot[s.id]?.window === "overdue").length,
        pendingTrades: (trades.results as { status: string }[]).filter((t) => t.status === "pending" || t.status === "awaiting_acceptance").length,
        pendingClaims: (claims.results as { status: string }[]).filter((c) => c.status === "pending").length,
        pendingTimeOff: (timeOff.results as { status: string }[]).filter((r) => r.status === "pending").length,
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load the scheduler." }, { status: 500 });
  }
}

// --- POST: actions ----------------------------------------------------------

export async function POST(request: Request) {
  try {
    const db = await ensureDatabase();
    const current = await viewer(db, request);
    const payload = await request.json() as Record<string, unknown>;
    const action = String(payload.action ?? "");
    if (!current.isAdmin && !current.employeeId) return Response.json({ error: "Your login is not connected to an employee record." }, { status: 403 });
    const requireAdmin = () => { if (!current.isAdmin) throw new AdminError(); };

    switch (action) {
      case "saveShiftType": return await saveShiftType(db, current, payload, requireAdmin);
      case "deactivateShiftType": return await deactivateShiftType(db, payload, requireAdmin);
      case "createEntry": return await createEntry(db, current, payload, requireAdmin);
      case "deleteEntry": return await deleteEntry(db, payload, requireAdmin);
      case "assignSlot": return await assignSlot(db, payload, requireAdmin);
      case "clearSlot": return await clearSlot(db, payload, requireAdmin);
      case "addDaySlot": return await addDaySlot(db, current, payload, requireAdmin);
      case "updateDaySlot": return await updateDaySlot(db, payload, requireAdmin);
      case "deleteDaySlot": return await deleteDaySlot(db, payload, requireAdmin);
      case "updateDaySlotTime": return await updateDaySlotTime(db, payload, requireAdmin);
      case "saveStandingAssignment": return await saveStandingAssignment(db, current, payload, requireAdmin);
      case "removeStandingAssignment": return await removeStandingAssignment(db, payload, requireAdmin);
      case "saveEmployeeScheduler": return await saveEmployeeScheduler(db, payload, requireAdmin);
      case "reviewClaim": return await reviewClaim(db, current, payload, requireAdmin);
      case "reviewTrade": return await reviewTrade(db, current, payload, requireAdmin);
      case "reviewTimeOff": return await reviewTimeOff(db, current, payload, requireAdmin);
      case "saveOtSettings": return await saveOtSettings(db, payload, requireAdmin);
      case "saveOtTiming": return await saveOtTiming(db, payload, requireAdmin);
      case "saveDistributionWeights": return await saveDistributionWeights(db, payload, requireAdmin);
      case "runAutoDistribution": return await runAutoDistribution(db, payload, requireAdmin);
      case "buildOtCallList": return await buildOtCallList(db, payload, requireAdmin);
      case "awardOtOffer": return await awardOtOffer(db, payload, requireAdmin);
      case "saveReminderRule": return await saveReminderRule(db, payload, requireAdmin);
      // Employee (or admin acting for a member) actions:
      case "submitClaim": return await submitClaim(db, current, payload);
      case "submitTrade": return await submitTrade(db, current, payload);
      case "respondTrade": return await respondTrade(db, current, payload);
      case "submitTimeOff": return await submitTimeOff(db, current, payload);
      case "setOtInterest": return await setOtInterest(db, current, payload);
      case "respondOtOffer": return await respondOtOffer(db, current, payload);
      case "saveMyNotifyPrefs": return await saveMyNotifyPrefs(db, current, payload);
      default: return Response.json({ error: "Unsupported scheduler action." }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof AdminError) return Response.json({ error: "Administrator access is required." }, { status: 403 });
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save." }, { status: 500 });
  }
}

class AdminError extends Error {}
type Viewer = Awaited<ReturnType<typeof viewer>>;
const ok = (extra: Record<string, unknown> = {}) => Response.json({ ok: true, ...extra });
const bad = (message: string, status = 400) => Response.json({ error: message }, { status });

async function saveShiftType(db: Db, current: Viewer, payload: Record<string, unknown>, requireAdmin: () => void) {
  requireAdmin();
  const id = String(payload.id ?? "") || crypto.randomUUID();
  const name = String(payload.name ?? "").trim();
  const startTime = normalizeScheduleTime(String(payload.startTime ?? ""));
  const endTime = normalizeScheduleTime(String(payload.endTime ?? ""));
  const anchorDate = String(payload.anchorDate ?? "").trim();
  const repeatEveryDays = Number(payload.repeatEveryDays);
  const color = String(payload.color ?? "red").trim().toLowerCase();
  const roleReqs = Array.isArray(payload.roleRequirements) ? payload.roleRequirements : [];
  const allowedColors = ["red", "black", "gold", "blue", "green", "purple", "orange"];
  const normalized = roleReqs.map((item) => {
    const r = item as Record<string, unknown>;
    return { role: String(r.role ?? "").trim(), count: Number(r.count) };
  }).filter((r) => r.role);
  if (!name || !startTime || !endTime || !iso.test(anchorDate) || !Number.isInteger(repeatEveryDays) || repeatEveryDays < 1 || repeatEveryDays > 365 || !allowedColors.includes(color) || !normalized.length ||
    normalized.some((r) => !isStationRole(r.role) || !Number.isInteger(r.count) || r.count < 1 || r.count > 20) ||
    new Set(normalized.map((r) => r.role)).size !== normalized.length) {
    return bad("Enter a name, valid times, a start day, a repeat pattern from 1 to 365 days, a color, and at least one role requirement (each role once).");
  }
  const sameTimePatterns = (await db.prepare("SELECT id,name,anchor_date anchorDate,repeat_every_days repeatEveryDays FROM station_shift_types WHERE active=1 AND id<>? AND start_time=? AND end_time=?")
    .bind(id, startTime, endTime).all<{ id: string; name: string; anchorDate: string; repeatEveryDays: number }>()).results;
  const collision = sameTimePatterns.find((shift) => sameRecurringPattern(anchorDate, repeatEveryDays, shift.anchorDate, Number(shift.repeatEveryDays)));
  if (collision) {
    return bad(`${startTime}–${endTime} already follows this repeat pattern as ${collision.name}. Choose a different first shift day or repeat pattern.`);
  }
  await db.prepare("INSERT INTO station_shift_types(id,name,start_time,end_time,anchor_date,repeat_every_days,color,created_by) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,start_time=excluded.start_time,end_time=excluded.end_time,anchor_date=excluded.anchor_date,repeat_every_days=excluded.repeat_every_days,color=excluded.color")
    .bind(id, name, startTime, endTime, anchorDate, repeatEveryDays, color, current.name).run();
  await db.prepare("DELETE FROM station_shift_type_roles WHERE shift_type_id=?").bind(id).run();
  await db.batch(normalized.map((r) => db.prepare("INSERT INTO station_shift_type_roles(id,shift_type_id,role,count) VALUES(?,?,?,?)").bind(crypto.randomUUID(), id, r.role, r.count)));
  const today = chicagoToday();
  const horizonBase = anchorDate > today ? anchorDate : today;
  const horizon = new Date(`${horizonBase}T12:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 366);
  const throughDate = horizon.toISOString().slice(0, 10);
  const dates = recurringShiftDates(anchorDate, repeatEveryDays, throughDate, today);
  const existing = new Set((await db.prepare("SELECT entry_date entryDate FROM station_schedule_entries WHERE shift_type_id=? AND entry_date>=? AND entry_date<=?").bind(id, today, throughDate).all<{ entryDate: string }>()).results.map((row) => row.entryDate));
  const standingByRole = await loadStandingByRole(db, id);
  const entryRows: ScheduleBoundValue[][] = [];
  const slotRows: ScheduleBoundValue[][] = [];
  for (const entryDate of dates) {
    if (existing.has(entryDate)) continue;
    const entryId = crypto.randomUUID();
    entryRows.push([entryId, entryDate, id, current.name]);
    let sortOrder = 0;
    for (const requirement of normalized) {
      const fillers = standingByRole.get(requirement.role) ?? [];
      // Role requirements are the minimum. Standing assignments may add staffed seats.
      for (let seat = 0; seat < Math.max(requirement.count, fillers.length); seat += 1) {
        const employeeId = fillers[seat] ?? null;
        slotRows.push([crypto.randomUUID(), entryId, requirement.role, employeeId, employeeId ? "filled" : "open", sortOrder]);
        sortOrder += 1;
      }
    }
  }
  await insertRowsChunked(db, "station_schedule_entries", ["id", "entry_date", "shift_type_id", "created_by"], entryRows, 50);
  await insertRowsChunked(db, "station_shift_slots", ["id", "entry_id", "role", "employee_id", "status", "sort_order"], slotRows, 100);
  const created = entryRows.length;
  return ok({ id, created, note: created ? `${created} recurring shift dates added through ${throughDate}.` : "Shift pattern saved. Existing dates were kept." });
}

async function deactivateShiftType(db: Db, payload: Record<string, unknown>, requireAdmin: () => void) {
  requireAdmin();
  await db.prepare("UPDATE station_shift_types SET active=0 WHERE id=?").bind(String(payload.id ?? "")).run();
  return ok();
}

/** Create one ScheduleEntry (date + shift type), generate its ShiftSlots, and apply standing assignments. */
async function createEntry(db: Db, current: Viewer, payload: Record<string, unknown>, requireAdmin: () => void) {
  requireAdmin();
  const entryDate = String(payload.date ?? "");
  const shiftTypeId = String(payload.shiftTypeId ?? "");
  if (!iso.test(entryDate) || !shiftTypeId) return bad("Choose a date and a shift type.");
  const shiftType = await db.prepare("SELECT id FROM station_shift_types WHERE id=? AND active=1").bind(shiftTypeId).first<{ id: string }>();
  if (!shiftType) return bad("That shift type is unavailable.");
  const existing = await db.prepare("SELECT id FROM station_schedule_entries WHERE entry_date=? AND shift_type_id=?").bind(entryDate, shiftTypeId).first<{ id: string }>();
  if (existing) return bad("That shift is already on the calendar for this day.", 409);
  const roleReqs = await db.prepare("SELECT role,count FROM station_shift_type_roles WHERE shift_type_id=?").bind(shiftTypeId).all<{ role: string; count: number }>();
  if (!roleReqs.results.length) return bad("Add role requirements to this shift type first.");
  const standingByRole = await loadStandingByRole(db, shiftTypeId);
  const writes: Array<ReturnType<Db["prepare"]>> = [];
  const entryId = appendEntryWrites(db, writes, entryDate, shiftTypeId, current.name, roleReqs.results, standingByRole);
  await db.batch(writes);
  return ok({ entryId });
}

async function loadStandingByRole(db: Db, shiftTypeId: string) {
  const standing = await db.prepare("SELECT sa.employee_id employeeId,sa.role FROM station_standing_assignments sa JOIN employees e ON e.id=sa.employee_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE sa.shift_type_id=? AND sa.active=1 AND e.active=1 AND COALESCE(TRIM(ep.end_date),'')=''").bind(shiftTypeId).all<{ employeeId: string; role: string }>();
  const standingByRole = new Map<string, string[]>();
  for (const row of standing.results) (standingByRole.get(row.role) ?? standingByRole.set(row.role, []).get(row.role)!).push(row.employeeId);
  return standingByRole;
}

async function runWritesChunked(db: Db, writes: Array<ReturnType<Db["prepare"]>>, chunkSize = 50) {
  for (let index = 0; index < writes.length; index += chunkSize) await db.batch(writes.slice(index, index + chunkSize));
}

/** Keep future generated seats aligned with every active standing member, including extras above the minimum. */
async function syncFutureStandingSlots(db: Db, shiftTypeId: string, role: string, fromDate: string) {
  const standing = (await db.prepare("SELECT sa.employee_id employeeId FROM station_standing_assignments sa JOIN employees e ON e.id=sa.employee_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE sa.shift_type_id=? AND sa.role=? AND sa.active=1 AND e.active=1 AND COALESCE(TRIM(ep.end_date),'')='' ORDER BY sa.created_at,sa.id")
    .bind(shiftTypeId, role).all<{ employeeId: string }>()).results;
  const entries = (await db.prepare("SELECT id FROM station_schedule_entries WHERE shift_type_id=? AND entry_date>=? ORDER BY entry_date")
    .bind(shiftTypeId, fromDate).all<{ id: string }>()).results;
  const slots = (await db.prepare("SELECT s.id,s.entry_id entryId,s.employee_id employeeId,s.status,s.sort_order sortOrder FROM station_shift_slots s JOIN station_schedule_entries en ON en.id=s.entry_id WHERE en.shift_type_id=? AND en.entry_date>=? AND s.role=? ORDER BY en.entry_date,s.sort_order")
    .bind(shiftTypeId, fromDate, role).all<{ id: string; entryId: string; employeeId: string | null; status: string; sortOrder: number }>()).results;
  const slotsByEntry = new Map<string, typeof slots>();
  for (const slot of slots) (slotsByEntry.get(slot.entryId) ?? slotsByEntry.set(slot.entryId, []).get(slot.entryId)!).push(slot);
  const writes: Array<ReturnType<Db["prepare"]>> = [];
  for (const entry of entries) {
    const entrySlots = slotsByEntry.get(entry.id) ?? [];
    const assigned = new Set(entrySlots.map((slot) => slot.employeeId).filter(Boolean));
    const available = entrySlots.filter((slot) => slot.status === "open" || !slot.employeeId);
    let nextSortOrder = entrySlots.reduce((highest, slot) => Math.max(highest, Number(slot.sortOrder) + 1), 0);
    for (const member of standing) {
      if (assigned.has(member.employeeId)) continue;
      const open = available.shift();
      if (open) {
        writes.push(db.prepare("UPDATE station_shift_slots SET employee_id=?,status='filled' WHERE id=?").bind(member.employeeId, open.id));
      } else {
        writes.push(db.prepare("INSERT INTO station_shift_slots(id,entry_id,role,employee_id,status,sort_order) VALUES(?,?,?,?,'filled',?)")
          .bind(crypto.randomUUID(), entry.id, role, member.employeeId, nextSortOrder));
        nextSortOrder += 1;
      }
      assigned.add(member.employeeId);
    }
  }
  await runWritesChunked(db, writes);
}

function appendEntryWrites(
  db: Db,
  writes: Array<ReturnType<Db["prepare"]>>,
  entryDate: string,
  shiftTypeId: string,
  actor: string,
  roleReqs: Array<{ role: string; count: number }>,
  standingByRole: Map<string, string[]>,
) {
  const entryId = crypto.randomUUID();
  writes.push(db.prepare("INSERT INTO station_schedule_entries(id,entry_date,shift_type_id,created_by) VALUES(?,?,?,?)").bind(entryId, entryDate, shiftTypeId, actor));
  let sortOrder = 0;
  for (const req of roleReqs) {
    const fillers = [...(standingByRole.get(req.role) ?? [])];
    for (let seat = 0; seat < Math.max(req.count, fillers.length); seat += 1) {
      const employeeId = fillers[seat] ?? null;
      writes.push(db.prepare("INSERT INTO station_shift_slots(id,entry_id,role,employee_id,status,sort_order) VALUES(?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), entryId, req.role, employeeId, employeeId ? "filled" : "open", sortOrder));
      sortOrder += 1;
    }
  }
  return entryId;
}

async function insertRowsChunked(db: Db, table: string, columns: string[], rows: ScheduleBoundValue[][], chunkSize: number) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const placeholders = chunk.map(() => `(${columns.map(() => "?").join(",")})`).join(",");
    await db.prepare(`INSERT INTO ${table}(${columns.join(",")}) VALUES ${placeholders}`).bind(...chunk.flat()).run();
  }
}

async function deleteEntry(db: Db, payload: Record<string, unknown>, requireAdmin: () => void) {
  requireAdmin();
  const entryId = String(payload.entryId ?? "");
  const slotIds = (await db.prepare("SELECT id FROM station_shift_slots WHERE entry_id=?").bind(entryId).all<{ id: string }>()).results.map((r) => r.id);
  if (slotIds.length) {
    const placeholders = slotIds.map(() => "?").join(",");
    await db.batch([
      db.prepare(`DELETE FROM station_ot_offers WHERE slot_id IN (${placeholders})`).bind(...slotIds),
      db.prepare(`DELETE FROM station_ot_interest WHERE slot_id IN (${placeholders})`).bind(...slotIds),
      db.prepare(`DELETE FROM station_shift_claims WHERE slot_id IN (${placeholders})`).bind(...slotIds),
      db.prepare(`DELETE FROM station_trade_requests WHERE slot_id IN (${placeholders})`).bind(...slotIds),
    ]);
  }
  await db.batch([
    db.prepare("DELETE FROM station_shift_slots WHERE entry_id=?").bind(entryId),
    db.prepare("DELETE FROM station_schedule_entries WHERE id=?").bind(entryId),
  ]);
  return ok();
}

async function assignSlot(db: Db, payload: Record<string, unknown>, requireAdmin: () => void) {
  requireAdmin();
  const slotId = String(payload.slotId ?? "");
  const employeeId = String(payload.employeeId ?? "");
  if (!slotId || !employeeId) return bad("Choose a slot and an employee.");
  const slot = await db.prepare("SELECT role FROM station_shift_slots WHERE id=?").bind(slotId).first<{ role: string }>();
  if (!slot) return bad("That position is no longer available.", 409);
  if (!await isEligibleEmployeeForRole(db, employeeId, slot.role)) return bad("That employee is not active and qualified for this position.", 409);
  await clearSlotWorkflows(db, slotId);
  const result = await db.prepare("UPDATE station_shift_slots SET employee_id=?,status='filled' WHERE id=?").bind(employeeId, slotId).run();
  if (!result.meta.changes) return bad("That slot is unavailable.", 409);
  return ok();
}

async function clearSlot(db: Db, payload: Record<string, unknown>, requireAdmin: () => void) {
  requireAdmin();
  const slotId = String(payload.slotId ?? "");
  await clearSlotWorkflows(db, slotId);
  await db.prepare("UPDATE station_shift_slots SET employee_id=NULL,status='open' WHERE id=?").bind(slotId).run();
  return ok();
}

async function clearSlotWorkflows(db: Db, slotId: string) {
  await db.batch([
    db.prepare("DELETE FROM station_ot_offers WHERE slot_id=?").bind(slotId),
    db.prepare("DELETE FROM station_ot_interest WHERE slot_id=?").bind(slotId),
    db.prepare("DELETE FROM station_shift_claims WHERE slot_id=?").bind(slotId),
    db.prepare("DELETE FROM station_trade_requests WHERE slot_id=?").bind(slotId),
  ]);
}

async function addDaySlot(db: Db, current: Viewer, payload: Record<string, unknown>, requireAdmin: () => void) {
  requireAdmin();
  const entryId = String(payload.entryId ?? "");
  const role = String(payload.role ?? "").trim();
  const startTime = normalizeScheduleTime(String(payload.startTime ?? ""));
  const endTime = normalizeScheduleTime(String(payload.endTime ?? ""));
  const employeeId = String(payload.employeeId ?? "").trim();
  if (!entryId || !isOneDayPositionRole(role) || !startTime || !endTime) return bad("Choose a shift, position, and valid four-digit start and end times.");
  const entry = await db.prepare("SELECT id FROM station_schedule_entries WHERE id=?").bind(entryId).first<{ id: string }>();
  if (!entry) return bad("That day shift is no longer available.", 409);
  if (employeeId && !await isEligibleEmployeeForRole(db, employeeId, role)) return bad("That employee is not active and qualified for this position.", 409);
  const next = await db.prepare("SELECT COALESCE(MAX(sort_order),-1)+1 sortOrder FROM station_shift_slots WHERE entry_id=?").bind(entryId).first<{ sortOrder: number }>();
  await db.prepare("INSERT INTO station_shift_slots(id,entry_id,role,employee_id,status,sort_order,start_time,end_time,is_extra) VALUES(?,?,?,?,?,?,?,?,1)")
    .bind(crypto.randomUUID(), entryId, role, employeeId || null, employeeId ? "filled" : "open", Number(next?.sortOrder ?? 0), startTime, endTime).run();
  return ok({ note: `${role} added to this day only by ${current.name}.` });
}

async function updateDaySlot(db: Db, payload: Record<string, unknown>, requireAdmin: () => void) {
  requireAdmin();
  const slotId = String(payload.slotId ?? "");
  const role = String(payload.role ?? "").trim();
  const startTime = normalizeScheduleTime(String(payload.startTime ?? ""));
  const endTime = normalizeScheduleTime(String(payload.endTime ?? ""));
  const employeeId = String(payload.employeeId ?? "").trim();
  if (!slotId || !isOneDayPositionRole(role) || !startTime || !endTime) return bad("Choose a position and valid four-digit start and end times.");
  const slot = await db.prepare("SELECT id FROM station_shift_slots WHERE id=? AND is_extra=1").bind(slotId).first<{ id: string }>();
  if (!slot) return bad("Only a one-day added position can have its role or times changed.", 409);
  if (employeeId && !await isEligibleEmployeeForRole(db, employeeId, role)) return bad("That employee is not active and qualified for this position.", 409);
  await clearSlotWorkflows(db, slotId);
  await db.prepare("UPDATE station_shift_slots SET role=?,start_time=?,end_time=?,employee_id=?,status=? WHERE id=?")
    .bind(role, startTime, endTime, employeeId || null, employeeId ? "filled" : "open", slotId).run();
  return ok({ note: "The one-day position was updated." });
}

async function deleteDaySlot(db: Db, payload: Record<string, unknown>, requireAdmin: () => void) {
  requireAdmin();
  const slotId = String(payload.slotId ?? "");
  const slot = await db.prepare("SELECT id FROM station_shift_slots WHERE id=? AND is_extra=1").bind(slotId).first<{ id: string }>();
  if (!slot) return bad("Only a one-day added position can be removed.", 409);
  await clearSlotWorkflows(db, slotId);
  await db.prepare("DELETE FROM station_shift_slots WHERE id=? AND is_extra=1").bind(slotId).run();
  return ok({ note: "The one-day position was removed." });
}

async function updateDaySlotTime(db: Db, payload: Record<string, unknown>, requireAdmin: () => void) {
  requireAdmin();
  const slotId = String(payload.slotId ?? "");
  const reset = Boolean(payload.reset);
  if (!slotId) return bad("Choose a position.");
  const slot = await db.prepare("SELECT id,is_extra isExtra FROM station_shift_slots WHERE id=?").bind(slotId).first<{ id: string; isExtra: number }>();
  if (!slot) return bad("That position is no longer available.", 409);
  if (slot.isExtra) return bad("Use Edit position to change a one-day added position.", 409);
  if (reset) {
    await db.prepare("UPDATE station_shift_slots SET start_time='',end_time='' WHERE id=? AND is_extra=0").bind(slotId).run();
    return ok({ note: "This position now uses the built shift time." });
  }
  const startTime = normalizeScheduleTime(String(payload.startTime ?? ""));
  const endTime = normalizeScheduleTime(String(payload.endTime ?? ""));
  if (!startTime || !endTime) return bad("Enter valid four-digit start and end times.");
  await db.prepare("UPDATE station_shift_slots SET start_time=?,end_time=? WHERE id=? AND is_extra=0")
    .bind(startTime, endTime, slotId).run();
  return ok({ note: "The position time was changed for this day only." });
}

async function saveStandingAssignment(db: Db, current: Viewer, payload: Record<string, unknown>, requireAdmin: () => void) {
  requireAdmin();
  const employeeId = String(payload.employeeId ?? "");
  const shiftTypeId = String(payload.shiftTypeId ?? "");
  const role = String(payload.role ?? "").trim();
  if (!employeeId || !shiftTypeId || !isStationRole(role)) return bad("Choose an employee, shift type, and role.");
  if (!await isSchedulableEmployee(db, employeeId)) return bad("That employee has a Last Day and is no longer available for scheduling.", 409);
  await db.prepare("INSERT INTO station_standing_assignments(id,employee_id,shift_type_id,role,created_by) VALUES(?,?,?,?,?) ON CONFLICT(employee_id,shift_type_id,role) DO UPDATE SET active=1")
    .bind(crypto.randomUUID(), employeeId, shiftTypeId, role, current.name).run();
  const today = chicagoToday();
  await syncFutureStandingSlots(db, shiftTypeId, role, today);
  return ok();
}

async function removeStandingAssignment(db: Db, payload: Record<string, unknown>, requireAdmin: () => void) {
  requireAdmin();
  const id = String(payload.id ?? "");
  const assignment = await db.prepare("SELECT employee_id employeeId,shift_type_id shiftTypeId,role FROM station_standing_assignments WHERE id=? AND active=1")
    .bind(id).first<{ employeeId: string; shiftTypeId: string; role: string }>();
  if (!assignment) return bad("That standing assignment is no longer active.", 409);
  await db.prepare("UPDATE station_standing_assignments SET active=0 WHERE id=?").bind(id).run();
  const today = chicagoToday();
  const minimum = await db.prepare("SELECT count FROM station_shift_type_roles WHERE shift_type_id=? AND role=?")
    .bind(assignment.shiftTypeId, assignment.role).first<{ count: number }>();
  const slots = (await db.prepare("SELECT s.id,s.entry_id entryId FROM station_shift_slots s JOIN station_schedule_entries en ON en.id=s.entry_id WHERE en.shift_type_id=? AND en.entry_date>=? AND s.role=? AND s.employee_id=? ORDER BY en.entry_date,s.sort_order")
    .bind(assignment.shiftTypeId, today, assignment.role, assignment.employeeId).all<{ id: string; entryId: string }>()).results;
  const writes: Array<ReturnType<Db["prepare"]>> = [];
  for (const slot of slots) {
    const count = await db.prepare("SELECT COUNT(*) count FROM station_shift_slots WHERE entry_id=? AND role=?")
      .bind(slot.entryId, assignment.role).first<{ count: number }>();
    if (Number(count?.count ?? 0) > Number(minimum?.count ?? 0)) {
      writes.push(
        db.prepare("DELETE FROM station_ot_offers WHERE slot_id=?").bind(slot.id),
        db.prepare("DELETE FROM station_ot_interest WHERE slot_id=?").bind(slot.id),
        db.prepare("DELETE FROM station_shift_claims WHERE slot_id=?").bind(slot.id),
        db.prepare("DELETE FROM station_trade_requests WHERE slot_id=?").bind(slot.id),
        db.prepare("DELETE FROM station_shift_slots WHERE id=?").bind(slot.id),
      );
    } else {
      writes.push(db.prepare("UPDATE station_shift_slots SET employee_id=NULL,status='open' WHERE id=?").bind(slot.id));
    }
  }
  await runWritesChunked(db, writes);
  await syncFutureStandingSlots(db, assignment.shiftTypeId, assignment.role, today);
  return ok();
}

async function saveEmployeeScheduler(db: Db, payload: Record<string, unknown>, requireAdmin: () => void) {
  requireAdmin();
  const employeeId = String(payload.employeeId ?? "");
  if (!employeeId) return bad("Choose an employee.");
  if (!await isSchedulableEmployee(db, employeeId)) return bad("That employee has a Last Day and is no longer available for scheduling.", 409);
  const roles = [...new Set((Array.isArray(payload.roles) ? payload.roles.map(String) : []).filter(isStationRole))];
  const notifyEmail = payload.notifyEmail === undefined ? undefined : Boolean(payload.notifyEmail);
  const notifyText = payload.notifyText === undefined ? undefined : Boolean(payload.notifyText);
  await db.prepare("INSERT INTO employee_profiles(employee_id) VALUES(?) ON CONFLICT(employee_id) DO NOTHING").bind(employeeId).run();
  await db.prepare("UPDATE employee_profiles SET station_roles=?, station_notify_email=COALESCE(?,station_notify_email), station_notify_text=COALESCE(?,station_notify_text), updated_at=CURRENT_TIMESTAMP WHERE employee_id=?")
    .bind(JSON.stringify(roles), notifyEmail === undefined ? null : notifyEmail ? 1 : 0, notifyText === undefined ? null : notifyText ? 1 : 0, employeeId).run();
  return ok();
}

async function reviewClaim(db: Db, current: Viewer, payload: Record<string, unknown>, requireAdmin: () => void) {
  requireAdmin();
  const id = String(payload.id ?? "");
  const decision = String(payload.decision ?? "");
  if (!["approved", "denied"].includes(decision)) return bad("Choose approve or deny.");
  const claim = await db.prepare("SELECT slot_id slotId,employee_id employeeId FROM station_shift_claims WHERE id=? AND status='pending'").bind(id).first<{ slotId: string; employeeId: string }>();
  if (!claim) return bad("This claim is no longer pending.", 409);
  if (decision === "approved") {
    if (!await isSchedulableEmployee(db, claim.employeeId)) return bad("That employee has a Last Day and is no longer available for scheduling.", 409);
    const filled = await db.prepare("UPDATE station_shift_slots SET employee_id=?,status='filled' WHERE id=? AND status='open'").bind(claim.employeeId, claim.slotId).run();
    if (!filled.meta.changes) return bad("That shift was already filled.", 409);
  }
  await db.prepare("UPDATE station_shift_claims SET status=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?").bind(decision, current.name, id).run();
  return ok();
}

async function reviewTrade(db: Db, current: Viewer, payload: Record<string, unknown>, requireAdmin: () => void) {
  requireAdmin();
  const id = String(payload.id ?? "");
  const decision = String(payload.decision ?? "");
  if (!["approved", "denied"].includes(decision)) return bad("Choose approve or deny.");
  const trade = await db.prepare("SELECT slot_id slotId,from_employee_id fromEmployeeId,accepted_by_employee_id acceptedByEmployeeId,status FROM station_trade_requests WHERE id=?").bind(id).first<{ slotId: string; fromEmployeeId: string; acceptedByEmployeeId: string | null; status: string }>();
  if (!trade || !["pending", "awaiting_acceptance"].includes(trade.status)) return bad("This trade is no longer open.", 409);
  if (decision === "approved") {
    if (!trade.acceptedByEmployeeId) return bad("A member must accept the trade before approval.", 409);
    if (!await isSchedulableEmployee(db, trade.acceptedByEmployeeId)) return bad("That employee has a Last Day and is no longer available for scheduling.", 409);
    await db.prepare("UPDATE station_shift_slots SET employee_id=?,status='filled' WHERE id=?").bind(trade.acceptedByEmployeeId, trade.slotId).run();
  }
  await db.prepare("UPDATE station_trade_requests SET status=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?").bind(decision, current.name, id).run();
  return ok();
}

async function reviewTimeOff(db: Db, current: Viewer, payload: Record<string, unknown>, requireAdmin: () => void) {
  // Approver must be an Officer/AO; admins may also review.
  const id = String(payload.id ?? "");
  const decision = String(payload.decision ?? "");
  if (!["approved", "denied"].includes(decision)) return bad("Choose approve or deny.");
  const req = await db.prepare("SELECT employee_id employeeId,approver_employee_id approverEmployeeId,status FROM station_time_off_requests WHERE id=?").bind(id).first<{ employeeId: string; approverEmployeeId: string; status: string }>();
  if (!req || req.status !== "pending") return bad("This request is no longer pending.", 409);
  const isApprover = current.employeeId === req.approverEmployeeId && (current.roles.includes("Officer/AO") || officerRank(current.rank));
  if (!current.isAdmin && !isApprover) return bad("Only the assigned Officer/AO approver may review this request.", 403);
  if (decision === "approved") {
    const dates = (await db.prepare("SELECT off_date offDate FROM station_time_off_dates WHERE request_id=?").bind(id).all<{ offDate: string }>()).results;
    if (dates.length) {
      await db.batch(dates.map((d) => db.prepare("INSERT INTO station_unavailability(id,employee_id,off_date,source,request_id) VALUES(?,?,?,'time_off',?) ON CONFLICT(employee_id,off_date) DO UPDATE SET source='time_off',request_id=excluded.request_id")
        .bind(crypto.randomUUID(), req.employeeId, d.offDate, id)));
    }
  }
  await db.prepare("UPDATE station_time_off_requests SET status=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?").bind(decision, id).run();
  return ok();
}

async function saveOtSettings(db: Db, payload: Record<string, unknown>, requireAdmin: () => void) {
  requireAdmin();
  const mode = String(payload.mode ?? "");
  if (!["voluntary", "mandatory"].includes(mode)) return bad("Choose voluntary or mandatory.");
  const priorityOrder = (Array.isArray(payload.priorityOrder) ? payload.priorityOrder.map(String) : []).filter((c) => ["leastOT", "leastMandatory", "mostSeniority", "leastSeniority"].includes(c));
  const customRules = Array.isArray(payload.customRules) ? payload.customRules.map((r) => { const rule = r as Record<string, unknown>; return { id: String(rule.id ?? crypto.randomUUID()), label: String(rule.label ?? "").trim() }; }).filter((r) => r.label) : [];
  await db.prepare("UPDATE station_ot_settings SET exempt_off_duty=?,exempt_already_scheduled=?,exempt_declined=?,exempt_recently_mandated=?,recent_days=?,exempt_max_consecutive=?,max_consecutive=?,priority_order=?,custom_rules=?,updated_at=CURRENT_TIMESTAMP WHERE mode=?")
    .bind(payload.exemptOffDuty ? 1 : 0, payload.exemptAlreadyScheduled ? 1 : 0, payload.exemptDeclined ? 1 : 0, payload.exemptRecentlyMandated ? 1 : 0, Math.max(0, Math.min(365, Number(payload.recentDays) || 0)), payload.exemptMaxConsecutive ? 1 : 0, Math.max(1, Math.min(30, Number(payload.maxConsecutive) || 1)), JSON.stringify(priorityOrder), JSON.stringify(customRules), mode).run();
  return ok();
}

async function saveOtTiming(db: Db, payload: Record<string, unknown>, requireAdmin: () => void) {
  requireAdmin();
  const awardDaysOut = Number(payload.awardDaysOut);
  const completeByDaysOut = Number(payload.completeByDaysOut);
  if (!Number.isInteger(awardDaysOut) || !Number.isInteger(completeByDaysOut) || awardDaysOut < 1 || completeByDaysOut < 0 || completeByDaysOut >= awardDaysOut) {
    return bad("Award days must be a positive whole number greater than the completion deadline.");
  }
  await db.prepare("UPDATE station_ot_timing SET award_days_out=?,complete_by_days_out=?,updated_at=CURRENT_TIMESTAMP WHERE id=1").bind(awardDaysOut, completeByDaysOut).run();
  return ok();
}

async function saveDistributionWeights(db: Db, payload: Record<string, unknown>, requireAdmin: () => void) {
  requireAdmin();
  const clamp = (value: unknown) => Math.max(0, Math.min(10, Number(value) || 0));
  await db.prepare("UPDATE station_distribution_weights SET seniority_weight=?,hours_weight=?,custom_weight=?,custom_label=?,updated_at=CURRENT_TIMESTAMP WHERE id=1")
    .bind(clamp(payload.seniorityWeight), clamp(payload.hoursWeight), clamp(payload.customWeight), String(payload.customLabel ?? "Cross-trained").trim() || "Cross-trained").run();
  return ok();
}

async function runAutoDistribution(db: Db, payload: Record<string, unknown>, requireAdmin: () => void) {
  requireAdmin();
  const today = chicagoToday();
  const fromDate = iso.test(String(payload.fromDate ?? "")) ? String(payload.fromDate) : today;
  const employees = await loadEmployees(db);
  const weightsRow = await db.prepare("SELECT seniority_weight seniorityWeight,hours_weight hoursWeight,custom_weight customWeight,custom_label customLabel FROM station_distribution_weights WHERE id=1").first<{ seniorityWeight: number; hoursWeight: number; customWeight: number; customLabel: string }>();
  const weights = weightsRow ?? { seniorityWeight: 1, hoursWeight: 1, customWeight: 0, customLabel: "Cross-trained" };

  const openRows = (await db.prepare("SELECT s.id,s.role,en.entry_date entryDate,COALESCE(NULLIF(s.start_time,''),t.start_time) startTime,COALESCE(NULLIF(s.end_time,''),t.end_time) endTime FROM station_shift_slots s JOIN station_schedule_entries en ON en.id=s.entry_id JOIN station_shift_types t ON t.id=en.shift_type_id WHERE s.status='open' AND date(en.entry_date)>=date(?) ORDER BY en.entry_date,s.sort_order").bind(fromDate).all<{ id: string; role: string; entryDate: string; startTime: string; endTime: string }>()).results;
  if (!openRows.length) return ok({ assigned: 0 });

  const unavailable = new Map<string, Set<string>>();
  for (const row of (await db.prepare("SELECT employee_id employeeId,off_date offDate FROM station_unavailability").all<{ employeeId: string; offDate: string }>()).results) {
    (unavailable.get(row.offDate) ?? unavailable.set(row.offDate, new Set()).get(row.offDate)!).add(row.employeeId);
  }

  const openSlots: OpenSlot[] = openRows.map((r) => ({ slotId: r.id, date: r.entryDate, role: r.role, hours: shiftHours(r.startTime, r.endTime) }));
  const distEmployees: DistributionEmployee[] = employees.map((e) => ({
    employeeId: e.id, name: e.name, seniority: seniorityFromStartDate(e.startDate, today), hours: e.hoursThisPeriod,
    crossTrained: parseRoles(e.roles).length > 1,
  }));
  const eligibility: Record<string, string[]> = {};
  for (const row of openRows) {
    eligibility[row.id] = employees.filter((e) => {
      if (unavailable.get(row.entryDate)?.has(e.id)) return false;
      return eligibleForRole(row.role, { roles: parseRoles(e.roles), rank: e.rank, actingOfficerEligible: Boolean(e.actingOfficerEligible) });
    }).map((e) => e.id);
  }
  const busy = await busyEmployeesByDate(db, [...new Set(openRows.map((r) => r.entryDate))]);
  const busyByDate: Record<string, string[]> = {};
  for (const [date, set] of Object.entries(busy)) busyByDate[date] = [...set];

  const assignments = autoDistribute(openSlots, distEmployees, weights, eligibility, busyByDate);
  if (assignments.length) {
    for (let index = 0; index < assignments.length; index += 50) {
      await db.batch(assignments.slice(index, index + 50).flatMap((a) => [
        db.prepare("UPDATE station_shift_slots SET employee_id=?,status='filled' WHERE id=? AND status='open'").bind(a.employeeId, a.slotId),
        db.prepare("UPDATE employee_profiles SET station_hours_this_period=station_hours_this_period+?,updated_at=CURRENT_TIMESTAMP WHERE employee_id=?").bind(a.hours, a.employeeId),
      ]));
    }
  }
  return ok({ assigned: assignments.length });
}

async function buildOtCallList(db: Db, payload: Record<string, unknown>, requireAdmin: () => void) {
  requireAdmin();
  const slotId = String(payload.slotId ?? "");
  const mode = String(payload.mode ?? "voluntary") as OtMode;
  if (!["voluntary", "mandatory"].includes(mode)) return bad("Choose voluntary or mandatory.");
  const slot = await db.prepare("SELECT s.id,s.role,en.entry_date entryDate FROM station_shift_slots s JOIN station_schedule_entries en ON en.id=s.entry_id WHERE s.id=? AND s.status='open'").bind(slotId).first<{ id: string; role: string; entryDate: string }>();
  if (!slot) return bad("That slot is no longer open.", 409);
  const settings = await otSettings(db, mode);
  const today = chicagoToday();
  const employees = await loadEmployees(db);

  const unavailable = new Set((await db.prepare("SELECT employee_id employeeId FROM station_unavailability WHERE off_date=?").bind(slot.entryDate).all<{ employeeId: string }>()).results.map((r) => r.employeeId));
  const scheduledThatDay = (await busyEmployeesByDate(db, [slot.entryDate]))[slot.entryDate] ?? new Set();
  const declined = new Set((await db.prepare("SELECT employee_id employeeId FROM station_ot_offers WHERE slot_id=? AND status='declined'").bind(slotId).all<{ employeeId: string }>()).results.map((r) => r.employeeId));

  const pool: OtEmployee[] = employees
    .filter((e) => eligibleForRole(slot.role, { roles: parseRoles(e.roles), rank: e.rank, actingOfficerEligible: Boolean(e.actingOfficerEligible) }))
    .map((e) => ({
      employeeId: e.id, name: e.name, otHours: e.otHours, mandatoryHours: e.mandatoryHours,
      seniority: seniorityFromStartDate(e.startDate, today),
      offDuty: Boolean(e.offDuty) || unavailable.has(e.id),
      alreadyScheduled: scheduledThatDay.has(e.id),
      declined: declined.has(e.id),
      lastMandated: e.lastMandated,
      consecutiveMandatory: e.consecutiveMandatory,
    }));
  const ranked = buildCallList(pool, mode, settings, slot.entryDate);

  // Replace any prior un-awarded offers for this slot with the fresh ranked list.
  await db.prepare("DELETE FROM station_ot_offers WHERE slot_id=? AND status IN ('offered','declined')").bind(slotId).run();
  if (ranked.length) {
    await db.batch(ranked.map((e, index) => db.prepare("INSERT INTO station_ot_offers(id,slot_id,employee_id,mode,status,rank) VALUES(?,?,?,?,'offered',?)").bind(crypto.randomUUID(), slotId, e.employeeId, mode, index + 1)));
  }
  return ok({ callList: ranked.map((e, index) => ({ rank: index + 1, employeeId: e.employeeId, name: e.name })) });
}

/** Admin awards (voluntary accept) or mandates a slot to a specific employee, charging OT/mandatory hours. */
async function awardOtOffer(db: Db, payload: Record<string, unknown>, requireAdmin: () => void) {
  requireAdmin();
  const slotId = String(payload.slotId ?? "");
  const employeeId = String(payload.employeeId ?? "");
  const mode = String(payload.mode ?? "voluntary") as OtMode;
  if (!slotId || !employeeId || !["voluntary", "mandatory"].includes(mode)) return bad("Choose a slot, employee, and mode.");
  if (!await isSchedulableEmployee(db, employeeId)) return bad("That employee has a Last Day and is no longer available for scheduling.", 409);
  const slot = await db.prepare("SELECT s.id,COALESCE(NULLIF(s.start_time,''),t.start_time) startTime,COALESCE(NULLIF(s.end_time,''),t.end_time) endTime,en.entry_date entryDate FROM station_shift_slots s JOIN station_schedule_entries en ON en.id=s.entry_id JOIN station_shift_types t ON t.id=en.shift_type_id WHERE s.id=? AND s.status='open'").bind(slotId).first<{ id: string; startTime: string; endTime: string; entryDate: string }>();
  if (!slot) return bad("That slot is no longer open.", 409);
  const hours = shiftHours(slot.startTime, slot.endTime);
  const filled = await db.prepare("UPDATE station_shift_slots SET employee_id=?,status='filled' WHERE id=? AND status='open'").bind(employeeId, slotId).run();
  if (!filled.meta.changes) return bad("That slot was already filled.", 409);
  const writes = [
    db.prepare("UPDATE station_ot_offers SET status=?,responded_at=CURRENT_TIMESTAMP WHERE slot_id=? AND employee_id=?").bind(mode === "mandatory" ? "mandated" : "accepted", slotId, employeeId),
    db.prepare("INSERT INTO station_ot_offers(id,slot_id,employee_id,mode,status,rank,responded_at) SELECT ?,?,?,?,?,0,CURRENT_TIMESTAMP WHERE NOT EXISTS(SELECT 1 FROM station_ot_offers WHERE slot_id=? AND employee_id=?)").bind(crypto.randomUUID(), slotId, employeeId, mode, mode === "mandatory" ? "mandated" : "accepted", slotId, employeeId),
    db.prepare("UPDATE employee_profiles SET station_hours_this_period=station_hours_this_period+?,station_ot_hours=station_ot_hours+? WHERE employee_id=?").bind(hours, hours, employeeId),
  ];
  if (mode === "mandatory") {
    writes.push(db.prepare("UPDATE employee_profiles SET station_mandatory_hours=station_mandatory_hours+?,station_last_mandated=?,station_consecutive_mandatory=station_consecutive_mandatory+1 WHERE employee_id=?").bind(hours, slot.entryDate, employeeId));
  }
  await db.batch(writes);
  return ok();
}

async function saveReminderRule(db: Db, payload: Record<string, unknown>, requireAdmin: () => void) {
  requireAdmin();
  const id = String(payload.id ?? "");
  if (!id) return bad("Choose a reminder rule.");
  const offsets = [...new Set(Array.isArray(payload.offsets) ? payload.offsets.map(String).map((s) => s.trim()).filter(Boolean) : [])];
  await db.prepare("UPDATE station_reminder_rules SET offsets=?,email_enabled=?,text_enabled=?,target=?,enabled=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .bind(JSON.stringify(offsets), payload.emailEnabled ? 1 : 0, payload.textEnabled ? 1 : 0, String(payload.target ?? "").trim(), payload.enabled ? 1 : 0, id).run();
  return ok();
}

// --- Employee-facing actions ------------------------------------------------

/** Resolve the acting employee id: admins may act for a member via `memberId`. */
function actingId(current: Viewer, payload: Record<string, unknown>): string {
  const requested = current.isAdmin ? String(payload.memberId ?? "") : "";
  return requested || current.employeeId || "";
}

async function submitClaim(db: Db, current: Viewer, payload: Record<string, unknown>) {
  const employeeId = actingId(current, payload);
  const slotId = String(payload.slotId ?? "");
  if (!employeeId || !slotId) return bad("Choose an open shift.");
  const slot = await db.prepare("SELECT s.id,s.role,s.status FROM station_shift_slots s WHERE s.id=?").bind(slotId).first<{ id: string; role: string; status: string }>();
  if (!slot || slot.status !== "open") return bad("That shift is no longer open.", 409);
  const emp = await db.prepare("SELECT p.label rank,COALESCE(ep.station_roles,'[]') roles,COALESCE(ep.acting_officer_eligible,0) actingOfficerEligible FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.id=? AND e.active=1 AND COALESCE(TRIM(ep.end_date),'')=''").bind(employeeId).first<{ rank: string; roles: string; actingOfficerEligible: number }>();
  if (!emp || !eligibleForRole(slot.role, { roles: parseRoles(emp.roles), rank: emp.rank, actingOfficerEligible: Boolean(emp.actingOfficerEligible) })) return bad("You are not eligible for this role.", 403);
  const existing = await db.prepare("SELECT id FROM station_shift_claims WHERE slot_id=? AND employee_id=? AND status='pending'").bind(slotId, employeeId).first();
  if (existing) return bad("You already requested this shift.", 409);
  await db.prepare("INSERT INTO station_shift_claims(id,slot_id,role,employee_id,note) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(), slotId, slot.role, employeeId, String(payload.note ?? "").trim()).run();
  return ok();
}

async function submitTrade(db: Db, current: Viewer, payload: Record<string, unknown>) {
  const employeeId = actingId(current, payload);
  const slotId = String(payload.slotId ?? "");
  const targetEmployeeId = String(payload.targetEmployeeId ?? ""); // "" = broadcast
  if (!employeeId || !slotId) return bad("Choose one of your shifts.");
  const slot = await db.prepare("SELECT id,role,employee_id employeeId FROM station_shift_slots WHERE id=? AND status='filled'").bind(slotId).first<{ id: string; role: string; employeeId: string }>();
  if (!slot || slot.employeeId !== employeeId) return bad("Choose a shift you are currently assigned.", 403);
  if (targetEmployeeId) {
    if (targetEmployeeId === employeeId) return bad("Choose a different member.");
    const target = await db.prepare("SELECT p.label rank,COALESCE(ep.station_roles,'[]') roles,COALESCE(ep.acting_officer_eligible,0) actingOfficerEligible FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.id=? AND e.active=1 AND COALESCE(TRIM(ep.end_date),'')=''").bind(targetEmployeeId).first<{ rank: string; roles: string; actingOfficerEligible: number }>();
    if (!target || !eligibleForRole(slot.role, { roles: parseRoles(target.roles), rank: target.rank, actingOfficerEligible: Boolean(target.actingOfficerEligible) })) return bad("That member is not eligible for this role.", 403);
  }
  await db.prepare("INSERT INTO station_trade_requests(id,slot_id,role,from_employee_id,target_employee_id,note,status) VALUES(?,?,?,?,NULLIF(?,''),?,?)")
    .bind(crypto.randomUUID(), slotId, slot.role, employeeId, targetEmployeeId, String(payload.note ?? "").trim(), targetEmployeeId ? "awaiting_acceptance" : "pending").run();
  return ok();
}

async function respondTrade(db: Db, current: Viewer, payload: Record<string, unknown>) {
  const employeeId = actingId(current, payload);
  const id = String(payload.id ?? "");
  const decision = String(payload.decision ?? "");
  if (!employeeId || !["accept", "decline"].includes(decision)) return bad("Choose accept or decline.");
  const trade = await db.prepare("SELECT t.id,t.slot_id slotId,t.role,t.target_employee_id targetEmployeeId,t.from_employee_id fromEmployeeId,t.status FROM station_trade_requests t WHERE t.id=?").bind(id).first<{ id: string; slotId: string; role: string; targetEmployeeId: string | null; fromEmployeeId: string; status: string }>();
  if (!trade || !["pending", "awaiting_acceptance"].includes(trade.status)) return bad("This trade is no longer open.", 409);
  if (trade.targetEmployeeId && trade.targetEmployeeId !== employeeId) return bad("This trade is directed to another member.", 403);
  if (trade.fromEmployeeId === employeeId) return bad("You cannot accept your own trade.");
  if (decision === "decline") {
    if (trade.targetEmployeeId === employeeId) await db.prepare("UPDATE station_trade_requests SET status='denied' WHERE id=?").bind(id).run();
    return ok();
  }
  const emp = await db.prepare("SELECT p.label rank,COALESCE(ep.station_roles,'[]') roles,COALESCE(ep.acting_officer_eligible,0) actingOfficerEligible FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.id=? AND e.active=1 AND COALESCE(TRIM(ep.end_date),'')=''").bind(employeeId).first<{ rank: string; roles: string; actingOfficerEligible: number }>();
  if (!emp || !eligibleForRole(trade.role, { roles: parseRoles(emp.roles), rank: emp.rank, actingOfficerEligible: Boolean(emp.actingOfficerEligible) })) return bad("You are not eligible for this role.", 403);
  await db.prepare("UPDATE station_trade_requests SET accepted_by_employee_id=?,status='awaiting_acceptance' WHERE id=?").bind(employeeId, id).run();
  return ok({ note: "Accepted — pending administrator approval." });
}

async function submitTimeOff(db: Db, current: Viewer, payload: Record<string, unknown>) {
  const employeeId = actingId(current, payload);
  const type = String(payload.type ?? "");
  const approverEmployeeId = String(payload.approverEmployeeId ?? "");
  const dates = [...new Set((Array.isArray(payload.dates) ? payload.dates.map(String) : []).filter((d) => iso.test(d)))];
  if (!employeeId || !["vacation", "recovery", "floating", "sick", "official_business"].includes(type) || !approverEmployeeId || !dates.length) {
    return bad("Choose a type, at least one of your scheduled days, and an Officer/AO approver.");
  }
  // Approver must be an Officer/AO.
  const approver = await db.prepare("SELECT p.label rank,COALESCE(ep.station_roles,'[]') roles,COALESCE(ep.acting_officer_eligible,0) actingOfficerEligible FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.id=? AND e.active=1 AND COALESCE(TRIM(ep.end_date),'')=''").bind(approverEmployeeId).first<{ rank: string; roles: string; actingOfficerEligible: number }>();
  if (!approver || !eligibleForRole("Officer/AO", { roles: parseRoles(approver.roles), rank: approver.rank, actingOfficerEligible: Boolean(approver.actingOfficerEligible) })) return bad("Choose an Officer/AO as the approver.");
  // Each requested date must be one of the employee's actual scheduled days.
  const placeholders = dates.map(() => "?").join(",");
  const scheduled = new Set((await db.prepare(`SELECT DISTINCT en.entry_date entryDate FROM station_shift_slots s JOIN station_schedule_entries en ON en.id=s.entry_id WHERE s.employee_id=? AND en.entry_date IN (${placeholders})`).bind(employeeId, ...dates).all<{ entryDate: string }>()).results.map((r) => r.entryDate));
  const invalid = dates.filter((d) => !scheduled.has(d));
  if (invalid.length) return bad(`These are not your scheduled shift days: ${invalid.join(", ")}.`);
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO station_time_off_requests(id,employee_id,type,approver_employee_id,note) VALUES(?,?,?,?,?)").bind(id, employeeId, type, approverEmployeeId, String(payload.note ?? "").trim()).run();
  await db.batch(dates.map((d) => db.prepare("INSERT INTO station_time_off_dates(request_id,off_date) VALUES(?,?)").bind(id, d)));
  return ok();
}

async function setOtInterest(db: Db, current: Viewer, payload: Record<string, unknown>) {
  const employeeId = actingId(current, payload);
  const slotId = String(payload.slotId ?? "");
  const response = String(payload.response ?? "");
  if (!employeeId || !slotId || !["yes", "no"].includes(response)) return bad("Choose yes or no.");
  const slot = await db.prepare("SELECT id FROM station_shift_slots WHERE id=? AND status='open'").bind(slotId).first();
  if (!slot) return bad("That shift is no longer open.", 409);
  await db.prepare("INSERT INTO station_ot_interest(id,slot_id,employee_id,response) VALUES(?,?,?,?) ON CONFLICT(slot_id,employee_id) DO UPDATE SET response=excluded.response,responded_at=CURRENT_TIMESTAMP")
    .bind(crypto.randomUUID(), slotId, employeeId, response).run();
  return ok();
}

async function respondOtOffer(db: Db, current: Viewer, payload: Record<string, unknown>) {
  const employeeId = actingId(current, payload);
  const slotId = String(payload.slotId ?? "");
  const decision = String(payload.decision ?? "");
  if (!employeeId || !slotId || !["accept", "decline"].includes(decision)) return bad("Choose accept or decline.");
  const offer = await db.prepare("SELECT id,status FROM station_ot_offers WHERE slot_id=? AND employee_id=?").bind(slotId, employeeId).first<{ id: string; status: string }>();
  if (!offer || offer.status !== "offered") return bad("You have no open overtime offer for this shift.", 409);
  await db.prepare("UPDATE station_ot_offers SET status=?,responded_at=CURRENT_TIMESTAMP WHERE id=?").bind(decision === "accept" ? "accepted" : "declined", offer.id).run();
  return ok({ note: decision === "accept" ? "Accepted — the administrator will confirm the award." : "Declined." });
}

async function saveMyNotifyPrefs(db: Db, current: Viewer, payload: Record<string, unknown>) {
  const employeeId = actingId(current, payload);
  if (!employeeId) return bad("Your login is not connected to an employee record.", 403);
  const notifyText = Boolean(payload.notifyText);
  if (notifyText) {
    const profile = await db.prepare("SELECT COALESCE(phone,'') phone FROM employee_profiles WHERE employee_id=?").bind(employeeId).first<{ phone: string }>();
    if (!profile?.phone) return bad("Add a mobile phone number to your employee record before enabling text updates.");
  }
  await db.prepare("INSERT INTO employee_profiles(employee_id) VALUES(?) ON CONFLICT(employee_id) DO NOTHING").bind(employeeId).run();
  await db.prepare("UPDATE employee_profiles SET station_notify_email=?,station_notify_text=?,updated_at=CURRENT_TIMESTAMP WHERE employee_id=?").bind(payload.notifyEmail ? 1 : 0, notifyText ? 1 : 0, employeeId).run();
  return ok();
}
