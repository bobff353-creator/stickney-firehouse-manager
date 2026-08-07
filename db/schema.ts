import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const payScales = sqliteTable("pay_scales", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  regularRate: real("regular_rate").notNull(),
  overtimeRate: real("overtime_rate").notNull(),
  holidayRate: real("holiday_rate").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const payRateHistory = sqliteTable("pay_rate_history", {
  id: text("id").primaryKey(),
  payScaleId: text("pay_scale_id").notNull().references(() => payScales.id),
  effectiveDate: text("effective_date").notNull(),
  regularRate: real("regular_rate").notNull(),
  overtimeRate: real("overtime_rate").notNull(),
  holidayRate: real("holiday_rate").notNull(),
  createdBy: text("created_by").notNull().default("System"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("pay_rate_history_scale_date_idx").on(table.payScaleId, table.effectiveDate),
  index("pay_rate_history_effective_idx").on(table.effectiveDate),
]);

export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  payScaleId: text("pay_scale_id").notNull().references(() => payScales.id),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("employees_active_sort_idx").on(table.active, table.sortOrder)]);

export const employeeProfiles = sqliteTable("employee_profiles", {
  employeeId: text("employee_id").primaryKey().references(() => employees.id),
  employeeNumber: text("employee_number"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  dateOfBirth: text("date_of_birth"),
  phone: text("phone"),
  email: text("email"),
  scheduleSmsOptIn: integer("schedule_sms_opt_in", { mode: "boolean" }).notNull().default(false),
  addressLine1: text("address_line_1"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  employmentType: text("employment_type").notNull().default("Part-time"),
  isDpw: integer("is_dpw", { mode: "boolean" }).notNull().default(false),
  driverStatus: text("driver_status").notNull().default(""),
  actingOfficerEligible: integer("acting_officer_eligible", { mode: "boolean" }).notNull().default(false),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  emergencyName: text("emergency_name"),
  emergencyRelationship: text("emergency_relationship"),
  emergencyPhone: text("emergency_phone"),
  photoUpdatedAt: text("photo_updated_at"),
  notes: text("notes"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("employee_profiles_number_idx").on(table.employeeNumber)]);

export const rankPermissions = sqliteTable("rank_permissions", {
  rank: text("rank").notNull(),
  permissionKey: text("permission_key").notNull(),
  allowed: integer("allowed").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.rank, table.permissionKey] })]);

export const employeePermissionOverrides = sqliteTable("employee_permission_overrides", {
  employeeId: text("employee_id").notNull().references(() => employees.id),
  permissionKey: text("permission_key").notNull(),
  effect: text("effect").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.employeeId, table.permissionKey] })]);

export const payrollSettings = sqliteTable("payroll_settings", {
  id: integer("id").primaryKey(),
  overtimeThreshold: real("overtime_threshold").notNull().default(106),
  actingOfficerPremium: real("acting_officer_premium").notNull().default(1),
  dpwMultiplier: real("dpw_multiplier").notNull().default(1.5),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const payPeriods = sqliteTable("pay_periods", {
  startDate: text("start_date").primaryKey(),
  endDate: text("end_date").notNull(),
  status: text("status").notNull().default("draft"),
  createdBy: text("created_by").notNull().default("System"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedBy: text("updated_by").notNull().default("System"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  finalizedBy: text("finalized_by"),
  finalizedAt: text("finalized_at"),
});

export const timeEntries = sqliteTable("time_entries", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  periodStart: text("period_start").notNull().references(() => payPeriods.startDate),
  workDate: text("work_date").notNull(),
  category: text("category").notNull(),
  hours: real("hours").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("entry_employee_date_category_idx").on(table.employeeId, table.workDate, table.category),
  index("entry_period_employee_idx").on(table.periodStart, table.employeeId),
]);

export const workDetailRequests = sqliteTable("work_detail_requests", {
  id: text("id").primaryKey(),
  workDate: text("work_date").notNull(),
  requestingOfficerId: text("requesting_officer_id").notNull().references(() => employees.id),
  approverId: text("approver_id").notNull().references(() => employees.id),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  totalHours: real("total_hours").notNull(),
  workType: text("work_type").notNull(),
  description: text("description").notNull(),
  certified: integer("certified", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("pending"),
  submittedBy: text("submitted_by").notNull(),
  submittedAt: text("submitted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  rejectionNote: text("rejection_note").notNull().default(""),
}, (table) => [index("work_detail_status_date_idx").on(table.status, table.workDate)]);

export const workDetailMembers = sqliteTable("work_detail_members", {
  requestId: text("request_id").notNull().references(() => workDetailRequests.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
}, (table) => [uniqueIndex("work_detail_member_idx").on(table.requestId, table.employeeId)]);

export const workDetailPostings = sqliteTable("work_detail_postings", {
  requestId: text("request_id").notNull().references(() => workDetailRequests.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  hours: real("hours").notNull(),
  postedAt: text("posted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("work_detail_posting_idx").on(table.requestId, table.employeeId)]);

export const scheduleRotations = sqliteTable("schedule_rotations", {
  id: text("id").primaryKey(), name: text("name").notNull(), startDate: text("start_date").notNull(), endDate: text("end_date").notNull(),
  startTime: text("start_time").notNull(), endTime: text("end_time").notNull(), cycleDays: integer("cycle_days").notNull(),
  dutyDays: text("duty_days").notNull(), role: text("role").notNull(), coveragePlanId: text("coverage_plan_id").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdBy: text("created_by").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const scheduleRotationMembers = sqliteTable("schedule_rotation_members", {
  rotationId: text("rotation_id").notNull().references(() => scheduleRotations.id), employeeId: text("employee_id").notNull().references(() => employees.id),
}, (table) => [uniqueIndex("schedule_rotation_member_idx").on(table.rotationId, table.employeeId)]);
export const scheduleAssignments = sqliteTable("schedule_assignments", {
  id: text("id").primaryKey(), employeeId: text("employee_id").references(() => employees.id), workDate: text("work_date").notNull(),
  startTime: text("start_time").notNull(), endTime: text("end_time").notNull(), role: text("role").notNull(), source: text("source").notNull().default("manual"),
  rotationId: text("rotation_id").references(() => scheduleRotations.id), status: text("status").notNull().default("assigned"),
  emergency: integer("emergency", { mode: "boolean" }).notNull().default(false), requiredRank: text("required_rank").notNull().default(""),
  claimDeadline: text("claim_deadline").notNull().default(""), notes: text("notes").notNull().default(""),
  createdBy: text("created_by").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("schedule_assignment_date_idx").on(table.workDate), uniqueIndex("schedule_assignment_unique_idx").on(table.employeeId, table.workDate, table.startTime, table.role)]);
export const scheduleRequests = sqliteTable("schedule_requests", {
  id: text("id").primaryKey(), requestType: text("request_type").notNull(), employeeId: text("employee_id").notNull().references(() => employees.id),
  assignmentId: text("assignment_id").references(() => scheduleAssignments.id), targetEmployeeId: text("target_employee_id").references(() => employees.id),
  startDate: text("start_date").notNull(), endDate: text("end_date").notNull(), startTime: text("start_time").notNull().default(""),
  endTime: text("end_time").notNull().default(""), role: text("role").notNull().default(""), repeatMode: text("repeat_mode").notNull().default("none"),
  repeatInterval: integer("repeat_interval").notNull().default(0),
  status: text("status").notNull().default("pending"), targetStatus: text("target_status").notNull().default("not_required"),
  notes: text("notes").notNull().default(""), reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("schedule_request_status_idx").on(table.status, table.createdAt)]);
export const scheduleCoverageRules = sqliteTable("schedule_coverage_rules", {
  id: text("id").primaryKey(), planId: text("plan_id").notNull().default(""), name: text("name").notNull(), role: text("role").notNull(), minimumStaff: integer("minimum_staff").notNull(),
  startTime: text("start_time").notNull(), endTime: text("end_time").notNull(), daysOfWeek: text("days_of_week").notNull().default("0,1,2,3,4,5,6"),
  active: integer("active", { mode: "boolean" }).notNull().default(true), createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("schedule_coverage_rule_active_idx").on(table.active, table.role)]);
export const scheduleShiftPatterns = sqliteTable("schedule_shift_patterns", {
  id: text("id").primaryKey(), name: text("name").notNull(), color: text("color").notNull().default("red"),
  startDate: text("start_date").notNull(), startTime: text("start_time").notNull(), endTime: text("end_time").notNull(),
  recurrenceDays: integer("recurrence_days").notNull(), coveragePlanId: text("coverage_plan_id").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true), createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("schedule_shift_pattern_active_idx").on(table.active, table.startDate)]);
export const scheduleStaffingOverrides = sqliteTable("schedule_staffing_overrides", {
  id: text("id").primaryKey(), patternId: text("pattern_id").notNull().references(() => scheduleShiftPatterns.id),
  name: text("name").notNull(), conditionType: text("condition_type").notNull(), role: text("role").notNull(),
  minimumStaff: integer("minimum_staff").notNull(), active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdBy: text("created_by").notNull(), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("schedule_staffing_override_pattern_idx").on(table.patternId, table.active)]);
export const scheduleNotifications = sqliteTable("schedule_notifications", {
  id: text("id").primaryKey(), employeeId: text("employee_id").notNull().references(() => employees.id), title: text("title").notNull(),
  message: text("message").notNull(), inApp: integer("in_app", { mode: "boolean" }).notNull().default(true),
  eventType: text("event_type").notNull().default("general"),
  email: integer("email", { mode: "boolean" }).notNull().default(false), sms: integer("sms", { mode: "boolean" }).notNull().default(false),
  deliveryStatus: text("delivery_status").notNull().default("queued"), readAt: text("read_at"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  scheduledFor: text("scheduled_for").notNull().default(""),
}, (table) => [index("schedule_notification_employee_idx").on(table.employeeId, table.createdAt)]);

export const scheduleNotificationRules = sqliteTable("schedule_notification_rules", {
  eventType: text("event_type").primaryKey(),
  label: text("label").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  emailEnabled: integer("email_enabled", { mode: "boolean" }).notNull().default(true),
  smsEnabled: integer("sms_enabled", { mode: "boolean" }).notNull().default(false),
  deliveryTimings: text("delivery_timings").notNull().default('["immediate"]'),
  updatedBy: text("updated_by").notNull().default("System"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const dailyLogs = sqliteTable("daily_logs", {
  logDate: text("log_date").primaryKey(),
  shiftNotes: text("shift_notes").notNull().default(""),
  locked: integer("locked", { mode: "boolean" }).notNull().default(false),
  adminUnlocked: integer("admin_unlocked", { mode: "boolean" }).notNull().default(false),
  createdBy: text("created_by").notNull().default("System"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedBy: text("updated_by").notNull().default("System"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lockedBy: text("locked_by"),
  lockedAt: text("locked_at"),
});

export const dailyLogStaffing = sqliteTable("daily_log_staffing", {
  id: text("id").primaryKey(),
  logDate: text("log_date").notNull().references(() => dailyLogs.logDate),
  shiftKey: text("shift_key").notNull(),
  employeeId: text("employee_id").references(() => employees.id),
  timeIn: text("time_in").notNull().default(""),
  timeOut: text("time_out").notNull().default(""),
  actingOfficer: integer("acting_officer", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [index("log_staffing_date_shift_idx").on(table.logDate, table.shiftKey, table.sortOrder)]);

export const dailyLogCalls = sqliteTable("daily_log_calls", {
  id: text("id").primaryKey(),
  logDate: text("log_date").notNull().references(() => dailyLogs.logDate),
  reportNumber: text("report_number").notNull().default(""),
  timeOut: text("time_out").notNull().default(""),
  timeIn: text("time_in").notNull().default(""),
  respondingUnits: text("responding_units").notNull().default(""),
  address: text("address").notNull().default(""),
  callType: text("call_type").notNull().default("EMS"),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [index("log_calls_date_sort_idx").on(table.logDate, table.sortOrder)]);

export const dailyLogApprovals = sqliteTable("daily_log_approvals", {
  id: text("id").primaryKey(),
  logDate: text("log_date").notNull().references(() => dailyLogs.logDate),
  shiftKey: text("shift_key").notNull(),
  signInOfficerId: text("sign_in_officer_id").references(() => employees.id),
  signInAt: text("sign_in_at"),
  signInEquipment: text("sign_in_equipment").notNull().default("{}"),
  signInNote: text("sign_in_note").notNull().default(""),
  reviewedNotes: integer("reviewed_notes", { mode: "boolean" }).notNull().default(false),
  signOutOfficerId: text("sign_out_officer_id").references(() => employees.id),
  signOutAt: text("sign_out_at"),
  signOutEquipment: text("sign_out_equipment").notNull().default("{}"),
  signOutNote: text("sign_out_note").notNull().default(""),
}, (table) => [uniqueIndex("log_approval_date_shift_idx").on(table.logDate, table.shiftKey)]);

export const importantPhoneNumbers = sqliteTable("important_phone_numbers", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  name: text("name").notNull(),
  emergencyNumber: text("emergency_number").notNull().default(""),
  nonEmergencyNumber: text("non_emergency_number").notNull().default(""),
  notes: text("notes").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("important_phone_category_sort_idx").on(table.category, table.sortOrder)]);

export const policies = sqliteTable("policies", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  policyNumber: text("policy_number").notNull().default(""),
  category: text("category").notNull().default("General"),
  effectiveDate: text("effective_date").notNull().default(""),
  body: text("body").notNull().default(""),
  status: text("status").notNull().default("Active"),
  createdBy: text("created_by").notNull().default("System"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedBy: text("updated_by").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("policies_title_idx").on(table.title)]);

export const dailyDuties = sqliteTable("daily_duties", {
  id: text("id").primaryKey(),
  dayOfWeek: integer("day_of_week").notNull(),
  shiftKey: text("shift_key").notNull(),
  duty: text("duty").notNull().default(""),
  updatedBy: text("updated_by").notNull().default("System"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("daily_duties_day_shift_idx").on(table.dayOfWeek, table.shiftKey)]);

export const chiefBoardItems = sqliteTable("chief_board_items", {
  id: text("id").primaryKey(),
  itemType: text("item_type").notNull().default("note"),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  eventDate: text("event_date").notNull().default(""),
  startsAt: text("starts_at").notNull().default(""),
  endsAt: text("ends_at").notNull().default(""),
  expiresAt: text("expires_at").notNull().default(""),
  inviteStatus: text("invite_status").notNull().default(""),
  active: integer("active").notNull().default(1),
  createdBy: text("created_by").notNull().default("System"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("chief_board_active_date_idx").on(table.active, table.eventDate)]);

export const chiefBoardAttachments = sqliteTable("chief_board_attachments", {
  id: text("id").primaryKey(),
  itemId: text("item_id").notNull().references(() => chiefBoardItems.id),
  objectKey: text("object_key").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull().default("application/octet-stream"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("chief_board_attachment_item_idx").on(table.itemId)]);

export const systemMeta = sqliteTable("system_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const boxCards = sqliteTable("box_cards", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  address: text("address").notNull().default(""),
  boxNumber: text("box_number").notNull().default(""),
  accessNotes: text("access_notes").notNull().default(""),
  details: text("details").notNull().default(""),
  department: text("department").notNull().default("Stickney"),
  documentUrl: text("document_url").notNull().default(""),
  documentPage: integer("document_page").notNull().default(0),
  effectiveDate: text("effective_date").notNull().default(""),
  reviewDate: text("review_date").notNull().default(""),
  layoutData: text("layout_data").notNull().default(""),
  status: text("status").notNull().default("Active"),
  createdBy: text("created_by").notNull().default("System"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedBy: text("updated_by").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("box_cards_title_idx").on(table.title)]);

export const recordRevisions = sqliteTable("record_revisions", {
  id: text("id").primaryKey(),
  recordType: text("record_type").notNull(),
  recordId: text("record_id").notNull(),
  revisionNumber: integer("revision_number").notNull(),
  action: text("action").notNull(),
  summary: text("summary").notNull().default(""),
  actor: text("actor").notNull(),
  changedAt: text("changed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("record_revision_number_idx").on(table.recordType, table.recordId, table.revisionNumber)]);

export const incidentCommandBoards = sqliteTable("incident_command_boards", {
  incidentId: text("incident_id").primaryKey(),
  boardState: text("board_state").notNull().default("{}"),
  revision: integer("revision").notNull().default(0),
  updatedBy: text("updated_by").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const incidentCommandEvents = sqliteTable("incident_command_events", {
  id: text("id").primaryKey(),
  incidentId: text("incident_id").notNull(),
  revision: integer("revision").notNull(),
  eventType: text("event_type").notNull(),
  summary: text("summary").notNull().default(""),
  actor: text("actor").notNull(),
  eventPayload: text("event_payload").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("incident_command_event_revision_idx").on(table.incidentId, table.revision),
  index("incident_command_events_incident_time_idx").on(table.incidentId, table.createdAt),
]);

// ---------------------------------------------------------------------------
// Station Scheduler
//
// A ground-up replacement for the legacy schedule_* subsystem. Employees are
// reused from `employees`/`employee_profiles`; scheduler-specific attributes
// (multi-role, running hour counters, mandate history, notify preferences) live
// on employee_profiles as station_* columns. A ScheduleEntry is one shift
// instance on one date; each ShiftSlot is one required seat (role) that is open
// when employeeId is null.
// ---------------------------------------------------------------------------

export const stationShiftTypes = sqliteTable("station_shift_types", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  color: text("color").notNull().default("red"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: text("created_by").notNull().default("System"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("station_shift_types_active_idx").on(table.active, table.sortOrder)]);

export const stationShiftTypeRoles = sqliteTable("station_shift_type_roles", {
  id: text("id").primaryKey(),
  shiftTypeId: text("shift_type_id").notNull().references(() => stationShiftTypes.id),
  role: text("role").notNull(),
  count: integer("count").notNull().default(1),
}, (table) => [uniqueIndex("station_shift_type_role_idx").on(table.shiftTypeId, table.role)]);

export const stationScheduleEntries = sqliteTable("station_schedule_entries", {
  id: text("id").primaryKey(),
  entryDate: text("entry_date").notNull(),
  shiftTypeId: text("shift_type_id").notNull().references(() => stationShiftTypes.id),
  createdBy: text("created_by").notNull().default("System"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("station_schedule_entry_idx").on(table.entryDate, table.shiftTypeId),
  index("station_schedule_entry_date_idx").on(table.entryDate),
]);

export const stationShiftSlots = sqliteTable("station_shift_slots", {
  id: text("id").primaryKey(),
  entryId: text("entry_id").notNull().references(() => stationScheduleEntries.id),
  role: text("role").notNull(),
  employeeId: text("employee_id").references(() => employees.id),
  status: text("status").notNull().default("open"), // open | filled
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [
  index("station_shift_slot_entry_idx").on(table.entryId, table.sortOrder),
  index("station_shift_slot_employee_idx").on(table.employeeId),
]);

export const stationStandingAssignments = sqliteTable("station_standing_assignments", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  shiftTypeId: text("shift_type_id").notNull().references(() => stationShiftTypes.id),
  role: text("role").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdBy: text("created_by").notNull().default("System"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("station_standing_assignment_idx").on(table.employeeId, table.shiftTypeId, table.role)]);

export const stationTradeRequests = sqliteTable("station_trade_requests", {
  id: text("id").primaryKey(),
  slotId: text("slot_id").notNull().references(() => stationShiftSlots.id),
  role: text("role").notNull(),
  fromEmployeeId: text("from_employee_id").notNull().references(() => employees.id),
  targetEmployeeId: text("target_employee_id").references(() => employees.id), // null = broadcast to all eligible
  acceptedByEmployeeId: text("accepted_by_employee_id").references(() => employees.id),
  note: text("note").notNull().default(""),
  status: text("status").notNull().default("pending"), // pending | awaiting_acceptance | approved | denied
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
}, (table) => [index("station_trade_status_idx").on(table.status, table.createdAt)]);

export const stationShiftClaims = sqliteTable("station_shift_claims", {
  id: text("id").primaryKey(),
  slotId: text("slot_id").notNull().references(() => stationShiftSlots.id),
  role: text("role").notNull(),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  note: text("note").notNull().default(""),
  status: text("status").notNull().default("pending"), // pending | approved | denied
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  reviewedBy: text("reviewed_by"),
  reviewedAt: text("reviewed_at"),
}, (table) => [
  index("station_shift_claim_status_idx").on(table.status, table.createdAt),
  index("station_shift_claim_slot_idx").on(table.slotId),
]);

export const stationTimeOffRequests = sqliteTable("station_time_off_requests", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  type: text("type").notNull(), // vacation | recovery | floating | sick | official_business
  approverEmployeeId: text("approver_employee_id").notNull().references(() => employees.id),
  note: text("note").notNull().default(""),
  status: text("status").notNull().default("pending"), // pending | approved | denied
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  reviewedAt: text("reviewed_at"),
}, (table) => [index("station_time_off_status_idx").on(table.status, table.createdAt)]);

export const stationTimeOffDates = sqliteTable("station_time_off_dates", {
  requestId: text("request_id").notNull().references(() => stationTimeOffRequests.id),
  offDate: text("off_date").notNull(),
}, (table) => [uniqueIndex("station_time_off_date_idx").on(table.requestId, table.offDate)]);

// Date-aware unavailability: approved time off writes one row per off day so OT
// pool exemptions can exclude an employee on those specific days.
export const stationUnavailability = sqliteTable("station_unavailability", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  offDate: text("off_date").notNull(),
  source: text("source").notNull().default("time_off"), // time_off | manual
  requestId: text("request_id").references(() => stationTimeOffRequests.id),
}, (table) => [uniqueIndex("station_unavailability_idx").on(table.employeeId, table.offDate)]);

export const stationReminderRules = sqliteTable("station_reminder_rules", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // shift_request | request_deadline | open_shift_blast
  label: text("label").notNull().default(""),
  offsets: text("offsets").notNull().default("[]"),        // JSON string[] e.g. ["7 days before","2 days before"]
  emailEnabled: integer("email_enabled", { mode: "boolean" }).notNull().default(true),
  textEnabled: integer("text_enabled", { mode: "boolean" }).notNull().default(false),
  target: text("target").notNull().default(""),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const stationOtSettings = sqliteTable("station_ot_settings", {
  mode: text("mode").primaryKey(), // voluntary | mandatory
  exemptOffDuty: integer("exempt_off_duty", { mode: "boolean" }).notNull().default(true),
  exemptAlreadyScheduled: integer("exempt_already_scheduled", { mode: "boolean" }).notNull().default(true),
  exemptDeclined: integer("exempt_declined", { mode: "boolean" }).notNull().default(true),        // voluntary only
  exemptRecentlyMandated: integer("exempt_recently_mandated", { mode: "boolean" }).notNull().default(true), // mandatory only
  recentDays: integer("recent_days").notNull().default(14),                                        // mandatory only
  exemptMaxConsecutive: integer("exempt_max_consecutive", { mode: "boolean" }).notNull().default(true), // mandatory only
  maxConsecutive: integer("max_consecutive").notNull().default(2),                                 // mandatory only
  priorityOrder: text("priority_order").notNull().default("[]"),                                   // JSON string[] of criteria ids
  customRules: text("custom_rules").notNull().default("[]"),                                        // JSON [{id,label}]
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const stationOtTiming = sqliteTable("station_ot_timing", {
  id: integer("id").primaryKey(),
  awardDaysOut: integer("award_days_out").notNull().default(7),
  completeByDaysOut: integer("complete_by_days_out").notNull().default(2),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const stationOtInterest = sqliteTable("station_ot_interest", {
  id: text("id").primaryKey(),
  slotId: text("slot_id").notNull().references(() => stationShiftSlots.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  response: text("response").notNull(), // yes | no
  respondedAt: text("responded_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("station_ot_interest_idx").on(table.slotId, table.employeeId)]);

// A formal call-list entry once the award window is open. `declined` feeds the
// voluntary exemptDeclined filter; `mandated` records a mandatory assignment.
export const stationOtOffers = sqliteTable("station_ot_offers", {
  id: text("id").primaryKey(),
  slotId: text("slot_id").notNull().references(() => stationShiftSlots.id),
  employeeId: text("employee_id").notNull().references(() => employees.id),
  mode: text("mode").notNull(), // voluntary | mandatory
  status: text("status").notNull().default("offered"), // offered | accepted | declined | mandated
  rank: integer("rank").notNull().default(0),
  offeredAt: text("offered_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  respondedAt: text("responded_at"),
}, (table) => [
  index("station_ot_offer_slot_idx").on(table.slotId, table.rank),
  index("station_ot_offer_employee_idx").on(table.employeeId, table.status),
]);

export const stationDistributionWeights = sqliteTable("station_distribution_weights", {
  id: integer("id").primaryKey(),
  seniorityWeight: real("seniority_weight").notNull().default(1),
  hoursWeight: real("hours_weight").notNull().default(1),
  customWeight: real("custom_weight").notNull().default(0),
  customLabel: text("custom_label").notNull().default("Cross-trained"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
