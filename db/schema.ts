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
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
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
