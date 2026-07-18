import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const payScales = sqliteTable("pay_scales", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  regularRate: real("regular_rate").notNull(),
  overtimeRate: real("overtime_rate").notNull(),
  holidayRate: real("holiday_rate").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

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
  addressLine1: text("address_line_1"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  employmentType: text("employment_type").notNull().default("Part-time"),
  isDpw: integer("is_dpw", { mode: "boolean" }).notNull().default(false),
  driverStatus: text("driver_status").notNull().default(""),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  emergencyName: text("emergency_name"),
  emergencyRelationship: text("emergency_relationship"),
  emergencyPhone: text("emergency_phone"),
  notes: text("notes"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("employee_profiles_number_idx").on(table.employeeNumber)]);

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
