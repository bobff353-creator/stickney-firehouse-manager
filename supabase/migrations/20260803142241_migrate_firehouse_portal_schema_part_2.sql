SET search_path TO firehouse, public;

CREATE INDEX IF NOT EXISTS inventory_compartments_apparatus_idx ON inventory_compartments(apparatus_id,sort_order);

CREATE TABLE IF NOT EXISTS "inventory_equipment" (
  "id" text NOT NULL PRIMARY KEY,
  "apparatus_id" text NOT NULL,
  "compartment_id" text,
  "name" text NOT NULL,
  "category" text DEFAULT '' NOT NULL,
  "manufacturer" text DEFAULT '' NOT NULL,
  "model" text DEFAULT '' NOT NULL,
  "serial_number" text DEFAULT '' NOT NULL,
  "asset_number" text DEFAULT '' NOT NULL,
  "barcode" text DEFAULT '' NOT NULL,
  "quantity" bigint DEFAULT 1 NOT NULL,
  "condition" text DEFAULT 'serviceable' NOT NULL,
  "service_status" text DEFAULT 'in_service' NOT NULL,
  "expiration_date" text DEFAULT '' NOT NULL,
  "inspection_date" text DEFAULT '' NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "retired_at" text,
  "created_by" text NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE INDEX IF NOT EXISTS inventory_equipment_apparatus_idx ON inventory_equipment(apparatus_id,compartment_id);

CREATE TABLE IF NOT EXISTS "inventory_hotspots" (
  "id" text NOT NULL PRIMARY KEY,
  "apparatus_id" text NOT NULL,
  "compartment_id" text NOT NULL,
  "photo_id" text NOT NULL,
  "x_basis_points" bigint NOT NULL,
  "y_basis_points" bigint NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE TABLE IF NOT EXISTS "inventory_photos" (
  "id" text NOT NULL PRIMARY KEY,
  "apparatus_id" text NOT NULL,
  "compartment_id" text,
  "equipment_id" text,
  "photo_type" text NOT NULL,
  "object_key" text NOT NULL,
  "filename" text NOT NULL,
  "content_type" text NOT NULL,
  "byte_size" bigint NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_photos_current_idx ON inventory_photos(apparatus_id,COALESCE(compartment_id,''),COALESCE(equipment_id,''),photo_type);

CREATE TABLE IF NOT EXISTS "inventory_readiness" (
  "id" text NOT NULL PRIMARY KEY,
  "apparatus_id" text NOT NULL,
  "status" text NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "checked_by" text NOT NULL,
  "checked_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE TABLE IF NOT EXISTS "inventory_weekly_check_items" (
  "id" text NOT NULL PRIMARY KEY,
  "template_id" text NOT NULL,
  "equipment_id" text,
  "label" text NOT NULL,
  "section_name" text NOT NULL,
  "sort_order" bigint DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "inventory_weekly_check_results" (
  "id" text NOT NULL PRIMARY KEY,
  "check_id" text NOT NULL,
  "item_id" text NOT NULL,
  "result" text NOT NULL,
  "notes" text DEFAULT '' NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_inventory_weekly_check_results_check_id_item_id" ON "inventory_weekly_check_results" ("check_id", "item_id");

CREATE TABLE IF NOT EXISTS "inventory_weekly_check_templates" (
  "id" text NOT NULL PRIMARY KEY,
  "apparatus_id" text NOT NULL,
  "name" text NOT NULL,
  "source" text DEFAULT '' NOT NULL,
  "active" bigint DEFAULT 1 NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE TABLE IF NOT EXISTS "inventory_weekly_checks" (
  "id" text NOT NULL PRIMARY KEY,
  "template_id" text NOT NULL,
  "apparatus_id" text NOT NULL,
  "status" text DEFAULT 'in_progress' NOT NULL,
  "performed_by" text NOT NULL,
  "started_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
  "completed_at" text,
  "notes" text DEFAULT '' NOT NULL
);

CREATE TABLE IF NOT EXISTS "pay_periods" (
  "start_date" text NOT NULL PRIMARY KEY,
  "end_date" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "created_by" text DEFAULT 'System' NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
  "updated_by" text DEFAULT 'System' NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
  "finalized_by" text,
  "finalized_at" text
);

CREATE TABLE IF NOT EXISTS "pay_rate_history" (
  "id" text NOT NULL PRIMARY KEY,
  "pay_scale_id" text NOT NULL,
  "effective_date" text NOT NULL,
  "regular_rate" double precision NOT NULL,
  "overtime_rate" double precision NOT NULL,
  "holiday_rate" double precision NOT NULL,
  "created_by" text DEFAULT 'System' NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE INDEX IF NOT EXISTS pay_rate_history_effective_idx ON pay_rate_history(effective_date);

CREATE UNIQUE INDEX IF NOT EXISTS pay_rate_history_scale_date_idx ON pay_rate_history(pay_scale_id, effective_date);

CREATE TABLE IF NOT EXISTS "pay_scales" (
  "id" text NOT NULL PRIMARY KEY,
  "label" text NOT NULL,
  "regular_rate" double precision NOT NULL,
  "overtime_rate" double precision NOT NULL,
  "holiday_rate" double precision NOT NULL,
  "sort_order" bigint DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "payroll_settings" (
  "id" bigint NOT NULL PRIMARY KEY,
  "overtime_threshold" double precision DEFAULT 106 NOT NULL,
  "acting_officer_premium" double precision DEFAULT 1 NOT NULL,
  "dpw_multiplier" double precision DEFAULT 1.5 NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE TABLE IF NOT EXISTS "policies" (
  "id" text NOT NULL PRIMARY KEY,
  "title" text NOT NULL,
  "policy_number" text DEFAULT '' NOT NULL,
  "category" text DEFAULT 'General' NOT NULL,
  "effective_date" text DEFAULT '' NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'Active' NOT NULL,
  "created_by" text DEFAULT 'System' NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
  "updated_by" text DEFAULT '' NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE INDEX IF NOT EXISTS policies_title_idx ON policies(title);

CREATE TABLE IF NOT EXISTS "rank_permissions" (
  "rank" text NOT NULL,
  "permission_key" text NOT NULL,
  "allowed" bigint DEFAULT 0 NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
  PRIMARY KEY ("rank", "permission_key")
);

CREATE TABLE IF NOT EXISTS "record_revisions" (
  "id" text NOT NULL PRIMARY KEY,
  "record_type" text NOT NULL,
  "record_id" text NOT NULL,
  "revision_number" bigint NOT NULL,
  "action" text NOT NULL,
  "summary" text DEFAULT '' NOT NULL,
  "actor" text NOT NULL,
  "changed_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS record_revision_number_idx ON record_revisions(record_type, record_id, revision_number);

CREATE TABLE IF NOT EXISTS "schedule_assignments" (
  "id" text NOT NULL PRIMARY KEY,
  "employee_id" text,
  "work_date" text NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "role" text NOT NULL,
  "source" text DEFAULT 'manual' NOT NULL,
  "rotation_id" text,
  "status" text DEFAULT 'assigned' NOT NULL,
  "emergency" bigint DEFAULT 0 NOT NULL,
  "required_rank" text DEFAULT '' NOT NULL,
  "claim_deadline" text DEFAULT '' NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE INDEX IF NOT EXISTS schedule_assignment_date_idx ON schedule_assignments(work_date);

CREATE UNIQUE INDEX IF NOT EXISTS schedule_assignment_unique_idx ON schedule_assignments(employee_id, work_date, start_time, role);

CREATE TABLE IF NOT EXISTS "schedule_coverage_rules" (
  "id" text NOT NULL PRIMARY KEY,
  "plan_id" text DEFAULT '' NOT NULL,
  "name" text NOT NULL,
  "role" text NOT NULL,
  "minimum_staff" bigint NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "days_of_week" text DEFAULT '0,1,2,3,4,5,6' NOT NULL,
  "active" bigint DEFAULT 1 NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE INDEX IF NOT EXISTS schedule_coverage_rule_active_idx ON schedule_coverage_rules(active, role);

CREATE TABLE IF NOT EXISTS "schedule_notification_rules" (
  "event_type" text NOT NULL PRIMARY KEY,
  "label" text NOT NULL,
  "active" bigint DEFAULT 1 NOT NULL,
  "email_enabled" bigint DEFAULT 1 NOT NULL,
  "sms_enabled" bigint DEFAULT 0 NOT NULL,
  "delivery_timings" text DEFAULT '["immediate"]' NOT NULL,
  "updated_by" text DEFAULT 'System' NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE TABLE IF NOT EXISTS "schedule_notifications" (
  "id" text NOT NULL PRIMARY KEY,
  "employee_id" text NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "in_app" bigint DEFAULT 1 NOT NULL,
  "event_type" text DEFAULT 'general' NOT NULL,
  "email" bigint DEFAULT 0 NOT NULL,
  "sms" bigint DEFAULT 0 NOT NULL,
  "delivery_status" text DEFAULT 'queued' NOT NULL,
  "read_at" text,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
  "scheduled_for" text DEFAULT '' NOT NULL
);

CREATE INDEX IF NOT EXISTS schedule_notification_employee_idx ON schedule_notifications(employee_id, created_at);

CREATE TABLE IF NOT EXISTS "schedule_requests" (
  "id" text NOT NULL PRIMARY KEY,
  "request_type" text NOT NULL,
  "employee_id" text NOT NULL,
  "assignment_id" text,
  "target_employee_id" text,
  "start_date" text NOT NULL,
  "end_date" text NOT NULL,
  "start_time" text DEFAULT '' NOT NULL,
  "end_time" text DEFAULT '' NOT NULL,
  "role" text DEFAULT '' NOT NULL,
  "repeat_mode" text DEFAULT 'none' NOT NULL,
  "repeat_interval" bigint DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "target_status" text DEFAULT 'not_required' NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "reviewed_by" text,
  "reviewed_at" text,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE INDEX IF NOT EXISTS schedule_request_status_idx ON schedule_requests(status, created_at);

CREATE TABLE IF NOT EXISTS "schedule_rotation_members" (
  "rotation_id" text NOT NULL,
  "employee_id" text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_schedule_rotation_members_rotation_id_employee_id" ON "schedule_rotation_members" ("rotation_id", "employee_id");

CREATE TABLE IF NOT EXISTS "schedule_rotations" (
  "id" text NOT NULL PRIMARY KEY,
  "name" text NOT NULL,
  "start_date" text NOT NULL,
  "end_date" text NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "cycle_days" bigint NOT NULL,
  "duty_days" text NOT NULL,
  "role" text NOT NULL,
  "coverage_plan_id" text DEFAULT '' NOT NULL,
  "active" bigint DEFAULT 1 NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE TABLE IF NOT EXISTS "schedule_shift_patterns" (
  "id" text NOT NULL PRIMARY KEY,
  "name" text NOT NULL,
  "color" text DEFAULT 'red' NOT NULL,
  "start_date" text NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "recurrence_days" bigint NOT NULL,
  "coverage_plan_id" text NOT NULL,
  "active" bigint DEFAULT 1 NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE INDEX IF NOT EXISTS schedule_shift_pattern_active_idx ON schedule_shift_patterns(active, start_date);

CREATE TABLE IF NOT EXISTS "schedule_staffing_overrides" (
  "id" text NOT NULL PRIMARY KEY,
  "pattern_id" text NOT NULL,
  "name" text NOT NULL,
  "condition_type" text NOT NULL,
  "role" text NOT NULL,
  "minimum_staff" bigint NOT NULL,
  "active" bigint DEFAULT 1 NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE INDEX IF NOT EXISTS schedule_staffing_override_pattern_idx ON schedule_staffing_overrides(pattern_id, active);

CREATE TABLE IF NOT EXISTS "system_meta" (
  "key" text NOT NULL PRIMARY KEY,
  "value" text NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE TABLE IF NOT EXISTS "time_entries" (
  "id" text NOT NULL PRIMARY KEY,
  "employee_id" text NOT NULL,
  "period_start" text NOT NULL,
  "work_date" text NOT NULL,
  "category" text NOT NULL,
  "hours" double precision DEFAULT 0 NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS entry_employee_date_category_idx ON time_entries(employee_id, work_date, category);

CREATE INDEX IF NOT EXISTS entry_period_employee_idx ON time_entries(period_start, employee_id);

CREATE TABLE IF NOT EXISTS "work_detail_members" (
  "request_id" text NOT NULL,
  "employee_id" text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_work_detail_members_request_id_employee_id" ON "work_detail_members" ("request_id", "employee_id");

CREATE TABLE IF NOT EXISTS "work_detail_postings" (
  "request_id" text NOT NULL,
  "employee_id" text NOT NULL,
  "hours" double precision NOT NULL,
  "posted_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_work_detail_postings_request_id_employee_id" ON "work_detail_postings" ("request_id", "employee_id");

CREATE TABLE IF NOT EXISTS "work_detail_requests" (
  "id" text NOT NULL PRIMARY KEY,
  "work_date" text NOT NULL,
  "requesting_officer_id" text NOT NULL,
  "approver_id" text NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "total_hours" double precision NOT NULL,
  "work_type" text NOT NULL,
  "description" text NOT NULL,
  "certified" bigint DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "submitted_by" text NOT NULL,
  "submitted_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
  "approved_by" text,
  "approved_at" text,
  "rejection_note" text DEFAULT '' NOT NULL
);

CREATE INDEX IF NOT EXISTS work_detail_status_date_idx ON work_detail_requests(status, work_date);

RESET search_path;
