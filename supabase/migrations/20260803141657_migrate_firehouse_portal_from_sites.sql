CREATE SCHEMA IF NOT EXISTS firehouse;

REVOKE ALL ON SCHEMA firehouse FROM PUBLIC;

GRANT USAGE ON SCHEMA firehouse TO authenticated;

SET search_path TO firehouse, public;

CREATE TABLE IF NOT EXISTS "box_cards" (
  "id" text NOT NULL PRIMARY KEY,
  "title" text NOT NULL,
  "address" text DEFAULT '' NOT NULL,
  "box_number" text DEFAULT '' NOT NULL,
  "access_notes" text DEFAULT '' NOT NULL,
  "details" text DEFAULT '' NOT NULL,
  "department" text DEFAULT 'Stickney' NOT NULL,
  "document_url" text DEFAULT '' NOT NULL,
  "document_page" bigint DEFAULT 0 NOT NULL,
  "effective_date" text DEFAULT '' NOT NULL,
  "review_date" text DEFAULT '' NOT NULL,
  "layout_data" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'Active' NOT NULL,
  "created_by" text DEFAULT 'System' NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
  "updated_by" text DEFAULT '' NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE INDEX IF NOT EXISTS box_cards_title_idx ON box_cards(title);

CREATE TABLE IF NOT EXISTS "cad_inbound_receipts" (
  "id" text NOT NULL PRIMARY KEY,
  "provider" text NOT NULL,
  "dedupe_key" text NOT NULL,
  "external_event_id" text DEFAULT '' NOT NULL,
  "external_incident_id" text DEFAULT '' NOT NULL,
  "event_type" text DEFAULT '' NOT NULL,
  "payload_format" text DEFAULT '' NOT NULL,
  "raw_payload" text NOT NULL,
  "normalized_payload" text DEFAULT '{}' NOT NULL,
  "status" text NOT NULL,
  "error_message" text DEFAULT '' NOT NULL,
  "duplicate_of" text,
  "received_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
  "processed_at" text
);

CREATE UNIQUE INDEX IF NOT EXISTS cad_inbound_provider_dedupe_idx ON cad_inbound_receipts(provider, dedupe_key);

CREATE INDEX IF NOT EXISTS cad_inbound_provider_received_idx ON cad_inbound_receipts(provider, received_at);

CREATE TABLE IF NOT EXISTS "chief_board_attachments" (
  "id" text NOT NULL PRIMARY KEY,
  "item_id" text NOT NULL,
  "object_key" text NOT NULL,
  "filename" text NOT NULL,
  "content_type" text DEFAULT 'application/octet-stream' NOT NULL,
  "size_bytes" bigint DEFAULT 0 NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE INDEX IF NOT EXISTS chief_board_attachment_item_idx ON chief_board_attachments(item_id);

CREATE TABLE IF NOT EXISTS "chief_board_items" (
  "id" text NOT NULL PRIMARY KEY,
  "item_type" text DEFAULT 'note' NOT NULL,
  "title" text NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "event_date" text DEFAULT '' NOT NULL,
  "starts_at" text DEFAULT '' NOT NULL,
  "ends_at" text DEFAULT '' NOT NULL,
  "expires_at" text DEFAULT '' NOT NULL,
  "invite_status" text DEFAULT '' NOT NULL,
  "active" bigint DEFAULT 1 NOT NULL,
  "created_by" text DEFAULT 'System' NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE INDEX IF NOT EXISTS chief_board_active_date_idx ON chief_board_items(active, event_date);

CREATE TABLE IF NOT EXISTS "daily_duties" (
  "id" text NOT NULL PRIMARY KEY,
  "day_of_week" bigint NOT NULL,
  "shift_key" text NOT NULL,
  "duty" text DEFAULT '' NOT NULL,
  "updated_by" text DEFAULT 'System' NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS daily_duties_day_shift_idx ON daily_duties(day_of_week, shift_key);

CREATE TABLE IF NOT EXISTS "daily_log_approvals" (
  "id" text NOT NULL PRIMARY KEY,
  "log_date" text NOT NULL,
  "shift_key" text NOT NULL,
  "sign_in_officer_id" text,
  "sign_in_at" text,
  "sign_in_equipment" text DEFAULT '{}' NOT NULL,
  "sign_in_note" text DEFAULT '' NOT NULL,
  "reviewed_notes" bigint DEFAULT 0 NOT NULL,
  "sign_out_officer_id" text,
  "sign_out_at" text,
  "sign_out_equipment" text DEFAULT '{}' NOT NULL,
  "sign_out_note" text DEFAULT '' NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS log_approval_date_shift_idx ON daily_log_approvals(log_date, shift_key);

CREATE TABLE IF NOT EXISTS "daily_log_calls" (
  "id" text NOT NULL PRIMARY KEY,
  "log_date" text NOT NULL,
  "report_number" text DEFAULT '' NOT NULL,
  "time_out" text DEFAULT '' NOT NULL,
  "time_in" text DEFAULT '' NOT NULL,
  "responding_units" text DEFAULT '' NOT NULL,
  "address" text DEFAULT '' NOT NULL,
  "call_type" text DEFAULT 'EMS' NOT NULL,
  "sort_order" bigint DEFAULT 0 NOT NULL
);

CREATE INDEX IF NOT EXISTS log_calls_date_sort_idx ON daily_log_calls(log_date, sort_order);

CREATE TABLE IF NOT EXISTS "daily_log_staffing" (
  "id" text NOT NULL PRIMARY KEY,
  "log_date" text NOT NULL,
  "shift_key" text NOT NULL,
  "employee_id" text,
  "time_in" text DEFAULT '' NOT NULL,
  "time_out" text DEFAULT '' NOT NULL,
  "acting_officer" bigint DEFAULT 0 NOT NULL,
  "sort_order" bigint DEFAULT 0 NOT NULL
);

CREATE INDEX IF NOT EXISTS log_staffing_date_shift_idx ON daily_log_staffing(log_date, shift_key, sort_order);

CREATE TABLE IF NOT EXISTS "daily_logs" (
  "log_date" text NOT NULL PRIMARY KEY,
  "shift_notes" text DEFAULT '' NOT NULL,
  "locked" bigint DEFAULT 0 NOT NULL,
  "admin_unlocked" bigint DEFAULT 0 NOT NULL,
  "created_by" text DEFAULT 'System' NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
  "updated_by" text DEFAULT 'System' NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
  "locked_by" text,
  "locked_at" text
);

CREATE TABLE IF NOT EXISTS "dispatch_incidents" (
  "incident_id" text NOT NULL PRIMARY KEY,
  "resend_email_id" text NOT NULL,
  "call_type" text NOT NULL,
  "category" text DEFAULT '' NOT NULL,
  "address" text DEFAULT '' NOT NULL,
  "city" text DEFAULT '' NOT NULL,
  "narrative" text DEFAULT '' NOT NULL,
  "responding_units" text DEFAULT '' NOT NULL,
  "longitude" double precision,
  "latitude" double precision,
  "dispatched_at" text NOT NULL,
  "time_out" text DEFAULT '' NOT NULL,
  "attachment_count" bigint DEFAULT 0 NOT NULL,
  "source_payload" text DEFAULT '{}' NOT NULL,
  "source_system" text DEFAULT 'CAD email' NOT NULL,
  "received_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
  "cleared_at" text,
  "active" bigint DEFAULT 1 NOT NULL
);

CREATE INDEX IF NOT EXISTS dispatch_incidents_active_time_idx ON dispatch_incidents(active, dispatched_at);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_dispatch_incidents_resend_email_id" ON "dispatch_incidents" ("resend_email_id");

CREATE TABLE IF NOT EXISTS "employee_permission_overrides" (
  "employee_id" text NOT NULL,
  "permission_key" text NOT NULL,
  "effect" text NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
  PRIMARY KEY ("employee_id", "permission_key")
);

CREATE TABLE IF NOT EXISTS "employee_profiles" (
  "employee_id" text NOT NULL PRIMARY KEY,
  "employee_number" text,
  "start_date" text,
  "end_date" text,
  "date_of_birth" text,
  "phone" text,
  "email" text,
  "schedule_sms_opt_in" bigint DEFAULT 0 NOT NULL,
  "address_line_1" text,
  "city" text,
  "state" text,
  "postal_code" text,
  "employment_type" text DEFAULT 'Part-time' NOT NULL,
  "is_dpw" bigint DEFAULT 0 NOT NULL,
  "driver_status" text DEFAULT '' NOT NULL,
  "acting_officer_eligible" bigint DEFAULT 0 NOT NULL,
  "is_admin" bigint DEFAULT 0 NOT NULL,
  "emergency_name" text,
  "emergency_relationship" text,
  "emergency_phone" text,
  "photo_updated_at" text,
  "notes" text,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS employee_profiles_number_idx ON employee_profiles(employee_number);

CREATE TABLE IF NOT EXISTS "employees" (
  "id" text NOT NULL PRIMARY KEY,
  "name" text NOT NULL,
  "pay_scale_id" text NOT NULL,
  "active" bigint DEFAULT 1 NOT NULL,
  "sort_order" bigint DEFAULT 0 NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE INDEX IF NOT EXISTS employees_active_sort_idx ON employees(active, sort_order);

CREATE TABLE IF NOT EXISTS "field_hydrant_flow_tests" (
  "id" text NOT NULL PRIMARY KEY,
  "test_hydrant_id" text NOT NULL,
  "flow_hydrant_id" text,
  "tested_at" text NOT NULL,
  "static_pressure" double precision NOT NULL,
  "residual_pressure" double precision NOT NULL,
  "desired_residual" double precision DEFAULT 20 NOT NULL,
  "outlet_diameter" double precision NOT NULL,
  "pitot_pressure" double precision NOT NULL,
  "discharge_coefficient" double precision NOT NULL,
  "measured_flow" double precision NOT NULL,
  "available_flow" double precision NOT NULL,
  "tested_by" text NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE INDEX IF NOT EXISTS field_hydrant_test_hydrant_idx ON field_hydrant_flow_tests(test_hydrant_id,tested_at);

CREATE TABLE IF NOT EXISTS "field_hydrant_flushes" (
  "id" text NOT NULL PRIMARY KEY,
  "hydrant_id" text NOT NULL,
  "flushed_at" text NOT NULL,
  "flushed_by" text NOT NULL,
  "water_clear" bigint DEFAULT 0 NOT NULL,
  "issues" text DEFAULT '' NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE INDEX IF NOT EXISTS field_hydrant_flush_hydrant_idx ON field_hydrant_flushes(hydrant_id,flushed_at);

CREATE TABLE IF NOT EXISTS "field_hydrants" (
  "id" text NOT NULL PRIMARY KEY,
  "hydrant_number" text DEFAULT '' NOT NULL,
  "address" text DEFAULT '' NOT NULL,
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  "service_status" text DEFAULT 'in_service' NOT NULL,
  "manufacturer" text DEFAULT '' NOT NULL,
  "model" text DEFAULT '' NOT NULL,
  "port_count" bigint DEFAULT 2 NOT NULL,
  "port_sizes" text DEFAULT '[]' NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE INDEX IF NOT EXISTS field_hydrant_location_idx ON field_hydrants(latitude,longitude);

CREATE UNIQUE INDEX IF NOT EXISTS field_hydrant_number_idx ON field_hydrants(hydrant_number) WHERE hydrant_number<>'';

CREATE TABLE IF NOT EXISTS "field_preplan_features" (
  "id" text NOT NULL PRIMARY KEY,
  "preplan_id" text NOT NULL,
  "feature_type" text NOT NULL,
  "label" text DEFAULT '' NOT NULL,
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  "system_type" text DEFAULT '' NOT NULL,
  "service_status" text DEFAULT 'in_service' NOT NULL,
  "details" text DEFAULT '' NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE INDEX IF NOT EXISTS field_preplan_feature_preplan_idx ON field_preplan_features(preplan_id);

CREATE TABLE IF NOT EXISTS "field_preplan_imports" (
  "id" text NOT NULL PRIMARY KEY,
  "business_name" text NOT NULL,
  "address" text NOT NULL,
  "source_file" text NOT NULL,
  "source_row" bigint NOT NULL,
  "status" text DEFAULT 'location_required' NOT NULL,
  "latitude" double precision,
  "longitude" double precision,
  "geocode_note" text DEFAULT '' NOT NULL,
  "linked_preplan_id" text,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE INDEX IF NOT EXISTS field_preplan_import_status_idx ON field_preplan_imports(status,business_name);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_field_preplan_imports_source_file_source_row" ON "field_preplan_imports" ("source_file", "source_row");

CREATE TABLE IF NOT EXISTS "field_preplan_photos" (
  "id" text NOT NULL PRIMARY KEY,
  "preplan_id" text NOT NULL,
  "feature_id" text,
  "side" text DEFAULT '' NOT NULL,
  "object_key" text NOT NULL,
  "filename" text NOT NULL,
  "content_type" text DEFAULT 'image/jpeg' NOT NULL,
  "size_bytes" bigint DEFAULT 0 NOT NULL,
  "caption" text DEFAULT '' NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE INDEX IF NOT EXISTS field_preplan_photo_preplan_idx ON field_preplan_photos(preplan_id);

CREATE TABLE IF NOT EXISTS "field_preplans" (
  "id" text NOT NULL PRIMARY KEY,
  "business_name" text NOT NULL,
  "address" text DEFAULT '' NOT NULL,
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  "a_side_latitude" double precision,
  "a_side_longitude" double precision,
  "footprint" text DEFAULT '[]' NOT NULL,
  "footprint_square_feet" double precision DEFAULT 0 NOT NULL,
  "floor_count" bigint DEFAULT 1 NOT NULL,
  "fire_flow_calculation_area" double precision DEFAULT 0 NOT NULL,
  "construction_type" text DEFAULT 'VB' NOT NULL,
  "occupancy_flow_category" text DEFAULT 'other' NOT NULL,
  "sprinkler_standard" text DEFAULT 'none' NOT NULL,
  "suggested_fire_flow_gpm" double precision DEFAULT 0 NOT NULL,
  "suggested_fire_flow_duration" double precision DEFAULT 0 NOT NULL,
  "contact_info" text DEFAULT '' NOT NULL,
  "construction" text DEFAULT '' NOT NULL,
  "access_info" text DEFAULT '' NOT NULL,
  "alarm_system" text DEFAULT '' NOT NULL,
  "knox_box" text DEFAULT '' NOT NULL,
  "riser" text DEFAULT '' NOT NULL,
  "fdc" text DEFAULT '' NOT NULL,
  "sprinkler_system" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'Quick Preplan' NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE INDEX IF NOT EXISTS field_preplan_location_idx ON field_preplans(latitude,longitude);

CREATE TABLE IF NOT EXISTS "fleet_apparatus" (
  "id" text NOT NULL PRIMARY KEY,
  "unit_number" text NOT NULL,
  "name" text NOT NULL,
  "asset_type" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'in_service' NOT NULL,
  "manufacturer" text DEFAULT '' NOT NULL,
  "model" text DEFAULT '' NOT NULL,
  "year" bigint,
  "vin" text DEFAULT '' NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "retired_at" text,
  "created_by" text NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_fleet_apparatus_unit_number" ON "fleet_apparatus" ("unit_number");

CREATE TABLE IF NOT EXISTS "important_phone_numbers" (
  "id" text NOT NULL PRIMARY KEY,
  "category" text NOT NULL,
  "name" text NOT NULL,
  "emergency_number" text DEFAULT '' NOT NULL,
  "non_emergency_number" text DEFAULT '' NOT NULL,
  "notes" text DEFAULT '' NOT NULL,
  "sort_order" bigint DEFAULT 0 NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE INDEX IF NOT EXISTS important_phone_category_sort_idx ON important_phone_numbers(category, sort_order);

CREATE TABLE IF NOT EXISTS "incident_command_boards" (
  "incident_id" text NOT NULL PRIMARY KEY,
  "board_state" text DEFAULT '{}' NOT NULL,
  "revision" bigint DEFAULT 0 NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE TABLE IF NOT EXISTS "incident_command_events" (
  "id" text NOT NULL PRIMARY KEY,
  "incident_id" text NOT NULL,
  "revision" bigint NOT NULL,
  "event_type" text NOT NULL,
  "summary" text DEFAULT '' NOT NULL,
  "actor" text NOT NULL,
  "event_payload" text DEFAULT '{}' NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS incident_command_event_revision_idx ON incident_command_events(incident_id,revision);

CREATE INDEX IF NOT EXISTS incident_command_events_incident_time_idx ON incident_command_events(incident_id,created_at);

CREATE TABLE IF NOT EXISTS "inventory_audit_events" (
  "id" text NOT NULL PRIMARY KEY,
  "actor" text NOT NULL,
  "action" text NOT NULL,
  "record_type" text NOT NULL,
  "record_id" text NOT NULL,
  "summary" text NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

CREATE TABLE IF NOT EXISTS "inventory_compartments" (
  "id" text NOT NULL PRIMARY KEY,
  "apparatus_id" text NOT NULL,
  "label" text NOT NULL,
  "side" text DEFAULT '' NOT NULL,
  "details" text DEFAULT '' NOT NULL,
  "sort_order" bigint DEFAULT 0 NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text DEFAULT (CURRENT_TIMESTAMP::text) NOT NULL
);

RESET search_path;
