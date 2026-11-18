BEGIN;

SET LOCAL check_function_bodies = off;

SET LOCAL search_path = public;

CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE SCHEMA IF NOT EXISTS "department_gateway";

CREATE SCHEMA IF NOT EXISTS "firehouse";

CREATE SCHEMA IF NOT EXISTS "private";

CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "public"."department_role" AS ENUM ('admin', 'chief', 'inspector', 'user', 'preplan_user');

CREATE TYPE "public"."invite_status" AS ENUM ('pending', 'accepted', 'revoked', 'expired');

CREATE TYPE "public"."membership_status" AS ENUM ('active', 'invited', 'disabled');

CREATE TABLE "firehouse"."apparatus_location_view_leases" (
  "department_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "topic" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);

CREATE TABLE "firehouse"."apparatus_trackers" (
  "department_id" uuid NOT NULL,
  "apparatus_id" text NOT NULL,
  "device_id" uuid NOT NULL,
  "token_hash" text,
  "device_name" text NOT NULL,
  "sender_kind" text NOT NULL,
  "enabled" boolean NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "latitude" double precision,
  "longitude" double precision,
  "accuracy" double precision,
  "fix_at" timestamp with time zone,
  "received_at" timestamp with time zone,
  "moving" boolean NOT NULL,
  "sequence" bigint NOT NULL,
  "paired_by" text NOT NULL,
  "paired_at" timestamp with time zone NOT NULL
);

CREATE TABLE "firehouse"."background_job_runs" (
  "id" text NOT NULL,
  "job_name" text NOT NULL,
  "status" text NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "finished_at" timestamp with time zone,
  "summary" text
);

CREATE TABLE "firehouse"."board_feed_cache" (
  "source" text NOT NULL,
  "payload" jsonb,
  "last_success_at" timestamp with time zone,
  "last_attempt_at" timestamp with time zone,
  "attempted_slot" timestamp with time zone,
  "attempt_id" uuid,
  "next_scheduled_at" timestamp with time zone,
  "status" text NOT NULL,
  "error_code" text
);

CREATE TABLE "firehouse"."box_cards" (
  "id" text NOT NULL,
  "title" text NOT NULL,
  "address" text NOT NULL,
  "box_number" text NOT NULL,
  "access_notes" text NOT NULL,
  "details" text NOT NULL,
  "department" text NOT NULL,
  "document_url" text NOT NULL,
  "document_page" bigint NOT NULL,
  "effective_date" text NOT NULL,
  "review_date" text NOT NULL,
  "layout_data" text NOT NULL,
  "status" text NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."cad_inbound_receipts" (
  "id" text NOT NULL,
  "provider" text NOT NULL,
  "dedupe_key" text NOT NULL,
  "external_event_id" text NOT NULL,
  "external_incident_id" text NOT NULL,
  "event_type" text NOT NULL,
  "payload_format" text NOT NULL,
  "raw_payload" text NOT NULL,
  "normalized_payload" text NOT NULL,
  "status" text NOT NULL,
  "error_message" text NOT NULL,
  "duplicate_of" text,
  "received_at" text NOT NULL,
  "processed_at" text
);

CREATE TABLE "firehouse"."cad_push_deliveries" (
  "id" uuid NOT NULL,
  "event_id" uuid NOT NULL,
  "subscription_id" text NOT NULL,
  "recipient_id" text NOT NULL,
  "credential_fingerprint" text NOT NULL,
  "state" text NOT NULL,
  "attempts" integer NOT NULL,
  "next_attempt_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "lease_token" uuid,
  "accepted_at" timestamp with time zone,
  "last_status_code" integer
);

CREATE TABLE "firehouse"."cad_push_events" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "incident_id" text NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);

CREATE TABLE "firehouse"."callback_payroll_aggregates" (
  "employee_id" text NOT NULL,
  "work_date" text NOT NULL,
  "manual_baseline_hours" double precision NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

CREATE TABLE "firehouse"."callback_review_settings" (
  "id" text NOT NULL,
  "reviewer_employee_id" text NOT NULL,
  "rules_json" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

CREATE TABLE "firehouse"."chief_board_attachments" (
  "id" text NOT NULL,
  "item_id" text NOT NULL,
  "object_key" text NOT NULL,
  "filename" text NOT NULL,
  "content_type" text NOT NULL,
  "size_bytes" bigint NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."chief_board_items" (
  "id" text NOT NULL,
  "item_type" text NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "event_date" text NOT NULL,
  "starts_at" text NOT NULL,
  "ends_at" text NOT NULL,
  "expires_at" text NOT NULL,
  "invite_status" text NOT NULL,
  "active" bigint NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "officer_employee_id" text,
  "officer_name" text NOT NULL
);

CREATE TABLE "firehouse"."daily_duties" (
  "id" text NOT NULL,
  "day_of_week" bigint NOT NULL,
  "shift_key" text NOT NULL,
  "duty" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."daily_log_approvals" (
  "id" text NOT NULL,
  "log_date" text NOT NULL,
  "shift_key" text NOT NULL,
  "sign_in_officer_id" text,
  "sign_in_at" text,
  "sign_in_equipment" text NOT NULL,
  "sign_in_note" text NOT NULL,
  "reviewed_notes" bigint NOT NULL,
  "sign_out_officer_id" text,
  "sign_out_at" text,
  "sign_out_equipment" text NOT NULL,
  "sign_out_note" text NOT NULL,
  "fleet_duties_acknowledged" integer NOT NULL
);

CREATE TABLE "firehouse"."daily_log_callback_submissions" (
  "id" text NOT NULL,
  "log_date" text NOT NULL,
  "call_id" text NOT NULL,
  "report_number" text NOT NULL,
  "employee_id" text NOT NULL,
  "reviewer_employee_id" text NOT NULL,
  "status" text NOT NULL,
  "submitted_by" text NOT NULL,
  "submitted_at" timestamp with time zone NOT NULL,
  "reviewed_by" text,
  "reviewed_at" timestamp with time zone,
  "review_note" text NOT NULL,
  "call_type" text NOT NULL,
  "call_time_out" text NOT NULL,
  "call_time_in" text NOT NULL,
  "rule_version" text NOT NULL,
  "rule_matches" text NOT NULL,
  "rule_flags" text NOT NULL,
  "suggested_hours" double precision NOT NULL,
  "actual_minutes" integer,
  "approved_hours" double precision NOT NULL,
  "submitted_by_employee_id" text,
  "submitted_by_rank" text NOT NULL
);

CREATE TABLE "firehouse"."daily_log_calls" (
  "id" text NOT NULL,
  "log_date" text NOT NULL,
  "report_number" text NOT NULL,
  "time_out" text NOT NULL,
  "time_in" text NOT NULL,
  "responding_units" text NOT NULL,
  "address" text NOT NULL,
  "call_type" text NOT NULL,
  "sort_order" bigint NOT NULL
);

CREATE TABLE "firehouse"."daily_log_staffing" (
  "id" text NOT NULL,
  "log_date" text NOT NULL,
  "shift_key" text NOT NULL,
  "employee_id" text,
  "time_in" text NOT NULL,
  "time_out" text NOT NULL,
  "acting_officer" bigint NOT NULL,
  "sort_order" bigint NOT NULL,
  "time_in_instant" text NOT NULL,
  "time_out_instant" text NOT NULL
);

CREATE TABLE "firehouse"."daily_logs" (
  "log_date" text NOT NULL,
  "shift_notes" text NOT NULL,
  "locked" bigint NOT NULL,
  "admin_unlocked" bigint NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL,
  "locked_by" text,
  "locked_at" text,
  "save_version" bigint NOT NULL
);

CREATE TABLE "firehouse"."dispatch_incidents" (
  "incident_id" text NOT NULL,
  "resend_email_id" text NOT NULL,
  "call_type" text NOT NULL,
  "category" text NOT NULL,
  "address" text NOT NULL,
  "city" text NOT NULL,
  "narrative" text NOT NULL,
  "responding_units" text NOT NULL,
  "longitude" double precision,
  "latitude" double precision,
  "dispatched_at" text NOT NULL,
  "time_out" text NOT NULL,
  "attachment_count" bigint NOT NULL,
  "source_payload" text NOT NULL,
  "source_system" text NOT NULL,
  "received_at" text NOT NULL,
  "cleared_at" text,
  "active" bigint NOT NULL
);

CREATE TABLE "firehouse"."employee_account_links" (
  "user_id" uuid NOT NULL,
  "employee_id" text NOT NULL,
  "linked_at" timestamp with time zone NOT NULL,
  "linked_by" text NOT NULL
);

CREATE TABLE "firehouse"."employee_permission_overrides" (
  "employee_id" text NOT NULL,
  "permission_key" text NOT NULL,
  "effect" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."employee_profiles" (
  "employee_id" text NOT NULL,
  "employee_number" text,
  "start_date" text,
  "end_date" text,
  "date_of_birth" text,
  "phone" text,
  "email" text,
  "schedule_sms_opt_in" bigint NOT NULL,
  "address_line_1" text,
  "city" text,
  "state" text,
  "postal_code" text,
  "employment_type" text NOT NULL,
  "is_dpw" bigint NOT NULL,
  "driver_status" text NOT NULL,
  "acting_officer_eligible" bigint NOT NULL,
  "is_admin" bigint NOT NULL,
  "emergency_name" text,
  "emergency_relationship" text,
  "emergency_phone" text,
  "photo_updated_at" text,
  "notes" text,
  "updated_at" text NOT NULL,
  "station_roles" text NOT NULL,
  "station_hours_this_period" double precision NOT NULL,
  "station_ot_hours" double precision NOT NULL,
  "station_mandatory_hours" double precision NOT NULL,
  "station_off_duty" integer NOT NULL,
  "station_last_mandated" text NOT NULL,
  "station_consecutive_mandatory" integer NOT NULL,
  "station_notify_email" integer NOT NULL,
  "station_notify_text" integer NOT NULL,
  "single_role" integer NOT NULL,
  "secondary_email" text
);

CREATE TABLE "firehouse"."employees" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "pay_scale_id" text NOT NULL,
  "active" bigint NOT NULL,
  "sort_order" bigint NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."field_hydrant_flow_tests" (
  "id" text NOT NULL,
  "test_hydrant_id" text NOT NULL,
  "flow_hydrant_id" text,
  "tested_at" text NOT NULL,
  "static_pressure" double precision NOT NULL,
  "residual_pressure" double precision NOT NULL,
  "desired_residual" double precision NOT NULL,
  "outlet_diameter" double precision NOT NULL,
  "pitot_pressure" double precision NOT NULL,
  "discharge_coefficient" double precision NOT NULL,
  "measured_flow" double precision NOT NULL,
  "available_flow" double precision NOT NULL,
  "tested_by" text NOT NULL,
  "notes" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."field_hydrant_flushes" (
  "id" text NOT NULL,
  "hydrant_id" text NOT NULL,
  "flushed_at" text NOT NULL,
  "flushed_by" text NOT NULL,
  "water_clear" bigint NOT NULL,
  "issues" text NOT NULL,
  "notes" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."field_hydrant_service_events" (
  "id" text NOT NULL,
  "hydrant_id" text NOT NULL,
  "kind" text NOT NULL,
  "performed_on" text,
  "flow_gpm" double precision,
  "notes" text NOT NULL,
  "actor" text NOT NULL,
  "created_at" text NOT NULL,
  "source_system" text,
  "source_external_id" text
);

CREATE TABLE "firehouse"."field_hydrants" (
  "id" text NOT NULL,
  "hydrant_number" text NOT NULL,
  "address" text NOT NULL,
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  "service_status" text NOT NULL,
  "manufacturer" text NOT NULL,
  "model" text NOT NULL,
  "port_count" bigint NOT NULL,
  "port_sizes" text NOT NULL,
  "notes" text NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."field_preplan_alerts" (
  "id" text NOT NULL,
  "preplan_id" text NOT NULL,
  "level_id" text,
  "space_id" text,
  "alert_type" text NOT NULL,
  "title" text NOT NULL,
  "instructions" text NOT NULL,
  "severity" text NOT NULL,
  "display_order" integer NOT NULL,
  "pin_to_respond" integer NOT NULL,
  "effective_at" text,
  "expires_at" text,
  "expiration_action" text NOT NULL,
  "verification_required" integer NOT NULL,
  "verified_by" text,
  "verified_at" text,
  "archived" integer NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."field_preplan_annotations" (
  "id" text NOT NULL,
  "preplan_id" text NOT NULL,
  "level_id" text NOT NULL,
  "annotation_type" text NOT NULL,
  "operational_subtype" text NOT NULL,
  "name" text NOT NULL,
  "label" text NOT NULL,
  "geometry" text NOT NULL,
  "coordinate_space" text NOT NULL,
  "line_color" text NOT NULL,
  "fill_color" text NOT NULL,
  "line_width" double precision NOT NULL,
  "opacity" double precision NOT NULL,
  "font_size" double precision NOT NULL,
  "rotation" double precision NOT NULL,
  "arrow_config" text NOT NULL,
  "measurement" double precision,
  "units" text NOT NULL,
  "sort_order" integer NOT NULL,
  "min_zoom" double precision,
  "max_zoom" double precision,
  "effective_at" text,
  "expires_at" text,
  "expiration_action" text NOT NULL,
  "verified_by" text,
  "verified_at" text,
  "archived" integer NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."field_preplan_assets" (
  "id" text NOT NULL,
  "preplan_id" text NOT NULL,
  "feature_id" text,
  "hazmat_id" text,
  "level_id" text,
  "category" text NOT NULL,
  "original_filename" text NOT NULL,
  "object_key" text NOT NULL,
  "mime_type" text NOT NULL,
  "file_size" integer NOT NULL,
  "caption" text NOT NULL,
  "description" text NOT NULL,
  "sort_order" integer NOT NULL,
  "pin_to_respond" integer NOT NULL,
  "version" integer NOT NULL,
  "archived" integer NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."field_preplan_external_details" (
  "source_system" text NOT NULL,
  "external_id" text NOT NULL,
  "preplan_id" text NOT NULL,
  "payload" text NOT NULL,
  "review_notes" text NOT NULL,
  "imported_at" text NOT NULL
);

CREATE TABLE "firehouse"."field_preplan_feature_levels" (
  "feature_id" text NOT NULL,
  "level_id" text NOT NULL,
  "is_primary" integer NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."field_preplan_features" (
  "id" text NOT NULL,
  "preplan_id" text NOT NULL,
  "feature_type" text NOT NULL,
  "label" text NOT NULL,
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  "system_type" text NOT NULL,
  "service_status" text NOT NULL,
  "details" text NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "primary_level_id" text,
  "mapped" integer NOT NULL,
  "operational_category" text NOT NULL,
  "severity" text NOT NULL,
  "display_priority" integer NOT NULL,
  "min_zoom" double precision,
  "max_zoom" double precision,
  "effective_at" text,
  "expires_at" text,
  "expiration_action" text NOT NULL,
  "verified_by" text,
  "verified_at" text,
  "structured_metadata" text NOT NULL,
  "plan_x" double precision,
  "plan_y" double precision,
  "updated_by" text NOT NULL
);

CREATE TABLE "firehouse"."field_preplan_hazmat" (
  "id" text NOT NULL,
  "preplan_id" text NOT NULL,
  "level_id" text,
  "space_id" text,
  "mapped" integer NOT NULL,
  "chemical_name" text NOT NULL,
  "un_na_number" text NOT NULL,
  "erg_guide_number" text NOT NULL,
  "quantity" double precision,
  "quantity_unit" text NOT NULL,
  "container_type" text NOT NULL,
  "physical_state" text NOT NULL,
  "exact_location" text NOT NULL,
  "nfpa_health" integer,
  "nfpa_flammability" integer,
  "nfpa_instability" integer,
  "nfpa_special" text NOT NULL,
  "date_verified" text,
  "verified_by" text,
  "effective_at" text,
  "expires_at" text,
  "expiration_action" text NOT NULL,
  "notes" text NOT NULL,
  "latitude" double precision,
  "longitude" double precision,
  "plan_x" double precision,
  "plan_y" double precision,
  "archived" integer NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."field_preplan_hazmat_zones" (
  "id" text NOT NULL,
  "preplan_id" text NOT NULL,
  "hazmat_id" text NOT NULL,
  "level_id" text,
  "zone_type" text NOT NULL,
  "geometry_type" text NOT NULL,
  "geometry" text NOT NULL,
  "label" text NOT NULL,
  "radius_feet" double precision,
  "fill_color" text NOT NULL,
  "line_color" text NOT NULL,
  "opacity" double precision NOT NULL,
  "line_width" double precision NOT NULL,
  "line_style" text NOT NULL,
  "effective_at" text,
  "expires_at" text,
  "archived" integer NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."field_preplan_hose_lays" (
  "id" text NOT NULL,
  "preplan_id" text NOT NULL,
  "level_id" text,
  "name" text NOT NULL,
  "source_hydrant_id" text,
  "destination_side" text NOT NULL,
  "destination_feature_id" text,
  "path" text NOT NULL,
  "segment_distances" text NOT NULL,
  "total_distance_feet" double precision NOT NULL,
  "hose_size_inches" double precision NOT NULL,
  "section_length_feet" integer NOT NULL,
  "reserve_feet" integer NOT NULL,
  "recommended_hose_feet" integer NOT NULL,
  "supply_line_label" text NOT NULL,
  "apparatus_id" text,
  "apparatus_capacity_feet" integer,
  "inventory_verified_at" text,
  "notes" text NOT NULL,
  "archived" integer NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."field_preplan_imports" (
  "id" text NOT NULL,
  "business_name" text NOT NULL,
  "address" text NOT NULL,
  "source_file" text NOT NULL,
  "source_row" bigint NOT NULL,
  "status" text NOT NULL,
  "latitude" double precision,
  "longitude" double precision,
  "geocode_note" text NOT NULL,
  "linked_preplan_id" text,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "source_external_id" text NOT NULL,
  "source_payload" text NOT NULL
);

CREATE TABLE "firehouse"."field_preplan_levels" (
  "id" text NOT NULL,
  "preplan_id" text NOT NULL,
  "name" text NOT NULL,
  "short_label" text NOT NULL,
  "layer_type" text NOT NULL,
  "floor_index" integer,
  "grade_designation" text NOT NULL,
  "sort_order" integer NOT NULL,
  "is_default" integer NOT NULL,
  "respond_visible" integer NOT NULL,
  "hidden" integer NOT NULL,
  "archived" integer NOT NULL,
  "background_type" text NOT NULL,
  "background_asset_id" text,
  "background_transform" text NOT NULL,
  "opacity" double precision NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."field_preplan_observations" (
  "id" text NOT NULL,
  "preplan_id" text,
  "address" text NOT NULL,
  "note" text NOT NULL,
  "priority" text NOT NULL,
  "photo_key" text,
  "photo_type" text,
  "photo_name" text,
  "status" text NOT NULL,
  "actor" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."field_preplan_photo_annotations" (
  "id" text NOT NULL,
  "asset_id" text NOT NULL,
  "annotation_type" text NOT NULL,
  "geometry" text NOT NULL,
  "label" text NOT NULL,
  "style" text NOT NULL,
  "sort_order" integer NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."field_preplan_photos" (
  "id" text NOT NULL,
  "preplan_id" text NOT NULL,
  "feature_id" text,
  "side" text NOT NULL,
  "object_key" text NOT NULL,
  "filename" text NOT NULL,
  "content_type" text NOT NULL,
  "size_bytes" bigint NOT NULL,
  "caption" text NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "illustrations" text NOT NULL,
  "illustration_version" integer NOT NULL
);

CREATE TABLE "firehouse"."field_preplan_reviews" (
  "id" text NOT NULL,
  "preplan_id" text NOT NULL,
  "revision_number" integer NOT NULL,
  "action" text NOT NULL,
  "comment" text NOT NULL,
  "actor" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."field_preplan_revisions" (
  "id" text NOT NULL,
  "preplan_id" text NOT NULL,
  "revision_number" integer NOT NULL,
  "publication_status" text NOT NULL,
  "snapshot" text NOT NULL,
  "summary" text NOT NULL,
  "actor" text NOT NULL,
  "created_at" text NOT NULL,
  "restored_from_revision" integer
);

CREATE TABLE "firehouse"."field_preplan_risk_factors" (
  "id" text NOT NULL,
  "preplan_id" text NOT NULL,
  "factor" text NOT NULL,
  "score" integer NOT NULL,
  "explanation" text NOT NULL,
  "source" text NOT NULL,
  "manual_override" integer NOT NULL,
  "reviewer" text,
  "reviewed_at" text,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."field_preplan_settings" (
  "id" integer NOT NULL,
  "hose_section_length_feet" integer NOT NULL,
  "hose_reserve_feet" integer NOT NULL,
  "review_warning_days" integer NOT NULL,
  "erg_data_version" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."field_preplan_spaces" (
  "id" text NOT NULL,
  "preplan_id" text NOT NULL,
  "level_id" text NOT NULL,
  "display_name" text NOT NULL,
  "room_number" text NOT NULL,
  "space_type" text NOT NULL,
  "aliases" text NOT NULL,
  "cad_keywords" text NOT NULL,
  "geometry" text NOT NULL,
  "coordinate_space" text NOT NULL,
  "label_x" double precision,
  "label_y" double precision,
  "typical_occupancy" integer,
  "peak_occupancy" integer,
  "special_population_notes" text NOT NULL,
  "access_notes" text NOT NULL,
  "fire_protection_notes" text NOT NULL,
  "hazards" text NOT NULL,
  "archived" integer NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."field_preplans" (
  "id" text NOT NULL,
  "business_name" text NOT NULL,
  "address" text NOT NULL,
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  "a_side_latitude" double precision,
  "a_side_longitude" double precision,
  "footprint" text NOT NULL,
  "footprint_square_feet" double precision NOT NULL,
  "floor_count" bigint NOT NULL,
  "fire_flow_calculation_area" double precision NOT NULL,
  "construction_type" text NOT NULL,
  "occupancy_flow_category" text NOT NULL,
  "sprinkler_standard" text NOT NULL,
  "suggested_fire_flow_gpm" double precision NOT NULL,
  "suggested_fire_flow_duration" double precision NOT NULL,
  "contact_info" text NOT NULL,
  "construction" text NOT NULL,
  "access_info" text NOT NULL,
  "alarm_system" text NOT NULL,
  "knox_box" text NOT NULL,
  "riser" text NOT NULL,
  "fdc" text NOT NULL,
  "sprinkler_system" text NOT NULL,
  "status" text NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL,
  "publication_status" text NOT NULL,
  "completeness_status" text NOT NULL,
  "draft_owner" text,
  "published_by" text,
  "published_at" text,
  "archived_by" text,
  "archived_at" text,
  "revision_number" integer NOT NULL,
  "last_verified_at" text,
  "next_review_date" text,
  "construction_profile" text NOT NULL,
  "occupancy_profile" text NOT NULL,
  "fire_flow_profile" text NOT NULL,
  "target_hazard_level" text NOT NULL,
  "target_hazard_override" integer NOT NULL,
  "target_hazard_reasons" text NOT NULL
);

CREATE TABLE "firehouse"."fire_inspection_backup_audit" (
  "department_id" text NOT NULL,
  "id" text NOT NULL,
  "job_id" text NOT NULL,
  "action" text NOT NULL,
  "actor" text NOT NULL,
  "reason" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."fire_inspection_backup_entries" (
  "department_id" text NOT NULL,
  "job_id" text NOT NULL,
  "path" text NOT NULL,
  "part_key" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "sha256" text NOT NULL,
  "crc32" bigint NOT NULL,
  "details" text NOT NULL
);

CREATE TABLE "firehouse"."fire_inspection_backup_jobs" (
  "department_id" text NOT NULL,
  "id" text NOT NULL,
  "kind" text NOT NULL,
  "state" text NOT NULL,
  "actor" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "lease_until" bigint NOT NULL,
  "lease_token" text NOT NULL,
  "config" text NOT NULL,
  "summary" text NOT NULL,
  "manifest_hash" text,
  "error" text
);

CREATE TABLE "firehouse"."fire_inspection_backup_rows" (
  "department_id" text NOT NULL,
  "job_id" text NOT NULL,
  "dataset" text NOT NULL,
  "entry_key" text NOT NULL,
  "row_json" text NOT NULL,
  "plan_status" text NOT NULL,
  "applied" integer NOT NULL
);

CREATE TABLE "firehouse"."fire_inspection_code_audit" (
  "id" text NOT NULL,
  "department_id" text NOT NULL,
  "code_id" text NOT NULL,
  "version" integer NOT NULL,
  "payload" text NOT NULL,
  "archived" integer NOT NULL,
  "actor" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."fire_inspection_code_entries" (
  "id" text NOT NULL,
  "department_id" text NOT NULL,
  "payload" text NOT NULL,
  "version" integer NOT NULL,
  "archived" integer NOT NULL,
  "updated_at" text NOT NULL,
  "updated_by" text NOT NULL
);

CREATE TABLE "firehouse"."fire_inspection_email_deliveries" (
  "id" text NOT NULL,
  "department_id" text NOT NULL,
  "record_id" text NOT NULL,
  "record_version" integer NOT NULL,
  "recipient" text NOT NULL,
  "sender" text NOT NULL,
  "subject" text NOT NULL,
  "report_text" text NOT NULL,
  "pdf_key" text NOT NULL,
  "provider_id" text,
  "status" text NOT NULL,
  "error" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "created_by" text NOT NULL
);

CREATE TABLE "firehouse"."fire_inspection_eso_files" (
  "department_id" text NOT NULL,
  "attachment_id" text NOT NULL,
  "sha256" text NOT NULL,
  "object_key" text NOT NULL,
  "filename" text NOT NULL,
  "content_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "imported_at" text NOT NULL
);

CREATE TABLE "firehouse"."fire_inspection_eso_records" (
  "department_id" text NOT NULL,
  "inspection_id" text NOT NULL,
  "sha256" text NOT NULL,
  "object_key" text NOT NULL,
  "summary" text NOT NULL,
  "imported_at" text NOT NULL,
  "imported_by" text NOT NULL
);

CREATE TABLE "firehouse"."fire_inspection_pilot_audit" (
  "id" text NOT NULL,
  "department_id" text NOT NULL,
  "record_id" text NOT NULL,
  "version" integer NOT NULL,
  "kind" text NOT NULL,
  "payload" text NOT NULL,
  "archived" integer NOT NULL,
  "actor" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."fire_inspection_pilot_files" (
  "id" text NOT NULL,
  "department_id" text NOT NULL,
  "record_id" text,
  "object_key" text NOT NULL,
  "filename" text NOT NULL,
  "content_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "created_at" text NOT NULL,
  "created_by" text NOT NULL,
  "code_id" text,
  "check_id" text NOT NULL,
  "caption" text NOT NULL,
  "record_version" integer
);

CREATE TABLE "firehouse"."fire_inspection_pilot_records" (
  "id" text NOT NULL,
  "department_id" text NOT NULL,
  "kind" text NOT NULL,
  "payload" text NOT NULL,
  "version" integer NOT NULL,
  "archived" integer NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "updated_by" text NOT NULL
);

CREATE TABLE "firehouse"."fire_inspection_staff_audit" (
  "department_id" text NOT NULL,
  "id" text NOT NULL,
  "actor_user_id" text NOT NULL,
  "actor_email" text NOT NULL,
  "action" text NOT NULL,
  "member_id" text NOT NULL,
  "before_json" text,
  "after_json" text NOT NULL,
  "reason" text NOT NULL,
  "request_id" text NOT NULL,
  "request_hash" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."fire_inspection_staff_members" (
  "department_id" text NOT NULL,
  "id" text NOT NULL,
  "email" text NOT NULL,
  "display_name" text NOT NULL,
  "role" text NOT NULL,
  "status" text NOT NULL,
  "user_id" text,
  "employee_id" text,
  "revision" integer NOT NULL,
  "last_mutation_id" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "created_by" text NOT NULL
);

CREATE TABLE "firehouse"."fire_inspection_staff_mutations" (
  "department_id" text NOT NULL,
  "request_id" text NOT NULL,
  "request_hash" text NOT NULL,
  "actor_user_id" text NOT NULL,
  "member_id" text NOT NULL,
  "response_json" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."fire_inspection_staff_workspaces" (
  "department_id" text NOT NULL,
  "owner_user_id" text NOT NULL,
  "owner_email" text NOT NULL,
  "rollout_enabled" boolean NOT NULL,
  "revision" integer NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."fleet_apparatus" (
  "id" text NOT NULL,
  "unit_number" text NOT NULL,
  "name" text NOT NULL,
  "asset_type" text NOT NULL,
  "status" text NOT NULL,
  "manufacturer" text NOT NULL,
  "model" text NOT NULL,
  "year" bigint,
  "vin" text NOT NULL,
  "notes" text NOT NULL,
  "retired_at" text,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."important_phone_numbers" (
  "id" text NOT NULL,
  "category" text NOT NULL,
  "name" text NOT NULL,
  "emergency_number" text NOT NULL,
  "non_emergency_number" text NOT NULL,
  "notes" text NOT NULL,
  "sort_order" bigint NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."incident_command_boards" (
  "incident_id" text NOT NULL,
  "board_state" text NOT NULL,
  "revision" bigint NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."incident_command_events" (
  "id" text NOT NULL,
  "incident_id" text NOT NULL,
  "revision" bigint NOT NULL,
  "event_type" text NOT NULL,
  "summary" text NOT NULL,
  "actor" text NOT NULL,
  "event_payload" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."inventory_audit_events" (
  "id" text NOT NULL,
  "actor" text NOT NULL,
  "action" text NOT NULL,
  "record_type" text NOT NULL,
  "record_id" text NOT NULL,
  "summary" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."inventory_compartments" (
  "id" text NOT NULL,
  "apparatus_id" text NOT NULL,
  "label" text NOT NULL,
  "side" text NOT NULL,
  "details" text NOT NULL,
  "sort_order" bigint NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."inventory_equipment" (
  "id" text NOT NULL,
  "apparatus_id" text NOT NULL,
  "compartment_id" text,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "manufacturer" text NOT NULL,
  "model" text NOT NULL,
  "serial_number" text NOT NULL,
  "asset_number" text NOT NULL,
  "barcode" text NOT NULL,
  "quantity" bigint NOT NULL,
  "condition" text NOT NULL,
  "service_status" text NOT NULL,
  "expiration_date" text NOT NULL,
  "inspection_date" text NOT NULL,
  "notes" text NOT NULL,
  "retired_at" text,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."inventory_hotspots" (
  "id" text NOT NULL,
  "apparatus_id" text NOT NULL,
  "compartment_id" text NOT NULL,
  "photo_id" text NOT NULL,
  "x_basis_points" bigint NOT NULL,
  "y_basis_points" bigint NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."inventory_photos" (
  "id" text NOT NULL,
  "apparatus_id" text NOT NULL,
  "compartment_id" text,
  "equipment_id" text,
  "photo_type" text NOT NULL,
  "object_key" text NOT NULL,
  "filename" text NOT NULL,
  "content_type" text NOT NULL,
  "byte_size" bigint NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."inventory_readiness" (
  "id" text NOT NULL,
  "apparatus_id" text NOT NULL,
  "status" text NOT NULL,
  "notes" text NOT NULL,
  "checked_by" text NOT NULL,
  "checked_at" text NOT NULL
);

CREATE TABLE "firehouse"."inventory_weekly_check_items" (
  "id" text NOT NULL,
  "template_id" text NOT NULL,
  "equipment_id" text,
  "label" text NOT NULL,
  "section_name" text NOT NULL,
  "sort_order" bigint NOT NULL
);

CREATE TABLE "firehouse"."inventory_weekly_check_results" (
  "id" text NOT NULL,
  "check_id" text NOT NULL,
  "item_id" text NOT NULL,
  "result" text NOT NULL,
  "notes" text NOT NULL
);

CREATE TABLE "firehouse"."inventory_weekly_check_templates" (
  "id" text NOT NULL,
  "apparatus_id" text NOT NULL,
  "name" text NOT NULL,
  "source" text NOT NULL,
  "active" bigint NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."inventory_weekly_checks" (
  "id" text NOT NULL,
  "template_id" text NOT NULL,
  "apparatus_id" text NOT NULL,
  "status" text NOT NULL,
  "performed_by" text NOT NULL,
  "started_at" text NOT NULL,
  "completed_at" text,
  "notes" text NOT NULL
);

CREATE TABLE "firehouse"."neris_pilot_audit" (
  "id" text NOT NULL,
  "department_id" text NOT NULL,
  "record_id" text NOT NULL,
  "version" integer NOT NULL,
  "kind" text NOT NULL,
  "payload" text NOT NULL,
  "archived" integer NOT NULL,
  "actor" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."neris_pilot_files" (
  "id" text NOT NULL,
  "department_id" text NOT NULL,
  "record_id" text NOT NULL,
  "object_key" text NOT NULL,
  "filename" text NOT NULL,
  "content_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "created_at" text NOT NULL,
  "created_by" text NOT NULL
);

CREATE TABLE "firehouse"."neris_pilot_records" (
  "id" text NOT NULL,
  "department_id" text NOT NULL,
  "kind" text NOT NULL,
  "payload" text NOT NULL,
  "version" integer NOT NULL,
  "archived" integer NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "updated_by" text NOT NULL
);

CREATE TABLE "firehouse"."operational_cad_recovery" (
  "department_id" uuid NOT NULL,
  "claimed_at" timestamp with time zone NOT NULL
);

CREATE TABLE "firehouse"."operational_program_audit" (
  "department_id" uuid NOT NULL,
  "record_id" text NOT NULL,
  "version" integer NOT NULL,
  "kind" text NOT NULL,
  "payload" text NOT NULL,
  "actor" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."operational_program_records" (
  "department_id" uuid NOT NULL,
  "id" text NOT NULL,
  "kind" text NOT NULL,
  "payload" text NOT NULL,
  "version" integer NOT NULL,
  "updated_at" text NOT NULL,
  "updated_by" text NOT NULL
);

CREATE TABLE "firehouse"."operational_revisions" (
  "department_id" uuid NOT NULL,
  "section" text NOT NULL,
  "revision" bigint NOT NULL,
  "queued" boolean NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

CREATE TABLE "firehouse"."operational_view_leases" (
  "department_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "scope" text NOT NULL,
  "topic" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);

CREATE TABLE "firehouse"."pay_periods" (
  "start_date" text NOT NULL,
  "end_date" text NOT NULL,
  "status" text NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL,
  "finalized_by" text,
  "finalized_at" text
);

CREATE TABLE "firehouse"."pay_rate_history" (
  "id" text NOT NULL,
  "pay_scale_id" text NOT NULL,
  "effective_date" text NOT NULL,
  "regular_rate" double precision NOT NULL,
  "overtime_rate" double precision NOT NULL,
  "holiday_rate" double precision NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."pay_scales" (
  "id" text NOT NULL,
  "label" text NOT NULL,
  "regular_rate" double precision NOT NULL,
  "overtime_rate" double precision NOT NULL,
  "holiday_rate" double precision NOT NULL,
  "sort_order" bigint NOT NULL
);

CREATE TABLE "firehouse"."payroll_adjustments" (
  "id" text NOT NULL,
  "source_period" text NOT NULL,
  "target_period" text NOT NULL,
  "employee_id" text NOT NULL,
  "sequence" integer NOT NULL,
  "delta_cents" bigint NOT NULL,
  "document" text NOT NULL,
  "approved_by" text NOT NULL,
  "approved_at" text NOT NULL
);

CREATE TABLE "firehouse"."payroll_settings" (
  "id" bigint NOT NULL,
  "overtime_threshold" double precision NOT NULL,
  "acting_officer_premium" double precision NOT NULL,
  "dpw_multiplier" double precision NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."payroll_source_version" (
  "id" integer NOT NULL,
  "version" bigint NOT NULL
);

CREATE TABLE "firehouse"."payroll_submissions" (
  "id" text NOT NULL,
  "period_start" text NOT NULL,
  "document" text NOT NULL,
  "fingerprint" text NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."policies" (
  "id" text NOT NULL,
  "title" text NOT NULL,
  "policy_number" text NOT NULL,
  "category" text NOT NULL,
  "effective_date" text NOT NULL,
  "body" text NOT NULL,
  "status" text NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."portal_activation_attempts" (
  "email" text NOT NULL,
  "failed_attempts" integer NOT NULL,
  "locked_until" timestamp with time zone,
  "updated_at" timestamp with time zone NOT NULL
);

CREATE TABLE "firehouse"."portal_confirmation_messages" (
  "id" uuid NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "enabled" boolean NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);

CREATE TABLE "firehouse"."portal_confirmation_receipts" (
  "message_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "confirmed_at" timestamp with time zone NOT NULL
);

CREATE TABLE "firehouse"."portal_confirmation_setting" (
  "department_id" uuid NOT NULL,
  "message_id" uuid
);

CREATE TABLE "firehouse"."portal_login_audit" (
  "id" bigint GENERATED ALWAYS AS IDENTITY (SEQUENCE NAME "firehouse"."portal_login_audit_id_seq" START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 NO CYCLE) NOT NULL,
  "department_id" uuid NOT NULL,
  "outcome" text NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL
);

CREATE TABLE "firehouse"."portal_login_audit_status" (
  "singleton" boolean NOT NULL,
  "enabled_at" timestamp with time zone NOT NULL
);

CREATE TABLE "firehouse"."push_subscriptions" (
  "id" text NOT NULL,
  "user_id" text NOT NULL,
  "department_id" text NOT NULL,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text NOT NULL,
  "active" bigint NOT NULL,
  "failure_count" bigint NOT NULL,
  "last_success_at" text,
  "last_error" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."rank_permissions" (
  "rank" text NOT NULL,
  "permission_key" text NOT NULL,
  "allowed" bigint NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."record_revisions" (
  "id" text NOT NULL,
  "record_type" text NOT NULL,
  "record_id" text NOT NULL,
  "revision_number" bigint NOT NULL,
  "action" text NOT NULL,
  "summary" text NOT NULL,
  "actor" text NOT NULL,
  "changed_at" text NOT NULL
);

CREATE TABLE "firehouse"."road_closures" (
  "id" text NOT NULL,
  "road_name" text NOT NULL,
  "reason" text NOT NULL,
  "path_json" text NOT NULL,
  "detour_latitude" double precision NOT NULL,
  "detour_longitude" double precision NOT NULL,
  "status" text NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "expected_clear_at" timestamp with time zone,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "cleared_by" text,
  "cleared_at" timestamp with time zone,
  "clear_note" text NOT NULL
);

CREATE TABLE "firehouse"."safety_inspection_attachments" (
  "id" text NOT NULL,
  "inspection_id" text NOT NULL,
  "object_key" text NOT NULL,
  "filename" text NOT NULL,
  "content_type" text NOT NULL,
  "size_bytes" bigint NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."safety_inspection_results" (
  "id" text NOT NULL,
  "inspection_id" text NOT NULL,
  "template_item_id" text NOT NULL,
  "snapshot_section_name" text NOT NULL,
  "snapshot_label" text NOT NULL,
  "snapshot_equipment_type" text NOT NULL,
  "snapshot_required" bigint NOT NULL,
  "snapshot_sort_order" bigint NOT NULL,
  "result_status" text NOT NULL,
  "deficiency_note" text NOT NULL,
  "corrected_on_site" bigint NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."safety_inspection_template_items" (
  "id" text NOT NULL,
  "template_id" text NOT NULL,
  "section_name" text NOT NULL,
  "label" text NOT NULL,
  "equipment_type" text NOT NULL,
  "required" bigint NOT NULL,
  "active" bigint NOT NULL,
  "sort_order" bigint NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."safety_inspection_templates" (
  "id" text NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "cadence" text NOT NULL,
  "category" text NOT NULL,
  "active" bigint NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL,
  "location_options" text NOT NULL
);

CREATE TABLE "firehouse"."safety_inspections" (
  "id" text NOT NULL,
  "template_id" text NOT NULL,
  "inspection_date" text NOT NULL,
  "inspector_employee_id" text,
  "inspector_name" text NOT NULL,
  "status" text NOT NULL,
  "overall_notes" text NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL,
  "submitted_by" text,
  "submitted_at" text,
  "inspection_location" text NOT NULL
);

CREATE TABLE "firehouse"."schedule_assignments" (
  "id" text NOT NULL,
  "employee_id" text,
  "work_date" text NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "role" text NOT NULL,
  "source" text NOT NULL,
  "rotation_id" text,
  "status" text NOT NULL,
  "emergency" bigint NOT NULL,
  "required_rank" text NOT NULL,
  "claim_deadline" text NOT NULL,
  "notes" text NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."schedule_coverage_rules" (
  "id" text NOT NULL,
  "plan_id" text NOT NULL,
  "name" text NOT NULL,
  "role" text NOT NULL,
  "minimum_staff" bigint NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "days_of_week" text NOT NULL,
  "active" bigint NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."schedule_notification_rules" (
  "event_type" text NOT NULL,
  "label" text NOT NULL,
  "active" bigint NOT NULL,
  "email_enabled" bigint NOT NULL,
  "sms_enabled" bigint NOT NULL,
  "delivery_timings" text NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."schedule_notifications" (
  "id" text NOT NULL,
  "employee_id" text NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "in_app" bigint NOT NULL,
  "event_type" text NOT NULL,
  "email" bigint NOT NULL,
  "sms" bigint NOT NULL,
  "delivery_status" text NOT NULL,
  "read_at" text,
  "created_at" text NOT NULL,
  "scheduled_for" text NOT NULL
);

CREATE TABLE "firehouse"."schedule_requests" (
  "id" text NOT NULL,
  "request_type" text NOT NULL,
  "employee_id" text NOT NULL,
  "assignment_id" text,
  "target_employee_id" text,
  "start_date" text NOT NULL,
  "end_date" text NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "role" text NOT NULL,
  "repeat_mode" text NOT NULL,
  "repeat_interval" bigint NOT NULL,
  "status" text NOT NULL,
  "target_status" text NOT NULL,
  "notes" text NOT NULL,
  "reviewed_by" text,
  "reviewed_at" text,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."schedule_rotation_members" (
  "rotation_id" text NOT NULL,
  "employee_id" text NOT NULL
);

CREATE TABLE "firehouse"."schedule_rotations" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "start_date" text NOT NULL,
  "end_date" text NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "cycle_days" bigint NOT NULL,
  "duty_days" text NOT NULL,
  "role" text NOT NULL,
  "coverage_plan_id" text NOT NULL,
  "active" bigint NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."schedule_shift_patterns" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "color" text NOT NULL,
  "start_date" text NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "recurrence_days" bigint NOT NULL,
  "coverage_plan_id" text NOT NULL,
  "active" bigint NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."schedule_staffing_overrides" (
  "id" text NOT NULL,
  "pattern_id" text NOT NULL,
  "name" text NOT NULL,
  "condition_type" text NOT NULL,
  "role" text NOT NULL,
  "minimum_staff" bigint NOT NULL,
  "active" bigint NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."scheduler_push_deliveries" (
  "id" uuid NOT NULL,
  "event_id" uuid NOT NULL,
  "subscription_id" text NOT NULL,
  "recipient_id" text NOT NULL,
  "credential_fingerprint" text NOT NULL,
  "state" text NOT NULL,
  "attempts" integer NOT NULL,
  "next_attempt_at" timestamp with time zone NOT NULL,
  "lease_token" uuid,
  "accepted_at" timestamp with time zone,
  "last_status_code" integer
);

CREATE TABLE "firehouse"."scheduler_push_events" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "rule_id" text NOT NULL,
  "source_id" text NOT NULL,
  "source_kind" text NOT NULL,
  "version" text NOT NULL,
  "timing" text NOT NULL,
  "due_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);

CREATE TABLE "firehouse"."station_availability" (
  "id" text NOT NULL,
  "employee_id" text NOT NULL,
  "availability_date" text NOT NULL,
  "status" text NOT NULL,
  "all_day" integer NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "note" text NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."station_distribution_weights" (
  "id" integer NOT NULL,
  "seniority_weight" double precision NOT NULL,
  "hours_weight" double precision NOT NULL,
  "custom_weight" double precision NOT NULL,
  "custom_label" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."station_ot_interest" (
  "id" text NOT NULL,
  "slot_id" text NOT NULL,
  "employee_id" text NOT NULL,
  "response" text NOT NULL,
  "responded_at" text NOT NULL
);

CREATE TABLE "firehouse"."station_ot_offers" (
  "id" text NOT NULL,
  "slot_id" text NOT NULL,
  "employee_id" text NOT NULL,
  "mode" text NOT NULL,
  "status" text NOT NULL,
  "rank" integer NOT NULL,
  "offered_at" text NOT NULL,
  "responded_at" text
);

CREATE TABLE "firehouse"."station_ot_settings" (
  "mode" text NOT NULL,
  "exempt_off_duty" integer NOT NULL,
  "exempt_already_scheduled" integer NOT NULL,
  "exempt_declined" integer NOT NULL,
  "exempt_recently_mandated" integer NOT NULL,
  "recent_days" integer NOT NULL,
  "exempt_max_consecutive" integer NOT NULL,
  "max_consecutive" integer NOT NULL,
  "priority_order" text NOT NULL,
  "custom_rules" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."station_ot_timing" (
  "id" integer NOT NULL,
  "award_days_out" integer NOT NULL,
  "complete_by_days_out" integer NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."station_reminder_rules" (
  "id" text NOT NULL,
  "type" text NOT NULL,
  "label" text NOT NULL,
  "offsets" text NOT NULL,
  "email_enabled" integer NOT NULL,
  "text_enabled" integer NOT NULL,
  "target" text NOT NULL,
  "enabled" integer NOT NULL,
  "updated_at" text NOT NULL,
  "push_enabled" integer NOT NULL,
  "push_enabled_at" timestamp with time zone
);

CREATE TABLE "firehouse"."station_schedule_entries" (
  "id" text NOT NULL,
  "entry_date" text NOT NULL,
  "shift_type_id" text NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."station_shift_claims" (
  "id" text NOT NULL,
  "slot_id" text NOT NULL,
  "role" text NOT NULL,
  "employee_id" text NOT NULL,
  "note" text NOT NULL,
  "status" text NOT NULL,
  "created_at" text NOT NULL,
  "reviewed_by" text,
  "reviewed_at" text,
  "reminder_changed_at" timestamp with time zone NOT NULL
);

CREATE TABLE "firehouse"."station_shift_slots" (
  "id" text NOT NULL,
  "entry_id" text NOT NULL,
  "role" text NOT NULL,
  "employee_id" text,
  "status" text NOT NULL,
  "sort_order" integer NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "is_extra" integer NOT NULL,
  "staffing_reason" text NOT NULL,
  "request_deadline" text NOT NULL,
  "reminder_changed_at" timestamp with time zone NOT NULL
);

CREATE TABLE "firehouse"."station_shift_type_roles" (
  "id" text NOT NULL,
  "shift_type_id" text NOT NULL,
  "role" text NOT NULL,
  "count" integer NOT NULL
);

CREATE TABLE "firehouse"."station_shift_types" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "color" text NOT NULL,
  "active" integer NOT NULL,
  "sort_order" integer NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL,
  "anchor_date" text NOT NULL,
  "repeat_every_days" integer NOT NULL
);

CREATE TABLE "firehouse"."station_standing_assignments" (
  "id" text NOT NULL,
  "employee_id" text NOT NULL,
  "shift_type_id" text NOT NULL,
  "role" text NOT NULL,
  "active" integer NOT NULL,
  "created_by" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."station_time_off_dates" (
  "request_id" text NOT NULL,
  "off_date" text NOT NULL
);

CREATE TABLE "firehouse"."station_time_off_requests" (
  "id" text NOT NULL,
  "employee_id" text NOT NULL,
  "type" text NOT NULL,
  "approver_employee_id" text NOT NULL,
  "note" text NOT NULL,
  "status" text NOT NULL,
  "created_at" text NOT NULL,
  "reviewed_at" text
);

CREATE TABLE "firehouse"."station_trade_requests" (
  "id" text NOT NULL,
  "slot_id" text NOT NULL,
  "role" text NOT NULL,
  "from_employee_id" text NOT NULL,
  "target_employee_id" text,
  "accepted_by_employee_id" text,
  "note" text NOT NULL,
  "status" text NOT NULL,
  "created_at" text NOT NULL,
  "reviewed_by" text,
  "reviewed_at" text,
  "return_slot_id" text
);

CREATE TABLE "firehouse"."station_unavailability" (
  "id" text NOT NULL,
  "employee_id" text NOT NULL,
  "off_date" text NOT NULL,
  "source" text NOT NULL,
  "request_id" text
);

CREATE TABLE "firehouse"."system_meta" (
  "key" text NOT NULL,
  "value" text NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."time_entries" (
  "id" text NOT NULL,
  "employee_id" text NOT NULL,
  "period_start" text NOT NULL,
  "work_date" text NOT NULL,
  "category" text NOT NULL,
  "hours" double precision NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."training_pilot_audit" (
  "id" text NOT NULL,
  "department_id" text NOT NULL,
  "record_id" text NOT NULL,
  "version" integer NOT NULL,
  "kind" text NOT NULL,
  "payload" text NOT NULL,
  "archived" integer NOT NULL,
  "actor" text NOT NULL,
  "created_at" text NOT NULL
);

CREATE TABLE "firehouse"."training_pilot_files" (
  "id" text NOT NULL,
  "department_id" text NOT NULL,
  "record_id" text NOT NULL,
  "object_key" text NOT NULL,
  "filename" text NOT NULL,
  "content_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "created_at" text NOT NULL,
  "created_by" text NOT NULL
);

CREATE TABLE "firehouse"."training_pilot_records" (
  "id" text NOT NULL,
  "department_id" text NOT NULL,
  "kind" text NOT NULL,
  "payload" text NOT NULL,
  "version" integer NOT NULL,
  "archived" integer NOT NULL,
  "created_at" text NOT NULL,
  "updated_at" text NOT NULL,
  "updated_by" text NOT NULL
);

CREATE TABLE "firehouse"."training_report_views" (
  "department_id" text NOT NULL,
  "id" text NOT NULL,
  "owner_email" text NOT NULL,
  "name" text NOT NULL,
  "filters" text NOT NULL,
  "slot" integer NOT NULL,
  "version" integer NOT NULL,
  "archived" integer NOT NULL,
  "updated_at" text NOT NULL
);

CREATE TABLE "firehouse"."work_detail_members" (
  "request_id" text NOT NULL,
  "employee_id" text NOT NULL
);

CREATE TABLE "firehouse"."work_detail_postings" (
  "request_id" text NOT NULL,
  "employee_id" text NOT NULL,
  "hours" double precision NOT NULL,
  "posted_at" text NOT NULL
);

CREATE TABLE "firehouse"."work_detail_requests" (
  "id" text NOT NULL,
  "work_date" text NOT NULL,
  "requesting_officer_id" text NOT NULL,
  "approver_id" text NOT NULL,
  "start_time" text NOT NULL,
  "end_time" text NOT NULL,
  "total_hours" double precision NOT NULL,
  "work_type" text NOT NULL,
  "description" text NOT NULL,
  "certified" bigint NOT NULL,
  "status" text NOT NULL,
  "submitted_by" text NOT NULL,
  "submitted_at" text NOT NULL,
  "approved_by" text,
  "approved_at" text,
  "rejection_note" text NOT NULL,
  "time_in_instant" text NOT NULL,
  "time_out_instant" text NOT NULL
);

CREATE TABLE "firehouse"."workspace_review_audit" (
  "department_id" text NOT NULL,
  "record_id" text NOT NULL,
  "version" integer NOT NULL,
  "kind" text NOT NULL,
  "subject_id" text NOT NULL,
  "payload" text NOT NULL,
  "created_at" text NOT NULL,
  "actor" text NOT NULL
);

CREATE TABLE "firehouse"."workspace_review_records" (
  "department_id" text NOT NULL,
  "id" text NOT NULL,
  "kind" text NOT NULL,
  "subject_id" text NOT NULL,
  "payload" text NOT NULL,
  "version" integer NOT NULL,
  "updated_at" text NOT NULL,
  "actor" text NOT NULL
);

CREATE TABLE "private"."department_portals" (
  "department_id" uuid NOT NULL,
  "schema_name" name NOT NULL,
  "hostname" text,
  "published" boolean NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);

CREATE TABLE "private"."portal_remembered_devices" (
  "token_hash" text NOT NULL,
  "user_id" uuid NOT NULL,
  "session_id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "pin_fingerprint" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);

CREATE TABLE "public"."department_apparatus" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "unit_name" text NOT NULL,
  "unit_type" text NOT NULL,
  "call_sign" text NOT NULL,
  "station" text NOT NULL,
  "cad_unit_id" text NOT NULL,
  "status" text NOT NULL,
  "notes" text NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

CREATE TABLE "public"."department_invites" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "email" text NOT NULL,
  "role" department_role NOT NULL,
  "status" invite_status NOT NULL,
  "invited_by" uuid,
  "accepted_by" uuid,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

CREATE TABLE "public"."department_memberships" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" department_role NOT NULL,
  "status" membership_status NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);

CREATE TABLE "public"."departments" (
  "id" uuid NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "account_status" text NOT NULL,
  "plan_name" text NOT NULL,
  "trial_status" text NOT NULL,
  "trial_start_date" date,
  "trial_end_date" date,
  "subscription_status" text NOT NULL,
  "monthly_price" numeric(10,2) NOT NULL,
  "station_count" integer NOT NULL,
  "city" text,
  "state" text,
  "county" text,
  "last_active_at" timestamp with time zone,
  "storage_used_mb" numeric(12,2) NOT NULL,
  "ai_usage_estimate" numeric(12,2) NOT NULL,
  "maps_usage_estimate" numeric(12,2) NOT NULL
);

CREATE TABLE "public"."disciplinary_import_staging" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "source_id" text NOT NULL,
  "source_hash" text NOT NULL,
  "source_record" jsonb NOT NULL,
  "content" jsonb NOT NULL,
  "file_id" uuid NOT NULL,
  "object_key" text NOT NULL,
  "pdf_filename" text NOT NULL,
  "pdf_sha256" text NOT NULL,
  "pdf_size" bigint NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone
);

CREATE TABLE "public"."disciplinary_report_files" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "report_id" uuid NOT NULL,
  "object_key" text NOT NULL,
  "original_filename" text NOT NULL,
  "mime_type" text NOT NULL,
  "byte_size" bigint NOT NULL,
  "sha256" text NOT NULL,
  "uploaded_by" uuid NOT NULL,
  "uploaded_by_name" text NOT NULL,
  "uploaded_at" timestamp with time zone NOT NULL
);

CREATE TABLE "public"."disciplinary_report_versions" (
  "report_id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "content" jsonb NOT NULL,
  "status" text NOT NULL,
  "change_reason" text NOT NULL,
  "actor_id" uuid NOT NULL,
  "actor_name" text NOT NULL,
  "saved_at" timestamp with time zone NOT NULL
);

CREATE TABLE "public"."disciplinary_reports" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "content" jsonb NOT NULL,
  "status" text NOT NULL,
  "version" integer NOT NULL,
  "change_reason" text NOT NULL,
  "created_by" uuid NOT NULL,
  "created_by_name" text NOT NULL,
  "updated_by" uuid NOT NULL,
  "updated_by_name" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "submitted_at" timestamp with time zone,
  "last_operation_id" uuid NOT NULL,
  "last_request_hash" text NOT NULL,
  "source_record" jsonb,
  "source_id" text,
  "source_status" text,
  "source_at" timestamp with time zone
);

CREATE TABLE "public"."inventory_apparatus_profiles" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "name" text NOT NULL,
  "asset_type" text NOT NULL,
  "vin" text,
  "manufacturer" text,
  "model" text,
  "year" integer,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "weekly_due_day" smallint,
  "vin_decoded_json" jsonb NOT NULL,
  "vin_decoded_at" timestamp with time zone,
  "vin_source" text NOT NULL,
  "oil_specification" text NOT NULL,
  "oil_capacity" text NOT NULL,
  "transmission_fluid_specification" text NOT NULL,
  "coolant_specification" text NOT NULL,
  "front_tire_size" text NOT NULL,
  "rear_tire_size" text NOT NULL,
  "tire_pressure_notes" text NOT NULL,
  "fuel_capacity" text NOT NULL,
  "battery_specification" text NOT NULL,
  "filter_part_numbers" text NOT NULL,
  "maintenance_schedule" text NOT NULL,
  "owner_manual_url" text NOT NULL,
  "service_manual_url" text NOT NULL,
  "parts_catalog_url" text NOT NULL,
  "preferred_vendor" text NOT NULL,
  "ordering_notes" text NOT NULL,
  "service_profile_verified_at" timestamp with time zone,
  "service_profile_verified_by" uuid
);

CREATE TABLE "public"."inventory_audit_events" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "actor_id" uuid NOT NULL,
  "actor_email" text NOT NULL,
  "action" text NOT NULL,
  "aggregate_type" text NOT NULL,
  "aggregate_id" text NOT NULL,
  "next_json" jsonb NOT NULL,
  "source_device" text,
  "created_at" timestamp with time zone NOT NULL
);

CREATE TABLE "public"."inventory_check_archives" (
  "check_id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "replacement_check_id" uuid NOT NULL,
  "reason" text NOT NULL,
  "archived_at" timestamp with time zone NOT NULL,
  "archived_by" text NOT NULL
);

CREATE TABLE "public"."inventory_check_items" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "check_id" uuid NOT NULL,
  "equipment_id" uuid NOT NULL,
  "result" text NOT NULL,
  "notes" text,
  "checked_by" text,
  "checked_at" timestamp with time zone,
  "numeric_reading" numeric,
  "meter_template" text,
  "meter_response" text,
  "meter_response_version" integer NOT NULL,
  "meter_photo_id" uuid,
  "drug_schema" text,
  "drug_response" text,
  "drug_response_version" integer NOT NULL,
  "drug_photo_id" uuid
);

CREATE TABLE "public"."inventory_checks" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "apparatus_id" uuid NOT NULL,
  "shift_id" text,
  "status" text NOT NULL,
  "started_by" text NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone,
  "check_type" text NOT NULL,
  "review_status" text NOT NULL,
  "reviewed_by" text,
  "reviewed_at" timestamp with time zone,
  "review_notes" text
);

CREATE TABLE "public"."inventory_compartments" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "apparatus_id" uuid NOT NULL,
  "label" text NOT NULL,
  "side" text NOT NULL,
  "sort_order" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);

CREATE TABLE "public"."inventory_deficiency_photos" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "apparatus_id" uuid NOT NULL,
  "check_item_id" uuid,
  "object_key" text NOT NULL,
  "original_filename" text NOT NULL,
  "mime_type" text NOT NULL,
  "byte_size" bigint NOT NULL,
  "captured_by" text NOT NULL,
  "captured_at" timestamp with time zone NOT NULL
);

CREATE TABLE "public"."inventory_equipment" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "apparatus_id" uuid NOT NULL,
  "compartment_id" uuid NOT NULL,
  "name" text NOT NULL,
  "manufacturer" text,
  "model" text,
  "serial_number" text,
  "barcode" text,
  "quantity_required" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "equipment_category" text NOT NULL,
  "check_types" text[] NOT NULL,
  "source_key" text,
  "source_form" text,
  "item_order" integer NOT NULL,
  "retired_at" timestamp with time zone,
  "item_type" text NOT NULL,
  "parent_equipment_id" uuid,
  "purchase_date" date,
  "in_service_date" date,
  "expiration_date" date,
  "response_type" text NOT NULL,
  "service_status" text NOT NULL,
  "service_notes" text,
  "retirement_reason" text,
  "retired_by" text,
  "updated_at" timestamp with time zone NOT NULL,
  "scba_asset_kind" text,
  "asset_number" text,
  "sku" text,
  "hydro_test_date" date,
  "hydro_due_date" date,
  "scba_notes" text,
  "scba_check_slot" text,
  "last_serviced_date" date,
  "service_interval_months" integer,
  "service_reminder_months" integer,
  "meter_template" text,
  "meter_template_version" integer NOT NULL,
  "weekly_recurrence" text NOT NULL
);

CREATE TABLE "public"."inventory_inspection_schedules" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "apparatus_id" uuid NOT NULL,
  "check_type" text NOT NULL,
  "day_of_week" smallint NOT NULL,
  "start_time" time without time zone NOT NULL,
  "end_time" time without time zone NOT NULL,
  "active" boolean NOT NULL,
  "feeds_daily_duties" boolean NOT NULL,
  "feeds_operations_board" boolean NOT NULL,
  "require_officer_signoff" boolean NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_by" text NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

CREATE TABLE "public"."inventory_location_change_requests" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "equipment_id" uuid NOT NULL,
  "check_item_id" uuid,
  "from_apparatus_id" uuid NOT NULL,
  "from_compartment_id" uuid NOT NULL,
  "proposed_apparatus_id" uuid NOT NULL,
  "proposed_compartment_id" uuid NOT NULL,
  "status" text NOT NULL,
  "request_notes" text,
  "requested_by" uuid NOT NULL,
  "requested_by_email" text NOT NULL,
  "requested_at" timestamp with time zone NOT NULL,
  "reviewed_by" uuid,
  "reviewed_by_email" text,
  "reviewed_at" timestamp with time zone,
  "review_notes" text
);

CREATE TABLE "public"."inventory_operation_receipts" (
  "department_id" uuid NOT NULL,
  "request_id" uuid NOT NULL,
  "actor_id" uuid NOT NULL,
  "action" text NOT NULL,
  "input" jsonb NOT NULL,
  "result" jsonb NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);

CREATE TABLE "public"."inventory_photo_hotspots" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "apparatus_id" uuid NOT NULL,
  "photo_view_id" uuid NOT NULL,
  "compartment_id" uuid NOT NULL,
  "label" text NOT NULL,
  "x_basis_points" integer NOT NULL,
  "y_basis_points" integer NOT NULL,
  "display_order" integer NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);

CREATE TABLE "public"."inventory_photo_views" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "apparatus_id" uuid NOT NULL,
  "compartment_id" uuid,
  "equipment_id" uuid,
  "view_key" text NOT NULL,
  "view_level" text NOT NULL,
  "door_state" text NOT NULL,
  "angle_degrees" integer,
  "object_key" text NOT NULL,
  "original_filename" text NOT NULL,
  "mime_type" text NOT NULL,
  "byte_size" bigint NOT NULL,
  "version_number" integer NOT NULL,
  "approval_status" text NOT NULL,
  "paired_view_id" uuid,
  "captured_at" timestamp with time zone NOT NULL,
  "captured_by" text NOT NULL,
  "approved_at" timestamp with time zone,
  "approved_by" uuid,
  "replaced_at" timestamp with time zone
);

CREATE TABLE "public"."inventory_readiness_exceptions" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "apparatus_id" uuid NOT NULL,
  "equipment_id" uuid,
  "check_item_id" uuid,
  "result" text NOT NULL,
  "priority" text NOT NULL,
  "notes" text,
  "status" text NOT NULL,
  "out_of_service" boolean NOT NULL,
  "opened_by" text NOT NULL,
  "opened_at" timestamp with time zone NOT NULL,
  "resolved_at" timestamp with time zone,
  "issue_categories" text[] NOT NULL,
  "assigned_employee_ids" text[] NOT NULL,
  "assigned_employee_names" text[] NOT NULL,
  "evidence_photo_id" uuid,
  "resolved_by" text,
  "resolution_notes" text
);

CREATE TABLE "public"."inventory_scba_check_entries" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "check_id" uuid NOT NULL,
  "section" text NOT NULL,
  "label" text NOT NULL,
  "sort_order" integer NOT NULL,
  "harness_number" text,
  "cylinder_number" text,
  "psi" smallint,
  "result" text NOT NULL,
  "notes" text,
  "checked_by" text,
  "checked_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  "equipment_id" uuid,
  "asset_number" text,
  "location_snapshot" text
);

CREATE TABLE "public"."inventory_scba_templates" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "apparatus_id" uuid NOT NULL,
  "pack_positions" text[] NOT NULL,
  "include_rit" boolean NOT NULL,
  "spare_bottle_count" smallint NOT NULL,
  "active" boolean NOT NULL,
  "created_by" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_by" text,
  "updated_at" timestamp with time zone NOT NULL
);

CREATE TABLE "public"."inventory_stock_items" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "name" text NOT NULL,
  "sku" text,
  "barcode" text,
  "unit" text NOT NULL,
  "par_level" integer NOT NULL,
  "reorder_point" integer NOT NULL,
  "expiration_tracked" boolean NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);

CREATE TABLE "public"."inventory_stock_lots" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "stock_item_id" uuid NOT NULL,
  "location_type" text NOT NULL,
  "location_id" text NOT NULL,
  "lot_number" text,
  "expires_at" date,
  "quantity_on_hand" integer NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);

CREATE TABLE "public"."inventory_transactions" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "stock_item_id" uuid NOT NULL,
  "stock_lot_id" uuid,
  "transaction_type" text NOT NULL,
  "quantity" integer NOT NULL,
  "to_location_id" text,
  "reason" text NOT NULL,
  "performed_by" uuid NOT NULL,
  "performed_at" timestamp with time zone NOT NULL
);

CREATE TABLE "public"."inventory_work_order_documents" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "apparatus_id" uuid NOT NULL,
  "work_order_id" uuid NOT NULL,
  "document_type" text NOT NULL,
  "object_key" text NOT NULL,
  "original_filename" text NOT NULL,
  "mime_type" text NOT NULL,
  "byte_size" bigint NOT NULL,
  "note" text,
  "uploaded_by" text NOT NULL,
  "uploaded_at" timestamp with time zone NOT NULL
);

CREATE TABLE "public"."inventory_work_orders" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "apparatus_id" uuid NOT NULL,
  "equipment_id" uuid,
  "status" text NOT NULL,
  "priority" text NOT NULL,
  "summary" text NOT NULL,
  "details" text,
  "assigned_to" text,
  "opened_by" text NOT NULL,
  "opened_at" timestamp with time zone NOT NULL,
  "due_at" timestamp with time zone,
  "closed_at" timestamp with time zone,
  "linked_exception_id" uuid,
  "assigned_employee_ids" text[] NOT NULL,
  "assigned_employee_names" text[] NOT NULL,
  "repair_date" date,
  "repair_cost" numeric(12,2),
  "vendor" text,
  "invoice_number" text,
  "resolution_notes" text,
  "closed_by" text,
  "service_type" text NOT NULL,
  "odometer" integer,
  "labor_hours" numeric(8,2),
  "performed_by" text,
  "parts_used" text,
  "next_service_due_date" date,
  "next_service_due_mileage" integer
);

CREATE TABLE "public"."platform_owners" (
  "email" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);

CREATE TABLE "public"."portal_access_emails" (
  "email" text NOT NULL,
  "invited_by" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);

CREATE TABLE "public"."portal_invite_admins" (
  "email" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL
);

CREATE TABLE "public"."portal_pin_credentials" (
  "user_id" uuid NOT NULL,
  "pin_hash" text NOT NULL,
  "failed_attempts" integer NOT NULL,
  "locked_until" timestamp with time zone,
  "unlock_token_hash" text,
  "unlock_expires_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

CREATE TABLE "public"."push_subscriptions" (
  "id" uuid NOT NULL,
  "department_id" uuid NOT NULL,
  "user_id" uuid,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "device_name" text,
  "role" text,
  "enabled" boolean NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "last_seen_at" timestamp with time zone NOT NULL
);

CREATE TABLE "public"."user_profiles" (
  "user_id" uuid NOT NULL,
  "handle" text NOT NULL,
  "display_name" text NOT NULL,
  "email" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL
);

CREATE OR REPLACE FUNCTION department_gateway.department_firehouse_server_sql(p_department uuid, p_sql text, p_mode text DEFAULT 'all'::text, p_secret text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 -- Validate the existing server credential without reading any source rows.
 PERFORM public.firehouse_server_sql('SELECT 1','first',p_secret);
 RETURN private.department_execute_sql(p_department,p_sql,p_mode);
END $function$;

REVOKE ALL ON FUNCTION "department_gateway"."department_firehouse_server_sql"(p_department uuid, p_sql text, p_mode text, p_secret text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION department_gateway.department_firehouse_sql(p_department uuid, p_sql text, p_mode text DEFAULT 'all'::text, p_secret text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF NOT private.portal_server_request() OR NOT private.department_portal_access(p_department) THEN RAISE EXCEPTION 'Verified department portal access required' USING ERRCODE='42501'; END IF;
 RETURN private.department_execute_sql(p_department,p_sql,p_mode);
END $function$;

REVOKE ALL ON FUNCTION "department_gateway"."department_firehouse_sql"(p_department uuid, p_sql text, p_mode text, p_secret text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION department_gateway.department_portal_confirmation_status(p_department uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE target name; result jsonb;
BEGIN
 IF NOT private.department_portal_access(p_department) THEN RAISE EXCEPTION 'Department access required' USING ERRCODE='42501'; END IF;
 SELECT schema_name INTO target FROM private.department_portals WHERE department_id=p_department AND schema_name<>'firehouse';
 IF target IS NULL THEN RAISE EXCEPTION 'Department storage is unavailable'; END IF;
 EXECUTE format('SELECT jsonb_build_object(''required'',coalesce(m.enabled,false) AND NOT EXISTS(SELECT 1 FROM %I.portal_confirmation_receipts r WHERE r.message_id=m.id AND r.user_id=$2),''version'',m.id,''exempt'',false) FROM %I.portal_confirmation_setting s LEFT JOIN %I.portal_confirmation_messages m ON m.id=s.message_id WHERE s.department_id=$1',target,target,target) INTO result USING p_department,auth.uid();
 RETURN coalesce(result,jsonb_build_object('required',false,'version',null,'exempt',false));
END $function$;

REVOKE ALL ON FUNCTION "department_gateway"."department_portal_confirmation_status"(p_department uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION department_gateway.department_portal_directory()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE department record; plans bigint; hydrants bigint; results jsonb:='[]';
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 FOR department IN SELECT d.id,d.name,d.slug,d.city,d.state,d.county,d.account_status,d.trial_status,m.role,p.schema_name,p.hostname,p.published
 FROM public.departments d JOIN private.department_portals p ON p.department_id=d.id
 LEFT JOIN public.department_memberships m ON m.department_id=d.id AND m.user_id=auth.uid() AND m.status='active'
 WHERE public.is_platform_owner() OR m.user_id IS NOT NULL ORDER BY d.created_at LOOP
   EXECUTE format('SELECT count(*) FROM %I.field_preplans',department.schema_name) INTO plans;
   EXECUTE format('SELECT count(*) FROM %I.field_hydrants',department.schema_name) INTO hydrants;
   results:=results||jsonb_build_array(jsonb_build_object('role',coalesce(department.role::text,'owner'),'status','active',
   'departments',to_jsonb(department)-'role'-'schema_name'-'hostname'-'published',
   'portalUrl',CASE WHEN department.published THEN 'https://'||department.hostname||'/?display=portal' ELSE NULL END,
   'properties',plans,'hydrants',hydrants));
 END LOOP;
 RETURN results;
END $function$;

REVOKE ALL ON FUNCTION "department_gateway"."department_portal_directory"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION department_gateway.department_portal_for_host(p_host text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT jsonb_build_object('id',d.id,'name',d.name,'slug',d.slug,'isolated',p.schema_name IS DISTINCT FROM 'firehouse'::name)
 FROM private.department_portals p JOIN public.departments d ON d.id=p.department_id
 WHERE p.published AND (p.hostname=lower(p_host) OR (p.schema_name='firehouse' AND
 (p_host IN ('localhost','127.0.0.1') OR p_host ~ '^stickney-firehouse-manager(-[a-z0-9-]+)?[.]vercel[.]app$')))
 LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION "department_gateway"."department_portal_for_host"(p_host text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION department_gateway.department_shared_preplan_file(p_viewer uuid, p_source uuid, p_file text, p_kind text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE target name; result jsonb;
BEGIN
 IF NOT private.portal_server_request() OR NOT private.department_portal_access(p_viewer) THEN RAISE EXCEPTION 'Verified department access required' USING ERRCODE='42501'; END IF;
 SELECT schema_name INTO target FROM private.department_portals WHERE department_id=p_source;
 IF target IS NULL THEN RETURN NULL; END IF;
 IF p_kind='photo' THEN
   EXECUTE format('SELECT jsonb_build_object(''objectKey'',f.object_key,''mimeType'',f.content_type,''filename'',f.filename) FROM %I.field_preplan_photos f JOIN %I.field_preplans p ON p.id=f.preplan_id WHERE p.publication_status=''published'' AND f.id=$1',target,target) INTO result USING p_file;
 ELSIF p_kind='asset' THEN
   EXECUTE format('SELECT jsonb_build_object(''objectKey'',f.object_key,''mimeType'',f.mime_type,''filename'',f.original_filename) FROM %I.field_preplan_assets f JOIN %I.field_preplans p ON p.id=f.preplan_id WHERE p.publication_status=''published'' AND f.archived=0 AND f.id=$1',target,target) INTO result USING p_file;
 ELSE RETURN NULL; END IF;
 IF result IS NOT NULL AND target<>'firehouse' THEN result:=jsonb_set(result,'{objectKey}',to_jsonb('departments/'||p_source::text||'/'||(result->>'objectKey'))); END IF;
 RETURN result;
END $function$;

REVOKE ALL ON FUNCTION "department_gateway"."department_shared_preplan_file"(p_viewer uuid, p_source uuid, p_file text, p_kind text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION department_gateway.department_shared_preplans(p_viewer uuid, p_source uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF NOT private.portal_server_request() OR NOT private.department_portal_access(p_viewer) THEN RAISE EXCEPTION 'Verified department access required' USING ERRCODE='42501'; END IF;
 RETURN private.department_shared_snapshot(p_viewer,p_source);
END $function$;

REVOKE ALL ON FUNCTION "department_gateway"."department_shared_preplans"(p_viewer uuid, p_source uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.apparatus_location_fleet(p_department uuid)
 RETURNS TABLE(id text, unit_number text, name text, status text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 SELECT COALESCE(legacy.id,a.id::text),a.unit_name,
        COALESCE(NULLIF(a.unit_type,''),a.unit_name),a.status
 FROM public.department_apparatus a
 LEFT JOIN LATERAL (
   SELECT f.id FROM firehouse.fleet_apparatus f
   WHERE f.unit_number=a.unit_name
   ORDER BY CASE WHEN EXISTS(SELECT 1 FROM firehouse.apparatus_trackers t
     WHERE t.apparatus_id=f.id AND t.department_id=p_department) THEN 0 ELSE 1 END,f.id
   LIMIT 1
 ) legacy ON true
 WHERE a.department_id=p_department AND a.status IS DISTINCT FROM 'retired'
$function$;

REVOKE ALL ON FUNCTION "firehouse"."apparatus_location_fleet"(p_department uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.apparatus_location_topic(p_department uuid, p_now timestamp with time zone DEFAULT clock_timestamp())
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 SELECT 'apparatus:'||p_department::text||':'||floor(extract(epoch FROM p_now)/60)::bigint::text
$function$;

REVOKE ALL ON FUNCTION "firehouse"."apparatus_location_topic"(p_department uuid, p_now timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.bump_daily_log_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW IS DISTINCT FROM OLD THEN NEW.save_version := OLD.save_version + 1; END IF;
  RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."bump_daily_log_version"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.bump_linked_log_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    UPDATE firehouse.daily_logs SET save_version = save_version + 1 WHERE log_date = OLD.log_date;
  END IF;
  IF TG_OP <> 'DELETE' AND (TG_OP = 'INSERT' OR NEW.log_date IS DISTINCT FROM OLD.log_date) THEN
    UPDATE firehouse.daily_logs SET save_version = save_version + 1 WHERE log_date = NEW.log_date;
  END IF;
  RETURN NULL;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."bump_linked_log_version"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.bump_permissions_revision()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 IF TG_OP='UPDATE' THEN
   CASE TG_TABLE_NAME
     WHEN 'rank_permissions' THEN IF NEW.allowed IS NOT DISTINCT FROM OLD.allowed THEN RETURN NULL; END IF;
     WHEN 'employee_permission_overrides' THEN IF NEW.effect IS NOT DISTINCT FROM OLD.effect THEN RETURN NULL; END IF;
     WHEN 'employee_profiles' THEN IF ROW(NEW.email,NEW.is_admin,NEW.employee_number,NEW.end_date) IS NOT DISTINCT FROM ROW(OLD.email,OLD.is_admin,OLD.employee_number,OLD.end_date) THEN RETURN NULL; END IF;
     WHEN 'employees' THEN IF ROW(NEW.active,NEW.pay_scale_id) IS NOT DISTINCT FROM ROW(OLD.active,OLD.pay_scale_id) THEN RETURN NULL; END IF;
     WHEN 'pay_scales' THEN IF NEW.label IS NOT DISTINCT FROM OLD.label THEN RETURN NULL; END IF;
   END CASE;
 END IF;
 UPDATE firehouse.system_meta SET value=gen_random_uuid()::text,updated_at=now()::text WHERE key='permissions-revision';
 RETURN NULL;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."bump_permissions_revision"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.cad_push_recipient_allowed(department uuid, recipient text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE actor_email text; employee record; matches integer; effect_value text; saved boolean;
BEGIN
 IF department<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid OR department IS NULL THEN RETURN false; END IF;
 IF recipient IS NULL OR recipient !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
 SELECT lower(btrim(u.email)) INTO actor_email FROM auth.users u
 WHERE u.id=recipient::uuid AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now());
 IF actor_email IS NULL THEN RETURN false; END IF;
 -- Preserve the existing portal owner exception; never trust user_metadata.
 IF actor_email='bobff353@gmail.com' AND EXISTS(SELECT 1 FROM public.platform_owners p WHERE lower(btrim(p.email))=actor_email) THEN RETURN true; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.department_memberships m WHERE m.department_id=department AND m.user_id=recipient::uuid AND m.status='active') THEN RETURN false; END IF;
 SELECT count(*) INTO matches FROM firehouse.employees e JOIN firehouse.employee_profiles ep ON ep.employee_id=e.id
 WHERE e.active=1 AND lower(btrim(ep.email))=actor_email;
 IF matches<>1 THEN RETURN false; END IF;
 SELECT e.id,p.label rank,coalesce(ep.is_admin,0) is_admin,ep.end_date INTO employee
 FROM firehouse.employees e JOIN firehouse.employee_profiles ep ON ep.employee_id=e.id JOIN firehouse.pay_scales p ON p.id=e.pay_scale_id
 WHERE e.active=1 AND lower(btrim(ep.email))=actor_email;
 IF NOT FOUND THEN RETURN false; END IF;
 IF employee.end_date IS NOT NULL AND employee.end_date<>'' AND employee.end_date<to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD') THEN RETURN false; END IF;
 SELECT effect INTO effect_value FROM firehouse.employee_permission_overrides WHERE employee_id=employee.id AND permission_key='field_preplans.view';
 IF effect_value='deny' THEN RETURN false; END IF;
 IF effect_value='allow' THEN RETURN true; END IF;
 IF employee.is_admin=1 THEN RETURN true; END IF;
 SELECT allowed=1 INTO saved FROM firehouse.rank_permissions WHERE rank=employee.rank AND permission_key='field_preplans.view';
 IF FOUND THEN RETURN saved; END IF;
 RETURN true; -- All current rank defaults include Respond access.
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."cad_push_recipient_allowed"(department uuid, recipient text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.check_payroll_submission_target()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE target text;
BEGIN
  IF TG_TABLE_NAME = 'payroll_submissions' THEN target := NEW.period_start;
  ELSE target := NEW.target_period;
  END IF;
  IF EXISTS (SELECT 1 FROM firehouse.pay_periods WHERE start_date = target AND status = 'finalized') THEN
    RAISE EXCEPTION 'PAYROLL_FINALIZED: This target period is closed.';
  END IF;
  IF TG_TABLE_NAME = 'payroll_adjustments' AND EXISTS (SELECT 1 FROM firehouse.payroll_submissions WHERE period_start = target) THEN
    RAISE EXCEPTION 'PAYROLL_SNAPSHOT_LOCKED: Choose a later unsubmitted period.';
  END IF;
  RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."check_payroll_submission_target"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.claim_board_feed(p_source text, p_now timestamp with time zone DEFAULT clock_timestamp())
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE local_now timestamp := p_now AT TIME ZONE 'America/Chicago'; slot timestamptz; claimed uuid;
BEGIN
  IF p_source NOT IN ('close_calls','usfa','weather','training_romeoville','training_ifsi','training_nipsta') THEN
    RAISE EXCEPTION 'Unknown board feed';
  END IF;
  -- A late/duplicate cron can use this quarter-hour's slot, never catch up missed slots.
  IF p_source = 'weather' THEN
    slot := to_timestamp(floor(extract(epoch FROM p_now) / 900) * 900);
  ELSE
    IF extract(minute FROM local_now) >= 15 OR NOT (
      extract(hour FROM local_now) = 6 OR
      (p_source IN ('close_calls','usfa') AND extract(hour FROM local_now) = 18)
    ) THEN RETURN NULL; END IF;
    slot := date_trunc('hour', local_now) AT TIME ZONE 'America/Chicago';
  END IF;
  -- Consume the slot BEFORE external I/O. Failed/crashed workers cannot retry it.
  INSERT INTO firehouse.board_feed_cache AS cache
    (source,last_attempt_at,attempted_slot,attempt_id,next_scheduled_at,status)
  VALUES (p_source,p_now,slot,gen_random_uuid(),firehouse.next_board_feed_slot(p_source,p_now),'updating')
  ON CONFLICT (source) DO UPDATE SET
    last_attempt_at=EXCLUDED.last_attempt_at, attempted_slot=EXCLUDED.attempted_slot,
    attempt_id=EXCLUDED.attempt_id, next_scheduled_at=EXCLUDED.next_scheduled_at,
    status='updating', error_code=NULL
  WHERE cache.attempted_slot < EXCLUDED.attempted_slot
  RETURNING attempt_id INTO claimed;
  RETURN claimed;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."claim_board_feed"(p_source text, p_now timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.claim_cad_push(batch_size integer DEFAULT 50, incident text DEFAULT NULL::text)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 -- Only the small indexed outstanding queue is examined, not accepted history.
 UPDATE firehouse.cad_push_deliveries SET state='expired',lease_token=NULL
 WHERE state IN ('pending','sending','retry') AND next_attempt_at<=now() AND expires_at<=now();
 RETURN QUERY
 WITH candidates AS (
   SELECT d.id FROM firehouse.cad_push_deliveries d JOIN firehouse.cad_push_events e ON e.id=d.event_id
   WHERE d.state IN ('pending','sending','retry') AND d.next_attempt_at<=now()
     AND (incident IS NULL OR e.incident_id=incident)
   ORDER BY d.next_attempt_at,d.id LIMIT least(greatest(batch_size,1),50) FOR UPDATE OF d SKIP LOCKED
 ), claimed AS (
   UPDATE firehouse.cad_push_deliveries d SET
     state=CASE WHEN d.attempts>=5 THEN 'failed' WHEN EXISTS(
       SELECT 1 FROM firehouse.push_subscriptions s JOIN firehouse.cad_push_events e ON e.id=d.event_id
       WHERE s.id=d.subscription_id AND s.active=1 AND s.user_id=d.recipient_id AND s.department_id=e.department_id::text
       AND md5(jsonb_build_array(s.endpoint,s.p256dh,s.auth)::text)=d.credential_fingerprint
       AND firehouse.cad_push_recipient_allowed(e.department_id,s.user_id)
     ) THEN 'sending' ELSE 'cancelled' END,
     attempts=d.attempts+1, lease_token=gen_random_uuid(),next_attempt_at=now()+interval '60 seconds'
   FROM candidates c WHERE c.id=d.id RETURNING d.*
 ) SELECT jsonb_build_object('id',c.id,'lease',c.lease_token,'eventId',e.id,'departmentId',e.department_id,
   'subscriptionId',s.id,'endpoint',s.endpoint,'p256dh',s.p256dh,'auth',s.auth,'incident',e.payload,
   'ttl',greatest(1,floor(extract(epoch FROM c.expires_at-now()))::integer))
 FROM claimed c JOIN firehouse.cad_push_events e ON e.id=c.event_id JOIN firehouse.push_subscriptions s ON s.id=c.subscription_id
 WHERE c.state='sending';
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."claim_cad_push"(batch_size integer, incident text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.claim_operational_cad_recovery(p_department uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE changed integer;
BEGIN
 INSERT INTO firehouse.operational_cad_recovery(department_id,claimed_at) VALUES(p_department,clock_timestamp())
 ON CONFLICT(department_id) DO UPDATE SET claimed_at=excluded.claimed_at
 WHERE operational_cad_recovery.claimed_at<=clock_timestamp()-interval '30 seconds';
 GET DIAGNOSTICS changed=ROW_COUNT;
 RETURN changed=1;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."claim_operational_cad_recovery"(p_department uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.claim_scheduler_push()
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 RETURN QUERY WITH candidates AS (
  SELECT d.id FROM firehouse.scheduler_push_deliveries d WHERE d.state IN ('pending','sending','retry') AND d.next_attempt_at<=now()
  ORDER BY d.next_attempt_at,d.id LIMIT 50 FOR UPDATE SKIP LOCKED
 ), claimed AS (
  UPDATE firehouse.scheduler_push_deliveries d SET state=CASE WHEN e.expires_at<=now() THEN 'expired' WHEN d.attempts>=6 THEN 'failed'
   WHEN EXISTS(SELECT 1 FROM firehouse.push_subscriptions s WHERE s.id=d.subscription_id AND s.active=1 AND s.user_id=d.recipient_id AND s.department_id=e.department_id::text
    AND md5(jsonb_build_array(s.endpoint,s.p256dh,s.auth)::text)=d.credential_fingerprint AND firehouse.scheduler_push_recipient_allowed(e,s.user_id)) THEN 'sending' ELSE 'cancelled' END,
   attempts=d.attempts+1,lease_token=gen_random_uuid(),next_attempt_at=now()+interval '90 seconds'
  FROM candidates c,firehouse.scheduler_push_events e WHERE d.id=c.id AND e.id=d.event_id RETURNING d.*
 ) SELECT jsonb_build_object('id',d.id,'lease',d.lease_token,'eventId',e.id,'payload',e.payload||jsonb_build_object('eventId',e.id,'tag','scheduler-'||e.id),
  'endpoint',s.endpoint,'p256dh',s.p256dh,'auth',s.auth,'ttl',greatest(1,floor(extract(epoch FROM e.expires_at-now()))::integer))
 FROM claimed d JOIN firehouse.scheduler_push_events e ON e.id=d.event_id JOIN firehouse.push_subscriptions s ON s.id=d.subscription_id WHERE d.state='sending';
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."claim_scheduler_push"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.confirm_portal_message(expected uuid, recipient uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE saved_id uuid; active boolean;
BEGIN
 IF recipient IS NULL OR recipient IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Confirm your own message' USING ERRCODE='42501'; END IF;
 PERFORM private.portal_confirmation_status();
 SELECT message_id INTO saved_id FROM firehouse.portal_confirmation_setting WHERE department_id='14a76771-4c24-481b-8def-e6cce005c17b' FOR SHARE;
 SELECT enabled INTO active FROM firehouse.portal_confirmation_messages WHERE id=saved_id;
 IF saved_id IS DISTINCT FROM expected OR NOT coalesce(active,false) THEN RAISE EXCEPTION 'CONFIRMATION_CONFLICT'; END IF;
 INSERT INTO firehouse.portal_confirmation_receipts(message_id,user_id) VALUES(expected,recipient) ON CONFLICT DO NOTHING;
 RETURN true;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."confirm_portal_message"(expected uuid, recipient uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.employee_account_setup()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT jsonb_build_object(
  'accounts',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,
    'activated',u.email_confirmed_at IS NOT NULL AND u.last_sign_in_at IS NOT NULL AND EXISTS(SELECT 1 FROM public.portal_pin_credentials p WHERE p.user_id=u.id),
    'verified',u.email_confirmed_at IS NOT NULL,'employeeId',firehouse.employee_id_for_login(u.email)))
    FROM auth.users u WHERE (lower(btrim(u.email))='bobff353@gmail.com' OR EXISTS(SELECT 1 FROM public.department_memberships m JOIN public.departments d ON d.id=m.department_id WHERE m.user_id=u.id AND m.status='active' AND d.slug='stickney-fire-department'))), '[]'::jsonb),
  'invites',COALESCE((SELECT jsonb_agg(jsonb_build_object('email',i.email,'status',i.status,'expiresAt',i.expires_at))
    FROM public.department_invites i JOIN public.departments d ON d.id=i.department_id WHERE d.slug='stickney-fire-department'),'[]'::jsonb)
 );
$function$;

REVOKE ALL ON FUNCTION "firehouse"."employee_account_setup"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.employee_id_for_login(p_email text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  WITH matches AS (
    SELECT DISTINCT e.id FROM firehouse.employees e
    LEFT JOIN firehouse.employee_profiles ep ON ep.employee_id=e.id
    WHERE e.active=1
      AND (NULLIF(ep.start_date,'') IS NULL OR ep.start_date<=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD'))
      AND (NULLIF(ep.end_date,'') IS NULL OR ep.end_date>=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD'))
      AND (lower(btrim(ep.email))=lower(btrim(p_email)) OR EXISTS (
        SELECT 1 FROM firehouse.employee_account_links l JOIN auth.users u ON u.id=l.user_id
        WHERE l.employee_id=e.id AND lower(btrim(u.email))=lower(btrim(p_email)) AND u.email_confirmed_at IS NOT NULL
      )) AND btrim(p_email)<>''
  ) SELECT CASE WHEN count(*)=1 THEN min(id) END FROM matches;
$function$;

REVOKE ALL ON FUNCTION "firehouse"."employee_id_for_login"(p_email text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.enable_cad_push_outbox()
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 PERFORM set_config('firehouse.cad_push_outbox','v1',true);
 RETURN true;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."enable_cad_push_outbox"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.enqueue_cad_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE event uuid; department constant uuid := '14a76771-4c24-481b-8def-e6cce005c17b';
BEGIN
 IF current_setting('firehouse.cad_push_outbox',true) IS DISTINCT FROM 'v1' THEN RETURN NULL; END IF;
 IF NEW.active IS DISTINCT FROM 1 THEN RETURN NULL; END IF;
 INSERT INTO firehouse.cad_push_events(department_id,incident_id,payload)
 VALUES(department,NEW.incident_id,jsonb_build_object('incidentId',NEW.incident_id,'callType',coalesce(NEW.call_type,''),'timeOut',coalesce(NEW.time_out,''),'narrative',left(coalesce(NEW.narrative,''),1000)))
 ON CONFLICT(department_id,incident_id) DO NOTHING RETURNING id INTO event;
 IF event IS NULL THEN RETURN NULL; END IF;
 INSERT INTO firehouse.cad_push_deliveries(event_id,subscription_id,recipient_id,credential_fingerprint)
 SELECT event,s.id,s.user_id,md5(jsonb_build_array(s.endpoint,s.p256dh,s.auth)::text)
 FROM firehouse.push_subscriptions s WHERE s.department_id=department::text AND s.active=1
 AND firehouse.cad_push_recipient_allowed(department,s.user_id)
 ON CONFLICT(event_id,subscription_id) DO NOTHING;
 RETURN NULL;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."enqueue_cad_push"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.enqueue_scheduler_push()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE event firehouse.scheduler_push_events; added integer:=0;
BEGIN
 -- Serialize planners, not call processing. Deduplication is also enforced by UNIQUE.
 IF NOT pg_try_advisory_xact_lock(12120912,1) THEN RETURN 0; END IF;
 FOR event IN
  INSERT INTO firehouse.scheduler_push_events(rule_id,source_id,source_kind,version,timing,due_at,expires_at,payload)
  SELECT * FROM firehouse.scheduler_reminder_candidates() ON CONFLICT DO NOTHING RETURNING *
 LOOP
  INSERT INTO firehouse.scheduler_push_deliveries(event_id,subscription_id,recipient_id,credential_fingerprint)
  SELECT event.id,s.id,s.user_id,md5(jsonb_build_array(s.endpoint,s.p256dh,s.auth)::text)
  FROM firehouse.push_subscriptions s WHERE s.department_id=event.department_id::text AND s.active=1
   AND firehouse.scheduler_push_recipient_allowed(event,s.user_id) ON CONFLICT DO NOTHING;
  added=added+1;
 END LOOP;
 RETURN added;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."enqueue_scheduler_push"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.execute_portal_sql(p_sql text, p_mode text DEFAULT 'all'::text, p_secret text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'firehouse', 'extensions', 'pg_temp'
AS $function$
DECLARE
  result jsonb;
  affected bigint;
BEGIN
  IF NOT private.portal_server_request() THEN
    RAISE EXCEPTION 'Use the authenticated portal API' USING ERRCODE = '42501';
  END IF;
  IF NOT firehouse.has_department_access() THEN
    RAISE EXCEPTION 'Stickney department access required' USING ERRCODE = '42501';
  END IF;
  IF p_sql ~* '\m(department_[a-f0-9]{32}|department_gateway|private)\s*\.' OR p_sql ~* '"(department_[a-f0-9]{32}|department_gateway|private)"\s*\.' THEN
    RAISE EXCEPTION 'Cross-department query denied' USING ERRCODE='42501';
   END IF;
   IF p_sql IS NULL OR length(p_sql) > 200000 OR p_sql ~ '(;|--|/\*|\*/)' THEN
    RAISE EXCEPTION 'Unsafe portal query';
  END IF;
  IF p_sql ~* '\m(public|auth|storage|extensions|vault|realtime|graphql)\s*\.' THEN
    RAISE EXCEPTION 'Cross-schema portal query denied';
  END IF;
  IF p_sql !~* '^\s*(select|insert|update|delete|with)\M'
     OR p_sql ~* '\m(create|alter|drop|truncate|grant|revoke|copy|call|show|reset|listen|notify|vacuum|analyze)\M' THEN
    RAISE EXCEPTION 'Unsupported portal query';
  END IF;

  IF p_mode = 'all' THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(portal_row)), ''[]''::jsonb) FROM (' || p_sql || ') AS portal_row' INTO result;
    RETURN COALESCE(result, '[]'::jsonb);
  ELSIF p_mode = 'first' THEN
    EXECUTE 'SELECT to_jsonb(portal_row) FROM (' || p_sql || ') AS portal_row LIMIT 1' INTO result;
    RETURN result;
  ELSIF p_mode = 'run' THEN
    EXECUTE p_sql;
    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN jsonb_build_object('success', true, 'meta', jsonb_build_object('changes', affected));
  END IF;
  RAISE EXCEPTION 'Unknown portal query mode';
END;
$function$;

REVOKE ALL ON FUNCTION "firehouse"."execute_portal_sql"(p_sql text, p_mode text, p_secret text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.execute_server_portal_sql(p_sql text, p_mode text DEFAULT 'all'::text, p_secret text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'firehouse', 'extensions', 'pg_temp'
AS $function$
DECLARE
  result jsonb;
  affected bigint;
BEGIN
  IF p_secret IS NULL
     OR encode(extensions.digest(btrim(p_secret), 'sha256'), 'hex') <> 'b670b94c3c22d743371264059918a4e1c7d98640305f93f211aba9b1b60dcdb8' THEN
    RAISE EXCEPTION 'Invalid portal database credential' USING ERRCODE = '42501';
  END IF;
  IF p_sql ~* '\m(department_[a-f0-9]{32}|department_gateway|private)\s*\.' OR p_sql ~* '"(department_[a-f0-9]{32}|department_gateway|private)"\s*\.' THEN
    RAISE EXCEPTION 'Cross-department query denied' USING ERRCODE='42501';
   END IF;
   IF p_sql IS NULL OR length(p_sql) > 200000 OR p_sql ~ '(;|--|/\*|\*/)' THEN
    RAISE EXCEPTION 'Unsafe portal query';
  END IF;
  IF p_sql ~* '\m(public|auth|storage|extensions|vault|realtime|graphql)\s*\.' THEN
    RAISE EXCEPTION 'Cross-schema portal query denied';
  END IF;
  -- UPDATE ... SET and INSERT ... ON CONFLICT DO ... are the only supported
  -- statement families that use these words. The leading-command allowlist
  -- already prevents standalone SET and DO statements.
  IF p_sql !~* '^\s*(select|insert|update|delete|with)\M'
     OR p_sql ~* '\m(create|alter|drop|truncate|grant|revoke|copy|call|show|reset|listen|notify|vacuum|analyze)\M' THEN
    RAISE EXCEPTION 'Unsupported portal query';
  END IF;

  IF p_mode = 'all' THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(portal_row)), ''[]''::jsonb) FROM (' || p_sql || ') AS portal_row' INTO result;
    RETURN COALESCE(result, '[]'::jsonb);
  ELSIF p_mode = 'first' THEN
    EXECUTE 'SELECT to_jsonb(portal_row) FROM (' || p_sql || ') AS portal_row LIMIT 1' INTO result;
    RETURN result;
  ELSIF p_mode = 'run' THEN
    EXECUTE p_sql;
    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN jsonb_build_object('success', true, 'meta', jsonb_build_object('changes', affected));
  END IF;
  RAISE EXCEPTION 'Unknown portal query mode';
END;
$function$;

REVOKE ALL ON FUNCTION "firehouse"."execute_server_portal_sql"(p_sql text, p_mode text, p_secret text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.finish_board_feed(p_source text, p_attempt uuid, p_payload_base64 text, p_error text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE saved integer; parsed jsonb;
BEGIN
  IF p_payload_base64 IS NOT NULL THEN
    IF length(p_payload_base64)>180000 THEN RAISE EXCEPTION 'Feed response too large'; END IF;
    parsed := convert_from(decode(p_payload_base64,'base64'),'UTF8')::jsonb;
    IF jsonb_typeof(parsed)<>'object' THEN RAISE EXCEPTION 'Invalid feed response'; END IF;
  END IF;
  UPDATE firehouse.board_feed_cache SET
    payload=CASE WHEN parsed IS NOT NULL THEN parsed ELSE payload END,
    last_success_at=CASE WHEN parsed IS NOT NULL THEN clock_timestamp() ELSE last_success_at END,
    status=CASE WHEN parsed IS NOT NULL THEN 'ok' ELSE 'error' END,
    error_code=CASE WHEN parsed IS NOT NULL THEN NULL ELSE 'source_unavailable' END
  WHERE source=p_source AND attempt_id=p_attempt AND status='updating';
  GET DIAGNOSTICS saved = ROW_COUNT;
  RETURN saved=1;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."finish_board_feed"(p_source text, p_attempt uuid, p_payload_base64 text, p_error text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.finish_cad_push_batch(encoded text)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE changed integer;
BEGIN
 WITH outcomes AS (
   SELECT * FROM jsonb_to_recordset(convert_from(decode(encoded,'base64'),'UTF8')::jsonb)
     AS x(id uuid,lease uuid,status integer)
 ), finished AS (
   UPDATE firehouse.cad_push_deliveries d SET
     state=CASE WHEN o.status BETWEEN 200 AND 299 THEN 'accepted'
       WHEN d.expires_at<=now() THEN 'expired'
       WHEN d.attempts>=5 THEN 'failed'
       WHEN o.status=0 OR o.status=429 OR o.status>=500 THEN 'retry' ELSE 'failed' END,
     accepted_at=CASE WHEN o.status BETWEEN 200 AND 299 THEN now() ELSE NULL END,
     last_status_code=o.status,lease_token=NULL,
     next_attempt_at=now()+make_interval(secs=>least(120,15*(2^least(d.attempts,3))::integer))
   FROM outcomes o WHERE d.id=o.id AND d.lease_token=o.lease AND d.state='sending'
   RETURNING d.*
 ), per_subscription AS (
   SELECT subscription_id,recipient_id,credential_fingerprint,
     bool_or(last_status_code IN (404,410)) dead,bool_and(state='accepted') accepted,
     count(*) FILTER(WHERE state<>'accepted') failures,max(last_status_code) status
   FROM finished GROUP BY subscription_id,recipient_id,credential_fingerprint
 ) UPDATE firehouse.push_subscriptions s SET
   active=CASE WHEN p.dead THEN 0 ELSE s.active END,
   failure_count=CASE WHEN p.accepted THEN 0 ELSE s.failure_count+p.failures END,
   last_success_at=CASE WHEN p.accepted THEN now()::text ELSE s.last_success_at END,
   last_error=CASE WHEN p.accepted THEN '' ELSE 'Push provider status '||p.status::text END,updated_at=now()::text
 FROM per_subscription p WHERE s.id=p.subscription_id AND s.user_id=p.recipient_id
 AND md5(jsonb_build_array(s.endpoint,s.p256dh,s.auth)::text)=p.credential_fingerprint;
 GET DIAGNOSTICS changed=ROW_COUNT;
 RETURN changed;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."finish_cad_push_batch"(encoded text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.finish_scheduler_push_batch(encoded text)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE changed integer;
BEGIN
 WITH outcomes AS (SELECT * FROM jsonb_to_recordset(convert_from(decode(encoded,'base64'),'UTF8')::jsonb) AS x(id uuid,lease uuid,status integer)),
 finished AS (
  UPDATE firehouse.scheduler_push_deliveries d SET state=CASE WHEN o.status BETWEEN 200 AND 299 THEN 'accepted' WHEN d.attempts>=6 THEN 'failed'
   WHEN o.status=0 OR o.status=429 OR o.status>=500 THEN 'retry' ELSE 'failed' END,
   accepted_at=CASE WHEN o.status BETWEEN 200 AND 299 THEN now() ELSE NULL END,last_status_code=o.status,lease_token=NULL,next_attempt_at=now()+interval '5 minutes'
  FROM outcomes o WHERE d.id=o.id AND d.lease_token=o.lease AND d.state='sending' RETURNING d.*
 ), per_subscription AS (
  SELECT subscription_id,recipient_id,credential_fingerprint,bool_or(last_status_code IN (404,410)) dead,bool_and(state='accepted') accepted,
   count(*) FILTER(WHERE state<>'accepted') failures,max(last_status_code) status FROM finished GROUP BY subscription_id,recipient_id,credential_fingerprint
 ) UPDATE firehouse.push_subscriptions s SET active=CASE WHEN p.dead THEN 0 ELSE s.active END,failure_count=CASE WHEN p.accepted THEN 0 ELSE s.failure_count+p.failures END,
  last_success_at=CASE WHEN p.accepted THEN now()::text ELSE s.last_success_at END,last_error=CASE WHEN p.accepted THEN '' ELSE 'Push provider status '||p.status::text END,updated_at=now()::text
 FROM per_subscription p WHERE s.id=p.subscription_id AND s.user_id=p.recipient_id AND md5(jsonb_build_array(s.endpoint,s.p256dh,s.auth)::text)=p.credential_fingerprint;
 GET DIAGNOSTICS changed=ROW_COUNT;
 RETURN changed;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."finish_scheduler_push_batch"(encoded text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.guard_new_station_trade()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'firehouse', 'pg_temp'
AS $function$
BEGIN
  -- Serialize submissions for this shift without deleting legacy duplicates.
  PERFORM 1 FROM station_shift_slots WHERE id IN (NEW.slot_id, NEW.return_slot_id) ORDER BY id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM station_shift_slots WHERE id = NEW.slot_id
      AND employee_id = NEW.from_employee_id AND status = 'filled') THEN
    RAISE EXCEPTION 'The offered shift assignment changed. Refresh and try again.';
  END IF;
  IF EXISTS (SELECT 1 FROM station_trade_requests WHERE slot_id = NEW.slot_id
      AND status IN ('pending', 'awaiting_acceptance')) THEN
    RAISE EXCEPTION 'This shift already has an open trade request.';
  END IF;
  IF NEW.return_slot_id IS NOT NULL AND
      (NEW.return_slot_id = NEW.slot_id OR NEW.target_employee_id IS NULL OR
       NOT EXISTS (SELECT 1 FROM station_shift_slots WHERE id = NEW.return_slot_id
         AND employee_id = NEW.target_employee_id AND status = 'filled')) THEN
    RAISE EXCEPTION 'Choose a different return shift belonging to the selected member.';
  END IF;
  RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."guard_new_station_trade"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.has_department_access()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    COALESCE(
      NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role' = 'service_role',
      false
    )
    OR COALESCE(public.is_platform_owner(), false)
    OR EXISTS (
      SELECT 1
      FROM public.department_memberships AS membership
      JOIN public.departments AS department ON department.id = membership.department_id
      WHERE membership.user_id = (SELECT auth.uid())
        AND membership.status = 'active'
        AND department.slug = 'stickney-fire-department'
    );
$function$;

REVOKE ALL ON FUNCTION "firehouse"."has_department_access"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.ingest_apparatus_location(p_hash text, p_fix_base64 text, p_now timestamp with time zone DEFAULT clock_timestamp())
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE tracker firehouse.apparatus_trackers; fix jsonb; lat double precision; lng double precision;
 accuracy_m double precision; measured timestamptz; moved boolean;
BEGIN
 SELECT * INTO tracker FROM firehouse.apparatus_trackers WHERE token_hash=p_hash FOR UPDATE;
 IF NOT FOUND OR NOT tracker.enabled OR tracker.expires_at<=p_now THEN RETURN jsonb_build_object('accepted',false,'reason','device_revoked'); END IF;
 IF NOT EXISTS (SELECT 1 FROM firehouse.fleet_apparatus WHERE id=tracker.apparatus_id AND (retired_at IS NULL OR retired_at=''))
 THEN RETURN jsonb_build_object('accepted',false,'reason','device_revoked'); END IF;
 IF tracker.received_at>p_now-interval '4 seconds' THEN RETURN jsonb_build_object('accepted',false,'reason','rate_limited','retryAfterMs',5000); END IF;
 IF length(p_fix_base64)>4096 THEN RETURN jsonb_build_object('accepted',false,'reason','invalid_fix'); END IF;
 BEGIN
  fix:=convert_from(decode(p_fix_base64,'base64'),'UTF8')::jsonb;
  IF jsonb_typeof(fix->'latitude')<>'number' OR jsonb_typeof(fix->'longitude')<>'number' OR jsonb_typeof(fix->'accuracy')<>'number'
   OR jsonb_typeof(fix->'measuredAt')<>'string' OR jsonb_typeof(fix->'moving')<>'boolean'
  THEN RETURN jsonb_build_object('accepted',false,'reason','invalid_fix'); END IF;
  lat:=(fix->>'latitude')::double precision; lng:=(fix->>'longitude')::double precision;
  accuracy_m:=(fix->>'accuracy')::double precision; measured:=(fix->>'measuredAt')::timestamptz; moved:=(fix->>'moving')::boolean;
 EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('accepted',false,'reason','invalid_fix'); END;
 IF lat IS NULL OR lng IS NULL OR accuracy_m IS NULL OR measured IS NULL OR moved IS NULL
 OR NOT (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180 AND accuracy_m>0 AND accuracy_m<=75)
 OR measured<p_now-interval '30 seconds' OR measured>p_now+interval '5 seconds'
 THEN RETURN jsonb_build_object('accepted',false,'reason','invalid_fix'); END IF;
 IF tracker.fix_at IS NOT NULL AND measured<=tracker.fix_at THEN RETURN jsonb_build_object('accepted',false,'reason','old_fix'); END IF;
 UPDATE firehouse.apparatus_trackers SET latitude=lat,longitude=lng,accuracy=accuracy_m,fix_at=measured,
  received_at=p_now,moving=moved,sequence=sequence+1
 WHERE department_id=tracker.department_id AND apparatus_id=tracker.apparatus_id;
 RETURN jsonb_build_object('accepted',true,'apparatusId',tracker.apparatus_id,'deviceId',tracker.device_id,'sequence',tracker.sequence+1);
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."ingest_apparatus_location"(p_hash text, p_fix_base64 text, p_now timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.issue_apparatus_location_lease(p_department uuid, p_user uuid)
 RETURNS TABLE(topic text, "expiresAt" timestamp with time zone, "serverTime" timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE checked_at timestamptz:=clock_timestamp();
BEGIN
 RETURN QUERY INSERT INTO firehouse.apparatus_location_view_leases(department_id,user_id,topic,expires_at)
 VALUES(p_department,p_user,firehouse.apparatus_location_topic(p_department,checked_at),date_trunc('minute',checked_at)+interval '1 minute')
 ON CONFLICT(user_id,department_id) DO UPDATE SET topic=excluded.topic,expires_at=excluded.expires_at
 RETURNING apparatus_location_view_leases.topic,apparatus_location_view_leases.expires_at,checked_at;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."issue_apparatus_location_lease"(p_department uuid, p_user uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.issue_operational_view_lease(p_department uuid, p_user uuid, p_scopes text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE checked timestamptz:=clock_timestamp(); scope_name text; results jsonb:='[]'::jsonb; versions jsonb; sent boolean;
 expires timestamptz:=date_trunc('minute',checked)+interval '1 minute'; topic_name text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.departments WHERE id=p_department AND slug='stickney-fire-department')
  OR p_user IS NULL OR NOT (p_scopes <@ ARRAY['respond','board']::text[]) THEN RAISE EXCEPTION 'Invalid operational view scope'; END IF;
 FOREACH scope_name IN ARRAY p_scopes LOOP
  topic_name:=firehouse.operational_topic(p_department,scope_name,checked);
  INSERT INTO firehouse.operational_view_leases(department_id,user_id,scope,topic,expires_at)
  VALUES(p_department,p_user,scope_name,topic_name,expires)
  ON CONFLICT(user_id,department_id,scope) DO UPDATE SET topic=excluded.topic,expires_at=excluded.expires_at
  WHERE operational_view_leases.topic IS DISTINCT FROM excluded.topic;
  SELECT coalesce(jsonb_object_agg(section,revision::text),'{}'::jsonb),coalesce(bool_and(queued),true) INTO versions,sent
  FROM firehouse.operational_revisions WHERE department_id=p_department AND (CASE WHEN scope_name='respond' THEN section='respond' ELSE section<>'respond' END);
  results:=results||jsonb_build_array(jsonb_build_object('scope',scope_name,'topic',topic_name,'expiresAt',expires,'revisions',versions,'queued',sent));
 END LOOP;
 RETURN jsonb_build_object('departmentId',p_department,'userId',p_user,'serverTime',checked,'leases',results);
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."issue_operational_view_lease"(p_department uuid, p_user uuid, p_scopes text[]) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.keep_payroll_submission_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN RAISE EXCEPTION 'PAYROLL_SNAPSHOT_LOCKED: Submitted copies and approved adjustments cannot be edited or deleted.'; END $function$;

REVOKE ALL ON FUNCTION "firehouse"."keep_payroll_submission_immutable"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.keep_submitted_attendance_open()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status = 'finalized' AND (EXISTS (SELECT 1 FROM firehouse.payroll_submissions WHERE period_start = NEW.start_date) OR EXISTS (SELECT 1 FROM firehouse.payroll_adjustments WHERE target_period = NEW.start_date)) THEN
    RAISE EXCEPTION 'PAYROLL_SNAPSHOT_LOCKED: Use the submitted copy workflow; keep actual attendance open for reconciliation.';
  END IF;
  RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."keep_submitted_attendance_open"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.link_employee_account(p_user uuid, p_employee text, p_actor text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_email text; v_existing text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('employee-account-link',0));
  SELECT u.email INTO v_email FROM auth.users u
  WHERE u.id=p_user AND u.email_confirmed_at IS NOT NULL AND (lower(btrim(u.email))='bobff353@gmail.com' OR EXISTS(
    SELECT 1 FROM public.department_memberships m JOIN public.departments d ON d.id=m.department_id
    WHERE m.user_id=u.id AND m.status='active' AND d.slug='stickney-fire-department'));
  IF v_email IS NULL THEN RAISE EXCEPTION 'An active verified department account is required'; END IF;
  SELECT firehouse.employee_id_for_login(v_email) INTO v_existing;
  IF v_existing IS NOT NULL AND v_existing<>p_employee THEN RAISE EXCEPTION 'Account already belongs to another employee'; END IF;
  IF EXISTS(SELECT 1 FROM firehouse.employee_account_links WHERE user_id=p_user AND employee_id<>p_employee)
    OR EXISTS(SELECT 1 FROM firehouse.employee_profiles WHERE lower(btrim(email))=lower(btrim(v_email)) AND employee_id<>p_employee)
    THEN RAISE EXCEPTION 'Conflicting employee identity; review existing link first'; END IF;
  IF NOT EXISTS(SELECT 1 FROM firehouse.employees e LEFT JOIN firehouse.employee_profiles ep ON ep.employee_id=e.id
    WHERE e.id=p_employee AND e.active=1
    AND (NULLIF(ep.start_date,'') IS NULL OR ep.start_date<=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD'))
    AND (NULLIF(ep.end_date,'') IS NULL OR ep.end_date>=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD')))
    THEN RAISE EXCEPTION 'Choose a current employee'; END IF;
  INSERT INTO firehouse.employee_account_links(user_id,employee_id,linked_by) VALUES(p_user,p_employee,p_actor) ON CONFLICT(user_id) DO NOTHING;
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION "firehouse"."link_employee_account"(p_user uuid, p_employee text, p_actor text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.next_board_feed_slot(p_source text, p_now timestamp with time zone)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE local_now timestamp := p_now AT TIME ZONE 'America/Chicago'; candidate timestamp;
BEGIN
  IF p_source = 'weather' THEN
    RETURN to_timestamp((floor(extract(epoch FROM p_now) / 900) + 1) * 900);
  END IF;
  candidate := date_trunc('day',local_now) + interval '6 hours';
  IF local_now >= candidate THEN
    IF p_source IN ('close_calls','usfa') AND local_now < date_trunc('day',local_now) + interval '18 hours' THEN
      candidate := date_trunc('day',local_now) + interval '18 hours';
    ELSE candidate := candidate + interval '1 day'; END IF;
  END IF;
  RETURN candidate AT TIME ZONE 'America/Chicago';
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."next_board_feed_slot"(p_source text, p_now timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.notify_operational_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE dept uuid; configured uuid; part text; version bigint; event_id uuid; channel text; sent boolean;
BEGIN
 IF current_setting('role',true)='authenticated' AND auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Authenticated source writes require a verified identity';
 END IF;
 IF TG_OP='UPDATE' AND to_jsonb(NEW) IS NOT DISTINCT FROM to_jsonb(OLD) THEN RETURN NULL; END IF;
 SELECT id INTO configured FROM public.departments WHERE slug='stickney-fire-department';
 IF configured IS NULL THEN RAISE EXCEPTION 'Operational department is not configured'; END IF;
 FOR dept IN SELECT DISTINCT value::uuid FROM unnest(CASE WHEN TG_TABLE_SCHEMA='public'
  THEN ARRAY[to_jsonb(NEW)->>'department_id',to_jsonb(OLD)->>'department_id']
  ELSE ARRAY[configured::text] END) d(value) WHERE value IS NOT NULL
 LOOP
  IF dept<>configured THEN CONTINUE; END IF;
  -- Serialize revision locks per department even when a transaction touches
  -- several source tables in a different order. Source rows retain their locks.
  PERFORM pg_advisory_xact_lock(hashtextextended('operational:'||dept::text,0));
  FOR part IN SELECT value FROM unnest(string_to_array(TG_ARGV[0],',')) s(value) ORDER BY value LOOP
   INSERT INTO firehouse.operational_revisions(department_id,section,revision,updated_at) VALUES(dept,part,1,clock_timestamp())
   ON CONFLICT(department_id,section) DO UPDATE SET revision=operational_revisions.revision+1,updated_at=excluded.updated_at
   RETURNING revision INTO version;
   event_id:=gen_random_uuid();
   channel:=firehouse.operational_topic(dept,CASE WHEN part='respond' THEN 'respond' ELSE 'board' END);
   sent:=false;
   BEGIN
    PERFORM realtime.send(jsonb_build_object('id',event_id,'section',part,'revision',version::text),'changed',channel,true);
    SELECT EXISTS(SELECT 1 FROM realtime.messages WHERE inserted_at=transaction_timestamp()::timestamp
     AND topic=channel AND extension='broadcast' AND private IS TRUE AND payload->>'id'=event_id::text) INTO sent;
   EXCEPTION WHEN OTHERS THEN sent:=false;
   END;
   UPDATE firehouse.operational_revisions SET queued=sent WHERE department_id=dept AND section=part;
  END LOOP;
 END LOOP;
 RETURN NULL;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."notify_operational_change"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.operational_topic(p_department uuid, p_scope text, p_now timestamp with time zone DEFAULT clock_timestamp())
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 SELECT 'operations:'||p_department::text||':'||p_scope||':'||floor(extract(epoch FROM p_now)/60)::bigint::text
$function$;

REVOKE ALL ON FUNCTION "firehouse"."operational_topic"(p_department uuid, p_scope text, p_now timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.pair_apparatus_tracker(p_department uuid, p_apparatus text, p_hash text, p_device_base64 text)
 RETURNS TABLE("deviceId" uuid, "expiresAt" timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE device jsonb; rig record;
BEGIN
 SELECT * INTO rig FROM firehouse.apparatus_location_fleet(p_department) WHERE id=p_apparatus;
 IF NOT FOUND THEN RAISE EXCEPTION 'Select a department fleet apparatus'; END IF;
 device:=convert_from(decode(p_device_base64,'base64'),'UTF8')::jsonb;
 -- Add a tracker-compatible reference only when paired. Existing IDs and fixes stay intact.
 INSERT INTO firehouse.fleet_apparatus(id,unit_number,name,status,created_by,updated_by)
 VALUES(rig.id,rig.unit_number,rig.name,rig.status,device->>'actor',device->>'actor')
 ON CONFLICT(id) DO NOTHING;
 RETURN QUERY INSERT INTO firehouse.apparatus_trackers(department_id,apparatus_id,token_hash,device_name,sender_kind,paired_by)
 VALUES(p_department,p_apparatus,p_hash,device->>'name',device->>'kind',device->>'actor')
 ON CONFLICT(department_id,apparatus_id) DO UPDATE SET device_id=gen_random_uuid(),token_hash=excluded.token_hash,
 device_name=excluded.device_name,sender_kind=excluded.sender_kind,enabled=true,expires_at=clock_timestamp()+interval '90 days',
 paired_by=excluded.paired_by,paired_at=clock_timestamp(),sequence=apparatus_trackers.sequence+1
 RETURNING apparatus_trackers.device_id,apparatus_trackers.expires_at;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."pair_apparatus_tracker"(p_department uuid, p_apparatus text, p_hash text, p_device_base64 text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.payroll_sources_will_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  -- Same transaction lock as the portal batch executor: serialize source
  -- changes with preview-version checks and immutable ledger inserts.
  PERFORM pg_catalog.pg_advisory_xact_lock(74192026);
  UPDATE firehouse.payroll_source_version SET version = version + 1 WHERE id = 1;
  RETURN NULL;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."payroll_sources_will_change"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.protect_finalized_time_entry()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE period record; starts text[] := ARRAY[]::text[];
BEGIN
  IF TG_OP <> 'INSERT' THEN starts := array_append(starts, OLD.period_start); END IF;
  IF TG_OP <> 'DELETE' THEN starts := array_append(starts, NEW.period_start); END IF;
  FOR period IN SELECT start_date,status FROM firehouse.pay_periods WHERE start_date = ANY(starts) ORDER BY start_date FOR UPDATE LOOP
    IF period.status = 'finalized' THEN
      RAISE EXCEPTION 'PAYROLL_FINALIZED: Reopen this payroll period before changing hours.' USING ERRCODE = '55000';
    END IF;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."protect_finalized_time_entry"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.publish_apparatus_location()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE payload jsonb; notification_id uuid:=gen_random_uuid(); channel_topic text;
BEGIN
 SELECT jsonb_build_object('apparatusId',f.id,'unit',f.unit_number,'name',f.name,'fleetStatus',f.status,
  'deviceId',NEW.device_id,'deviceName',NEW.device_name,'senderKind',NEW.sender_kind,
  'enabled',NEW.enabled AND NEW.expires_at>clock_timestamp(),'latitude',NEW.latitude,'longitude',NEW.longitude,
  'accuracy',NEW.accuracy,'fixAt',NEW.fix_at,'receivedAt',NEW.received_at,'moving',NEW.moving,'sequence',NEW.sequence)
 INTO payload FROM firehouse.fleet_apparatus f WHERE f.id=NEW.apparatus_id;
 channel_topic:=firehouse.apparatus_location_topic(NEW.department_id);
 payload:=payload||jsonb_build_object('id',notification_id);
 PERFORM realtime.send(payload,'location',channel_topic,true);
 -- The installed realtime.send catches insert errors and only warns. Verify
 -- its receipt before committing the position. Equality on inserted_at plus
 -- topic uses the provider's existing partial index and prunes old partitions.
 IF NOT EXISTS(SELECT 1 FROM realtime.messages WHERE inserted_at=transaction_timestamp()::timestamp
  AND topic=channel_topic AND extension='broadcast' AND private IS TRUE AND messages.payload->>'id'=notification_id::text)
 THEN RAISE EXCEPTION 'Location notification was not queued'; END IF;
 RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."publish_apparatus_location"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.save_portal_confirmation(encoded text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE body jsonb:=convert_from(decode(encoded,'base64'),'UTF8')::jsonb; previous record; saved_id uuid;
BEGIN
 SELECT message_id INTO saved_id FROM firehouse.portal_confirmation_setting WHERE department_id='14a76771-4c24-481b-8def-e6cce005c17b' FOR UPDATE;
 IF coalesce(saved_id::text,'')<>coalesce(body->>'version','') THEN RAISE EXCEPTION 'CONFIRMATION_CONFLICT'; END IF;
 SELECT * INTO previous FROM firehouse.portal_confirmation_messages WHERE id=saved_id;
 IF FOUND AND previous.title=body->>'title' AND previous.message=body->>'message' AND previous.enabled=(body->>'enabled')::boolean THEN RETURN saved_id; END IF;
 INSERT INTO firehouse.portal_confirmation_messages(title,message,enabled,created_by) VALUES(body->>'title',body->>'message',(body->>'enabled')::boolean,body->>'actor') RETURNING id INTO saved_id;
 UPDATE firehouse.portal_confirmation_setting SET message_id=saved_id WHERE department_id='14a76771-4c24-481b-8def-e6cce005c17b';
 RETURN saved_id;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."save_portal_confirmation"(encoded text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.scheduler_claim_deadline_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE slot record;
BEGIN
 IF NEW.status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;
 SELECT s.status,s.request_deadline,en.entry_date,coalesce(nullif(s.start_time,''),t.start_time) start_time,t.active
 INTO slot FROM firehouse.station_shift_slots s JOIN firehouse.station_schedule_entries en ON en.id=s.entry_id
 JOIN firehouse.station_shift_types t ON t.id=en.shift_type_id WHERE s.id=NEW.slot_id FOR UPDATE OF s,en,t;
 IF NOT FOUND OR slot.status<>'open' OR slot.active<>1 OR
   ((slot.entry_date||' '||slot.start_time)::timestamp AT TIME ZONE 'America/Chicago')<=clock_timestamp() OR
   (slot.request_deadline<>'' AND (slot.request_deadline::timestamp AT TIME ZONE 'America/Chicago')<=clock_timestamp())
 THEN RAISE EXCEPTION 'SHIFT_REQUEST_CLOSED'; END IF;
 IF EXISTS(SELECT 1 FROM firehouse.station_shift_claims WHERE slot_id=NEW.slot_id AND employee_id=NEW.employee_id AND status='pending')
 THEN RAISE EXCEPTION 'SHIFT_REQUEST_DUPLICATE'; END IF;
 RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."scheduler_claim_deadline_guard"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.scheduler_push_permission(recipient text, permission text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE actor_email text; employee record; matches integer; effect_value text; saved boolean;
BEGIN
 IF permission NOT IN ('scheduling.view','scheduling.manage') OR recipient IS NULL OR recipient !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RETURN false; END IF;
 SELECT lower(btrim(u.email)) INTO actor_email FROM auth.users u WHERE u.id=recipient::uuid AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now());
 IF actor_email IS NULL THEN RETURN false; END IF;
 IF actor_email='bobff353@gmail.com' AND EXISTS(SELECT 1 FROM public.platform_owners p WHERE lower(btrim(p.email))=actor_email) THEN RETURN true; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.department_memberships m WHERE m.department_id='14a76771-4c24-481b-8def-e6cce005c17b' AND m.user_id=recipient::uuid AND m.status='active') THEN RETURN false; END IF;
 SELECT count(*) INTO matches FROM firehouse.employees e JOIN firehouse.employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND lower(btrim(ep.email))=actor_email;
 IF matches<>1 THEN RETURN false; END IF;
 SELECT e.id,p.label rank,coalesce(ep.is_admin,0) is_admin,ep.end_date INTO employee
 FROM firehouse.employees e JOIN firehouse.employee_profiles ep ON ep.employee_id=e.id JOIN firehouse.pay_scales p ON p.id=e.pay_scale_id WHERE e.active=1 AND lower(btrim(ep.email))=actor_email;
 IF NOT FOUND OR (coalesce(employee.end_date,'')<>'' AND employee.end_date<to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD')) THEN RETURN false; END IF;
 SELECT effect INTO effect_value FROM firehouse.employee_permission_overrides WHERE employee_id=employee.id AND permission_key=permission;
 IF effect_value='deny' THEN RETURN false; END IF;
 IF effect_value='allow' THEN RETURN true; END IF;
 IF employee.is_admin=1 THEN RETURN true; END IF;
 SELECT allowed=1 INTO saved FROM firehouse.rank_permissions WHERE rank=employee.rank AND permission_key=permission;
 IF FOUND THEN RETURN saved; END IF;
 RETURN permission='scheduling.view' OR lower(employee.rank) ~ '(chief|captain|lieutenant)';
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."scheduler_push_permission"(recipient text, permission text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.scheduler_push_recipient_allowed(event firehouse.scheduler_push_events, recipient text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE member_id text; qualifications record; slot firehouse.scheduler_reminder_slots; claim record; can_manage boolean;
BEGIN
 IF event.department_id<>'14a76771-4c24-481b-8def-e6cce005c17b'::uuid THEN RETURN false; END IF;
 can_manage=firehouse.scheduler_push_permission(recipient,'scheduling.manage');
 IF NOT can_manage AND NOT firehouse.scheduler_push_permission(recipient,'scheduling.view') THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM firehouse.scheduler_reminder_candidates(event.source_kind,event.source_id) c WHERE c.rule_id=event.rule_id AND c.version=event.version AND c.timing=event.timing) THEN RETURN false; END IF;
 SELECT ep.employee_id INTO member_id FROM firehouse.employee_profiles ep JOIN firehouse.employees e ON e.id=ep.employee_id AND e.active=1 JOIN auth.users u ON lower(btrim(u.email))=lower(btrim(ep.email)) WHERE u.id=recipient::uuid;
 IF event.source_kind='claim' THEN
  SELECT c.employee_id INTO claim FROM firehouse.station_shift_claims c WHERE c.id=event.source_id;
  RETURN can_manage OR claim.employee_id=member_id;
 END IF;
 SELECT * INTO slot FROM firehouse.scheduler_reminder_slots s WHERE s.id=event.source_id AND s.status='open';
 IF NOT FOUND OR member_id IS NULL THEN RETURN false; END IF;
 SELECT p.label rank,coalesce(ep.single_role,0) single_role,coalesce(ep.acting_officer_eligible,0) acting_officer_eligible,coalesce(ep.driver_status,'') driver_status INTO qualifications FROM firehouse.employees e JOIN firehouse.employee_profiles ep ON ep.employee_id=e.id JOIN firehouse.pay_scales p ON p.id=e.pay_scale_id WHERE e.id=member_id AND coalesce(btrim(ep.end_date),'')='';
 IF NOT FOUND OR slot.role NOT IN ('Extra member','Firefighter','Training/Orientation','Officer/AO','Engine Driver','Ambulance Driver','FF/Attendant') THEN RETURN false; END IF;
 IF slot.role NOT IN ('Extra member','Firefighter','Training/Orientation') THEN
  IF qualifications.single_role=1 OR lower(qualifications.rank) ~ '\msingle[-\s]*role\M' THEN RETURN false; END IF;
  IF NOT (lower(qualifications.rank) ~ '\m(chief|captain|lieutenant)\M' OR qualifications.acting_officer_eligible=1) THEN
   IF slot.role='Officer/AO' THEN RETURN false; END IF;
   IF slot.role='Engine Driver' AND lower(btrim(qualifications.driver_status))<>'cleared' THEN RETURN false; END IF;
   IF slot.role='Ambulance Driver' AND lower(btrim(qualifications.driver_status)) NOT IN ('cleared','ambulance only') THEN RETURN false; END IF;
  END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM firehouse.station_shift_claims c WHERE c.slot_id=slot.id AND c.employee_id=member_id AND c.status='pending') THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM firehouse.scheduler_reminder_slots occupied WHERE occupied.employee_id=member_id AND occupied.status='filled'
  AND occupied.entry_date BETWEEN to_char(slot.local_start-interval '1 day','YYYY-MM-DD') AND to_char(slot.local_start+interval '1 day','YYYY-MM-DD')
  AND occupied.local_start<slot.local_end AND slot.local_start<occupied.local_end) THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM firehouse.station_availability a WHERE a.employee_id=member_id AND a.status='unavailable' AND a.availability_date=slot.entry_date AND
  (a.all_day=1 OR ((a.availability_date||' '||a.start_time)::timestamp<slot.local_end AND
   (a.availability_date||' '||a.end_time)::timestamp+CASE WHEN a.end_time<=a.start_time THEN interval '1 day' ELSE interval '0' END>slot.local_start))) THEN RETURN false; END IF;
 RETURN true;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."scheduler_push_recipient_allowed"(event firehouse.scheduler_push_events, recipient text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.scheduler_reminder_candidates(kind_filter text DEFAULT NULL::text, id_filter text DEFAULT NULL::text)
 RETURNS TABLE(rule_id text, source_id text, source_kind text, version text, timing text, due_at timestamp with time zone, expires_at timestamp with time zone, payload jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 WITH sources AS (
  SELECT r.id rule_id,r.type,r.offsets,r.push_enabled_at,s.id source_id,'slot'::text source_kind,
   md5(jsonb_build_array(s.reminder_changed_at,s.local_start,s.local_end,s.request_deadline)::text) version,
   s.reminder_changed_at changed_at,
   CASE WHEN r.type='request_deadline' THEN nullif(s.request_deadline,'')::timestamp ELSE s.local_start END anchor,
   least(s.local_start AT TIME ZONE 'America/Chicago',coalesce(nullif(s.request_deadline,'')::timestamp AT TIME ZONE 'America/Chicago',s.local_start AT TIME ZONE 'America/Chicago')) cutoff,
   s.entry_date,s.role,'Open position'::text message
  FROM firehouse.station_reminder_rules r JOIN firehouse.scheduler_reminder_slots s ON s.status='open' AND s.shift_active=1
  WHERE r.enabled=1 AND r.push_enabled=1 AND r.type IN ('open_shift_blast','request_deadline')
   AND (kind_filter IS NULL OR kind_filter='slot') AND (id_filter IS NULL OR s.id=id_filter)
   AND s.entry_date>=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD')
   AND (s.entry_date<=to_char((now() AT TIME ZONE 'America/Chicago')+interval '62 days','YYYY-MM-DD') OR s.reminder_changed_at>now()-interval '24 hours'
    OR (s.request_deadline<>'' AND s.request_deadline<=to_char((now() AT TIME ZONE 'America/Chicago')+interval '62 days','YYYY-MM-DD"T"HH24:MI')))
   AND (r.type<>'request_deadline' OR s.request_deadline<>'')
  UNION ALL
  SELECT r.id,r.type,r.offsets,r.push_enabled_at,c.id,'claim',
   md5(jsonb_build_array(c.reminder_changed_at,c.status,s.local_start,s.local_end)::text),c.reminder_changed_at,s.local_start,
   s.local_start AT TIME ZONE 'America/Chicago',s.entry_date,s.role,'Shift request: '||c.status
  FROM firehouse.station_reminder_rules r JOIN firehouse.station_shift_claims c ON true JOIN firehouse.scheduler_reminder_slots s ON s.id=c.slot_id AND s.shift_active=1
  WHERE r.enabled=1 AND r.push_enabled=1 AND r.type='shift_request'
   AND (kind_filter IS NULL OR kind_filter='claim') AND (id_filter IS NULL OR c.id=id_filter)
   AND s.entry_date>=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD')
   AND (s.entry_date<=to_char((now() AT TIME ZONE 'America/Chicago')+interval '62 days','YYYY-MM-DD') OR c.reminder_changed_at>now()-interval '24 hours')
 ), timings AS (
  SELECT x.*,o.timing,firehouse.scheduler_reminder_due(x.anchor,x.changed_at,o.timing) due_at
  FROM sources x CROSS JOIN LATERAL jsonb_array_elements_text(x.offsets::jsonb) o(timing)
  WHERE x.source_kind<>'claim' OR o.timing='immediate' OR EXISTS(SELECT 1 FROM firehouse.station_shift_claims c WHERE c.id=x.source_id AND c.status='pending')
 ) SELECT rule_id,source_id,source_kind,version,timing,due_at,least(cutoff,due_at+interval '24 hours'),
 jsonb_build_object('title','Stickney schedule reminder','body',message||' · '||entry_date||' · '||role,'url','/?page=scheduling&display=portal','kind','scheduler')
 FROM timings WHERE due_at>=push_enabled_at AND due_at<=now() AND cutoff>now() AND due_at>now()-interval '24 hours';
$function$;

REVOKE ALL ON FUNCTION "firehouse"."scheduler_reminder_candidates"(kind_filter text, id_filter text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.scheduler_reminder_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 IF TG_TABLE_NAME='station_reminder_rules' THEN
  IF NEW.push_enabled=1 AND NEW.enabled=1 AND
    (OLD.push_enabled<>1 OR OLD.enabled<>1 OR NEW.offsets IS DISTINCT FROM OLD.offsets) THEN NEW.push_enabled_at=now(); END IF;
 ELSIF TG_OP='INSERT' OR (to_jsonb(NEW)-'reminder_changed_at'-'updated_at'-'sort_order'-'staffing_reason') IS DISTINCT FROM (to_jsonb(OLD)-'reminder_changed_at'-'updated_at'-'sort_order'-'staffing_reason') THEN
  NEW.reminder_changed_at=now();
 END IF;
 RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION "firehouse"."scheduler_reminder_changed"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.scheduler_reminder_due(anchor timestamp without time zone, changed_at timestamp with time zone, timing text)
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 SELECT CASE WHEN timing='immediate' THEN changed_at
  WHEN timing ~ '^[1-9][0-9]? days? before$' AND split_part(timing,' ',1)::integer<=60 THEN (anchor-make_interval(days=>split_part(timing,' ',1)::integer)) AT TIME ZONE 'America/Chicago'
  WHEN timing ~ '^[1-9][0-9]{0,2} hours? before$' AND split_part(timing,' ',1)::integer<=168 THEN (anchor AT TIME ZONE 'America/Chicago')-make_interval(hours=>split_part(timing,' ',1)::integer)
 END;
$function$;

REVOKE ALL ON FUNCTION "firehouse"."scheduler_reminder_due"(anchor timestamp without time zone, changed_at timestamp with time zone, timing text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.system_health_login_audit()
 RETURNS TABLE(monitoring_since timestamp with time zone, attempt_count_24h bigint, failed_count_24h bigint, last_event_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT firehouse.has_department_access() THEN
    RAISE EXCEPTION 'Stickney department access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    status.enabled_at,
    COUNT(audit.id) FILTER (WHERE audit.occurred_at >= now() - interval '24 hours')::bigint,
    COUNT(audit.id) FILTER (
      WHERE audit.occurred_at >= now() - interval '24 hours'
        AND audit.outcome <> 'success'
    )::bigint,
    MAX(audit.occurred_at)
  FROM firehouse.portal_login_audit_status AS status
  LEFT JOIN firehouse.portal_login_audit AS audit ON true
  WHERE status.singleton = true
  GROUP BY status.enabled_at;
END;
$function$;

REVOKE ALL ON FUNCTION "firehouse"."system_health_login_audit"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.system_health_usage()
 RETURNS TABLE(database_bytes bigint, storage_bytes bigint, object_count bigint, bucket_count bigint, auth_user_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NOT firehouse.has_department_access() THEN
    RAISE EXCEPTION 'Stickney department access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    pg_database_size(current_database())::bigint,
    (SELECT COALESCE(SUM(
      CASE
        WHEN objects.metadata->>'size' ~ '^[0-9]+$'
          THEN (objects.metadata->>'size')::bigint
        ELSE 0
      END
    ), 0)::bigint FROM storage.objects AS objects),
    (SELECT COUNT(*)::bigint FROM storage.objects),
    (SELECT COUNT(*)::bigint FROM storage.buckets),
    (SELECT COUNT(*)::bigint FROM auth.users);
END;
$function$;

REVOKE ALL ON FUNCTION "firehouse"."system_health_usage"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION firehouse.verify_portal_login(p_email text, p_pin text, p_department_id uuid)
 RETURNS TABLE(ok boolean, email text, locked_until timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  normalized_email text := lower(trim(coalesce(p_email, '')));
  target_user_id uuid;
  verified_email text;
  credentials public.portal_pin_credentials%ROWTYPE;
  next_failed_attempts integer;
BEGIN
  IF normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     OR coalesce(p_pin, '') !~ '^\d{4,6}$'
     OR p_department_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT auth_user.id, lower(auth_user.email)
  INTO target_user_id, verified_email
  FROM auth.users AS auth_user
  JOIN public.portal_pin_credentials AS pin_credentials
    ON pin_credentials.user_id = auth_user.id
  WHERE lower(auth_user.email) = normalized_email
    AND (
      EXISTS (
        SELECT 1
        FROM public.department_memberships AS membership
        WHERE membership.user_id = auth_user.id
          AND membership.department_id = p_department_id
          AND membership.status = 'active'
      )
      OR EXISTS (
        SELECT 1
        FROM public.platform_owners AS owner_record
        WHERE lower(owner_record.email) = normalized_email
      )
    )
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT * INTO credentials
  FROM public.portal_pin_credentials AS pin_credentials
  WHERE pin_credentials.user_id = target_user_id
  FOR UPDATE;

  IF credentials.locked_until IS NOT NULL AND credentials.locked_until > now() THEN
    RETURN QUERY SELECT false, NULL::text, credentials.locked_until;
    RETURN;
  END IF;

  IF extensions.crypt(p_pin, credentials.pin_hash) = credentials.pin_hash THEN
    UPDATE public.portal_pin_credentials SET
      failed_attempts = 0,
      locked_until = NULL,
      updated_at = now()
    WHERE user_id = target_user_id;
    RETURN QUERY SELECT true, verified_email, NULL::timestamptz;
    RETURN;
  END IF;

  next_failed_attempts := credentials.failed_attempts + 1;
  UPDATE public.portal_pin_credentials SET
    failed_attempts = CASE WHEN next_failed_attempts >= 5 THEN 0 ELSE next_failed_attempts END,
    locked_until = CASE WHEN next_failed_attempts >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
    unlock_token_hash = NULL,
    unlock_expires_at = NULL,
    updated_at = now()
  WHERE user_id = target_user_id
  RETURNING portal_pin_credentials.locked_until INTO credentials.locked_until;

  RETURN QUERY SELECT false, NULL::text, credentials.locked_until;
END;
$function$;

REVOKE ALL ON FUNCTION "firehouse"."verify_portal_login"(p_email text, p_pin text, p_department_id uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.apply_inventory_location_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  target_compartment record;
  moved_rows integer;
begin
  if old.status <> 'pending' then
    raise exception 'This location request has already been reviewed.';
  end if;

  if new.department_id <> old.department_id
    or new.equipment_id <> old.equipment_id
    or new.check_item_id is distinct from old.check_item_id
    or new.from_apparatus_id <> old.from_apparatus_id
    or new.from_compartment_id <> old.from_compartment_id
    or new.proposed_apparatus_id <> old.proposed_apparatus_id
    or new.proposed_compartment_id <> old.proposed_compartment_id
    or new.requested_by <> old.requested_by
    or new.requested_by_email <> old.requested_by_email
    or new.requested_at <> old.requested_at
  then
    raise exception 'Submitted location details cannot be changed during review.';
  end if;

  if new.status not in ('approved', 'denied') then
    raise exception 'Choose approved or denied.';
  end if;

  if not private.inventory_can_admin(old.department_id) then
    raise exception 'Administrator approval is required.';
  end if;

  select compartment.id, compartment.apparatus_id
    into target_compartment
  from public.inventory_compartments as compartment
  where compartment.department_id = old.department_id
    and compartment.id = old.proposed_compartment_id
    and compartment.apparatus_id = old.proposed_apparatus_id;

  if target_compartment.id is null then
    raise exception 'The proposed compartment is not available for that apparatus.';
  end if;

  new.reviewed_by := (select auth.uid());
  new.reviewed_by_email := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
    new.reviewed_by_email,
    'authenticated administrator'
  );
  new.reviewed_at := now();

  if new.status = 'approved' then
    update public.inventory_equipment
    set apparatus_id = old.proposed_apparatus_id,
        compartment_id = old.proposed_compartment_id
    where department_id = old.department_id
      and id = old.equipment_id
      and apparatus_id = old.from_apparatus_id
      and compartment_id = old.from_compartment_id
      and retired_at is null;

    get diagnostics moved_rows = row_count;
    if moved_rows <> 1 then
      raise exception 'The equipment location changed after this request was submitted. Review the current inventory before approving it.';
    end if;

    if old.from_apparatus_id <> old.proposed_apparatus_id then
      update public.inventory_check_items as item
      set result = 'not_applicable',
          notes = concat_ws(' ', nullif(item.notes, ''), 'Location change approved; item moved to another apparatus.'),
          checked_by = new.reviewed_by_email,
          checked_at = now()
      from public.inventory_checks as check_record
      where item.department_id = old.department_id
        and item.equipment_id = old.equipment_id
        and item.result = 'pending'
        and check_record.id = item.check_id
        and check_record.department_id = old.department_id
        and check_record.apparatus_id = old.from_apparatus_id
        and check_record.check_type = 'inventory'
        and check_record.status = 'in_progress';

      insert into public.inventory_check_items (
        department_id,
        check_id,
        equipment_id,
        result
      )
      select
        old.department_id,
        check_record.id,
        old.equipment_id,
        'pending'
      from public.inventory_checks as check_record
      where check_record.department_id = old.department_id
        and check_record.apparatus_id = old.proposed_apparatus_id
        and check_record.check_type = 'inventory'
        and check_record.status = 'in_progress'
      on conflict (check_id, equipment_id) do nothing;
    end if;
  end if;

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "private"."apply_inventory_location_change"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.audit_inventory_location_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  insert into public.inventory_audit_events (
    department_id,
    actor_id,
    actor_email,
    action,
    aggregate_type,
    aggregate_id,
    next_json
  ) values (
    new.department_id,
    case when tg_op = 'INSERT' then new.requested_by else new.reviewed_by end,
    case when tg_op = 'INSERT' then new.requested_by_email else new.reviewed_by_email end,
    case when tg_op = 'INSERT' then 'location_change_requested' else 'location_change_' || new.status end,
    'inventory_equipment',
    new.equipment_id::text,
    jsonb_build_object(
      'request_id', new.id,
      'status', new.status,
      'from_apparatus_id', new.from_apparatus_id,
      'from_compartment_id', new.from_compartment_id,
      'proposed_apparatus_id', new.proposed_apparatus_id,
      'proposed_compartment_id', new.proposed_compartment_id,
      'review_notes', new.review_notes
    )
  );
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "private"."audit_inventory_location_change"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.department_execute_sql(p_department uuid, p_sql text, p_mode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE target name; result jsonb; affected bigint; forbidden text;
BEGIN
 SELECT schema_name INTO target FROM private.department_portals WHERE department_id=p_department AND schema_name<>'firehouse';
 IF target IS NULL THEN RAISE EXCEPTION 'Department storage is unavailable'; END IF;
 IF p_sql IS NULL OR length(p_sql)>200000 OR p_sql ~ '(;|--|/\*|\*/)' OR p_sql !~* '^\s*(select|insert|update|delete|with)\M'
 OR p_sql ~* '\m(create|alter|drop|truncate|grant|revoke|copy|call|show|reset|listen|notify|vacuum|analyze|set_config|dblink|pg_read_file)\M' THEN RAISE EXCEPTION 'Unsupported portal query'; END IF;
 -- Never allow this executor to select another schema explicitly.
 FOR forbidden IN SELECT nspname FROM pg_namespace WHERE nspname<>target AND nspname<>'pg_temp' LOOP
   IF p_sql ~* ('\m'||forbidden||'\s*\.') OR position('"'||forbidden||'".' in lower(p_sql))>0 THEN RAISE EXCEPTION 'Cross-department query denied' USING ERRCODE='42501'; END IF;
 END LOOP;
 PERFORM set_config('search_path',format('%I,extensions,pg_temp',target),true);
 IF p_mode='all' THEN EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) FROM ('||p_sql||') r' INTO result; RETURN result;
 ELSIF p_mode='first' THEN EXECUTE 'SELECT to_jsonb(r) FROM ('||p_sql||') r LIMIT 1' INTO result; RETURN result;
 ELSIF p_mode='run' THEN EXECUTE p_sql; GET DIAGNOSTICS affected=ROW_COUNT; RETURN jsonb_build_object('success',true,'meta',jsonb_build_object('changes',affected)); END IF;
 RAISE EXCEPTION 'Unknown query mode';
END $function$;

REVOKE ALL ON FUNCTION "private"."department_execute_sql"(p_department uuid, p_sql text, p_mode text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.department_portal_access(p_department uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT auth.uid() IS NOT NULL AND (public.is_platform_owner() OR EXISTS (
 SELECT 1 FROM public.department_memberships m WHERE m.department_id=p_department AND m.user_id=auth.uid() AND m.status='active'));
$function$;

REVOKE ALL ON FUNCTION "private"."department_portal_access"(p_department uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.department_shared_snapshot(p_viewer uuid, p_source uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE item record; plans jsonb; hydrants jsonb; results jsonb:='[]';
BEGIN
 FOR item IN SELECT d.id,d.name,p.schema_name FROM public.departments d JOIN private.department_portals p ON p.department_id=d.id WHERE d.id<>p_viewer AND (p_source IS NULL OR d.id=p_source) ORDER BY d.name LOOP
   EXECUTE format($sql$SELECT coalesce(jsonb_agg((to_jsonb(p)-'created_by'-'updated_by'-'draft_owner'-'published_by'-'archived_by') || jsonb_build_object(
   'features',(SELECT coalesce(jsonb_agg(to_jsonb(f)-'created_by'-'updated_by'-'verified_by'),'[]'::jsonb) FROM %1$I.field_preplan_features f WHERE f.preplan_id=p.id),
   'levels',(SELECT coalesce(jsonb_agg(to_jsonb(f)-'created_by'-'updated_by'),'[]'::jsonb) FROM %1$I.field_preplan_levels f WHERE f.preplan_id=p.id AND f.hidden=0 AND f.archived=0),
   'hazmat',(SELECT coalesce(jsonb_agg(to_jsonb(f)-'created_by'-'updated_by'),'[]'::jsonb) FROM %1$I.field_preplan_hazmat f WHERE f.preplan_id=p.id),
   'photos',(SELECT coalesce(jsonb_agg(to_jsonb(f)-'created_by'-'object_key'),'[]'::jsonb) FROM %1$I.field_preplan_photos f WHERE f.preplan_id=p.id),
   'assets',(SELECT coalesce(jsonb_agg(to_jsonb(f)-'created_by'-'updated_by'-'object_key'),'[]'::jsonb) FROM %1$I.field_preplan_assets f WHERE f.preplan_id=p.id AND f.archived=0)
   )),'[]'::jsonb) FROM %1$I.field_preplans p WHERE p.publication_status='published'$sql$,item.schema_name) INTO plans;
   EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(h)-''created_by''-''updated_by''),''[]''::jsonb) FROM %I.field_hydrants h',item.schema_name) INTO hydrants;
   results:=results||jsonb_build_array(jsonb_build_object('id',item.id,'name',item.name,'canEdit',false,'preplans',plans,'hydrants',hydrants));
 END LOOP;
 RETURN results;
END $function$;

REVOKE ALL ON FUNCTION "private"."department_shared_snapshot"(p_viewer uuid, p_source uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.department_storage_access(p_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE department uuid;
BEGIN
 IF p_name !~ '^departments/[0-9a-f-]{36}/' OR NOT private.portal_server_request() THEN RETURN false; END IF;
 department:=split_part(p_name,'/',2)::uuid;
 RETURN private.department_portal_access(department) AND EXISTS(SELECT 1 FROM private.department_portals p WHERE p.department_id=department AND p.schema_name<>'firehouse');
END $function$;

REVOKE ALL ON FUNCTION "private"."department_storage_access"(p_name text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.disciplinary_guard_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE c jsonb; k text; v text; choices text[]; actor text; actor_email text; person_name text; supervisor_name text; signed jsonb; prior_signed jsonb; signature jsonb; d date; body_changed boolean; src jsonb; original jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.disciplinary_access(NEW.department_id) THEN RAISE EXCEPTION 'Disciplinary access required' USING ERRCODE='42501'; END IF;
 SELECT lower(email) INTO actor_email FROM auth.users WHERE id=auth.uid();
 SELECT name INTO actor FROM firehouse.employees WHERE id=firehouse.employee_id_for_login(actor_email);
 actor:=COALESCE(actor,actor_email);
 src:=NEW.source_record;
 IF TG_OP='UPDATE' AND src IS DISTINCT FROM OLD.source_record THEN RAISE EXCEPTION 'Original Aladtec provenance cannot be changed'; END IF;
 IF src IS NOT NULL THEN
   IF COALESCE(src->>'system','')<>'aladtec' OR COALESCE(src->>'formId','')<>'149' OR COALESCE(src->>'id','')!~'^[0-9]+$' OR COALESCE(src->>'status','') NOT IN ('draft','submitted') OR COALESCE(src->>'localTimestamp','')!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$' OR COALESCE(src->>'timeZone','')<>'America/Chicago' OR jsonb_typeof(src->'originalContent') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid original Aladtec record'; END IF;
   IF TG_OP='INSERT' AND (NOT public.disciplinary_import_access(NEW.department_id) OR NOT EXISTS(SELECT 1 FROM public.disciplinary_import_staging s WHERE s.id=NEW.id AND s.department_id=NEW.department_id AND s.created_by=auth.uid() AND s.source_record=src AND s.content=NEW.content)) THEN RAISE EXCEPTION 'Use the verified disciplinary import' USING ERRCODE='42501'; END IF;
   NEW.source_id:=src->>'id';NEW.source_status:=src->>'status';NEW.source_at:=(src->>'localTimestamp')::timestamp AT TIME ZONE 'America/Chicago';
   IF NEW.source_at>now() THEN RAISE EXCEPTION 'The original source timestamp cannot be in the future'; END IF;
   original:=src->'originalContent';
   IF TG_OP='INSERT' THEN src:=src||jsonb_build_object('importedAt',now());NEW.source_record:=src; END IF;
 ELSE NEW.source_id:=NULL;NEW.source_status:=NULL;NEW.source_at:=NULL; END IF;
 c:=NEW.content;
 IF c IS NULL OR jsonb_typeof(c)<>'object' OR octet_length(c::text)>900000 OR c->'schemaVersion' IS DISTINCT FROM '1'::jsonb THEN RAISE EXCEPTION 'Enter a valid disciplinary report'; END IF;
 FOR k IN SELECT jsonb_object_keys(c) LOOP
   IF k NOT IN ('schemaVersion','employeeId','employeeName','supervisorId','supervisorName','incidentDate','incidentTime','incidentNumber','disciplineStep','previousDiscipline','factors','details','correctiveActions','documentationProvided','employeeResponse','employeeComments','fileIds','signatures') THEN RAISE EXCEPTION 'Unknown report field'; END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY['employeeId','supervisorId','incidentDate','incidentTime','incidentNumber','disciplineStep','previousDiscipline','details','correctiveActions','documentationProvided','employeeResponse','employeeComments'] LOOP
   IF jsonb_typeof(c->k) IS DISTINCT FROM 'string' OR length(c->>k)>(CASE WHEN k IN ('details','correctiveActions','employeeComments') THEN 12000 ELSE 160 END) THEN RAISE EXCEPTION 'Enter report text within its displayed limit'; END IF;
   IF NEW.status='submitted' AND k IN ('employeeId','supervisorId','incidentDate','disciplineStep','previousDiscipline','details','documentationProvided','employeeResponse') AND NULLIF(btrim(c->>k),'') IS NULL AND NOT ((k='employeeId' AND c->>'employeeId'=original->>'employeeId' AND NULLIF(original->>'employeeName','') IS NOT NULL) OR (k='supervisorId' AND c->>'supervisorId'=original->>'supervisorId' AND NULLIF(original->>'supervisorName','') IS NOT NULL)) THEN RAISE EXCEPTION 'Complete every required report field before submitting'; END IF;
 END LOOP;
 IF c->>'incidentDate'<>'' THEN
   BEGIN d:=(c->>'incidentDate')::date; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Enter the actual incident date'; END;
   IF c->>'incidentDate'!~'^\d{4}-\d{2}-\d{2}$' OR to_char(d,'YYYY-MM-DD')<>c->>'incidentDate' OR d>(now() AT TIME ZONE 'America/Chicago')::date THEN RAISE EXCEPTION 'Enter the actual incident date, today or earlier'; END IF;
 END IF;
 IF c->>'incidentTime'<>'' AND c->>'incidentTime'!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'Enter a valid incident time'; END IF;
 FOREACH k IN ARRAY ARRAY['disciplineStep','previousDiscipline','documentationProvided','employeeResponse'] LOOP
   choices:=CASE k WHEN 'disciplineStep' THEN ARRAY['Verbal Counseling, Non-documented','Verbal Counseling, Documented','Written Reprimand','Suspension','Termination'] WHEN 'previousDiscipline' THEN ARRAY['No','Yes, unrelated','Yes, related'] WHEN 'documentationProvided' THEN ARRAY['Yes, in print','Yes, electronically','No'] ELSE ARRAY['Yes','No'] END;
   IF c->>k<>'' AND NOT(c->>k=ANY(choices)) THEN RAISE EXCEPTION 'Choose a valid report response'; END IF;
 END LOOP;
 choices:=ARRAY['Failure to adhere to policy','Failure to follow instruction','Operating without authority','Impairment/Unfit for Duty','Unsafe procedure or process','Uniform, Dress Code Violation','AWOL/No Call/No Show','AWOL/Call Off','Dereliction of Duty','Insubordination','Other, See Details'];
 IF jsonb_typeof(c->'factors') IS DISTINCT FROM 'array' OR jsonb_array_length(c->'factors')>11 THEN RAISE EXCEPTION 'Choose valid contributing factors'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(c->'factors') x WHERE jsonb_typeof(x)<>'string' OR (NOT(x#>>'{}'=ANY(choices)) AND NOT(COALESCE(original->'factors','[]'::jsonb) @> jsonb_build_array(x)))) THEN RAISE EXCEPTION 'Choose valid contributing factors'; END IF;
 IF original IS NOT NULL AND c->>'employeeId'=original->>'employeeId' THEN person_name:=original->>'employeeName'; ELSIF c->>'employeeId'<>'' THEN SELECT name INTO person_name FROM firehouse.employees WHERE id=c->>'employeeId'; IF NOT FOUND THEN RAISE EXCEPTION 'Choose an employee from the department roster'; END IF; END IF;
 IF original IS NOT NULL AND c->>'supervisorId'=original->>'supervisorId' THEN supervisor_name:=original->>'supervisorName'; ELSIF c->>'supervisorId'<>'' THEN SELECT name INTO supervisor_name FROM firehouse.employees WHERE id=c->>'supervisorId'; IF NOT FOUND THEN RAISE EXCEPTION 'Choose a supervisor from the department roster'; END IF; END IF;
 c:=c||jsonb_build_object('employeeName',COALESCE(person_name,''),'supervisorName',COALESCE(supervisor_name,''));
 IF jsonb_typeof(c->'fileIds') IS DISTINCT FROM 'array' OR jsonb_array_length(c->'fileIds')>40 THEN RAISE EXCEPTION 'Choose no more than 40 report attachments'; END IF;
 FOR v IN SELECT jsonb_array_elements_text(c->'fileIds') LOOP
   IF NOT EXISTS(SELECT 1 FROM public.disciplinary_report_files f WHERE f.id::text=v AND f.report_id=NEW.id AND f.department_id=NEW.department_id) THEN RAISE EXCEPTION 'The attachment must belong to this report'; END IF;
 END LOOP;
 IF TG_OP='UPDATE' THEN
   IF NEW.id<>OLD.id OR NEW.department_id<>OLD.department_id OR NEW.version<>OLD.version+1 OR NEW.last_operation_id=OLD.last_operation_id THEN RAISE EXCEPTION 'Reload the latest report version before saving' USING ERRCODE='40001'; END IF;
   IF OLD.submitted_at IS NOT NULL AND length(btrim(NEW.change_reason))<5 THEN RAISE EXCEPTION 'Explain the correction to this submitted report'; END IF;
   NEW.created_at:=OLD.created_at;NEW.created_by:=OLD.created_by;NEW.created_by_name:=OLD.created_by_name;
 ELSE NEW.version:=1;NEW.created_at:=now();NEW.created_by:=auth.uid();NEW.created_by_name:=actor; END IF;
 IF length(NEW.change_reason)>2000 THEN RAISE EXCEPTION 'Keep the correction reason within 2000 characters'; END IF;
 signed:=COALESCE(c->'signatures','{}'::jsonb);
 IF jsonb_typeof(signed)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(signed) key WHERE key NOT IN ('employee','witness','supervisor','chief')) THEN RAISE EXCEPTION 'Choose a valid signature section'; END IF;
 body_changed:=TG_OP='UPDATE' AND (c-'signatures') IS DISTINCT FROM (OLD.content-'signatures');
 FOR k,signature IN SELECT * FROM jsonb_each(signed) LOOP
   IF jsonb_typeof(signature)<>'object' OR jsonb_typeof(signature->'name') IS DISTINCT FROM 'string' OR (length(btrim(signature->>'name')) NOT BETWEEN 1 AND 160 AND NOT(COALESCE(signature->>'origin'='aladtec' AND signature->>'name'='' AND original->'signatures'->k->>'image'=signature->>'image',false))) OR jsonb_typeof(signature->'image') IS DISTINCT FROM 'string' OR signature->>'image'!~'^data:image/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$' OR length(signature->>'image')>160000 THEN RAISE EXCEPTION 'Enter an actual drawn signature and printed name, or leave it unsigned'; END IF;
   IF signature->>'origin'='aladtec' THEN
     IF original IS NULL OR signature->>'name'<>'' OR (original->'signatures'->k->>'image') IS DISTINCT FROM (signature->>'image') THEN RAISE EXCEPTION 'An original signature must match the captured Aladtec evidence'; END IF;
     IF body_changed THEN signed:=signed-k; ELSE signed:=jsonb_set(signed,ARRAY[k],original->'signatures'->k); END IF;
     CONTINUE;
   END IF;
   prior_signed:=CASE WHEN TG_OP='UPDATE' THEN OLD.content->'signatures'->k ELSE NULL END;
   IF prior_signed->>'image'=signature->>'image' AND prior_signed->>'name'=signature->>'name' THEN
     IF body_changed THEN signed:=signed-k; ELSE signed:=jsonb_set(signed,ARRAY[k],prior_signed); END IF;
   ELSE signed:=jsonb_set(signed,ARRAY[k],jsonb_build_object('name',btrim(signature->>'name'),'image',signature->>'image','recordedAt',now(),'recordedBy',actor)); END IF;
 END LOOP;
 NEW.content:=jsonb_set(c,'{signatures}',signed);NEW.updated_at:=now();NEW.updated_by:=auth.uid();NEW.updated_by_name:=actor;
 NEW.submitted_at:=CASE WHEN TG_OP='INSERT' AND NEW.source_status='submitted' THEN NEW.source_at WHEN NEW.status='submitted' THEN now() WHEN TG_OP='UPDATE' THEN OLD.submitted_at ELSE NULL END;
 RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION "private"."disciplinary_guard_report"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.disciplinary_keep_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 INSERT INTO public.disciplinary_report_versions(report_id,department_id,version,content,status,change_reason,actor_id,actor_name,saved_at)
 VALUES(NEW.id,NEW.department_id,NEW.version,NEW.content,NEW.status,NEW.change_reason,NEW.updated_by,NEW.updated_by_name,NEW.updated_at);
 RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION "private"."disciplinary_keep_version"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.fire_inspection_pilot_allowed()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT private.portal_server_request() AND firehouse.has_department_access()
 AND EXISTS(SELECT 1 FROM auth.users WHERE id=(SELECT auth.uid()) AND lower(btrim(email))='bobff353@gmail.com')
$function$;

REVOKE ALL ON FUNCTION "private"."fire_inspection_pilot_allowed"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.fire_inspection_staff_allowed(p_department text, p_permission text DEFAULT 'records.read'::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT private.portal_server_request() AND firehouse.has_department_access()
 AND EXISTS(SELECT 1 FROM public.current_department_ids() AS d WHERE d::text=p_department)
 AND EXISTS(SELECT 1 FROM firehouse.fire_inspection_staff_workspaces w WHERE w.department_id=p_department AND
  (w.owner_user_id=(SELECT auth.uid())::text OR (w.rollout_enabled AND EXISTS(
   SELECT 1 FROM firehouse.fire_inspection_staff_members m WHERE m.department_id=p_department AND m.user_id=(SELECT auth.uid())::text AND m.status='active'
   AND (p_permission='records.read' OR m.role='admin'
    OR m.role IN('supervisor','inspector') AND p_permission IN('evidence.write','inspections.write','inspections.issue','staff.read')
    OR m.role='supervisor' AND p_permission IN('inspections.assign','templates.approve','citations.approve','corrections.review','reports.amend','reports.void','audit.read'))))))
$function$;

REVOKE ALL ON FUNCTION "private"."fire_inspection_staff_allowed"(p_department text, p_permission text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.fire_inspection_staff_case_allowed(p_department text, p_record text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT private.fire_inspection_staff_allowed(p_department,'evidence.write') AND EXISTS(
 SELECT 1 FROM firehouse.fire_inspection_staff_workspaces w JOIN firehouse.fire_inspection_pilot_records r ON r.department_id=w.department_id
 WHERE w.department_id=p_department AND r.id=p_record AND r.archived=0 AND (
 w.owner_user_id=(SELECT auth.uid())::text OR EXISTS(SELECT 1 FROM firehouse.fire_inspection_staff_members m
 WHERE m.department_id=p_department AND m.user_id=(SELECT auth.uid())::text AND m.status='active' AND (
 m.role IN('admin','supervisor') OR m.role='inspector' AND m.employee_id IS NOT NULL
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(r.payload::jsonb->'team'->'assignees','[]'::jsonb)) a WHERE a->>'id'=m.employee_id)))))
$function$;

REVOKE ALL ON FUNCTION "private"."fire_inspection_staff_case_allowed"(p_department text, p_record text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.forget_own_portal_device(p_unlock_token text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  DELETE FROM private.portal_remembered_devices d WHERE d.user_id=auth.uid()
    AND d.session_id::text=(auth.jwt()->>'session_id')
    AND d.token_hash=encode(extensions.digest(p_unlock_token,'sha256'),'hex')
$function$;

REVOKE ALL ON FUNCTION "private"."forget_own_portal_device"(p_unlock_token text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.initialize_department_forms()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE target name;
BEGIN
 SELECT schema_name INTO target FROM private.department_portals WHERE department_id=NEW.id AND schema_name<>'firehouse';
 IF target IS NULL THEN RETURN NEW; END IF;
 EXECUTE format('INSERT INTO %I.pay_scales(id,label,regular_rate,overtime_rate,holiday_rate,sort_order) VALUES (''chief'',''Chief'',0,0,0,1),(''deputy-chief'',''Deputy Chief'',0,0,0,2),(''captain'',''Captain'',0,0,0,3),(''lieutenant'',''Lieutenant'',0,0,0,4),(''firefighter'',''Firefighter'',0,0,0,5) ON CONFLICT DO NOTHING',target);
 RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION "private"."initialize_department_forms"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.inventory_can_access(target_department_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT CASE WHEN target_department_id='14a76771-4c24-481b-8def-e6cce005c17b'::uuid THEN (private.portal_has_permission('inventory.view') OR private.portal_has_permission('operations_board.view') OR private.portal_has_permission('daily_log.view') OR private.portal_has_permission('documents.view'))
 ELSE (public.is_platform_owner()
    or exists (
      select 1
      from public.department_memberships as membership
      where membership.department_id = target_department_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    )) END
$function$;

REVOKE ALL ON FUNCTION "private"."inventory_can_access"(target_department_id uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.inventory_can_admin(target_department_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT CASE WHEN target_department_id='14a76771-4c24-481b-8def-e6cce005c17b'::uuid THEN private.portal_has_permission('inventory.setup.manage')
 ELSE (public.is_platform_owner()
    or exists (
      select 1
      from public.department_memberships as membership
      where membership.department_id = target_department_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role in ('admin', 'chief')
    )) END
$function$;

REVOKE ALL ON FUNCTION "private"."inventory_can_admin"(target_department_id uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.inventory_can_write(target_department_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT CASE WHEN target_department_id='14a76771-4c24-481b-8def-e6cce005c17b'::uuid THEN (private.portal_has_permission('inventory.check') OR private.portal_has_permission('inventory.repairs.manage') OR private.portal_has_permission('inventory.setup.manage'))
 ELSE (public.is_platform_owner()
    or exists (
      select 1
      from public.department_memberships as membership
      where membership.department_id = target_department_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role in ('admin', 'chief', 'inspector', 'user')
    )) END
$function$;

REVOKE ALL ON FUNCTION "private"."inventory_can_write"(target_department_id uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.inventory_validate_service_schedule()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 IF TG_OP='UPDATE' AND ROW(OLD.last_serviced_date,OLD.service_interval_months,OLD.service_reminder_months)
   IS NOT DISTINCT FROM ROW(NEW.last_serviced_date,NEW.service_interval_months,NEW.service_reminder_months) THEN RETURN NEW; END IF;
 IF NEW.last_serviced_date > (now() AT TIME ZONE 'America/Chicago')::date THEN
   RAISE EXCEPTION 'Last serviced cannot be in the future' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION "private"."inventory_validate_service_schedule"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.neris_pilot_allowed()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT private.portal_server_request() AND firehouse.has_department_access()
 AND EXISTS(SELECT 1 FROM auth.users WHERE id=(SELECT auth.uid()) AND lower(btrim(email))='bobff353@gmail.com')
$function$;

REVOKE ALL ON FUNCTION "private"."neris_pilot_allowed"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.portal_confirmation_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor uuid:=auth.uid(); actor_email text; current_message record; exempt boolean:=false;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 SELECT lower(btrim(u.email)) INTO actor_email FROM auth.users u WHERE u.id=actor AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now());
 IF actor_email IS NULL THEN RAISE EXCEPTION 'Current account required' USING ERRCODE='42501'; END IF;
 exempt=actor_email='bobff353@gmail.com' AND EXISTS(SELECT 1 FROM public.platform_owners p WHERE lower(btrim(p.email))=actor_email);
 IF NOT exempt AND NOT EXISTS(SELECT 1 FROM public.department_memberships m WHERE m.department_id='14a76771-4c24-481b-8def-e6cce005c17b' AND m.user_id=actor AND m.status='active') THEN RAISE EXCEPTION 'Department access required' USING ERRCODE='42501'; END IF;
 SELECT m.id,m.enabled INTO current_message FROM firehouse.portal_confirmation_setting s LEFT JOIN firehouse.portal_confirmation_messages m ON m.id=s.message_id WHERE s.department_id='14a76771-4c24-481b-8def-e6cce005c17b';
 IF coalesce(current_message.enabled,false) THEN
  exempt=exempt OR (SELECT count(*)=1 AND coalesce(bool_and(ep.is_admin=1),false) FROM firehouse.employees e JOIN firehouse.employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND lower(btrim(ep.email))=actor_email AND (coalesce(ep.end_date,'')='' OR ep.end_date>=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD')));
 END IF;
 RETURN jsonb_build_object('version',current_message.id,'required',coalesce(current_message.enabled,false) AND NOT exempt AND NOT EXISTS(SELECT 1 FROM firehouse.portal_confirmation_receipts r WHERE r.message_id=current_message.id AND r.user_id=actor),'exempt',exempt);
END $function$;

REVOKE ALL ON FUNCTION "private"."portal_confirmation_status"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.portal_has_permission(permission text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor_email text; employee record; match_count int; override_effect text; saved boolean; base text[];
BEGIN
  IF NOT private.portal_server_request() OR NOT firehouse.has_department_access() THEN RETURN false; END IF;
  IF NOT permission = ANY(ARRAY['dashboard.view','operations_board.view','road_closures.view','command_center.view','daily_log.view','daily_log.manage','field_preplans.view','field_preplans.edit','field_preplans.publish','field_preplans.delete','field_preplans.review','field_preplans.manage_layers','field_preplans.manage_hazmat','field_preplans.manage_attachments','field_preplans.verify_expiring','field_preplans.manage_settings','incident_command.view','incident_command.manage','safety_inspections.view','safety_inspections.complete','safety_inspections.manage','scheduling.view','scheduling.manage','payroll.view_own','payroll.manage','employees.view','employees.manage','contacts.view','documents.view','policies.manage','box_cards.manage','inventory.view','inventory.check','inventory.repairs.manage','disciplinary.manage','inventory.setup.manage','settings.manage','permissions.manage']) THEN RETURN false; END IF;
  SELECT lower(btrim(email)) INTO actor_email FROM auth.users WHERE id=(SELECT auth.uid());
  IF actor_email='bobff353@gmail.com' THEN RETURN true; END IF;
  SELECT count(*) INTO match_count FROM firehouse.employees e JOIN firehouse.employee_profiles ep ON ep.employee_id=e.id
    WHERE e.id=firehouse.employee_id_for_login(actor_email);
  IF match_count<>1 THEN RETURN false; END IF;
  SELECT e.id,p.label rank,COALESCE(ep.is_admin,0) is_admin,ep.end_date INTO employee
    FROM firehouse.employees e JOIN firehouse.pay_scales p ON p.id=e.pay_scale_id JOIN firehouse.employee_profiles ep ON ep.employee_id=e.id
    WHERE e.id=firehouse.employee_id_for_login(actor_email);
  IF employee.end_date IS NOT NULL AND employee.end_date<>'' AND employee.end_date<to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD') THEN RETURN false; END IF;
  IF permission='payroll.view_own' THEN RETURN true; END IF;
  SELECT effect INTO override_effect FROM firehouse.employee_permission_overrides WHERE employee_id=employee.id AND permission_key=permission;
  IF override_effect='deny' THEN RETURN false; END IF;
  IF override_effect='allow' THEN RETURN true; END IF;
  IF employee.is_admin=1 THEN RETURN true; END IF;
  -- Board access is opt-in per member; old rank grants are retained but ignored.
  IF permission='operations_board.view' THEN RETURN false; END IF;
  SELECT allowed=1 INTO saved FROM firehouse.rank_permissions WHERE rank=employee.rank AND permission_key=permission;
  IF FOUND THEN RETURN saved; END IF;
  IF lower(employee.rank) LIKE '%chief%' THEN base:=ARRAY['dashboard.view','road_closures.view','command_center.view','daily_log.view','daily_log.manage','field_preplans.view','field_preplans.edit','field_preplans.publish','field_preplans.delete','field_preplans.review','field_preplans.manage_layers','field_preplans.manage_hazmat','field_preplans.manage_attachments','field_preplans.verify_expiring','field_preplans.manage_settings','incident_command.view','incident_command.manage','safety_inspections.view','safety_inspections.complete','safety_inspections.manage','scheduling.view','scheduling.manage','payroll.view_own','payroll.manage','employees.view','employees.manage','contacts.view','documents.view','policies.manage','box_cards.manage','inventory.view','inventory.check','inventory.repairs.manage','disciplinary.manage','inventory.setup.manage','settings.manage','permissions.manage'];
  ELSIF lower(employee.rank) LIKE '%captain%' OR lower(employee.rank) LIKE '%lieutenant%' THEN base:=ARRAY['dashboard.view','road_closures.view','scheduling.view','payroll.view_own','documents.view','field_preplans.view','safety_inspections.view','safety_inspections.complete','inventory.view','inventory.check','daily_log.view','daily_log.manage','field_preplans.edit','incident_command.view','field_preplans.review','field_preplans.verify_expiring','employees.view','contacts.view','incident_command.manage','safety_inspections.manage','inventory.repairs.manage','disciplinary.manage','command_center.view','scheduling.manage'];
  ELSIF lower(employee.rank) LIKE '%firefighter%' OR lower(btrim(employee.rank))='ff' THEN base:=ARRAY['dashboard.view','road_closures.view','scheduling.view','payroll.view_own','documents.view','field_preplans.view','safety_inspections.view','safety_inspections.complete','inventory.view','inventory.check','daily_log.view','daily_log.manage','field_preplans.edit','incident_command.view'];
  ELSE base:=ARRAY['dashboard.view','road_closures.view','scheduling.view','payroll.view_own','documents.view','field_preplans.view','safety_inspections.view','safety_inspections.complete','inventory.view','inventory.check']; END IF;
  RETURN permission=ANY(base);
END $function$;

REVOKE ALL ON FUNCTION "private"."portal_has_permission"(permission text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.portal_remembered_until(p_unlock_token text)
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT d.expires_at
  FROM private.portal_remembered_devices d
  JOIN public.portal_pin_credentials c ON c.user_id = d.user_id
  JOIN auth.sessions s ON s.id = d.session_id AND s.user_id = d.user_id
  WHERE p_unlock_token LIKE 'rd1\_%' ESCAPE '\'
    AND d.token_hash = encode(extensions.digest(p_unlock_token,'sha256'),'hex')
    AND d.user_id = auth.uid()
    AND d.session_id::text = (auth.jwt()->>'session_id')
    AND d.expires_at > now()
    AND (s.not_after IS NULL OR s.not_after > now())
    AND d.pin_fingerprint = encode(extensions.digest(c.pin_hash,'sha256'),'hex')
    AND (c.locked_until IS NULL OR c.locked_until <= now())
    AND (EXISTS (SELECT 1 FROM public.department_memberships m
      WHERE m.user_id=d.user_id AND m.department_id=d.department_id AND m.status='active')
      OR public.is_platform_owner())
$function$;

REVOKE ALL ON FUNCTION "private"."portal_remembered_until"(p_unlock_token text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.portal_server_request()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT (SELECT auth.uid()) IS NOT NULL AND
    COALESCE(encode(extensions.digest(btrim(NULLIF(current_setting('request.headers',true),'')::jsonb->>'x-firehouse-server-key'),'sha256'),'hex') = 'b670b94c3c22d743371264059918a4e1c7d98640305f93f211aba9b1b60dcdb8',false)
$function$;

REVOKE ALL ON FUNCTION "private"."portal_server_request"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.provision_department_portal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE target text; source_id text; item record; definition text;
BEGIN
 IF NEW.slug='stickney-fire-department' THEN RETURN NEW; END IF;
 target := 'department_'||replace(NEW.id::text,'-','');
 SELECT id::text INTO source_id FROM public.departments WHERE slug='stickney-fire-department';
 EXECUTE format('CREATE SCHEMA %I',target);
 EXECUTE format('REVOKE ALL ON SCHEMA %I FROM PUBLIC,anon,authenticated,service_role',target);
 -- LIKE copies structure and indexes only. No INSERT SELECT from source data.
 FOR item IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='firehouse' AND c.relkind IN ('r','p') ORDER BY c.relname LOOP
   EXECUTE format('CREATE TABLE %I.%I (LIKE firehouse.%I INCLUDING ALL)',target,item.relname,item.relname);
   EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',target,item.relname);
   EXECUTE format('REVOKE ALL ON %I.%I FROM PUBLIC,anon,authenticated,service_role',target,item.relname);
 END LOOP;
 -- Foreign keys must point at the NEW tables, preserving related records.
 FOR item IN SELECT c.relname,k.conname,pg_get_constraintdef(k.oid) def FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='firehouse' AND k.contype='f' LOOP
   EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I %s',target,item.relname,item.conname,replace(item.def,'firehouse.',quote_ident(target)||'.'));
 END LOOP;
 PERFORM set_config('check_function_bodies','off',true);
 PERFORM set_config('search_path','public,pg_catalog',true);
 FOR item IN SELECT c.relname,pg_get_viewdef(c.oid,true) def FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='firehouse' AND c.relkind='v' LOOP
   definition:=replace(replace(replace(item.def,'firehouse.',quote_ident(target)||'.'),'stickney-fire-department',NEW.slug),source_id,NEW.id::text);
   EXECUTE format('CREATE VIEW %I.%I WITH (security_invoker=true) AS %s',target,item.relname,definition);
 END LOOP;
 FOR item IN SELECT p.oid,p.proname,pg_get_functiondef(p.oid) def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='firehouse' AND p.proname NOT IN ('execute_portal_sql','execute_server_portal_sql','system_health_usage') LOOP
   definition := replace(replace(replace(item.def,'firehouse',target),'stickney-fire-department',NEW.slug),source_id,NEW.id::text);
   definition := replace(definition,'private.portal_confirmation_status()',format('public.department_portal_confirmation_status(%L::uuid)',NEW.id));
   EXECUTE definition;
 END LOOP;
 FOR item IN SELECT c.relname,pg_get_triggerdef(t.oid,true) def FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='firehouse' AND NOT t.tgisinternal LOOP
   EXECUTE replace(item.def,'firehouse.',quote_ident(target)||'.');
 END LOOP;
 EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM PUBLIC,anon,authenticated,service_role',target);
 EXECUTE format('INSERT INTO %I.system_meta(key,value) VALUES ($1,$2)',target)
 USING 'runtime_bootstrap_version','stickney-runtime-bootstrap-2026-08-31-safety-inspection-library-v2';
 INSERT INTO private.department_portals(department_id,schema_name,hostname)
 VALUES(NEW.id,target,NEW.slug||'-firehouse-manager.vercel.app');
 RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION "private"."provision_department_portal"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.shared_preplan_storage_read(p_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE item record; found boolean; prefix text;
BEGIN
 IF NOT private.portal_server_request() OR auth.uid() IS NULL OR NOT (public.is_platform_owner() OR EXISTS(SELECT 1 FROM public.department_memberships WHERE user_id=auth.uid() AND status='active')) THEN RETURN false; END IF;
 FOR item IN SELECT department_id,schema_name FROM private.department_portals LOOP
   prefix:=CASE WHEN item.schema_name='firehouse' THEN '' ELSE 'departments/'||item.department_id::text||'/' END;
   EXECUTE format($sql$SELECT EXISTS(SELECT 1 FROM %1$I.field_preplan_photos f JOIN %1$I.field_preplans p ON p.id=f.preplan_id WHERE p.publication_status='published' AND $1||f.object_key=$2)
   OR EXISTS(SELECT 1 FROM %1$I.field_preplan_assets f JOIN %1$I.field_preplans p ON p.id=f.preplan_id WHERE p.publication_status='published' AND f.archived=0 AND $1||f.object_key=$2)$sql$,item.schema_name) INTO found USING prefix,p_name;
   IF found THEN RETURN true; END IF;
 END LOOP;
 RETURN false;
END $function$;

REVOKE ALL ON FUNCTION "private"."shared_preplan_storage_read"(p_name text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.training_pilot_allowed()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT private.portal_server_request() AND firehouse.has_department_access()
 AND EXISTS(SELECT 1 FROM auth.users WHERE id=(SELECT auth.uid()) AND lower(btrim(email))='bobff353@gmail.com')
$function$;

REVOKE ALL ON FUNCTION "private"."training_pilot_allowed"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.verify_portal_pin_with_device(p_pin text, p_department_id uuid)
 RETURNS TABLE(ok boolean, unlock_token text, locked_until timestamp with time zone, remembered_until timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  current_session_id uuid;
  verified record;
  next_token text;
  deadline timestamptz := now() + interval '7 days';
BEGIN
  SELECT s.id INTO current_session_id FROM auth.sessions s
    WHERE s.id=NULLIF(auth.jwt()->>'session_id','')::uuid AND s.user_id=current_user_id
      AND (s.not_after IS NULL OR s.not_after>now());
  IF current_user_id IS NULL OR current_session_id IS NULL OR p_department_id IS NULL
    OR NOT (EXISTS (SELECT 1 FROM public.department_memberships m
      WHERE m.user_id=current_user_id AND m.department_id=p_department_id AND m.status='active')
      OR public.is_platform_owner()) THEN
    RAISE EXCEPTION 'Current department sign-in is required.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO verified FROM public.verify_portal_pin(p_pin);
  IF verified.ok IS DISTINCT FROM true THEN
    RETURN QUERY SELECT false,NULL::text,verified.locked_until,NULL::timestamptz;
    RETURN;
  END IF;
  -- verify_portal_pin holds the credential row lock, serializing own-device issuance.
  DELETE FROM private.portal_remembered_devices d WHERE d.user_id=current_user_id
    AND (d.expires_at<=now() OR d.session_id=current_session_id);
  DELETE FROM private.portal_remembered_devices d WHERE d.token_hash IN (
    SELECT old.token_hash FROM private.portal_remembered_devices old
    WHERE old.user_id=current_user_id ORDER BY old.created_at DESC,old.token_hash OFFSET 19
  );
  next_token := 'rd1_' || encode(extensions.gen_random_bytes(32),'hex');
  INSERT INTO private.portal_remembered_devices(token_hash,user_id,session_id,department_id,pin_fingerprint,expires_at)
    SELECT encode(extensions.digest(next_token,'sha256'),'hex'),current_user_id,current_session_id,p_department_id,
      encode(extensions.digest(c.pin_hash,'sha256'),'hex'),deadline
    FROM public.portal_pin_credentials c WHERE c.user_id=current_user_id;
  RETURN QUERY SELECT true,next_token,NULL::timestamptz,deadline;
END;
$function$;

REVOKE ALL ON FUNCTION "private"."verify_portal_pin_with_device"(p_pin text, p_department_id uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.accept_department_invite()
 RETURNS TABLE(department_id uuid, department_name text, department_slug text, role department_role)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  authenticated_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  pending_invite public.department_invites%rowtype;
begin
  if auth.uid() is null or authenticated_email = '' then
    raise exception 'Authentication with a verified email is required.';
  end if;

  if exists (
    select 1 from public.department_memberships
    where user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'This account already belongs to an active department.';
  end if;

  select *
  into pending_invite
  from public.department_invites
  where lower(email) = authenticated_email
    and status = 'pending'
    and (expires_at is null or expires_at > now())
  order by created_at
  limit 1
  for update;

  if pending_invite.id is null then
    raise exception 'No active department invitation was found for this email.';
  end if;

  insert into public.department_memberships (department_id, user_id, role, status)
  values (pending_invite.department_id, auth.uid(), pending_invite.role, 'active');

  update public.department_invites
  set status = 'accepted',
      accepted_by = auth.uid(),
      updated_at = now()
  where id = pending_invite.id;

  return query
  select d.id, d.name, d.slug, pending_invite.role
  from public.departments d
  where d.id = pending_invite.department_id;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."accept_department_invite"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.activate_roster_portal_user(p_user_id uuid, p_email text, p_department_id uuid, p_role department_role, p_pin text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  unlock_token text;
BEGIN
  IF p_user_id IS NULL OR p_department_id IS NULL
     OR lower(trim(coalesce(p_email, ''))) !~ '^[^[:space:]@]+@stickneyfire[.]com$'
     OR coalesce(p_pin, '') !~ '^\d{4,6}$' THEN
    RAISE EXCEPTION 'Invalid employee activation.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users AS auth_user
    WHERE auth_user.id = p_user_id AND lower(auth_user.email) = lower(trim(p_email))
  ) THEN
    RAISE EXCEPTION 'Verified auth user is required.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.department_memberships (department_id, user_id, role, status)
  VALUES (p_department_id, p_user_id, p_role, 'active')
  ON CONFLICT (department_id, user_id) DO UPDATE SET
    role = excluded.role,
    status = 'active';

  UPDATE public.department_invites SET
    status = 'accepted',
    accepted_by = p_user_id,
    updated_at = now()
  WHERE department_id = p_department_id
    AND lower(email) = lower(trim(p_email));

  unlock_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.portal_pin_credentials (
    user_id, pin_hash, failed_attempts, locked_until,
    unlock_token_hash, unlock_expires_at, updated_at
  ) VALUES (
    p_user_id, extensions.crypt(p_pin, extensions.gen_salt('bf', 12)), 0, NULL,
    encode(extensions.digest(unlock_token, 'sha256'), 'hex'), now() + interval '30 minutes', now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    pin_hash = excluded.pin_hash,
    failed_attempts = 0,
    locked_until = NULL,
    unlock_token_hash = excluded.unlock_token_hash,
    unlock_expires_at = excluded.unlock_expires_at,
    updated_at = now();

  RETURN unlock_token;
END;
$function$;

REVOKE ALL ON FUNCTION "public"."activate_roster_portal_user"(p_user_id uuid, p_email text, p_department_id uuid, p_role department_role, p_pin text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_manage_department(target_department_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.current_department_role(target_department_id) = 'admin';
$function$;

REVOKE ALL ON FUNCTION "public"."can_manage_department"(target_department_id uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_department_with_admin(p_name text, p_slug text, p_city text DEFAULT NULL::text, p_state text DEFAULT NULL::text, p_county text DEFAULT NULL::text)
 RETURNS departments
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_department public.departments;
begin
  if not public.is_platform_owner() then
    raise exception 'Only a platform owner can add a department';
  end if;
  if length(trim(coalesce(p_name,''))) < 2 then
    raise exception 'Department name is required';
  end if;
  if trim(coalesce(p_slug,'')) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Department address must use lowercase letters, numbers, and hyphens';
  end if;
  insert into public.departments (name,slug,city,state,county)
  values (trim(p_name),trim(p_slug),nullif(trim(p_city),''),nullif(upper(trim(p_state)),''),nullif(trim(p_county),''))
  returning * into v_department;
  insert into public.department_memberships (department_id,user_id,role,status)
  values (v_department.id,auth.uid(),'admin','active');
  return v_department;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."create_department_with_admin"(p_name text, p_slug text, p_city text, p_state text, p_county text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_department_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select departments.id
  from public.departments as departments
  where public.is_platform_owner()

  union

  select memberships.department_id
  from public.department_memberships as memberships
  where memberships.user_id = (select auth.uid())
    and memberships.status = 'active';
$function$;

REVOKE ALL ON FUNCTION "public"."current_department_ids"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_department_role(target_department_id uuid)
 RETURNS department_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case
    when public.is_platform_owner()
      and exists (
        select 1
        from public.departments
        where id = target_department_id
      )
      then 'admin'::public.department_role
    else (
      select memberships.role
      from public.department_memberships as memberships
      where memberships.user_id = (select auth.uid())
        and memberships.department_id = target_department_id
        and memberships.status = 'active'
      limit 1
    )
  end;
$function$;

REVOKE ALL ON FUNCTION "public"."current_department_role"(target_department_id uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.department_firehouse_server_sql(p_department uuid, p_sql text, p_mode text DEFAULT 'all'::text, p_secret text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$SELECT department_gateway.department_firehouse_server_sql(p_department,p_sql,p_mode,p_secret)$function$;

REVOKE ALL ON FUNCTION "public"."department_firehouse_server_sql"(p_department uuid, p_sql text, p_mode text, p_secret text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.department_firehouse_sql(p_department uuid, p_sql text, p_mode text DEFAULT 'all'::text, p_secret text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$SELECT department_gateway.department_firehouse_sql(p_department,p_sql,p_mode,p_secret)$function$;

REVOKE ALL ON FUNCTION "public"."department_firehouse_sql"(p_department uuid, p_sql text, p_mode text, p_secret text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.department_firehouse_sql_batch(p_department uuid, p_statements jsonb, p_secret text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE item jsonb; result jsonb; results jsonb:='[]';
BEGIN
 PERFORM public.department_firehouse_sql(p_department,'SELECT 1','first',p_secret);
 IF jsonb_typeof(p_statements) IS DISTINCT FROM 'array' OR jsonb_array_length(p_statements)>2000 THEN RAISE EXCEPTION 'Invalid transaction'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_department::text,0));
 FOR item IN SELECT value FROM jsonb_array_elements(p_statements) LOOP
   result := public.department_firehouse_sql(p_department,item->>'sql',coalesce(item->>'mode','run'),p_secret);
   IF item->>'requiredChanges' IS NOT NULL AND (result#>>'{meta,changes}')::bigint IS DISTINCT FROM (item->>'requiredChanges')::bigint THEN RAISE EXCEPTION 'SAVE_CONFLICT' USING ERRCODE='PT409'; END IF;
   results:=results||jsonb_build_array(result);
 END LOOP;
 RETURN results;
END $function$;

REVOKE ALL ON FUNCTION "public"."department_firehouse_sql_batch"(p_department uuid, p_statements jsonb, p_secret text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.department_portal_confirmation_status(p_department uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$SELECT department_gateway.department_portal_confirmation_status(p_department)$function$;

REVOKE ALL ON FUNCTION "public"."department_portal_confirmation_status"(p_department uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.department_portal_directory()
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$SELECT department_gateway.department_portal_directory()$function$;

REVOKE ALL ON FUNCTION "public"."department_portal_directory"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.department_portal_for_host(p_host text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$SELECT department_gateway.department_portal_for_host(p_host)$function$;

REVOKE ALL ON FUNCTION "public"."department_portal_for_host"(p_host text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.department_shared_preplan_file(p_viewer uuid, p_source uuid, p_file text, p_kind text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ SELECT department_gateway.department_shared_preplan_file(p_viewer,p_source,p_file,p_kind); $function$;

REVOKE ALL ON FUNCTION "public"."department_shared_preplan_file"(p_viewer uuid, p_source uuid, p_file text, p_kind text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.department_shared_preplans(p_viewer uuid, p_source uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$SELECT department_gateway.department_shared_preplans(p_viewer,p_source)$function$;

REVOKE ALL ON FUNCTION "public"."department_shared_preplans"(p_viewer uuid, p_source uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.disciplinary_access(p_department uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 SELECT EXISTS(SELECT 1 FROM public.departments d WHERE d.id=p_department AND d.slug='stickney-fire-department')
 AND (SELECT private.portal_has_permission('disciplinary.manage'))
$function$;

REVOKE ALL ON FUNCTION "public"."disciplinary_access"(p_department uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.disciplinary_import_access(p_department uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ SELECT public.disciplinary_access(p_department) AND (SELECT private.portal_has_permission('permissions.manage')) $function$;

REVOKE ALL ON FUNCTION "public"."disciplinary_import_access"(p_department uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.disciplinary_import_finish(p_department uuid, p_stage uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE s public.disciplinary_import_staging%ROWTYPE;r public.disciplinary_reports%ROWTYPE;
BEGIN
 IF NOT public.disciplinary_import_access(p_department) THEN RAISE EXCEPTION 'Disciplinary import administrator access required' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM public.disciplinary_import_staging WHERE id=p_stage AND department_id=p_department FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Import stage unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM public.disciplinary_reports WHERE department_id=p_department AND source_id=s.source_id;
 IF FOUND THEN IF r.source_record->>'importHash'<>s.source_hash THEN RAISE EXCEPTION 'Source conflict; existing report retained' USING ERRCODE='40001';END IF;RETURN jsonb_build_object('reportId',r.id,'alreadyImported',true);END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='stickney-disciplinary-private' AND o.name=s.object_key AND (o.metadata->>'size')::bigint=s.pdf_size) THEN RAISE EXCEPTION 'The original source page capture must be uploaded before import';END IF;
 INSERT INTO public.disciplinary_reports(id,department_id,content,status,version,change_reason,created_by,created_by_name,updated_by,updated_by_name,created_at,updated_at,last_operation_id,last_request_hash,source_record)
 VALUES(s.id,p_department,s.content,s.source_record->>'status',1,'Copied from original Aladtec record '||s.source_id,auth.uid(),'',auth.uid(),'',now(),now(),gen_random_uuid(),s.source_hash,s.source_record) RETURNING * INTO r;
 INSERT INTO public.disciplinary_report_files(id,department_id,report_id,object_key,original_filename,mime_type,byte_size,sha256,uploaded_by,uploaded_by_name)
 VALUES(s.file_id,p_department,r.id,s.object_key,s.pdf_filename,'application/pdf',s.pdf_size,s.pdf_sha256,auth.uid(),r.updated_by_name);
 UPDATE public.disciplinary_import_staging SET completed_at=now() WHERE id=s.id;
 RETURN jsonb_build_object('reportId',r.id,'version',r.version,'alreadyImported',false);
END $function$;

REVOKE ALL ON FUNCTION "public"."disciplinary_import_finish"(p_department uuid, p_stage uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.disciplinary_import_prepare(p_department uuid, p_source jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE r public.disciplinary_reports%ROWTYPE;s public.disciplinary_import_staging%ROWTYPE;new_id uuid:=gen_random_uuid();new_file uuid:=gen_random_uuid();
BEGIN
 IF NOT public.disciplinary_import_access(p_department) THEN RAISE EXCEPTION 'Disciplinary import administrator access required' USING ERRCODE='42501'; END IF;
 IF COALESCE(p_source->>'system','')<>'aladtec' OR COALESCE(p_source->>'formId','')<>'149' OR COALESCE(p_source->>'id','')!~'^[0-9]+$' OR COALESCE(p_source->>'importHash','')!~'^[a-f0-9]{64}$' OR COALESCE(p_source->>'status','') NOT IN ('draft','submitted') OR jsonb_typeof(p_source->'originalContent') IS DISTINCT FROM 'object' OR COALESCE(p_source->'capture'->>'sha256','')!~'^[a-f0-9]{64}$' OR octet_length(p_source::text)>1500000 THEN RAISE EXCEPTION 'Invalid captured source record'; END IF;
 SELECT * INTO r FROM public.disciplinary_reports WHERE department_id=p_department AND source_id=p_source->>'id';
 IF FOUND THEN IF r.source_record->>'importHash'<>p_source->>'importHash' THEN RAISE EXCEPTION 'This Aladtec report already exists with different source facts. Review the conflict; it was not overwritten' USING ERRCODE='40001'; END IF;RETURN jsonb_build_object('complete',true,'reportId',r.id,'alreadyImported',true);END IF;
 INSERT INTO public.disciplinary_import_staging(id,department_id,source_id,source_hash,source_record,content,file_id,object_key,pdf_filename,pdf_sha256,pdf_size)
 VALUES(new_id,p_department,p_source->>'id',p_source->>'importHash',p_source||jsonb_build_object('documentFileId',new_file),(p_source->'originalContent'),new_file,p_department::text||'/'||new_id::text||'/'||new_file::text||'.pdf',p_source->'capture'->>'filename',p_source->'capture'->>'sha256',(p_source->'capture'->>'byteSize')::bigint) ON CONFLICT(department_id,source_id) DO NOTHING;
 SELECT * INTO s FROM public.disciplinary_import_staging WHERE department_id=p_department AND source_id=p_source->>'id';
 IF NOT FOUND OR s.source_hash<>p_source->>'importHash' OR s.pdf_sha256<>p_source->'capture'->>'sha256' THEN RAISE EXCEPTION 'A different import is already staged. No report was changed' USING ERRCODE='40001';END IF;
 RETURN jsonb_build_object('complete',false,'stageId',s.id,'reportId',s.id,'fileId',s.file_id,'sourceId',s.source_id);
END $function$;

REVOKE ALL ON FUNCTION "public"."disciplinary_import_prepare"(p_department uuid, p_source jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.disciplinary_save(p_department uuid, p_id uuid, p_version integer, p_content jsonb, p_status text, p_reason text, p_operation uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE saved public.disciplinary_reports%ROWTYPE; fingerprint text;
BEGIN
 IF NOT public.disciplinary_access(p_department) THEN RAISE EXCEPTION 'Disciplinary access required' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_operation IS NULL OR p_version IS NULL OR p_version<0 OR p_status NOT IN ('draft','submitted') OR p_status IS NULL THEN RAISE EXCEPTION 'Choose draft or submitted report and its saved version'; END IF;
 fingerprint:=md5(COALESCE(p_content::text,'')||p_status||COALESCE(p_reason,''));
 IF p_version=0 THEN
   INSERT INTO public.disciplinary_reports(id,department_id,content,status,version,change_reason,created_by,created_by_name,updated_by,updated_by_name,created_at,updated_at,last_operation_id,last_request_hash)
   VALUES(p_id,p_department,p_content,p_status,1,COALESCE(p_reason,''),auth.uid(),'',auth.uid(),'',now(),now(),p_operation,fingerprint) ON CONFLICT(id) DO NOTHING;
   SELECT * INTO saved FROM public.disciplinary_reports WHERE id=p_id AND department_id=p_department FOR UPDATE;
   IF saved.last_operation_id=p_operation AND saved.last_request_hash=fingerprint THEN RETURN to_jsonb(saved); END IF;
   RAISE EXCEPTION 'This report already exists. Refresh before saving again' USING ERRCODE='40001';
 END IF;
 SELECT * INTO saved FROM public.disciplinary_reports WHERE id=p_id AND department_id=p_department FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Report not found' USING ERRCODE='42501'; END IF;
 IF saved.last_operation_id=p_operation AND saved.last_request_hash=fingerprint THEN RETURN to_jsonb(saved); END IF;
 IF saved.version<>p_version THEN RAISE EXCEPTION 'Another editor saved this report. Your edits are retained; load the latest saved version before saving.' USING ERRCODE='40001'; END IF;
 UPDATE public.disciplinary_reports SET content=p_content,status=p_status,version=version+1,change_reason=COALESCE(p_reason,''),last_operation_id=p_operation,last_request_hash=fingerprint WHERE id=p_id AND department_id=p_department RETURNING * INTO saved;
 RETURN to_jsonb(saved);
END $function$;

REVOKE ALL ON FUNCTION "public"."disciplinary_save"(p_department uuid, p_id uuid, p_version integer, p_content jsonb, p_status text, p_reason text, p_operation uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.firehouse_server_sql(p_sql text, p_mode text DEFAULT 'all'::text, p_secret text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT firehouse.execute_server_portal_sql(p_sql, p_mode, p_secret);
$function$;

REVOKE ALL ON FUNCTION "public"."firehouse_server_sql"(p_sql text, p_mode text, p_secret text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.firehouse_server_sql_batch(p_statements jsonb, p_secret text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE item jsonb; result jsonb; results jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.firehouse_server_sql('SELECT 1', 'first', p_secret);
  IF jsonb_typeof(p_statements) IS DISTINCT FROM 'array' OR jsonb_array_length(p_statements) > 2000 THEN
    RAISE EXCEPTION 'Invalid transaction';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(74192026);
  FOR item IN SELECT value FROM jsonb_array_elements(p_statements) LOOP
    result := public.firehouse_server_sql(item->>'sql', COALESCE(item->>'mode','run'), p_secret);
    IF item->>'requiredChanges' IS NOT NULL AND (result#>>'{meta,changes}')::bigint IS DISTINCT FROM (item->>'requiredChanges')::bigint THEN
      RAISE EXCEPTION 'SAVE_CONFLICT: The record changed. Reload and review before saving.' USING ERRCODE = 'PT409';
    END IF;
    results := results || jsonb_build_array(result);
  END LOOP;
  RETURN results;
END $function$;

REVOKE ALL ON FUNCTION "public"."firehouse_server_sql_batch"(p_statements jsonb, p_secret text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.firehouse_sql(p_sql text, p_mode text DEFAULT 'all'::text, p_secret text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT firehouse.execute_portal_sql(p_sql, p_mode, p_secret);
$function$;

REVOKE ALL ON FUNCTION "public"."firehouse_sql"(p_sql text, p_mode text, p_secret text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.firehouse_sql_batch(p_statements jsonb, p_secret text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE item jsonb; result jsonb; results jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.firehouse_sql('SELECT 1', 'first', p_secret);
  IF jsonb_typeof(p_statements) IS DISTINCT FROM 'array' OR jsonb_array_length(p_statements) > 2000 THEN
    RAISE EXCEPTION 'Invalid transaction';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(74192026);
  FOR item IN SELECT value FROM jsonb_array_elements(p_statements) LOOP
    result := public.firehouse_sql(item->>'sql', COALESCE(item->>'mode','run'), p_secret);
    IF item->>'requiredChanges' IS NOT NULL AND (result#>>'{meta,changes}')::bigint IS DISTINCT FROM (item->>'requiredChanges')::bigint THEN
      RAISE EXCEPTION 'SAVE_CONFLICT: The record changed. Reload and review before saving.' USING ERRCODE = 'PT409';
    END IF;
    results := results || jsonb_build_array(result);
  END LOOP;
  RETURN results;
END $function$;

REVOKE ALL ON FUNCTION "public"."firehouse_sql_batch"(p_statements jsonb, p_secret text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.forget_own_portal_device(p_unlock_token text)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  SELECT private.forget_own_portal_device(p_unlock_token)
$function$;

REVOKE ALL ON FUNCTION "public"."forget_own_portal_device"(p_unlock_token text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_air_check_history(p_department uuid, p_equipment uuid, p_before_time timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select to_jsonb(i) || jsonb_build_object('started_at',c.started_at,'apparatus_id',c.apparatus_id,'check_type',c.check_type)
  from public.inventory_scba_check_entries i join public.inventory_checks c on c.id = i.check_id and c.department_id = p_department
  where i.department_id = p_department and i.equipment_id = p_equipment
    and (p_before_time is null or (c.started_at,i.id) < (p_before_time,p_before_id))
  order by c.started_at desc,i.id desc limit 26;
$function$;

REVOKE ALL ON FUNCTION "public"."inventory_air_check_history"(p_department uuid, p_equipment uuid, p_before_time timestamp with time zone, p_before_id uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_apply_operation(p_department_id uuid, p_request_id uuid, p_action text, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  saved public.inventory_operation_receipts%rowtype;
  lot public.inventory_stock_lots%rowtype;
  work public.inventory_work_orders%rowtype;
  equipment public.inventory_equipment%rowtype;
  apparatus public.inventory_apparatus_profiles%rowtype;
  actor text := coalesce(auth.jwt()->>'email', auth.uid()::text);
  result jsonb;
  delta integer;
  next_quantity bigint;
  order_id uuid := gen_random_uuid();
  exception_id uuid := gen_random_uuid();
  v_apparatus_id uuid;
  v_equipment_id uuid;
  photo_id uuid;
  categories text[];
  assigned_ids text[];
  assigned_names text[];
  supply public.inventory_stock_items%rowtype;
  request_row public.inventory_transactions%rowtype;
  supply_id uuid := gen_random_uuid();
  lot_id uuid := gen_random_uuid();
  quantity integer;
  expected_stage text;
  next_stage text;
  cost numeric;
  v_repair_date date;
  v_service_type text := coalesce(nullif(p_input->>'serviceType',''),'repair');
begin
  if auth.uid() is null or not private.inventory_can_write(p_department_id) then
    raise exception 'Inventory permission required.' using errcode='42501';
  end if;
  if coalesce(p_action,'') not in ('adjust_stock','create_notice','create_work_order','close_work_order','update_work_order_status','create_stock_item','request_restock','approve_restock','fulfill_restock','create_stock_lot') then
    raise exception 'Unsupported operation.' using errcode='22023';
  end if;
  if not private.portal_has_permission(case when p_action in ('adjust_stock','request_restock') then 'inventory.check' when p_action in ('create_stock_item','approve_restock','fulfill_restock','create_stock_lot') then 'inventory.setup.manage' else 'inventory.repairs.manage' end) then
    raise exception 'Permission for this operation is required.' using errcode='42501';
  end if;
  if p_request_id is null or p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'A save reference and operation details are required.' using errcode='22023';
  end if;
  -- Serialize a single retry key before reading it. Different stock saves still
  -- serialize on their actual lot, so concurrent changes cannot overwrite counts.
  perform pg_advisory_xact_lock(hashtextextended(p_department_id::text || p_request_id::text,0));
  select * into saved from public.inventory_operation_receipts
    where department_id=p_department_id and request_id=p_request_id;
  if found then
    if saved.actor_id <> auth.uid() or saved.action <> p_action or saved.input <> p_input then
      raise exception 'This save reference belongs to different details. Refresh before saving.' using errcode='40001';
    end if;
    return saved.result || jsonb_build_object('replayed',true);
  end if;
  if p_action='create_stock_item' then
    if nullif(btrim(p_input->>'name'),'') is null or nullif(btrim(p_input->>'unit'),'') is null
      or coalesce(p_input->>'quantity','') !~ '^[0-9]+$'
      or coalesce(nullif(p_input->>'parLevel',''),'0') !~ '^[0-9]+$'
      or coalesce(nullif(p_input->>'reorderPoint',''),'0') !~ '^[0-9]+$' then
      raise exception 'Enter a supply name, unit and nonnegative whole quantities.' using errcode='22023';
    end if;
    quantity := (p_input->>'quantity')::integer;
    insert into public.inventory_stock_items(id,department_id,name,sku,barcode,unit,par_level,reorder_point,expiration_tracked)
      values(supply_id,p_department_id,left(btrim(p_input->>'name'),240),nullif(left(p_input->>'sku',120),''),nullif(left(p_input->>'barcode',120),''),left(btrim(p_input->>'unit'),40),coalesce(nullif(p_input->>'parLevel','')::integer,0),coalesce(nullif(p_input->>'reorderPoint','')::integer,0),coalesce((p_input->>'expirationTracked')::boolean,false));
    insert into public.inventory_stock_lots(id,department_id,stock_item_id,location_type,location_id,lot_number,expires_at,quantity_on_hand)
      values(lot_id,p_department_id,supply_id,'station',coalesce(nullif(btrim(left(p_input->>'locationId',120)),''),'main'),nullif(left(p_input->>'lotNumber',120),''),nullif(p_input->>'expiresAt','')::date,quantity);
    insert into public.inventory_transactions(department_id,stock_item_id,stock_lot_id,transaction_type,quantity,to_location_id,reason,performed_by)
      values(p_department_id,supply_id,lot_id,'initial',quantity,coalesce(nullif(btrim(left(p_input->>'locationId',120)),''),'main'),'Initial recorded quantity',auth.uid());
    result := jsonb_build_object('itemId',supply_id,'lotId',lot_id,'quantityOnHand',quantity);
  elsif p_action='create_stock_lot' then
    if coalesce(p_input->>'quantity','') !~ '^[0-9]+$' or (p_input->>'quantity')::integer < 1 or nullif(btrim(p_input->>'locationId'),'') is null or nullif(btrim(p_input->>'lotNumber'),'') is null then
      raise exception 'Enter the actual lot number, location and positive whole receipt quantity.' using errcode='22023';
    end if;
    select * into supply from public.inventory_stock_items where department_id=p_department_id and id=(p_input->>'stockItemId')::uuid for update;
    if not found then raise exception 'Supply not found in this department.' using errcode='P0002'; end if;
    if supply.expiration_tracked and nullif(p_input->>'expiresAt','') is null then
      raise exception 'Record the expiration date for this received lot.' using errcode='22023';
    end if;
    quantity := (p_input->>'quantity')::integer;
    insert into public.inventory_stock_lots(id,department_id,stock_item_id,location_type,location_id,lot_number,expires_at,quantity_on_hand)
      values(lot_id,p_department_id,supply.id,'station',left(btrim(p_input->>'locationId'),120),left(btrim(p_input->>'lotNumber'),120),nullif(p_input->>'expiresAt','')::date,quantity);
    insert into public.inventory_transactions(department_id,stock_item_id,stock_lot_id,transaction_type,quantity,to_location_id,reason,performed_by)
      values(p_department_id,supply.id,lot_id,'receive',quantity,left(btrim(p_input->>'locationId'),120),'New lot received',auth.uid());
    result := jsonb_build_object('itemId',supply.id,'lotId',lot_id,'quantityOnHand',quantity);
  elsif p_action='request_restock' then
    if coalesce(p_input->>'quantity','') !~ '^[0-9]+$' or (p_input->>'quantity')::integer < 1 then
      raise exception 'Enter a positive whole restock quantity.' using errcode='22023';
    end if;
    quantity := (p_input->>'quantity')::integer;
    select * into supply from public.inventory_stock_items where department_id=p_department_id and id=(p_input->>'stockItemId')::uuid for update;
    if not found then raise exception 'Supply not found in this department.' using errcode='P0002'; end if;
    if exists(select 1 from public.inventory_transactions where department_id=p_department_id and stock_item_id=supply.id and transaction_type in ('restock_requested','restock_approved')) then
      raise exception 'This supply already has an open restock request. Refresh to review it.' using errcode='40001';
    end if;
    insert into public.inventory_transactions(department_id,stock_item_id,transaction_type,quantity,reason,performed_by)
      values(p_department_id,supply.id,'restock_requested',quantity,coalesce(nullif(left(btrim(p_input->>'reason'),300),''),'Restock requested for ' || supply.name),auth.uid()) returning * into request_row;
    result := jsonb_build_object('restockRequestId',request_row.id);
  elsif p_action in ('approve_restock','fulfill_restock','create_stock_lot') then
    select * into request_row from public.inventory_transactions where department_id=p_department_id and id=(p_input->>'requestId')::uuid for update;
    if not found then raise exception 'Restock request not found in this department.' using errcode='P0002'; end if;
    expected_stage := case when p_action='approve_restock' then 'restock_requested' else 'restock_approved' end;
    next_stage := case when p_action='approve_restock' then 'restock_approved' else 'restock_fulfilled' end;
    if request_row.transaction_type <> expected_stage then
      raise exception 'This request is no longer awaiting that action. Refresh its saved status.' using errcode='40001';
    end if;
    update public.inventory_transactions set transaction_type=next_stage,
      reason=coalesce(request_row.reason,'') || ' | ' || next_stage || ' by ' || actor || ' at ' || now()::text
      where department_id=p_department_id and id=request_row.id;
    -- Approval and fulfillment describe the request, never a physical receipt.
    result := jsonb_build_object('updated',true,'restockRequestId',request_row.id);
  elsif p_action='adjust_stock' then
    if coalesce(p_input->>'delta','') !~ '^-?[0-9]+$' or nullif(btrim(p_input->>'reason'),'') is null then
      raise exception 'Enter a whole non-zero adjustment and its reason.' using errcode='22023';
    end if;
    delta := (p_input->>'delta')::integer;
    if delta=0 then raise exception 'Enter a non-zero adjustment.' using errcode='22023'; end if;
    select * into lot from public.inventory_stock_lots
      where department_id=p_department_id and id=(p_input->>'lotId')::uuid for update;
    if not found then raise exception 'Supply lot not found in this department.' using errcode='P0002'; end if;
    next_quantity := lot.quantity_on_hand::bigint+delta;
    if next_quantity < 0 or next_quantity > 2147483647 then
      raise exception 'Adjustment exceeds the saved quantity or supported limit. Refresh the lot.' using errcode='22023';
    end if;
    update public.inventory_stock_lots set quantity_on_hand=next_quantity::integer
      where department_id=p_department_id and id=lot.id;
    insert into public.inventory_transactions(department_id,stock_item_id,stock_lot_id,transaction_type,quantity,to_location_id,reason,performed_by)
      values(p_department_id,lot.stock_item_id,lot.id,case when delta>0 then 'receive' else 'use' end,delta,lot.location_id,left(btrim(p_input->>'reason'),300),auth.uid());
    result := jsonb_build_object('quantityOnHand',next_quantity,'lotId',lot.id);
  elsif p_action in ('create_notice','create_work_order') then
    v_apparatus_id := (p_input->>'apparatusId')::uuid;
    v_equipment_id := nullif(p_input->>'equipmentId','')::uuid;
    select * into apparatus from public.inventory_apparatus_profiles where department_id=p_department_id and id=v_apparatus_id;
    if not found then raise exception 'Apparatus not found in this department.' using errcode='P0002'; end if;
    if v_equipment_id is not null then
      select * into equipment from public.inventory_equipment where department_id=p_department_id and id=v_equipment_id and apparatus_id=apparatus.id and retired_at is null for update;
      if not found then raise exception 'Active equipment not found on this apparatus.' using errcode='P0002'; end if;
    end if;
    select coalesce(array_agg(value),array[]::text[]) into assigned_ids from jsonb_array_elements_text(coalesce(p_input->'assignedEmployeeIds','[]'::jsonb));
    select coalesce(array_agg(value),array[]::text[]) into assigned_names from jsonb_array_elements_text(coalesce(p_input->'assignedEmployeeNames','[]'::jsonb));
    if p_action='create_notice' then
      select coalesce(array_agg(value),array[]::text[]) into categories from jsonb_array_elements_text(coalesce(p_input->'issueCategories','[]'::jsonb));
      if nullif(btrim(p_input->>'notes'),'') is null or cardinality(categories)=0 or cardinality(assigned_ids)=0 or not categories <@ array['vehicle','air_pack','equipment'] then
        raise exception 'Select an issue type, assignee and notice details.' using errcode='22023';
      end if;
      photo_id := nullif(p_input->>'evidencePhotoId','')::uuid;
      if photo_id is not null and not exists(select 1 from public.inventory_deficiency_photos where department_id=p_department_id and apparatus_id=apparatus.id and id=photo_id) then
        raise exception 'Photo does not match this apparatus.' using errcode='22023';
      end if;
      insert into public.inventory_readiness_exceptions(id,department_id,apparatus_id,result,priority,notes,status,out_of_service,opened_by,issue_categories,assigned_employee_ids,assigned_employee_names,evidence_photo_id)
        values(exception_id,p_department_id,apparatus.id,'failed',coalesce(nullif(p_input->>'priority',''),'medium'),left(btrim(p_input->>'notes'),1000),'open',false,actor,categories,assigned_ids,assigned_names,photo_id);
      insert into public.inventory_work_orders(id,department_id,apparatus_id,linked_exception_id,status,priority,summary,details,assigned_to,assigned_employee_ids,assigned_employee_names,opened_by)
        values(order_id,p_department_id,apparatus.id,exception_id,'new',coalesce(nullif(p_input->>'priority',''),'medium'),apparatus.name || ' ' || array_to_string(categories,' / ') || ' notice',left(btrim(p_input->>'notes'),1000),array_to_string(assigned_names,', '),assigned_ids,assigned_names,actor);
      result := jsonb_build_object('noticeId',exception_id,'workOrderId',order_id);
    else
      if nullif(btrim(p_input->>'summary'),'') is null or v_service_type not in ('inspection','preventive','repair','recall','tires','fluids','electrical','body','other') or coalesce(nullif(p_input->>'odometer','')::integer,0)<0 then
        raise exception 'Enter work details, a valid service type and nonnegative mileage.' using errcode='22023';
      end if;
      insert into public.inventory_work_orders(id,department_id,apparatus_id,equipment_id,status,priority,summary,details,assigned_to,assigned_employee_ids,assigned_employee_names,opened_by,service_type,odometer)
        values(order_id,p_department_id,apparatus.id,v_equipment_id,'new',coalesce(nullif(p_input->>'priority',''),'routine'),left(btrim(p_input->>'summary'),240),left(p_input->>'details',1000),coalesce(nullif(array_to_string(assigned_names,', '),''),nullif(p_input->>'assignedTo','')),assigned_ids,assigned_names,actor,v_service_type,nullif(p_input->>'odometer','')::integer);
      if v_equipment_id is not null then
        update public.inventory_equipment set service_status='in_repair',updated_at=now()
          where department_id=p_department_id and id=v_equipment_id and service_status='in_service';
      end if;
      result := jsonb_build_object('workOrder',jsonb_build_object('id',order_id));
    end if;
  else
    select * into work from public.inventory_work_orders where department_id=p_department_id and id=(p_input->>'workOrderId')::uuid for update;
    if not found then raise exception 'Work order not found in this department.' using errcode='P0002'; end if;
    if work.status in ('closed','completed','cancelled') then
      raise exception 'This repair is no longer open. Refresh its saved history.' using errcode='40001';
    end if;
    if p_action='update_work_order_status' then
      if coalesce(p_input->>'status','') not in ('new','assigned','in_repair','waiting_parts') then
        raise exception 'Choose a valid repair stage.' using errcode='22023';
      end if;
      if nullif(p_input->>'expectedStatus','') is not null and work.status <> p_input->>'expectedStatus' then
        raise exception 'Repair stage changed since you opened it. Refresh before saving.' using errcode='40001';
      end if;
      update public.inventory_work_orders set status=p_input->>'status' where department_id=p_department_id and id=work.id;
      result := jsonb_build_object('updated',true);
    else
      cost := nullif(p_input->>'repairCost','')::numeric;
      v_repair_date := nullif(p_input->>'repairDate','')::date;
      if cost is null or cost < 0 or cost::text in ('NaN','Infinity','-Infinity') or v_repair_date is null or nullif(btrim(p_input->>'resolutionNotes'),'') is null or v_service_type not in ('inspection','preventive','repair','recall','tires','fluids','electrical','body','other') or coalesce(nullif(p_input->>'odometer','')::integer,0)<0 or coalesce(nullif(p_input->>'laborHours','')::numeric,0)<0 or coalesce(nullif(p_input->>'laborHours','')::numeric,0)::text in ('NaN','Infinity','-Infinity') or coalesce(nullif(p_input->>'nextServiceDueMileage','')::integer,0)<0 then
        raise exception 'Repair date, resolution, valid cost and nonnegative service readings are required.' using errcode='22023';
      end if;
      update public.inventory_work_orders set status='closed',closed_at=now(),repair_date=v_repair_date,repair_cost=cost,
        vendor=nullif(left(p_input->>'vendor',240),''),invoice_number=nullif(left(p_input->>'invoiceNumber',120),''),resolution_notes=left(btrim(p_input->>'resolutionNotes'),1000),closed_by=actor,
        service_type=v_service_type,odometer=nullif(p_input->>'odometer','')::integer,labor_hours=nullif(p_input->>'laborHours','')::numeric,
        performed_by=coalesce(nullif(left(p_input->>'performedBy',240),''),nullif(left(p_input->>'vendor',240),'')),parts_used=nullif(left(p_input->>'partsUsed',2000),''),next_service_due_date=nullif(p_input->>'nextServiceDueDate','')::date,next_service_due_mileage=nullif(p_input->>'nextServiceDueMileage','')::integer
        where department_id=p_department_id and id=work.id;
      if work.linked_exception_id is not null and not exists(select 1 from public.inventory_work_orders where department_id=p_department_id and linked_exception_id=work.linked_exception_id and id<>work.id and status not in ('closed','completed','cancelled')) then
        update public.inventory_readiness_exceptions set status='resolved',resolved_at=now(),resolved_by=actor,resolution_notes=left(btrim(p_input->>'resolutionNotes'),1000)
          where department_id=p_department_id and id=work.linked_exception_id and status <> 'resolved';
      end if;
      -- Completion is historical evidence, not an equipment release to service.
      -- Keep its saved service status and every other unresolved defect intact.
      result := jsonb_build_object('closed',true,'serviceStatusRequiresReview',work.equipment_id is not null);
    end if;
  end if;
  result := result || jsonb_build_object('requestId',p_request_id);
  insert into public.inventory_operation_receipts(department_id,request_id,actor_id,action,input,result)
    values(p_department_id,p_request_id,auth.uid(),p_action,p_input,result);
  return result;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."inventory_apply_operation"(p_department_id uuid, p_request_id uuid, p_action text, p_input jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_check_history_page(p_department uuid, p_apparatus uuid DEFAULT NULL::uuid, p_type text DEFAULT NULL::text, p_review text DEFAULT NULL::text, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_before_time timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 WITH page AS MATERIALIZED (
  SELECT c.*,a.archived_at,a.archived_by,a.reason AS archive_reason,a.replacement_check_id
  FROM public.inventory_checks c LEFT JOIN public.inventory_check_archives a ON a.check_id=c.id AND a.department_id=c.department_id
  WHERE c.department_id=p_department AND(c.status='completed' OR(c.status='cancelled' AND a.check_id IS NOT NULL))
   AND(p_apparatus IS NULL OR c.apparatus_id=p_apparatus) AND(p_type IS NULL OR c.check_type=p_type)
   AND(p_review IS NULL OR(c.status='completed' AND c.review_status=p_review))
   AND(p_from IS NULL OR COALESCE(c.completed_at,a.archived_at)>=(p_from::timestamp AT TIME ZONE 'America/Chicago'))
   AND(p_to IS NULL OR COALESCE(c.completed_at,a.archived_at)<((p_to+1)::timestamp AT TIME ZONE 'America/Chicago'))
   AND(p_before_time IS NULL OR(c.started_at,c.id)<(p_before_time,p_before_id))
  ORDER BY c.started_at DESC,c.id DESC LIMIT 26
 )
 SELECT to_jsonb(c)||jsonb_build_object('apparatus_name',COALESCE(a.name,''),'item_count',totals.items,'passed_count',totals.passed,'issue_count',totals.issues)
 FROM page c LEFT JOIN public.inventory_apparatus_profiles a ON a.id=c.apparatus_id AND a.department_id=p_department
 CROSS JOIN LATERAL(SELECT count(*) items,count(*) FILTER(WHERE result='pass') passed,count(*) FILTER(WHERE result IN('failed','missing','damaged')) issues
 FROM(SELECT i.result FROM public.inventory_check_items i WHERE i.check_id=c.id AND i.department_id=p_department AND c.check_type<>'air_pack'
 UNION ALL SELECT i.result FROM public.inventory_scba_check_entries i WHERE i.check_id=c.id AND i.department_id=p_department AND c.check_type='air_pack') results) totals
 ORDER BY c.started_at DESC,c.id DESC;
$function$;

REVOKE ALL ON FUNCTION "public"."inventory_check_history_page"(p_department uuid, p_apparatus uuid, p_type text, p_review text, p_from date, p_to date, p_before_time timestamp with time zone, p_before_id uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_check_report(p_department uuid, p_check uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 SELECT jsonb_build_object('check',to_jsonb(c)||jsonb_build_object('apparatus_name',COALESCE(a.name,''),'archived_at',archive.archived_at,'archived_by',archive.archived_by,'archive_reason',archive.reason,'replacement_check_id',archive.replacement_check_id),
 'items',CASE WHEN c.check_type='air_pack' THEN COALESCE((SELECT jsonb_agg(to_jsonb(i)||jsonb_build_object('equipment_name',i.label,'compartment_label',CASE i.section WHEN 'pack' THEN 'SCBA packs' WHEN 'rit' THEN 'R.I.T. bag' ELSE 'Spare bottles' END,'numeric_reading',i.psi) ORDER BY i.sort_order,i.id) FROM public.inventory_scba_check_entries i WHERE i.check_id=c.id AND i.department_id=p_department),'[]'::jsonb)
 ELSE COALESCE((SELECT jsonb_agg(to_jsonb(i)||jsonb_build_object('equipment_name',COALESCE(e.name,''),'compartment_label',COALESCE(location.label,'')) ORDER BY location.sort_order NULLS LAST,e.item_order,i.id)
 FROM public.inventory_check_items i LEFT JOIN public.inventory_equipment e ON e.id=i.equipment_id AND e.department_id=p_department
 LEFT JOIN public.inventory_compartments location ON location.id=e.compartment_id AND location.department_id=p_department
 WHERE i.check_id=c.id AND i.department_id=p_department),'[]'::jsonb) END)
 FROM public.inventory_checks c LEFT JOIN public.inventory_apparatus_profiles a ON a.id=c.apparatus_id AND a.department_id=p_department
 LEFT JOIN public.inventory_check_archives archive ON archive.check_id=c.id AND archive.department_id=p_department
 WHERE c.id=p_check AND c.department_id=p_department AND(c.status='completed' OR(c.status='cancelled' AND archive.check_id IS NOT NULL));
$function$;

REVOKE ALL ON FUNCTION "public"."inventory_check_report"(p_department uuid, p_check uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_complete_check_atomic(p_department_id uuid, p_check_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE inspection public.inventory_checks%ROWTYPE; remaining bigint; total bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT private.inventory_can_write(p_department_id) THEN RAISE EXCEPTION 'Inventory writing permission required' USING ERRCODE='42501'; END IF;
  SELECT * INTO inspection FROM public.inventory_checks WHERE department_id=p_department_id AND id=p_check_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inspection not found'; END IF;
  IF inspection.status='completed' THEN RETURN jsonb_build_object('completed',true,'alreadyCompleted',true); END IF;
  IF inspection.status <> 'in_progress' THEN RAISE EXCEPTION 'Inspection is not in progress'; END IF;
  IF inspection.check_type='air_pack' THEN
    SELECT count(*),count(*) FILTER(WHERE result='pending') INTO total,remaining FROM public.inventory_scba_check_entries WHERE department_id=p_department_id AND check_id=p_check_id;
  ELSE
    SELECT count(*),count(*) FILTER(WHERE result='pending') INTO total,remaining FROM public.inventory_check_items WHERE department_id=p_department_id AND check_id=p_check_id;
  END IF;
  IF total=0 OR remaining>0 THEN RAISE EXCEPTION 'Complete a configured checklist before submitting'; END IF;
  UPDATE public.inventory_checks SET status='completed',completed_at=now(),review_status='pending',reviewed_by=NULL,reviewed_at=NULL,review_notes=NULL WHERE department_id=p_department_id AND id=p_check_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inspection could not be submitted' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('completed',true);
END $function$;

REVOKE ALL ON FUNCTION "public"."inventory_complete_check_atomic"(p_department_id uuid, p_check_id uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_drug_outcome(s jsonb, r jsonb, complete boolean)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE k text; v text; mode text; condition text; quantity integer; expected integer; d date; issue boolean; today date:=(now() AT TIME ZONE 'America/Chicago')::date;
BEGIN
 IF s IS NULL OR COALESCE(s->>'version','')<>'1' OR r IS NULL OR jsonb_typeof(r)<>'object' OR octet_length(r::text)>24000 OR complete IS NULL THEN RAISE EXCEPTION 'Enter valid drug inventory fields'; END IF;
 mode:=s->>'mode';expected:=(s->>'expectedQuantity')::integer;
 IF mode IS NULL OR mode NOT IN ('medication','pass_fail','quantity','expiration_date','numeric','mileage','text') OR expected IS NULL OR expected NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Review the saved logging format'; END IF;
 FOR k IN SELECT jsonb_object_keys(r) LOOP
  IF k NOT IN ('condition','count','expirations','locations','value','notes') THEN RAISE EXCEPTION 'Unknown drug inventory field'; END IF;
  IF k IN ('expirations','locations') THEN
   IF jsonb_typeof(r->k)<>'array' OR jsonb_array_length(r->k)>100 OR EXISTS(SELECT 1 FROM jsonb_array_elements(r->k) x WHERE jsonb_typeof(x)<>'string' OR length(x#>>'{}')>(CASE WHEN k='locations' THEN 240 ELSE 10 END)) THEN RAISE EXCEPTION 'Enter valid container observations'; END IF;
  ELSIF jsonb_typeof(r->k)<>'string' OR length(r->>k)>(CASE WHEN k IN ('notes','value') THEN 4000 ELSE 30 END) THEN RAISE EXCEPTION 'Enter valid text observations'; END IF;
 END LOOP;
 condition:=COALESCE(r->>'condition','');
 IF condition NOT IN ('','satisfactory','issue','not_applicable') THEN RAISE EXCEPTION 'Choose the observed result'; END IF;
 IF COALESCE(r->>'count','')<>'' THEN
  IF r->>'count' !~ '^[0-9]{1,3}$' OR (r->>'count')::integer>100 THEN RAISE EXCEPTION 'Enter a whole count from 0 to 100'; END IF;
  quantity:=(r->>'count')::integer;
 END IF;
 IF mode IN ('numeric','mileage') AND COALESCE(r->>'value','')<>'' AND (r->>'value' !~ '^([0-9]+([.][0-9]*)?|[.][0-9]+)$' OR (r->>'value')::numeric<0) THEN RAISE EXCEPTION 'Enter a nonnegative numeric reading'; END IF;
 FOR v IN SELECT value FROM jsonb_array_elements_text(COALESCE(r->'expirations','[]'::jsonb)) UNION ALL SELECT r->>'value' WHERE mode='expiration_date' LOOP
  IF COALESCE(v,'')<>'' AND v<>'unknown' THEN
   IF v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Enter a valid expiration date'; END IF;
   BEGIN d:=v::date; EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RAISE EXCEPTION 'Enter a valid expiration date'; END;
   IF to_char(d,'YYYY-MM-DD')<>v THEN RAISE EXCEPTION 'Enter a valid expiration date'; END IF;
  END IF;
 END LOOP;
 issue:=condition='issue';
 IF mode='medication' AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(COALESCE(r->'locations','[]'::jsonb)) x WHERE btrim(x)<>'' AND lower(btrim(x))<>lower(btrim(s->>'location'))) THEN issue:=true; END IF;
 IF mode IN ('medication','quantity') AND quantity<expected THEN issue:=true; END IF;
 FOR v IN SELECT value FROM jsonb_array_elements_text(COALESCE(r->'expirations','[]'::jsonb)) WHERE mode='medication' UNION ALL SELECT r->>'value' WHERE mode='expiration_date' LOOP
  IF v='unknown' THEN issue:=true; ELSIF COALESCE(v,'')<>'' AND v::date<today THEN issue:=true; END IF;
 END LOOP;
 IF NOT complete THEN RETURN 'pending'; END IF;
 IF condition='' THEN RAISE EXCEPTION 'Choose the observed result'; END IF;
 IF condition='satisfactory' THEN
  IF mode IN ('medication','quantity') AND quantity IS NULL THEN RAISE EXCEPTION 'Enter the actual quantity counted'; END IF;
  IF mode='medication' AND (jsonb_array_length(COALESCE(r->'expirations','[]'::jsonb))<>quantity OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(COALESCE(r->'expirations','[]'::jsonb)) x WHERE x='') OR jsonb_array_length(COALESCE(r->'locations','[]'::jsonb))<>quantity OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(COALESCE(r->'locations','[]'::jsonb)) x WHERE btrim(x)='')) THEN RAISE EXCEPTION 'Record an expiration and location for every container present'; END IF;
  IF mode IN ('numeric','mileage','text','expiration_date') AND NULLIF(btrim(r->>'value'),'') IS NULL THEN RAISE EXCEPTION 'Record the required reading'; END IF;
 END IF;
 IF (issue OR condition='not_applicable') AND NULLIF(btrim(r->>'notes'),'') IS NULL THEN RAISE EXCEPTION 'Explain the issue or why this item does not apply'; END IF;
 RETURN CASE WHEN condition='not_applicable' THEN 'not_applicable' WHEN issue THEN CASE WHEN mode IN ('medication','quantity') AND quantity=0 THEN 'missing' ELSE 'failed' END ELSE 'pass' END;
END $function$;

REVOKE ALL ON FUNCTION "public"."inventory_drug_outcome"(s jsonb, r jsonb, complete boolean) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_guard_active_result()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE inspection_status text;
BEGIN
  SELECT status INTO inspection_status FROM public.inventory_checks WHERE id=NEW.check_id AND department_id=NEW.department_id FOR UPDATE;
  IF NOT FOUND OR inspection_status <> 'in_progress' THEN RAISE EXCEPTION 'This inspection is no longer in progress'; END IF;
  RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION "public"."inventory_guard_active_result"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_guard_archive_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE original public.inventory_checks%ROWTYPE; replacement public.inventory_checks%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT private.inventory_can_admin(NEW.department_id) THEN RAISE EXCEPTION 'Inventory setup permission required' USING ERRCODE='42501'; END IF;
 SELECT * INTO original FROM public.inventory_checks WHERE id=NEW.check_id AND department_id=NEW.department_id;
 SELECT * INTO replacement FROM public.inventory_checks WHERE id=NEW.replacement_check_id AND department_id=NEW.department_id;
 IF original.id IS NULL OR replacement.id IS NULL OR original.status<>'cancelled' OR original.completed_at IS NOT NULL OR original.check_type<>'weekly' OR replacement.check_type<>'weekly' OR original.apparatus_id<>replacement.apparatus_id OR replacement.status<>'in_progress' OR original.id=replacement.id THEN RAISE EXCEPTION 'An archive must link the original unfinished weekly check to its department replacement'; END IF;
 NEW.archived_at:=now();NEW.archived_by:=COALESCE(auth.jwt()->>'email',auth.uid()::text);
 RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION "public"."inventory_guard_archive_insert"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_guard_archived_check()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 IF EXISTS(SELECT 1 FROM public.inventory_check_archives a WHERE a.check_id=OLD.id AND a.department_id=OLD.department_id) AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Archived unfinished checks are read only'; END IF;
 RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION "public"."inventory_guard_archived_check"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_guard_archived_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 IF TG_OP<>'INSERT' AND EXISTS(SELECT 1 FROM public.inventory_check_archives a WHERE a.check_id=OLD.check_id AND a.department_id=OLD.department_id) THEN RAISE EXCEPTION 'Archived check entries are read only'; END IF;
 IF TG_OP<>'DELETE' AND EXISTS(SELECT 1 FROM public.inventory_check_archives a WHERE a.check_id=NEW.check_id AND a.department_id=NEW.department_id) THEN RAISE EXCEPTION 'Archived check entries are read only'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION "public"."inventory_guard_archived_item"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_guard_drug_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE inspection public.inventory_checks%ROWTYPE; equipment public.inventory_equipment%ROWTYPE; expected text; location text; outcome text;
BEGIN
 SELECT * INTO inspection FROM public.inventory_checks WHERE id=NEW.check_id AND department_id=NEW.department_id;
 IF TG_OP='INSERT' THEN
  SELECT * INTO equipment FROM public.inventory_equipment WHERE id=NEW.equipment_id AND department_id=NEW.department_id;
  IF inspection.check_type='drug' OR equipment.response_type='medication' THEN
   SELECT p.name||' · '||c.label INTO location FROM public.inventory_compartments c JOIN public.inventory_apparatus_profiles p ON p.id=c.apparatus_id AND p.department_id=c.department_id WHERE c.id=equipment.compartment_id AND c.department_id=NEW.department_id;
   NEW.drug_schema:=jsonb_build_object('version',1,'title',equipment.name,'mode',equipment.response_type,'expectedQuantity',equipment.quantity_required,'location',COALESCE(location,''))::text;
   IF NEW.result<>'pending' OR NEW.drug_response IS NOT NULL OR NEW.drug_photo_id IS NOT NULL THEN RAISE EXCEPTION 'New drug observations must start unanswered'; END IF;
  ELSE NEW.drug_schema:=NULL; END IF;
  NEW.drug_response_version:=0;
 ELSE
  IF NEW.drug_schema IS DISTINCT FROM OLD.drug_schema THEN RAISE EXCEPTION 'Saved logging format cannot change'; END IF;
  IF OLD.drug_schema IS NOT NULL AND (NEW.department_id<>OLD.department_id OR NEW.check_id<>OLD.check_id OR NEW.equipment_id<>OLD.equipment_id OR inspection.status<>'in_progress') THEN RAISE EXCEPTION 'Saved drug observations cannot move or change after completion'; END IF;
  NEW.drug_response_version:=OLD.drug_response_version+CASE WHEN NEW.drug_response IS DISTINCT FROM OLD.drug_response OR NEW.result IS DISTINCT FROM OLD.result OR NEW.drug_photo_id IS DISTINCT FROM OLD.drug_photo_id THEN 1 ELSE 0 END;
 END IF;
 IF NEW.drug_schema IS NOT NULL THEN
  outcome:=public.inventory_drug_outcome(NEW.drug_schema::jsonb,COALESCE(NEW.drug_response::jsonb,'{}'::jsonb),NEW.result<>'pending');
  IF NEW.result<>outcome THEN RAISE EXCEPTION 'Complete the saved drug logging fields to save this result'; END IF;
  IF NEW.result IN ('failed','missing','damaged') AND (NEW.drug_photo_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.inventory_deficiency_photos p WHERE p.id=NEW.drug_photo_id AND p.department_id=NEW.department_id AND p.apparatus_id=inspection.apparatus_id AND p.check_item_id=NEW.id)) THEN RAISE EXCEPTION 'Attach a photo documenting this drug inventory issue'; END IF;
 ELSIF NEW.drug_response IS NOT NULL OR NEW.drug_photo_id IS NOT NULL THEN RAISE EXCEPTION 'This item has no saved drug logging format'; END IF;
 RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION "public"."inventory_guard_drug_item"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_guard_meter_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE snapshot text; kind text; outcome text;
BEGIN
  SELECT e.meter_template,c.check_type INTO snapshot,kind FROM public.inventory_checks c
    JOIN public.inventory_equipment e ON e.id=NEW.equipment_id AND e.department_id=c.department_id
    WHERE c.id=NEW.check_id AND c.department_id=NEW.department_id;
  IF TG_OP='INSERT' THEN
    NEW.meter_template:=CASE WHEN kind='weekly' THEN snapshot ELSE NULL END;
    IF NEW.meter_template IS NOT NULL AND (NEW.result<>'pending' OR NEW.meter_response IS NOT NULL OR NEW.meter_photo_id IS NOT NULL) THEN RAISE EXCEPTION 'New meter inspection must start unanswered'; END IF;
    NEW.meter_response_version:=0;
  ELSE
    IF OLD.meter_template IS DISTINCT FROM NEW.meter_template AND NOT (OLD.meter_template IS NULL AND OLD.result='pending' AND NEW.result='pending' AND NEW.meter_response IS NULL AND kind='weekly' AND snapshot IS NOT NULL AND NEW.meter_template=snapshot) THEN RAISE EXCEPTION 'Saved meter template snapshot cannot change'; END IF;
    IF OLD.meter_template IS NOT NULL AND (NEW.check_id<>OLD.check_id OR NEW.equipment_id<>OLD.equipment_id OR NEW.department_id<>OLD.department_id) THEN RAISE EXCEPTION 'Saved meter inspection cannot move'; END IF;
    NEW.meter_response_version:=OLD.meter_response_version+CASE WHEN NEW.meter_response IS DISTINCT FROM OLD.meter_response OR NEW.result IS DISTINCT FROM OLD.result OR NEW.meter_photo_id IS DISTINCT FROM OLD.meter_photo_id THEN 1 ELSE 0 END;
  END IF;
  IF NEW.meter_template IS NOT NULL THEN
    outcome:=public.inventory_meter_outcome(COALESCE(NEW.meter_response::jsonb,'{}'::jsonb),NEW.result<>'pending');
    IF NEW.result<>outcome THEN RAISE EXCEPTION 'Use the completed meter form to save this result'; END IF;
    IF NEW.result='failed' AND (NEW.meter_photo_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.inventory_deficiency_photos p JOIN public.inventory_checks c ON c.id=NEW.check_id AND c.department_id=NEW.department_id WHERE p.id=NEW.meter_photo_id AND p.department_id=NEW.department_id AND p.check_item_id=NEW.id AND p.apparatus_id=c.apparatus_id)) THEN RAISE EXCEPTION 'Attach a photo of this meter issue'; END IF;
  ELSIF NEW.meter_response IS NOT NULL OR NEW.meter_photo_id IS NOT NULL THEN RAISE EXCEPTION 'This item has no weekly meter template'; END IF;
  RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION "public"."inventory_guard_meter_item"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_live_check_packet(p_department uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with live as materialized (
    select c.* from public.inventory_checks c
    where c.department_id = p_department and (c.status = 'in_progress'
      or (c.status = 'completed' and c.completed_at >= now() - interval '8 days'))
  )
  select jsonb_build_object(
    'checks', coalesce((select jsonb_agg(to_jsonb(c) order by c.started_at desc, c.id desc) from live c), '[]'::jsonb),
    'checkItems', coalesce((select jsonb_agg(to_jsonb(i) order by i.check_id, i.id)
      from public.inventory_check_items i join live c on c.id = i.check_id
      where i.department_id = p_department and c.status = 'in_progress'), '[]'::jsonb),
    'scbaEntries', coalesce((select jsonb_agg(to_jsonb(i) order by i.check_id, i.sort_order, i.id)
      from public.inventory_scba_check_entries i join live c on c.id = i.check_id
      where i.department_id = p_department and c.status = 'in_progress'), '[]'::jsonb)
  );
$function$;

REVOKE ALL ON FUNCTION "public"."inventory_live_check_packet"(p_department uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_log_air_maintenance(p_department uuid, p_equipment uuid, p_id uuid, p_record jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE asset public.inventory_equipment; saved uuid;
BEGIN
 IF NOT private.inventory_can_write(p_department) OR (p_department='14a76771-4c24-481b-8def-e6cce005c17b'::uuid AND NOT private.portal_has_permission('inventory.repairs.manage')) THEN RAISE EXCEPTION 'Repair management permission required' USING ERRCODE='42501'; END IF;
 SELECT * INTO asset FROM public.inventory_equipment WHERE department_id=p_department AND id=p_equipment AND scba_asset_kind IS NOT NULL FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Air asset not found'; END IF;
 IF length(btrim(coalesce(p_record->>'summary',''))) NOT BETWEEN 1 AND 240 OR length(btrim(coalesce(p_record->>'resolution_notes',''))) NOT BETWEEN 1 AND 1000 OR nullif(p_record->>'repair_date','') IS NULL THEN RAISE EXCEPTION 'Service date, summary, and work performed are required'; END IF;
 IF (p_record->>'repair_date')::date > (now() AT TIME ZONE 'America/Chicago')::date THEN RAISE EXCEPTION 'Completed maintenance cannot be dated in the future'; END IF;
 IF nullif(p_record->>'repair_cost','')::numeric < 0 THEN RAISE EXCEPTION 'Cost cannot be negative'; END IF;
 SELECT id INTO saved FROM public.inventory_work_orders WHERE department_id=p_department AND id=p_id AND equipment_id=p_equipment;
 IF FOUND THEN RETURN jsonb_build_object('id',saved,'changed',false); END IF;
 INSERT INTO public.inventory_work_orders(id,department_id,apparatus_id,equipment_id,status,priority,summary,details,opened_by,closed_by,closed_at,repair_date,repair_cost,vendor,invoice_number,resolution_notes,performed_by,service_type,next_service_due_date)
 VALUES(p_id,p_department,asset.apparatus_id,asset.id,'closed','routine',btrim(p_record->>'summary'),p_record->>'resolution_notes',auth.jwt()->>'email',auth.jwt()->>'email',now(),(p_record->>'repair_date')::date,nullif(p_record->>'repair_cost','')::numeric,p_record->>'vendor',p_record->>'invoice_number',p_record->>'resolution_notes',p_record->>'performed_by','other',nullif(p_record->>'next_service_due_date','')::date) RETURNING id INTO saved;
 RETURN jsonb_build_object('id',saved,'changed',true);
END $function$;

REVOKE ALL ON FUNCTION "public"."inventory_log_air_maintenance"(p_department uuid, p_equipment uuid, p_id uuid, p_record jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_meter_outcome(p_response jsonb, p_complete boolean)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE k text; v text; choices text[]; lights jsonb; actions jsonb; issue boolean; d date;
BEGIN
  IF p_response IS NULL OR jsonb_typeof(p_response) <> 'object' OR octet_length(p_response::text)>12000 THEN
    RAISE EXCEPTION 'Enter valid meter inspection fields'; END IF;
  FOR k IN SELECT jsonb_object_keys(p_response) LOOP
    IF k NOT IN ('inspectionDate','meterId','batteryCharge','stationLights','actions','endOfLife','sensitOperational','sensitLowBattery','memberName','notes') THEN RAISE EXCEPTION 'Unknown meter inspection field'; END IF;
    IF k IN ('stationLights','actions') THEN
      IF jsonb_typeof(p_response->k)<>'array' THEN RAISE EXCEPTION 'Choose valid meter results'; END IF;
      choices := CASE k WHEN 'stationLights' THEN ARRAY['green','yellow','red'] ELSE ARRAY['bumped','calibrated','failed'] END;
      IF jsonb_array_length(p_response->k)>3 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_response->k) x WHERE jsonb_typeof(x)<>'string' OR NOT (x#>>'{}'=ANY(choices)))
        OR (SELECT count(*)<>count(DISTINCT x) FROM jsonb_array_elements_text(p_response->k) x) THEN RAISE EXCEPTION 'Choose valid meter results'; END IF;
    ELSE
      IF jsonb_typeof(p_response->k)<>'string' THEN RAISE EXCEPTION 'Enter text for meter inspection fields'; END IF;
      v := p_response->>k;
      IF length(v)>(CASE WHEN k='notes' THEN 4000 ELSE 160 END) THEN RAISE EXCEPTION 'Meter inspection field is too long'; END IF;
      IF v<>'' AND ((k='meterId' AND v NOT IN ('M1','M2')) OR (k IN ('batteryCharge','sensitOperational','sensitLowBattery') AND v NOT IN ('yes','no')) OR (k='endOfLife' AND v NOT IN ('none','orange','red'))) THEN RAISE EXCEPTION 'Choose a valid meter result'; END IF;
      IF k='inspectionDate' AND v<>'' THEN
        BEGIN d:=v::date; EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Enter the actual inspection date'; END;
        IF v !~ '^\d{4}-\d{2}-\d{2}$' OR to_char(d,'YYYY-MM-DD')<>v OR d>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Chicago')::date THEN RAISE EXCEPTION 'Enter the actual inspection date, today or earlier'; END IF;
      END IF;
    END IF;
  END LOOP;
  lights:=COALESCE(p_response->'stationLights','[]'::jsonb); actions:=COALESCE(p_response->'actions','[]'::jsonb);
  IF (lights ? 'green' AND jsonb_array_length(lights)>1) OR (actions ? 'failed' AND jsonb_array_length(actions)>1) THEN RAISE EXCEPTION 'Meter answers contradict each other'; END IF;
  IF p_complete THEN
    FOREACH k IN ARRAY ARRAY['inspectionDate','meterId','batteryCharge','endOfLife','sensitOperational','sensitLowBattery','memberName'] LOOP
      IF NULLIF(btrim(p_response->>k),'') IS NULL THEN RAISE EXCEPTION 'Complete every required meter inspection field'; END IF;
    END LOOP;
    IF jsonb_array_length(lights)=0 OR jsonb_array_length(actions)=0 THEN RAISE EXCEPTION 'Record the station lights and bump or calibration result'; END IF;
  END IF;
  issue:=p_response->>'batteryCharge'='no' OR lights ?| ARRAY['yellow','red'] OR actions ? 'failed' OR p_response->>'endOfLife' IN ('orange','red') OR p_response->>'sensitOperational'='no' OR p_response->>'sensitLowBattery'='yes';
  IF p_complete AND issue AND NULLIF(btrim(p_response->>'notes'),'') IS NULL THEN RAISE EXCEPTION 'Describe the meter issue in comments'; END IF;
  RETURN CASE WHEN NOT p_complete THEN 'pending' WHEN issue THEN 'failed' ELSE 'pass' END;
END $function$;

REVOKE ALL ON FUNCTION "public"."inventory_meter_outcome"(p_response jsonb, p_complete boolean) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_record_item_atomic(p_department_id uuid, p_check_item_id uuid, p_result text, p_notes text DEFAULT NULL::text, p_numeric_reading numeric DEFAULT NULL::numeric, p_evidence_photo_id uuid DEFAULT NULL::uuid, p_categories text[] DEFAULT '{}'::text[], p_assigned_ids text[] DEFAULT '{}'::text[], p_assigned_names text[] DEFAULT '{}'::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE item public.inventory_check_items%ROWTYPE;
  inspection public.inventory_checks%ROWTYPE;
  equipment public.inventory_equipment%ROWTYPE;
  exception_id uuid; actor text; failure boolean; priority text; numeric_item boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT private.inventory_can_write(p_department_id) THEN
    RAISE EXCEPTION 'Inventory writing permission required' USING ERRCODE='42501';
  END IF;
  actor := COALESCE(auth.jwt()->>'email', auth.uid()::text);
  IF p_result IS NULL OR p_result NOT IN ('pass','failed','missing','damaged','not_applicable') THEN RAISE EXCEPTION 'Invalid inspection result'; END IF;
  SELECT * INTO item FROM public.inventory_check_items WHERE id=p_check_item_id AND department_id=p_department_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Check item not found'; END IF;
  -- Lock the parent first; completion and result writes use the same order.
  SELECT * INTO inspection FROM public.inventory_checks WHERE id=item.check_id AND department_id=p_department_id FOR UPDATE;
  IF NOT FOUND OR inspection.status <> 'in_progress' THEN RAISE EXCEPTION 'This inspection is no longer in progress'; END IF;
  SELECT * INTO item FROM public.inventory_check_items WHERE id=p_check_item_id AND department_id=p_department_id FOR UPDATE;
  SELECT * INTO equipment FROM public.inventory_equipment WHERE id=item.equipment_id AND department_id=p_department_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Equipment not found'; END IF;
  numeric_item := COALESCE(equipment.response_type IN ('numeric','mileage','quantity'),false) OR equipment.name ~* '\m(miles|mileage|odometer|milage|millage)\M';
  IF numeric_item AND (p_numeric_reading IS NULL OR p_numeric_reading < 0 OR p_numeric_reading::text IN ('NaN','Infinity','-Infinity') OR p_result <> 'pass') THEN RAISE EXCEPTION 'A valid numeric reading is required'; END IF;
  IF equipment.name ~* '\m(engine oil|transmission fluid)\M' AND NOT (
    (p_result='pass' AND split_part(COALESCE(p_notes,''),E'\n',1)='Fluid level: In range') OR
    (p_result='failed' AND split_part(COALESCE(p_notes,''),E'\n',1) IN ('Fluid level: Low','Fluid level: High'))
  ) THEN RAISE EXCEPTION 'Choose Low, In range, or High for this fluid level'; END IF;
  failure := p_result IN ('failed','missing','damaged');
  IF failure AND (NULLIF(btrim(p_notes),'') IS NULL OR p_evidence_photo_id IS NULL) THEN RAISE EXCEPTION 'A failed item requires notes and a photo'; END IF;
  IF p_evidence_photo_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.inventory_deficiency_photos WHERE id=p_evidence_photo_id AND department_id=p_department_id AND apparatus_id=inspection.apparatus_id AND check_item_id=item.id) THEN RAISE EXCEPTION 'Photo does not match this item'; END IF;
  UPDATE public.inventory_check_items SET result=p_result,notes=p_notes,numeric_reading=CASE WHEN numeric_item THEN p_numeric_reading ELSE NULL END,checked_by=actor,checked_at=now() WHERE id=item.id AND department_id=p_department_id RETURNING * INTO item;
  IF NOT FOUND THEN RAISE EXCEPTION 'Check item could not be saved' USING ERRCODE='42501'; END IF;
  IF failure THEN
    priority := CASE WHEN p_result='missing' THEN 'high' ELSE 'medium' END;
    IF (SELECT count(*) FROM public.inventory_readiness_exceptions WHERE department_id=p_department_id AND check_item_id=item.id AND status <> 'resolved') > 1 THEN RAISE EXCEPTION 'Multiple open repair notices need administrator review'; END IF;
    SELECT id INTO exception_id FROM public.inventory_readiness_exceptions WHERE department_id=p_department_id AND check_item_id=item.id AND status <> 'resolved' FOR UPDATE;
    IF exception_id IS NULL THEN
      INSERT INTO public.inventory_readiness_exceptions(department_id,apparatus_id,equipment_id,check_item_id,result,priority,notes,status,out_of_service,opened_by,issue_categories,assigned_employee_ids,assigned_employee_names,evidence_photo_id)
      VALUES(p_department_id,inspection.apparatus_id,item.equipment_id,item.id,p_result,priority,p_notes,'open',false,actor,CASE WHEN cardinality(p_categories)>0 THEN p_categories ELSE ARRAY[COALESCE(equipment.equipment_category,'equipment')] END,p_assigned_ids,p_assigned_names,p_evidence_photo_id) RETURNING id INTO exception_id;
    ELSE
      UPDATE public.inventory_readiness_exceptions SET result=p_result,priority=CASE WHEN p_result='missing' THEN 'high' ELSE 'medium' END,notes=p_notes,issue_categories=CASE WHEN cardinality(p_categories)>0 THEN p_categories ELSE ARRAY[COALESCE(equipment.equipment_category,'equipment')] END,assigned_employee_ids=p_assigned_ids,assigned_employee_names=p_assigned_names,evidence_photo_id=p_evidence_photo_id WHERE id=exception_id AND department_id=p_department_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Repair notice could not be saved' USING ERRCODE='42501'; END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.inventory_work_orders WHERE department_id=p_department_id AND linked_exception_id=exception_id AND status <> 'closed') THEN
      INSERT INTO public.inventory_work_orders(department_id,apparatus_id,equipment_id,linked_exception_id,status,priority,summary,details,assigned_to,assigned_employee_ids,assigned_employee_names,opened_by)
      VALUES(p_department_id,inspection.apparatus_id,item.equipment_id,exception_id,'new',priority,equipment.name || ' failed ' || replace(inspection.check_type,'_',' ') || ' check',p_notes,NULLIF(array_to_string(p_assigned_names,', '),''),p_assigned_ids,p_assigned_names,actor);
    END IF;
  END IF;
  RETURN jsonb_build_object('saved',true,'checkItems',jsonb_build_array(to_jsonb(item)));
END $function$;

REVOKE ALL ON FUNCTION "public"."inventory_record_item_atomic"(p_department_id uuid, p_check_item_id uuid, p_result text, p_notes text, p_numeric_reading numeric, p_evidence_photo_id uuid, p_categories text[], p_assigned_ids text[], p_assigned_names text[]) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_restart_weekly_check(p_department uuid, p_check uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE original public.inventory_checks%ROWTYPE; previous public.inventory_check_archives%ROWTYPE; new_id uuid; equipment_ids uuid[]; today date:=(now() AT TIME ZONE 'America/Chicago')::date; saturday date; actor text;
BEGIN
 IF auth.uid() IS NULL OR NOT private.inventory_can_admin(p_department) OR NOT private.inventory_can_write(p_department) THEN RAISE EXCEPTION 'Inventory setup and checking permissions required' USING ERRCODE='42501'; END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Explain why this unfinished check is being replaced'; END IF;
 SELECT * INTO original FROM public.inventory_checks WHERE id=p_check AND department_id=p_department FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'The original check is unavailable for your department' USING ERRCODE='42501'; END IF;
 SELECT * INTO previous FROM public.inventory_check_archives WHERE check_id=p_check AND department_id=p_department;
 IF FOUND THEN RETURN jsonb_build_object('saved',true,'alreadyRestarted',true,'checkId',previous.replacement_check_id,'archivedCheckId',p_check); END IF;
 IF original.check_type<>'weekly' OR original.status<>'in_progress' OR original.completed_at IS NOT NULL THEN RAISE EXCEPTION 'Only an unfinished weekly check can be archived and replaced'; END IF;
 IF EXISTS(SELECT 1 FROM public.department_apparatus WHERE id=original.apparatus_id AND department_id=p_department AND status='out_of_service') THEN RAISE EXCEPTION 'This apparatus is Out of Service; its original check has not been changed'; END IF;
 IF EXISTS(SELECT 1 FROM public.inventory_equipment e JOIN public.inventory_compartments c ON c.id=e.compartment_id AND c.department_id=e.department_id WHERE e.department_id=p_department AND e.apparatus_id=original.apparatus_id AND e.retired_at IS NULL AND 'weekly'=ANY(e.check_types) AND e.meter_template IS NULL AND (e.check_types && ARRAY['inventory','air_pack']::text[] OR c.label='Inventory')) THEN RAISE EXCEPTION 'Remove inventory-only entries from the saved weekly template before replacing this check'; END IF;
 saturday:=today+CASE WHEN extract(dow FROM today)::int=0 THEN -1 ELSE 6-extract(dow FROM today)::int END;
 SELECT array_agg(e.id ORDER BY e.id) INTO equipment_ids FROM public.inventory_equipment e
 WHERE e.department_id=p_department AND e.apparatus_id=original.apparatus_id AND e.retired_at IS NULL AND 'weekly'=ANY(e.check_types)
 AND(e.weekly_recurrence<>'first_third_saturday' OR extract(day FROM saturday) BETWEEN 1 AND 7 OR extract(day FROM saturday) BETWEEN 15 AND 21);
 IF COALESCE(cardinality(equipment_ids),0)=0 THEN RAISE EXCEPTION 'Configure the current weekly mechanical checklist first'; END IF;
 actor:=COALESCE(auth.jwt()->>'email',auth.uid()::text);
 UPDATE public.inventory_checks SET status='cancelled' WHERE id=p_check AND department_id=p_department;
 INSERT INTO public.inventory_checks(department_id,apparatus_id,check_type,status,started_by) VALUES(p_department,original.apparatus_id,'weekly','in_progress',actor) RETURNING id INTO new_id;
 INSERT INTO public.inventory_check_items(department_id,check_id,equipment_id,result) SELECT p_department,new_id,equipment_id,'pending' FROM unnest(equipment_ids) equipment_id;
 INSERT INTO public.inventory_check_archives(check_id,department_id,replacement_check_id,reason,archived_by) VALUES(p_check,p_department,new_id,btrim(p_reason),actor);
 RETURN jsonb_build_object('saved',true,'alreadyRestarted',false,'checkId',new_id,'archivedCheckId',p_check,'itemCount',cardinality(equipment_ids));
END $function$;

REVOKE ALL ON FUNCTION "public"."inventory_restart_weekly_check"(p_department uuid, p_check uuid, p_reason text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_save_air_asset(p_department uuid, p_id uuid, p_expected_updated_at timestamp with time zone, p_asset jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE old_row public.inventory_equipment; new_row public.inventory_equipment; place public.inventory_compartments; rig public.inventory_apparatus_profiles; template public.inventory_scba_templates; slot text;
BEGIN
 IF NOT private.inventory_can_admin(p_department) THEN RAISE EXCEPTION 'Inventory setup permission required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_department::text,731));
 SELECT * INTO old_row FROM public.inventory_equipment WHERE department_id=p_department AND id=p_id FOR UPDATE;
 IF FOUND AND (old_row.scba_asset_kind IS NULL OR old_row.retired_at IS NOT NULL) THEN RAISE EXCEPTION 'This is not an active registered air asset'; END IF;
 SELECT * INTO place FROM public.inventory_compartments WHERE department_id=p_department AND id=(p_asset->>'compartment_id')::uuid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose a saved department location'; END IF;
 SELECT * INTO rig FROM public.inventory_apparatus_profiles WHERE department_id=p_department AND id=place.apparatus_id;
 IF NOT FOUND OR lower(rig.name)='1211' OR lower(rig.name) LIKE '%utv%' OR lower(rig.asset_type)='utv' THEN RAISE EXCEPTION 'Choose an apparatus that uses air checks'; END IF;
 IF p_asset->>'scba_asset_kind' IS NULL OR p_asset->>'scba_asset_kind' NOT IN ('pack','bottle') OR length(btrim(coalesce(p_asset->>'asset_number',''))) NOT BETWEEN 1 AND 80 OR length(btrim(coalesce(p_asset->>'name',''))) NOT BETWEEN 1 AND 240 THEN RAISE EXCEPTION 'Type, unique ID, and name are required'; END IF;
 IF old_row.id IS NOT NULL AND old_row.scba_asset_kind<>p_asset->>'scba_asset_kind' THEN RAISE EXCEPTION 'A pack cannot be changed into a bottle'; END IF;
 new_row:=jsonb_populate_record(old_row,p_asset);
 new_row.id:=p_id; new_row.department_id:=p_department; new_row.apparatus_id:=place.apparatus_id; new_row.compartment_id:=place.id;
 new_row.asset_number:=btrim(new_row.asset_number); new_row.name:=btrim(new_row.name);
 new_row.quantity_required:=1; new_row.item_type:='individual'; new_row.equipment_category:='air_pack';
 slot:=nullif(btrim(new_row.scba_check_slot),''); new_row.scba_check_slot:=slot;
 IF slot IS NOT NULL THEN
  SELECT * INTO template FROM public.inventory_scba_templates WHERE department_id=p_department AND apparatus_id=place.apparatus_id AND active;
  IF NOT FOUND OR NOT (
   (new_row.scba_asset_kind='pack' AND slot=ANY(ARRAY(SELECT 'pack:'||unnest(template.pack_positions)))) OR
   (new_row.scba_asset_kind='bottle' AND ((template.include_rit AND slot='rit:R.I.T. Bag') OR slot=ANY(ARRAY(SELECT 'spare:Spare #'||generate_series(1,template.spare_bottle_count)))))
  ) THEN RAISE EXCEPTION 'That checklist position changed. Choose a current position or Additional item'; END IF;
 END IF;
 IF old_row.id IS NOT NULL THEN
  IF to_jsonb(old_row)=to_jsonb(new_row) THEN RETURN jsonb_build_object('id',old_row.id,'changed',false); END IF;
  IF p_expected_updated_at IS DISTINCT FROM old_row.updated_at THEN RAISE EXCEPTION 'This record changed on another screen. Reopen it before saving' USING ERRCODE='PT409'; END IF;
  UPDATE public.inventory_equipment SET name=new_row.name,asset_number=new_row.asset_number,sku=new_row.sku,
   manufacturer=new_row.manufacturer,model=new_row.model,serial_number=new_row.serial_number,barcode=new_row.barcode,
   purchase_date=new_row.purchase_date,in_service_date=new_row.in_service_date,expiration_date=new_row.expiration_date,
   last_serviced_date=new_row.last_serviced_date,service_interval_months=new_row.service_interval_months,service_reminder_months=new_row.service_reminder_months,
   hydro_test_date=new_row.hydro_test_date,hydro_due_date=new_row.hydro_due_date,scba_notes=new_row.scba_notes,
   apparatus_id=new_row.apparatus_id,compartment_id=new_row.compartment_id,scba_check_slot=slot,updated_at=clock_timestamp()
   WHERE department_id=p_department AND id=p_id RETURNING * INTO new_row;
 ELSE
  IF p_expected_updated_at IS NOT NULL THEN RAISE EXCEPTION 'The record no longer exists. Refresh the list'; END IF;
  INSERT INTO public.inventory_equipment(id,department_id,apparatus_id,compartment_id,name,scba_asset_kind,asset_number,sku,manufacturer,model,serial_number,barcode,purchase_date,in_service_date,expiration_date,hydro_test_date,hydro_due_date,scba_notes,scba_check_slot,last_serviced_date,service_interval_months,service_reminder_months,quantity_required,item_type,equipment_category,check_types)
   VALUES(p_id,p_department,place.apparatus_id,place.id,new_row.name,new_row.scba_asset_kind,new_row.asset_number,new_row.sku,new_row.manufacturer,new_row.model,new_row.serial_number,new_row.barcode,new_row.purchase_date,new_row.in_service_date,new_row.expiration_date,new_row.hydro_test_date,new_row.hydro_due_date,new_row.scba_notes,slot,new_row.last_serviced_date,new_row.service_interval_months,new_row.service_reminder_months,1,'individual','air_pack',ARRAY['air_pack']) RETURNING * INTO new_row;
 END IF;
 IF new_row.id IS NULL THEN RAISE EXCEPTION 'The record could not be saved'; END IF;
 RETURN jsonb_build_object('id',new_row.id,'changed',true);
END $function$;

REVOKE ALL ON FUNCTION "public"."inventory_save_air_asset"(p_department uuid, p_id uuid, p_expected_updated_at timestamp with time zone, p_asset jsonb) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_save_drug_atomic(p_department_id uuid, p_item_id uuid, p_response text, p_expected_version integer, p_complete boolean, p_photo_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE item public.inventory_check_items%ROWTYPE; inspection public.inventory_checks%ROWTYPE; r jsonb; s jsonb; outcome text; photo uuid; v_notes text; actor text; exception_id uuid; v_priority text; dates text; locations text;
BEGIN
 IF auth.uid() IS NULL OR NOT private.inventory_can_write(p_department_id) THEN RAISE EXCEPTION 'Inventory writing permission required' USING ERRCODE='42501'; END IF;
 SELECT * INTO item FROM public.inventory_check_items WHERE id=p_item_id AND department_id=p_department_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Drug check item not found' USING ERRCODE='42501'; END IF;
 SELECT * INTO inspection FROM public.inventory_checks WHERE id=item.check_id AND department_id=p_department_id FOR UPDATE;
 IF NOT FOUND OR inspection.status<>'in_progress' THEN RAISE EXCEPTION 'This check is no longer in progress'; END IF;
 SELECT * INTO item FROM public.inventory_check_items WHERE id=p_item_id AND department_id=p_department_id FOR UPDATE;
 IF item.drug_schema IS NULL THEN RAISE EXCEPTION 'Choose a saved drug check item'; END IF;
 IF p_expected_version IS NULL OR item.drug_response_version<>p_expected_version THEN RAISE EXCEPTION 'Another crew member saved this entry. Refresh and compare the latest saved entry.' USING ERRCODE='40001'; END IF;
 r:=p_response::jsonb;s:=item.drug_schema::jsonb;outcome:=public.inventory_drug_outcome(s,r,p_complete);photo:=COALESCE(p_photo_id,item.drug_photo_id);
 IF photo IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.inventory_deficiency_photos p WHERE p.id=photo AND p.department_id=p_department_id AND p.apparatus_id=inspection.apparatus_id AND p.check_item_id=item.id) THEN RAISE EXCEPTION 'The issue photo must match this check item'; END IF;
 SELECT string_agg('Container '||ord||' expiration: '||CASE value WHEN 'unknown' THEN 'Unable to verify' WHEN '' THEN 'Not recorded' ELSE value END,E'\n' ORDER BY ord) INTO dates FROM jsonb_array_elements_text(COALESCE(r->'expirations','[]'::jsonb)) WITH ORDINALITY x(value,ord) WHERE s->>'mode'='medication';
 SELECT string_agg('Container '||ord||' observed location: '||COALESCE(NULLIF(value,''),'Not recorded'),E'\n' ORDER BY ord) INTO locations FROM jsonb_array_elements_text(COALESCE(r->'locations','[]'::jsonb)) WITH ORDINALITY x(value,ord) WHERE s->>'mode'='medication';
 v_notes:=concat_ws(E'\n',s->>'title','Observed result: '||COALESCE(NULLIF(replace(r->>'condition','_',' '),''),'Not recorded'),CASE WHEN s->>'mode' IN ('medication','quantity') THEN 'Quantity counted: '||COALESCE(NULLIF(r->>'count',''),'Not recorded')||'; required '||(s->>'expectedQuantity') END,dates,locations,CASE WHEN s->>'mode' IN ('text','numeric','mileage','expiration_date') THEN 'Reading: '||CASE WHEN r->>'value'='unknown' THEN 'Unable to verify' ELSE COALESCE(NULLIF(r->>'value',''),'Not recorded') END END,CASE WHEN NULLIF(btrim(r->>'notes'),'') IS NOT NULL THEN 'Comments: '||btrim(r->>'notes') END);
 actor:=COALESCE(auth.jwt()->>'email',auth.uid()::text);
 UPDATE public.inventory_check_items SET drug_response=p_response,drug_photo_id=photo,result=outcome,notes=v_notes,numeric_reading=CASE WHEN s->>'mode' IN ('numeric','mileage') AND COALESCE(r->>'value','')<>'' THEN (r->>'value')::numeric ELSE NULL END,checked_by=CASE WHEN p_complete THEN actor ELSE NULL END,checked_at=CASE WHEN p_complete THEN now() ELSE NULL END WHERE id=item.id AND department_id=p_department_id RETURNING * INTO item;
 IF outcome IN ('failed','missing','damaged') THEN
  v_priority:=CASE WHEN outcome='missing' THEN 'high' ELSE 'medium' END;
  IF (SELECT count(*) FROM public.inventory_readiness_exceptions WHERE department_id=p_department_id AND check_item_id=item.id AND status<>'resolved')>1 THEN RAISE EXCEPTION 'Multiple open findings need administrator review'; END IF;
  SELECT id INTO exception_id FROM public.inventory_readiness_exceptions WHERE department_id=p_department_id AND check_item_id=item.id AND status<>'resolved' FOR UPDATE;
  IF exception_id IS NULL THEN
   INSERT INTO public.inventory_readiness_exceptions(department_id,apparatus_id,equipment_id,check_item_id,result,priority,notes,status,out_of_service,opened_by,issue_categories,assigned_employee_ids,assigned_employee_names,evidence_photo_id) VALUES(p_department_id,inspection.apparatus_id,item.equipment_id,item.id,outcome,v_priority,v_notes,'open',false,actor,ARRAY['equipment'],'{}','{}',photo) RETURNING id INTO exception_id;
  ELSE UPDATE public.inventory_readiness_exceptions SET result=outcome,priority=v_priority,notes=v_notes,evidence_photo_id=photo WHERE id=exception_id AND department_id=p_department_id; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.inventory_work_orders WHERE department_id=p_department_id AND linked_exception_id=exception_id AND status<>'closed') THEN
   INSERT INTO public.inventory_work_orders(department_id,apparatus_id,equipment_id,linked_exception_id,status,priority,summary,details,opened_by) VALUES(p_department_id,inspection.apparatus_id,item.equipment_id,exception_id,'new',v_priority,'Drug inventory needs attention: '||(s->>'title'),v_notes,actor);
  END IF;
 END IF;
 RETURN jsonb_build_object('saved',true,'checkItems',jsonb_build_array(to_jsonb(item)));
END $function$;

REVOKE ALL ON FUNCTION "public"."inventory_save_drug_atomic"(p_department_id uuid, p_item_id uuid, p_response text, p_expected_version integer, p_complete boolean, p_photo_id uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_save_meter_atomic(p_department_id uuid, p_item_id uuid, p_response text, p_expected_version integer, p_complete boolean, p_notes text, p_photo_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE item public.inventory_check_items%ROWTYPE; inspection public.inventory_checks%ROWTYPE; outcome text; photo uuid; saved jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.inventory_can_write(p_department_id) THEN RAISE EXCEPTION 'Inventory writing permission required' USING ERRCODE='42501'; END IF;
  SELECT * INTO item FROM public.inventory_check_items WHERE department_id=p_department_id AND id=p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Meter inspection not found' USING ERRCODE='42501'; END IF;
  SELECT * INTO inspection FROM public.inventory_checks WHERE department_id=p_department_id AND id=item.check_id FOR UPDATE;
  IF NOT FOUND OR inspection.status<>'in_progress' THEN RAISE EXCEPTION 'This weekly inspection is no longer in progress'; END IF;
  SELECT * INTO item FROM public.inventory_check_items WHERE department_id=p_department_id AND id=p_item_id FOR UPDATE;
  IF item.meter_template IS NULL OR inspection.check_type<>'weekly' THEN RAISE EXCEPTION 'Choose a weekly meter inspection'; END IF;
  IF p_expected_version IS NULL OR item.meter_response_version<>p_expected_version THEN RAISE EXCEPTION 'Another crew member saved this entry. Load the latest saved entry before saving.' USING ERRCODE='40001'; END IF;
  IF p_complete IS NULL THEN RAISE EXCEPTION 'Choose draft or completed inspection'; END IF;
  outcome:=public.inventory_meter_outcome(p_response::jsonb,p_complete); photo:=COALESCE(p_photo_id,item.meter_photo_id);
  IF photo IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.inventory_deficiency_photos p WHERE p.id=photo AND p.department_id=p_department_id AND p.apparatus_id=inspection.apparatus_id AND p.check_item_id=p_item_id) THEN RAISE EXCEPTION 'The photo must match this meter inspection'; END IF;
  UPDATE public.inventory_check_items SET meter_response=p_response,meter_photo_id=photo,result='pending',notes=p_notes,checked_by=NULL,checked_at=NULL WHERE id=p_item_id AND department_id=p_department_id;
  IF p_complete THEN
    saved:=public.inventory_record_item_atomic(p_department_id,p_item_id,outcome,p_notes,NULL,photo,ARRAY['equipment'],'{}','{}');
    IF outcome='failed' THEN
      UPDATE public.inventory_work_orders w SET summary='Weekly meter inspection needs attention',details=p_notes
        WHERE w.department_id=p_department_id AND w.status<>'closed' AND w.linked_exception_id IN (SELECT x.id FROM public.inventory_readiness_exceptions x WHERE x.department_id=p_department_id AND x.check_item_id=p_item_id);
    END IF;
    RETURN saved;
  END IF;
  SELECT * INTO item FROM public.inventory_check_items WHERE id=p_item_id AND department_id=p_department_id;
  RETURN jsonb_build_object('saved',true,'checkItems',jsonb_build_array(to_jsonb(item)));
END $function$;

REVOKE ALL ON FUNCTION "public"."inventory_save_meter_atomic"(p_department_id uuid, p_item_id uuid, p_response text, p_expected_version integer, p_complete boolean, p_notes text, p_photo_id uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_save_meter_template(p_department_id uuid, p_equipment_id uuid, p_expected_version integer, p_title text, p_instructions text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE equipment public.inventory_equipment%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT private.inventory_can_admin(p_department_id) THEN RAISE EXCEPTION 'Checklist administration permission required' USING ERRCODE='42501'; END IF;
  SELECT * INTO equipment FROM public.inventory_equipment WHERE department_id=p_department_id AND id=p_equipment_id AND retired_at IS NULL FOR UPDATE;
  IF NOT FOUND OR equipment.meter_template IS NULL THEN RAISE EXCEPTION 'Meter template not found' USING ERRCODE='42501'; END IF;
  IF p_expected_version IS NULL OR equipment.meter_template_version<>p_expected_version THEN RAISE EXCEPTION 'This template changed. Refresh before editing again.' USING ERRCODE='40001'; END IF;
  IF NULLIF(btrim(p_title),'') IS NULL OR length(p_title)>100 OR p_instructions IS NULL OR length(p_instructions)>2000 THEN RAISE EXCEPTION 'Enter a heading and instructions within their limits'; END IF;
  UPDATE public.inventory_equipment SET meter_template=(meter_template::jsonb || jsonb_build_object('title',btrim(p_title),'instructions',btrim(p_instructions)))::text,meter_template_version=meter_template_version+1
    WHERE id=p_equipment_id AND department_id=p_department_id RETURNING * INTO equipment;
  RETURN to_jsonb(equipment);
END $function$;

REVOKE ALL ON FUNCTION "public"."inventory_save_meter_template"(p_department_id uuid, p_equipment_id uuid, p_expected_version integer, p_title text, p_instructions text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inventory_start_air_check(p_department uuid, p_apparatus uuid, p_shift text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE v_check_id uuid; template public.inventory_scba_templates; rig public.inventory_apparatus_profiles; asset record; position text; seq int:=0; matches int; actor text;
BEGIN
 IF NOT private.inventory_can_write(p_department) OR (p_department='14a76771-4c24-481b-8def-e6cce005c17b'::uuid AND NOT private.portal_has_permission('inventory.check')) THEN RAISE EXCEPTION 'Inventory check permission required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_department::text,731));
 SELECT id INTO v_check_id FROM public.inventory_checks WHERE department_id=p_department AND apparatus_id=p_apparatus AND check_type='air_pack' AND status='in_progress' LIMIT 1;
 IF FOUND THEN RETURN jsonb_build_object('checkId',v_check_id,'resumed',true); END IF;
 SELECT * INTO rig FROM public.inventory_apparatus_profiles WHERE department_id=p_department AND id=p_apparatus;
 IF NOT FOUND OR lower(rig.name)='1211' OR lower(rig.name) LIKE '%utv%' OR lower(rig.asset_type)='utv' THEN RAISE EXCEPTION 'Choose an apparatus that uses air checks'; END IF;
 actor:=coalesce(auth.jwt()->>'email',auth.uid()::text);
 v_check_id:=gen_random_uuid();
 INSERT INTO public.inventory_checks(id,department_id,apparatus_id,shift_id,check_type,status,started_by) VALUES(v_check_id,p_department,p_apparatus,p_shift,'air_pack','in_progress',actor);
 SELECT * INTO template FROM public.inventory_scba_templates WHERE department_id=p_department AND apparatus_id=p_apparatus AND active;
 IF FOUND THEN
  FOREACH position IN ARRAY template.pack_positions LOOP
   seq:=seq+1;
   INSERT INTO public.inventory_scba_check_entries(department_id,check_id,section,label,sort_order) VALUES(p_department,v_check_id,'pack',position,seq);
  END LOOP;
  IF template.include_rit THEN
   seq:=seq+1;
   INSERT INTO public.inventory_scba_check_entries(department_id,check_id,section,label,sort_order) VALUES(p_department,v_check_id,'rit','R.I.T. Bag',seq);
  END IF;
  FOR n IN 1..template.spare_bottle_count LOOP
   seq:=seq+1;
   INSERT INTO public.inventory_scba_check_entries(department_id,check_id,section,label,sort_order) VALUES(p_department,v_check_id,'spare','Spare #'||n,seq);
  END LOOP;
 END IF;
 FOR asset IN SELECT e.*,c.label location FROM public.inventory_equipment e JOIN public.inventory_compartments c ON c.id=e.compartment_id AND c.department_id=e.department_id
  WHERE e.department_id=p_department AND e.apparatus_id=p_apparatus AND e.scba_asset_kind IS NOT NULL AND e.retired_at IS NULL ORDER BY e.asset_number LOOP
  UPDATE public.inventory_scba_check_entries entry SET equipment_id=asset.id,asset_number=asset.asset_number,location_snapshot=rig.name||' · '||asset.location,
   label=entry.label||' · ID '||asset.asset_number,
   harness_number=CASE WHEN asset.scba_asset_kind='pack' THEN asset.asset_number ELSE NULL END,
   cylinder_number=CASE WHEN asset.scba_asset_kind='bottle' THEN asset.asset_number ELSE NULL END
   WHERE entry.department_id=p_department AND entry.check_id=v_check_id AND entry.equipment_id IS NULL AND entry.section||':'||entry.label=asset.scba_check_slot;
  GET DIAGNOSTICS matches=ROW_COUNT;
  IF matches=0 THEN
   seq:=seq+1;
   INSERT INTO public.inventory_scba_check_entries(department_id,check_id,section,label,sort_order,equipment_id,asset_number,location_snapshot,harness_number,cylinder_number)
    VALUES(p_department,v_check_id,CASE WHEN asset.scba_asset_kind='pack' THEN 'pack' ELSE 'spare' END,asset.name||' · ID '||asset.asset_number,seq,asset.id,asset.asset_number,rig.name||' · '||asset.location,CASE WHEN asset.scba_asset_kind='pack' THEN asset.asset_number ELSE NULL END,CASE WHEN asset.scba_asset_kind='bottle' THEN asset.asset_number ELSE NULL END);
  END IF;
 END LOOP;
 IF seq=0 THEN RAISE EXCEPTION 'Register an air asset or configure the weekly checklist before starting'; END IF;
 RETURN jsonb_build_object('checkId',v_check_id,'resumed',false);
END $function$;

REVOKE ALL ON FUNCTION "public"."inventory_start_air_check"(p_department uuid, p_apparatus uuid, p_shift text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_platform_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.platform_owners
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$function$;

REVOKE ALL ON FUNCTION "public"."is_platform_owner"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.portal_confirmation_status()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ SELECT private.portal_confirmation_status(); $function$;

REVOKE ALL ON FUNCTION "public"."portal_confirmation_status"() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.portal_pin_status(p_unlock_token text DEFAULT NULL::text)
 RETURNS TABLE(configured boolean, unlocked boolean, locked_until timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT c.user_id IS NOT NULL,
    c.user_id IS NOT NULL AND (
      COALESCE(c.unlock_token_hash=encode(extensions.digest(p_unlock_token,'sha256'),'hex') AND c.unlock_expires_at>now(),false)
      OR private.portal_remembered_until(p_unlock_token) IS NOT NULL),c.locked_until
  FROM (SELECT auth.uid() AS user_id) identity_row
  LEFT JOIN public.portal_pin_credentials c ON c.user_id=identity_row.user_id
$function$;

REVOKE ALL ON FUNCTION "public"."portal_pin_status"(p_unlock_token text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.portal_remembered_device_status(p_unlock_token text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT jsonb_build_object('rememberedUntil',private.portal_remembered_until(p_unlock_token),'serverNow',now())
$function$;

REVOKE ALL ON FUNCTION "public"."portal_remembered_device_status"(p_unlock_token text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.renew_own_portal_pin_unlock(p_unlock_token text, p_station_display boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  updated_rows integer := 0;
BEGIN
  IF current_user_id IS NULL OR p_unlock_token IS NULL OR length(p_unlock_token) < 32 THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.department_memberships membership
    WHERE membership.user_id = current_user_id AND membership.status = 'active'
  ) AND NOT public.is_platform_owner() THEN
    RETURN false;
  END IF;

  UPDATE public.portal_pin_credentials
  SET unlock_expires_at = now() + CASE
        WHEN p_station_display THEN interval '30 days'
        ELSE interval '12 hours'
      END,
      updated_at = now()
  WHERE user_id = current_user_id
    AND unlock_token_hash = encode(extensions.digest(p_unlock_token, 'sha256'), 'hex')
    AND unlock_expires_at > now();

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows = 1;
END;
$function$;

REVOKE ALL ON FUNCTION "public"."renew_own_portal_pin_unlock"(p_unlock_token text, p_station_display boolean) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_portal_pin(p_pin text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  unlock_token text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Verified sign-in is required.' USING ERRCODE = '42501';
  END IF;
  IF p_pin !~ '^\d{4,6}$' THEN
    RAISE EXCEPTION 'PIN must contain 4 to 6 digits.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.department_memberships membership
    WHERE membership.user_id = current_user_id AND membership.status = 'active'
  ) AND NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'Active department membership is required.' USING ERRCODE = '42501';
  END IF;

  unlock_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.portal_pin_credentials (
    user_id, pin_hash, failed_attempts, locked_until,
    unlock_token_hash, unlock_expires_at, updated_at
  ) VALUES (
    current_user_id, crypt(p_pin, gen_salt('bf', 12)), 0, NULL,
    encode(digest(unlock_token, 'sha256'), 'hex'), now() + interval '12 hours', now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    pin_hash = excluded.pin_hash,
    failed_attempts = 0,
    locked_until = NULL,
    unlock_token_hash = excluded.unlock_token_hash,
    unlock_expires_at = excluded.unlock_expires_at,
    updated_at = now();

  RETURN unlock_token;
END;
$function$;

REVOKE ALL ON FUNCTION "public"."set_portal_pin"(p_pin text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.verify_portal_pin(p_pin text)
 RETURNS TABLE(ok boolean, unlock_token text, locked_until timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  credentials public.portal_pin_credentials%ROWTYPE;
  next_failed_attempts integer;
  next_unlock_token text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Verified sign-in is required.' USING ERRCODE = '42501';
  END IF;
  IF p_pin !~ '^\d{4,6}$' THEN
    RETURN QUERY SELECT false, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT * INTO credentials
  FROM public.portal_pin_credentials
  WHERE user_id = current_user_id
  FOR UPDATE;

  IF credentials.user_id IS NULL THEN
    RAISE EXCEPTION 'A portal PIN has not been configured.' USING ERRCODE = 'P0002';
  END IF;
  IF credentials.locked_until IS NOT NULL AND credentials.locked_until > now() THEN
    RETURN QUERY SELECT false, NULL::text, credentials.locked_until;
    RETURN;
  END IF;

  IF crypt(p_pin, credentials.pin_hash) = credentials.pin_hash THEN
    next_unlock_token := encode(gen_random_bytes(32), 'hex');
    UPDATE public.portal_pin_credentials SET
      failed_attempts = 0,
      locked_until = NULL,
      unlock_token_hash = encode(digest(next_unlock_token, 'sha256'), 'hex'),
      unlock_expires_at = now() + interval '12 hours',
      updated_at = now()
    WHERE user_id = current_user_id;
    RETURN QUERY SELECT true, next_unlock_token, NULL::timestamptz;
    RETURN;
  END IF;

  next_failed_attempts := credentials.failed_attempts + 1;
  UPDATE public.portal_pin_credentials SET
    failed_attempts = CASE WHEN next_failed_attempts >= 5 THEN 0 ELSE next_failed_attempts END,
    locked_until = CASE WHEN next_failed_attempts >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
    unlock_token_hash = NULL,
    unlock_expires_at = NULL,
    updated_at = now()
  WHERE user_id = current_user_id
  RETURNING portal_pin_credentials.locked_until INTO credentials.locked_until;

  RETURN QUERY SELECT false, NULL::text, credentials.locked_until;
END;
$function$;

REVOKE ALL ON FUNCTION "public"."verify_portal_pin"(p_pin text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.verify_portal_pin_for_login(p_email text, p_pin text, p_department_id uuid)
 RETURNS TABLE(ok boolean, user_id uuid, email text, locked_until timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  verification record;
  verified_user_id uuid;
BEGIN
  SELECT * INTO verification
  FROM firehouse.verify_portal_login(p_email, p_pin, p_department_id);

  IF NOT coalesce(verification.ok, false) OR verification.email IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, verification.locked_until;
    RETURN;
  END IF;

  SELECT auth_user.id INTO verified_user_id
  FROM auth.users AS auth_user
  WHERE lower(auth_user.email) = lower(verification.email)
  LIMIT 1;

  RETURN QUERY SELECT verified_user_id IS NOT NULL, verified_user_id, verification.email, NULL::timestamptz;
END;
$function$;

REVOKE ALL ON FUNCTION "public"."verify_portal_pin_for_login"(p_email text, p_pin text, p_department_id uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.verify_portal_pin_with_device(p_pin text, p_department_id uuid)
 RETURNS TABLE(ok boolean, unlock_token text, locked_until timestamp with time zone, remembered_until timestamp with time zone)
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  SELECT * FROM private.verify_portal_pin_with_device(p_pin,p_department_id)
$function$;

REVOKE ALL ON FUNCTION "public"."verify_portal_pin_with_device"(p_pin text, p_department_id uuid) FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE "firehouse"."apparatus_trackers" ALTER COLUMN "device_id" SET DEFAULT gen_random_uuid();

ALTER TABLE "firehouse"."apparatus_trackers" ALTER COLUMN "enabled" SET DEFAULT true;

ALTER TABLE "firehouse"."apparatus_trackers" ALTER COLUMN "expires_at" SET DEFAULT (now() + '90 days'::interval);

ALTER TABLE "firehouse"."apparatus_trackers" ALTER COLUMN "moving" SET DEFAULT false;

ALTER TABLE "firehouse"."apparatus_trackers" ALTER COLUMN "sequence" SET DEFAULT 0;

ALTER TABLE "firehouse"."apparatus_trackers" ALTER COLUMN "paired_at" SET DEFAULT now();

ALTER TABLE "firehouse"."board_feed_cache" ALTER COLUMN "status" SET DEFAULT 'unavailable'::text;

ALTER TABLE "firehouse"."box_cards" ALTER COLUMN "address" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."box_cards" ALTER COLUMN "box_number" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."box_cards" ALTER COLUMN "access_notes" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."box_cards" ALTER COLUMN "details" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."box_cards" ALTER COLUMN "department" SET DEFAULT 'Stickney'::text;

ALTER TABLE "firehouse"."box_cards" ALTER COLUMN "document_url" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."box_cards" ALTER COLUMN "document_page" SET DEFAULT 0;

ALTER TABLE "firehouse"."box_cards" ALTER COLUMN "effective_date" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."box_cards" ALTER COLUMN "review_date" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."box_cards" ALTER COLUMN "layout_data" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."box_cards" ALTER COLUMN "status" SET DEFAULT 'Active'::text;

ALTER TABLE "firehouse"."box_cards" ALTER COLUMN "created_by" SET DEFAULT 'System'::text;

ALTER TABLE "firehouse"."box_cards" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."box_cards" ALTER COLUMN "updated_by" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."box_cards" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."cad_inbound_receipts" ALTER COLUMN "external_event_id" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."cad_inbound_receipts" ALTER COLUMN "external_incident_id" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."cad_inbound_receipts" ALTER COLUMN "event_type" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."cad_inbound_receipts" ALTER COLUMN "payload_format" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."cad_inbound_receipts" ALTER COLUMN "normalized_payload" SET DEFAULT '{}'::text;

ALTER TABLE "firehouse"."cad_inbound_receipts" ALTER COLUMN "error_message" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."cad_inbound_receipts" ALTER COLUMN "received_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."cad_push_deliveries" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "firehouse"."cad_push_deliveries" ALTER COLUMN "state" SET DEFAULT 'pending'::text;

ALTER TABLE "firehouse"."cad_push_deliveries" ALTER COLUMN "attempts" SET DEFAULT 0;

ALTER TABLE "firehouse"."cad_push_deliveries" ALTER COLUMN "next_attempt_at" SET DEFAULT now();

ALTER TABLE "firehouse"."cad_push_deliveries" ALTER COLUMN "expires_at" SET DEFAULT (now() + '00:05:00'::interval);

ALTER TABLE "firehouse"."cad_push_events" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "firehouse"."cad_push_events" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "firehouse"."callback_payroll_aggregates" ALTER COLUMN "manual_baseline_hours" SET DEFAULT 0;

ALTER TABLE "firehouse"."callback_payroll_aggregates" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE "firehouse"."callback_review_settings" ALTER COLUMN "rules_json" SET DEFAULT '{}'::text;

ALTER TABLE "firehouse"."callback_review_settings" ALTER COLUMN "updated_by" SET DEFAULT 'System'::text;

ALTER TABLE "firehouse"."callback_review_settings" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE "firehouse"."chief_board_attachments" ALTER COLUMN "content_type" SET DEFAULT 'application/octet-stream'::text;

ALTER TABLE "firehouse"."chief_board_attachments" ALTER COLUMN "size_bytes" SET DEFAULT 0;

ALTER TABLE "firehouse"."chief_board_attachments" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."chief_board_items" ALTER COLUMN "item_type" SET DEFAULT 'note'::text;

ALTER TABLE "firehouse"."chief_board_items" ALTER COLUMN "body" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."chief_board_items" ALTER COLUMN "event_date" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."chief_board_items" ALTER COLUMN "starts_at" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."chief_board_items" ALTER COLUMN "ends_at" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."chief_board_items" ALTER COLUMN "expires_at" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."chief_board_items" ALTER COLUMN "invite_status" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."chief_board_items" ALTER COLUMN "active" SET DEFAULT 1;

ALTER TABLE "firehouse"."chief_board_items" ALTER COLUMN "created_by" SET DEFAULT 'System'::text;

ALTER TABLE "firehouse"."chief_board_items" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."chief_board_items" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."chief_board_items" ALTER COLUMN "officer_name" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."daily_duties" ALTER COLUMN "duty" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."daily_duties" ALTER COLUMN "updated_by" SET DEFAULT 'System'::text;

ALTER TABLE "firehouse"."daily_duties" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."daily_log_approvals" ALTER COLUMN "sign_in_equipment" SET DEFAULT '{}'::text;

ALTER TABLE "firehouse"."daily_log_approvals" ALTER COLUMN "sign_in_note" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."daily_log_approvals" ALTER COLUMN "reviewed_notes" SET DEFAULT 0;

ALTER TABLE "firehouse"."daily_log_approvals" ALTER COLUMN "sign_out_equipment" SET DEFAULT '{}'::text;

ALTER TABLE "firehouse"."daily_log_approvals" ALTER COLUMN "sign_out_note" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."daily_log_approvals" ALTER COLUMN "fleet_duties_acknowledged" SET DEFAULT 0;

ALTER TABLE "firehouse"."daily_log_callback_submissions" ALTER COLUMN "report_number" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."daily_log_callback_submissions" ALTER COLUMN "status" SET DEFAULT 'pending'::text;

ALTER TABLE "firehouse"."daily_log_callback_submissions" ALTER COLUMN "submitted_at" SET DEFAULT now();

ALTER TABLE "firehouse"."daily_log_callback_submissions" ALTER COLUMN "review_note" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."daily_log_callback_submissions" ALTER COLUMN "call_type" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."daily_log_callback_submissions" ALTER COLUMN "call_time_out" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."daily_log_callback_submissions" ALTER COLUMN "call_time_in" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."daily_log_callback_submissions" ALTER COLUMN "rule_version" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."daily_log_callback_submissions" ALTER COLUMN "rule_matches" SET DEFAULT '[]'::text;

ALTER TABLE "firehouse"."daily_log_callback_submissions" ALTER COLUMN "rule_flags" SET DEFAULT '[]'::text;

ALTER TABLE "firehouse"."daily_log_callback_submissions" ALTER COLUMN "suggested_hours" SET DEFAULT 2;

ALTER TABLE "firehouse"."daily_log_callback_submissions" ALTER COLUMN "approved_hours" SET DEFAULT 0;

ALTER TABLE "firehouse"."daily_log_callback_submissions" ALTER COLUMN "submitted_by_rank" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."daily_log_calls" ALTER COLUMN "report_number" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."daily_log_calls" ALTER COLUMN "time_out" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."daily_log_calls" ALTER COLUMN "time_in" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."daily_log_calls" ALTER COLUMN "responding_units" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."daily_log_calls" ALTER COLUMN "address" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."daily_log_calls" ALTER COLUMN "call_type" SET DEFAULT 'EMS'::text;

ALTER TABLE "firehouse"."daily_log_calls" ALTER COLUMN "sort_order" SET DEFAULT 0;

ALTER TABLE "firehouse"."daily_log_staffing" ALTER COLUMN "time_in" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."daily_log_staffing" ALTER COLUMN "time_out" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."daily_log_staffing" ALTER COLUMN "acting_officer" SET DEFAULT 0;

ALTER TABLE "firehouse"."daily_log_staffing" ALTER COLUMN "sort_order" SET DEFAULT 0;

ALTER TABLE "firehouse"."daily_log_staffing" ALTER COLUMN "time_in_instant" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."daily_log_staffing" ALTER COLUMN "time_out_instant" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."daily_logs" ALTER COLUMN "shift_notes" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."daily_logs" ALTER COLUMN "locked" SET DEFAULT 0;

ALTER TABLE "firehouse"."daily_logs" ALTER COLUMN "admin_unlocked" SET DEFAULT 0;

ALTER TABLE "firehouse"."daily_logs" ALTER COLUMN "created_by" SET DEFAULT 'System'::text;

ALTER TABLE "firehouse"."daily_logs" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."daily_logs" ALTER COLUMN "updated_by" SET DEFAULT 'System'::text;

ALTER TABLE "firehouse"."daily_logs" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."daily_logs" ALTER COLUMN "save_version" SET DEFAULT 0;

ALTER TABLE "firehouse"."dispatch_incidents" ALTER COLUMN "category" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."dispatch_incidents" ALTER COLUMN "address" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."dispatch_incidents" ALTER COLUMN "city" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."dispatch_incidents" ALTER COLUMN "narrative" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."dispatch_incidents" ALTER COLUMN "responding_units" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."dispatch_incidents" ALTER COLUMN "time_out" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."dispatch_incidents" ALTER COLUMN "attachment_count" SET DEFAULT 0;

ALTER TABLE "firehouse"."dispatch_incidents" ALTER COLUMN "source_payload" SET DEFAULT '{}'::text;

ALTER TABLE "firehouse"."dispatch_incidents" ALTER COLUMN "source_system" SET DEFAULT 'CAD email'::text;

ALTER TABLE "firehouse"."dispatch_incidents" ALTER COLUMN "received_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."dispatch_incidents" ALTER COLUMN "active" SET DEFAULT 1;

ALTER TABLE "firehouse"."employee_account_links" ALTER COLUMN "linked_at" SET DEFAULT now();

ALTER TABLE "firehouse"."employee_permission_overrides" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."employee_profiles" ALTER COLUMN "schedule_sms_opt_in" SET DEFAULT 0;

ALTER TABLE "firehouse"."employee_profiles" ALTER COLUMN "employment_type" SET DEFAULT 'Part-time'::text;

ALTER TABLE "firehouse"."employee_profiles" ALTER COLUMN "is_dpw" SET DEFAULT 0;

ALTER TABLE "firehouse"."employee_profiles" ALTER COLUMN "driver_status" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."employee_profiles" ALTER COLUMN "acting_officer_eligible" SET DEFAULT 0;

ALTER TABLE "firehouse"."employee_profiles" ALTER COLUMN "is_admin" SET DEFAULT 0;

ALTER TABLE "firehouse"."employee_profiles" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."employee_profiles" ALTER COLUMN "station_roles" SET DEFAULT '[]'::text;

ALTER TABLE "firehouse"."employee_profiles" ALTER COLUMN "station_hours_this_period" SET DEFAULT 0;

ALTER TABLE "firehouse"."employee_profiles" ALTER COLUMN "station_ot_hours" SET DEFAULT 0;

ALTER TABLE "firehouse"."employee_profiles" ALTER COLUMN "station_mandatory_hours" SET DEFAULT 0;

ALTER TABLE "firehouse"."employee_profiles" ALTER COLUMN "station_off_duty" SET DEFAULT 0;

ALTER TABLE "firehouse"."employee_profiles" ALTER COLUMN "station_last_mandated" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."employee_profiles" ALTER COLUMN "station_consecutive_mandatory" SET DEFAULT 0;

ALTER TABLE "firehouse"."employee_profiles" ALTER COLUMN "station_notify_email" SET DEFAULT 1;

ALTER TABLE "firehouse"."employee_profiles" ALTER COLUMN "station_notify_text" SET DEFAULT 0;

ALTER TABLE "firehouse"."employee_profiles" ALTER COLUMN "single_role" SET DEFAULT 0;

ALTER TABLE "firehouse"."employees" ALTER COLUMN "active" SET DEFAULT 1;

ALTER TABLE "firehouse"."employees" ALTER COLUMN "sort_order" SET DEFAULT 0;

ALTER TABLE "firehouse"."employees" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_hydrant_flow_tests" ALTER COLUMN "desired_residual" SET DEFAULT 20;

ALTER TABLE "firehouse"."field_hydrant_flow_tests" ALTER COLUMN "notes" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_hydrant_flow_tests" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_hydrant_flushes" ALTER COLUMN "water_clear" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_hydrant_flushes" ALTER COLUMN "issues" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_hydrant_flushes" ALTER COLUMN "notes" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_hydrant_flushes" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_hydrant_service_events" ALTER COLUMN "notes" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_hydrants" ALTER COLUMN "hydrant_number" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_hydrants" ALTER COLUMN "address" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_hydrants" ALTER COLUMN "service_status" SET DEFAULT 'in_service'::text;

ALTER TABLE "firehouse"."field_hydrants" ALTER COLUMN "manufacturer" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_hydrants" ALTER COLUMN "model" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_hydrants" ALTER COLUMN "port_count" SET DEFAULT 2;

ALTER TABLE "firehouse"."field_hydrants" ALTER COLUMN "port_sizes" SET DEFAULT '[]'::text;

ALTER TABLE "firehouse"."field_hydrants" ALTER COLUMN "notes" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_hydrants" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_hydrants" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_alerts" ALTER COLUMN "instructions" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_alerts" ALTER COLUMN "severity" SET DEFAULT 'informational'::text;

ALTER TABLE "firehouse"."field_preplan_alerts" ALTER COLUMN "display_order" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_alerts" ALTER COLUMN "pin_to_respond" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_alerts" ALTER COLUMN "expiration_action" SET DEFAULT 'require_verification'::text;

ALTER TABLE "firehouse"."field_preplan_alerts" ALTER COLUMN "verification_required" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_alerts" ALTER COLUMN "archived" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_alerts" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_alerts" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_annotations" ALTER COLUMN "operational_subtype" SET DEFAULT 'custom'::text;

ALTER TABLE "firehouse"."field_preplan_annotations" ALTER COLUMN "label" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_annotations" ALTER COLUMN "line_color" SET DEFAULT '#dc2626'::text;

ALTER TABLE "firehouse"."field_preplan_annotations" ALTER COLUMN "fill_color" SET DEFAULT '#dc2626'::text;

ALTER TABLE "firehouse"."field_preplan_annotations" ALTER COLUMN "line_width" SET DEFAULT 3;

ALTER TABLE "firehouse"."field_preplan_annotations" ALTER COLUMN "opacity" SET DEFAULT 0.25;

ALTER TABLE "firehouse"."field_preplan_annotations" ALTER COLUMN "font_size" SET DEFAULT 16;

ALTER TABLE "firehouse"."field_preplan_annotations" ALTER COLUMN "rotation" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_annotations" ALTER COLUMN "arrow_config" SET DEFAULT '{}'::text;

ALTER TABLE "firehouse"."field_preplan_annotations" ALTER COLUMN "units" SET DEFAULT 'feet'::text;

ALTER TABLE "firehouse"."field_preplan_annotations" ALTER COLUMN "sort_order" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_annotations" ALTER COLUMN "expiration_action" SET DEFAULT 'require_verification'::text;

ALTER TABLE "firehouse"."field_preplan_annotations" ALTER COLUMN "archived" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_annotations" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_annotations" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_assets" ALTER COLUMN "caption" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_assets" ALTER COLUMN "description" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_assets" ALTER COLUMN "sort_order" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_assets" ALTER COLUMN "pin_to_respond" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_assets" ALTER COLUMN "version" SET DEFAULT 1;

ALTER TABLE "firehouse"."field_preplan_assets" ALTER COLUMN "archived" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_assets" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_assets" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_external_details" ALTER COLUMN "review_notes" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_feature_levels" ALTER COLUMN "is_primary" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_feature_levels" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_features" ALTER COLUMN "label" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_features" ALTER COLUMN "system_type" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_features" ALTER COLUMN "service_status" SET DEFAULT 'in_service'::text;

ALTER TABLE "firehouse"."field_preplan_features" ALTER COLUMN "details" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_features" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_features" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_features" ALTER COLUMN "mapped" SET DEFAULT 1;

ALTER TABLE "firehouse"."field_preplan_features" ALTER COLUMN "operational_category" SET DEFAULT 'building_system'::text;

ALTER TABLE "firehouse"."field_preplan_features" ALTER COLUMN "severity" SET DEFAULT 'informational'::text;

ALTER TABLE "firehouse"."field_preplan_features" ALTER COLUMN "display_priority" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_features" ALTER COLUMN "expiration_action" SET DEFAULT 'require_verification'::text;

ALTER TABLE "firehouse"."field_preplan_features" ALTER COLUMN "structured_metadata" SET DEFAULT '{}'::text;

ALTER TABLE "firehouse"."field_preplan_features" ALTER COLUMN "updated_by" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_hazmat" ALTER COLUMN "mapped" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_hazmat" ALTER COLUMN "un_na_number" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_hazmat" ALTER COLUMN "erg_guide_number" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_hazmat" ALTER COLUMN "quantity_unit" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_hazmat" ALTER COLUMN "container_type" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_hazmat" ALTER COLUMN "physical_state" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_hazmat" ALTER COLUMN "nfpa_special" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_hazmat" ALTER COLUMN "expiration_action" SET DEFAULT 'require_verification'::text;

ALTER TABLE "firehouse"."field_preplan_hazmat" ALTER COLUMN "notes" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_hazmat" ALTER COLUMN "archived" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_hazmat" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_hazmat" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_hazmat_zones" ALTER COLUMN "fill_color" SET DEFAULT '#dc2626'::text;

ALTER TABLE "firehouse"."field_preplan_hazmat_zones" ALTER COLUMN "line_color" SET DEFAULT '#991b1b'::text;

ALTER TABLE "firehouse"."field_preplan_hazmat_zones" ALTER COLUMN "opacity" SET DEFAULT 0.2;

ALTER TABLE "firehouse"."field_preplan_hazmat_zones" ALTER COLUMN "line_width" SET DEFAULT 3;

ALTER TABLE "firehouse"."field_preplan_hazmat_zones" ALTER COLUMN "line_style" SET DEFAULT 'solid'::text;

ALTER TABLE "firehouse"."field_preplan_hazmat_zones" ALTER COLUMN "archived" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_hazmat_zones" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_hazmat_zones" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_hose_lays" ALTER COLUMN "destination_side" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_hose_lays" ALTER COLUMN "segment_distances" SET DEFAULT '[]'::text;

ALTER TABLE "firehouse"."field_preplan_hose_lays" ALTER COLUMN "section_length_feet" SET DEFAULT 100;

ALTER TABLE "firehouse"."field_preplan_hose_lays" ALTER COLUMN "reserve_feet" SET DEFAULT 100;

ALTER TABLE "firehouse"."field_preplan_hose_lays" ALTER COLUMN "supply_line_label" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_hose_lays" ALTER COLUMN "notes" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_hose_lays" ALTER COLUMN "archived" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_hose_lays" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_hose_lays" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_imports" ALTER COLUMN "status" SET DEFAULT 'location_required'::text;

ALTER TABLE "firehouse"."field_preplan_imports" ALTER COLUMN "geocode_note" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_imports" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_imports" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_imports" ALTER COLUMN "source_external_id" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_imports" ALTER COLUMN "source_payload" SET DEFAULT '{}'::text;

ALTER TABLE "firehouse"."field_preplan_levels" ALTER COLUMN "grade_designation" SET DEFAULT 'at_grade'::text;

ALTER TABLE "firehouse"."field_preplan_levels" ALTER COLUMN "sort_order" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_levels" ALTER COLUMN "is_default" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_levels" ALTER COLUMN "respond_visible" SET DEFAULT 1;

ALTER TABLE "firehouse"."field_preplan_levels" ALTER COLUMN "hidden" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_levels" ALTER COLUMN "archived" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_levels" ALTER COLUMN "background_type" SET DEFAULT 'none'::text;

ALTER TABLE "firehouse"."field_preplan_levels" ALTER COLUMN "background_transform" SET DEFAULT '{}'::text;

ALTER TABLE "firehouse"."field_preplan_levels" ALTER COLUMN "opacity" SET DEFAULT 1;

ALTER TABLE "firehouse"."field_preplan_levels" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_levels" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_observations" ALTER COLUMN "status" SET DEFAULT 'pending'::text;

ALTER TABLE "firehouse"."field_preplan_photo_annotations" ALTER COLUMN "label" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_photo_annotations" ALTER COLUMN "style" SET DEFAULT '{}'::text;

ALTER TABLE "firehouse"."field_preplan_photo_annotations" ALTER COLUMN "sort_order" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_photo_annotations" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_photo_annotations" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_photos" ALTER COLUMN "side" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_photos" ALTER COLUMN "content_type" SET DEFAULT 'image/jpeg'::text;

ALTER TABLE "firehouse"."field_preplan_photos" ALTER COLUMN "size_bytes" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_photos" ALTER COLUMN "caption" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_photos" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_photos" ALTER COLUMN "illustrations" SET DEFAULT '[]'::text;

ALTER TABLE "firehouse"."field_preplan_photos" ALTER COLUMN "illustration_version" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_reviews" ALTER COLUMN "comment" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_reviews" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_revisions" ALTER COLUMN "summary" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_revisions" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_risk_factors" ALTER COLUMN "manual_override" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_risk_factors" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_risk_factors" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_settings" ALTER COLUMN "hose_section_length_feet" SET DEFAULT 100;

ALTER TABLE "firehouse"."field_preplan_settings" ALTER COLUMN "hose_reserve_feet" SET DEFAULT 100;

ALTER TABLE "firehouse"."field_preplan_settings" ALTER COLUMN "review_warning_days" SET DEFAULT 30;

ALTER TABLE "firehouse"."field_preplan_settings" ALTER COLUMN "erg_data_version" SET DEFAULT 'ERG2024'::text;

ALTER TABLE "firehouse"."field_preplan_settings" ALTER COLUMN "updated_by" SET DEFAULT 'System'::text;

ALTER TABLE "firehouse"."field_preplan_settings" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_spaces" ALTER COLUMN "room_number" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_spaces" ALTER COLUMN "space_type" SET DEFAULT 'room'::text;

ALTER TABLE "firehouse"."field_preplan_spaces" ALTER COLUMN "aliases" SET DEFAULT '[]'::text;

ALTER TABLE "firehouse"."field_preplan_spaces" ALTER COLUMN "cad_keywords" SET DEFAULT '[]'::text;

ALTER TABLE "firehouse"."field_preplan_spaces" ALTER COLUMN "coordinate_space" SET DEFAULT 'floor_plan'::text;

ALTER TABLE "firehouse"."field_preplan_spaces" ALTER COLUMN "special_population_notes" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_spaces" ALTER COLUMN "access_notes" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_spaces" ALTER COLUMN "fire_protection_notes" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_spaces" ALTER COLUMN "hazards" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplan_spaces" ALTER COLUMN "archived" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplan_spaces" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplan_spaces" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "address" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "footprint" SET DEFAULT '[]'::text;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "footprint_square_feet" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "floor_count" SET DEFAULT 1;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "fire_flow_calculation_area" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "construction_type" SET DEFAULT 'VB'::text;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "occupancy_flow_category" SET DEFAULT 'other'::text;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "sprinkler_standard" SET DEFAULT 'none'::text;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "suggested_fire_flow_gpm" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "suggested_fire_flow_duration" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "contact_info" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "construction" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "access_info" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "alarm_system" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "knox_box" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "riser" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "fdc" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "sprinkler_system" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "status" SET DEFAULT 'Quick Preplan'::text;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "publication_status" SET DEFAULT 'published'::text;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "completeness_status" SET DEFAULT 'legacy'::text;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "revision_number" SET DEFAULT 1;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "construction_profile" SET DEFAULT '{}'::text;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "occupancy_profile" SET DEFAULT '{}'::text;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "fire_flow_profile" SET DEFAULT '{}'::text;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "target_hazard_level" SET DEFAULT 'low'::text;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "target_hazard_override" SET DEFAULT 0;

ALTER TABLE "firehouse"."field_preplans" ALTER COLUMN "target_hazard_reasons" SET DEFAULT '[]'::text;

ALTER TABLE "firehouse"."fire_inspection_backup_jobs" ALTER COLUMN "lease_until" SET DEFAULT 0;

ALTER TABLE "firehouse"."fire_inspection_backup_jobs" ALTER COLUMN "lease_token" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."fire_inspection_backup_rows" ALTER COLUMN "plan_status" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."fire_inspection_backup_rows" ALTER COLUMN "applied" SET DEFAULT 0;

ALTER TABLE "firehouse"."fire_inspection_code_entries" ALTER COLUMN "version" SET DEFAULT 1;

ALTER TABLE "firehouse"."fire_inspection_code_entries" ALTER COLUMN "archived" SET DEFAULT 0;

ALTER TABLE "firehouse"."fire_inspection_email_deliveries" ALTER COLUMN "status" SET DEFAULT 'Prepared'::text;

ALTER TABLE "firehouse"."fire_inspection_email_deliveries" ALTER COLUMN "error" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."fire_inspection_pilot_files" ALTER COLUMN "check_id" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."fire_inspection_pilot_files" ALTER COLUMN "caption" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."fire_inspection_pilot_records" ALTER COLUMN "version" SET DEFAULT 1;

ALTER TABLE "firehouse"."fire_inspection_pilot_records" ALTER COLUMN "archived" SET DEFAULT 0;

ALTER TABLE "firehouse"."fire_inspection_staff_members" ALTER COLUMN "revision" SET DEFAULT 1;

ALTER TABLE "firehouse"."fire_inspection_staff_workspaces" ALTER COLUMN "rollout_enabled" SET DEFAULT false;

ALTER TABLE "firehouse"."fire_inspection_staff_workspaces" ALTER COLUMN "revision" SET DEFAULT 1;

ALTER TABLE "firehouse"."fleet_apparatus" ALTER COLUMN "asset_type" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."fleet_apparatus" ALTER COLUMN "status" SET DEFAULT 'in_service'::text;

ALTER TABLE "firehouse"."fleet_apparatus" ALTER COLUMN "manufacturer" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."fleet_apparatus" ALTER COLUMN "model" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."fleet_apparatus" ALTER COLUMN "vin" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."fleet_apparatus" ALTER COLUMN "notes" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."fleet_apparatus" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."fleet_apparatus" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."important_phone_numbers" ALTER COLUMN "emergency_number" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."important_phone_numbers" ALTER COLUMN "non_emergency_number" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."important_phone_numbers" ALTER COLUMN "notes" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."important_phone_numbers" ALTER COLUMN "sort_order" SET DEFAULT 0;

ALTER TABLE "firehouse"."important_phone_numbers" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."incident_command_boards" ALTER COLUMN "board_state" SET DEFAULT '{}'::text;

ALTER TABLE "firehouse"."incident_command_boards" ALTER COLUMN "revision" SET DEFAULT 0;

ALTER TABLE "firehouse"."incident_command_boards" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."incident_command_events" ALTER COLUMN "summary" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."incident_command_events" ALTER COLUMN "event_payload" SET DEFAULT '{}'::text;

ALTER TABLE "firehouse"."incident_command_events" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."inventory_audit_events" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."inventory_compartments" ALTER COLUMN "side" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."inventory_compartments" ALTER COLUMN "details" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."inventory_compartments" ALTER COLUMN "sort_order" SET DEFAULT 0;

ALTER TABLE "firehouse"."inventory_compartments" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."inventory_compartments" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."inventory_equipment" ALTER COLUMN "category" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."inventory_equipment" ALTER COLUMN "manufacturer" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."inventory_equipment" ALTER COLUMN "model" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."inventory_equipment" ALTER COLUMN "serial_number" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."inventory_equipment" ALTER COLUMN "asset_number" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."inventory_equipment" ALTER COLUMN "barcode" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."inventory_equipment" ALTER COLUMN "quantity" SET DEFAULT 1;

ALTER TABLE "firehouse"."inventory_equipment" ALTER COLUMN "condition" SET DEFAULT 'serviceable'::text;

ALTER TABLE "firehouse"."inventory_equipment" ALTER COLUMN "service_status" SET DEFAULT 'in_service'::text;

ALTER TABLE "firehouse"."inventory_equipment" ALTER COLUMN "expiration_date" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."inventory_equipment" ALTER COLUMN "inspection_date" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."inventory_equipment" ALTER COLUMN "notes" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."inventory_equipment" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."inventory_equipment" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."inventory_hotspots" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."inventory_hotspots" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."inventory_photos" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."inventory_readiness" ALTER COLUMN "notes" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."inventory_readiness" ALTER COLUMN "checked_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."inventory_weekly_check_items" ALTER COLUMN "sort_order" SET DEFAULT 0;

ALTER TABLE "firehouse"."inventory_weekly_check_results" ALTER COLUMN "notes" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."inventory_weekly_check_templates" ALTER COLUMN "source" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."inventory_weekly_check_templates" ALTER COLUMN "active" SET DEFAULT 1;

ALTER TABLE "firehouse"."inventory_weekly_check_templates" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."inventory_weekly_checks" ALTER COLUMN "status" SET DEFAULT 'in_progress'::text;

ALTER TABLE "firehouse"."inventory_weekly_checks" ALTER COLUMN "started_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."inventory_weekly_checks" ALTER COLUMN "notes" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."neris_pilot_records" ALTER COLUMN "version" SET DEFAULT 1;

ALTER TABLE "firehouse"."neris_pilot_records" ALTER COLUMN "archived" SET DEFAULT 0;

ALTER TABLE "firehouse"."operational_revisions" ALTER COLUMN "revision" SET DEFAULT 0;

ALTER TABLE "firehouse"."operational_revisions" ALTER COLUMN "queued" SET DEFAULT true;

ALTER TABLE "firehouse"."operational_revisions" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE "firehouse"."pay_periods" ALTER COLUMN "status" SET DEFAULT 'draft'::text;

ALTER TABLE "firehouse"."pay_periods" ALTER COLUMN "created_by" SET DEFAULT 'System'::text;

ALTER TABLE "firehouse"."pay_periods" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."pay_periods" ALTER COLUMN "updated_by" SET DEFAULT 'System'::text;

ALTER TABLE "firehouse"."pay_periods" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."pay_rate_history" ALTER COLUMN "created_by" SET DEFAULT 'System'::text;

ALTER TABLE "firehouse"."pay_rate_history" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."pay_scales" ALTER COLUMN "sort_order" SET DEFAULT 0;

ALTER TABLE "firehouse"."payroll_settings" ALTER COLUMN "overtime_threshold" SET DEFAULT 106;

ALTER TABLE "firehouse"."payroll_settings" ALTER COLUMN "acting_officer_premium" SET DEFAULT 1;

ALTER TABLE "firehouse"."payroll_settings" ALTER COLUMN "dpw_multiplier" SET DEFAULT 1.5;

ALTER TABLE "firehouse"."payroll_settings" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."payroll_source_version" ALTER COLUMN "version" SET DEFAULT 0;

ALTER TABLE "firehouse"."policies" ALTER COLUMN "policy_number" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."policies" ALTER COLUMN "category" SET DEFAULT 'General'::text;

ALTER TABLE "firehouse"."policies" ALTER COLUMN "effective_date" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."policies" ALTER COLUMN "body" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."policies" ALTER COLUMN "status" SET DEFAULT 'Active'::text;

ALTER TABLE "firehouse"."policies" ALTER COLUMN "created_by" SET DEFAULT 'System'::text;

ALTER TABLE "firehouse"."policies" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."policies" ALTER COLUMN "updated_by" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."policies" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."portal_activation_attempts" ALTER COLUMN "failed_attempts" SET DEFAULT 0;

ALTER TABLE "firehouse"."portal_activation_attempts" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE "firehouse"."portal_confirmation_messages" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "firehouse"."portal_confirmation_messages" ALTER COLUMN "enabled" SET DEFAULT false;

ALTER TABLE "firehouse"."portal_confirmation_messages" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "firehouse"."portal_confirmation_receipts" ALTER COLUMN "confirmed_at" SET DEFAULT now();

ALTER TABLE "firehouse"."portal_login_audit" ALTER COLUMN "occurred_at" SET DEFAULT now();

ALTER TABLE "firehouse"."portal_login_audit_status" ALTER COLUMN "singleton" SET DEFAULT true;

ALTER TABLE "firehouse"."portal_login_audit_status" ALTER COLUMN "enabled_at" SET DEFAULT now();

ALTER TABLE "firehouse"."push_subscriptions" ALTER COLUMN "user_agent" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."push_subscriptions" ALTER COLUMN "active" SET DEFAULT 1;

ALTER TABLE "firehouse"."push_subscriptions" ALTER COLUMN "failure_count" SET DEFAULT 0;

ALTER TABLE "firehouse"."push_subscriptions" ALTER COLUMN "last_error" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."push_subscriptions" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."push_subscriptions" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."rank_permissions" ALTER COLUMN "allowed" SET DEFAULT 0;

ALTER TABLE "firehouse"."rank_permissions" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."record_revisions" ALTER COLUMN "summary" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."record_revisions" ALTER COLUMN "changed_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."road_closures" ALTER COLUMN "reason" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."road_closures" ALTER COLUMN "path_json" SET DEFAULT '[]'::text;

ALTER TABLE "firehouse"."road_closures" ALTER COLUMN "status" SET DEFAULT 'active'::text;

ALTER TABLE "firehouse"."road_closures" ALTER COLUMN "started_at" SET DEFAULT now();

ALTER TABLE "firehouse"."road_closures" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "firehouse"."road_closures" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE "firehouse"."road_closures" ALTER COLUMN "clear_note" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."safety_inspection_attachments" ALTER COLUMN "content_type" SET DEFAULT 'application/octet-stream'::text;

ALTER TABLE "firehouse"."safety_inspection_attachments" ALTER COLUMN "size_bytes" SET DEFAULT 0;

ALTER TABLE "firehouse"."safety_inspection_attachments" ALTER COLUMN "created_at" SET DEFAULT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text);

ALTER TABLE "firehouse"."safety_inspection_results" ALTER COLUMN "snapshot_equipment_type" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."safety_inspection_results" ALTER COLUMN "snapshot_required" SET DEFAULT 1;

ALTER TABLE "firehouse"."safety_inspection_results" ALTER COLUMN "snapshot_sort_order" SET DEFAULT 0;

ALTER TABLE "firehouse"."safety_inspection_results" ALTER COLUMN "result_status" SET DEFAULT 'not_checked'::text;

ALTER TABLE "firehouse"."safety_inspection_results" ALTER COLUMN "deficiency_note" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."safety_inspection_results" ALTER COLUMN "corrected_on_site" SET DEFAULT 0;

ALTER TABLE "firehouse"."safety_inspection_results" ALTER COLUMN "updated_at" SET DEFAULT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text);

ALTER TABLE "firehouse"."safety_inspection_template_items" ALTER COLUMN "equipment_type" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."safety_inspection_template_items" ALTER COLUMN "required" SET DEFAULT 1;

ALTER TABLE "firehouse"."safety_inspection_template_items" ALTER COLUMN "active" SET DEFAULT 1;

ALTER TABLE "firehouse"."safety_inspection_template_items" ALTER COLUMN "sort_order" SET DEFAULT 0;

ALTER TABLE "firehouse"."safety_inspection_template_items" ALTER COLUMN "updated_by" SET DEFAULT 'System'::text;

ALTER TABLE "firehouse"."safety_inspection_template_items" ALTER COLUMN "updated_at" SET DEFAULT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text);

ALTER TABLE "firehouse"."safety_inspection_templates" ALTER COLUMN "description" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."safety_inspection_templates" ALTER COLUMN "cadence" SET DEFAULT 'monthly'::text;

ALTER TABLE "firehouse"."safety_inspection_templates" ALTER COLUMN "category" SET DEFAULT 'Field safety'::text;

ALTER TABLE "firehouse"."safety_inspection_templates" ALTER COLUMN "active" SET DEFAULT 1;

ALTER TABLE "firehouse"."safety_inspection_templates" ALTER COLUMN "created_by" SET DEFAULT 'System'::text;

ALTER TABLE "firehouse"."safety_inspection_templates" ALTER COLUMN "created_at" SET DEFAULT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text);

ALTER TABLE "firehouse"."safety_inspection_templates" ALTER COLUMN "updated_by" SET DEFAULT 'System'::text;

ALTER TABLE "firehouse"."safety_inspection_templates" ALTER COLUMN "updated_at" SET DEFAULT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text);

ALTER TABLE "firehouse"."safety_inspection_templates" ALTER COLUMN "location_options" SET DEFAULT '[]'::text;

ALTER TABLE "firehouse"."safety_inspections" ALTER COLUMN "status" SET DEFAULT 'draft'::text;

ALTER TABLE "firehouse"."safety_inspections" ALTER COLUMN "overall_notes" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."safety_inspections" ALTER COLUMN "created_at" SET DEFAULT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text);

ALTER TABLE "firehouse"."safety_inspections" ALTER COLUMN "updated_at" SET DEFAULT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text);

ALTER TABLE "firehouse"."safety_inspections" ALTER COLUMN "inspection_location" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."schedule_assignments" ALTER COLUMN "source" SET DEFAULT 'manual'::text;

ALTER TABLE "firehouse"."schedule_assignments" ALTER COLUMN "status" SET DEFAULT 'assigned'::text;

ALTER TABLE "firehouse"."schedule_assignments" ALTER COLUMN "emergency" SET DEFAULT 0;

ALTER TABLE "firehouse"."schedule_assignments" ALTER COLUMN "required_rank" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."schedule_assignments" ALTER COLUMN "claim_deadline" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."schedule_assignments" ALTER COLUMN "notes" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."schedule_assignments" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."schedule_coverage_rules" ALTER COLUMN "plan_id" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."schedule_coverage_rules" ALTER COLUMN "days_of_week" SET DEFAULT '0,1,2,3,4,5,6'::text;

ALTER TABLE "firehouse"."schedule_coverage_rules" ALTER COLUMN "active" SET DEFAULT 1;

ALTER TABLE "firehouse"."schedule_coverage_rules" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."schedule_notification_rules" ALTER COLUMN "active" SET DEFAULT 1;

ALTER TABLE "firehouse"."schedule_notification_rules" ALTER COLUMN "email_enabled" SET DEFAULT 1;

ALTER TABLE "firehouse"."schedule_notification_rules" ALTER COLUMN "sms_enabled" SET DEFAULT 0;

ALTER TABLE "firehouse"."schedule_notification_rules" ALTER COLUMN "delivery_timings" SET DEFAULT '["immediate"]'::text;

ALTER TABLE "firehouse"."schedule_notification_rules" ALTER COLUMN "updated_by" SET DEFAULT 'System'::text;

ALTER TABLE "firehouse"."schedule_notification_rules" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."schedule_notifications" ALTER COLUMN "in_app" SET DEFAULT 1;

ALTER TABLE "firehouse"."schedule_notifications" ALTER COLUMN "event_type" SET DEFAULT 'general'::text;

ALTER TABLE "firehouse"."schedule_notifications" ALTER COLUMN "email" SET DEFAULT 0;

ALTER TABLE "firehouse"."schedule_notifications" ALTER COLUMN "sms" SET DEFAULT 0;

ALTER TABLE "firehouse"."schedule_notifications" ALTER COLUMN "delivery_status" SET DEFAULT 'queued'::text;

ALTER TABLE "firehouse"."schedule_notifications" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."schedule_notifications" ALTER COLUMN "scheduled_for" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."schedule_requests" ALTER COLUMN "start_time" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."schedule_requests" ALTER COLUMN "end_time" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."schedule_requests" ALTER COLUMN "role" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."schedule_requests" ALTER COLUMN "repeat_mode" SET DEFAULT 'none'::text;

ALTER TABLE "firehouse"."schedule_requests" ALTER COLUMN "repeat_interval" SET DEFAULT 0;

ALTER TABLE "firehouse"."schedule_requests" ALTER COLUMN "status" SET DEFAULT 'pending'::text;

ALTER TABLE "firehouse"."schedule_requests" ALTER COLUMN "target_status" SET DEFAULT 'not_required'::text;

ALTER TABLE "firehouse"."schedule_requests" ALTER COLUMN "notes" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."schedule_requests" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."schedule_rotations" ALTER COLUMN "coverage_plan_id" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."schedule_rotations" ALTER COLUMN "active" SET DEFAULT 1;

ALTER TABLE "firehouse"."schedule_rotations" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."schedule_shift_patterns" ALTER COLUMN "color" SET DEFAULT 'red'::text;

ALTER TABLE "firehouse"."schedule_shift_patterns" ALTER COLUMN "active" SET DEFAULT 1;

ALTER TABLE "firehouse"."schedule_shift_patterns" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."schedule_staffing_overrides" ALTER COLUMN "active" SET DEFAULT 1;

ALTER TABLE "firehouse"."schedule_staffing_overrides" ALTER COLUMN "created_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."scheduler_push_deliveries" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "firehouse"."scheduler_push_deliveries" ALTER COLUMN "state" SET DEFAULT 'pending'::text;

ALTER TABLE "firehouse"."scheduler_push_deliveries" ALTER COLUMN "attempts" SET DEFAULT 0;

ALTER TABLE "firehouse"."scheduler_push_deliveries" ALTER COLUMN "next_attempt_at" SET DEFAULT now();

ALTER TABLE "firehouse"."scheduler_push_events" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "firehouse"."scheduler_push_events" ALTER COLUMN "department_id" SET DEFAULT '14a76771-4c24-481b-8def-e6cce005c17b'::uuid;

ALTER TABLE "firehouse"."scheduler_push_events" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "firehouse"."station_availability" ALTER COLUMN "status" SET DEFAULT 'available'::text;

ALTER TABLE "firehouse"."station_availability" ALTER COLUMN "all_day" SET DEFAULT 1;

ALTER TABLE "firehouse"."station_availability" ALTER COLUMN "start_time" SET DEFAULT '06:00'::text;

ALTER TABLE "firehouse"."station_availability" ALTER COLUMN "end_time" SET DEFAULT '18:00'::text;

ALTER TABLE "firehouse"."station_availability" ALTER COLUMN "note" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."station_availability" ALTER COLUMN "created_at" SET DEFAULT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text);

ALTER TABLE "firehouse"."station_availability" ALTER COLUMN "updated_at" SET DEFAULT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text);

ALTER TABLE "firehouse"."station_distribution_weights" ALTER COLUMN "seniority_weight" SET DEFAULT 1;

ALTER TABLE "firehouse"."station_distribution_weights" ALTER COLUMN "hours_weight" SET DEFAULT 1;

ALTER TABLE "firehouse"."station_distribution_weights" ALTER COLUMN "custom_weight" SET DEFAULT 0;

ALTER TABLE "firehouse"."station_distribution_weights" ALTER COLUMN "custom_label" SET DEFAULT 'Cross-trained'::text;

ALTER TABLE "firehouse"."station_distribution_weights" ALTER COLUMN "updated_at" SET DEFAULT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text);

ALTER TABLE "firehouse"."station_ot_interest" ALTER COLUMN "responded_at" SET DEFAULT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text);

ALTER TABLE "firehouse"."station_ot_offers" ALTER COLUMN "status" SET DEFAULT 'offered'::text;

ALTER TABLE "firehouse"."station_ot_offers" ALTER COLUMN "rank" SET DEFAULT 0;

ALTER TABLE "firehouse"."station_ot_offers" ALTER COLUMN "offered_at" SET DEFAULT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text);

ALTER TABLE "firehouse"."station_ot_settings" ALTER COLUMN "exempt_off_duty" SET DEFAULT 1;

ALTER TABLE "firehouse"."station_ot_settings" ALTER COLUMN "exempt_already_scheduled" SET DEFAULT 1;

ALTER TABLE "firehouse"."station_ot_settings" ALTER COLUMN "exempt_declined" SET DEFAULT 1;

ALTER TABLE "firehouse"."station_ot_settings" ALTER COLUMN "exempt_recently_mandated" SET DEFAULT 1;

ALTER TABLE "firehouse"."station_ot_settings" ALTER COLUMN "recent_days" SET DEFAULT 14;

ALTER TABLE "firehouse"."station_ot_settings" ALTER COLUMN "exempt_max_consecutive" SET DEFAULT 1;

ALTER TABLE "firehouse"."station_ot_settings" ALTER COLUMN "max_consecutive" SET DEFAULT 2;

ALTER TABLE "firehouse"."station_ot_settings" ALTER COLUMN "priority_order" SET DEFAULT '[]'::text;

ALTER TABLE "firehouse"."station_ot_settings" ALTER COLUMN "custom_rules" SET DEFAULT '[]'::text;

ALTER TABLE "firehouse"."station_ot_settings" ALTER COLUMN "updated_at" SET DEFAULT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text);

ALTER TABLE "firehouse"."station_ot_timing" ALTER COLUMN "award_days_out" SET DEFAULT 7;

ALTER TABLE "firehouse"."station_ot_timing" ALTER COLUMN "complete_by_days_out" SET DEFAULT 2;

ALTER TABLE "firehouse"."station_ot_timing" ALTER COLUMN "updated_at" SET DEFAULT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text);

ALTER TABLE "firehouse"."station_reminder_rules" ALTER COLUMN "label" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."station_reminder_rules" ALTER COLUMN "offsets" SET DEFAULT '[]'::text;

ALTER TABLE "firehouse"."station_reminder_rules" ALTER COLUMN "email_enabled" SET DEFAULT 1;

ALTER TABLE "firehouse"."station_reminder_rules" ALTER COLUMN "text_enabled" SET DEFAULT 0;

ALTER TABLE "firehouse"."station_reminder_rules" ALTER COLUMN "target" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."station_reminder_rules" ALTER COLUMN "enabled" SET DEFAULT 1;

ALTER TABLE "firehouse"."station_reminder_rules" ALTER COLUMN "updated_at" SET DEFAULT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text);

ALTER TABLE "firehouse"."station_reminder_rules" ALTER COLUMN "push_enabled" SET DEFAULT 0;

ALTER TABLE "firehouse"."station_schedule_entries" ALTER COLUMN "created_by" SET DEFAULT 'System'::text;

ALTER TABLE "firehouse"."station_schedule_entries" ALTER COLUMN "created_at" SET DEFAULT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text);

ALTER TABLE "firehouse"."station_shift_claims" ALTER COLUMN "note" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."station_shift_claims" ALTER COLUMN "status" SET DEFAULT 'pending'::text;

ALTER TABLE "firehouse"."station_shift_claims" ALTER COLUMN "created_at" SET DEFAULT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text);

ALTER TABLE "firehouse"."station_shift_claims" ALTER COLUMN "reminder_changed_at" SET DEFAULT now();

ALTER TABLE "firehouse"."station_shift_slots" ALTER COLUMN "status" SET DEFAULT 'open'::text;

ALTER TABLE "firehouse"."station_shift_slots" ALTER COLUMN "sort_order" SET DEFAULT 0;

ALTER TABLE "firehouse"."station_shift_slots" ALTER COLUMN "start_time" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."station_shift_slots" ALTER COLUMN "end_time" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."station_shift_slots" ALTER COLUMN "is_extra" SET DEFAULT 0;

ALTER TABLE "firehouse"."station_shift_slots" ALTER COLUMN "staffing_reason" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."station_shift_slots" ALTER COLUMN "request_deadline" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."station_shift_slots" ALTER COLUMN "reminder_changed_at" SET DEFAULT now();

ALTER TABLE "firehouse"."station_shift_type_roles" ALTER COLUMN "count" SET DEFAULT 1;

ALTER TABLE "firehouse"."station_shift_types" ALTER COLUMN "color" SET DEFAULT 'red'::text;

ALTER TABLE "firehouse"."station_shift_types" ALTER COLUMN "active" SET DEFAULT 1;

ALTER TABLE "firehouse"."station_shift_types" ALTER COLUMN "sort_order" SET DEFAULT 0;

ALTER TABLE "firehouse"."station_shift_types" ALTER COLUMN "created_by" SET DEFAULT 'System'::text;

ALTER TABLE "firehouse"."station_shift_types" ALTER COLUMN "created_at" SET DEFAULT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text);

ALTER TABLE "firehouse"."station_shift_types" ALTER COLUMN "anchor_date" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."station_shift_types" ALTER COLUMN "repeat_every_days" SET DEFAULT 0;

ALTER TABLE "firehouse"."station_standing_assignments" ALTER COLUMN "active" SET DEFAULT 1;

ALTER TABLE "firehouse"."station_standing_assignments" ALTER COLUMN "created_by" SET DEFAULT 'System'::text;

ALTER TABLE "firehouse"."station_standing_assignments" ALTER COLUMN "created_at" SET DEFAULT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text);

ALTER TABLE "firehouse"."station_time_off_requests" ALTER COLUMN "note" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."station_time_off_requests" ALTER COLUMN "status" SET DEFAULT 'pending'::text;

ALTER TABLE "firehouse"."station_time_off_requests" ALTER COLUMN "created_at" SET DEFAULT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text);

ALTER TABLE "firehouse"."station_trade_requests" ALTER COLUMN "note" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."station_trade_requests" ALTER COLUMN "status" SET DEFAULT 'pending'::text;

ALTER TABLE "firehouse"."station_trade_requests" ALTER COLUMN "created_at" SET DEFAULT to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text), 'YYYY-MM-DD HH24:MI:SS'::text);

ALTER TABLE "firehouse"."station_unavailability" ALTER COLUMN "source" SET DEFAULT 'time_off'::text;

ALTER TABLE "firehouse"."system_meta" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."time_entries" ALTER COLUMN "hours" SET DEFAULT 0;

ALTER TABLE "firehouse"."time_entries" ALTER COLUMN "updated_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."training_pilot_records" ALTER COLUMN "version" SET DEFAULT 1;

ALTER TABLE "firehouse"."training_pilot_records" ALTER COLUMN "archived" SET DEFAULT 0;

ALTER TABLE "firehouse"."training_report_views" ALTER COLUMN "archived" SET DEFAULT 0;

ALTER TABLE "firehouse"."work_detail_postings" ALTER COLUMN "posted_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."work_detail_requests" ALTER COLUMN "certified" SET DEFAULT 0;

ALTER TABLE "firehouse"."work_detail_requests" ALTER COLUMN "status" SET DEFAULT 'pending'::text;

ALTER TABLE "firehouse"."work_detail_requests" ALTER COLUMN "submitted_at" SET DEFAULT (CURRENT_TIMESTAMP)::text;

ALTER TABLE "firehouse"."work_detail_requests" ALTER COLUMN "rejection_note" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."work_detail_requests" ALTER COLUMN "time_in_instant" SET DEFAULT ''::text;

ALTER TABLE "firehouse"."work_detail_requests" ALTER COLUMN "time_out_instant" SET DEFAULT ''::text;

ALTER TABLE "private"."department_portals" ALTER COLUMN "published" SET DEFAULT false;

ALTER TABLE "private"."department_portals" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "private"."portal_remembered_devices" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."department_apparatus" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."department_apparatus" ALTER COLUMN "unit_type" SET DEFAULT ''::text;

ALTER TABLE "public"."department_apparatus" ALTER COLUMN "call_sign" SET DEFAULT ''::text;

ALTER TABLE "public"."department_apparatus" ALTER COLUMN "station" SET DEFAULT ''::text;

ALTER TABLE "public"."department_apparatus" ALTER COLUMN "cad_unit_id" SET DEFAULT ''::text;

ALTER TABLE "public"."department_apparatus" ALTER COLUMN "status" SET DEFAULT 'in_service'::text;

ALTER TABLE "public"."department_apparatus" ALTER COLUMN "notes" SET DEFAULT ''::text;

ALTER TABLE "public"."department_apparatus" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."department_apparatus" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE "public"."department_invites" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."department_invites" ALTER COLUMN "role" SET DEFAULT 'user'::department_role;

ALTER TABLE "public"."department_invites" ALTER COLUMN "status" SET DEFAULT 'pending'::invite_status;

ALTER TABLE "public"."department_invites" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."department_invites" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE "public"."department_memberships" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."department_memberships" ALTER COLUMN "role" SET DEFAULT 'user'::department_role;

ALTER TABLE "public"."department_memberships" ALTER COLUMN "status" SET DEFAULT 'active'::membership_status;

ALTER TABLE "public"."department_memberships" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."departments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."departments" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."departments" ALTER COLUMN "account_status" SET DEFAULT 'trial'::text;

ALTER TABLE "public"."departments" ALTER COLUMN "plan_name" SET DEFAULT 'Single Station'::text;

ALTER TABLE "public"."departments" ALTER COLUMN "trial_status" SET DEFAULT 'active'::text;

ALTER TABLE "public"."departments" ALTER COLUMN "trial_start_date" SET DEFAULT CURRENT_DATE;

ALTER TABLE "public"."departments" ALTER COLUMN "trial_end_date" SET DEFAULT ((CURRENT_DATE + '90 days'::interval))::date;

ALTER TABLE "public"."departments" ALTER COLUMN "subscription_status" SET DEFAULT 'trial'::text;

ALTER TABLE "public"."departments" ALTER COLUMN "monthly_price" SET DEFAULT 325;

ALTER TABLE "public"."departments" ALTER COLUMN "station_count" SET DEFAULT 1;

ALTER TABLE "public"."departments" ALTER COLUMN "storage_used_mb" SET DEFAULT 0;

ALTER TABLE "public"."departments" ALTER COLUMN "ai_usage_estimate" SET DEFAULT 0;

ALTER TABLE "public"."departments" ALTER COLUMN "maps_usage_estimate" SET DEFAULT 0;

ALTER TABLE "public"."disciplinary_import_staging" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."disciplinary_import_staging" ALTER COLUMN "file_id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."disciplinary_import_staging" ALTER COLUMN "created_by" SET DEFAULT auth.uid();

ALTER TABLE "public"."disciplinary_import_staging" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."disciplinary_report_files" ALTER COLUMN "uploaded_by" SET DEFAULT auth.uid();

ALTER TABLE "public"."disciplinary_report_files" ALTER COLUMN "uploaded_at" SET DEFAULT now();

ALTER TABLE "public"."disciplinary_reports" ALTER COLUMN "change_reason" SET DEFAULT ''::text;

ALTER TABLE "public"."inventory_apparatus_profiles" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_apparatus_profiles" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_apparatus_profiles" ALTER COLUMN "vin_decoded_json" SET DEFAULT '{}'::jsonb;

ALTER TABLE "public"."inventory_apparatus_profiles" ALTER COLUMN "vin_source" SET DEFAULT ''::text;

ALTER TABLE "public"."inventory_apparatus_profiles" ALTER COLUMN "oil_specification" SET DEFAULT ''::text;

ALTER TABLE "public"."inventory_apparatus_profiles" ALTER COLUMN "oil_capacity" SET DEFAULT ''::text;

ALTER TABLE "public"."inventory_apparatus_profiles" ALTER COLUMN "transmission_fluid_specification" SET DEFAULT ''::text;

ALTER TABLE "public"."inventory_apparatus_profiles" ALTER COLUMN "coolant_specification" SET DEFAULT ''::text;

ALTER TABLE "public"."inventory_apparatus_profiles" ALTER COLUMN "front_tire_size" SET DEFAULT ''::text;

ALTER TABLE "public"."inventory_apparatus_profiles" ALTER COLUMN "rear_tire_size" SET DEFAULT ''::text;

ALTER TABLE "public"."inventory_apparatus_profiles" ALTER COLUMN "tire_pressure_notes" SET DEFAULT ''::text;

ALTER TABLE "public"."inventory_apparatus_profiles" ALTER COLUMN "fuel_capacity" SET DEFAULT ''::text;

ALTER TABLE "public"."inventory_apparatus_profiles" ALTER COLUMN "battery_specification" SET DEFAULT ''::text;

ALTER TABLE "public"."inventory_apparatus_profiles" ALTER COLUMN "filter_part_numbers" SET DEFAULT ''::text;

ALTER TABLE "public"."inventory_apparatus_profiles" ALTER COLUMN "maintenance_schedule" SET DEFAULT ''::text;

ALTER TABLE "public"."inventory_apparatus_profiles" ALTER COLUMN "owner_manual_url" SET DEFAULT ''::text;

ALTER TABLE "public"."inventory_apparatus_profiles" ALTER COLUMN "service_manual_url" SET DEFAULT ''::text;

ALTER TABLE "public"."inventory_apparatus_profiles" ALTER COLUMN "parts_catalog_url" SET DEFAULT ''::text;

ALTER TABLE "public"."inventory_apparatus_profiles" ALTER COLUMN "preferred_vendor" SET DEFAULT ''::text;

ALTER TABLE "public"."inventory_apparatus_profiles" ALTER COLUMN "ordering_notes" SET DEFAULT ''::text;

ALTER TABLE "public"."inventory_audit_events" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."inventory_audit_events" ALTER COLUMN "next_json" SET DEFAULT '{}'::jsonb;

ALTER TABLE "public"."inventory_audit_events" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_check_archives" ALTER COLUMN "archived_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_check_items" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."inventory_check_items" ALTER COLUMN "result" SET DEFAULT 'pending'::text;

ALTER TABLE "public"."inventory_check_items" ALTER COLUMN "meter_response_version" SET DEFAULT 0;

ALTER TABLE "public"."inventory_check_items" ALTER COLUMN "drug_response_version" SET DEFAULT 0;

ALTER TABLE "public"."inventory_checks" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."inventory_checks" ALTER COLUMN "status" SET DEFAULT 'in_progress'::text;

ALTER TABLE "public"."inventory_checks" ALTER COLUMN "started_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_checks" ALTER COLUMN "check_type" SET DEFAULT 'inventory'::text;

ALTER TABLE "public"."inventory_checks" ALTER COLUMN "review_status" SET DEFAULT 'pending'::text;

ALTER TABLE "public"."inventory_compartments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."inventory_compartments" ALTER COLUMN "sort_order" SET DEFAULT 0;

ALTER TABLE "public"."inventory_compartments" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_deficiency_photos" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."inventory_deficiency_photos" ALTER COLUMN "captured_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_equipment" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."inventory_equipment" ALTER COLUMN "quantity_required" SET DEFAULT 1;

ALTER TABLE "public"."inventory_equipment" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_equipment" ALTER COLUMN "equipment_category" SET DEFAULT 'equipment'::text;

ALTER TABLE "public"."inventory_equipment" ALTER COLUMN "check_types" SET DEFAULT ARRAY['daily'::text, 'weekly'::text, 'inventory'::text];

ALTER TABLE "public"."inventory_equipment" ALTER COLUMN "item_order" SET DEFAULT 0;

ALTER TABLE "public"."inventory_equipment" ALTER COLUMN "item_type" SET DEFAULT 'individual'::text;

ALTER TABLE "public"."inventory_equipment" ALTER COLUMN "response_type" SET DEFAULT 'pass_fail'::text;

ALTER TABLE "public"."inventory_equipment" ALTER COLUMN "service_status" SET DEFAULT 'in_service'::text;

ALTER TABLE "public"."inventory_equipment" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_equipment" ALTER COLUMN "meter_template_version" SET DEFAULT 0;

ALTER TABLE "public"."inventory_equipment" ALTER COLUMN "weekly_recurrence" SET DEFAULT 'every_week'::text;

ALTER TABLE "public"."inventory_inspection_schedules" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."inventory_inspection_schedules" ALTER COLUMN "start_time" SET DEFAULT '06:00:00'::time without time zone;

ALTER TABLE "public"."inventory_inspection_schedules" ALTER COLUMN "end_time" SET DEFAULT '12:00:00'::time without time zone;

ALTER TABLE "public"."inventory_inspection_schedules" ALTER COLUMN "active" SET DEFAULT true;

ALTER TABLE "public"."inventory_inspection_schedules" ALTER COLUMN "feeds_daily_duties" SET DEFAULT true;

ALTER TABLE "public"."inventory_inspection_schedules" ALTER COLUMN "feeds_operations_board" SET DEFAULT true;

ALTER TABLE "public"."inventory_inspection_schedules" ALTER COLUMN "require_officer_signoff" SET DEFAULT true;

ALTER TABLE "public"."inventory_inspection_schedules" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_inspection_schedules" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_location_change_requests" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."inventory_location_change_requests" ALTER COLUMN "status" SET DEFAULT 'pending'::text;

ALTER TABLE "public"."inventory_location_change_requests" ALTER COLUMN "requested_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_operation_receipts" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_photo_hotspots" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."inventory_photo_hotspots" ALTER COLUMN "display_order" SET DEFAULT 0;

ALTER TABLE "public"."inventory_photo_hotspots" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_photo_views" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."inventory_photo_views" ALTER COLUMN "view_level" SET DEFAULT 'exterior'::text;

ALTER TABLE "public"."inventory_photo_views" ALTER COLUMN "door_state" SET DEFAULT 'not_applicable'::text;

ALTER TABLE "public"."inventory_photo_views" ALTER COLUMN "version_number" SET DEFAULT 1;

ALTER TABLE "public"."inventory_photo_views" ALTER COLUMN "approval_status" SET DEFAULT 'pending'::text;

ALTER TABLE "public"."inventory_photo_views" ALTER COLUMN "captured_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_readiness_exceptions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."inventory_readiness_exceptions" ALTER COLUMN "priority" SET DEFAULT 'medium'::text;

ALTER TABLE "public"."inventory_readiness_exceptions" ALTER COLUMN "status" SET DEFAULT 'open'::text;

ALTER TABLE "public"."inventory_readiness_exceptions" ALTER COLUMN "out_of_service" SET DEFAULT false;

ALTER TABLE "public"."inventory_readiness_exceptions" ALTER COLUMN "opened_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_readiness_exceptions" ALTER COLUMN "issue_categories" SET DEFAULT ARRAY['equipment'::text];

ALTER TABLE "public"."inventory_readiness_exceptions" ALTER COLUMN "assigned_employee_ids" SET DEFAULT '{}'::text[];

ALTER TABLE "public"."inventory_readiness_exceptions" ALTER COLUMN "assigned_employee_names" SET DEFAULT '{}'::text[];

ALTER TABLE "public"."inventory_scba_check_entries" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."inventory_scba_check_entries" ALTER COLUMN "sort_order" SET DEFAULT 0;

ALTER TABLE "public"."inventory_scba_check_entries" ALTER COLUMN "result" SET DEFAULT 'pending'::text;

ALTER TABLE "public"."inventory_scba_check_entries" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_scba_templates" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."inventory_scba_templates" ALTER COLUMN "pack_positions" SET DEFAULT ARRAY[]::text[];

ALTER TABLE "public"."inventory_scba_templates" ALTER COLUMN "include_rit" SET DEFAULT true;

ALTER TABLE "public"."inventory_scba_templates" ALTER COLUMN "spare_bottle_count" SET DEFAULT 0;

ALTER TABLE "public"."inventory_scba_templates" ALTER COLUMN "active" SET DEFAULT true;

ALTER TABLE "public"."inventory_scba_templates" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_scba_templates" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_stock_items" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."inventory_stock_items" ALTER COLUMN "par_level" SET DEFAULT 0;

ALTER TABLE "public"."inventory_stock_items" ALTER COLUMN "reorder_point" SET DEFAULT 0;

ALTER TABLE "public"."inventory_stock_items" ALTER COLUMN "expiration_tracked" SET DEFAULT false;

ALTER TABLE "public"."inventory_stock_items" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_stock_lots" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."inventory_stock_lots" ALTER COLUMN "location_type" SET DEFAULT 'station'::text;

ALTER TABLE "public"."inventory_stock_lots" ALTER COLUMN "quantity_on_hand" SET DEFAULT 0;

ALTER TABLE "public"."inventory_stock_lots" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_transactions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."inventory_transactions" ALTER COLUMN "performed_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_work_order_documents" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."inventory_work_order_documents" ALTER COLUMN "document_type" SET DEFAULT 'other'::text;

ALTER TABLE "public"."inventory_work_order_documents" ALTER COLUMN "uploaded_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_work_orders" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."inventory_work_orders" ALTER COLUMN "status" SET DEFAULT 'open'::text;

ALTER TABLE "public"."inventory_work_orders" ALTER COLUMN "priority" SET DEFAULT 'routine'::text;

ALTER TABLE "public"."inventory_work_orders" ALTER COLUMN "opened_at" SET DEFAULT now();

ALTER TABLE "public"."inventory_work_orders" ALTER COLUMN "assigned_employee_ids" SET DEFAULT '{}'::text[];

ALTER TABLE "public"."inventory_work_orders" ALTER COLUMN "assigned_employee_names" SET DEFAULT '{}'::text[];

ALTER TABLE "public"."inventory_work_orders" ALTER COLUMN "service_type" SET DEFAULT 'repair'::text;

ALTER TABLE "public"."platform_owners" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."portal_access_emails" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."portal_invite_admins" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."portal_pin_credentials" ALTER COLUMN "failed_attempts" SET DEFAULT 0;

ALTER TABLE "public"."portal_pin_credentials" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."portal_pin_credentials" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE "public"."push_subscriptions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."push_subscriptions" ALTER COLUMN "enabled" SET DEFAULT true;

ALTER TABLE "public"."push_subscriptions" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."push_subscriptions" ALTER COLUMN "last_seen_at" SET DEFAULT now();

ALTER TABLE "public"."user_profiles" ALTER COLUMN "display_name" SET DEFAULT ''::text;

ALTER TABLE "public"."user_profiles" ALTER COLUMN "email" SET DEFAULT ''::text;

ALTER TABLE "public"."user_profiles" ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."user_profiles" ALTER COLUMN "updated_at" SET DEFAULT now();

ALTER TABLE "firehouse"."apparatus_location_view_leases" ADD CONSTRAINT "apparatus_location_view_leases_pkey" PRIMARY KEY (user_id, department_id);

ALTER TABLE "firehouse"."apparatus_trackers" ADD CONSTRAINT "apparatus_trackers_check" CHECK (latitude >= '-90'::integer::double precision AND latitude <= 90::double precision AND longitude >= '-180'::integer::double precision AND longitude <= 180::double precision AND accuracy > 0::double precision AND accuracy <= 75::double precision);

ALTER TABLE "firehouse"."apparatus_trackers" ADD CONSTRAINT "apparatus_trackers_department_id_check" CHECK (department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid);

ALTER TABLE "firehouse"."apparatus_trackers" ADD CONSTRAINT "apparatus_trackers_device_name_check" CHECK (length(device_name) >= 1 AND length(device_name) <= 60);

ALTER TABLE "firehouse"."apparatus_trackers" ADD CONSTRAINT "apparatus_trackers_pkey" PRIMARY KEY (department_id, apparatus_id);

ALTER TABLE "firehouse"."apparatus_trackers" ADD CONSTRAINT "apparatus_trackers_sender_kind_check" CHECK (sender_kind = ANY (ARRAY['browser'::text, 'windows'::text]));

ALTER TABLE "firehouse"."apparatus_trackers" ADD CONSTRAINT "apparatus_trackers_token_hash_check" CHECK (token_hash ~ '^[a-f0-9]{64}$'::text);

ALTER TABLE "firehouse"."apparatus_trackers" ADD CONSTRAINT "apparatus_trackers_token_hash_key" UNIQUE (token_hash);

ALTER TABLE "firehouse"."background_job_runs" ADD CONSTRAINT "background_job_runs_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."background_job_runs" ADD CONSTRAINT "background_job_runs_status_check" CHECK (status = ANY (ARRAY['running'::text, 'succeeded'::text, 'failed'::text]));

ALTER TABLE "firehouse"."board_feed_cache" ADD CONSTRAINT "board_feed_cache_payload_check" CHECK (payload IS NULL OR jsonb_typeof(payload) = 'object'::text);

ALTER TABLE "firehouse"."board_feed_cache" ADD CONSTRAINT "board_feed_cache_pkey" PRIMARY KEY (source);

ALTER TABLE "firehouse"."board_feed_cache" ADD CONSTRAINT "board_feed_cache_source_check" CHECK (source = ANY (ARRAY['close_calls'::text, 'usfa'::text, 'weather'::text, 'training_romeoville'::text, 'training_ifsi'::text, 'training_nipsta'::text]));

ALTER TABLE "firehouse"."board_feed_cache" ADD CONSTRAINT "board_feed_cache_status_check" CHECK (status = ANY (ARRAY['unavailable'::text, 'updating'::text, 'ok'::text, 'error'::text]));

ALTER TABLE "firehouse"."box_cards" ADD CONSTRAINT "box_cards_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."cad_inbound_receipts" ADD CONSTRAINT "cad_inbound_receipts_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."cad_push_deliveries" ADD CONSTRAINT "cad_push_deliveries_event_id_subscription_id_key" UNIQUE (event_id, subscription_id);

ALTER TABLE "firehouse"."cad_push_deliveries" ADD CONSTRAINT "cad_push_deliveries_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."cad_push_deliveries" ADD CONSTRAINT "cad_push_deliveries_state_check" CHECK (state = ANY (ARRAY['pending'::text, 'sending'::text, 'retry'::text, 'accepted'::text, 'cancelled'::text, 'expired'::text, 'failed'::text]));

ALTER TABLE "firehouse"."cad_push_events" ADD CONSTRAINT "cad_push_events_department_id_check" CHECK (department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid);

ALTER TABLE "firehouse"."cad_push_events" ADD CONSTRAINT "cad_push_events_department_id_incident_id_key" UNIQUE (department_id, incident_id);

ALTER TABLE "firehouse"."cad_push_events" ADD CONSTRAINT "cad_push_events_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."callback_payroll_aggregates" ADD CONSTRAINT "callback_payroll_aggregates_pkey" PRIMARY KEY (employee_id, work_date);

ALTER TABLE "firehouse"."callback_review_settings" ADD CONSTRAINT "callback_review_settings_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."chief_board_attachments" ADD CONSTRAINT "chief_board_attachments_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."chief_board_items" ADD CONSTRAINT "chief_board_items_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."daily_duties" ADD CONSTRAINT "daily_duties_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."daily_log_approvals" ADD CONSTRAINT "daily_log_approvals_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."daily_log_callback_submissions" ADD CONSTRAINT "daily_log_callback_submissions_call_id_employee_id_key" UNIQUE (call_id, employee_id);

ALTER TABLE "firehouse"."daily_log_callback_submissions" ADD CONSTRAINT "daily_log_callback_submissions_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."daily_log_callback_submissions" ADD CONSTRAINT "daily_log_callback_submissions_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text]));

ALTER TABLE "firehouse"."daily_log_calls" ADD CONSTRAINT "daily_log_calls_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."daily_log_staffing" ADD CONSTRAINT "daily_log_staffing_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."daily_log_staffing" ADD CONSTRAINT "daily_log_staffing_time_in_instant_check" CHECK (time_in_instant = ''::text OR time_in_instant ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'::text);

ALTER TABLE "firehouse"."daily_log_staffing" ADD CONSTRAINT "daily_log_staffing_time_out_instant_check" CHECK (time_out_instant = ''::text OR time_out_instant ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'::text);

ALTER TABLE "firehouse"."daily_logs" ADD CONSTRAINT "daily_logs_pkey" PRIMARY KEY (log_date);

ALTER TABLE "firehouse"."dispatch_incidents" ADD CONSTRAINT "dispatch_incidents_pkey" PRIMARY KEY (incident_id);

ALTER TABLE "firehouse"."employee_account_links" ADD CONSTRAINT "employee_account_links_pkey" PRIMARY KEY (user_id);

ALTER TABLE "firehouse"."employee_permission_overrides" ADD CONSTRAINT "employee_permission_overrides_pkey" PRIMARY KEY (employee_id, permission_key);

ALTER TABLE "firehouse"."employee_profiles" ADD CONSTRAINT "employee_profiles_pkey" PRIMARY KEY (employee_id);

ALTER TABLE "firehouse"."employee_profiles" ADD CONSTRAINT "employee_profiles_single_role_check" CHECK (single_role = ANY (ARRAY[0, 1]));

ALTER TABLE "firehouse"."employees" ADD CONSTRAINT "employees_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."field_hydrant_flow_tests" ADD CONSTRAINT "field_hydrant_flow_tests_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."field_hydrant_flushes" ADD CONSTRAINT "field_hydrant_flushes_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."field_hydrant_service_events" ADD CONSTRAINT "field_hydrant_service_events_flow_gpm_check" CHECK (flow_gpm >= 0::double precision AND flow_gpm <= 100000::double precision);

ALTER TABLE "firehouse"."field_hydrant_service_events" ADD CONSTRAINT "field_hydrant_service_events_kind_check" CHECK (kind = ANY (ARRAY['maintenance'::text, 'flow'::text]));

ALTER TABLE "firehouse"."field_hydrant_service_events" ADD CONSTRAINT "field_hydrant_service_events_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."field_hydrant_service_events" ADD CONSTRAINT "field_hydrant_service_events_source_system_source_external__key" UNIQUE (source_system, source_external_id);

ALTER TABLE "firehouse"."field_hydrants" ADD CONSTRAINT "field_hydrants_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."field_preplan_alerts" ADD CONSTRAINT "field_preplan_alerts_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."field_preplan_annotations" ADD CONSTRAINT "field_preplan_annotations_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."field_preplan_assets" ADD CONSTRAINT "field_preplan_assets_object_key_key" UNIQUE (object_key);

ALTER TABLE "firehouse"."field_preplan_assets" ADD CONSTRAINT "field_preplan_assets_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."field_preplan_external_details" ADD CONSTRAINT "field_preplan_external_details_pkey" PRIMARY KEY (source_system, external_id);

ALTER TABLE "firehouse"."field_preplan_feature_levels" ADD CONSTRAINT "field_preplan_feature_levels_pkey" PRIMARY KEY (feature_id, level_id);

ALTER TABLE "firehouse"."field_preplan_features" ADD CONSTRAINT "field_preplan_features_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."field_preplan_hazmat" ADD CONSTRAINT "field_preplan_hazmat_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."field_preplan_hazmat_zones" ADD CONSTRAINT "field_preplan_hazmat_zones_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."field_preplan_hose_lays" ADD CONSTRAINT "field_preplan_hose_lays_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."field_preplan_imports" ADD CONSTRAINT "field_preplan_imports_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."field_preplan_levels" ADD CONSTRAINT "field_preplan_levels_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."field_preplan_levels" ADD CONSTRAINT "field_preplan_levels_preplan_id_short_label_key" UNIQUE (preplan_id, short_label);

ALTER TABLE "firehouse"."field_preplan_observations" ADD CONSTRAINT "field_preplan_observations_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."field_preplan_observations" ADD CONSTRAINT "field_preplan_observations_priority_check" CHECK (priority = ANY (ARRAY['routine'::text, 'urgent'::text]));

ALTER TABLE "firehouse"."field_preplan_photo_annotations" ADD CONSTRAINT "field_preplan_photo_annotations_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."field_preplan_photos" ADD CONSTRAINT "field_preplan_photos_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."field_preplan_reviews" ADD CONSTRAINT "field_preplan_reviews_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."field_preplan_revisions" ADD CONSTRAINT "field_preplan_revisions_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."field_preplan_revisions" ADD CONSTRAINT "field_preplan_revisions_preplan_id_revision_number_key" UNIQUE (preplan_id, revision_number);

ALTER TABLE "firehouse"."field_preplan_risk_factors" ADD CONSTRAINT "field_preplan_risk_factors_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."field_preplan_risk_factors" ADD CONSTRAINT "field_preplan_risk_factors_preplan_id_factor_key" UNIQUE (preplan_id, factor);

ALTER TABLE "firehouse"."field_preplan_settings" ADD CONSTRAINT "field_preplan_settings_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."field_preplan_spaces" ADD CONSTRAINT "field_preplan_spaces_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."field_preplans" ADD CONSTRAINT "field_preplans_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."fire_inspection_backup_audit" ADD CONSTRAINT "fire_inspection_backup_audit_pkey" PRIMARY KEY (department_id, id);

ALTER TABLE "firehouse"."fire_inspection_backup_entries" ADD CONSTRAINT "fire_inspection_backup_entries_pkey" PRIMARY KEY (department_id, job_id, path);

ALTER TABLE "firehouse"."fire_inspection_backup_jobs" ADD CONSTRAINT "fire_inspection_backup_jobs_pkey" PRIMARY KEY (department_id, id);

ALTER TABLE "firehouse"."fire_inspection_backup_rows" ADD CONSTRAINT "fire_inspection_backup_rows_pkey" PRIMARY KEY (department_id, job_id, dataset, entry_key);

ALTER TABLE "firehouse"."fire_inspection_code_audit" ADD CONSTRAINT "fire_inspection_code_audit_code_id_version_key" UNIQUE (code_id, version);

ALTER TABLE "firehouse"."fire_inspection_code_audit" ADD CONSTRAINT "fire_inspection_code_audit_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."fire_inspection_code_entries" ADD CONSTRAINT "fire_inspection_code_entries_payload_check" CHECK (length(payload) <= 60000);

ALTER TABLE "firehouse"."fire_inspection_code_entries" ADD CONSTRAINT "fire_inspection_code_entries_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."fire_inspection_email_deliveries" ADD CONSTRAINT "fire_inspection_email_deliver_record_id_record_version_reci_key" UNIQUE (record_id, record_version, recipient);

ALTER TABLE "firehouse"."fire_inspection_email_deliveries" ADD CONSTRAINT "fire_inspection_email_deliveries_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."fire_inspection_eso_files" ADD CONSTRAINT "fire_inspection_eso_files_object_key_key" UNIQUE (object_key);

ALTER TABLE "firehouse"."fire_inspection_eso_files" ADD CONSTRAINT "fire_inspection_eso_files_pkey" PRIMARY KEY (department_id, attachment_id);

ALTER TABLE "firehouse"."fire_inspection_eso_files" ADD CONSTRAINT "fire_inspection_eso_files_size_bytes_check" CHECK (size_bytes > 0 AND size_bytes <= 16777216);

ALTER TABLE "firehouse"."fire_inspection_eso_records" ADD CONSTRAINT "fire_inspection_eso_records_object_key_key" UNIQUE (object_key);

ALTER TABLE "firehouse"."fire_inspection_eso_records" ADD CONSTRAINT "fire_inspection_eso_records_pkey" PRIMARY KEY (department_id, inspection_id);

ALTER TABLE "firehouse"."fire_inspection_pilot_audit" ADD CONSTRAINT "fire_inspection_pilot_audit_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."fire_inspection_pilot_audit" ADD CONSTRAINT "fire_inspection_pilot_audit_record_id_version_key" UNIQUE (record_id, version);

ALTER TABLE "firehouse"."fire_inspection_pilot_files" ADD CONSTRAINT "fire_inspection_pilot_files_object_key_key" UNIQUE (object_key);

ALTER TABLE "firehouse"."fire_inspection_pilot_files" ADD CONSTRAINT "fire_inspection_pilot_files_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."fire_inspection_pilot_files" ADD CONSTRAINT "fire_inspection_pilot_files_source_size_check" CHECK (size_bytes > 0 AND (size_bytes <= 4194304 OR object_key ~~ 'eso:%'::text AND size_bytes <= 16777216));

ALTER TABLE "firehouse"."fire_inspection_pilot_files" ADD CONSTRAINT "inspection_file_target" CHECK (((record_id IS NOT NULL)::integer + (code_id IS NOT NULL)::integer) = 1);

ALTER TABLE "firehouse"."fire_inspection_pilot_records" ADD CONSTRAINT "fire_inspection_pilot_records_archived_check" CHECK (archived = ANY (ARRAY[0, 1]));

ALTER TABLE "firehouse"."fire_inspection_pilot_records" ADD CONSTRAINT "fire_inspection_pilot_records_kind_check" CHECK (kind = ANY (ARRAY['inspection'::text, 'template'::text]));

ALTER TABLE "firehouse"."fire_inspection_pilot_records" ADD CONSTRAINT "fire_inspection_pilot_records_payload_check" CHECK (length(payload) <= 180000);

ALTER TABLE "firehouse"."fire_inspection_pilot_records" ADD CONSTRAINT "fire_inspection_pilot_records_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."fire_inspection_pilot_records" ADD CONSTRAINT "fire_inspection_pilot_records_version_check" CHECK (version > 0);

ALTER TABLE "firehouse"."fire_inspection_staff_audit" ADD CONSTRAINT "fire_inspection_staff_audit_department_id_request_id_action_key" UNIQUE (department_id, request_id, action);

ALTER TABLE "firehouse"."fire_inspection_staff_audit" ADD CONSTRAINT "fire_inspection_staff_audit_pkey" PRIMARY KEY (department_id, id);

ALTER TABLE "firehouse"."fire_inspection_staff_members" ADD CONSTRAINT "fire_inspection_staff_members_department_id_email_key" UNIQUE (department_id, email);

ALTER TABLE "firehouse"."fire_inspection_staff_members" ADD CONSTRAINT "fire_inspection_staff_members_email_check" CHECK (email = lower(btrim(email)));

ALTER TABLE "firehouse"."fire_inspection_staff_members" ADD CONSTRAINT "fire_inspection_staff_members_pkey" PRIMARY KEY (department_id, id);

ALTER TABLE "firehouse"."fire_inspection_staff_members" ADD CONSTRAINT "fire_inspection_staff_members_revision_check" CHECK (revision > 0);

ALTER TABLE "firehouse"."fire_inspection_staff_members" ADD CONSTRAINT "fire_inspection_staff_members_role_check" CHECK (role = ANY (ARRAY['admin'::text, 'supervisor'::text, 'inspector'::text, 'viewer'::text]));

ALTER TABLE "firehouse"."fire_inspection_staff_members" ADD CONSTRAINT "fire_inspection_staff_members_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'invited'::text, 'active'::text, 'disabled'::text]));

ALTER TABLE "firehouse"."fire_inspection_staff_mutations" ADD CONSTRAINT "fire_inspection_staff_mutations_pkey" PRIMARY KEY (department_id, request_id);

ALTER TABLE "firehouse"."fire_inspection_staff_workspaces" ADD CONSTRAINT "fire_inspection_staff_workspaces_pkey" PRIMARY KEY (department_id);

ALTER TABLE "firehouse"."fire_inspection_staff_workspaces" ADD CONSTRAINT "fire_inspection_staff_workspaces_revision_check" CHECK (revision > 0);

ALTER TABLE "firehouse"."fleet_apparatus" ADD CONSTRAINT "fleet_apparatus_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."important_phone_numbers" ADD CONSTRAINT "important_phone_numbers_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."incident_command_boards" ADD CONSTRAINT "incident_command_boards_pkey" PRIMARY KEY (incident_id);

ALTER TABLE "firehouse"."incident_command_events" ADD CONSTRAINT "incident_command_events_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."inventory_audit_events" ADD CONSTRAINT "inventory_audit_events_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."inventory_compartments" ADD CONSTRAINT "inventory_compartments_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."inventory_equipment" ADD CONSTRAINT "inventory_equipment_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."inventory_hotspots" ADD CONSTRAINT "inventory_hotspots_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."inventory_photos" ADD CONSTRAINT "inventory_photos_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."inventory_readiness" ADD CONSTRAINT "inventory_readiness_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."inventory_weekly_check_items" ADD CONSTRAINT "inventory_weekly_check_items_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."inventory_weekly_check_results" ADD CONSTRAINT "inventory_weekly_check_results_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."inventory_weekly_check_templates" ADD CONSTRAINT "inventory_weekly_check_templates_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."inventory_weekly_checks" ADD CONSTRAINT "inventory_weekly_checks_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."neris_pilot_audit" ADD CONSTRAINT "neris_pilot_audit_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."neris_pilot_audit" ADD CONSTRAINT "neris_pilot_audit_record_id_version_key" UNIQUE (record_id, version);

ALTER TABLE "firehouse"."neris_pilot_files" ADD CONSTRAINT "neris_pilot_files_object_key_key" UNIQUE (object_key);

ALTER TABLE "firehouse"."neris_pilot_files" ADD CONSTRAINT "neris_pilot_files_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."neris_pilot_files" ADD CONSTRAINT "neris_pilot_files_size_bytes_check" CHECK (size_bytes > 0 AND size_bytes <= 4194304);

ALTER TABLE "firehouse"."neris_pilot_records" ADD CONSTRAINT "neris_pilot_records_archived_check" CHECK (archived = ANY (ARRAY[0, 1]));

ALTER TABLE "firehouse"."neris_pilot_records" ADD CONSTRAINT "neris_pilot_records_kind_check" CHECK (kind = ANY (ARRAY['incident'::text, 'settings'::text]));

ALTER TABLE "firehouse"."neris_pilot_records" ADD CONSTRAINT "neris_pilot_records_payload_check" CHECK (length(payload) <= 550000);

ALTER TABLE "firehouse"."neris_pilot_records" ADD CONSTRAINT "neris_pilot_records_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."neris_pilot_records" ADD CONSTRAINT "neris_pilot_records_version_check" CHECK (version > 0);

ALTER TABLE "firehouse"."operational_cad_recovery" ADD CONSTRAINT "operational_cad_recovery_pkey" PRIMARY KEY (department_id);

ALTER TABLE "firehouse"."operational_program_audit" ADD CONSTRAINT "operational_program_audit_pkey" PRIMARY KEY (department_id, record_id, version);

ALTER TABLE "firehouse"."operational_program_records" ADD CONSTRAINT "operational_program_records_kind_check" CHECK (kind = ANY (ARRAY['hydrants'::text, 'outreach'::text, 'replacement'::text]));

ALTER TABLE "firehouse"."operational_program_records" ADD CONSTRAINT "operational_program_records_pkey" PRIMARY KEY (department_id, id);

ALTER TABLE "firehouse"."operational_program_records" ADD CONSTRAINT "operational_program_records_version_check" CHECK (version > 0);

ALTER TABLE "firehouse"."operational_revisions" ADD CONSTRAINT "operational_revisions_pkey" PRIMARY KEY (department_id, section);

ALTER TABLE "firehouse"."operational_revisions" ADD CONSTRAINT "operational_revisions_section_check" CHECK (section = ANY (ARRAY['respond'::text, 'dashboard'::text, 'duties'::text, 'fleet'::text, 'chief'::text, 'staffing'::text, 'feeds'::text]));

ALTER TABLE "firehouse"."operational_view_leases" ADD CONSTRAINT "operational_view_leases_pkey" PRIMARY KEY (user_id, department_id, scope);

ALTER TABLE "firehouse"."operational_view_leases" ADD CONSTRAINT "operational_view_leases_scope_check" CHECK (scope = ANY (ARRAY['respond'::text, 'board'::text]));

ALTER TABLE "firehouse"."pay_periods" ADD CONSTRAINT "pay_periods_pkey" PRIMARY KEY (start_date);

ALTER TABLE "firehouse"."pay_rate_history" ADD CONSTRAINT "pay_rate_history_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."pay_scales" ADD CONSTRAINT "pay_scales_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_check" CHECK (target_period > source_period);

ALTER TABLE "firehouse"."payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_document_check" CHECK (jsonb_typeof(document::jsonb) = 'object'::text);

ALTER TABLE "firehouse"."payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_sequence_check" CHECK (sequence > 0);

ALTER TABLE "firehouse"."payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_source_period_employee_id_sequence_key" UNIQUE (source_period, employee_id, sequence);

ALTER TABLE "firehouse"."payroll_settings" ADD CONSTRAINT "payroll_settings_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."payroll_source_version" ADD CONSTRAINT "payroll_source_version_id_check" CHECK (id = 1);

ALTER TABLE "firehouse"."payroll_source_version" ADD CONSTRAINT "payroll_source_version_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."payroll_submissions" ADD CONSTRAINT "payroll_submissions_document_check" CHECK (jsonb_typeof(document::jsonb) = 'object'::text);

ALTER TABLE "firehouse"."payroll_submissions" ADD CONSTRAINT "payroll_submissions_period_start_key" UNIQUE (period_start);

ALTER TABLE "firehouse"."payroll_submissions" ADD CONSTRAINT "payroll_submissions_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."policies" ADD CONSTRAINT "policies_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."portal_activation_attempts" ADD CONSTRAINT "portal_activation_attempts_failed_attempts_check" CHECK (failed_attempts >= 0);

ALTER TABLE "firehouse"."portal_activation_attempts" ADD CONSTRAINT "portal_activation_attempts_pkey" PRIMARY KEY (email);

ALTER TABLE "firehouse"."portal_confirmation_messages" ADD CONSTRAINT "portal_confirmation_messages_check" CHECK (NOT enabled OR length(btrim(message)) > 0);

ALTER TABLE "firehouse"."portal_confirmation_messages" ADD CONSTRAINT "portal_confirmation_messages_message_check" CHECK (length(message) <= 4000);

ALTER TABLE "firehouse"."portal_confirmation_messages" ADD CONSTRAINT "portal_confirmation_messages_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."portal_confirmation_messages" ADD CONSTRAINT "portal_confirmation_messages_title_check" CHECK (length(title) >= 1 AND length(title) <= 120);

ALTER TABLE "firehouse"."portal_confirmation_receipts" ADD CONSTRAINT "portal_confirmation_receipts_pkey" PRIMARY KEY (message_id, user_id);

ALTER TABLE "firehouse"."portal_confirmation_setting" ADD CONSTRAINT "portal_confirmation_setting_department_id_check" CHECK (department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid);

ALTER TABLE "firehouse"."portal_confirmation_setting" ADD CONSTRAINT "portal_confirmation_setting_pkey" PRIMARY KEY (department_id);

ALTER TABLE "firehouse"."portal_login_audit" ADD CONSTRAINT "portal_login_audit_outcome_check" CHECK (outcome = ANY (ARRAY['success'::text, 'failed_pin'::text, 'session_failure'::text, 'unlock_failure'::text]));

ALTER TABLE "firehouse"."portal_login_audit" ADD CONSTRAINT "portal_login_audit_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."portal_login_audit_status" ADD CONSTRAINT "portal_login_audit_status_pkey" PRIMARY KEY (singleton);

ALTER TABLE "firehouse"."portal_login_audit_status" ADD CONSTRAINT "portal_login_audit_status_singleton_check" CHECK (singleton);

ALTER TABLE "firehouse"."push_subscriptions" ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE (endpoint);

ALTER TABLE "firehouse"."push_subscriptions" ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."rank_permissions" ADD CONSTRAINT "rank_permissions_pkey" PRIMARY KEY (rank, permission_key);

ALTER TABLE "firehouse"."record_revisions" ADD CONSTRAINT "record_revisions_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."road_closures" ADD CONSTRAINT "road_closures_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."road_closures" ADD CONSTRAINT "road_closures_status_check" CHECK (status = ANY (ARRAY['active'::text, 'cleared'::text]));

ALTER TABLE "firehouse"."safety_inspection_attachments" ADD CONSTRAINT "safety_inspection_attachments_object_key_key" UNIQUE (object_key);

ALTER TABLE "firehouse"."safety_inspection_attachments" ADD CONSTRAINT "safety_inspection_attachments_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."safety_inspection_results" ADD CONSTRAINT "safety_inspection_results_inspection_id_template_item_id_key" UNIQUE (inspection_id, template_item_id);

ALTER TABLE "firehouse"."safety_inspection_results" ADD CONSTRAINT "safety_inspection_results_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."safety_inspection_results" ADD CONSTRAINT "safety_inspection_results_result_status_check" CHECK (result_status = ANY (ARRAY['not_checked'::text, 'pass'::text, 'deficient'::text, 'not_applicable'::text]));

ALTER TABLE "firehouse"."safety_inspection_template_items" ADD CONSTRAINT "safety_inspection_template_items_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."safety_inspection_templates" ADD CONSTRAINT "safety_inspection_templates_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."safety_inspection_templates" ADD CONSTRAINT "safety_inspection_templates_slug_key" UNIQUE (slug);

ALTER TABLE "firehouse"."safety_inspections" ADD CONSTRAINT "safety_inspections_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."safety_inspections" ADD CONSTRAINT "safety_inspections_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text, 'reopened'::text]));

ALTER TABLE "firehouse"."schedule_assignments" ADD CONSTRAINT "schedule_assignments_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."schedule_coverage_rules" ADD CONSTRAINT "schedule_coverage_rules_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."schedule_notification_rules" ADD CONSTRAINT "schedule_notification_rules_pkey" PRIMARY KEY (event_type);

ALTER TABLE "firehouse"."schedule_notifications" ADD CONSTRAINT "schedule_notifications_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."schedule_requests" ADD CONSTRAINT "schedule_requests_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."schedule_rotations" ADD CONSTRAINT "schedule_rotations_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."schedule_shift_patterns" ADD CONSTRAINT "schedule_shift_patterns_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."schedule_staffing_overrides" ADD CONSTRAINT "schedule_staffing_overrides_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."scheduler_push_deliveries" ADD CONSTRAINT "scheduler_push_deliveries_event_id_subscription_id_key" UNIQUE (event_id, subscription_id);

ALTER TABLE "firehouse"."scheduler_push_deliveries" ADD CONSTRAINT "scheduler_push_deliveries_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."scheduler_push_deliveries" ADD CONSTRAINT "scheduler_push_deliveries_state_check" CHECK (state = ANY (ARRAY['pending'::text, 'sending'::text, 'retry'::text, 'accepted'::text, 'cancelled'::text, 'expired'::text, 'failed'::text]));

ALTER TABLE "firehouse"."scheduler_push_events" ADD CONSTRAINT "scheduler_push_events_department_id_check" CHECK (department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid);

ALTER TABLE "firehouse"."scheduler_push_events" ADD CONSTRAINT "scheduler_push_events_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."scheduler_push_events" ADD CONSTRAINT "scheduler_push_events_rule_id_source_kind_source_id_version_key" UNIQUE (rule_id, source_kind, source_id, version, timing);

ALTER TABLE "firehouse"."station_availability" ADD CONSTRAINT "station_availability_employee_date_unique" UNIQUE (employee_id, availability_date);

ALTER TABLE "firehouse"."station_availability" ADD CONSTRAINT "station_availability_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."station_availability" ADD CONSTRAINT "station_availability_status_check" CHECK (status = ANY (ARRAY['available'::text, 'unavailable'::text]));

ALTER TABLE "firehouse"."station_distribution_weights" ADD CONSTRAINT "station_distribution_weights_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."station_ot_interest" ADD CONSTRAINT "station_ot_interest_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."station_ot_interest" ADD CONSTRAINT "station_ot_interest_unique" UNIQUE (slot_id, employee_id);

ALTER TABLE "firehouse"."station_ot_offers" ADD CONSTRAINT "station_ot_offers_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."station_ot_settings" ADD CONSTRAINT "station_ot_settings_pkey" PRIMARY KEY (mode);

ALTER TABLE "firehouse"."station_ot_timing" ADD CONSTRAINT "station_ot_timing_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."station_reminder_rules" ADD CONSTRAINT "station_reminder_rules_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."station_reminder_rules" ADD CONSTRAINT "station_reminder_rules_push_enabled_check" CHECK (push_enabled = ANY (ARRAY[0, 1]));

ALTER TABLE "firehouse"."station_schedule_entries" ADD CONSTRAINT "station_schedule_entries_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."station_schedule_entries" ADD CONSTRAINT "station_schedule_entry_unique" UNIQUE (entry_date, shift_type_id);

ALTER TABLE "firehouse"."station_shift_claims" ADD CONSTRAINT "station_shift_claims_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."station_shift_slots" ADD CONSTRAINT "station_shift_slots_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."station_shift_type_roles" ADD CONSTRAINT "station_shift_type_role_unique" UNIQUE (shift_type_id, role);

ALTER TABLE "firehouse"."station_shift_type_roles" ADD CONSTRAINT "station_shift_type_roles_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."station_shift_types" ADD CONSTRAINT "station_shift_types_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."station_shift_types" ADD CONSTRAINT "station_shift_types_repeat_every_days_check" CHECK (repeat_every_days >= 0 AND repeat_every_days <= 365);

ALTER TABLE "firehouse"."station_standing_assignments" ADD CONSTRAINT "station_standing_assignment_unique" UNIQUE (employee_id, shift_type_id, role);

ALTER TABLE "firehouse"."station_standing_assignments" ADD CONSTRAINT "station_standing_assignments_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."station_time_off_dates" ADD CONSTRAINT "station_time_off_date_unique" UNIQUE (request_id, off_date);

ALTER TABLE "firehouse"."station_time_off_requests" ADD CONSTRAINT "station_time_off_requests_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."station_trade_requests" ADD CONSTRAINT "station_trade_requests_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."station_unavailability" ADD CONSTRAINT "station_unavailability_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."station_unavailability" ADD CONSTRAINT "station_unavailability_unique" UNIQUE (employee_id, off_date);

ALTER TABLE "firehouse"."system_meta" ADD CONSTRAINT "system_meta_pkey" PRIMARY KEY (key);

ALTER TABLE "firehouse"."time_entries" ADD CONSTRAINT "time_entries_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."training_pilot_audit" ADD CONSTRAINT "training_pilot_audit_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."training_pilot_audit" ADD CONSTRAINT "training_pilot_audit_record_id_version_key" UNIQUE (record_id, version);

ALTER TABLE "firehouse"."training_pilot_files" ADD CONSTRAINT "training_pilot_files_object_key_key" UNIQUE (object_key);

ALTER TABLE "firehouse"."training_pilot_files" ADD CONSTRAINT "training_pilot_files_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."training_pilot_files" ADD CONSTRAINT "training_pilot_files_size_bytes_check" CHECK (size_bytes > 0 AND size_bytes <= 4194304);

ALTER TABLE "firehouse"."training_pilot_records" ADD CONSTRAINT "training_pilot_records_archived_check" CHECK (archived = ANY (ARRAY[0, 1]));

ALTER TABLE "firehouse"."training_pilot_records" ADD CONSTRAINT "training_pilot_records_kind_check" CHECK (kind = ANY (ARRAY['activity'::text, 'completion'::text, 'assignment'::text, 'credential'::text, 'proficiency'::text, 'group'::text, 'resource'::text]));

ALTER TABLE "firehouse"."training_pilot_records" ADD CONSTRAINT "training_pilot_records_payload_check" CHECK (length(payload) <= 90000);

ALTER TABLE "firehouse"."training_pilot_records" ADD CONSTRAINT "training_pilot_records_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."training_pilot_records" ADD CONSTRAINT "training_pilot_records_version_check" CHECK (version > 0);

ALTER TABLE "firehouse"."training_report_views" ADD CONSTRAINT "training_report_views_archived_check" CHECK (archived = ANY (ARRAY[0, 1]));

ALTER TABLE "firehouse"."training_report_views" ADD CONSTRAINT "training_report_views_filters_check" CHECK (length(filters) <= 6000);

ALTER TABLE "firehouse"."training_report_views" ADD CONSTRAINT "training_report_views_pkey" PRIMARY KEY (department_id, id);

ALTER TABLE "firehouse"."training_report_views" ADD CONSTRAINT "training_report_views_slot_check" CHECK (slot >= 1 AND slot <= 20);

ALTER TABLE "firehouse"."training_report_views" ADD CONSTRAINT "training_report_views_version_check" CHECK (version > 0);

ALTER TABLE "firehouse"."work_detail_requests" ADD CONSTRAINT "work_detail_requests_pkey" PRIMARY KEY (id);

ALTER TABLE "firehouse"."work_detail_requests" ADD CONSTRAINT "work_detail_requests_time_in_instant_check" CHECK (time_in_instant = ''::text OR time_in_instant ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'::text);

ALTER TABLE "firehouse"."work_detail_requests" ADD CONSTRAINT "work_detail_requests_time_out_instant_check" CHECK (time_out_instant = ''::text OR time_out_instant ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'::text);

ALTER TABLE "firehouse"."workspace_review_audit" ADD CONSTRAINT "workspace_review_audit_pkey" PRIMARY KEY (department_id, record_id, version);

ALTER TABLE "firehouse"."workspace_review_records" ADD CONSTRAINT "workspace_review_records_department_id_kind_subject_id_key" UNIQUE (department_id, kind, subject_id);

ALTER TABLE "firehouse"."workspace_review_records" ADD CONSTRAINT "workspace_review_records_kind_check" CHECK (kind = ANY (ARRAY['property_incident'::text, 'review_plan'::text, 'hydrant_view'::text, 'command_snapshot'::text]));

ALTER TABLE "firehouse"."workspace_review_records" ADD CONSTRAINT "workspace_review_records_payload_check" CHECK (length(payload) <= 200000);

ALTER TABLE "firehouse"."workspace_review_records" ADD CONSTRAINT "workspace_review_records_pkey" PRIMARY KEY (department_id, id);

ALTER TABLE "firehouse"."workspace_review_records" ADD CONSTRAINT "workspace_review_records_version_check" CHECK (version > 0);

ALTER TABLE "private"."department_portals" ADD CONSTRAINT "department_portals_hostname_key" UNIQUE (hostname);

ALTER TABLE "private"."department_portals" ADD CONSTRAINT "department_portals_pkey" PRIMARY KEY (department_id);

ALTER TABLE "private"."department_portals" ADD CONSTRAINT "department_portals_schema_name_key" UNIQUE (schema_name);

ALTER TABLE "private"."portal_remembered_devices" ADD CONSTRAINT "portal_remembered_devices_check" CHECK (expires_at > created_at AND expires_at <= (created_at + '7 days'::interval));

ALTER TABLE "private"."portal_remembered_devices" ADD CONSTRAINT "portal_remembered_devices_pkey" PRIMARY KEY (token_hash);

ALTER TABLE "private"."portal_remembered_devices" ADD CONSTRAINT "portal_remembered_devices_token_hash_check" CHECK (length(token_hash) = 64);

ALTER TABLE "private"."portal_remembered_devices" ADD CONSTRAINT "portal_remembered_devices_user_id_session_id_key" UNIQUE (user_id, session_id);

ALTER TABLE "public"."department_apparatus" ADD CONSTRAINT "department_apparatus_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."department_apparatus" ADD CONSTRAINT "department_apparatus_status_check" CHECK (status = ANY (ARRAY['in_service'::text, 'reserve'::text, 'out_of_service'::text, 'deployed'::text]));

ALTER TABLE "public"."department_invites" ADD CONSTRAINT "department_invites_department_id_email_key" UNIQUE (department_id, email);

ALTER TABLE "public"."department_invites" ADD CONSTRAINT "department_invites_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."department_memberships" ADD CONSTRAINT "department_memberships_department_id_user_id_key" UNIQUE (department_id, user_id);

ALTER TABLE "public"."department_memberships" ADD CONSTRAINT "department_memberships_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."departments" ADD CONSTRAINT "departments_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."departments" ADD CONSTRAINT "departments_slug_key" UNIQUE (slug);

ALTER TABLE "public"."disciplinary_import_staging" ADD CONSTRAINT "disciplinary_import_staging_department_id_source_id_key" UNIQUE (department_id, source_id);

ALTER TABLE "public"."disciplinary_import_staging" ADD CONSTRAINT "disciplinary_import_staging_pdf_size_check" CHECK (pdf_size >= 5 AND pdf_size <= 4194304);

ALTER TABLE "public"."disciplinary_import_staging" ADD CONSTRAINT "disciplinary_import_staging_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."disciplinary_import_staging" ADD CONSTRAINT "disciplinary_import_staging_source_hash_check" CHECK (source_hash ~ '^[a-f0-9]{64}$'::text);

ALTER TABLE "public"."disciplinary_report_files" ADD CONSTRAINT "disciplinary_report_files_byte_size_check" CHECK (byte_size > 0 AND byte_size <= 4194304);

ALTER TABLE "public"."disciplinary_report_files" ADD CONSTRAINT "disciplinary_report_files_object_key_key" UNIQUE (object_key);

ALTER TABLE "public"."disciplinary_report_files" ADD CONSTRAINT "disciplinary_report_files_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."disciplinary_report_files" ADD CONSTRAINT "disciplinary_report_files_report_id_sha256_key" UNIQUE (report_id, sha256);

ALTER TABLE "public"."disciplinary_report_files" ADD CONSTRAINT "disciplinary_report_files_sha256_check" CHECK (sha256 ~ '^[a-f0-9]{64}$'::text);

ALTER TABLE "public"."disciplinary_report_versions" ADD CONSTRAINT "disciplinary_report_versions_pkey" PRIMARY KEY (report_id, version);

ALTER TABLE "public"."disciplinary_reports" ADD CONSTRAINT "disciplinary_reports_id_department_id_key" UNIQUE (id, department_id);

ALTER TABLE "public"."disciplinary_reports" ADD CONSTRAINT "disciplinary_reports_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."disciplinary_reports" ADD CONSTRAINT "disciplinary_reports_source_status_check" CHECK (source_status = ANY (ARRAY['draft'::text, 'submitted'::text]));

ALTER TABLE "public"."disciplinary_reports" ADD CONSTRAINT "disciplinary_reports_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text]));

ALTER TABLE "public"."disciplinary_reports" ADD CONSTRAINT "disciplinary_reports_version_check" CHECK (version > 0);

ALTER TABLE "public"."inventory_apparatus_profiles" ADD CONSTRAINT "inventory_apparatus_profiles_department_id_id_key" UNIQUE (department_id, id);

ALTER TABLE "public"."inventory_apparatus_profiles" ADD CONSTRAINT "inventory_apparatus_profiles_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."inventory_apparatus_profiles" ADD CONSTRAINT "inventory_apparatus_profiles_weekly_due_day_check" CHECK (weekly_due_day IS NULL OR weekly_due_day >= 0 AND weekly_due_day <= 6);

ALTER TABLE "public"."inventory_apparatus_profiles" ADD CONSTRAINT "inventory_apparatus_profiles_year_check" CHECK (year IS NULL OR year >= 1900 AND year <= 2100);

ALTER TABLE "public"."inventory_audit_events" ADD CONSTRAINT "inventory_audit_events_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."inventory_check_archives" ADD CONSTRAINT "inventory_check_archives_pkey" PRIMARY KEY (check_id);

ALTER TABLE "public"."inventory_check_archives" ADD CONSTRAINT "inventory_check_archives_reason_check" CHECK (length(btrim(reason)) >= 1 AND length(btrim(reason)) <= 2000);

ALTER TABLE "public"."inventory_check_archives" ADD CONSTRAINT "inventory_check_archives_replacement_check_id_key" UNIQUE (replacement_check_id);

ALTER TABLE "public"."inventory_check_items" ADD CONSTRAINT "inventory_check_items_check_id_equipment_id_key" UNIQUE (check_id, equipment_id);

ALTER TABLE "public"."inventory_check_items" ADD CONSTRAINT "inventory_check_items_numeric_reading_nonnegative" CHECK (numeric_reading IS NULL OR numeric_reading >= 0::numeric);

ALTER TABLE "public"."inventory_check_items" ADD CONSTRAINT "inventory_check_items_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."inventory_check_items" ADD CONSTRAINT "inventory_check_items_result_check" CHECK (result = ANY (ARRAY['pending'::text, 'pass'::text, 'failed'::text, 'missing'::text, 'damaged'::text, 'not_applicable'::text]));

ALTER TABLE "public"."inventory_checks" ADD CONSTRAINT "inventory_checks_check_type_check" CHECK (check_type = ANY (ARRAY['daily'::text, 'weekly'::text, 'inventory'::text, 'air_pack'::text, 'drug'::text]));

ALTER TABLE "public"."inventory_checks" ADD CONSTRAINT "inventory_checks_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."inventory_checks" ADD CONSTRAINT "inventory_checks_review_status_check" CHECK (review_status = ANY (ARRAY['pending'::text, 'approved'::text, 'changes_requested'::text]));

ALTER TABLE "public"."inventory_checks" ADD CONSTRAINT "inventory_checks_status_check" CHECK (status = ANY (ARRAY['in_progress'::text, 'completed'::text, 'cancelled'::text]));

ALTER TABLE "public"."inventory_compartments" ADD CONSTRAINT "inventory_compartments_apparatus_id_label_key" UNIQUE (apparatus_id, label);

ALTER TABLE "public"."inventory_compartments" ADD CONSTRAINT "inventory_compartments_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."inventory_compartments" ADD CONSTRAINT "inventory_compartments_side_check" CHECK (side = ANY (ARRAY['driver'::text, 'officer'::text, 'front'::text, 'rear'::text, 'cab'::text, 'pump'::text, 'roof'::text, 'interior'::text, 'spin'::text]));

ALTER TABLE "public"."inventory_deficiency_photos" ADD CONSTRAINT "inventory_deficiency_photos_byte_size_check" CHECK (byte_size > 0 AND byte_size <= 20971520);

ALTER TABLE "public"."inventory_deficiency_photos" ADD CONSTRAINT "inventory_deficiency_photos_object_key_key" UNIQUE (object_key);

ALTER TABLE "public"."inventory_deficiency_photos" ADD CONSTRAINT "inventory_deficiency_photos_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."inventory_equipment" ADD CONSTRAINT "inventory_air_asset_identity" CHECK (scba_asset_kind IS NULL OR asset_number IS NOT NULL AND length(btrim(asset_number)) >= 1 AND length(btrim(asset_number)) <= 80 AND quantity_required = 1 AND item_type = 'individual'::text AND equipment_category = 'air_pack'::text);

ALTER TABLE "public"."inventory_equipment" ADD CONSTRAINT "inventory_air_hydro_dates" CHECK (hydro_due_date IS NULL OR hydro_test_date IS NULL OR hydro_due_date >= hydro_test_date);

ALTER TABLE "public"."inventory_equipment" ADD CONSTRAINT "inventory_equipment_department_id_barcode_key" UNIQUE (department_id, barcode);

ALTER TABLE "public"."inventory_equipment" ADD CONSTRAINT "inventory_equipment_equipment_category_check" CHECK (equipment_category = ANY (ARRAY['vehicle'::text, 'air_pack'::text, 'equipment'::text]));

ALTER TABLE "public"."inventory_equipment" ADD CONSTRAINT "inventory_equipment_item_type_check" CHECK (item_type = ANY (ARRAY['individual'::text, 'kit'::text, 'bag'::text, 'toolbox'::text, 'container'::text, 'consumable'::text]));

ALTER TABLE "public"."inventory_equipment" ADD CONSTRAINT "inventory_equipment_parent_not_self_check" CHECK (parent_equipment_id IS NULL OR parent_equipment_id <> id);

ALTER TABLE "public"."inventory_equipment" ADD CONSTRAINT "inventory_equipment_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."inventory_equipment" ADD CONSTRAINT "inventory_equipment_quantity_required_check" CHECK (quantity_required > 0);

ALTER TABLE "public"."inventory_equipment" ADD CONSTRAINT "inventory_equipment_response_type_check" CHECK (response_type = ANY (ARRAY['pass_fail'::text, 'quantity'::text, 'expiration_date'::text, 'numeric'::text, 'mileage'::text, 'text'::text, 'medication'::text]));

ALTER TABLE "public"."inventory_equipment" ADD CONSTRAINT "inventory_equipment_scba_asset_kind_check" CHECK (scba_asset_kind = ANY (ARRAY['pack'::text, 'bottle'::text]));

ALTER TABLE "public"."inventory_equipment" ADD CONSTRAINT "inventory_equipment_service_status_check" CHECK (service_status = ANY (ARRAY['in_service'::text, 'out_of_service'::text, 'in_repair'::text, 'retired'::text]));

ALTER TABLE "public"."inventory_equipment" ADD CONSTRAINT "inventory_equipment_weekly_recurrence_check" CHECK (weekly_recurrence = ANY (ARRAY['every_week'::text, 'first_third_saturday'::text]));

ALTER TABLE "public"."inventory_equipment" ADD CONSTRAINT "inventory_service_schedule_valid" CHECK ((last_serviced_date IS NULL OR isfinite(last_serviced_date) AND last_serviced_date >= '1900-01-01'::date) AND (service_interval_months IS NULL AND service_reminder_months IS NULL OR last_serviced_date IS NOT NULL AND service_interval_months IS NOT NULL AND service_interval_months >= 1 AND service_interval_months <= 600 AND service_reminder_months IS NOT NULL AND service_reminder_months >= 0 AND service_reminder_months <= 120 AND service_reminder_months < service_interval_months));

ALTER TABLE "public"."inventory_inspection_schedules" ADD CONSTRAINT "inventory_inspection_schedule_department_id_apparatus_id_ch_key" UNIQUE (department_id, apparatus_id, check_type, day_of_week);

ALTER TABLE "public"."inventory_inspection_schedules" ADD CONSTRAINT "inventory_inspection_schedules_check" CHECK (end_time > start_time);

ALTER TABLE "public"."inventory_inspection_schedules" ADD CONSTRAINT "inventory_inspection_schedules_check_type_check" CHECK (check_type = ANY (ARRAY['daily'::text, 'weekly'::text, 'inventory'::text, 'air_pack'::text, 'drug'::text]));

ALTER TABLE "public"."inventory_inspection_schedules" ADD CONSTRAINT "inventory_inspection_schedules_day_of_week_check" CHECK (day_of_week >= 0 AND day_of_week <= 6);

ALTER TABLE "public"."inventory_inspection_schedules" ADD CONSTRAINT "inventory_inspection_schedules_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."inventory_location_change_requests" ADD CONSTRAINT "inventory_location_change_requests_check" CHECK (status = 'pending'::text AND reviewed_by IS NULL AND reviewed_at IS NULL OR (status = ANY (ARRAY['approved'::text, 'denied'::text])) AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL);

ALTER TABLE "public"."inventory_location_change_requests" ADD CONSTRAINT "inventory_location_change_requests_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."inventory_location_change_requests" ADD CONSTRAINT "inventory_location_change_requests_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text]));

ALTER TABLE "public"."inventory_operation_receipts" ADD CONSTRAINT "inventory_operation_receipts_pkey" PRIMARY KEY (department_id, request_id);

ALTER TABLE "public"."inventory_photo_hotspots" ADD CONSTRAINT "inventory_photo_hotspots_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."inventory_photo_hotspots" ADD CONSTRAINT "inventory_photo_hotspots_x_basis_points_check" CHECK (x_basis_points >= 0 AND x_basis_points <= 10000);

ALTER TABLE "public"."inventory_photo_hotspots" ADD CONSTRAINT "inventory_photo_hotspots_y_basis_points_check" CHECK (y_basis_points >= 0 AND y_basis_points <= 10000);

ALTER TABLE "public"."inventory_photo_views" ADD CONSTRAINT "inventory_photo_views_byte_size_check" CHECK (byte_size > 0 AND byte_size <= 20971520);

ALTER TABLE "public"."inventory_photo_views" ADD CONSTRAINT "inventory_photo_views_object_key_key" UNIQUE (object_key);

ALTER TABLE "public"."inventory_photo_views" ADD CONSTRAINT "inventory_photo_views_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."inventory_readiness_exceptions" ADD CONSTRAINT "inventory_readiness_exceptions_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."inventory_scba_check_entries" ADD CONSTRAINT "inventory_scba_check_entries_check_id_sort_order_key" UNIQUE (check_id, sort_order);

ALTER TABLE "public"."inventory_scba_check_entries" ADD CONSTRAINT "inventory_scba_check_entries_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."inventory_scba_check_entries" ADD CONSTRAINT "inventory_scba_check_entries_psi_check" CHECK (psi >= 0 AND psi <= 6000);

ALTER TABLE "public"."inventory_scba_check_entries" ADD CONSTRAINT "inventory_scba_check_entries_result_check" CHECK (result = ANY (ARRAY['pending'::text, 'pass'::text, 'failed'::text, 'not_applicable'::text]));

ALTER TABLE "public"."inventory_scba_check_entries" ADD CONSTRAINT "inventory_scba_check_entries_section_check" CHECK (section = ANY (ARRAY['pack'::text, 'rit'::text, 'spare'::text]));

ALTER TABLE "public"."inventory_scba_templates" ADD CONSTRAINT "inventory_scba_templates_check" CHECK (cardinality(pack_positions) > 0 OR include_rit OR spare_bottle_count > 0);

ALTER TABLE "public"."inventory_scba_templates" ADD CONSTRAINT "inventory_scba_templates_department_id_apparatus_id_key" UNIQUE (department_id, apparatus_id);

ALTER TABLE "public"."inventory_scba_templates" ADD CONSTRAINT "inventory_scba_templates_pack_positions_check" CHECK (cardinality(pack_positions) >= 0 AND cardinality(pack_positions) <= 12);

ALTER TABLE "public"."inventory_scba_templates" ADD CONSTRAINT "inventory_scba_templates_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."inventory_scba_templates" ADD CONSTRAINT "inventory_scba_templates_spare_bottle_count_check" CHECK (spare_bottle_count >= 0 AND spare_bottle_count <= 20);

ALTER TABLE "public"."inventory_stock_items" ADD CONSTRAINT "inventory_stock_items_department_id_barcode_key" UNIQUE (department_id, barcode);

ALTER TABLE "public"."inventory_stock_items" ADD CONSTRAINT "inventory_stock_items_department_id_sku_key" UNIQUE (department_id, sku);

ALTER TABLE "public"."inventory_stock_items" ADD CONSTRAINT "inventory_stock_items_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."inventory_stock_lots" ADD CONSTRAINT "inventory_stock_lots_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."inventory_stock_lots" ADD CONSTRAINT "inventory_stock_lots_quantity_on_hand_check" CHECK (quantity_on_hand >= 0);

ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."inventory_work_order_documents" ADD CONSTRAINT "inventory_work_order_documents_byte_size_check" CHECK (byte_size > 0 AND byte_size <= 20971520);

ALTER TABLE "public"."inventory_work_order_documents" ADD CONSTRAINT "inventory_work_order_documents_document_type_check" CHECK (document_type = ANY (ARRAY['service_ticket'::text, 'receipt'::text, 'invoice'::text, 'photo'::text, 'warranty'::text, 'inspection'::text, 'other'::text]));

ALTER TABLE "public"."inventory_work_order_documents" ADD CONSTRAINT "inventory_work_order_documents_object_key_key" UNIQUE (object_key);

ALTER TABLE "public"."inventory_work_order_documents" ADD CONSTRAINT "inventory_work_order_documents_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."inventory_work_orders" ADD CONSTRAINT "inventory_work_orders_labor_hours_check" CHECK (labor_hours IS NULL OR labor_hours >= 0::numeric);

ALTER TABLE "public"."inventory_work_orders" ADD CONSTRAINT "inventory_work_orders_next_mileage_check" CHECK (next_service_due_mileage IS NULL OR next_service_due_mileage >= 0);

ALTER TABLE "public"."inventory_work_orders" ADD CONSTRAINT "inventory_work_orders_odometer_check" CHECK (odometer IS NULL OR odometer >= 0);

ALTER TABLE "public"."inventory_work_orders" ADD CONSTRAINT "inventory_work_orders_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."inventory_work_orders" ADD CONSTRAINT "inventory_work_orders_repair_cost_check" CHECK (repair_cost IS NULL OR repair_cost >= 0::numeric);

ALTER TABLE "public"."inventory_work_orders" ADD CONSTRAINT "inventory_work_orders_service_type_check" CHECK (service_type = ANY (ARRAY['inspection'::text, 'preventive'::text, 'repair'::text, 'recall'::text, 'tires'::text, 'fluids'::text, 'electrical'::text, 'body'::text, 'other'::text]));

ALTER TABLE "public"."platform_owners" ADD CONSTRAINT "platform_owners_pkey" PRIMARY KEY (email);

ALTER TABLE "public"."portal_access_emails" ADD CONSTRAINT "portal_access_emails_email_check" CHECK (email = lower(email));

ALTER TABLE "public"."portal_access_emails" ADD CONSTRAINT "portal_access_emails_pkey" PRIMARY KEY (email);

ALTER TABLE "public"."portal_invite_admins" ADD CONSTRAINT "portal_invite_admins_email_check" CHECK (email = lower(email));

ALTER TABLE "public"."portal_invite_admins" ADD CONSTRAINT "portal_invite_admins_pkey" PRIMARY KEY (email);

ALTER TABLE "public"."portal_pin_credentials" ADD CONSTRAINT "portal_pin_credentials_failed_attempts_check" CHECK (failed_attempts >= 0);

ALTER TABLE "public"."portal_pin_credentials" ADD CONSTRAINT "portal_pin_credentials_pkey" PRIMARY KEY (user_id);

ALTER TABLE "public"."push_subscriptions" ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE (endpoint);

ALTER TABLE "public"."push_subscriptions" ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY (id);

ALTER TABLE "public"."user_profiles" ADD CONSTRAINT "user_profiles_handle_format" CHECK (handle ~ '^[a-z0-9_]{3,32}$'::text);

ALTER TABLE "public"."user_profiles" ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY (user_id);

CREATE INDEX background_job_runs_latest ON firehouse.background_job_runs USING btree (job_name, started_at DESC);

CREATE INDEX box_cards_title_idx ON firehouse.box_cards USING btree (title);

CREATE UNIQUE INDEX cad_inbound_provider_dedupe_idx ON firehouse.cad_inbound_receipts USING btree (provider, dedupe_key);

CREATE INDEX cad_inbound_provider_received_idx ON firehouse.cad_inbound_receipts USING btree (provider, received_at);

CREATE INDEX cad_push_pending_idx ON firehouse.cad_push_deliveries USING btree (next_attempt_at, id) WHERE (state = ANY (ARRAY['pending'::text, 'sending'::text, 'retry'::text]));

CREATE INDEX chief_board_attachment_item_idx ON firehouse.chief_board_attachments USING btree (item_id);

CREATE INDEX chief_board_active_date_idx ON firehouse.chief_board_items USING btree (active, event_date);

CREATE INDEX chief_board_officer_idx ON firehouse.chief_board_items USING btree (officer_employee_id);

CREATE UNIQUE INDEX daily_duties_day_shift_idx ON firehouse.daily_duties USING btree (day_of_week, shift_key);

CREATE UNIQUE INDEX log_approval_date_shift_idx ON firehouse.daily_log_approvals USING btree (log_date, shift_key);

CREATE INDEX daily_log_callbacks_reviewer_idx ON firehouse.daily_log_callback_submissions USING btree (reviewer_employee_id, status);

CREATE INDEX daily_log_callbacks_status_idx ON firehouse.daily_log_callback_submissions USING btree (status, submitted_at DESC);

CREATE INDEX log_calls_date_sort_idx ON firehouse.daily_log_calls USING btree (log_date, sort_order);

CREATE INDEX log_staffing_date_shift_idx ON firehouse.daily_log_staffing USING btree (log_date, shift_key, sort_order);

CREATE INDEX dispatch_incidents_active_time_idx ON firehouse.dispatch_incidents USING btree (active, dispatched_at);

CREATE UNIQUE INDEX uq_dispatch_incidents_resend_email_id ON firehouse.dispatch_incidents USING btree (resend_email_id);

CREATE INDEX employee_account_links_employee ON firehouse.employee_account_links USING btree (employee_id);

CREATE UNIQUE INDEX employee_profiles_number_idx ON firehouse.employee_profiles USING btree (employee_number);

CREATE INDEX employees_active_sort_idx ON firehouse.employees USING btree (active, sort_order);

CREATE INDEX field_hydrant_test_hydrant_idx ON firehouse.field_hydrant_flow_tests USING btree (test_hydrant_id, tested_at);

CREATE INDEX field_hydrant_flush_hydrant_idx ON firehouse.field_hydrant_flushes USING btree (hydrant_id, flushed_at);

CREATE INDEX field_hydrant_service_history_idx ON firehouse.field_hydrant_service_events USING btree (hydrant_id, performed_on DESC, created_at DESC);

CREATE INDEX field_hydrant_location_idx ON firehouse.field_hydrants USING btree (latitude, longitude);

CREATE INDEX field_hydrant_number_idx ON firehouse.field_hydrants USING btree (hydrant_number) WHERE (hydrant_number <> ''::text);

CREATE INDEX field_preplan_alert_expiration_idx ON firehouse.field_preplan_alerts USING btree (expires_at) WHERE (archived = 0);

CREATE INDEX field_preplan_alert_level_fk_idx ON firehouse.field_preplan_alerts USING btree (level_id);

CREATE INDEX field_preplan_alert_respond_idx ON firehouse.field_preplan_alerts USING btree (preplan_id, archived, pin_to_respond, severity, display_order);

CREATE INDEX field_preplan_alert_space_fk_idx ON firehouse.field_preplan_alerts USING btree (space_id);

CREATE INDEX field_preplan_annotation_level_fk_idx ON firehouse.field_preplan_annotations USING btree (level_id);

CREATE INDEX field_preplan_annotation_level_idx ON firehouse.field_preplan_annotations USING btree (preplan_id, level_id, archived, sort_order);

CREATE INDEX field_preplan_asset_entity_idx ON firehouse.field_preplan_assets USING btree (preplan_id, level_id, category, archived, sort_order);

CREATE INDEX field_preplan_asset_feature_fk_idx ON firehouse.field_preplan_assets USING btree (feature_id);

CREATE INDEX field_preplan_asset_hazmat_fk_idx ON firehouse.field_preplan_assets USING btree (hazmat_id);

CREATE INDEX field_preplan_asset_level_fk_idx ON firehouse.field_preplan_assets USING btree (level_id);

CREATE INDEX field_preplan_external_plan_idx ON firehouse.field_preplan_external_details USING btree (preplan_id);

CREATE INDEX field_preplan_feature_level_level_fk_idx ON firehouse.field_preplan_feature_levels USING btree (level_id);

CREATE INDEX field_preplan_feature_preplan_idx ON firehouse.field_preplan_features USING btree (preplan_id);

CREATE INDEX field_preplan_feature_primary_level_fk_idx ON firehouse.field_preplan_features USING btree (primary_level_id);

CREATE INDEX field_preplan_hazmat_level_fk_idx ON firehouse.field_preplan_hazmat USING btree (level_id);

CREATE INDEX field_preplan_hazmat_lookup_idx ON firehouse.field_preplan_hazmat USING btree (preplan_id, un_na_number, archived);

CREATE INDEX field_preplan_hazmat_space_fk_idx ON firehouse.field_preplan_hazmat USING btree (space_id);

CREATE INDEX field_preplan_hazmat_zone_hazmat_fk_idx ON firehouse.field_preplan_hazmat_zones USING btree (hazmat_id);

CREATE INDEX field_preplan_hazmat_zone_level_fk_idx ON firehouse.field_preplan_hazmat_zones USING btree (level_id);

CREATE INDEX field_preplan_hazmat_zone_preplan_fk_idx ON firehouse.field_preplan_hazmat_zones USING btree (preplan_id);

CREATE INDEX field_preplan_hose_lay_apparatus_fk_idx ON firehouse.field_preplan_hose_lays USING btree (apparatus_id);

CREATE INDEX field_preplan_hose_lay_destination_feature_fk_idx ON firehouse.field_preplan_hose_lays USING btree (destination_feature_id);

CREATE INDEX field_preplan_hose_lay_level_fk_idx ON firehouse.field_preplan_hose_lays USING btree (level_id);

CREATE INDEX field_preplan_hose_lay_preplan_fk_idx ON firehouse.field_preplan_hose_lays USING btree (preplan_id);

CREATE INDEX field_preplan_hose_lay_source_hydrant_fk_idx ON firehouse.field_preplan_hose_lays USING btree (source_hydrant_id);

CREATE UNIQUE INDEX field_preplan_import_external_id_idx ON firehouse.field_preplan_imports USING btree (source_external_id) WHERE (source_external_id <> ''::text);

CREATE INDEX field_preplan_import_status_idx ON firehouse.field_preplan_imports USING btree (status, business_name);

CREATE UNIQUE INDEX uq_field_preplan_imports_source_file_source_row ON firehouse.field_preplan_imports USING btree (source_file, source_row);

CREATE UNIQUE INDEX field_preplan_default_level_idx ON firehouse.field_preplan_levels USING btree (preplan_id) WHERE ((is_default = 1) AND (archived = 0));

CREATE INDEX field_preplan_level_order_idx ON firehouse.field_preplan_levels USING btree (preplan_id, archived, sort_order);

CREATE INDEX field_observation_plan_idx ON firehouse.field_preplan_observations USING btree (preplan_id, created_at DESC);

CREATE INDEX field_preplan_photo_annotation_asset_fk_idx ON firehouse.field_preplan_photo_annotations USING btree (asset_id);

CREATE INDEX field_preplan_photo_preplan_idx ON firehouse.field_preplan_photos USING btree (preplan_id);

CREATE INDEX field_preplan_review_preplan_fk_idx ON firehouse.field_preplan_reviews USING btree (preplan_id);

CREATE INDEX field_preplan_space_level_fk_idx ON firehouse.field_preplan_spaces USING btree (level_id);

CREATE INDEX field_preplan_space_level_idx ON firehouse.field_preplan_spaces USING btree (preplan_id, level_id, archived);

CREATE INDEX field_preplan_location_idx ON firehouse.field_preplans USING btree (latitude, longitude);

CREATE INDEX fire_inspection_backup_jobs_department_state ON firehouse.fire_inspection_backup_jobs USING btree (department_id, kind, state);

CREATE INDEX fire_inspection_backup_jobs_department_updated ON firehouse.fire_inspection_backup_jobs USING btree (department_id, updated_at DESC, id);

CREATE INDEX inspection_code_department ON firehouse.fire_inspection_code_entries USING btree (department_id, updated_at DESC);

CREATE INDEX inspection_email_department ON firehouse.fire_inspection_email_deliveries USING btree (department_id, record_id, created_at DESC);

CREATE INDEX fire_inspection_pilot_audit_department ON firehouse.fire_inspection_pilot_audit USING btree (department_id, record_id, version DESC);

CREATE INDEX fire_inspection_pilot_files_department ON firehouse.fire_inspection_pilot_files USING btree (department_id, record_id);

CREATE INDEX fire_inspection_pilot_files_record ON firehouse.fire_inspection_pilot_files USING btree (record_id);

CREATE INDEX inspection_files_code ON firehouse.fire_inspection_pilot_files USING btree (code_id);

CREATE INDEX fire_inspection_pilot_records_department ON firehouse.fire_inspection_pilot_records USING btree (department_id, updated_at DESC);

CREATE UNIQUE INDEX fire_inspection_staff_user_binding ON firehouse.fire_inspection_staff_members USING btree (department_id, user_id) WHERE (user_id IS NOT NULL);

CREATE UNIQUE INDEX uq_fleet_apparatus_unit_number ON firehouse.fleet_apparatus USING btree (unit_number);

CREATE INDEX important_phone_category_sort_idx ON firehouse.important_phone_numbers USING btree (category, sort_order);

CREATE UNIQUE INDEX incident_command_event_revision_idx ON firehouse.incident_command_events USING btree (incident_id, revision);

CREATE INDEX incident_command_events_incident_time_idx ON firehouse.incident_command_events USING btree (incident_id, created_at);

CREATE INDEX inventory_compartments_apparatus_idx ON firehouse.inventory_compartments USING btree (apparatus_id, sort_order);

CREATE INDEX inventory_equipment_apparatus_idx ON firehouse.inventory_equipment USING btree (apparatus_id, compartment_id);

CREATE UNIQUE INDEX inventory_photos_current_idx ON firehouse.inventory_photos USING btree (apparatus_id, COALESCE(compartment_id, ''::text), COALESCE(equipment_id, ''::text), photo_type);

CREATE UNIQUE INDEX uq_inventory_weekly_check_results_check_id_item_id ON firehouse.inventory_weekly_check_results USING btree (check_id, item_id);

CREATE INDEX neris_pilot_audit_department ON firehouse.neris_pilot_audit USING btree (department_id, record_id, version DESC);

CREATE INDEX neris_pilot_files_department ON firehouse.neris_pilot_files USING btree (department_id, record_id);

CREATE INDEX neris_pilot_files_record ON firehouse.neris_pilot_files USING btree (record_id);

CREATE INDEX neris_pilot_records_department ON firehouse.neris_pilot_records USING btree (department_id, updated_at DESC);

CREATE INDEX operational_view_leases_department_idx ON firehouse.operational_view_leases USING btree (department_id);

CREATE INDEX pay_rate_history_effective_idx ON firehouse.pay_rate_history USING btree (effective_date);

CREATE UNIQUE INDEX pay_rate_history_scale_date_idx ON firehouse.pay_rate_history USING btree (pay_scale_id, effective_date);

CREATE INDEX payroll_adjustments_target_idx ON firehouse.payroll_adjustments USING btree (target_period);

CREATE INDEX policies_title_idx ON firehouse.policies USING btree (title);

CREATE INDEX portal_login_audit_department_time_idx ON firehouse.portal_login_audit USING btree (department_id, occurred_at DESC);

CREATE INDEX push_subscriptions_active_department_idx ON firehouse.push_subscriptions USING btree (department_id, active);

CREATE INDEX push_subscriptions_user_idx ON firehouse.push_subscriptions USING btree (user_id, active);

CREATE UNIQUE INDEX record_revision_number_idx ON firehouse.record_revisions USING btree (record_type, record_id, revision_number);

CREATE INDEX road_closures_status_started_idx ON firehouse.road_closures USING btree (status, started_at DESC);

CREATE INDEX safety_attachments_inspection_idx ON firehouse.safety_inspection_attachments USING btree (inspection_id, created_at);

CREATE INDEX safety_results_inspection_status_idx ON firehouse.safety_inspection_results USING btree (inspection_id, result_status);

CREATE INDEX safety_results_template_item_idx ON firehouse.safety_inspection_results USING btree (template_item_id);

CREATE INDEX safety_template_items_order_idx ON firehouse.safety_inspection_template_items USING btree (template_id, active, sort_order);

CREATE INDEX safety_inspections_inspector_idx ON firehouse.safety_inspections USING btree (inspector_employee_id);

CREATE INDEX safety_inspections_status_date_idx ON firehouse.safety_inspections USING btree (status, inspection_date DESC);

CREATE INDEX safety_inspections_template_date_idx ON firehouse.safety_inspections USING btree (template_id, inspection_date DESC);

CREATE INDEX schedule_assignment_date_idx ON firehouse.schedule_assignments USING btree (work_date);

CREATE UNIQUE INDEX schedule_assignment_unique_idx ON firehouse.schedule_assignments USING btree (employee_id, work_date, start_time, role);

CREATE INDEX schedule_coverage_rule_active_idx ON firehouse.schedule_coverage_rules USING btree (active, role);

CREATE INDEX schedule_notification_employee_idx ON firehouse.schedule_notifications USING btree (employee_id, created_at);

CREATE INDEX schedule_request_status_idx ON firehouse.schedule_requests USING btree (status, created_at);

CREATE UNIQUE INDEX uq_schedule_rotation_members_rotation_id_employee_id ON firehouse.schedule_rotation_members USING btree (rotation_id, employee_id);

CREATE INDEX schedule_shift_pattern_active_idx ON firehouse.schedule_shift_patterns USING btree (active, start_date);

CREATE INDEX schedule_staffing_override_pattern_idx ON firehouse.schedule_staffing_overrides USING btree (pattern_id, active);

CREATE INDEX scheduler_push_pending_idx ON firehouse.scheduler_push_deliveries USING btree (next_attempt_at, id) WHERE (state = ANY (ARRAY['pending'::text, 'sending'::text, 'retry'::text]));

CREATE INDEX station_availability_date_idx ON firehouse.station_availability USING btree (availability_date, status);

CREATE INDEX station_ot_offer_employee_idx ON firehouse.station_ot_offers USING btree (employee_id, status);

CREATE INDEX station_ot_offer_slot_idx ON firehouse.station_ot_offers USING btree (slot_id, rank);

CREATE INDEX scheduler_reminder_entry_date_idx ON firehouse.station_schedule_entries USING btree (entry_date, id);

CREATE INDEX station_schedule_entry_date_idx ON firehouse.station_schedule_entries USING btree (entry_date);

CREATE INDEX scheduler_reminder_claim_slot_idx ON firehouse.station_shift_claims USING btree (slot_id, status);

CREATE INDEX station_shift_claim_slot_idx ON firehouse.station_shift_claims USING btree (slot_id);

CREATE INDEX station_shift_claim_status_idx ON firehouse.station_shift_claims USING btree (status, created_at);

CREATE INDEX scheduler_reminder_deadline_idx ON firehouse.station_shift_slots USING btree (request_deadline) WHERE (request_deadline <> ''::text);

CREATE INDEX station_shift_slot_employee_idx ON firehouse.station_shift_slots USING btree (employee_id);

CREATE INDEX station_shift_slot_entry_idx ON firehouse.station_shift_slots USING btree (entry_id, sort_order);

CREATE INDEX station_shift_types_active_idx ON firehouse.station_shift_types USING btree (active, sort_order);

CREATE INDEX station_time_off_status_idx ON firehouse.station_time_off_requests USING btree (status, created_at);

CREATE INDEX station_trade_status_idx ON firehouse.station_trade_requests USING btree (status, created_at);

CREATE UNIQUE INDEX entry_employee_date_category_idx ON firehouse.time_entries USING btree (employee_id, work_date, category);

CREATE INDEX entry_period_employee_idx ON firehouse.time_entries USING btree (period_start, employee_id);

CREATE INDEX training_pilot_audit_department ON firehouse.training_pilot_audit USING btree (department_id, record_id, version DESC);

CREATE INDEX training_pilot_files_department ON firehouse.training_pilot_files USING btree (department_id, record_id);

CREATE INDEX training_pilot_files_record ON firehouse.training_pilot_files USING btree (record_id);

CREATE INDEX training_pilot_records_department ON firehouse.training_pilot_records USING btree (department_id, updated_at DESC);

CREATE UNIQUE INDEX training_report_views_active_slot ON firehouse.training_report_views USING btree (department_id, owner_email, slot) WHERE (archived = 0);

CREATE UNIQUE INDEX uq_work_detail_members_request_id_employee_id ON firehouse.work_detail_members USING btree (request_id, employee_id);

CREATE UNIQUE INDEX uq_work_detail_postings_request_id_employee_id ON firehouse.work_detail_postings USING btree (request_id, employee_id);

CREATE INDEX work_detail_status_date_idx ON firehouse.work_detail_requests USING btree (status, work_date);

CREATE INDEX portal_remembered_devices_department_idx ON private.portal_remembered_devices USING btree (department_id);

CREATE INDEX portal_remembered_devices_session_idx ON private.portal_remembered_devices USING btree (session_id);

CREATE INDEX portal_remembered_devices_user_created_idx ON private.portal_remembered_devices USING btree (user_id, created_at DESC);

CREATE INDEX department_apparatus_created_by_idx ON public.department_apparatus USING btree (created_by);

CREATE INDEX department_apparatus_department_station_idx ON public.department_apparatus USING btree (department_id, station);

CREATE UNIQUE INDEX department_apparatus_department_unit_key ON public.department_apparatus USING btree (department_id, lower(unit_name));

CREATE INDEX department_apparatus_updated_by_idx ON public.department_apparatus USING btree (updated_by);

CREATE INDEX departments_account_status_idx ON public.departments USING btree (account_status);

CREATE INDEX disciplinary_files_department_report ON public.disciplinary_report_files USING btree (department_id, report_id);

CREATE INDEX disciplinary_versions_department_report ON public.disciplinary_report_versions USING btree (department_id, report_id, version DESC);

CREATE INDEX disciplinary_report_source_history ON public.disciplinary_reports USING btree (department_id, source_at DESC, updated_at DESC, id DESC);

CREATE UNIQUE INDEX disciplinary_report_source_unique ON public.disciplinary_reports USING btree (department_id, source_id) WHERE (source_id IS NOT NULL);

CREATE INDEX disciplinary_reports_department_updated ON public.disciplinary_reports USING btree (department_id, updated_at DESC, id DESC);

CREATE INDEX inventory_profiles_department_idx ON public.inventory_apparatus_profiles USING btree (department_id);

CREATE INDEX inventory_audit_department_idx ON public.inventory_audit_events USING btree (department_id, created_at DESC);

CREATE INDEX inventory_check_archives_department_idx ON public.inventory_check_archives USING btree (department_id);

CREATE INDEX inventory_check_items_check_idx ON public.inventory_check_items USING btree (department_id, check_id);

CREATE INDEX inventory_checks_apparatus_idx ON public.inventory_checks USING btree (department_id, apparatus_id, started_at DESC);

CREATE INDEX inventory_checks_history_page_idx ON public.inventory_checks USING btree (department_id, started_at DESC, id DESC) WHERE (status = 'completed'::text);

CREATE UNIQUE INDEX inventory_checks_one_active_type_idx ON public.inventory_checks USING btree (department_id, apparatus_id, check_type) WHERE (status = 'in_progress'::text);

CREATE INDEX inventory_checks_recent_completed_idx ON public.inventory_checks USING btree (department_id, completed_at DESC) WHERE (status = 'completed'::text);

CREATE INDEX inventory_checks_review_queue_idx ON public.inventory_checks USING btree (department_id, review_status, completed_at DESC) WHERE (status = 'completed'::text);

CREATE INDEX inventory_compartments_apparatus_idx ON public.inventory_compartments USING btree (department_id, apparatus_id, sort_order);

CREATE INDEX inventory_deficiency_photos_apparatus_fk_idx ON public.inventory_deficiency_photos USING btree (apparatus_id);

CREATE INDEX inventory_deficiency_photos_apparatus_idx ON public.inventory_deficiency_photos USING btree (department_id, apparatus_id, captured_at DESC);

CREATE INDEX inventory_deficiency_photos_check_item_fk_idx ON public.inventory_deficiency_photos USING btree (check_item_id);

CREATE UNIQUE INDEX inventory_air_asset_number ON public.inventory_equipment USING btree (department_id, lower(btrim(asset_number))) WHERE (scba_asset_kind IS NOT NULL);

CREATE UNIQUE INDEX inventory_air_check_slot ON public.inventory_equipment USING btree (department_id, apparatus_id, scba_check_slot) WHERE ((scba_asset_kind IS NOT NULL) AND (retired_at IS NULL) AND (scba_check_slot IS NOT NULL));

CREATE INDEX inventory_air_location ON public.inventory_equipment USING btree (department_id, apparatus_id) WHERE ((scba_asset_kind IS NOT NULL) AND (retired_at IS NULL));

CREATE INDEX inventory_equipment_active_checklist_idx ON public.inventory_equipment USING btree (department_id, apparatus_id, compartment_id, item_order) WHERE (retired_at IS NULL);

CREATE INDEX inventory_equipment_apparatus_idx ON public.inventory_equipment USING btree (department_id, apparatus_id, compartment_id);

CREATE INDEX inventory_equipment_check_types_idx ON public.inventory_equipment USING gin (check_types);

CREATE INDEX inventory_equipment_lifecycle_idx ON public.inventory_equipment USING btree (department_id, service_status, expiration_date) WHERE (retired_at IS NULL);

CREATE INDEX inventory_equipment_parent_idx ON public.inventory_equipment USING btree (department_id, parent_equipment_id) WHERE ((parent_equipment_id IS NOT NULL) AND (retired_at IS NULL));

CREATE UNIQUE INDEX inventory_equipment_source_key_idx ON public.inventory_equipment USING btree (department_id, apparatus_id, source_key) WHERE (source_key IS NOT NULL);

CREATE INDEX inventory_inspection_schedules_apparatus_fk_idx ON public.inventory_inspection_schedules USING btree (apparatus_id);

CREATE INDEX inventory_inspection_schedules_apparatus_idx ON public.inventory_inspection_schedules USING btree (department_id, apparatus_id);

CREATE INDEX inventory_inspection_schedules_due_idx ON public.inventory_inspection_schedules USING btree (department_id, day_of_week, active, start_time, end_time);

CREATE INDEX inventory_location_change_check_item_idx ON public.inventory_location_change_requests USING btree (department_id, check_item_id) WHERE (check_item_id IS NOT NULL);

CREATE UNIQUE INDEX inventory_location_change_one_pending_per_equipment_idx ON public.inventory_location_change_requests USING btree (department_id, equipment_id) WHERE (status = 'pending'::text);

CREATE INDEX inventory_location_change_review_queue_idx ON public.inventory_location_change_requests USING btree (department_id, status, requested_at DESC);

CREATE INDEX inventory_operation_receipts_actor_idx ON public.inventory_operation_receipts USING btree (actor_id, created_at DESC);

CREATE INDEX inventory_hotspots_photo_idx ON public.inventory_photo_hotspots USING btree (department_id, photo_view_id, display_order);

CREATE INDEX inventory_photo_views_apparatus_idx ON public.inventory_photo_views USING btree (department_id, apparatus_id, view_key, door_state, version_number DESC);

CREATE INDEX inventory_exceptions_assignees_idx ON public.inventory_readiness_exceptions USING gin (assigned_employee_ids);

CREATE INDEX inventory_exceptions_evidence_photo_fk_idx ON public.inventory_readiness_exceptions USING btree (evidence_photo_id);

CREATE INDEX inventory_exceptions_open_idx ON public.inventory_readiness_exceptions USING btree (department_id, status, opened_at DESC);

CREATE INDEX inventory_air_entry_history ON public.inventory_scba_check_entries USING btree (department_id, equipment_id) WHERE (equipment_id IS NOT NULL);

CREATE INDEX inventory_scba_check_entries_check_idx ON public.inventory_scba_check_entries USING btree (department_id, check_id, sort_order);

CREATE INDEX inventory_scba_templates_department_idx ON public.inventory_scba_templates USING btree (department_id, apparatus_id);

CREATE INDEX inventory_stock_items_department_idx ON public.inventory_stock_items USING btree (department_id, name);

CREATE INDEX inventory_stock_lots_item_idx ON public.inventory_stock_lots USING btree (department_id, stock_item_id);

CREATE INDEX inventory_transactions_item_idx ON public.inventory_transactions USING btree (department_id, stock_item_id, performed_at DESC);

CREATE INDEX inventory_work_order_documents_apparatus_fk_idx ON public.inventory_work_order_documents USING btree (apparatus_id);

CREATE INDEX inventory_work_order_documents_apparatus_idx ON public.inventory_work_order_documents USING btree (department_id, apparatus_id);

CREATE INDEX inventory_work_order_documents_history_idx ON public.inventory_work_order_documents USING btree (department_id, apparatus_id, uploaded_at DESC);

CREATE INDEX inventory_work_order_documents_order_idx ON public.inventory_work_order_documents USING btree (work_order_id, uploaded_at DESC);

CREATE INDEX inventory_work_orders_assignees_idx ON public.inventory_work_orders USING gin (assigned_employee_ids);

CREATE INDEX inventory_work_orders_exception_idx ON public.inventory_work_orders USING btree (department_id, linked_exception_id);

CREATE INDEX inventory_work_orders_linked_exception_fk_idx ON public.inventory_work_orders USING btree (linked_exception_id);

CREATE INDEX inventory_work_orders_open_idx ON public.inventory_work_orders USING btree (department_id, status, opened_at DESC);

CREATE INDEX push_subscriptions_department_idx ON public.push_subscriptions USING btree (department_id);

CREATE INDEX push_subscriptions_enabled_idx ON public.push_subscriptions USING btree (department_id, enabled);

CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions USING btree (user_id);

CREATE UNIQUE INDEX user_profiles_handle_unique ON public.user_profiles USING btree (lower(handle));

ALTER TABLE "firehouse"."apparatus_location_view_leases" ADD CONSTRAINT "apparatus_location_view_leases_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id);

ALTER TABLE "firehouse"."apparatus_location_view_leases" ADD CONSTRAINT "apparatus_location_view_leases_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."apparatus_trackers" ADD CONSTRAINT "apparatus_trackers_apparatus_id_fkey" FOREIGN KEY (apparatus_id) REFERENCES firehouse.fleet_apparatus(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."apparatus_trackers" ADD CONSTRAINT "apparatus_trackers_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id);

ALTER TABLE "firehouse"."cad_push_deliveries" ADD CONSTRAINT "cad_push_deliveries_event_id_fkey" FOREIGN KEY (event_id) REFERENCES firehouse.cad_push_events(id);

ALTER TABLE "firehouse"."callback_payroll_aggregates" ADD CONSTRAINT "callback_payroll_aggregates_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES firehouse.employees(id);

ALTER TABLE "firehouse"."callback_review_settings" ADD CONSTRAINT "callback_review_settings_reviewer_employee_id_fkey" FOREIGN KEY (reviewer_employee_id) REFERENCES firehouse.employees(id);

ALTER TABLE "firehouse"."chief_board_items" ADD CONSTRAINT "chief_board_items_officer_employee_id_fkey" FOREIGN KEY (officer_employee_id) REFERENCES firehouse.employees(id);

ALTER TABLE "firehouse"."daily_log_callback_submissions" ADD CONSTRAINT "daily_log_callback_submissions_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES firehouse.employees(id);

ALTER TABLE "firehouse"."daily_log_callback_submissions" ADD CONSTRAINT "daily_log_callback_submissions_log_date_fkey" FOREIGN KEY (log_date) REFERENCES firehouse.daily_logs(log_date);

ALTER TABLE "firehouse"."daily_log_callback_submissions" ADD CONSTRAINT "daily_log_callback_submissions_reviewer_employee_id_fkey" FOREIGN KEY (reviewer_employee_id) REFERENCES firehouse.employees(id);

ALTER TABLE "firehouse"."daily_log_callback_submissions" ADD CONSTRAINT "daily_log_callback_submissions_submitted_by_employee_id_fkey" FOREIGN KEY (submitted_by_employee_id) REFERENCES firehouse.employees(id);

ALTER TABLE "firehouse"."employee_account_links" ADD CONSTRAINT "employee_account_links_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES firehouse.employees(id);

ALTER TABLE "firehouse"."employee_account_links" ADD CONSTRAINT "employee_account_links_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE "firehouse"."field_hydrant_service_events" ADD CONSTRAINT "field_hydrant_service_events_hydrant_id_fkey" FOREIGN KEY (hydrant_id) REFERENCES firehouse.field_hydrants(id);

ALTER TABLE "firehouse"."field_preplan_alerts" ADD CONSTRAINT "field_preplan_alerts_level_id_fkey" FOREIGN KEY (level_id) REFERENCES firehouse.field_preplan_levels(id) ON DELETE SET NULL;

ALTER TABLE "firehouse"."field_preplan_alerts" ADD CONSTRAINT "field_preplan_alerts_preplan_id_fkey" FOREIGN KEY (preplan_id) REFERENCES firehouse.field_preplans(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."field_preplan_alerts" ADD CONSTRAINT "field_preplan_alerts_space_id_fkey" FOREIGN KEY (space_id) REFERENCES firehouse.field_preplan_spaces(id) ON DELETE SET NULL;

ALTER TABLE "firehouse"."field_preplan_annotations" ADD CONSTRAINT "field_preplan_annotations_level_id_fkey" FOREIGN KEY (level_id) REFERENCES firehouse.field_preplan_levels(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."field_preplan_annotations" ADD CONSTRAINT "field_preplan_annotations_preplan_id_fkey" FOREIGN KEY (preplan_id) REFERENCES firehouse.field_preplans(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."field_preplan_assets" ADD CONSTRAINT "field_preplan_assets_feature_id_fkey" FOREIGN KEY (feature_id) REFERENCES firehouse.field_preplan_features(id) ON DELETE SET NULL;

ALTER TABLE "firehouse"."field_preplan_assets" ADD CONSTRAINT "field_preplan_assets_hazmat_id_fkey" FOREIGN KEY (hazmat_id) REFERENCES firehouse.field_preplan_hazmat(id) ON DELETE SET NULL;

ALTER TABLE "firehouse"."field_preplan_assets" ADD CONSTRAINT "field_preplan_assets_level_id_fkey" FOREIGN KEY (level_id) REFERENCES firehouse.field_preplan_levels(id) ON DELETE SET NULL;

ALTER TABLE "firehouse"."field_preplan_assets" ADD CONSTRAINT "field_preplan_assets_preplan_id_fkey" FOREIGN KEY (preplan_id) REFERENCES firehouse.field_preplans(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."field_preplan_external_details" ADD CONSTRAINT "field_preplan_external_details_preplan_id_fkey" FOREIGN KEY (preplan_id) REFERENCES firehouse.field_preplans(id);

ALTER TABLE "firehouse"."field_preplan_feature_levels" ADD CONSTRAINT "field_preplan_feature_levels_feature_id_fkey" FOREIGN KEY (feature_id) REFERENCES firehouse.field_preplan_features(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."field_preplan_feature_levels" ADD CONSTRAINT "field_preplan_feature_levels_level_id_fkey" FOREIGN KEY (level_id) REFERENCES firehouse.field_preplan_levels(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."field_preplan_features" ADD CONSTRAINT "field_preplan_features_primary_level_id_fkey" FOREIGN KEY (primary_level_id) REFERENCES firehouse.field_preplan_levels(id);

ALTER TABLE "firehouse"."field_preplan_hazmat" ADD CONSTRAINT "field_preplan_hazmat_level_id_fkey" FOREIGN KEY (level_id) REFERENCES firehouse.field_preplan_levels(id) ON DELETE SET NULL;

ALTER TABLE "firehouse"."field_preplan_hazmat" ADD CONSTRAINT "field_preplan_hazmat_preplan_id_fkey" FOREIGN KEY (preplan_id) REFERENCES firehouse.field_preplans(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."field_preplan_hazmat" ADD CONSTRAINT "field_preplan_hazmat_space_id_fkey" FOREIGN KEY (space_id) REFERENCES firehouse.field_preplan_spaces(id) ON DELETE SET NULL;

ALTER TABLE "firehouse"."field_preplan_hazmat_zones" ADD CONSTRAINT "field_preplan_hazmat_zones_hazmat_id_fkey" FOREIGN KEY (hazmat_id) REFERENCES firehouse.field_preplan_hazmat(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."field_preplan_hazmat_zones" ADD CONSTRAINT "field_preplan_hazmat_zones_level_id_fkey" FOREIGN KEY (level_id) REFERENCES firehouse.field_preplan_levels(id) ON DELETE SET NULL;

ALTER TABLE "firehouse"."field_preplan_hazmat_zones" ADD CONSTRAINT "field_preplan_hazmat_zones_preplan_id_fkey" FOREIGN KEY (preplan_id) REFERENCES firehouse.field_preplans(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."field_preplan_hose_lays" ADD CONSTRAINT "field_preplan_hose_lays_apparatus_id_fkey" FOREIGN KEY (apparatus_id) REFERENCES firehouse.fleet_apparatus(id) ON DELETE SET NULL;

ALTER TABLE "firehouse"."field_preplan_hose_lays" ADD CONSTRAINT "field_preplan_hose_lays_destination_feature_id_fkey" FOREIGN KEY (destination_feature_id) REFERENCES firehouse.field_preplan_features(id) ON DELETE SET NULL;

ALTER TABLE "firehouse"."field_preplan_hose_lays" ADD CONSTRAINT "field_preplan_hose_lays_level_id_fkey" FOREIGN KEY (level_id) REFERENCES firehouse.field_preplan_levels(id) ON DELETE SET NULL;

ALTER TABLE "firehouse"."field_preplan_hose_lays" ADD CONSTRAINT "field_preplan_hose_lays_preplan_id_fkey" FOREIGN KEY (preplan_id) REFERENCES firehouse.field_preplans(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."field_preplan_hose_lays" ADD CONSTRAINT "field_preplan_hose_lays_source_hydrant_id_fkey" FOREIGN KEY (source_hydrant_id) REFERENCES firehouse.field_hydrants(id) ON DELETE SET NULL;

ALTER TABLE "firehouse"."field_preplan_levels" ADD CONSTRAINT "field_preplan_levels_preplan_id_fkey" FOREIGN KEY (preplan_id) REFERENCES firehouse.field_preplans(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."field_preplan_observations" ADD CONSTRAINT "field_preplan_observations_preplan_id_fkey" FOREIGN KEY (preplan_id) REFERENCES firehouse.field_preplans(id);

ALTER TABLE "firehouse"."field_preplan_photo_annotations" ADD CONSTRAINT "field_preplan_photo_annotations_asset_id_fkey" FOREIGN KEY (asset_id) REFERENCES firehouse.field_preplan_assets(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."field_preplan_reviews" ADD CONSTRAINT "field_preplan_reviews_preplan_id_fkey" FOREIGN KEY (preplan_id) REFERENCES firehouse.field_preplans(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."field_preplan_revisions" ADD CONSTRAINT "field_preplan_revisions_preplan_id_fkey" FOREIGN KEY (preplan_id) REFERENCES firehouse.field_preplans(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."field_preplan_risk_factors" ADD CONSTRAINT "field_preplan_risk_factors_preplan_id_fkey" FOREIGN KEY (preplan_id) REFERENCES firehouse.field_preplans(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."field_preplan_spaces" ADD CONSTRAINT "field_preplan_spaces_level_id_fkey" FOREIGN KEY (level_id) REFERENCES firehouse.field_preplan_levels(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."field_preplan_spaces" ADD CONSTRAINT "field_preplan_spaces_preplan_id_fkey" FOREIGN KEY (preplan_id) REFERENCES firehouse.field_preplans(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."fire_inspection_backup_entries" ADD CONSTRAINT "fire_inspection_backup_entries_department_id_job_id_fkey" FOREIGN KEY (department_id, job_id) REFERENCES firehouse.fire_inspection_backup_jobs(department_id, id);

ALTER TABLE "firehouse"."fire_inspection_backup_rows" ADD CONSTRAINT "fire_inspection_backup_rows_department_id_job_id_fkey" FOREIGN KEY (department_id, job_id) REFERENCES firehouse.fire_inspection_backup_jobs(department_id, id);

ALTER TABLE "firehouse"."fire_inspection_code_audit" ADD CONSTRAINT "fire_inspection_code_audit_code_id_fkey" FOREIGN KEY (code_id) REFERENCES firehouse.fire_inspection_code_entries(id);

ALTER TABLE "firehouse"."fire_inspection_email_deliveries" ADD CONSTRAINT "fire_inspection_email_deliveries_record_id_fkey" FOREIGN KEY (record_id) REFERENCES firehouse.fire_inspection_pilot_records(id);

ALTER TABLE "firehouse"."fire_inspection_pilot_audit" ADD CONSTRAINT "fire_inspection_pilot_audit_record_id_fkey" FOREIGN KEY (record_id) REFERENCES firehouse.fire_inspection_pilot_records(id);

ALTER TABLE "firehouse"."fire_inspection_pilot_files" ADD CONSTRAINT "fire_inspection_pilot_files_code_id_fkey" FOREIGN KEY (code_id) REFERENCES firehouse.fire_inspection_code_entries(id);

ALTER TABLE "firehouse"."fire_inspection_pilot_files" ADD CONSTRAINT "fire_inspection_pilot_files_record_id_fkey" FOREIGN KEY (record_id) REFERENCES firehouse.fire_inspection_pilot_records(id);

ALTER TABLE "firehouse"."fire_inspection_staff_members" ADD CONSTRAINT "fire_inspection_staff_members_department_id_fkey" FOREIGN KEY (department_id) REFERENCES firehouse.fire_inspection_staff_workspaces(department_id);

ALTER TABLE "firehouse"."neris_pilot_audit" ADD CONSTRAINT "neris_pilot_audit_record_id_fkey" FOREIGN KEY (record_id) REFERENCES firehouse.neris_pilot_records(id);

ALTER TABLE "firehouse"."neris_pilot_files" ADD CONSTRAINT "neris_pilot_files_record_id_fkey" FOREIGN KEY (record_id) REFERENCES firehouse.neris_pilot_records(id);

ALTER TABLE "firehouse"."operational_cad_recovery" ADD CONSTRAINT "operational_cad_recovery_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id);

ALTER TABLE "firehouse"."operational_program_audit" ADD CONSTRAINT "operational_program_audit_department_id_record_id_fkey" FOREIGN KEY (department_id, record_id) REFERENCES firehouse.operational_program_records(department_id, id) ON DELETE RESTRICT;

ALTER TABLE "firehouse"."operational_revisions" ADD CONSTRAINT "operational_revisions_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id);

ALTER TABLE "firehouse"."operational_view_leases" ADD CONSTRAINT "operational_view_leases_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id);

ALTER TABLE "firehouse"."operational_view_leases" ADD CONSTRAINT "operational_view_leases_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES firehouse.employees(id);

ALTER TABLE "firehouse"."payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_source_period_fkey" FOREIGN KEY (source_period) REFERENCES firehouse.payroll_submissions(period_start);

ALTER TABLE "firehouse"."payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_target_period_fkey" FOREIGN KEY (target_period) REFERENCES firehouse.pay_periods(start_date);

ALTER TABLE "firehouse"."payroll_submissions" ADD CONSTRAINT "payroll_submissions_period_start_fkey" FOREIGN KEY (period_start) REFERENCES firehouse.pay_periods(start_date);

ALTER TABLE "firehouse"."portal_confirmation_receipts" ADD CONSTRAINT "portal_confirmation_receipts_message_id_fkey" FOREIGN KEY (message_id) REFERENCES firehouse.portal_confirmation_messages(id);

ALTER TABLE "firehouse"."portal_confirmation_setting" ADD CONSTRAINT "portal_confirmation_setting_message_id_fkey" FOREIGN KEY (message_id) REFERENCES firehouse.portal_confirmation_messages(id);

ALTER TABLE "firehouse"."portal_login_audit" ADD CONSTRAINT "portal_login_audit_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."safety_inspection_attachments" ADD CONSTRAINT "safety_inspection_attachments_inspection_id_fkey" FOREIGN KEY (inspection_id) REFERENCES firehouse.safety_inspections(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."safety_inspection_results" ADD CONSTRAINT "safety_inspection_results_inspection_id_fkey" FOREIGN KEY (inspection_id) REFERENCES firehouse.safety_inspections(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."safety_inspection_results" ADD CONSTRAINT "safety_inspection_results_template_item_id_fkey" FOREIGN KEY (template_item_id) REFERENCES firehouse.safety_inspection_template_items(id);

ALTER TABLE "firehouse"."safety_inspection_template_items" ADD CONSTRAINT "safety_inspection_template_items_template_id_fkey" FOREIGN KEY (template_id) REFERENCES firehouse.safety_inspection_templates(id) ON DELETE CASCADE;

ALTER TABLE "firehouse"."safety_inspections" ADD CONSTRAINT "safety_inspections_inspector_employee_id_fkey" FOREIGN KEY (inspector_employee_id) REFERENCES firehouse.employees(id);

ALTER TABLE "firehouse"."safety_inspections" ADD CONSTRAINT "safety_inspections_template_id_fkey" FOREIGN KEY (template_id) REFERENCES firehouse.safety_inspection_templates(id);

ALTER TABLE "firehouse"."scheduler_push_deliveries" ADD CONSTRAINT "scheduler_push_deliveries_event_id_fkey" FOREIGN KEY (event_id) REFERENCES firehouse.scheduler_push_events(id);

ALTER TABLE "firehouse"."station_availability" ADD CONSTRAINT "station_availability_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES firehouse.employees(id);

ALTER TABLE "firehouse"."station_ot_interest" ADD CONSTRAINT "station_ot_interest_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES firehouse.employees(id);

ALTER TABLE "firehouse"."station_ot_interest" ADD CONSTRAINT "station_ot_interest_slot_id_fkey" FOREIGN KEY (slot_id) REFERENCES firehouse.station_shift_slots(id);

ALTER TABLE "firehouse"."station_ot_offers" ADD CONSTRAINT "station_ot_offers_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES firehouse.employees(id);

ALTER TABLE "firehouse"."station_ot_offers" ADD CONSTRAINT "station_ot_offers_slot_id_fkey" FOREIGN KEY (slot_id) REFERENCES firehouse.station_shift_slots(id);

ALTER TABLE "firehouse"."station_schedule_entries" ADD CONSTRAINT "station_schedule_entries_shift_type_id_fkey" FOREIGN KEY (shift_type_id) REFERENCES firehouse.station_shift_types(id);

ALTER TABLE "firehouse"."station_shift_claims" ADD CONSTRAINT "station_shift_claims_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES firehouse.employees(id);

ALTER TABLE "firehouse"."station_shift_claims" ADD CONSTRAINT "station_shift_claims_slot_id_fkey" FOREIGN KEY (slot_id) REFERENCES firehouse.station_shift_slots(id);

ALTER TABLE "firehouse"."station_shift_slots" ADD CONSTRAINT "station_shift_slots_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES firehouse.employees(id);

ALTER TABLE "firehouse"."station_shift_slots" ADD CONSTRAINT "station_shift_slots_entry_id_fkey" FOREIGN KEY (entry_id) REFERENCES firehouse.station_schedule_entries(id);

ALTER TABLE "firehouse"."station_shift_type_roles" ADD CONSTRAINT "station_shift_type_roles_shift_type_id_fkey" FOREIGN KEY (shift_type_id) REFERENCES firehouse.station_shift_types(id);

ALTER TABLE "firehouse"."station_standing_assignments" ADD CONSTRAINT "station_standing_assignments_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES firehouse.employees(id);

ALTER TABLE "firehouse"."station_standing_assignments" ADD CONSTRAINT "station_standing_assignments_shift_type_id_fkey" FOREIGN KEY (shift_type_id) REFERENCES firehouse.station_shift_types(id);

ALTER TABLE "firehouse"."station_time_off_dates" ADD CONSTRAINT "station_time_off_dates_request_id_fkey" FOREIGN KEY (request_id) REFERENCES firehouse.station_time_off_requests(id);

ALTER TABLE "firehouse"."station_time_off_requests" ADD CONSTRAINT "station_time_off_requests_approver_employee_id_fkey" FOREIGN KEY (approver_employee_id) REFERENCES firehouse.employees(id);

ALTER TABLE "firehouse"."station_time_off_requests" ADD CONSTRAINT "station_time_off_requests_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES firehouse.employees(id);

ALTER TABLE "firehouse"."station_trade_requests" ADD CONSTRAINT "station_trade_requests_accepted_by_employee_id_fkey" FOREIGN KEY (accepted_by_employee_id) REFERENCES firehouse.employees(id);

ALTER TABLE "firehouse"."station_trade_requests" ADD CONSTRAINT "station_trade_requests_from_employee_id_fkey" FOREIGN KEY (from_employee_id) REFERENCES firehouse.employees(id);

ALTER TABLE "firehouse"."station_trade_requests" ADD CONSTRAINT "station_trade_requests_return_slot_id_fkey" FOREIGN KEY (return_slot_id) REFERENCES firehouse.station_shift_slots(id);

ALTER TABLE "firehouse"."station_trade_requests" ADD CONSTRAINT "station_trade_requests_slot_id_fkey" FOREIGN KEY (slot_id) REFERENCES firehouse.station_shift_slots(id);

ALTER TABLE "firehouse"."station_trade_requests" ADD CONSTRAINT "station_trade_requests_target_employee_id_fkey" FOREIGN KEY (target_employee_id) REFERENCES firehouse.employees(id);

ALTER TABLE "firehouse"."station_unavailability" ADD CONSTRAINT "station_unavailability_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES firehouse.employees(id);

ALTER TABLE "firehouse"."station_unavailability" ADD CONSTRAINT "station_unavailability_request_id_fkey" FOREIGN KEY (request_id) REFERENCES firehouse.station_time_off_requests(id);

ALTER TABLE "firehouse"."training_pilot_audit" ADD CONSTRAINT "training_pilot_audit_record_id_fkey" FOREIGN KEY (record_id) REFERENCES firehouse.training_pilot_records(id);

ALTER TABLE "firehouse"."training_pilot_files" ADD CONSTRAINT "training_pilot_files_record_id_fkey" FOREIGN KEY (record_id) REFERENCES firehouse.training_pilot_records(id);

ALTER TABLE "private"."department_portals" ADD CONSTRAINT "department_portals_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id);

ALTER TABLE "private"."portal_remembered_devices" ADD CONSTRAINT "portal_remembered_devices_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;

ALTER TABLE "private"."portal_remembered_devices" ADD CONSTRAINT "portal_remembered_devices_session_id_fkey" FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;

ALTER TABLE "private"."portal_remembered_devices" ADD CONSTRAINT "portal_remembered_devices_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."department_apparatus" ADD CONSTRAINT "department_apparatus_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."department_apparatus" ADD CONSTRAINT "department_apparatus_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;

ALTER TABLE "public"."department_apparatus" ADD CONSTRAINT "department_apparatus_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."department_invites" ADD CONSTRAINT "department_invites_accepted_by_fkey" FOREIGN KEY (accepted_by) REFERENCES auth.users(id);

ALTER TABLE "public"."department_invites" ADD CONSTRAINT "department_invites_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;

ALTER TABLE "public"."department_invites" ADD CONSTRAINT "department_invites_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id);

ALTER TABLE "public"."department_memberships" ADD CONSTRAINT "department_memberships_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;

ALTER TABLE "public"."department_memberships" ADD CONSTRAINT "department_memberships_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."disciplinary_import_staging" ADD CONSTRAINT "disciplinary_import_staging_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id);

ALTER TABLE "public"."disciplinary_report_files" ADD CONSTRAINT "disciplinary_report_files_report_id_department_id_fkey" FOREIGN KEY (report_id, department_id) REFERENCES disciplinary_reports(id, department_id) ON DELETE RESTRICT;

ALTER TABLE "public"."disciplinary_report_versions" ADD CONSTRAINT "disciplinary_report_versions_report_id_department_id_fkey" FOREIGN KEY (report_id, department_id) REFERENCES disciplinary_reports(id, department_id) ON DELETE RESTRICT;

ALTER TABLE "public"."disciplinary_reports" ADD CONSTRAINT "disciplinary_reports_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_apparatus_profiles" ADD CONSTRAINT "inventory_apparatus_profiles_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_apparatus_profiles" ADD CONSTRAINT "inventory_apparatus_profiles_id_fkey" FOREIGN KEY (id) REFERENCES department_apparatus(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_apparatus_profiles" ADD CONSTRAINT "inventory_apparatus_profiles_service_profile_verified_by_fkey" FOREIGN KEY (service_profile_verified_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."inventory_audit_events" ADD CONSTRAINT "inventory_audit_events_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_audit_events" ADD CONSTRAINT "inventory_audit_events_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_check_archives" ADD CONSTRAINT "inventory_check_archives_check_id_fkey" FOREIGN KEY (check_id) REFERENCES inventory_checks(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_check_archives" ADD CONSTRAINT "inventory_check_archives_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_check_archives" ADD CONSTRAINT "inventory_check_archives_replacement_check_id_fkey" FOREIGN KEY (replacement_check_id) REFERENCES inventory_checks(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_check_items" ADD CONSTRAINT "inventory_check_items_check_id_fkey" FOREIGN KEY (check_id) REFERENCES inventory_checks(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_check_items" ADD CONSTRAINT "inventory_check_items_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_check_items" ADD CONSTRAINT "inventory_check_items_equipment_id_fkey" FOREIGN KEY (equipment_id) REFERENCES inventory_equipment(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_checks" ADD CONSTRAINT "inventory_checks_apparatus_id_fkey" FOREIGN KEY (apparatus_id) REFERENCES inventory_apparatus_profiles(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_checks" ADD CONSTRAINT "inventory_checks_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_compartments" ADD CONSTRAINT "inventory_compartments_apparatus_id_fkey" FOREIGN KEY (apparatus_id) REFERENCES inventory_apparatus_profiles(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_compartments" ADD CONSTRAINT "inventory_compartments_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_deficiency_photos" ADD CONSTRAINT "inventory_deficiency_photos_apparatus_id_fkey" FOREIGN KEY (apparatus_id) REFERENCES inventory_apparatus_profiles(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_deficiency_photos" ADD CONSTRAINT "inventory_deficiency_photos_check_item_id_fkey" FOREIGN KEY (check_item_id) REFERENCES inventory_check_items(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_deficiency_photos" ADD CONSTRAINT "inventory_deficiency_photos_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_equipment" ADD CONSTRAINT "inventory_equipment_apparatus_id_fkey" FOREIGN KEY (apparatus_id) REFERENCES inventory_apparatus_profiles(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_equipment" ADD CONSTRAINT "inventory_equipment_compartment_id_fkey" FOREIGN KEY (compartment_id) REFERENCES inventory_compartments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_equipment" ADD CONSTRAINT "inventory_equipment_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_equipment" ADD CONSTRAINT "inventory_equipment_parent_equipment_id_fkey" FOREIGN KEY (parent_equipment_id) REFERENCES inventory_equipment(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_inspection_schedules" ADD CONSTRAINT "inventory_inspection_schedules_apparatus_id_fkey" FOREIGN KEY (apparatus_id) REFERENCES inventory_apparatus_profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."inventory_inspection_schedules" ADD CONSTRAINT "inventory_inspection_schedules_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_location_change_requests" ADD CONSTRAINT "inventory_location_change_requests_check_item_id_fkey" FOREIGN KEY (check_item_id) REFERENCES inventory_check_items(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_location_change_requests" ADD CONSTRAINT "inventory_location_change_requests_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_location_change_requests" ADD CONSTRAINT "inventory_location_change_requests_equipment_id_fkey" FOREIGN KEY (equipment_id) REFERENCES inventory_equipment(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_location_change_requests" ADD CONSTRAINT "inventory_location_change_requests_from_apparatus_id_fkey" FOREIGN KEY (from_apparatus_id) REFERENCES inventory_apparatus_profiles(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_location_change_requests" ADD CONSTRAINT "inventory_location_change_requests_from_compartment_id_fkey" FOREIGN KEY (from_compartment_id) REFERENCES inventory_compartments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_location_change_requests" ADD CONSTRAINT "inventory_location_change_requests_proposed_apparatus_id_fkey" FOREIGN KEY (proposed_apparatus_id) REFERENCES inventory_apparatus_profiles(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_location_change_requests" ADD CONSTRAINT "inventory_location_change_requests_proposed_compartment_id_fkey" FOREIGN KEY (proposed_compartment_id) REFERENCES inventory_compartments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_location_change_requests" ADD CONSTRAINT "inventory_location_change_requests_requested_by_fkey" FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_location_change_requests" ADD CONSTRAINT "inventory_location_change_requests_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_operation_receipts" ADD CONSTRAINT "inventory_operation_receipts_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id);

ALTER TABLE "public"."inventory_photo_hotspots" ADD CONSTRAINT "inventory_photo_hotspots_apparatus_id_fkey" FOREIGN KEY (apparatus_id) REFERENCES inventory_apparatus_profiles(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_photo_hotspots" ADD CONSTRAINT "inventory_photo_hotspots_compartment_id_fkey" FOREIGN KEY (compartment_id) REFERENCES inventory_compartments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_photo_hotspots" ADD CONSTRAINT "inventory_photo_hotspots_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_photo_hotspots" ADD CONSTRAINT "inventory_photo_hotspots_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_photo_hotspots" ADD CONSTRAINT "inventory_photo_hotspots_photo_view_id_fkey" FOREIGN KEY (photo_view_id) REFERENCES inventory_photo_views(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_photo_views" ADD CONSTRAINT "inventory_photo_views_apparatus_id_fkey" FOREIGN KEY (apparatus_id) REFERENCES inventory_apparatus_profiles(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_photo_views" ADD CONSTRAINT "inventory_photo_views_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_photo_views" ADD CONSTRAINT "inventory_photo_views_compartment_id_fkey" FOREIGN KEY (compartment_id) REFERENCES inventory_compartments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_photo_views" ADD CONSTRAINT "inventory_photo_views_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_photo_views" ADD CONSTRAINT "inventory_photo_views_equipment_id_fkey" FOREIGN KEY (equipment_id) REFERENCES inventory_equipment(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_photo_views" ADD CONSTRAINT "inventory_photo_views_paired_view_id_fkey" FOREIGN KEY (paired_view_id) REFERENCES inventory_photo_views(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_readiness_exceptions" ADD CONSTRAINT "inventory_readiness_exceptions_apparatus_id_fkey" FOREIGN KEY (apparatus_id) REFERENCES inventory_apparatus_profiles(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_readiness_exceptions" ADD CONSTRAINT "inventory_readiness_exceptions_check_item_id_fkey" FOREIGN KEY (check_item_id) REFERENCES inventory_check_items(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_readiness_exceptions" ADD CONSTRAINT "inventory_readiness_exceptions_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_readiness_exceptions" ADD CONSTRAINT "inventory_readiness_exceptions_equipment_id_fkey" FOREIGN KEY (equipment_id) REFERENCES inventory_equipment(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_readiness_exceptions" ADD CONSTRAINT "inventory_readiness_exceptions_evidence_photo_id_fkey" FOREIGN KEY (evidence_photo_id) REFERENCES inventory_deficiency_photos(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_scba_check_entries" ADD CONSTRAINT "inventory_scba_check_entries_check_id_fkey" FOREIGN KEY (check_id) REFERENCES inventory_checks(id) ON DELETE CASCADE;

ALTER TABLE "public"."inventory_scba_check_entries" ADD CONSTRAINT "inventory_scba_check_entries_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;

ALTER TABLE "public"."inventory_scba_check_entries" ADD CONSTRAINT "inventory_scba_check_entries_equipment_id_fkey" FOREIGN KEY (equipment_id) REFERENCES inventory_equipment(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_scba_templates" ADD CONSTRAINT "inventory_scba_templates_apparatus_id_fkey" FOREIGN KEY (apparatus_id) REFERENCES inventory_apparatus_profiles(id) ON DELETE CASCADE;

ALTER TABLE "public"."inventory_scba_templates" ADD CONSTRAINT "inventory_scba_templates_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;

ALTER TABLE "public"."inventory_stock_items" ADD CONSTRAINT "inventory_stock_items_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_stock_lots" ADD CONSTRAINT "inventory_stock_lots_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_stock_lots" ADD CONSTRAINT "inventory_stock_lots_stock_item_id_fkey" FOREIGN KEY (stock_item_id) REFERENCES inventory_stock_items(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_performed_by_fkey" FOREIGN KEY (performed_by) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_stock_item_id_fkey" FOREIGN KEY (stock_item_id) REFERENCES inventory_stock_items(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_transactions" ADD CONSTRAINT "inventory_transactions_stock_lot_id_fkey" FOREIGN KEY (stock_lot_id) REFERENCES inventory_stock_lots(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_work_order_documents" ADD CONSTRAINT "inventory_work_order_documents_apparatus_id_fkey" FOREIGN KEY (apparatus_id) REFERENCES inventory_apparatus_profiles(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_work_order_documents" ADD CONSTRAINT "inventory_work_order_documents_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_work_order_documents" ADD CONSTRAINT "inventory_work_order_documents_work_order_id_fkey" FOREIGN KEY (work_order_id) REFERENCES inventory_work_orders(id) ON DELETE CASCADE;

ALTER TABLE "public"."inventory_work_orders" ADD CONSTRAINT "inventory_work_orders_apparatus_id_fkey" FOREIGN KEY (apparatus_id) REFERENCES inventory_apparatus_profiles(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_work_orders" ADD CONSTRAINT "inventory_work_orders_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_work_orders" ADD CONSTRAINT "inventory_work_orders_equipment_id_fkey" FOREIGN KEY (equipment_id) REFERENCES inventory_equipment(id) ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_work_orders" ADD CONSTRAINT "inventory_work_orders_linked_exception_id_fkey" FOREIGN KEY (linked_exception_id) REFERENCES inventory_readiness_exceptions(id) ON DELETE RESTRICT;

ALTER TABLE "public"."portal_pin_credentials" ADD CONSTRAINT "portal_pin_credentials_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."push_subscriptions" ADD CONSTRAINT "push_subscriptions_department_id_fkey" FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;

ALTER TABLE "public"."push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE VIEW "firehouse"."scheduler_reminder_slots" WITH (security_invoker=true) AS SELECT s.id,
    s.entry_id,
    s.role,
    s.employee_id,
    s.status,
    s.sort_order,
    s.start_time,
    s.end_time,
    s.is_extra,
    s.staffing_reason,
    s.request_deadline,
    s.reminder_changed_at,
    en.entry_date,
    t.active AS shift_active,
    ((en.entry_date || ' '::text) || COALESCE(NULLIF(s.start_time, ''::text), t.start_time))::timestamp without time zone AS local_start,
    (((en.entry_date || ' '::text) || COALESCE(NULLIF(s.end_time, ''::text), t.end_time))::timestamp without time zone) +
        CASE
            WHEN COALESCE(NULLIF(s.end_time, ''::text), t.end_time) <= COALESCE(NULLIF(s.start_time, ''::text), t.start_time) THEN '1 day'::interval
            ELSE '00:00:00'::interval
        END AS local_end
   FROM firehouse.station_shift_slots s
     JOIN firehouse.station_schedule_entries en ON en.id = s.entry_id
     JOIN firehouse.station_shift_types t ON t.id = en.shift_type_id;

CREATE VIEW "firehouse"."stickney_inventory_apparatus" WITH (security_barrier=true, security_invoker=false) AS SELECT id::text AS id,
    name,
    asset_type,
    manufacturer,
    model,
    year,
    weekly_due_day,
    updated_at
   FROM inventory_apparatus_profiles
  WHERE department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid;

CREATE VIEW "firehouse"."stickney_inventory_check_items" WITH (security_invoker=true) AS SELECT id::text AS id,
    check_id::text AS check_id,
    equipment_id::text AS equipment_id,
    result,
    notes,
    numeric_reading,
    checked_by,
    checked_at
   FROM inventory_check_items i
  WHERE department_id = (( SELECT d.id
           FROM departments d
          WHERE d.slug = 'stickney-fire-department'::text
         LIMIT 1));

CREATE VIEW "firehouse"."stickney_inventory_checks" WITH (security_invoker=true) AS SELECT id::text AS id,
    apparatus_id::text AS apparatus_id,
    shift_id,
    check_type,
    status,
    started_by,
    started_at,
    completed_at
   FROM inventory_checks c
  WHERE department_id = (( SELECT d.id
           FROM departments d
          WHERE d.slug = 'stickney-fire-department'::text
         LIMIT 1));

CREATE VIEW "firehouse"."stickney_inventory_compartments" WITH (security_barrier=true, security_invoker=false) AS SELECT id::text AS id,
    apparatus_id::text AS apparatus_id,
    label,
    side,
    sort_order
   FROM inventory_compartments
  WHERE department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid;

CREATE VIEW "firehouse"."stickney_inventory_equipment" WITH (security_barrier=true, security_invoker=false) AS SELECT id::text AS id,
    apparatus_id::text AS apparatus_id,
    compartment_id::text AS compartment_id,
    name,
    manufacturer,
    model,
    serial_number,
    barcode,
    quantity_required,
    equipment_category,
    check_types,
    source_form,
    item_order,
    retired_at
   FROM inventory_equipment
  WHERE department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid;

CREATE VIEW "firehouse"."stickney_inventory_photo_views" WITH (security_barrier=true, security_invoker=false) AS SELECT id::text AS id,
    apparatus_id::text AS apparatus_id,
    compartment_id::text AS compartment_id,
    equipment_id::text AS equipment_id,
    view_level,
    door_state,
    original_filename,
    mime_type,
    byte_size,
    approval_status,
    captured_at,
    replaced_at
   FROM inventory_photo_views
  WHERE department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid;

CREATE VIEW "firehouse"."stickney_inventory_readiness_exceptions" WITH (security_invoker=true) AS SELECT id::text AS id,
    apparatus_id::text AS apparatus_id,
    equipment_id::text AS equipment_id,
    check_item_id::text AS check_item_id,
    result,
    priority,
    notes,
    status,
    out_of_service,
    opened_by,
    opened_at,
    issue_categories,
    assigned_employee_names,
    evidence_photo_id::text AS evidence_photo_id,
    resolved_at,
    resolved_by,
    resolution_notes
   FROM inventory_readiness_exceptions e
  WHERE department_id = (( SELECT d.id
           FROM departments d
          WHERE d.slug = 'stickney-fire-department'::text
         LIMIT 1));

CREATE VIEW "firehouse"."stickney_inventory_work_orders" WITH (security_invoker=true) AS SELECT id::text AS id,
    apparatus_id::text AS apparatus_id,
    equipment_id::text AS equipment_id,
    status,
    priority,
    summary,
    details,
    assigned_to,
    opened_by,
    opened_at,
    due_at,
    closed_at,
    linked_exception_id::text AS linked_exception_id,
    assigned_employee_names,
    repair_date,
    repair_cost,
    vendor,
    invoice_number,
    resolution_notes,
    closed_by
   FROM inventory_work_orders w
  WHERE department_id = (( SELECT d.id
           FROM departments d
          WHERE d.slug = 'stickney-fire-department'::text
         LIMIT 1));

CREATE TRIGGER broadcast_apparatus_location AFTER INSERT OR UPDATE ON firehouse.apparatus_trackers FOR EACH ROW EXECUTE FUNCTION firehouse.publish_apparatus_location();

ALTER TABLE "firehouse"."apparatus_trackers" ENABLE TRIGGER "broadcast_apparatus_location";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.board_feed_cache FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('feeds');

ALTER TABLE "firehouse"."board_feed_cache" ENABLE TRIGGER "operational_change";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.box_cards FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('respond');

ALTER TABLE "firehouse"."box_cards" ENABLE TRIGGER "operational_change";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.cad_inbound_receipts FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('respond');

ALTER TABLE "firehouse"."cad_inbound_receipts" ENABLE TRIGGER "operational_change";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.chief_board_attachments FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('chief');

ALTER TABLE "firehouse"."chief_board_attachments" ENABLE TRIGGER "operational_change";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.chief_board_items FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('chief');

ALTER TABLE "firehouse"."chief_board_items" ENABLE TRIGGER "operational_change";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.daily_duties FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('duties');

ALTER TABLE "firehouse"."daily_duties" ENABLE TRIGGER "operational_change";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.daily_log_approvals FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('dashboard');

ALTER TABLE "firehouse"."daily_log_approvals" ENABLE TRIGGER "operational_change";

CREATE TRIGGER payroll_source_version BEFORE INSERT OR DELETE OR UPDATE ON firehouse.daily_log_approvals FOR EACH STATEMENT EXECUTE FUNCTION firehouse.payroll_sources_will_change();

ALTER TABLE "firehouse"."daily_log_approvals" ENABLE TRIGGER "payroll_source_version";

CREATE TRIGGER call_changes_log_version AFTER INSERT OR DELETE OR UPDATE ON firehouse.daily_log_calls FOR EACH ROW EXECUTE FUNCTION firehouse.bump_linked_log_version();

ALTER TABLE "firehouse"."daily_log_calls" ENABLE TRIGGER "call_changes_log_version";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.daily_log_calls FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('dashboard,respond');

ALTER TABLE "firehouse"."daily_log_calls" ENABLE TRIGGER "operational_change";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.daily_log_staffing FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('dashboard,staffing');

ALTER TABLE "firehouse"."daily_log_staffing" ENABLE TRIGGER "operational_change";

CREATE TRIGGER payroll_source_version BEFORE INSERT OR DELETE OR UPDATE ON firehouse.daily_log_staffing FOR EACH STATEMENT EXECUTE FUNCTION firehouse.payroll_sources_will_change();

ALTER TABLE "firehouse"."daily_log_staffing" ENABLE TRIGGER "payroll_source_version";

CREATE TRIGGER staffing_changes_log_version AFTER INSERT OR DELETE OR UPDATE ON firehouse.daily_log_staffing FOR EACH ROW EXECUTE FUNCTION firehouse.bump_linked_log_version();

ALTER TABLE "firehouse"."daily_log_staffing" ENABLE TRIGGER "staffing_changes_log_version";

CREATE TRIGGER bump_daily_log_version BEFORE UPDATE ON firehouse.daily_logs FOR EACH ROW EXECUTE FUNCTION firehouse.bump_daily_log_version();

ALTER TABLE "firehouse"."daily_logs" ENABLE TRIGGER "bump_daily_log_version";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.daily_logs FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('dashboard');

ALTER TABLE "firehouse"."daily_logs" ENABLE TRIGGER "operational_change";

CREATE TRIGGER payroll_source_version BEFORE INSERT OR DELETE OR UPDATE ON firehouse.daily_logs FOR EACH STATEMENT EXECUTE FUNCTION firehouse.payroll_sources_will_change();

ALTER TABLE "firehouse"."daily_logs" ENABLE TRIGGER "payroll_source_version";

CREATE TRIGGER cad_push_on_new_incident AFTER INSERT ON firehouse.dispatch_incidents FOR EACH ROW EXECUTE FUNCTION firehouse.enqueue_cad_push();

ALTER TABLE "firehouse"."dispatch_incidents" ENABLE TRIGGER "cad_push_on_new_incident";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.dispatch_incidents FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('dashboard,respond');

ALTER TABLE "firehouse"."dispatch_incidents" ENABLE TRIGGER "operational_change";

CREATE TRIGGER permissions_revision AFTER INSERT OR DELETE OR UPDATE ON firehouse.employee_permission_overrides FOR EACH ROW EXECUTE FUNCTION firehouse.bump_permissions_revision();

ALTER TABLE "firehouse"."employee_permission_overrides" ENABLE TRIGGER "permissions_revision";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.employee_profiles FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('chief,dashboard,staffing');

ALTER TABLE "firehouse"."employee_profiles" ENABLE TRIGGER "operational_change";

CREATE TRIGGER payroll_source_version BEFORE INSERT OR DELETE OR UPDATE ON firehouse.employee_profiles FOR EACH STATEMENT EXECUTE FUNCTION firehouse.payroll_sources_will_change();

ALTER TABLE "firehouse"."employee_profiles" ENABLE TRIGGER "payroll_source_version";

CREATE TRIGGER permissions_revision AFTER INSERT OR DELETE OR UPDATE ON firehouse.employee_profiles FOR EACH ROW EXECUTE FUNCTION firehouse.bump_permissions_revision();

ALTER TABLE "firehouse"."employee_profiles" ENABLE TRIGGER "permissions_revision";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.employees FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('chief,dashboard,staffing');

ALTER TABLE "firehouse"."employees" ENABLE TRIGGER "operational_change";

CREATE TRIGGER payroll_source_version BEFORE INSERT OR DELETE OR UPDATE ON firehouse.employees FOR EACH STATEMENT EXECUTE FUNCTION firehouse.payroll_sources_will_change();

ALTER TABLE "firehouse"."employees" ENABLE TRIGGER "payroll_source_version";

CREATE TRIGGER permissions_revision AFTER INSERT OR DELETE OR UPDATE ON firehouse.employees FOR EACH ROW EXECUTE FUNCTION firehouse.bump_permissions_revision();

ALTER TABLE "firehouse"."employees" ENABLE TRIGGER "permissions_revision";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.field_hydrants FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('respond');

ALTER TABLE "firehouse"."field_hydrants" ENABLE TRIGGER "operational_change";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.field_preplan_alerts FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('respond');

ALTER TABLE "firehouse"."field_preplan_alerts" ENABLE TRIGGER "operational_change";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.field_preplan_assets FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('respond');

ALTER TABLE "firehouse"."field_preplan_assets" ENABLE TRIGGER "operational_change";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.field_preplan_features FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('respond');

ALTER TABLE "firehouse"."field_preplan_features" ENABLE TRIGGER "operational_change";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.field_preplan_hazmat FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('respond');

ALTER TABLE "firehouse"."field_preplan_hazmat" ENABLE TRIGGER "operational_change";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.field_preplan_hazmat_zones FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('respond');

ALTER TABLE "firehouse"."field_preplan_hazmat_zones" ENABLE TRIGGER "operational_change";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.field_preplan_hose_lays FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('respond');

ALTER TABLE "firehouse"."field_preplan_hose_lays" ENABLE TRIGGER "operational_change";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.field_preplan_levels FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('respond');

ALTER TABLE "firehouse"."field_preplan_levels" ENABLE TRIGGER "operational_change";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.field_preplan_photos FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('respond');

ALTER TABLE "firehouse"."field_preplan_photos" ENABLE TRIGGER "operational_change";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.field_preplan_revisions FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('respond');

ALTER TABLE "firehouse"."field_preplan_revisions" ENABLE TRIGGER "operational_change";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.field_preplan_risk_factors FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('respond');

ALTER TABLE "firehouse"."field_preplan_risk_factors" ENABLE TRIGGER "operational_change";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.field_preplan_spaces FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('respond');

ALTER TABLE "firehouse"."field_preplan_spaces" ENABLE TRIGGER "operational_change";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.field_preplans FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('respond');

ALTER TABLE "firehouse"."field_preplans" ENABLE TRIGGER "operational_change";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.fleet_apparatus FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('dashboard,duties,fleet,respond');

ALTER TABLE "firehouse"."fleet_apparatus" ENABLE TRIGGER "operational_change";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.pay_periods FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('dashboard');

ALTER TABLE "firehouse"."pay_periods" ENABLE TRIGGER "operational_change";

CREATE TRIGGER payroll_source_version BEFORE INSERT OR DELETE OR UPDATE ON firehouse.pay_periods FOR EACH STATEMENT EXECUTE FUNCTION firehouse.payroll_sources_will_change();

ALTER TABLE "firehouse"."pay_periods" ENABLE TRIGGER "payroll_source_version";

CREATE TRIGGER payroll_submission_keeps_actuals_open BEFORE INSERT OR UPDATE ON firehouse.pay_periods FOR EACH ROW EXECUTE FUNCTION firehouse.keep_submitted_attendance_open();

ALTER TABLE "firehouse"."pay_periods" ENABLE TRIGGER "payroll_submission_keeps_actuals_open";

CREATE TRIGGER payroll_source_version BEFORE INSERT OR DELETE OR UPDATE ON firehouse.pay_rate_history FOR EACH STATEMENT EXECUTE FUNCTION firehouse.payroll_sources_will_change();

ALTER TABLE "firehouse"."pay_rate_history" ENABLE TRIGGER "payroll_source_version";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.pay_scales FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('chief,dashboard,staffing');

ALTER TABLE "firehouse"."pay_scales" ENABLE TRIGGER "operational_change";

CREATE TRIGGER payroll_source_version BEFORE INSERT OR DELETE OR UPDATE ON firehouse.pay_scales FOR EACH STATEMENT EXECUTE FUNCTION firehouse.payroll_sources_will_change();

ALTER TABLE "firehouse"."pay_scales" ENABLE TRIGGER "payroll_source_version";

CREATE TRIGGER permissions_revision AFTER INSERT OR DELETE OR UPDATE ON firehouse.pay_scales FOR EACH ROW EXECUTE FUNCTION firehouse.bump_permissions_revision();

ALTER TABLE "firehouse"."pay_scales" ENABLE TRIGGER "permissions_revision";

CREATE TRIGGER payroll_adjustment_immutable BEFORE DELETE OR UPDATE ON firehouse.payroll_adjustments FOR EACH ROW EXECUTE FUNCTION firehouse.keep_payroll_submission_immutable();

ALTER TABLE "firehouse"."payroll_adjustments" ENABLE TRIGGER "payroll_adjustment_immutable";

CREATE TRIGGER payroll_adjustment_target BEFORE INSERT ON firehouse.payroll_adjustments FOR EACH ROW EXECUTE FUNCTION firehouse.check_payroll_submission_target();

ALTER TABLE "firehouse"."payroll_adjustments" ENABLE TRIGGER "payroll_adjustment_target";

CREATE TRIGGER payroll_source_version BEFORE INSERT OR DELETE OR UPDATE ON firehouse.payroll_adjustments FOR EACH STATEMENT EXECUTE FUNCTION firehouse.payroll_sources_will_change();

ALTER TABLE "firehouse"."payroll_adjustments" ENABLE TRIGGER "payroll_source_version";

CREATE TRIGGER payroll_source_version BEFORE INSERT OR DELETE OR UPDATE ON firehouse.payroll_settings FOR EACH STATEMENT EXECUTE FUNCTION firehouse.payroll_sources_will_change();

ALTER TABLE "firehouse"."payroll_settings" ENABLE TRIGGER "payroll_source_version";

CREATE TRIGGER payroll_source_version BEFORE INSERT OR DELETE OR UPDATE ON firehouse.payroll_submissions FOR EACH STATEMENT EXECUTE FUNCTION firehouse.payroll_sources_will_change();

ALTER TABLE "firehouse"."payroll_submissions" ENABLE TRIGGER "payroll_source_version";

CREATE TRIGGER payroll_submission_immutable BEFORE DELETE OR UPDATE ON firehouse.payroll_submissions FOR EACH ROW EXECUTE FUNCTION firehouse.keep_payroll_submission_immutable();

ALTER TABLE "firehouse"."payroll_submissions" ENABLE TRIGGER "payroll_submission_immutable";

CREATE TRIGGER payroll_submission_target BEFORE INSERT ON firehouse.payroll_submissions FOR EACH ROW EXECUTE FUNCTION firehouse.check_payroll_submission_target();

ALTER TABLE "firehouse"."payroll_submissions" ENABLE TRIGGER "payroll_submission_target";

CREATE TRIGGER permissions_revision AFTER INSERT OR DELETE OR UPDATE ON firehouse.rank_permissions FOR EACH ROW EXECUTE FUNCTION firehouse.bump_permissions_revision();

ALTER TABLE "firehouse"."rank_permissions" ENABLE TRIGGER "permissions_revision";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.road_closures FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('dashboard,respond');

ALTER TABLE "firehouse"."road_closures" ENABLE TRIGGER "operational_change";

CREATE TRIGGER scheduler_rule_changed BEFORE UPDATE ON firehouse.station_reminder_rules FOR EACH ROW EXECUTE FUNCTION firehouse.scheduler_reminder_changed();

ALTER TABLE "firehouse"."station_reminder_rules" ENABLE TRIGGER "scheduler_rule_changed";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.station_schedule_entries FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('dashboard,staffing');

ALTER TABLE "firehouse"."station_schedule_entries" ENABLE TRIGGER "operational_change";

CREATE TRIGGER payroll_source_version BEFORE INSERT OR DELETE OR UPDATE ON firehouse.station_schedule_entries FOR EACH STATEMENT EXECUTE FUNCTION firehouse.payroll_sources_will_change();

ALTER TABLE "firehouse"."station_schedule_entries" ENABLE TRIGGER "payroll_source_version";

CREATE TRIGGER scheduler_claim_changed BEFORE INSERT OR UPDATE ON firehouse.station_shift_claims FOR EACH ROW EXECUTE FUNCTION firehouse.scheduler_reminder_changed();

ALTER TABLE "firehouse"."station_shift_claims" ENABLE TRIGGER "scheduler_claim_changed";

CREATE TRIGGER scheduler_claim_deadline_guard BEFORE INSERT ON firehouse.station_shift_claims FOR EACH ROW EXECUTE FUNCTION firehouse.scheduler_claim_deadline_guard();

ALTER TABLE "firehouse"."station_shift_claims" ENABLE TRIGGER "scheduler_claim_deadline_guard";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.station_shift_slots FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('dashboard,staffing');

ALTER TABLE "firehouse"."station_shift_slots" ENABLE TRIGGER "operational_change";

CREATE TRIGGER payroll_source_version BEFORE INSERT OR DELETE OR UPDATE ON firehouse.station_shift_slots FOR EACH STATEMENT EXECUTE FUNCTION firehouse.payroll_sources_will_change();

ALTER TABLE "firehouse"."station_shift_slots" ENABLE TRIGGER "payroll_source_version";

CREATE TRIGGER scheduler_slot_changed BEFORE INSERT OR UPDATE ON firehouse.station_shift_slots FOR EACH ROW EXECUTE FUNCTION firehouse.scheduler_reminder_changed();

ALTER TABLE "firehouse"."station_shift_slots" ENABLE TRIGGER "scheduler_slot_changed";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.station_shift_types FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('dashboard,staffing');

ALTER TABLE "firehouse"."station_shift_types" ENABLE TRIGGER "operational_change";

CREATE TRIGGER payroll_source_version BEFORE INSERT OR DELETE OR UPDATE ON firehouse.station_shift_types FOR EACH STATEMENT EXECUTE FUNCTION firehouse.payroll_sources_will_change();

ALTER TABLE "firehouse"."station_shift_types" ENABLE TRIGGER "payroll_source_version";

CREATE TRIGGER guard_new_station_trade BEFORE INSERT ON firehouse.station_trade_requests FOR EACH ROW EXECUTE FUNCTION firehouse.guard_new_station_trade();

ALTER TABLE "firehouse"."station_trade_requests" ENABLE TRIGGER "guard_new_station_trade";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON firehouse.system_meta FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('chief');

ALTER TABLE "firehouse"."system_meta" ENABLE TRIGGER "operational_change";

CREATE TRIGGER payroll_source_version BEFORE INSERT OR DELETE OR UPDATE ON firehouse.time_entries FOR EACH STATEMENT EXECUTE FUNCTION firehouse.payroll_sources_will_change();

ALTER TABLE "firehouse"."time_entries" ENABLE TRIGGER "payroll_source_version";

CREATE TRIGGER protect_finalized_time_entry BEFORE INSERT OR DELETE OR UPDATE ON firehouse.time_entries FOR EACH ROW EXECUTE FUNCTION firehouse.protect_finalized_time_entry();

ALTER TABLE "firehouse"."time_entries" ENABLE TRIGGER "protect_finalized_time_entry";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON department_apparatus FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('dashboard,duties,fleet');

ALTER TABLE "public"."department_apparatus" ENABLE TRIGGER "operational_change";

CREATE TRIGGER provision_department_portal AFTER INSERT ON departments FOR EACH ROW EXECUTE FUNCTION private.provision_department_portal();

ALTER TABLE "public"."departments" ENABLE TRIGGER "provision_department_portal";

CREATE TRIGGER zz_initialize_department_forms AFTER INSERT ON departments FOR EACH ROW EXECUTE FUNCTION private.initialize_department_forms();

ALTER TABLE "public"."departments" ENABLE TRIGGER "zz_initialize_department_forms";

CREATE TRIGGER disciplinary_guard_report BEFORE INSERT OR UPDATE ON disciplinary_reports FOR EACH ROW EXECUTE FUNCTION private.disciplinary_guard_report();

ALTER TABLE "public"."disciplinary_reports" ENABLE TRIGGER "disciplinary_guard_report";

CREATE TRIGGER disciplinary_keep_version AFTER INSERT OR UPDATE ON disciplinary_reports FOR EACH ROW EXECUTE FUNCTION private.disciplinary_keep_version();

ALTER TABLE "public"."disciplinary_reports" ENABLE TRIGGER "disciplinary_keep_version";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON inventory_apparatus_profiles FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('dashboard,duties');

ALTER TABLE "public"."inventory_apparatus_profiles" ENABLE TRIGGER "operational_change";

CREATE TRIGGER inventory_guard_archive_insert BEFORE INSERT ON inventory_check_archives FOR EACH ROW EXECUTE FUNCTION inventory_guard_archive_insert();

ALTER TABLE "public"."inventory_check_archives" ENABLE TRIGGER "inventory_guard_archive_insert";

CREATE TRIGGER inventory_guard_active_result BEFORE INSERT OR UPDATE ON inventory_check_items FOR EACH ROW EXECUTE FUNCTION inventory_guard_active_result();

ALTER TABLE "public"."inventory_check_items" ENABLE TRIGGER "inventory_guard_active_result";

CREATE TRIGGER inventory_guard_archived_item BEFORE INSERT OR DELETE OR UPDATE ON inventory_check_items FOR EACH ROW EXECUTE FUNCTION inventory_guard_archived_item();

ALTER TABLE "public"."inventory_check_items" ENABLE TRIGGER "inventory_guard_archived_item";

CREATE TRIGGER inventory_guard_drug_item BEFORE INSERT OR UPDATE ON inventory_check_items FOR EACH ROW EXECUTE FUNCTION inventory_guard_drug_item();

ALTER TABLE "public"."inventory_check_items" ENABLE TRIGGER "inventory_guard_drug_item";

CREATE TRIGGER inventory_guard_meter_item BEFORE INSERT OR UPDATE ON inventory_check_items FOR EACH ROW EXECUTE FUNCTION inventory_guard_meter_item();

ALTER TABLE "public"."inventory_check_items" ENABLE TRIGGER "inventory_guard_meter_item";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON inventory_check_items FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('dashboard,duties');

ALTER TABLE "public"."inventory_check_items" ENABLE TRIGGER "operational_change";

CREATE TRIGGER inventory_guard_archived_check BEFORE UPDATE ON inventory_checks FOR EACH ROW EXECUTE FUNCTION inventory_guard_archived_check();

ALTER TABLE "public"."inventory_checks" ENABLE TRIGGER "inventory_guard_archived_check";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON inventory_checks FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('dashboard,duties');

ALTER TABLE "public"."inventory_checks" ENABLE TRIGGER "operational_change";

CREATE TRIGGER inventory_validate_service_schedule BEFORE INSERT OR UPDATE OF last_serviced_date, service_interval_months, service_reminder_months ON inventory_equipment FOR EACH ROW EXECUTE FUNCTION private.inventory_validate_service_schedule();

ALTER TABLE "public"."inventory_equipment" ENABLE TRIGGER "inventory_validate_service_schedule";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON inventory_equipment FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('dashboard');

ALTER TABLE "public"."inventory_equipment" ENABLE TRIGGER "operational_change";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON inventory_inspection_schedules FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('duties');

ALTER TABLE "public"."inventory_inspection_schedules" ENABLE TRIGGER "operational_change";

CREATE TRIGGER inventory_location_change_apply BEFORE UPDATE ON inventory_location_change_requests FOR EACH ROW EXECUTE FUNCTION private.apply_inventory_location_change();

ALTER TABLE "public"."inventory_location_change_requests" ENABLE TRIGGER "inventory_location_change_apply";

CREATE TRIGGER inventory_location_change_audit AFTER INSERT OR UPDATE ON inventory_location_change_requests FOR EACH ROW EXECUTE FUNCTION private.audit_inventory_location_change();

ALTER TABLE "public"."inventory_location_change_requests" ENABLE TRIGGER "inventory_location_change_audit";

CREATE TRIGGER operational_change AFTER INSERT OR DELETE OR UPDATE ON inventory_readiness_exceptions FOR EACH ROW EXECUTE FUNCTION firehouse.notify_operational_change('dashboard');

ALTER TABLE "public"."inventory_readiness_exceptions" ENABLE TRIGGER "operational_change";

CREATE TRIGGER inventory_guard_active_scba_result BEFORE INSERT OR UPDATE ON inventory_scba_check_entries FOR EACH ROW EXECUTE FUNCTION inventory_guard_active_result();

ALTER TABLE "public"."inventory_scba_check_entries" ENABLE TRIGGER "inventory_guard_active_scba_result";

ALTER TABLE "firehouse"."apparatus_location_view_leases" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."apparatus_location_view_leases" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."apparatus_trackers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."apparatus_trackers" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."background_job_runs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."background_job_runs" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."board_feed_cache" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."board_feed_cache" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."box_cards" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."box_cards" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."cad_inbound_receipts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."cad_inbound_receipts" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."cad_push_deliveries" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."cad_push_deliveries" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."cad_push_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."cad_push_events" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."callback_payroll_aggregates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."callback_payroll_aggregates" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."callback_review_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."callback_review_settings" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."chief_board_attachments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."chief_board_attachments" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."chief_board_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."chief_board_items" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."daily_duties" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."daily_duties" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."daily_log_approvals" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."daily_log_approvals" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."daily_log_callback_submissions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."daily_log_callback_submissions" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."daily_log_calls" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."daily_log_calls" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."daily_log_staffing" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."daily_log_staffing" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."daily_logs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."daily_logs" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."dispatch_incidents" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."dispatch_incidents" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."employee_account_links" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."employee_account_links" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."employee_permission_overrides" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."employee_permission_overrides" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."employee_profiles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."employee_profiles" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."employees" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."employees" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_hydrant_flow_tests" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_hydrant_flow_tests" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_hydrant_flushes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_hydrant_flushes" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_hydrant_service_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_hydrant_service_events" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_hydrants" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_hydrants" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_alerts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_alerts" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_annotations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_annotations" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_assets" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_assets" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_external_details" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_external_details" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_feature_levels" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_feature_levels" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_features" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_features" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_hazmat" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_hazmat" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_hazmat_zones" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_hazmat_zones" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_hose_lays" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_hose_lays" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_imports" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_imports" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_levels" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_levels" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_observations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_observations" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_photo_annotations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_photo_annotations" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_photos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_photos" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_reviews" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_reviews" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_revisions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_revisions" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_risk_factors" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_risk_factors" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_settings" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_spaces" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplan_spaces" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplans" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."field_preplans" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_backup_audit" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_backup_audit" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_backup_entries" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_backup_entries" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_backup_jobs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_backup_jobs" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_backup_rows" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_backup_rows" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_code_audit" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_code_audit" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_code_entries" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_code_entries" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_email_deliveries" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_email_deliveries" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_eso_files" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_eso_files" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_eso_records" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_eso_records" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_pilot_audit" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_pilot_audit" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_pilot_files" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_pilot_files" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_pilot_records" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_pilot_records" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_staff_audit" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_staff_audit" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_staff_members" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_staff_members" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_staff_mutations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_staff_mutations" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_staff_workspaces" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fire_inspection_staff_workspaces" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fleet_apparatus" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."fleet_apparatus" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."important_phone_numbers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."important_phone_numbers" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."incident_command_boards" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."incident_command_boards" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."incident_command_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."incident_command_events" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."inventory_audit_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."inventory_audit_events" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."inventory_compartments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."inventory_compartments" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."inventory_equipment" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."inventory_equipment" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."inventory_hotspots" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."inventory_hotspots" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."inventory_photos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."inventory_photos" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."inventory_readiness" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."inventory_readiness" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."inventory_weekly_check_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."inventory_weekly_check_items" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."inventory_weekly_check_results" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."inventory_weekly_check_results" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."inventory_weekly_check_templates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."inventory_weekly_check_templates" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."inventory_weekly_checks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."inventory_weekly_checks" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."neris_pilot_audit" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."neris_pilot_audit" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."neris_pilot_files" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."neris_pilot_files" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."neris_pilot_records" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."neris_pilot_records" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."operational_cad_recovery" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."operational_cad_recovery" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."operational_program_audit" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."operational_program_audit" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."operational_program_records" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."operational_program_records" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."operational_revisions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."operational_revisions" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."operational_view_leases" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."operational_view_leases" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."pay_periods" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."pay_periods" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."pay_rate_history" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."pay_rate_history" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."pay_scales" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."pay_scales" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."payroll_adjustments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."payroll_adjustments" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."payroll_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."payroll_settings" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."payroll_source_version" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."payroll_source_version" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."payroll_submissions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."payroll_submissions" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."policies" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."policies" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."portal_activation_attempts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."portal_activation_attempts" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."portal_confirmation_messages" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."portal_confirmation_messages" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."portal_confirmation_receipts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."portal_confirmation_receipts" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."portal_confirmation_setting" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."portal_confirmation_setting" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."portal_login_audit" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."portal_login_audit" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."portal_login_audit_status" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."portal_login_audit_status" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."push_subscriptions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."push_subscriptions" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."rank_permissions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."rank_permissions" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."record_revisions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."record_revisions" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."road_closures" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."road_closures" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."safety_inspection_attachments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."safety_inspection_attachments" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."safety_inspection_results" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."safety_inspection_results" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."safety_inspection_template_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."safety_inspection_template_items" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."safety_inspection_templates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."safety_inspection_templates" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."safety_inspections" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."safety_inspections" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."schedule_assignments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."schedule_assignments" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."schedule_coverage_rules" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."schedule_coverage_rules" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."schedule_notification_rules" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."schedule_notification_rules" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."schedule_notifications" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."schedule_notifications" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."schedule_requests" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."schedule_requests" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."schedule_rotation_members" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."schedule_rotation_members" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."schedule_rotations" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."schedule_rotations" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."schedule_shift_patterns" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."schedule_shift_patterns" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."schedule_staffing_overrides" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."schedule_staffing_overrides" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."scheduler_push_deliveries" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."scheduler_push_deliveries" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."scheduler_push_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."scheduler_push_events" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_availability" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_availability" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_distribution_weights" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_distribution_weights" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_ot_interest" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_ot_interest" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_ot_offers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_ot_offers" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_ot_settings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_ot_settings" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_ot_timing" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_ot_timing" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_reminder_rules" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_reminder_rules" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_schedule_entries" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_schedule_entries" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_shift_claims" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_shift_claims" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_shift_slots" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_shift_slots" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_shift_type_roles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_shift_type_roles" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_shift_types" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_shift_types" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_standing_assignments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_standing_assignments" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_time_off_dates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_time_off_dates" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_time_off_requests" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_time_off_requests" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_trade_requests" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_trade_requests" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_unavailability" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."station_unavailability" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."system_meta" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."system_meta" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."time_entries" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."time_entries" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."training_pilot_audit" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."training_pilot_audit" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."training_pilot_files" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."training_pilot_files" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."training_pilot_records" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."training_pilot_records" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."training_report_views" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."training_report_views" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."work_detail_members" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."work_detail_members" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."work_detail_postings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."work_detail_postings" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."work_detail_requests" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."work_detail_requests" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."workspace_review_audit" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."workspace_review_audit" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."workspace_review_records" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "firehouse"."workspace_review_records" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "private"."department_portals" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "private"."department_portals" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "private"."portal_remembered_devices" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "private"."portal_remembered_devices" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."department_apparatus" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."department_apparatus" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."department_invites" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."department_invites" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."department_memberships" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."department_memberships" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."departments" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."disciplinary_import_staging" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."disciplinary_import_staging" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."disciplinary_report_files" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."disciplinary_report_files" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."disciplinary_report_versions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."disciplinary_report_versions" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."disciplinary_reports" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."disciplinary_reports" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_apparatus_profiles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_apparatus_profiles" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_audit_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_audit_events" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_check_archives" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_check_archives" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_check_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_check_items" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_checks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_checks" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_compartments" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_compartments" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_deficiency_photos" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_deficiency_photos" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_equipment" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_equipment" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_inspection_schedules" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_inspection_schedules" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_location_change_requests" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_location_change_requests" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_operation_receipts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_operation_receipts" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_photo_hotspots" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_photo_hotspots" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_photo_views" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_photo_views" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_readiness_exceptions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_readiness_exceptions" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_scba_check_entries" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_scba_check_entries" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_scba_templates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_scba_templates" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_stock_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_stock_items" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_stock_lots" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_stock_lots" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_transactions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_transactions" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_work_order_documents" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_work_order_documents" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_work_orders" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."inventory_work_orders" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."platform_owners" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."platform_owners" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."portal_access_emails" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."portal_access_emails" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."portal_invite_admins" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."portal_invite_admins" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."portal_pin_credentials" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."portal_pin_credentials" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."push_subscriptions" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."user_profiles" NO FORCE ROW LEVEL SECURITY;

CREATE POLICY "own_location_lease" ON "firehouse"."apparatus_location_view_leases" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "apparatus_trackers_server_only" ON "firehouse"."apparatus_trackers" AS PERMISSIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);

CREATE POLICY "no_direct_feed_access" ON "firehouse"."board_feed_cache" AS PERMISSIVE FOR ALL TO "anon", "authenticated" USING (false) WITH CHECK (false);

CREATE POLICY "stickney_portal_access_box_cards" ON "firehouse"."box_cards" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_cad_inbound_receipts" ON "firehouse"."cad_inbound_receipts" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "callback_payroll_aggregates_department_access" ON "firehouse"."callback_payroll_aggregates" AS PERMISSIVE FOR ALL TO "authenticated" USING (firehouse.has_department_access()) WITH CHECK (firehouse.has_department_access());

CREATE POLICY "callback_review_settings_department_access" ON "firehouse"."callback_review_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING (firehouse.has_department_access()) WITH CHECK (firehouse.has_department_access());

CREATE POLICY "stickney_portal_access_chief_board_attachments" ON "firehouse"."chief_board_attachments" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_chief_board_items" ON "firehouse"."chief_board_items" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_daily_duties" ON "firehouse"."daily_duties" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_daily_log_approvals" ON "firehouse"."daily_log_approvals" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "daily_log_callbacks_department_access" ON "firehouse"."daily_log_callback_submissions" AS PERMISSIVE FOR ALL TO "authenticated" USING (firehouse.has_department_access()) WITH CHECK (firehouse.has_department_access());

CREATE POLICY "stickney_portal_access_daily_log_calls" ON "firehouse"."daily_log_calls" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_daily_log_staffing" ON "firehouse"."daily_log_staffing" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_daily_logs" ON "firehouse"."daily_logs" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_dispatch_incidents" ON "firehouse"."dispatch_incidents" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_employee_permission_overrides" ON "firehouse"."employee_permission_overrides" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_employee_profiles" ON "firehouse"."employee_profiles" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_employees" ON "firehouse"."employees" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_field_hydrant_flow_tests" ON "firehouse"."field_hydrant_flow_tests" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_field_hydrant_flushes" ON "firehouse"."field_hydrant_flushes" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "field_workspace_department_access" ON "firehouse"."field_hydrant_service_events" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "field_workspace_server_boundary" ON "firehouse"."field_hydrant_service_events" AS RESTRICTIVE FOR ALL TO "authenticated" USING (( SELECT private.portal_server_request() AS portal_server_request)) WITH CHECK (( SELECT private.portal_server_request() AS portal_server_request));

CREATE POLICY "stickney_portal_access_field_hydrants" ON "firehouse"."field_hydrants" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "field_preplan_alerts_department_access" ON "firehouse"."field_preplan_alerts" AS PERMISSIVE FOR ALL TO "authenticated" USING (firehouse.has_department_access()) WITH CHECK (firehouse.has_department_access());

CREATE POLICY "field_preplan_annotations_department_access" ON "firehouse"."field_preplan_annotations" AS PERMISSIVE FOR ALL TO "authenticated" USING (firehouse.has_department_access()) WITH CHECK (firehouse.has_department_access());

CREATE POLICY "field_preplan_assets_department_access" ON "firehouse"."field_preplan_assets" AS PERMISSIVE FOR ALL TO "authenticated" USING (firehouse.has_department_access()) WITH CHECK (firehouse.has_department_access());

CREATE POLICY "field_workspace_department_access" ON "firehouse"."field_preplan_external_details" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "field_workspace_server_boundary" ON "firehouse"."field_preplan_external_details" AS RESTRICTIVE FOR ALL TO "authenticated" USING (( SELECT private.portal_server_request() AS portal_server_request)) WITH CHECK (( SELECT private.portal_server_request() AS portal_server_request));

CREATE POLICY "field_preplan_feature_levels_department_access" ON "firehouse"."field_preplan_feature_levels" AS PERMISSIVE FOR ALL TO "authenticated" USING (firehouse.has_department_access()) WITH CHECK (firehouse.has_department_access());

CREATE POLICY "stickney_portal_access_field_preplan_features" ON "firehouse"."field_preplan_features" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "field_preplan_hazmat_department_access" ON "firehouse"."field_preplan_hazmat" AS PERMISSIVE FOR ALL TO "authenticated" USING (firehouse.has_department_access()) WITH CHECK (firehouse.has_department_access());

CREATE POLICY "field_preplan_hazmat_zones_department_access" ON "firehouse"."field_preplan_hazmat_zones" AS PERMISSIVE FOR ALL TO "authenticated" USING (firehouse.has_department_access()) WITH CHECK (firehouse.has_department_access());

CREATE POLICY "field_preplan_hose_lays_department_access" ON "firehouse"."field_preplan_hose_lays" AS PERMISSIVE FOR ALL TO "authenticated" USING (firehouse.has_department_access()) WITH CHECK (firehouse.has_department_access());

CREATE POLICY "stickney_portal_access_field_preplan_imports" ON "firehouse"."field_preplan_imports" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "field_preplan_levels_department_access" ON "firehouse"."field_preplan_levels" AS PERMISSIVE FOR ALL TO "authenticated" USING (firehouse.has_department_access()) WITH CHECK (firehouse.has_department_access());

CREATE POLICY "field_workspace_department_access" ON "firehouse"."field_preplan_observations" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "field_workspace_server_boundary" ON "firehouse"."field_preplan_observations" AS RESTRICTIVE FOR ALL TO "authenticated" USING (( SELECT private.portal_server_request() AS portal_server_request)) WITH CHECK (( SELECT private.portal_server_request() AS portal_server_request));

CREATE POLICY "field_preplan_photo_annotations_department_access" ON "firehouse"."field_preplan_photo_annotations" AS PERMISSIVE FOR ALL TO "authenticated" USING (firehouse.has_department_access()) WITH CHECK (firehouse.has_department_access());

CREATE POLICY "stickney_portal_access_field_preplan_photos" ON "firehouse"."field_preplan_photos" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "field_preplan_reviews_department_access" ON "firehouse"."field_preplan_reviews" AS PERMISSIVE FOR ALL TO "authenticated" USING (firehouse.has_department_access()) WITH CHECK (firehouse.has_department_access());

CREATE POLICY "field_preplan_revisions_department_access" ON "firehouse"."field_preplan_revisions" AS PERMISSIVE FOR ALL TO "authenticated" USING (firehouse.has_department_access()) WITH CHECK (firehouse.has_department_access());

CREATE POLICY "field_preplan_risk_factors_department_access" ON "firehouse"."field_preplan_risk_factors" AS PERMISSIVE FOR ALL TO "authenticated" USING (firehouse.has_department_access()) WITH CHECK (firehouse.has_department_access());

CREATE POLICY "field_preplan_settings_department_access" ON "firehouse"."field_preplan_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING (firehouse.has_department_access()) WITH CHECK (firehouse.has_department_access());

CREATE POLICY "field_preplan_spaces_department_access" ON "firehouse"."field_preplan_spaces" AS PERMISSIVE FOR ALL TO "authenticated" USING (firehouse.has_department_access()) WITH CHECK (firehouse.has_department_access());

CREATE POLICY "stickney_portal_access_field_preplans" ON "firehouse"."field_preplans" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_fleet_apparatus" ON "firehouse"."fleet_apparatus" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_important_phone_numbers" ON "firehouse"."important_phone_numbers" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_incident_command_boards" ON "firehouse"."incident_command_boards" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_incident_command_events" ON "firehouse"."incident_command_events" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_inventory_audit_events" ON "firehouse"."inventory_audit_events" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_inventory_compartments" ON "firehouse"."inventory_compartments" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_inventory_equipment" ON "firehouse"."inventory_equipment" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_inventory_hotspots" ON "firehouse"."inventory_hotspots" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_inventory_photos" ON "firehouse"."inventory_photos" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_inventory_readiness" ON "firehouse"."inventory_readiness" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_inventory_weekly_check_items" ON "firehouse"."inventory_weekly_check_items" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_inventory_weekly_check_results" ON "firehouse"."inventory_weekly_check_results" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_inventory_weekly_check_templates" ON "firehouse"."inventory_weekly_check_templates" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_inventory_weekly_checks" ON "firehouse"."inventory_weekly_checks" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "own_operational_lease" ON "firehouse"."operational_view_leases" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "stickney_portal_access_pay_periods" ON "firehouse"."pay_periods" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_pay_rate_history" ON "firehouse"."pay_rate_history" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_pay_scales" ON "firehouse"."pay_scales" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_payroll_settings" ON "firehouse"."payroll_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_policies" ON "firehouse"."policies" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "portal_login_audit_deny_direct" ON "firehouse"."portal_login_audit" AS RESTRICTIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);

CREATE POLICY "portal_login_audit_status_deny_direct" ON "firehouse"."portal_login_audit_status" AS RESTRICTIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);

CREATE POLICY "stickney_member_owns_push_subscription" ON "firehouse"."push_subscriptions" AS PERMISSIVE FOR ALL TO "authenticated" USING ((( SELECT firehouse.has_department_access() AS has_department_access) AND (user_id = (( SELECT auth.uid() AS uid))::text))) WITH CHECK ((( SELECT firehouse.has_department_access() AS has_department_access) AND (user_id = (( SELECT auth.uid() AS uid))::text)));

CREATE POLICY "stickney_portal_access_rank_permissions" ON "firehouse"."rank_permissions" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_record_revisions" ON "firehouse"."record_revisions" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "road_closures_department_access" ON "firehouse"."road_closures" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_safety_inspection_attachments" ON "firehouse"."safety_inspection_attachments" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_safety_inspection_results" ON "firehouse"."safety_inspection_results" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_safety_inspection_template_items" ON "firehouse"."safety_inspection_template_items" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_safety_inspection_templates" ON "firehouse"."safety_inspection_templates" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_safety_inspections" ON "firehouse"."safety_inspections" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_schedule_assignments" ON "firehouse"."schedule_assignments" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_schedule_coverage_rules" ON "firehouse"."schedule_coverage_rules" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_schedule_notification_rules" ON "firehouse"."schedule_notification_rules" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_schedule_notifications" ON "firehouse"."schedule_notifications" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_schedule_requests" ON "firehouse"."schedule_requests" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_schedule_rotation_members" ON "firehouse"."schedule_rotation_members" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_schedule_rotations" ON "firehouse"."schedule_rotations" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_schedule_shift_patterns" ON "firehouse"."schedule_shift_patterns" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_schedule_staffing_overrides" ON "firehouse"."schedule_staffing_overrides" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_system_meta" ON "firehouse"."system_meta" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_time_entries" ON "firehouse"."time_entries" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_work_detail_members" ON "firehouse"."work_detail_members" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_work_detail_postings" ON "firehouse"."work_detail_postings" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "stickney_portal_access_work_detail_requests" ON "firehouse"."work_detail_requests" AS PERMISSIVE FOR ALL TO "authenticated" USING (( SELECT firehouse.has_department_access() AS has_department_access)) WITH CHECK (( SELECT firehouse.has_department_access() AS has_department_access));

CREATE POLICY "department_apparatus_delete_department" ON "public"."department_apparatus" AS PERMISSIVE FOR DELETE TO "authenticated" USING (can_manage_department(department_id));

CREATE POLICY "department_apparatus_insert_department" ON "public"."department_apparatus" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (can_manage_department(department_id));

CREATE POLICY "department_apparatus_select_department" ON "public"."department_apparatus" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((department_id IN ( SELECT current_department_ids() AS current_department_ids)));

CREATE POLICY "department_apparatus_update_department" ON "public"."department_apparatus" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (can_manage_department(department_id)) WITH CHECK (can_manage_department(department_id));

CREATE POLICY "portal_apparatus_setup" ON "public"."department_apparatus" AS PERMISSIVE FOR ALL TO "authenticated" USING (((department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) AND private.portal_has_permission('inventory.setup.manage'::text))) WITH CHECK (((department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) AND private.portal_has_permission('inventory.setup.manage'::text)));

CREATE POLICY "portal_server_boundary" ON "public"."department_apparatus" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request))) WITH CHECK (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request)));

CREATE POLICY "Platform owners can update all invites" ON "public"."department_invites" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_platform_owner()) WITH CHECK (is_platform_owner());

CREATE POLICY "Platform owners can view all invites" ON "public"."department_invites" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_platform_owner());

CREATE POLICY "department admins can create invites" ON "public"."department_invites" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (can_manage_department(department_id));

CREATE POLICY "department admins can update invites" ON "public"."department_invites" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (can_manage_department(department_id)) WITH CHECK (can_manage_department(department_id));

CREATE POLICY "department admins can view invites" ON "public"."department_invites" AS PERMISSIVE FOR SELECT TO PUBLIC USING (can_manage_department(department_id));

CREATE POLICY "portal_employee_invites" ON "public"."department_invites" AS PERMISSIVE FOR ALL TO "authenticated" USING (((department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) AND private.portal_has_permission('employees.manage'::text))) WITH CHECK (((department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) AND private.portal_has_permission('employees.manage'::text)));

CREATE POLICY "portal_invite_boundary" ON "public"."department_invites" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR private.portal_has_permission('employees.manage'::text))) WITH CHECK (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR private.portal_has_permission('employees.manage'::text)));

CREATE POLICY "Platform owners can update memberships" ON "public"."department_memberships" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_platform_owner()) WITH CHECK (is_platform_owner());

CREATE POLICY "Platform owners can view all memberships" ON "public"."department_memberships" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_platform_owner());

CREATE POLICY "department admins can insert memberships" ON "public"."department_memberships" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (can_manage_department(department_id));

CREATE POLICY "department admins can update memberships" ON "public"."department_memberships" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (can_manage_department(department_id)) WITH CHECK (can_manage_department(department_id));

CREATE POLICY "department_memberships_phase7_admin_peer_select" ON "public"."department_memberships" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((status = 'active'::membership_status) AND ((current_department_role(department_id) = ANY (ARRAY['admin'::department_role, 'chief'::department_role])) OR COALESCE(is_platform_owner(), false))));

CREATE POLICY "department_memberships_select_self_preplan360" ON "public"."department_memberships" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "members can view active memberships in their departments" ON "public"."department_memberships" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((department_id IN ( SELECT current_department_ids() AS current_department_ids)));

CREATE POLICY "Platform owners can view all departments" ON "public"."departments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_platform_owner());

CREATE POLICY "departments_select_own_membership_preplan360" ON "public"."departments" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM department_memberships membership
  WHERE ((membership.department_id = departments.id) AND (membership.user_id = ( SELECT auth.uid() AS uid)) AND (membership.status = 'active'::membership_status)))));

CREATE POLICY "managers_update_departments" ON "public"."departments" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (can_manage_department(id)) WITH CHECK (can_manage_department(id));

CREATE POLICY "members can view their departments" ON "public"."departments" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((id IN ( SELECT current_department_ids() AS current_department_ids)));

CREATE POLICY "disciplinary_staging_access" ON "public"."disciplinary_import_staging" AS PERMISSIVE FOR ALL TO "authenticated" USING (((created_by = ( SELECT auth.uid() AS uid)) AND disciplinary_import_access(department_id))) WITH CHECK (((created_by = ( SELECT auth.uid() AS uid)) AND disciplinary_import_access(department_id)));

CREATE POLICY "disciplinary_files_insert" ON "public"."disciplinary_report_files" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((disciplinary_access(department_id) AND (uploaded_by = ( SELECT auth.uid() AS uid)) AND (object_key ~~ ((((((department_id)::text || '/'::text) || (report_id)::text) || '/'::text) || (id)::text) || '.%'::text))));

CREATE POLICY "disciplinary_files_read" ON "public"."disciplinary_report_files" AS PERMISSIVE FOR SELECT TO "authenticated" USING (disciplinary_access(department_id));

CREATE POLICY "disciplinary_versions_read" ON "public"."disciplinary_report_versions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (disciplinary_access(department_id));

CREATE POLICY "disciplinary_reports_insert" ON "public"."disciplinary_reports" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((disciplinary_access(department_id) AND (created_by = ( SELECT auth.uid() AS uid))));

CREATE POLICY "disciplinary_reports_read" ON "public"."disciplinary_reports" AS PERMISSIVE FOR SELECT TO "authenticated" USING (disciplinary_access(department_id));

CREATE POLICY "disciplinary_reports_update" ON "public"."disciplinary_reports" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (disciplinary_access(department_id)) WITH CHECK (disciplinary_access(department_id));

CREATE POLICY "inventory_apparatus_profiles_insert" ON "public"."inventory_apparatus_profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "inventory_apparatus_profiles_select" ON "public"."inventory_apparatus_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
CASE
    WHEN (department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) THEN ( SELECT private.inventory_can_access('14a76771-4c24-481b-8def-e6cce005c17b'::uuid) AS inventory_can_access)
    ELSE private.inventory_can_access(department_id)
END);

CREATE POLICY "inventory_apparatus_profiles_update" ON "public"."inventory_apparatus_profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.inventory_can_write(department_id)) WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "portal_server_boundary" ON "public"."inventory_apparatus_profiles" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request))) WITH CHECK (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request)));

CREATE POLICY "inventory_audit_events_insert" ON "public"."inventory_audit_events" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "inventory_audit_events_select" ON "public"."inventory_audit_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
CASE
    WHEN (department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) THEN ( SELECT private.inventory_can_access('14a76771-4c24-481b-8def-e6cce005c17b'::uuid) AS inventory_can_access)
    ELSE private.inventory_can_access(department_id)
END);

CREATE POLICY "inventory_audit_events_update" ON "public"."inventory_audit_events" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.inventory_can_write(department_id)) WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "portal_server_boundary" ON "public"."inventory_audit_events" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request))) WITH CHECK (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request)));

CREATE POLICY "inventory_check_archives_insert" ON "public"."inventory_check_archives" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.inventory_can_admin(department_id));

CREATE POLICY "inventory_check_archives_read" ON "public"."inventory_check_archives" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM inventory_checks c
  WHERE ((c.id = inventory_check_archives.check_id) AND (c.department_id = inventory_check_archives.department_id)))));

CREATE POLICY "portal_server_boundary" ON "public"."inventory_check_archives" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request))) WITH CHECK (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request)));

CREATE POLICY "inventory_check_items_insert" ON "public"."inventory_check_items" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "inventory_check_items_select" ON "public"."inventory_check_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
CASE
    WHEN (department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) THEN ( SELECT private.inventory_can_access('14a76771-4c24-481b-8def-e6cce005c17b'::uuid) AS inventory_can_access)
    ELSE private.inventory_can_access(department_id)
END);

CREATE POLICY "inventory_check_items_update" ON "public"."inventory_check_items" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.inventory_can_write(department_id)) WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "portal_server_boundary" ON "public"."inventory_check_items" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request))) WITH CHECK (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request)));

CREATE POLICY "inventory_checks_insert" ON "public"."inventory_checks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "inventory_checks_select" ON "public"."inventory_checks" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
CASE
    WHEN (department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) THEN ( SELECT private.inventory_can_access('14a76771-4c24-481b-8def-e6cce005c17b'::uuid) AS inventory_can_access)
    ELSE private.inventory_can_access(department_id)
END);

CREATE POLICY "inventory_checks_update" ON "public"."inventory_checks" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.inventory_can_write(department_id)) WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "portal_server_boundary" ON "public"."inventory_checks" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request))) WITH CHECK (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request)));

CREATE POLICY "inventory_compartments_insert" ON "public"."inventory_compartments" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "inventory_compartments_select" ON "public"."inventory_compartments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
CASE
    WHEN (department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) THEN ( SELECT private.inventory_can_access('14a76771-4c24-481b-8def-e6cce005c17b'::uuid) AS inventory_can_access)
    ELSE private.inventory_can_access(department_id)
END);

CREATE POLICY "inventory_compartments_update" ON "public"."inventory_compartments" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.inventory_can_write(department_id)) WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "portal_server_boundary" ON "public"."inventory_compartments" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request))) WITH CHECK (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request)));

CREATE POLICY "inventory_deficiency_photos_insert" ON "public"."inventory_deficiency_photos" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "inventory_deficiency_photos_select" ON "public"."inventory_deficiency_photos" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
CASE
    WHEN (department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) THEN ( SELECT private.inventory_can_access('14a76771-4c24-481b-8def-e6cce005c17b'::uuid) AS inventory_can_access)
    ELSE private.inventory_can_access(department_id)
END);

CREATE POLICY "inventory_deficiency_photos_update" ON "public"."inventory_deficiency_photos" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.inventory_can_write(department_id)) WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "portal_server_boundary" ON "public"."inventory_deficiency_photos" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request))) WITH CHECK (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request)));

CREATE POLICY "inventory_equipment_insert" ON "public"."inventory_equipment" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "inventory_equipment_select" ON "public"."inventory_equipment" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
CASE
    WHEN (department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) THEN ( SELECT private.inventory_can_access('14a76771-4c24-481b-8def-e6cce005c17b'::uuid) AS inventory_can_access)
    ELSE private.inventory_can_access(department_id)
END);

CREATE POLICY "inventory_equipment_update" ON "public"."inventory_equipment" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.inventory_can_write(department_id)) WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "portal_server_boundary" ON "public"."inventory_equipment" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request))) WITH CHECK (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request)));

CREATE POLICY "inventory_inspection_schedules_delete" ON "public"."inventory_inspection_schedules" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.inventory_can_write(department_id));

CREATE POLICY "inventory_inspection_schedules_insert" ON "public"."inventory_inspection_schedules" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "inventory_inspection_schedules_select" ON "public"."inventory_inspection_schedules" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
CASE
    WHEN (department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) THEN ( SELECT private.inventory_can_access('14a76771-4c24-481b-8def-e6cce005c17b'::uuid) AS inventory_can_access)
    ELSE private.inventory_can_access(department_id)
END);

CREATE POLICY "inventory_inspection_schedules_update" ON "public"."inventory_inspection_schedules" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.inventory_can_write(department_id)) WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "portal_server_boundary" ON "public"."inventory_inspection_schedules" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request))) WITH CHECK (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request)));

CREATE POLICY "inventory_location_change_requests_insert" ON "public"."inventory_location_change_requests" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((private.inventory_can_write(department_id) AND (requested_by = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text)));

CREATE POLICY "inventory_location_change_requests_select" ON "public"."inventory_location_change_requests" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
CASE
    WHEN (department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) THEN ( SELECT private.inventory_can_access('14a76771-4c24-481b-8def-e6cce005c17b'::uuid) AS inventory_can_access)
    ELSE private.inventory_can_access(department_id)
END);

CREATE POLICY "inventory_location_change_requests_update" ON "public"."inventory_location_change_requests" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.inventory_can_admin(department_id)) WITH CHECK (private.inventory_can_admin(department_id));

CREATE POLICY "portal_server_boundary" ON "public"."inventory_location_change_requests" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request))) WITH CHECK (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request)));

CREATE POLICY "inventory_receipts_insert" ON "public"."inventory_operation_receipts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((actor_id = ( SELECT auth.uid() AS uid)) AND private.inventory_can_write(department_id)));

CREATE POLICY "inventory_receipts_read" ON "public"."inventory_operation_receipts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((actor_id = ( SELECT auth.uid() AS uid)) AND private.inventory_can_access(department_id)));

CREATE POLICY "portal_server_boundary" ON "public"."inventory_operation_receipts" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request))) WITH CHECK (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request)));

CREATE POLICY "inventory_photo_hotspots_insert" ON "public"."inventory_photo_hotspots" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "inventory_photo_hotspots_select" ON "public"."inventory_photo_hotspots" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
CASE
    WHEN (department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) THEN ( SELECT private.inventory_can_access('14a76771-4c24-481b-8def-e6cce005c17b'::uuid) AS inventory_can_access)
    ELSE private.inventory_can_access(department_id)
END);

CREATE POLICY "inventory_photo_hotspots_update" ON "public"."inventory_photo_hotspots" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.inventory_can_write(department_id)) WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "portal_server_boundary" ON "public"."inventory_photo_hotspots" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request))) WITH CHECK (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request)));

CREATE POLICY "inventory_photo_views_insert" ON "public"."inventory_photo_views" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "inventory_photo_views_select" ON "public"."inventory_photo_views" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
CASE
    WHEN (department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) THEN ( SELECT private.inventory_can_access('14a76771-4c24-481b-8def-e6cce005c17b'::uuid) AS inventory_can_access)
    ELSE private.inventory_can_access(department_id)
END);

CREATE POLICY "inventory_photo_views_update" ON "public"."inventory_photo_views" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.inventory_can_write(department_id)) WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "portal_server_boundary" ON "public"."inventory_photo_views" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request))) WITH CHECK (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request)));

CREATE POLICY "inventory_readiness_exceptions_insert" ON "public"."inventory_readiness_exceptions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "inventory_readiness_exceptions_select" ON "public"."inventory_readiness_exceptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
CASE
    WHEN (department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) THEN ( SELECT private.inventory_can_access('14a76771-4c24-481b-8def-e6cce005c17b'::uuid) AS inventory_can_access)
    ELSE private.inventory_can_access(department_id)
END);

CREATE POLICY "inventory_readiness_exceptions_update" ON "public"."inventory_readiness_exceptions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.inventory_can_write(department_id)) WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "portal_server_boundary" ON "public"."inventory_readiness_exceptions" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request))) WITH CHECK (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request)));

CREATE POLICY "inventory_scba_check_entries_insert" ON "public"."inventory_scba_check_entries" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "inventory_scba_check_entries_select" ON "public"."inventory_scba_check_entries" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
CASE
    WHEN (department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) THEN ( SELECT private.inventory_can_access('14a76771-4c24-481b-8def-e6cce005c17b'::uuid) AS inventory_can_access)
    ELSE private.inventory_can_access(department_id)
END);

CREATE POLICY "inventory_scba_check_entries_update" ON "public"."inventory_scba_check_entries" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.inventory_can_write(department_id)) WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "portal_server_boundary" ON "public"."inventory_scba_check_entries" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request))) WITH CHECK (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request)));

CREATE POLICY "inventory_scba_templates_delete" ON "public"."inventory_scba_templates" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.inventory_can_admin(department_id));

CREATE POLICY "inventory_scba_templates_insert" ON "public"."inventory_scba_templates" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.inventory_can_admin(department_id));

CREATE POLICY "inventory_scba_templates_select" ON "public"."inventory_scba_templates" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
CASE
    WHEN (department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) THEN ( SELECT private.inventory_can_access('14a76771-4c24-481b-8def-e6cce005c17b'::uuid) AS inventory_can_access)
    ELSE private.inventory_can_access(department_id)
END);

CREATE POLICY "inventory_scba_templates_update" ON "public"."inventory_scba_templates" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.inventory_can_admin(department_id)) WITH CHECK (private.inventory_can_admin(department_id));

CREATE POLICY "portal_server_boundary" ON "public"."inventory_scba_templates" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request))) WITH CHECK (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request)));

CREATE POLICY "inventory_stock_items_insert" ON "public"."inventory_stock_items" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "inventory_stock_items_select" ON "public"."inventory_stock_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
CASE
    WHEN (department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) THEN ( SELECT private.inventory_can_access('14a76771-4c24-481b-8def-e6cce005c17b'::uuid) AS inventory_can_access)
    ELSE private.inventory_can_access(department_id)
END);

CREATE POLICY "inventory_stock_items_update" ON "public"."inventory_stock_items" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.inventory_can_write(department_id)) WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "portal_server_boundary" ON "public"."inventory_stock_items" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request))) WITH CHECK (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request)));

CREATE POLICY "inventory_stock_lots_insert" ON "public"."inventory_stock_lots" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "inventory_stock_lots_select" ON "public"."inventory_stock_lots" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
CASE
    WHEN (department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) THEN ( SELECT private.inventory_can_access('14a76771-4c24-481b-8def-e6cce005c17b'::uuid) AS inventory_can_access)
    ELSE private.inventory_can_access(department_id)
END);

CREATE POLICY "inventory_stock_lots_update" ON "public"."inventory_stock_lots" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.inventory_can_write(department_id)) WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "portal_server_boundary" ON "public"."inventory_stock_lots" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request))) WITH CHECK (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request)));

CREATE POLICY "inventory_transactions_insert" ON "public"."inventory_transactions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "inventory_transactions_select" ON "public"."inventory_transactions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
CASE
    WHEN (department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) THEN ( SELECT private.inventory_can_access('14a76771-4c24-481b-8def-e6cce005c17b'::uuid) AS inventory_can_access)
    ELSE private.inventory_can_access(department_id)
END);

CREATE POLICY "inventory_transactions_update" ON "public"."inventory_transactions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.inventory_can_write(department_id)) WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "portal_server_boundary" ON "public"."inventory_transactions" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request))) WITH CHECK (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request)));

CREATE POLICY "inventory_work_order_documents_delete" ON "public"."inventory_work_order_documents" AS PERMISSIVE FOR DELETE TO "authenticated" USING (private.inventory_can_write(department_id));

CREATE POLICY "inventory_work_order_documents_insert" ON "public"."inventory_work_order_documents" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "inventory_work_order_documents_select" ON "public"."inventory_work_order_documents" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
CASE
    WHEN (department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) THEN ( SELECT private.inventory_can_access('14a76771-4c24-481b-8def-e6cce005c17b'::uuid) AS inventory_can_access)
    ELSE private.inventory_can_access(department_id)
END);

CREATE POLICY "inventory_work_order_documents_update" ON "public"."inventory_work_order_documents" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.inventory_can_write(department_id)) WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "portal_server_boundary" ON "public"."inventory_work_order_documents" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request))) WITH CHECK (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request)));

CREATE POLICY "inventory_work_orders_insert" ON "public"."inventory_work_orders" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "inventory_work_orders_select" ON "public"."inventory_work_orders" AS PERMISSIVE FOR SELECT TO "authenticated" USING (
CASE
    WHEN (department_id = '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) THEN ( SELECT private.inventory_can_access('14a76771-4c24-481b-8def-e6cce005c17b'::uuid) AS inventory_can_access)
    ELSE private.inventory_can_access(department_id)
END);

CREATE POLICY "inventory_work_orders_update" ON "public"."inventory_work_orders" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (private.inventory_can_write(department_id)) WITH CHECK (private.inventory_can_write(department_id));

CREATE POLICY "portal_server_boundary" ON "public"."inventory_work_orders" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request))) WITH CHECK (((department_id <> '14a76771-4c24-481b-8def-e6cce005c17b'::uuid) OR ( SELECT private.portal_server_request() AS portal_server_request)));

CREATE POLICY "Platform owners can view owners" ON "public"."platform_owners" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_platform_owner());

CREATE POLICY "Invited portal users can read their own approval" ON "public"."portal_access_emails" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((email = lower(COALESCE((( SELECT auth.jwt() AS jwt) ->> 'email'::text), ''::text))));

CREATE POLICY "PIN credentials deny direct access" ON "public"."portal_pin_credentials" AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

CREATE POLICY "Users can add their own push subscriptions" ON "public"."push_subscriptions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (department_id IN ( SELECT current_department_ids() AS current_department_ids))));

CREATE POLICY "Users can delete their own push subscriptions" ON "public"."push_subscriptions" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((user_id = ( SELECT auth.uid() AS uid)) OR can_manage_department(department_id)));

CREATE POLICY "Users can update their own push subscriptions" ON "public"."push_subscriptions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((user_id = ( SELECT auth.uid() AS uid)) OR can_manage_department(department_id))) WITH CHECK ((((user_id = ( SELECT auth.uid() AS uid)) OR can_manage_department(department_id)) AND (department_id IN ( SELECT current_department_ids() AS current_department_ids))));

CREATE POLICY "Users can view department push subscriptions" ON "public"."push_subscriptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = ( SELECT auth.uid() AS uid)) OR can_manage_department(department_id)));

CREATE POLICY "Department members view peer profiles" ON "public"."user_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id IN ( SELECT peer.user_id
   FROM department_memberships peer
  WHERE ((peer.department_id IN ( SELECT current_department_ids() AS current_department_ids)) AND (peer.status = 'active'::membership_status)))));

CREATE POLICY "Platform owners view all profiles" ON "public"."user_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_platform_owner());

CREATE POLICY "Users create their own profile" ON "public"."user_profiles" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users update their own profile" ON "public"."user_profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Users view their own profile" ON "public"."user_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "department_portal_files_delete" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'firehouse-portal'::text) AND private.department_storage_access(name)));

CREATE POLICY "department_portal_files_insert" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'firehouse-portal'::text) AND private.department_storage_access(name)));

CREATE POLICY "department_portal_files_read" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'firehouse-portal'::text) AND private.department_storage_access(name)));

CREATE POLICY "department_portal_files_update" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'firehouse-portal'::text) AND private.department_storage_access(name))) WITH CHECK (((bucket_id = 'firehouse-portal'::text) AND private.department_storage_access(name)));

CREATE POLICY "disciplinary_objects_anon_guard" ON "storage"."objects" AS RESTRICTIVE FOR ALL TO "anon" USING ((bucket_id <> 'stickney-disciplinary-private'::text)) WITH CHECK ((bucket_id <> 'stickney-disciplinary-private'::text));

CREATE POLICY "disciplinary_objects_insert" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'stickney-disciplinary-private'::text) AND (EXISTS ( SELECT 1
   FROM disciplinary_reports r
  WHERE (((r.department_id)::text = (storage.foldername(objects.name))[1]) AND ((r.id)::text = (storage.foldername(objects.name))[2]) AND disciplinary_access(r.department_id))))));

CREATE POLICY "disciplinary_objects_insert_guard" ON "storage"."objects" AS RESTRICTIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id <> 'stickney-disciplinary-private'::text) OR (EXISTS ( SELECT 1
   FROM disciplinary_reports r
  WHERE (((r.department_id)::text = (storage.foldername(objects.name))[1]) AND ((r.id)::text = (storage.foldername(objects.name))[2]) AND disciplinary_access(r.department_id)))) OR (EXISTS ( SELECT 1
   FROM disciplinary_import_staging s
  WHERE ((s.object_key = objects.name) AND (s.created_by = auth.uid()) AND disciplinary_import_access(s.department_id))))));

CREATE POLICY "disciplinary_objects_no_delete" ON "storage"."objects" AS RESTRICTIVE FOR DELETE TO PUBLIC USING ((bucket_id <> 'stickney-disciplinary-private'::text));

CREATE POLICY "disciplinary_objects_no_replace" ON "storage"."objects" AS RESTRICTIVE FOR UPDATE TO PUBLIC USING ((bucket_id <> 'stickney-disciplinary-private'::text)) WITH CHECK ((bucket_id <> 'stickney-disciplinary-private'::text));

CREATE POLICY "disciplinary_objects_read" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'stickney-disciplinary-private'::text) AND (EXISTS ( SELECT 1
   FROM disciplinary_report_files f
  WHERE ((f.object_key = objects.name) AND disciplinary_access(f.department_id))))));

CREATE POLICY "disciplinary_objects_read_guard" ON "storage"."objects" AS RESTRICTIVE FOR SELECT TO "authenticated" USING (((bucket_id <> 'stickney-disciplinary-private'::text) OR (EXISTS ( SELECT 1
   FROM disciplinary_report_files f
  WHERE ((f.object_key = objects.name) AND disciplinary_access(f.department_id)))) OR (EXISTS ( SELECT 1
   FROM disciplinary_import_staging s
  WHERE ((s.object_key = objects.name) AND (s.created_by = auth.uid()) AND disciplinary_import_access(s.department_id))))));

CREATE POLICY "disciplinary_staging_objects_insert" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'stickney-disciplinary-private'::text) AND (EXISTS ( SELECT 1
   FROM disciplinary_import_staging s
  WHERE ((s.object_key = objects.name) AND (s.created_by = auth.uid()) AND disciplinary_import_access(s.department_id))))));

CREATE POLICY "disciplinary_staging_objects_read" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'stickney-disciplinary-private'::text) AND (EXISTS ( SELECT 1
   FROM disciplinary_import_staging s
  WHERE ((s.object_key = objects.name) AND (s.created_by = auth.uid()) AND disciplinary_import_access(s.department_id))))));

CREATE POLICY "fire_inspection_backup_storage_insert" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'stickney-fire-inspections-backups'::text) AND ( SELECT private.fire_inspection_pilot_allowed() AS fire_inspection_pilot_allowed) AND (split_part(name, '/'::text, 1) IN ( SELECT (current_department_ids())::text AS current_department_ids))));

CREATE POLICY "fire_inspection_backup_storage_read" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'stickney-fire-inspections-backups'::text) AND ( SELECT private.fire_inspection_pilot_allowed() AS fire_inspection_pilot_allowed) AND (split_part(name, '/'::text, 1) IN ( SELECT (current_department_ids())::text AS current_department_ids))));

CREATE POLICY "fire_inspection_eso_insert" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'stickney-fire-inspections-eso'::text) AND ( SELECT private.fire_inspection_pilot_allowed() AS fire_inspection_pilot_allowed) AND (split_part(name, '/'::text, 1) IN ( SELECT (current_department_ids())::text AS current_department_ids))));

CREATE POLICY "fire_inspection_eso_read" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'stickney-fire-inspections-eso'::text) AND ( SELECT private.fire_inspection_pilot_allowed() AS fire_inspection_pilot_allowed) AND (split_part(name, '/'::text, 1) IN ( SELECT (current_department_ids())::text AS current_department_ids))));

CREATE POLICY "fire_inspection_pilot_storage_delete" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'stickney-fire-inspections-pilot'::text) AND ( SELECT private.fire_inspection_pilot_allowed() AS fire_inspection_pilot_allowed)));

CREATE POLICY "fire_inspection_pilot_storage_insert" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'stickney-fire-inspections-pilot'::text) AND ( SELECT private.fire_inspection_pilot_allowed() AS fire_inspection_pilot_allowed)));

CREATE POLICY "fire_inspection_pilot_storage_read" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'stickney-fire-inspections-pilot'::text) AND ( SELECT private.fire_inspection_pilot_allowed() AS fire_inspection_pilot_allowed)));

CREATE POLICY "neris_pilot_storage_delete" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'stickney-neris-pilot'::text) AND ( SELECT private.neris_pilot_allowed() AS neris_pilot_allowed)));

CREATE POLICY "neris_pilot_storage_insert" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'stickney-neris-pilot'::text) AND ( SELECT private.neris_pilot_allowed() AS neris_pilot_allowed)));

CREATE POLICY "neris_pilot_storage_read" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'stickney-neris-pilot'::text) AND ( SELECT private.neris_pilot_allowed() AS neris_pilot_allowed)));

CREATE POLICY "portal_storage_boundary" ON "storage"."objects" AS RESTRICTIVE FOR ALL TO "authenticated" USING (((bucket_id <> ALL (ARRAY['firehouse-portal'::text, 'stickney-inventory-media'::text])) OR ( SELECT private.portal_server_request() AS portal_server_request))) WITH CHECK (((bucket_id <> ALL (ARRAY['firehouse-portal'::text, 'stickney-inventory-media'::text])) OR ( SELECT private.portal_server_request() AS portal_server_request)));

CREATE POLICY "shared_published_preplan_files_read" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'firehouse-portal'::text) AND private.shared_preplan_storage_read(name)));

CREATE POLICY "stickney_firehouse_portal_delete" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'firehouse-portal'::text) AND ( SELECT firehouse.has_department_access() AS has_department_access)));

CREATE POLICY "stickney_firehouse_portal_insert" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'firehouse-portal'::text) AND ( SELECT firehouse.has_department_access() AS has_department_access)));

CREATE POLICY "stickney_firehouse_portal_read" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'firehouse-portal'::text) AND ( SELECT firehouse.has_department_access() AS has_department_access)));

CREATE POLICY "stickney_firehouse_portal_update" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'firehouse-portal'::text) AND ( SELECT firehouse.has_department_access() AS has_department_access))) WITH CHECK (((bucket_id = 'firehouse-portal'::text) AND ( SELECT firehouse.has_department_access() AS has_department_access)));

CREATE POLICY "stickney_inventory_media_delete" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'stickney-inventory-media'::text) AND private.inventory_can_write(((storage.foldername(name))[1])::uuid)));

CREATE POLICY "stickney_inventory_media_insert" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'stickney-inventory-media'::text) AND private.inventory_can_write(((storage.foldername(name))[1])::uuid)));

CREATE POLICY "stickney_inventory_media_select" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'stickney-inventory-media'::text) AND private.inventory_can_access(((storage.foldername(name))[1])::uuid)));

CREATE POLICY "stickney_inventory_media_update" ON "storage"."objects" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (((bucket_id = 'stickney-inventory-media'::text) AND private.inventory_can_write(((storage.foldername(name))[1])::uuid))) WITH CHECK (((bucket_id = 'stickney-inventory-media'::text) AND private.inventory_can_write(((storage.foldername(name))[1])::uuid)));

CREATE POLICY "stickney_legacy_storage_private" ON "storage"."objects" AS RESTRICTIVE FOR ALL TO "anon", "authenticated" USING ((bucket_id <> 'stickney-legacy-archive'::text)) WITH CHECK ((bucket_id <> 'stickney-legacy-archive'::text));

CREATE POLICY "training_pilot_storage_delete" ON "storage"."objects" AS PERMISSIVE FOR DELETE TO "authenticated" USING (((bucket_id = 'stickney-training-pilot'::text) AND ( SELECT private.training_pilot_allowed() AS training_pilot_allowed)));

CREATE POLICY "training_pilot_storage_insert" ON "storage"."objects" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((bucket_id = 'stickney-training-pilot'::text) AND ( SELECT private.training_pilot_allowed() AS training_pilot_allowed)));

CREATE POLICY "training_pilot_storage_read" ON "storage"."objects" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((bucket_id = 'stickney-training-pilot'::text) AND ( SELECT private.training_pilot_allowed() AS training_pilot_allowed)));

REVOKE ALL ON TABLE "firehouse"."apparatus_location_view_leases" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."apparatus_trackers" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."background_job_runs" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."board_feed_cache" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."box_cards" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."cad_inbound_receipts" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."cad_push_deliveries" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."cad_push_events" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."callback_payroll_aggregates" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."callback_review_settings" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."chief_board_attachments" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."chief_board_items" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."daily_duties" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."daily_log_approvals" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."daily_log_callback_submissions" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."daily_log_calls" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."daily_log_staffing" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."daily_logs" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."dispatch_incidents" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."employee_account_links" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."employee_permission_overrides" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."employee_profiles" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."employees" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_hydrant_flow_tests" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_hydrant_flushes" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_hydrant_service_events" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_hydrants" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_preplan_alerts" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_preplan_annotations" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_preplan_assets" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_preplan_external_details" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_preplan_feature_levels" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_preplan_features" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_preplan_hazmat" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_preplan_hazmat_zones" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_preplan_hose_lays" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_preplan_imports" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_preplan_levels" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_preplan_observations" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_preplan_photo_annotations" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_preplan_photos" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_preplan_reviews" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_preplan_revisions" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_preplan_risk_factors" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_preplan_settings" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_preplan_spaces" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."field_preplans" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."fire_inspection_backup_audit" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."fire_inspection_backup_entries" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."fire_inspection_backup_jobs" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."fire_inspection_backup_rows" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."fire_inspection_code_audit" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."fire_inspection_code_entries" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."fire_inspection_email_deliveries" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."fire_inspection_eso_files" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."fire_inspection_eso_records" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."fire_inspection_pilot_audit" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."fire_inspection_pilot_files" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."fire_inspection_pilot_records" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."fire_inspection_staff_audit" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."fire_inspection_staff_members" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."fire_inspection_staff_mutations" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."fire_inspection_staff_workspaces" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."fleet_apparatus" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."important_phone_numbers" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."incident_command_boards" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."incident_command_events" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."inventory_audit_events" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."inventory_compartments" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."inventory_equipment" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."inventory_hotspots" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."inventory_photos" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."inventory_readiness" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."inventory_weekly_check_items" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."inventory_weekly_check_results" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."inventory_weekly_check_templates" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."inventory_weekly_checks" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."neris_pilot_audit" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."neris_pilot_files" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."neris_pilot_records" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."operational_cad_recovery" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."operational_program_audit" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."operational_program_records" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."operational_revisions" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."operational_view_leases" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."pay_periods" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."pay_rate_history" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."pay_scales" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."payroll_adjustments" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."payroll_settings" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."payroll_source_version" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."payroll_submissions" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."policies" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."portal_activation_attempts" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."portal_confirmation_messages" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."portal_confirmation_receipts" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."portal_confirmation_setting" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."portal_login_audit" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON SEQUENCE "firehouse"."portal_login_audit_id_seq" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."portal_login_audit_status" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."push_subscriptions" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."rank_permissions" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."record_revisions" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."road_closures" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."safety_inspection_attachments" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."safety_inspection_results" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."safety_inspection_template_items" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."safety_inspection_templates" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."safety_inspections" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."schedule_assignments" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."schedule_coverage_rules" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."schedule_notification_rules" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."schedule_notifications" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."schedule_requests" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."schedule_rotation_members" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."schedule_rotations" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."schedule_shift_patterns" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."schedule_staffing_overrides" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."scheduler_push_deliveries" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."scheduler_push_events" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."scheduler_reminder_slots" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."station_availability" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."station_distribution_weights" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."station_ot_interest" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."station_ot_offers" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."station_ot_settings" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."station_ot_timing" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."station_reminder_rules" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."station_schedule_entries" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."station_shift_claims" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."station_shift_slots" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."station_shift_type_roles" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."station_shift_types" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."station_standing_assignments" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."station_time_off_dates" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."station_time_off_requests" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."station_trade_requests" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."station_unavailability" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."stickney_inventory_apparatus" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."stickney_inventory_check_items" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."stickney_inventory_checks" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."stickney_inventory_compartments" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."stickney_inventory_equipment" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."stickney_inventory_photo_views" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."stickney_inventory_readiness_exceptions" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."stickney_inventory_work_orders" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."system_meta" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."time_entries" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."training_pilot_audit" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."training_pilot_files" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."training_pilot_records" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."training_report_views" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."work_detail_members" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."work_detail_postings" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."work_detail_requests" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."workspace_review_audit" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "firehouse"."workspace_review_records" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "private"."department_portals" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "private"."portal_remembered_devices" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."department_apparatus" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."department_invites" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."department_memberships" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."departments" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."disciplinary_import_staging" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."disciplinary_report_files" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."disciplinary_report_versions" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."disciplinary_reports" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."inventory_apparatus_profiles" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."inventory_audit_events" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."inventory_check_archives" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."inventory_check_items" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."inventory_checks" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."inventory_compartments" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."inventory_deficiency_photos" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."inventory_equipment" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."inventory_inspection_schedules" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."inventory_location_change_requests" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."inventory_operation_receipts" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."inventory_photo_hotspots" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."inventory_photo_views" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."inventory_readiness_exceptions" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."inventory_scba_check_entries" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."inventory_scba_templates" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."inventory_stock_items" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."inventory_stock_lots" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."inventory_transactions" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."inventory_work_order_documents" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."inventory_work_orders" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."platform_owners" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."portal_access_emails" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."portal_invite_admins" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."portal_pin_credentials" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."push_subscriptions" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE "public"."user_profiles" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON SCHEMA "department_gateway" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON SCHEMA "firehouse" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON SCHEMA "private" FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON SCHEMA "public" FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION "department_gateway"."department_firehouse_server_sql"(p_department uuid, p_sql text, p_mode text, p_secret text) TO "anon";

GRANT EXECUTE ON FUNCTION "department_gateway"."department_firehouse_server_sql"(p_department uuid, p_sql text, p_mode text, p_secret text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "department_gateway"."department_firehouse_server_sql"(p_department uuid, p_sql text, p_mode text, p_secret text) TO "postgres";

GRANT EXECUTE ON FUNCTION "department_gateway"."department_firehouse_sql"(p_department uuid, p_sql text, p_mode text, p_secret text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "department_gateway"."department_firehouse_sql"(p_department uuid, p_sql text, p_mode text, p_secret text) TO "postgres";

GRANT EXECUTE ON FUNCTION "department_gateway"."department_portal_confirmation_status"(p_department uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "department_gateway"."department_portal_confirmation_status"(p_department uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "department_gateway"."department_portal_directory"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "department_gateway"."department_portal_directory"() TO "postgres";

GRANT EXECUTE ON FUNCTION "department_gateway"."department_portal_for_host"(p_host text) TO "anon";

GRANT EXECUTE ON FUNCTION "department_gateway"."department_portal_for_host"(p_host text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "department_gateway"."department_portal_for_host"(p_host text) TO "postgres";

GRANT EXECUTE ON FUNCTION "department_gateway"."department_shared_preplan_file"(p_viewer uuid, p_source uuid, p_file text, p_kind text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "department_gateway"."department_shared_preplan_file"(p_viewer uuid, p_source uuid, p_file text, p_kind text) TO "postgres";

GRANT EXECUTE ON FUNCTION "department_gateway"."department_shared_preplans"(p_viewer uuid, p_source uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "department_gateway"."department_shared_preplans"(p_viewer uuid, p_source uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."apparatus_location_fleet"(p_department uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."apparatus_location_topic"(p_department uuid, p_now timestamp with time zone) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."bump_daily_log_version"() TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."bump_linked_log_version"() TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."bump_permissions_revision"() TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."cad_push_recipient_allowed"(department uuid, recipient text) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."check_payroll_submission_target"() TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."claim_board_feed"(p_source text, p_now timestamp with time zone) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."claim_cad_push"(batch_size integer, incident text) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."claim_operational_cad_recovery"(p_department uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."claim_scheduler_push"() TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."confirm_portal_message"(expected uuid, recipient uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."employee_account_setup"() TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."employee_id_for_login"(p_email text) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."enable_cad_push_outbox"() TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."enqueue_cad_push"() TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."enqueue_scheduler_push"() TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."execute_portal_sql"(p_sql text, p_mode text, p_secret text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "firehouse"."execute_portal_sql"(p_sql text, p_mode text, p_secret text) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."execute_portal_sql"(p_sql text, p_mode text, p_secret text) TO "service_role";

GRANT EXECUTE ON FUNCTION "firehouse"."execute_server_portal_sql"(p_sql text, p_mode text, p_secret text) TO "anon";

GRANT EXECUTE ON FUNCTION "firehouse"."execute_server_portal_sql"(p_sql text, p_mode text, p_secret text) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."finish_board_feed"(p_source text, p_attempt uuid, p_payload_base64 text, p_error text) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."finish_cad_push_batch"(encoded text) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."finish_scheduler_push_batch"(encoded text) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."guard_new_station_trade"() TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."has_department_access"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "firehouse"."has_department_access"() TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."has_department_access"() TO "service_role";

GRANT EXECUTE ON FUNCTION "firehouse"."ingest_apparatus_location"(p_hash text, p_fix_base64 text, p_now timestamp with time zone) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."issue_apparatus_location_lease"(p_department uuid, p_user uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."issue_operational_view_lease"(p_department uuid, p_user uuid, p_scopes text[]) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."keep_payroll_submission_immutable"() TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."keep_submitted_attendance_open"() TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."link_employee_account"(p_user uuid, p_employee text, p_actor text) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."next_board_feed_slot"(p_source text, p_now timestamp with time zone) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."notify_operational_change"() TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."operational_topic"(p_department uuid, p_scope text, p_now timestamp with time zone) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."pair_apparatus_tracker"(p_department uuid, p_apparatus text, p_hash text, p_device_base64 text) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."payroll_sources_will_change"() TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."protect_finalized_time_entry"() TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."publish_apparatus_location"() TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."save_portal_confirmation"(encoded text) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."scheduler_claim_deadline_guard"() TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."scheduler_push_permission"(recipient text, permission text) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."scheduler_push_recipient_allowed"(event firehouse.scheduler_push_events, recipient text) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."scheduler_reminder_candidates"(kind_filter text, id_filter text) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."scheduler_reminder_changed"() TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."scheduler_reminder_due"(anchor timestamp without time zone, changed_at timestamp with time zone, timing text) TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."system_health_login_audit"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "firehouse"."system_health_login_audit"() TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."system_health_usage"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "firehouse"."system_health_usage"() TO "postgres";

GRANT EXECUTE ON FUNCTION "firehouse"."verify_portal_login"(p_email text, p_pin text, p_department_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."apply_inventory_location_change"() TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."audit_inventory_location_change"() TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."department_execute_sql"(p_department uuid, p_sql text, p_mode text) TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."department_portal_access"(p_department uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."department_shared_snapshot"(p_viewer uuid, p_source uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."department_storage_access"(p_name text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "private"."department_storage_access"(p_name text) TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."disciplinary_guard_report"() TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."disciplinary_keep_version"() TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."fire_inspection_pilot_allowed"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "private"."fire_inspection_pilot_allowed"() TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."fire_inspection_staff_allowed"(p_department text, p_permission text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "private"."fire_inspection_staff_allowed"(p_department text, p_permission text) TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."fire_inspection_staff_case_allowed"(p_department text, p_record text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "private"."fire_inspection_staff_case_allowed"(p_department text, p_record text) TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."forget_own_portal_device"(p_unlock_token text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "private"."forget_own_portal_device"(p_unlock_token text) TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."initialize_department_forms"() TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."inventory_can_access"(target_department_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "private"."inventory_can_access"(target_department_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."inventory_can_admin"(target_department_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "private"."inventory_can_admin"(target_department_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."inventory_can_write"(target_department_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "private"."inventory_can_write"(target_department_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."inventory_validate_service_schedule"() TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."neris_pilot_allowed"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "private"."neris_pilot_allowed"() TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."portal_confirmation_status"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "private"."portal_confirmation_status"() TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."portal_has_permission"(permission text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "private"."portal_has_permission"(permission text) TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."portal_remembered_until"(p_unlock_token text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "private"."portal_remembered_until"(p_unlock_token text) TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."portal_server_request"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "private"."portal_server_request"() TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."provision_department_portal"() TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."shared_preplan_storage_read"(p_name text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "private"."shared_preplan_storage_read"(p_name text) TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."training_pilot_allowed"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "private"."training_pilot_allowed"() TO "postgres";

GRANT EXECUTE ON FUNCTION "private"."verify_portal_pin_with_device"(p_pin text, p_department_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "private"."verify_portal_pin_with_device"(p_pin text, p_department_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."accept_department_invite"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."accept_department_invite"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."accept_department_invite"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."activate_roster_portal_user"(p_user_id uuid, p_email text, p_department_id uuid, p_role department_role, p_pin text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."activate_roster_portal_user"(p_user_id uuid, p_email text, p_department_id uuid, p_role department_role, p_pin text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."can_manage_department"(target_department_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."can_manage_department"(target_department_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."can_manage_department"(target_department_id uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."create_department_with_admin"(p_name text, p_slug text, p_city text, p_state text, p_county text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."create_department_with_admin"(p_name text, p_slug text, p_city text, p_state text, p_county text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_department_with_admin"(p_name text, p_slug text, p_city text, p_state text, p_county text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."current_department_ids"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."current_department_ids"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."current_department_ids"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."current_department_role"(target_department_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."current_department_role"(target_department_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."current_department_role"(target_department_id uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."department_firehouse_server_sql"(p_department uuid, p_sql text, p_mode text, p_secret text) TO "anon";

GRANT EXECUTE ON FUNCTION "public"."department_firehouse_server_sql"(p_department uuid, p_sql text, p_mode text, p_secret text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."department_firehouse_server_sql"(p_department uuid, p_sql text, p_mode text, p_secret text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."department_firehouse_server_sql"(p_department uuid, p_sql text, p_mode text, p_secret text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."department_firehouse_sql"(p_department uuid, p_sql text, p_mode text, p_secret text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."department_firehouse_sql"(p_department uuid, p_sql text, p_mode text, p_secret text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."department_firehouse_sql_batch"(p_department uuid, p_statements jsonb, p_secret text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."department_firehouse_sql_batch"(p_department uuid, p_statements jsonb, p_secret text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."department_portal_confirmation_status"(p_department uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."department_portal_confirmation_status"(p_department uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."department_portal_directory"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."department_portal_directory"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."department_portal_for_host"(p_host text) TO "anon";

GRANT EXECUTE ON FUNCTION "public"."department_portal_for_host"(p_host text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."department_portal_for_host"(p_host text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."department_portal_for_host"(p_host text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."department_shared_preplan_file"(p_viewer uuid, p_source uuid, p_file text, p_kind text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."department_shared_preplan_file"(p_viewer uuid, p_source uuid, p_file text, p_kind text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."department_shared_preplans"(p_viewer uuid, p_source uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."department_shared_preplans"(p_viewer uuid, p_source uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."disciplinary_access"(p_department uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."disciplinary_access"(p_department uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."disciplinary_access"(p_department uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."disciplinary_import_access"(p_department uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."disciplinary_import_access"(p_department uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."disciplinary_import_access"(p_department uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."disciplinary_import_finish"(p_department uuid, p_stage uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."disciplinary_import_finish"(p_department uuid, p_stage uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."disciplinary_import_finish"(p_department uuid, p_stage uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."disciplinary_import_prepare"(p_department uuid, p_source jsonb) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."disciplinary_import_prepare"(p_department uuid, p_source jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."disciplinary_import_prepare"(p_department uuid, p_source jsonb) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."disciplinary_save"(p_department uuid, p_id uuid, p_version integer, p_content jsonb, p_status text, p_reason text, p_operation uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."disciplinary_save"(p_department uuid, p_id uuid, p_version integer, p_content jsonb, p_status text, p_reason text, p_operation uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."disciplinary_save"(p_department uuid, p_id uuid, p_version integer, p_content jsonb, p_status text, p_reason text, p_operation uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."firehouse_server_sql"(p_sql text, p_mode text, p_secret text) TO "anon";

GRANT EXECUTE ON FUNCTION "public"."firehouse_server_sql"(p_sql text, p_mode text, p_secret text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."firehouse_server_sql_batch"(p_statements jsonb, p_secret text) TO "anon";

GRANT EXECUTE ON FUNCTION "public"."firehouse_server_sql_batch"(p_statements jsonb, p_secret text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."firehouse_sql"(p_sql text, p_mode text, p_secret text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."firehouse_sql"(p_sql text, p_mode text, p_secret text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."firehouse_sql"(p_sql text, p_mode text, p_secret text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."firehouse_sql_batch"(p_statements jsonb, p_secret text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."firehouse_sql_batch"(p_statements jsonb, p_secret text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."firehouse_sql_batch"(p_statements jsonb, p_secret text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."forget_own_portal_device"(p_unlock_token text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."forget_own_portal_device"(p_unlock_token text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."forget_own_portal_device"(p_unlock_token text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."inventory_air_check_history"(p_department uuid, p_equipment uuid, p_before_time timestamp with time zone, p_before_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."inventory_air_check_history"(p_department uuid, p_equipment uuid, p_before_time timestamp with time zone, p_before_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."inventory_air_check_history"(p_department uuid, p_equipment uuid, p_before_time timestamp with time zone, p_before_id uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."inventory_apply_operation"(p_department_id uuid, p_request_id uuid, p_action text, p_input jsonb) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."inventory_apply_operation"(p_department_id uuid, p_request_id uuid, p_action text, p_input jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."inventory_apply_operation"(p_department_id uuid, p_request_id uuid, p_action text, p_input jsonb) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."inventory_check_history_page"(p_department uuid, p_apparatus uuid, p_type text, p_review text, p_from date, p_to date, p_before_time timestamp with time zone, p_before_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."inventory_check_history_page"(p_department uuid, p_apparatus uuid, p_type text, p_review text, p_from date, p_to date, p_before_time timestamp with time zone, p_before_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."inventory_check_history_page"(p_department uuid, p_apparatus uuid, p_type text, p_review text, p_from date, p_to date, p_before_time timestamp with time zone, p_before_id uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."inventory_check_report"(p_department uuid, p_check uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."inventory_check_report"(p_department uuid, p_check uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."inventory_check_report"(p_department uuid, p_check uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."inventory_complete_check_atomic"(p_department_id uuid, p_check_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."inventory_complete_check_atomic"(p_department_id uuid, p_check_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."inventory_drug_outcome"(s jsonb, r jsonb, complete boolean) TO "anon";

GRANT EXECUTE ON FUNCTION "public"."inventory_drug_outcome"(s jsonb, r jsonb, complete boolean) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."inventory_drug_outcome"(s jsonb, r jsonb, complete boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."inventory_drug_outcome"(s jsonb, r jsonb, complete boolean) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."inventory_guard_active_result"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."inventory_guard_archive_insert"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."inventory_guard_archive_insert"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."inventory_guard_archive_insert"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."inventory_guard_archived_check"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."inventory_guard_archived_check"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."inventory_guard_archived_check"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."inventory_guard_archived_item"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."inventory_guard_archived_item"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."inventory_guard_archived_item"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."inventory_guard_drug_item"() TO "anon";

GRANT EXECUTE ON FUNCTION "public"."inventory_guard_drug_item"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."inventory_guard_drug_item"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."inventory_guard_drug_item"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."inventory_guard_meter_item"() TO "anon";

GRANT EXECUTE ON FUNCTION "public"."inventory_guard_meter_item"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."inventory_guard_meter_item"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."inventory_guard_meter_item"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."inventory_live_check_packet"(p_department uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."inventory_live_check_packet"(p_department uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."inventory_live_check_packet"(p_department uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."inventory_log_air_maintenance"(p_department uuid, p_equipment uuid, p_id uuid, p_record jsonb) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."inventory_log_air_maintenance"(p_department uuid, p_equipment uuid, p_id uuid, p_record jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."inventory_log_air_maintenance"(p_department uuid, p_equipment uuid, p_id uuid, p_record jsonb) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."inventory_meter_outcome"(p_response jsonb, p_complete boolean) TO "anon";

GRANT EXECUTE ON FUNCTION "public"."inventory_meter_outcome"(p_response jsonb, p_complete boolean) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."inventory_meter_outcome"(p_response jsonb, p_complete boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."inventory_meter_outcome"(p_response jsonb, p_complete boolean) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."inventory_record_item_atomic"(p_department_id uuid, p_check_item_id uuid, p_result text, p_notes text, p_numeric_reading numeric, p_evidence_photo_id uuid, p_categories text[], p_assigned_ids text[], p_assigned_names text[]) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."inventory_record_item_atomic"(p_department_id uuid, p_check_item_id uuid, p_result text, p_notes text, p_numeric_reading numeric, p_evidence_photo_id uuid, p_categories text[], p_assigned_ids text[], p_assigned_names text[]) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."inventory_restart_weekly_check"(p_department uuid, p_check uuid, p_reason text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."inventory_restart_weekly_check"(p_department uuid, p_check uuid, p_reason text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."inventory_restart_weekly_check"(p_department uuid, p_check uuid, p_reason text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."inventory_save_air_asset"(p_department uuid, p_id uuid, p_expected_updated_at timestamp with time zone, p_asset jsonb) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."inventory_save_air_asset"(p_department uuid, p_id uuid, p_expected_updated_at timestamp with time zone, p_asset jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."inventory_save_air_asset"(p_department uuid, p_id uuid, p_expected_updated_at timestamp with time zone, p_asset jsonb) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."inventory_save_drug_atomic"(p_department_id uuid, p_item_id uuid, p_response text, p_expected_version integer, p_complete boolean, p_photo_id uuid) TO "anon";

GRANT EXECUTE ON FUNCTION "public"."inventory_save_drug_atomic"(p_department_id uuid, p_item_id uuid, p_response text, p_expected_version integer, p_complete boolean, p_photo_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."inventory_save_drug_atomic"(p_department_id uuid, p_item_id uuid, p_response text, p_expected_version integer, p_complete boolean, p_photo_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."inventory_save_drug_atomic"(p_department_id uuid, p_item_id uuid, p_response text, p_expected_version integer, p_complete boolean, p_photo_id uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."inventory_save_meter_atomic"(p_department_id uuid, p_item_id uuid, p_response text, p_expected_version integer, p_complete boolean, p_notes text, p_photo_id uuid) TO "anon";

GRANT EXECUTE ON FUNCTION "public"."inventory_save_meter_atomic"(p_department_id uuid, p_item_id uuid, p_response text, p_expected_version integer, p_complete boolean, p_notes text, p_photo_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."inventory_save_meter_atomic"(p_department_id uuid, p_item_id uuid, p_response text, p_expected_version integer, p_complete boolean, p_notes text, p_photo_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."inventory_save_meter_atomic"(p_department_id uuid, p_item_id uuid, p_response text, p_expected_version integer, p_complete boolean, p_notes text, p_photo_id uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."inventory_save_meter_template"(p_department_id uuid, p_equipment_id uuid, p_expected_version integer, p_title text, p_instructions text) TO "anon";

GRANT EXECUTE ON FUNCTION "public"."inventory_save_meter_template"(p_department_id uuid, p_equipment_id uuid, p_expected_version integer, p_title text, p_instructions text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."inventory_save_meter_template"(p_department_id uuid, p_equipment_id uuid, p_expected_version integer, p_title text, p_instructions text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."inventory_save_meter_template"(p_department_id uuid, p_equipment_id uuid, p_expected_version integer, p_title text, p_instructions text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."inventory_start_air_check"(p_department uuid, p_apparatus uuid, p_shift text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."inventory_start_air_check"(p_department uuid, p_apparatus uuid, p_shift text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."inventory_start_air_check"(p_department uuid, p_apparatus uuid, p_shift text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."is_platform_owner"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."is_platform_owner"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."is_platform_owner"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."portal_confirmation_status"() TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."portal_confirmation_status"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."portal_pin_status"(p_unlock_token text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."portal_pin_status"(p_unlock_token text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."portal_pin_status"(p_unlock_token text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."portal_remembered_device_status"(p_unlock_token text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."portal_remembered_device_status"(p_unlock_token text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."portal_remembered_device_status"(p_unlock_token text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."renew_own_portal_pin_unlock"(p_unlock_token text, p_station_display boolean) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."renew_own_portal_pin_unlock"(p_unlock_token text, p_station_display boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."renew_own_portal_pin_unlock"(p_unlock_token text, p_station_display boolean) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."set_portal_pin"(p_pin text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."set_portal_pin"(p_pin text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_portal_pin"(p_pin text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."verify_portal_pin"(p_pin text) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."verify_portal_pin"(p_pin text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."verify_portal_pin"(p_pin text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."verify_portal_pin_for_login"(p_email text, p_pin text, p_department_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."verify_portal_pin_for_login"(p_email text, p_pin text, p_department_id uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."verify_portal_pin_with_device"(p_pin text, p_department_id uuid) TO "authenticated";

GRANT EXECUTE ON FUNCTION "public"."verify_portal_pin_with_device"(p_pin text, p_department_id uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."verify_portal_pin_with_device"(p_pin text, p_department_id uuid) TO "service_role";

GRANT USAGE ON SCHEMA "department_gateway" TO "anon";

GRANT USAGE ON SCHEMA "department_gateway" TO "authenticated";

GRANT CREATE ON SCHEMA "department_gateway" TO "postgres";

GRANT USAGE ON SCHEMA "department_gateway" TO "postgres";

GRANT USAGE ON SCHEMA "firehouse" TO "anon";

GRANT USAGE ON SCHEMA "firehouse" TO "authenticated";

GRANT CREATE ON SCHEMA "firehouse" TO "postgres";

GRANT USAGE ON SCHEMA "firehouse" TO "postgres";

GRANT USAGE ON SCHEMA "firehouse" TO "service_role";

GRANT USAGE ON SCHEMA "private" TO "authenticated";

GRANT CREATE ON SCHEMA "private" TO "postgres";

GRANT USAGE ON SCHEMA "private" TO "postgres";

GRANT USAGE ON SCHEMA "public" TO PUBLIC;

GRANT USAGE ON SCHEMA "public" TO "anon";

GRANT USAGE ON SCHEMA "public" TO "authenticated";

GRANT CREATE ON SCHEMA "public" TO "pg_database_owner";

GRANT USAGE ON SCHEMA "public" TO "pg_database_owner";

GRANT USAGE ON SCHEMA "public" TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT SELECT ON SEQUENCE "firehouse"."portal_login_audit_id_seq" TO "postgres";

GRANT UPDATE ON SEQUENCE "firehouse"."portal_login_audit_id_seq" TO "postgres";

GRANT USAGE ON SEQUENCE "firehouse"."portal_login_audit_id_seq" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."apparatus_location_view_leases" TO "authenticated";

GRANT DELETE ON TABLE "firehouse"."apparatus_location_view_leases" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."apparatus_location_view_leases" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."apparatus_location_view_leases" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."apparatus_location_view_leases" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."apparatus_location_view_leases" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."apparatus_location_view_leases" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."apparatus_location_view_leases" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."apparatus_location_view_leases" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."apparatus_trackers" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."apparatus_trackers" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."apparatus_trackers" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."apparatus_trackers" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."apparatus_trackers" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."apparatus_trackers" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."apparatus_trackers" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."apparatus_trackers" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."background_job_runs" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."background_job_runs" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."background_job_runs" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."background_job_runs" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."background_job_runs" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."background_job_runs" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."background_job_runs" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."background_job_runs" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."board_feed_cache" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."board_feed_cache" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."board_feed_cache" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."board_feed_cache" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."board_feed_cache" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."board_feed_cache" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."board_feed_cache" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."board_feed_cache" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."box_cards" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."box_cards" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."box_cards" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."box_cards" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."box_cards" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."box_cards" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."box_cards" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."box_cards" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."cad_inbound_receipts" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."cad_inbound_receipts" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."cad_inbound_receipts" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."cad_inbound_receipts" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."cad_inbound_receipts" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."cad_inbound_receipts" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."cad_inbound_receipts" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."cad_inbound_receipts" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."cad_push_deliveries" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."cad_push_deliveries" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."cad_push_deliveries" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."cad_push_deliveries" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."cad_push_deliveries" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."cad_push_deliveries" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."cad_push_deliveries" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."cad_push_deliveries" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."cad_push_events" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."cad_push_events" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."cad_push_events" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."cad_push_events" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."cad_push_events" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."cad_push_events" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."cad_push_events" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."cad_push_events" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."callback_payroll_aggregates" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."callback_payroll_aggregates" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."callback_payroll_aggregates" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."callback_payroll_aggregates" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."callback_payroll_aggregates" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."callback_payroll_aggregates" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."callback_payroll_aggregates" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."callback_payroll_aggregates" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."callback_review_settings" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."callback_review_settings" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."callback_review_settings" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."callback_review_settings" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."callback_review_settings" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."callback_review_settings" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."callback_review_settings" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."callback_review_settings" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."chief_board_attachments" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."chief_board_attachments" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."chief_board_attachments" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."chief_board_attachments" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."chief_board_attachments" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."chief_board_attachments" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."chief_board_attachments" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."chief_board_attachments" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."chief_board_items" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."chief_board_items" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."chief_board_items" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."chief_board_items" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."chief_board_items" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."chief_board_items" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."chief_board_items" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."chief_board_items" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."daily_duties" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."daily_duties" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."daily_duties" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."daily_duties" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."daily_duties" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."daily_duties" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."daily_duties" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."daily_duties" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."daily_log_approvals" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."daily_log_approvals" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."daily_log_approvals" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."daily_log_approvals" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."daily_log_approvals" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."daily_log_approvals" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."daily_log_approvals" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."daily_log_approvals" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."daily_log_callback_submissions" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."daily_log_callback_submissions" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."daily_log_callback_submissions" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."daily_log_callback_submissions" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."daily_log_callback_submissions" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."daily_log_callback_submissions" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."daily_log_callback_submissions" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."daily_log_callback_submissions" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."daily_log_calls" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."daily_log_calls" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."daily_log_calls" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."daily_log_calls" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."daily_log_calls" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."daily_log_calls" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."daily_log_calls" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."daily_log_calls" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."daily_log_staffing" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."daily_log_staffing" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."daily_log_staffing" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."daily_log_staffing" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."daily_log_staffing" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."daily_log_staffing" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."daily_log_staffing" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."daily_log_staffing" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."daily_logs" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."daily_logs" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."daily_logs" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."daily_logs" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."daily_logs" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."daily_logs" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."daily_logs" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."daily_logs" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."dispatch_incidents" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."dispatch_incidents" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."dispatch_incidents" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."dispatch_incidents" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."dispatch_incidents" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."dispatch_incidents" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."dispatch_incidents" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."dispatch_incidents" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."employee_account_links" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."employee_account_links" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."employee_account_links" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."employee_account_links" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."employee_account_links" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."employee_account_links" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."employee_account_links" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."employee_account_links" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."employee_permission_overrides" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."employee_permission_overrides" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."employee_permission_overrides" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."employee_permission_overrides" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."employee_permission_overrides" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."employee_permission_overrides" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."employee_permission_overrides" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."employee_permission_overrides" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."employee_profiles" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."employee_profiles" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."employee_profiles" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."employee_profiles" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."employee_profiles" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."employee_profiles" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."employee_profiles" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."employee_profiles" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."employees" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."employees" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."employees" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."employees" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."employees" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."employees" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."employees" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."employees" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_hydrant_flow_tests" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_hydrant_flow_tests" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_hydrant_flow_tests" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_hydrant_flow_tests" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_hydrant_flow_tests" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_hydrant_flow_tests" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_hydrant_flow_tests" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_hydrant_flow_tests" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_hydrant_flushes" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_hydrant_flushes" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_hydrant_flushes" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_hydrant_flushes" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_hydrant_flushes" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_hydrant_flushes" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_hydrant_flushes" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_hydrant_flushes" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_hydrant_service_events" TO "authenticated";

GRANT INSERT ON TABLE "firehouse"."field_hydrant_service_events" TO "authenticated";

GRANT SELECT ON TABLE "firehouse"."field_hydrant_service_events" TO "authenticated";

GRANT UPDATE ON TABLE "firehouse"."field_hydrant_service_events" TO "authenticated";

GRANT DELETE ON TABLE "firehouse"."field_hydrant_service_events" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_hydrant_service_events" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_hydrant_service_events" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_hydrant_service_events" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_hydrant_service_events" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_hydrant_service_events" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_hydrant_service_events" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_hydrant_service_events" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_hydrants" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_hydrants" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_hydrants" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_hydrants" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_hydrants" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_hydrants" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_hydrants" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_hydrants" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_preplan_alerts" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_preplan_alerts" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_preplan_alerts" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_preplan_alerts" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_preplan_alerts" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_preplan_alerts" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_preplan_alerts" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_preplan_alerts" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_preplan_annotations" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_preplan_annotations" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_preplan_annotations" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_preplan_annotations" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_preplan_annotations" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_preplan_annotations" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_preplan_annotations" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_preplan_annotations" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_preplan_assets" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_preplan_assets" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_preplan_assets" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_preplan_assets" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_preplan_assets" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_preplan_assets" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_preplan_assets" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_preplan_assets" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_preplan_external_details" TO "authenticated";

GRANT INSERT ON TABLE "firehouse"."field_preplan_external_details" TO "authenticated";

GRANT SELECT ON TABLE "firehouse"."field_preplan_external_details" TO "authenticated";

GRANT UPDATE ON TABLE "firehouse"."field_preplan_external_details" TO "authenticated";

GRANT DELETE ON TABLE "firehouse"."field_preplan_external_details" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_preplan_external_details" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_preplan_external_details" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_preplan_external_details" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_preplan_external_details" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_preplan_external_details" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_preplan_external_details" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_preplan_external_details" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_preplan_feature_levels" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_preplan_feature_levels" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_preplan_feature_levels" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_preplan_feature_levels" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_preplan_feature_levels" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_preplan_feature_levels" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_preplan_feature_levels" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_preplan_feature_levels" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_preplan_features" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_preplan_features" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_preplan_features" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_preplan_features" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_preplan_features" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_preplan_features" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_preplan_features" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_preplan_features" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_preplan_hazmat" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_preplan_hazmat" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_preplan_hazmat" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_preplan_hazmat" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_preplan_hazmat" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_preplan_hazmat" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_preplan_hazmat" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_preplan_hazmat" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_preplan_hazmat_zones" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_preplan_hazmat_zones" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_preplan_hazmat_zones" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_preplan_hazmat_zones" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_preplan_hazmat_zones" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_preplan_hazmat_zones" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_preplan_hazmat_zones" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_preplan_hazmat_zones" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_preplan_hose_lays" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_preplan_hose_lays" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_preplan_hose_lays" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_preplan_hose_lays" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_preplan_hose_lays" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_preplan_hose_lays" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_preplan_hose_lays" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_preplan_hose_lays" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_preplan_imports" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_preplan_imports" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_preplan_imports" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_preplan_imports" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_preplan_imports" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_preplan_imports" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_preplan_imports" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_preplan_imports" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_preplan_levels" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_preplan_levels" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_preplan_levels" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_preplan_levels" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_preplan_levels" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_preplan_levels" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_preplan_levels" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_preplan_levels" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_preplan_observations" TO "authenticated";

GRANT INSERT ON TABLE "firehouse"."field_preplan_observations" TO "authenticated";

GRANT SELECT ON TABLE "firehouse"."field_preplan_observations" TO "authenticated";

GRANT UPDATE ON TABLE "firehouse"."field_preplan_observations" TO "authenticated";

GRANT DELETE ON TABLE "firehouse"."field_preplan_observations" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_preplan_observations" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_preplan_observations" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_preplan_observations" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_preplan_observations" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_preplan_observations" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_preplan_observations" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_preplan_observations" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_preplan_photo_annotations" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_preplan_photo_annotations" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_preplan_photo_annotations" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_preplan_photo_annotations" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_preplan_photo_annotations" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_preplan_photo_annotations" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_preplan_photo_annotations" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_preplan_photo_annotations" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_preplan_photos" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_preplan_photos" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_preplan_photos" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_preplan_photos" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_preplan_photos" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_preplan_photos" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_preplan_photos" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_preplan_photos" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_preplan_reviews" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_preplan_reviews" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_preplan_reviews" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_preplan_reviews" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_preplan_reviews" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_preplan_reviews" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_preplan_reviews" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_preplan_reviews" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_preplan_revisions" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_preplan_revisions" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_preplan_revisions" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_preplan_revisions" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_preplan_revisions" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_preplan_revisions" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_preplan_revisions" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_preplan_revisions" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_preplan_risk_factors" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_preplan_risk_factors" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_preplan_risk_factors" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_preplan_risk_factors" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_preplan_risk_factors" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_preplan_risk_factors" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_preplan_risk_factors" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_preplan_risk_factors" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_preplan_settings" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_preplan_settings" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_preplan_settings" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_preplan_settings" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_preplan_settings" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_preplan_settings" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_preplan_settings" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_preplan_settings" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_preplan_spaces" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_preplan_spaces" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_preplan_spaces" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_preplan_spaces" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_preplan_spaces" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_preplan_spaces" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_preplan_spaces" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_preplan_spaces" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."field_preplans" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."field_preplans" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."field_preplans" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."field_preplans" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."field_preplans" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."field_preplans" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."field_preplans" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."field_preplans" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."fire_inspection_backup_audit" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."fire_inspection_backup_audit" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."fire_inspection_backup_audit" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."fire_inspection_backup_audit" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."fire_inspection_backup_audit" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."fire_inspection_backup_audit" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."fire_inspection_backup_audit" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."fire_inspection_backup_audit" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."fire_inspection_backup_entries" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."fire_inspection_backup_entries" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."fire_inspection_backup_entries" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."fire_inspection_backup_entries" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."fire_inspection_backup_entries" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."fire_inspection_backup_entries" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."fire_inspection_backup_entries" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."fire_inspection_backup_entries" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."fire_inspection_backup_jobs" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."fire_inspection_backup_jobs" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."fire_inspection_backup_jobs" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."fire_inspection_backup_jobs" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."fire_inspection_backup_jobs" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."fire_inspection_backup_jobs" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."fire_inspection_backup_jobs" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."fire_inspection_backup_jobs" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."fire_inspection_backup_rows" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."fire_inspection_backup_rows" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."fire_inspection_backup_rows" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."fire_inspection_backup_rows" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."fire_inspection_backup_rows" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."fire_inspection_backup_rows" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."fire_inspection_backup_rows" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."fire_inspection_backup_rows" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."fire_inspection_code_audit" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."fire_inspection_code_audit" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."fire_inspection_code_audit" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."fire_inspection_code_audit" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."fire_inspection_code_audit" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."fire_inspection_code_audit" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."fire_inspection_code_audit" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."fire_inspection_code_audit" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."fire_inspection_code_entries" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."fire_inspection_code_entries" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."fire_inspection_code_entries" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."fire_inspection_code_entries" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."fire_inspection_code_entries" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."fire_inspection_code_entries" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."fire_inspection_code_entries" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."fire_inspection_code_entries" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."fire_inspection_email_deliveries" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."fire_inspection_email_deliveries" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."fire_inspection_email_deliveries" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."fire_inspection_email_deliveries" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."fire_inspection_email_deliveries" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."fire_inspection_email_deliveries" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."fire_inspection_email_deliveries" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."fire_inspection_email_deliveries" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."fire_inspection_eso_files" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."fire_inspection_eso_files" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."fire_inspection_eso_files" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."fire_inspection_eso_files" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."fire_inspection_eso_files" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."fire_inspection_eso_files" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."fire_inspection_eso_files" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."fire_inspection_eso_files" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."fire_inspection_eso_records" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."fire_inspection_eso_records" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."fire_inspection_eso_records" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."fire_inspection_eso_records" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."fire_inspection_eso_records" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."fire_inspection_eso_records" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."fire_inspection_eso_records" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."fire_inspection_eso_records" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."fire_inspection_pilot_audit" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."fire_inspection_pilot_audit" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."fire_inspection_pilot_audit" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."fire_inspection_pilot_audit" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."fire_inspection_pilot_audit" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."fire_inspection_pilot_audit" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."fire_inspection_pilot_audit" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."fire_inspection_pilot_audit" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."fire_inspection_pilot_files" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."fire_inspection_pilot_files" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."fire_inspection_pilot_files" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."fire_inspection_pilot_files" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."fire_inspection_pilot_files" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."fire_inspection_pilot_files" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."fire_inspection_pilot_files" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."fire_inspection_pilot_files" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."fire_inspection_pilot_records" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."fire_inspection_pilot_records" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."fire_inspection_pilot_records" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."fire_inspection_pilot_records" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."fire_inspection_pilot_records" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."fire_inspection_pilot_records" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."fire_inspection_pilot_records" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."fire_inspection_pilot_records" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."fire_inspection_staff_audit" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."fire_inspection_staff_audit" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."fire_inspection_staff_audit" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."fire_inspection_staff_audit" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."fire_inspection_staff_audit" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."fire_inspection_staff_audit" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."fire_inspection_staff_audit" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."fire_inspection_staff_audit" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."fire_inspection_staff_members" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."fire_inspection_staff_members" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."fire_inspection_staff_members" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."fire_inspection_staff_members" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."fire_inspection_staff_members" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."fire_inspection_staff_members" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."fire_inspection_staff_members" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."fire_inspection_staff_members" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."fire_inspection_staff_mutations" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."fire_inspection_staff_mutations" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."fire_inspection_staff_mutations" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."fire_inspection_staff_mutations" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."fire_inspection_staff_mutations" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."fire_inspection_staff_mutations" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."fire_inspection_staff_mutations" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."fire_inspection_staff_mutations" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."fire_inspection_staff_workspaces" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."fire_inspection_staff_workspaces" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."fire_inspection_staff_workspaces" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."fire_inspection_staff_workspaces" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."fire_inspection_staff_workspaces" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."fire_inspection_staff_workspaces" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."fire_inspection_staff_workspaces" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."fire_inspection_staff_workspaces" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."fleet_apparatus" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."fleet_apparatus" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."fleet_apparatus" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."fleet_apparatus" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."fleet_apparatus" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."fleet_apparatus" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."fleet_apparatus" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."fleet_apparatus" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."important_phone_numbers" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."important_phone_numbers" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."important_phone_numbers" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."important_phone_numbers" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."important_phone_numbers" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."important_phone_numbers" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."important_phone_numbers" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."important_phone_numbers" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."incident_command_boards" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."incident_command_boards" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."incident_command_boards" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."incident_command_boards" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."incident_command_boards" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."incident_command_boards" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."incident_command_boards" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."incident_command_boards" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."incident_command_events" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."incident_command_events" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."incident_command_events" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."incident_command_events" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."incident_command_events" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."incident_command_events" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."incident_command_events" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."incident_command_events" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."inventory_audit_events" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."inventory_audit_events" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."inventory_audit_events" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."inventory_audit_events" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."inventory_audit_events" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."inventory_audit_events" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."inventory_audit_events" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."inventory_audit_events" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."inventory_compartments" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."inventory_compartments" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."inventory_compartments" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."inventory_compartments" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."inventory_compartments" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."inventory_compartments" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."inventory_compartments" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."inventory_compartments" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."inventory_equipment" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."inventory_equipment" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."inventory_equipment" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."inventory_equipment" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."inventory_equipment" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."inventory_equipment" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."inventory_equipment" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."inventory_equipment" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."inventory_hotspots" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."inventory_hotspots" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."inventory_hotspots" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."inventory_hotspots" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."inventory_hotspots" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."inventory_hotspots" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."inventory_hotspots" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."inventory_hotspots" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."inventory_photos" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."inventory_photos" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."inventory_photos" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."inventory_photos" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."inventory_photos" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."inventory_photos" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."inventory_photos" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."inventory_photos" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."inventory_readiness" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."inventory_readiness" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."inventory_readiness" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."inventory_readiness" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."inventory_readiness" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."inventory_readiness" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."inventory_readiness" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."inventory_readiness" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."inventory_weekly_check_items" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."inventory_weekly_check_items" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."inventory_weekly_check_items" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."inventory_weekly_check_items" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."inventory_weekly_check_items" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."inventory_weekly_check_items" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."inventory_weekly_check_items" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."inventory_weekly_check_items" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."inventory_weekly_check_results" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."inventory_weekly_check_results" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."inventory_weekly_check_results" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."inventory_weekly_check_results" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."inventory_weekly_check_results" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."inventory_weekly_check_results" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."inventory_weekly_check_results" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."inventory_weekly_check_results" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."inventory_weekly_check_templates" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."inventory_weekly_check_templates" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."inventory_weekly_check_templates" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."inventory_weekly_check_templates" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."inventory_weekly_check_templates" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."inventory_weekly_check_templates" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."inventory_weekly_check_templates" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."inventory_weekly_check_templates" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."inventory_weekly_checks" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."inventory_weekly_checks" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."inventory_weekly_checks" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."inventory_weekly_checks" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."inventory_weekly_checks" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."inventory_weekly_checks" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."inventory_weekly_checks" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."inventory_weekly_checks" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."neris_pilot_audit" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."neris_pilot_audit" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."neris_pilot_audit" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."neris_pilot_audit" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."neris_pilot_audit" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."neris_pilot_audit" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."neris_pilot_audit" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."neris_pilot_audit" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."neris_pilot_files" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."neris_pilot_files" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."neris_pilot_files" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."neris_pilot_files" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."neris_pilot_files" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."neris_pilot_files" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."neris_pilot_files" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."neris_pilot_files" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."neris_pilot_records" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."neris_pilot_records" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."neris_pilot_records" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."neris_pilot_records" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."neris_pilot_records" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."neris_pilot_records" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."neris_pilot_records" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."neris_pilot_records" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."operational_cad_recovery" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."operational_cad_recovery" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."operational_cad_recovery" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."operational_cad_recovery" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."operational_cad_recovery" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."operational_cad_recovery" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."operational_cad_recovery" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."operational_cad_recovery" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."operational_program_audit" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."operational_program_audit" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."operational_program_audit" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."operational_program_audit" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."operational_program_audit" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."operational_program_audit" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."operational_program_audit" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."operational_program_audit" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."operational_program_records" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."operational_program_records" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."operational_program_records" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."operational_program_records" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."operational_program_records" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."operational_program_records" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."operational_program_records" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."operational_program_records" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."operational_revisions" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."operational_revisions" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."operational_revisions" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."operational_revisions" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."operational_revisions" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."operational_revisions" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."operational_revisions" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."operational_revisions" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."operational_view_leases" TO "authenticated";

GRANT DELETE ON TABLE "firehouse"."operational_view_leases" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."operational_view_leases" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."operational_view_leases" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."operational_view_leases" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."operational_view_leases" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."operational_view_leases" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."operational_view_leases" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."operational_view_leases" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."pay_periods" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."pay_periods" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."pay_periods" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."pay_periods" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."pay_periods" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."pay_periods" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."pay_periods" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."pay_periods" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."pay_rate_history" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."pay_rate_history" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."pay_rate_history" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."pay_rate_history" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."pay_rate_history" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."pay_rate_history" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."pay_rate_history" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."pay_rate_history" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."pay_scales" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."pay_scales" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."pay_scales" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."pay_scales" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."pay_scales" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."pay_scales" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."pay_scales" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."pay_scales" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."payroll_adjustments" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."payroll_adjustments" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."payroll_adjustments" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."payroll_adjustments" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."payroll_adjustments" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."payroll_adjustments" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."payroll_adjustments" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."payroll_adjustments" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."payroll_adjustments" TO "service_role";

GRANT INSERT ON TABLE "firehouse"."payroll_adjustments" TO "service_role";

GRANT MAINTAIN ON TABLE "firehouse"."payroll_adjustments" TO "service_role";

GRANT REFERENCES ON TABLE "firehouse"."payroll_adjustments" TO "service_role";

GRANT SELECT ON TABLE "firehouse"."payroll_adjustments" TO "service_role";

GRANT TRIGGER ON TABLE "firehouse"."payroll_adjustments" TO "service_role";

GRANT TRUNCATE ON TABLE "firehouse"."payroll_adjustments" TO "service_role";

GRANT UPDATE ON TABLE "firehouse"."payroll_adjustments" TO "service_role";

GRANT DELETE ON TABLE "firehouse"."payroll_settings" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."payroll_settings" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."payroll_settings" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."payroll_settings" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."payroll_settings" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."payroll_settings" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."payroll_settings" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."payroll_settings" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."payroll_source_version" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."payroll_source_version" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."payroll_source_version" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."payroll_source_version" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."payroll_source_version" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."payroll_source_version" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."payroll_source_version" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."payroll_source_version" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."payroll_source_version" TO "service_role";

GRANT INSERT ON TABLE "firehouse"."payroll_source_version" TO "service_role";

GRANT MAINTAIN ON TABLE "firehouse"."payroll_source_version" TO "service_role";

GRANT REFERENCES ON TABLE "firehouse"."payroll_source_version" TO "service_role";

GRANT SELECT ON TABLE "firehouse"."payroll_source_version" TO "service_role";

GRANT TRIGGER ON TABLE "firehouse"."payroll_source_version" TO "service_role";

GRANT TRUNCATE ON TABLE "firehouse"."payroll_source_version" TO "service_role";

GRANT UPDATE ON TABLE "firehouse"."payroll_source_version" TO "service_role";

GRANT DELETE ON TABLE "firehouse"."payroll_submissions" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."payroll_submissions" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."payroll_submissions" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."payroll_submissions" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."payroll_submissions" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."payroll_submissions" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."payroll_submissions" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."payroll_submissions" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."payroll_submissions" TO "service_role";

GRANT INSERT ON TABLE "firehouse"."payroll_submissions" TO "service_role";

GRANT MAINTAIN ON TABLE "firehouse"."payroll_submissions" TO "service_role";

GRANT REFERENCES ON TABLE "firehouse"."payroll_submissions" TO "service_role";

GRANT SELECT ON TABLE "firehouse"."payroll_submissions" TO "service_role";

GRANT TRIGGER ON TABLE "firehouse"."payroll_submissions" TO "service_role";

GRANT TRUNCATE ON TABLE "firehouse"."payroll_submissions" TO "service_role";

GRANT UPDATE ON TABLE "firehouse"."payroll_submissions" TO "service_role";

GRANT DELETE ON TABLE "firehouse"."policies" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."policies" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."policies" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."policies" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."policies" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."policies" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."policies" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."policies" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."portal_activation_attempts" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."portal_activation_attempts" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."portal_activation_attempts" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."portal_activation_attempts" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."portal_activation_attempts" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."portal_activation_attempts" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."portal_activation_attempts" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."portal_activation_attempts" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."portal_confirmation_messages" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."portal_confirmation_messages" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."portal_confirmation_messages" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."portal_confirmation_messages" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."portal_confirmation_messages" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."portal_confirmation_messages" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."portal_confirmation_messages" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."portal_confirmation_messages" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."portal_confirmation_receipts" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."portal_confirmation_receipts" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."portal_confirmation_receipts" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."portal_confirmation_receipts" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."portal_confirmation_receipts" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."portal_confirmation_receipts" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."portal_confirmation_receipts" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."portal_confirmation_receipts" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."portal_confirmation_setting" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."portal_confirmation_setting" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."portal_confirmation_setting" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."portal_confirmation_setting" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."portal_confirmation_setting" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."portal_confirmation_setting" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."portal_confirmation_setting" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."portal_confirmation_setting" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."portal_login_audit" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."portal_login_audit" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."portal_login_audit" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."portal_login_audit" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."portal_login_audit" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."portal_login_audit" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."portal_login_audit" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."portal_login_audit" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."portal_login_audit_status" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."portal_login_audit_status" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."portal_login_audit_status" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."portal_login_audit_status" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."portal_login_audit_status" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."portal_login_audit_status" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."portal_login_audit_status" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."portal_login_audit_status" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."push_subscriptions" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."push_subscriptions" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."push_subscriptions" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."push_subscriptions" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."push_subscriptions" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."push_subscriptions" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."push_subscriptions" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."push_subscriptions" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."rank_permissions" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."rank_permissions" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."rank_permissions" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."rank_permissions" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."rank_permissions" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."rank_permissions" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."rank_permissions" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."rank_permissions" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."record_revisions" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."record_revisions" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."record_revisions" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."record_revisions" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."record_revisions" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."record_revisions" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."record_revisions" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."record_revisions" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."road_closures" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."road_closures" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."road_closures" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."road_closures" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."road_closures" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."road_closures" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."road_closures" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."road_closures" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."safety_inspection_attachments" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."safety_inspection_attachments" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."safety_inspection_attachments" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."safety_inspection_attachments" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."safety_inspection_attachments" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."safety_inspection_attachments" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."safety_inspection_attachments" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."safety_inspection_attachments" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."safety_inspection_results" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."safety_inspection_results" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."safety_inspection_results" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."safety_inspection_results" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."safety_inspection_results" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."safety_inspection_results" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."safety_inspection_results" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."safety_inspection_results" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."safety_inspection_template_items" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."safety_inspection_template_items" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."safety_inspection_template_items" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."safety_inspection_template_items" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."safety_inspection_template_items" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."safety_inspection_template_items" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."safety_inspection_template_items" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."safety_inspection_template_items" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."safety_inspection_templates" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."safety_inspection_templates" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."safety_inspection_templates" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."safety_inspection_templates" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."safety_inspection_templates" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."safety_inspection_templates" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."safety_inspection_templates" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."safety_inspection_templates" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."safety_inspections" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."safety_inspections" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."safety_inspections" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."safety_inspections" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."safety_inspections" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."safety_inspections" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."safety_inspections" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."safety_inspections" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."schedule_assignments" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."schedule_assignments" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."schedule_assignments" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."schedule_assignments" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."schedule_assignments" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."schedule_assignments" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."schedule_assignments" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."schedule_assignments" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."schedule_coverage_rules" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."schedule_coverage_rules" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."schedule_coverage_rules" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."schedule_coverage_rules" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."schedule_coverage_rules" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."schedule_coverage_rules" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."schedule_coverage_rules" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."schedule_coverage_rules" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."schedule_notification_rules" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."schedule_notification_rules" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."schedule_notification_rules" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."schedule_notification_rules" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."schedule_notification_rules" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."schedule_notification_rules" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."schedule_notification_rules" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."schedule_notification_rules" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."schedule_notifications" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."schedule_notifications" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."schedule_notifications" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."schedule_notifications" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."schedule_notifications" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."schedule_notifications" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."schedule_notifications" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."schedule_notifications" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."schedule_requests" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."schedule_requests" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."schedule_requests" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."schedule_requests" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."schedule_requests" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."schedule_requests" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."schedule_requests" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."schedule_requests" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."schedule_rotation_members" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."schedule_rotation_members" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."schedule_rotation_members" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."schedule_rotation_members" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."schedule_rotation_members" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."schedule_rotation_members" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."schedule_rotation_members" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."schedule_rotation_members" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."schedule_rotations" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."schedule_rotations" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."schedule_rotations" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."schedule_rotations" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."schedule_rotations" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."schedule_rotations" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."schedule_rotations" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."schedule_rotations" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."schedule_shift_patterns" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."schedule_shift_patterns" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."schedule_shift_patterns" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."schedule_shift_patterns" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."schedule_shift_patterns" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."schedule_shift_patterns" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."schedule_shift_patterns" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."schedule_shift_patterns" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."schedule_staffing_overrides" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."schedule_staffing_overrides" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."schedule_staffing_overrides" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."schedule_staffing_overrides" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."schedule_staffing_overrides" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."schedule_staffing_overrides" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."schedule_staffing_overrides" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."schedule_staffing_overrides" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."scheduler_push_deliveries" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."scheduler_push_deliveries" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."scheduler_push_deliveries" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."scheduler_push_deliveries" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."scheduler_push_deliveries" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."scheduler_push_deliveries" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."scheduler_push_deliveries" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."scheduler_push_deliveries" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."scheduler_push_events" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."scheduler_push_events" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."scheduler_push_events" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."scheduler_push_events" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."scheduler_push_events" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."scheduler_push_events" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."scheduler_push_events" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."scheduler_push_events" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."scheduler_reminder_slots" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."scheduler_reminder_slots" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."scheduler_reminder_slots" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."scheduler_reminder_slots" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."scheduler_reminder_slots" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."scheduler_reminder_slots" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."scheduler_reminder_slots" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."scheduler_reminder_slots" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."station_availability" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."station_availability" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."station_availability" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."station_availability" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."station_availability" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."station_availability" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."station_availability" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."station_availability" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."station_distribution_weights" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."station_distribution_weights" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."station_distribution_weights" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."station_distribution_weights" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."station_distribution_weights" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."station_distribution_weights" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."station_distribution_weights" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."station_distribution_weights" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."station_ot_interest" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."station_ot_interest" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."station_ot_interest" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."station_ot_interest" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."station_ot_interest" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."station_ot_interest" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."station_ot_interest" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."station_ot_interest" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."station_ot_offers" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."station_ot_offers" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."station_ot_offers" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."station_ot_offers" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."station_ot_offers" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."station_ot_offers" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."station_ot_offers" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."station_ot_offers" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."station_ot_settings" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."station_ot_settings" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."station_ot_settings" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."station_ot_settings" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."station_ot_settings" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."station_ot_settings" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."station_ot_settings" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."station_ot_settings" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."station_ot_timing" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."station_ot_timing" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."station_ot_timing" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."station_ot_timing" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."station_ot_timing" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."station_ot_timing" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."station_ot_timing" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."station_ot_timing" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."station_reminder_rules" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."station_reminder_rules" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."station_reminder_rules" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."station_reminder_rules" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."station_reminder_rules" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."station_reminder_rules" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."station_reminder_rules" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."station_reminder_rules" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."station_schedule_entries" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."station_schedule_entries" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."station_schedule_entries" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."station_schedule_entries" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."station_schedule_entries" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."station_schedule_entries" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."station_schedule_entries" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."station_schedule_entries" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."station_shift_claims" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."station_shift_claims" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."station_shift_claims" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."station_shift_claims" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."station_shift_claims" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."station_shift_claims" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."station_shift_claims" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."station_shift_claims" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."station_shift_slots" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."station_shift_slots" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."station_shift_slots" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."station_shift_slots" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."station_shift_slots" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."station_shift_slots" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."station_shift_slots" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."station_shift_slots" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."station_shift_type_roles" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."station_shift_type_roles" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."station_shift_type_roles" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."station_shift_type_roles" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."station_shift_type_roles" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."station_shift_type_roles" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."station_shift_type_roles" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."station_shift_type_roles" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."station_shift_types" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."station_shift_types" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."station_shift_types" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."station_shift_types" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."station_shift_types" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."station_shift_types" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."station_shift_types" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."station_shift_types" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."station_standing_assignments" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."station_standing_assignments" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."station_standing_assignments" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."station_standing_assignments" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."station_standing_assignments" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."station_standing_assignments" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."station_standing_assignments" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."station_standing_assignments" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."station_time_off_dates" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."station_time_off_dates" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."station_time_off_dates" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."station_time_off_dates" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."station_time_off_dates" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."station_time_off_dates" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."station_time_off_dates" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."station_time_off_dates" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."station_time_off_requests" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."station_time_off_requests" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."station_time_off_requests" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."station_time_off_requests" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."station_time_off_requests" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."station_time_off_requests" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."station_time_off_requests" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."station_time_off_requests" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."station_trade_requests" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."station_trade_requests" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."station_trade_requests" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."station_trade_requests" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."station_trade_requests" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."station_trade_requests" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."station_trade_requests" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."station_trade_requests" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."station_unavailability" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."station_unavailability" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."station_unavailability" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."station_unavailability" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."station_unavailability" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."station_unavailability" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."station_unavailability" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."station_unavailability" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."stickney_inventory_apparatus" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."stickney_inventory_apparatus" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."stickney_inventory_apparatus" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."stickney_inventory_apparatus" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."stickney_inventory_apparatus" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."stickney_inventory_apparatus" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."stickney_inventory_apparatus" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."stickney_inventory_apparatus" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."stickney_inventory_check_items" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."stickney_inventory_check_items" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."stickney_inventory_check_items" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."stickney_inventory_check_items" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."stickney_inventory_check_items" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."stickney_inventory_check_items" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."stickney_inventory_check_items" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."stickney_inventory_check_items" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."stickney_inventory_checks" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."stickney_inventory_checks" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."stickney_inventory_checks" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."stickney_inventory_checks" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."stickney_inventory_checks" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."stickney_inventory_checks" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."stickney_inventory_checks" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."stickney_inventory_checks" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."stickney_inventory_compartments" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."stickney_inventory_compartments" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."stickney_inventory_compartments" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."stickney_inventory_compartments" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."stickney_inventory_compartments" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."stickney_inventory_compartments" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."stickney_inventory_compartments" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."stickney_inventory_compartments" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."stickney_inventory_equipment" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."stickney_inventory_equipment" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."stickney_inventory_equipment" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."stickney_inventory_equipment" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."stickney_inventory_equipment" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."stickney_inventory_equipment" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."stickney_inventory_equipment" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."stickney_inventory_equipment" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."stickney_inventory_photo_views" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."stickney_inventory_photo_views" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."stickney_inventory_photo_views" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."stickney_inventory_photo_views" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."stickney_inventory_photo_views" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."stickney_inventory_photo_views" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."stickney_inventory_photo_views" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."stickney_inventory_photo_views" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."stickney_inventory_readiness_exceptions" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."stickney_inventory_readiness_exceptions" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."stickney_inventory_readiness_exceptions" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."stickney_inventory_readiness_exceptions" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."stickney_inventory_readiness_exceptions" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."stickney_inventory_readiness_exceptions" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."stickney_inventory_readiness_exceptions" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."stickney_inventory_readiness_exceptions" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."stickney_inventory_work_orders" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."stickney_inventory_work_orders" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."stickney_inventory_work_orders" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."stickney_inventory_work_orders" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."stickney_inventory_work_orders" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."stickney_inventory_work_orders" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."stickney_inventory_work_orders" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."stickney_inventory_work_orders" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."system_meta" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."system_meta" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."system_meta" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."system_meta" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."system_meta" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."system_meta" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."system_meta" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."system_meta" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."time_entries" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."time_entries" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."time_entries" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."time_entries" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."time_entries" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."time_entries" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."time_entries" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."time_entries" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."training_pilot_audit" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."training_pilot_audit" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."training_pilot_audit" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."training_pilot_audit" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."training_pilot_audit" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."training_pilot_audit" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."training_pilot_audit" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."training_pilot_audit" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."training_pilot_files" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."training_pilot_files" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."training_pilot_files" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."training_pilot_files" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."training_pilot_files" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."training_pilot_files" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."training_pilot_files" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."training_pilot_files" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."training_pilot_records" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."training_pilot_records" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."training_pilot_records" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."training_pilot_records" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."training_pilot_records" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."training_pilot_records" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."training_pilot_records" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."training_pilot_records" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."training_report_views" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."training_report_views" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."training_report_views" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."training_report_views" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."training_report_views" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."training_report_views" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."training_report_views" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."training_report_views" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."work_detail_members" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."work_detail_members" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."work_detail_members" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."work_detail_members" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."work_detail_members" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."work_detail_members" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."work_detail_members" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."work_detail_members" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."work_detail_postings" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."work_detail_postings" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."work_detail_postings" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."work_detail_postings" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."work_detail_postings" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."work_detail_postings" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."work_detail_postings" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."work_detail_postings" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."work_detail_requests" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."work_detail_requests" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."work_detail_requests" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."work_detail_requests" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."work_detail_requests" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."work_detail_requests" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."work_detail_requests" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."work_detail_requests" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."workspace_review_audit" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."workspace_review_audit" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."workspace_review_audit" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."workspace_review_audit" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."workspace_review_audit" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."workspace_review_audit" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."workspace_review_audit" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."workspace_review_audit" TO "postgres";

GRANT DELETE ON TABLE "firehouse"."workspace_review_records" TO "postgres";

GRANT INSERT ON TABLE "firehouse"."workspace_review_records" TO "postgres";

GRANT MAINTAIN ON TABLE "firehouse"."workspace_review_records" TO "postgres";

GRANT REFERENCES ON TABLE "firehouse"."workspace_review_records" TO "postgres";

GRANT SELECT ON TABLE "firehouse"."workspace_review_records" TO "postgres";

GRANT TRIGGER ON TABLE "firehouse"."workspace_review_records" TO "postgres";

GRANT TRUNCATE ON TABLE "firehouse"."workspace_review_records" TO "postgres";

GRANT UPDATE ON TABLE "firehouse"."workspace_review_records" TO "postgres";

GRANT DELETE ON TABLE "private"."department_portals" TO "postgres";

GRANT INSERT ON TABLE "private"."department_portals" TO "postgres";

GRANT MAINTAIN ON TABLE "private"."department_portals" TO "postgres";

GRANT REFERENCES ON TABLE "private"."department_portals" TO "postgres";

GRANT SELECT ON TABLE "private"."department_portals" TO "postgres";

GRANT TRIGGER ON TABLE "private"."department_portals" TO "postgres";

GRANT TRUNCATE ON TABLE "private"."department_portals" TO "postgres";

GRANT UPDATE ON TABLE "private"."department_portals" TO "postgres";

GRANT DELETE ON TABLE "private"."portal_remembered_devices" TO "postgres";

GRANT INSERT ON TABLE "private"."portal_remembered_devices" TO "postgres";

GRANT MAINTAIN ON TABLE "private"."portal_remembered_devices" TO "postgres";

GRANT REFERENCES ON TABLE "private"."portal_remembered_devices" TO "postgres";

GRANT SELECT ON TABLE "private"."portal_remembered_devices" TO "postgres";

GRANT TRIGGER ON TABLE "private"."portal_remembered_devices" TO "postgres";

GRANT TRUNCATE ON TABLE "private"."portal_remembered_devices" TO "postgres";

GRANT UPDATE ON TABLE "private"."portal_remembered_devices" TO "postgres";

GRANT DELETE ON TABLE "public"."department_apparatus" TO "authenticated";

GRANT INSERT ON TABLE "public"."department_apparatus" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."department_apparatus" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."department_apparatus" TO "authenticated";

GRANT SELECT ON TABLE "public"."department_apparatus" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."department_apparatus" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."department_apparatus" TO "authenticated";

GRANT UPDATE ON TABLE "public"."department_apparatus" TO "authenticated";

GRANT DELETE ON TABLE "public"."department_apparatus" TO "postgres";

GRANT INSERT ON TABLE "public"."department_apparatus" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."department_apparatus" TO "postgres";

GRANT REFERENCES ON TABLE "public"."department_apparatus" TO "postgres";

GRANT SELECT ON TABLE "public"."department_apparatus" TO "postgres";

GRANT TRIGGER ON TABLE "public"."department_apparatus" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."department_apparatus" TO "postgres";

GRANT UPDATE ON TABLE "public"."department_apparatus" TO "postgres";

GRANT DELETE ON TABLE "public"."department_apparatus" TO "service_role";

GRANT INSERT ON TABLE "public"."department_apparatus" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."department_apparatus" TO "service_role";

GRANT REFERENCES ON TABLE "public"."department_apparatus" TO "service_role";

GRANT SELECT ON TABLE "public"."department_apparatus" TO "service_role";

GRANT TRIGGER ON TABLE "public"."department_apparatus" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."department_apparatus" TO "service_role";

GRANT UPDATE ON TABLE "public"."department_apparatus" TO "service_role";

GRANT DELETE ON TABLE "public"."department_invites" TO "anon";

GRANT INSERT ON TABLE "public"."department_invites" TO "anon";

GRANT MAINTAIN ON TABLE "public"."department_invites" TO "anon";

GRANT REFERENCES ON TABLE "public"."department_invites" TO "anon";

GRANT SELECT ON TABLE "public"."department_invites" TO "anon";

GRANT TRIGGER ON TABLE "public"."department_invites" TO "anon";

GRANT TRUNCATE ON TABLE "public"."department_invites" TO "anon";

GRANT UPDATE ON TABLE "public"."department_invites" TO "anon";

GRANT DELETE ON TABLE "public"."department_invites" TO "authenticated";

GRANT INSERT ON TABLE "public"."department_invites" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."department_invites" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."department_invites" TO "authenticated";

GRANT SELECT ON TABLE "public"."department_invites" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."department_invites" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."department_invites" TO "authenticated";

GRANT UPDATE ON TABLE "public"."department_invites" TO "authenticated";

GRANT DELETE ON TABLE "public"."department_invites" TO "postgres";

GRANT INSERT ON TABLE "public"."department_invites" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."department_invites" TO "postgres";

GRANT REFERENCES ON TABLE "public"."department_invites" TO "postgres";

GRANT SELECT ON TABLE "public"."department_invites" TO "postgres";

GRANT TRIGGER ON TABLE "public"."department_invites" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."department_invites" TO "postgres";

GRANT UPDATE ON TABLE "public"."department_invites" TO "postgres";

GRANT DELETE ON TABLE "public"."department_invites" TO "service_role";

GRANT INSERT ON TABLE "public"."department_invites" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."department_invites" TO "service_role";

GRANT REFERENCES ON TABLE "public"."department_invites" TO "service_role";

GRANT SELECT ON TABLE "public"."department_invites" TO "service_role";

GRANT TRIGGER ON TABLE "public"."department_invites" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."department_invites" TO "service_role";

GRANT UPDATE ON TABLE "public"."department_invites" TO "service_role";

GRANT DELETE ON TABLE "public"."department_memberships" TO "anon";

GRANT INSERT ON TABLE "public"."department_memberships" TO "anon";

GRANT MAINTAIN ON TABLE "public"."department_memberships" TO "anon";

GRANT REFERENCES ON TABLE "public"."department_memberships" TO "anon";

GRANT SELECT ON TABLE "public"."department_memberships" TO "anon";

GRANT TRIGGER ON TABLE "public"."department_memberships" TO "anon";

GRANT TRUNCATE ON TABLE "public"."department_memberships" TO "anon";

GRANT UPDATE ON TABLE "public"."department_memberships" TO "anon";

GRANT DELETE ON TABLE "public"."department_memberships" TO "authenticated";

GRANT INSERT ON TABLE "public"."department_memberships" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."department_memberships" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."department_memberships" TO "authenticated";

GRANT SELECT ON TABLE "public"."department_memberships" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."department_memberships" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."department_memberships" TO "authenticated";

GRANT UPDATE ON TABLE "public"."department_memberships" TO "authenticated";

GRANT DELETE ON TABLE "public"."department_memberships" TO "postgres";

GRANT INSERT ON TABLE "public"."department_memberships" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."department_memberships" TO "postgres";

GRANT REFERENCES ON TABLE "public"."department_memberships" TO "postgres";

GRANT SELECT ON TABLE "public"."department_memberships" TO "postgres";

GRANT TRIGGER ON TABLE "public"."department_memberships" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."department_memberships" TO "postgres";

GRANT UPDATE ON TABLE "public"."department_memberships" TO "postgres";

GRANT DELETE ON TABLE "public"."department_memberships" TO "service_role";

GRANT INSERT ON TABLE "public"."department_memberships" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."department_memberships" TO "service_role";

GRANT REFERENCES ON TABLE "public"."department_memberships" TO "service_role";

GRANT SELECT ON TABLE "public"."department_memberships" TO "service_role";

GRANT TRIGGER ON TABLE "public"."department_memberships" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."department_memberships" TO "service_role";

GRANT UPDATE ON TABLE "public"."department_memberships" TO "service_role";

GRANT DELETE ON TABLE "public"."departments" TO "anon";

GRANT INSERT ON TABLE "public"."departments" TO "anon";

GRANT MAINTAIN ON TABLE "public"."departments" TO "anon";

GRANT REFERENCES ON TABLE "public"."departments" TO "anon";

GRANT SELECT ON TABLE "public"."departments" TO "anon";

GRANT TRIGGER ON TABLE "public"."departments" TO "anon";

GRANT TRUNCATE ON TABLE "public"."departments" TO "anon";

GRANT UPDATE ON TABLE "public"."departments" TO "anon";

GRANT DELETE ON TABLE "public"."departments" TO "authenticated";

GRANT INSERT ON TABLE "public"."departments" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."departments" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."departments" TO "authenticated";

GRANT SELECT ON TABLE "public"."departments" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."departments" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."departments" TO "authenticated";

GRANT UPDATE ON TABLE "public"."departments" TO "authenticated";

GRANT DELETE ON TABLE "public"."departments" TO "postgres";

GRANT INSERT ON TABLE "public"."departments" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."departments" TO "postgres";

GRANT REFERENCES ON TABLE "public"."departments" TO "postgres";

GRANT SELECT ON TABLE "public"."departments" TO "postgres";

GRANT TRIGGER ON TABLE "public"."departments" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."departments" TO "postgres";

GRANT UPDATE ON TABLE "public"."departments" TO "postgres";

GRANT DELETE ON TABLE "public"."departments" TO "service_role";

GRANT INSERT ON TABLE "public"."departments" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."departments" TO "service_role";

GRANT REFERENCES ON TABLE "public"."departments" TO "service_role";

GRANT SELECT ON TABLE "public"."departments" TO "service_role";

GRANT TRIGGER ON TABLE "public"."departments" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."departments" TO "service_role";

GRANT UPDATE ON TABLE "public"."departments" TO "service_role";

GRANT INSERT ON TABLE "public"."disciplinary_import_staging" TO "authenticated";

GRANT SELECT ON TABLE "public"."disciplinary_import_staging" TO "authenticated";

GRANT UPDATE ON TABLE "public"."disciplinary_import_staging" TO "authenticated";

GRANT DELETE ON TABLE "public"."disciplinary_import_staging" TO "postgres";

GRANT INSERT ON TABLE "public"."disciplinary_import_staging" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."disciplinary_import_staging" TO "postgres";

GRANT REFERENCES ON TABLE "public"."disciplinary_import_staging" TO "postgres";

GRANT SELECT ON TABLE "public"."disciplinary_import_staging" TO "postgres";

GRANT TRIGGER ON TABLE "public"."disciplinary_import_staging" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."disciplinary_import_staging" TO "postgres";

GRANT UPDATE ON TABLE "public"."disciplinary_import_staging" TO "postgres";

GRANT DELETE ON TABLE "public"."disciplinary_import_staging" TO "service_role";

GRANT INSERT ON TABLE "public"."disciplinary_import_staging" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."disciplinary_import_staging" TO "service_role";

GRANT REFERENCES ON TABLE "public"."disciplinary_import_staging" TO "service_role";

GRANT SELECT ON TABLE "public"."disciplinary_import_staging" TO "service_role";

GRANT TRIGGER ON TABLE "public"."disciplinary_import_staging" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."disciplinary_import_staging" TO "service_role";

GRANT UPDATE ON TABLE "public"."disciplinary_import_staging" TO "service_role";

GRANT INSERT ON TABLE "public"."disciplinary_report_files" TO "authenticated";

GRANT SELECT ON TABLE "public"."disciplinary_report_files" TO "authenticated";

GRANT DELETE ON TABLE "public"."disciplinary_report_files" TO "postgres";

GRANT INSERT ON TABLE "public"."disciplinary_report_files" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."disciplinary_report_files" TO "postgres";

GRANT REFERENCES ON TABLE "public"."disciplinary_report_files" TO "postgres";

GRANT SELECT ON TABLE "public"."disciplinary_report_files" TO "postgres";

GRANT TRIGGER ON TABLE "public"."disciplinary_report_files" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."disciplinary_report_files" TO "postgres";

GRANT UPDATE ON TABLE "public"."disciplinary_report_files" TO "postgres";

GRANT DELETE ON TABLE "public"."disciplinary_report_files" TO "service_role";

GRANT INSERT ON TABLE "public"."disciplinary_report_files" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."disciplinary_report_files" TO "service_role";

GRANT REFERENCES ON TABLE "public"."disciplinary_report_files" TO "service_role";

GRANT SELECT ON TABLE "public"."disciplinary_report_files" TO "service_role";

GRANT TRIGGER ON TABLE "public"."disciplinary_report_files" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."disciplinary_report_files" TO "service_role";

GRANT UPDATE ON TABLE "public"."disciplinary_report_files" TO "service_role";

GRANT SELECT ON TABLE "public"."disciplinary_report_versions" TO "authenticated";

GRANT DELETE ON TABLE "public"."disciplinary_report_versions" TO "postgres";

GRANT INSERT ON TABLE "public"."disciplinary_report_versions" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."disciplinary_report_versions" TO "postgres";

GRANT REFERENCES ON TABLE "public"."disciplinary_report_versions" TO "postgres";

GRANT SELECT ON TABLE "public"."disciplinary_report_versions" TO "postgres";

GRANT TRIGGER ON TABLE "public"."disciplinary_report_versions" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."disciplinary_report_versions" TO "postgres";

GRANT UPDATE ON TABLE "public"."disciplinary_report_versions" TO "postgres";

GRANT DELETE ON TABLE "public"."disciplinary_report_versions" TO "service_role";

GRANT INSERT ON TABLE "public"."disciplinary_report_versions" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."disciplinary_report_versions" TO "service_role";

GRANT REFERENCES ON TABLE "public"."disciplinary_report_versions" TO "service_role";

GRANT SELECT ON TABLE "public"."disciplinary_report_versions" TO "service_role";

GRANT TRIGGER ON TABLE "public"."disciplinary_report_versions" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."disciplinary_report_versions" TO "service_role";

GRANT UPDATE ON TABLE "public"."disciplinary_report_versions" TO "service_role";

GRANT INSERT ON TABLE "public"."disciplinary_reports" TO "authenticated";

GRANT SELECT ON TABLE "public"."disciplinary_reports" TO "authenticated";

GRANT UPDATE ON TABLE "public"."disciplinary_reports" TO "authenticated";

GRANT DELETE ON TABLE "public"."disciplinary_reports" TO "postgres";

GRANT INSERT ON TABLE "public"."disciplinary_reports" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."disciplinary_reports" TO "postgres";

GRANT REFERENCES ON TABLE "public"."disciplinary_reports" TO "postgres";

GRANT SELECT ON TABLE "public"."disciplinary_reports" TO "postgres";

GRANT TRIGGER ON TABLE "public"."disciplinary_reports" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."disciplinary_reports" TO "postgres";

GRANT UPDATE ON TABLE "public"."disciplinary_reports" TO "postgres";

GRANT DELETE ON TABLE "public"."disciplinary_reports" TO "service_role";

GRANT INSERT ON TABLE "public"."disciplinary_reports" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."disciplinary_reports" TO "service_role";

GRANT REFERENCES ON TABLE "public"."disciplinary_reports" TO "service_role";

GRANT SELECT ON TABLE "public"."disciplinary_reports" TO "service_role";

GRANT TRIGGER ON TABLE "public"."disciplinary_reports" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."disciplinary_reports" TO "service_role";

GRANT UPDATE ON TABLE "public"."disciplinary_reports" TO "service_role";

GRANT DELETE ON TABLE "public"."inventory_apparatus_profiles" TO "anon";

GRANT INSERT ON TABLE "public"."inventory_apparatus_profiles" TO "anon";

GRANT MAINTAIN ON TABLE "public"."inventory_apparatus_profiles" TO "anon";

GRANT REFERENCES ON TABLE "public"."inventory_apparatus_profiles" TO "anon";

GRANT SELECT ON TABLE "public"."inventory_apparatus_profiles" TO "anon";

GRANT TRIGGER ON TABLE "public"."inventory_apparatus_profiles" TO "anon";

GRANT TRUNCATE ON TABLE "public"."inventory_apparatus_profiles" TO "anon";

GRANT UPDATE ON TABLE "public"."inventory_apparatus_profiles" TO "anon";

GRANT DELETE ON TABLE "public"."inventory_apparatus_profiles" TO "authenticated";

GRANT INSERT ON TABLE "public"."inventory_apparatus_profiles" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."inventory_apparatus_profiles" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."inventory_apparatus_profiles" TO "authenticated";

GRANT SELECT ON TABLE "public"."inventory_apparatus_profiles" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."inventory_apparatus_profiles" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."inventory_apparatus_profiles" TO "authenticated";

GRANT UPDATE ON TABLE "public"."inventory_apparatus_profiles" TO "authenticated";

GRANT DELETE ON TABLE "public"."inventory_apparatus_profiles" TO "postgres";

GRANT INSERT ON TABLE "public"."inventory_apparatus_profiles" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."inventory_apparatus_profiles" TO "postgres";

GRANT REFERENCES ON TABLE "public"."inventory_apparatus_profiles" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_apparatus_profiles" TO "postgres";

GRANT TRIGGER ON TABLE "public"."inventory_apparatus_profiles" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."inventory_apparatus_profiles" TO "postgres";

GRANT UPDATE ON TABLE "public"."inventory_apparatus_profiles" TO "postgres";

GRANT DELETE ON TABLE "public"."inventory_apparatus_profiles" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_apparatus_profiles" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."inventory_apparatus_profiles" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inventory_apparatus_profiles" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_apparatus_profiles" TO "service_role";

GRANT TRIGGER ON TABLE "public"."inventory_apparatus_profiles" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."inventory_apparatus_profiles" TO "service_role";

GRANT UPDATE ON TABLE "public"."inventory_apparatus_profiles" TO "service_role";

GRANT DELETE ON TABLE "public"."inventory_audit_events" TO "anon";

GRANT INSERT ON TABLE "public"."inventory_audit_events" TO "anon";

GRANT MAINTAIN ON TABLE "public"."inventory_audit_events" TO "anon";

GRANT REFERENCES ON TABLE "public"."inventory_audit_events" TO "anon";

GRANT SELECT ON TABLE "public"."inventory_audit_events" TO "anon";

GRANT TRIGGER ON TABLE "public"."inventory_audit_events" TO "anon";

GRANT TRUNCATE ON TABLE "public"."inventory_audit_events" TO "anon";

GRANT UPDATE ON TABLE "public"."inventory_audit_events" TO "anon";

GRANT DELETE ON TABLE "public"."inventory_audit_events" TO "authenticated";

GRANT INSERT ON TABLE "public"."inventory_audit_events" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."inventory_audit_events" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."inventory_audit_events" TO "authenticated";

GRANT SELECT ON TABLE "public"."inventory_audit_events" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."inventory_audit_events" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."inventory_audit_events" TO "authenticated";

GRANT UPDATE ON TABLE "public"."inventory_audit_events" TO "authenticated";

GRANT DELETE ON TABLE "public"."inventory_audit_events" TO "postgres";

GRANT INSERT ON TABLE "public"."inventory_audit_events" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."inventory_audit_events" TO "postgres";

GRANT REFERENCES ON TABLE "public"."inventory_audit_events" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_audit_events" TO "postgres";

GRANT TRIGGER ON TABLE "public"."inventory_audit_events" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."inventory_audit_events" TO "postgres";

GRANT UPDATE ON TABLE "public"."inventory_audit_events" TO "postgres";

GRANT DELETE ON TABLE "public"."inventory_audit_events" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_audit_events" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."inventory_audit_events" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inventory_audit_events" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_audit_events" TO "service_role";

GRANT TRIGGER ON TABLE "public"."inventory_audit_events" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."inventory_audit_events" TO "service_role";

GRANT UPDATE ON TABLE "public"."inventory_audit_events" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_check_archives" TO "authenticated";

GRANT SELECT ON TABLE "public"."inventory_check_archives" TO "authenticated";

GRANT DELETE ON TABLE "public"."inventory_check_archives" TO "postgres";

GRANT INSERT ON TABLE "public"."inventory_check_archives" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."inventory_check_archives" TO "postgres";

GRANT REFERENCES ON TABLE "public"."inventory_check_archives" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_check_archives" TO "postgres";

GRANT TRIGGER ON TABLE "public"."inventory_check_archives" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."inventory_check_archives" TO "postgres";

GRANT UPDATE ON TABLE "public"."inventory_check_archives" TO "postgres";

GRANT DELETE ON TABLE "public"."inventory_check_archives" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_check_archives" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."inventory_check_archives" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inventory_check_archives" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_check_archives" TO "service_role";

GRANT TRIGGER ON TABLE "public"."inventory_check_archives" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."inventory_check_archives" TO "service_role";

GRANT UPDATE ON TABLE "public"."inventory_check_archives" TO "service_role";

GRANT DELETE ON TABLE "public"."inventory_check_items" TO "anon";

GRANT INSERT ON TABLE "public"."inventory_check_items" TO "anon";

GRANT MAINTAIN ON TABLE "public"."inventory_check_items" TO "anon";

GRANT REFERENCES ON TABLE "public"."inventory_check_items" TO "anon";

GRANT SELECT ON TABLE "public"."inventory_check_items" TO "anon";

GRANT TRIGGER ON TABLE "public"."inventory_check_items" TO "anon";

GRANT TRUNCATE ON TABLE "public"."inventory_check_items" TO "anon";

GRANT UPDATE ON TABLE "public"."inventory_check_items" TO "anon";

GRANT DELETE ON TABLE "public"."inventory_check_items" TO "authenticated";

GRANT INSERT ON TABLE "public"."inventory_check_items" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."inventory_check_items" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."inventory_check_items" TO "authenticated";

GRANT SELECT ON TABLE "public"."inventory_check_items" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."inventory_check_items" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."inventory_check_items" TO "authenticated";

GRANT UPDATE ON TABLE "public"."inventory_check_items" TO "authenticated";

GRANT DELETE ON TABLE "public"."inventory_check_items" TO "postgres";

GRANT INSERT ON TABLE "public"."inventory_check_items" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."inventory_check_items" TO "postgres";

GRANT REFERENCES ON TABLE "public"."inventory_check_items" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_check_items" TO "postgres";

GRANT TRIGGER ON TABLE "public"."inventory_check_items" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."inventory_check_items" TO "postgres";

GRANT UPDATE ON TABLE "public"."inventory_check_items" TO "postgres";

GRANT DELETE ON TABLE "public"."inventory_check_items" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_check_items" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."inventory_check_items" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inventory_check_items" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_check_items" TO "service_role";

GRANT TRIGGER ON TABLE "public"."inventory_check_items" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."inventory_check_items" TO "service_role";

GRANT UPDATE ON TABLE "public"."inventory_check_items" TO "service_role";

GRANT DELETE ON TABLE "public"."inventory_checks" TO "anon";

GRANT INSERT ON TABLE "public"."inventory_checks" TO "anon";

GRANT MAINTAIN ON TABLE "public"."inventory_checks" TO "anon";

GRANT REFERENCES ON TABLE "public"."inventory_checks" TO "anon";

GRANT SELECT ON TABLE "public"."inventory_checks" TO "anon";

GRANT TRIGGER ON TABLE "public"."inventory_checks" TO "anon";

GRANT TRUNCATE ON TABLE "public"."inventory_checks" TO "anon";

GRANT UPDATE ON TABLE "public"."inventory_checks" TO "anon";

GRANT DELETE ON TABLE "public"."inventory_checks" TO "authenticated";

GRANT INSERT ON TABLE "public"."inventory_checks" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."inventory_checks" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."inventory_checks" TO "authenticated";

GRANT SELECT ON TABLE "public"."inventory_checks" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."inventory_checks" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."inventory_checks" TO "authenticated";

GRANT UPDATE ON TABLE "public"."inventory_checks" TO "authenticated";

GRANT DELETE ON TABLE "public"."inventory_checks" TO "postgres";

GRANT INSERT ON TABLE "public"."inventory_checks" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."inventory_checks" TO "postgres";

GRANT REFERENCES ON TABLE "public"."inventory_checks" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_checks" TO "postgres";

GRANT TRIGGER ON TABLE "public"."inventory_checks" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."inventory_checks" TO "postgres";

GRANT UPDATE ON TABLE "public"."inventory_checks" TO "postgres";

GRANT DELETE ON TABLE "public"."inventory_checks" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_checks" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."inventory_checks" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inventory_checks" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_checks" TO "service_role";

GRANT TRIGGER ON TABLE "public"."inventory_checks" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."inventory_checks" TO "service_role";

GRANT UPDATE ON TABLE "public"."inventory_checks" TO "service_role";

GRANT DELETE ON TABLE "public"."inventory_compartments" TO "anon";

GRANT INSERT ON TABLE "public"."inventory_compartments" TO "anon";

GRANT MAINTAIN ON TABLE "public"."inventory_compartments" TO "anon";

GRANT REFERENCES ON TABLE "public"."inventory_compartments" TO "anon";

GRANT SELECT ON TABLE "public"."inventory_compartments" TO "anon";

GRANT TRIGGER ON TABLE "public"."inventory_compartments" TO "anon";

GRANT TRUNCATE ON TABLE "public"."inventory_compartments" TO "anon";

GRANT UPDATE ON TABLE "public"."inventory_compartments" TO "anon";

GRANT DELETE ON TABLE "public"."inventory_compartments" TO "authenticated";

GRANT INSERT ON TABLE "public"."inventory_compartments" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."inventory_compartments" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."inventory_compartments" TO "authenticated";

GRANT SELECT ON TABLE "public"."inventory_compartments" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."inventory_compartments" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."inventory_compartments" TO "authenticated";

GRANT UPDATE ON TABLE "public"."inventory_compartments" TO "authenticated";

GRANT DELETE ON TABLE "public"."inventory_compartments" TO "postgres";

GRANT INSERT ON TABLE "public"."inventory_compartments" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."inventory_compartments" TO "postgres";

GRANT REFERENCES ON TABLE "public"."inventory_compartments" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_compartments" TO "postgres";

GRANT TRIGGER ON TABLE "public"."inventory_compartments" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."inventory_compartments" TO "postgres";

GRANT UPDATE ON TABLE "public"."inventory_compartments" TO "postgres";

GRANT DELETE ON TABLE "public"."inventory_compartments" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_compartments" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."inventory_compartments" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inventory_compartments" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_compartments" TO "service_role";

GRANT TRIGGER ON TABLE "public"."inventory_compartments" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."inventory_compartments" TO "service_role";

GRANT UPDATE ON TABLE "public"."inventory_compartments" TO "service_role";

GRANT DELETE ON TABLE "public"."inventory_deficiency_photos" TO "anon";

GRANT INSERT ON TABLE "public"."inventory_deficiency_photos" TO "anon";

GRANT MAINTAIN ON TABLE "public"."inventory_deficiency_photos" TO "anon";

GRANT REFERENCES ON TABLE "public"."inventory_deficiency_photos" TO "anon";

GRANT SELECT ON TABLE "public"."inventory_deficiency_photos" TO "anon";

GRANT TRIGGER ON TABLE "public"."inventory_deficiency_photos" TO "anon";

GRANT TRUNCATE ON TABLE "public"."inventory_deficiency_photos" TO "anon";

GRANT UPDATE ON TABLE "public"."inventory_deficiency_photos" TO "anon";

GRANT DELETE ON TABLE "public"."inventory_deficiency_photos" TO "authenticated";

GRANT INSERT ON TABLE "public"."inventory_deficiency_photos" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."inventory_deficiency_photos" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."inventory_deficiency_photos" TO "authenticated";

GRANT SELECT ON TABLE "public"."inventory_deficiency_photos" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."inventory_deficiency_photos" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."inventory_deficiency_photos" TO "authenticated";

GRANT UPDATE ON TABLE "public"."inventory_deficiency_photos" TO "authenticated";

GRANT DELETE ON TABLE "public"."inventory_deficiency_photos" TO "postgres";

GRANT INSERT ON TABLE "public"."inventory_deficiency_photos" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."inventory_deficiency_photos" TO "postgres";

GRANT REFERENCES ON TABLE "public"."inventory_deficiency_photos" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_deficiency_photos" TO "postgres";

GRANT TRIGGER ON TABLE "public"."inventory_deficiency_photos" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."inventory_deficiency_photos" TO "postgres";

GRANT UPDATE ON TABLE "public"."inventory_deficiency_photos" TO "postgres";

GRANT DELETE ON TABLE "public"."inventory_deficiency_photos" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_deficiency_photos" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."inventory_deficiency_photos" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inventory_deficiency_photos" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_deficiency_photos" TO "service_role";

GRANT TRIGGER ON TABLE "public"."inventory_deficiency_photos" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."inventory_deficiency_photos" TO "service_role";

GRANT UPDATE ON TABLE "public"."inventory_deficiency_photos" TO "service_role";

GRANT DELETE ON TABLE "public"."inventory_equipment" TO "anon";

GRANT INSERT ON TABLE "public"."inventory_equipment" TO "anon";

GRANT MAINTAIN ON TABLE "public"."inventory_equipment" TO "anon";

GRANT REFERENCES ON TABLE "public"."inventory_equipment" TO "anon";

GRANT SELECT ON TABLE "public"."inventory_equipment" TO "anon";

GRANT TRIGGER ON TABLE "public"."inventory_equipment" TO "anon";

GRANT TRUNCATE ON TABLE "public"."inventory_equipment" TO "anon";

GRANT UPDATE ON TABLE "public"."inventory_equipment" TO "anon";

GRANT DELETE ON TABLE "public"."inventory_equipment" TO "authenticated";

GRANT INSERT ON TABLE "public"."inventory_equipment" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."inventory_equipment" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."inventory_equipment" TO "authenticated";

GRANT SELECT ON TABLE "public"."inventory_equipment" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."inventory_equipment" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."inventory_equipment" TO "authenticated";

GRANT UPDATE ON TABLE "public"."inventory_equipment" TO "authenticated";

GRANT DELETE ON TABLE "public"."inventory_equipment" TO "postgres";

GRANT INSERT ON TABLE "public"."inventory_equipment" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."inventory_equipment" TO "postgres";

GRANT REFERENCES ON TABLE "public"."inventory_equipment" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_equipment" TO "postgres";

GRANT TRIGGER ON TABLE "public"."inventory_equipment" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."inventory_equipment" TO "postgres";

GRANT UPDATE ON TABLE "public"."inventory_equipment" TO "postgres";

GRANT DELETE ON TABLE "public"."inventory_equipment" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_equipment" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."inventory_equipment" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inventory_equipment" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_equipment" TO "service_role";

GRANT TRIGGER ON TABLE "public"."inventory_equipment" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."inventory_equipment" TO "service_role";

GRANT UPDATE ON TABLE "public"."inventory_equipment" TO "service_role";

GRANT DELETE ON TABLE "public"."inventory_inspection_schedules" TO "anon";

GRANT INSERT ON TABLE "public"."inventory_inspection_schedules" TO "anon";

GRANT MAINTAIN ON TABLE "public"."inventory_inspection_schedules" TO "anon";

GRANT REFERENCES ON TABLE "public"."inventory_inspection_schedules" TO "anon";

GRANT SELECT ON TABLE "public"."inventory_inspection_schedules" TO "anon";

GRANT TRIGGER ON TABLE "public"."inventory_inspection_schedules" TO "anon";

GRANT TRUNCATE ON TABLE "public"."inventory_inspection_schedules" TO "anon";

GRANT UPDATE ON TABLE "public"."inventory_inspection_schedules" TO "anon";

GRANT DELETE ON TABLE "public"."inventory_inspection_schedules" TO "authenticated";

GRANT INSERT ON TABLE "public"."inventory_inspection_schedules" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."inventory_inspection_schedules" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."inventory_inspection_schedules" TO "authenticated";

GRANT SELECT ON TABLE "public"."inventory_inspection_schedules" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."inventory_inspection_schedules" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."inventory_inspection_schedules" TO "authenticated";

GRANT UPDATE ON TABLE "public"."inventory_inspection_schedules" TO "authenticated";

GRANT DELETE ON TABLE "public"."inventory_inspection_schedules" TO "postgres";

GRANT INSERT ON TABLE "public"."inventory_inspection_schedules" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."inventory_inspection_schedules" TO "postgres";

GRANT REFERENCES ON TABLE "public"."inventory_inspection_schedules" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_inspection_schedules" TO "postgres";

GRANT TRIGGER ON TABLE "public"."inventory_inspection_schedules" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."inventory_inspection_schedules" TO "postgres";

GRANT UPDATE ON TABLE "public"."inventory_inspection_schedules" TO "postgres";

GRANT DELETE ON TABLE "public"."inventory_inspection_schedules" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_inspection_schedules" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."inventory_inspection_schedules" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inventory_inspection_schedules" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_inspection_schedules" TO "service_role";

GRANT TRIGGER ON TABLE "public"."inventory_inspection_schedules" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."inventory_inspection_schedules" TO "service_role";

GRANT UPDATE ON TABLE "public"."inventory_inspection_schedules" TO "service_role";

GRANT DELETE ON TABLE "public"."inventory_location_change_requests" TO "authenticated";

GRANT INSERT ON TABLE "public"."inventory_location_change_requests" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."inventory_location_change_requests" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."inventory_location_change_requests" TO "authenticated";

GRANT SELECT ON TABLE "public"."inventory_location_change_requests" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."inventory_location_change_requests" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."inventory_location_change_requests" TO "authenticated";

GRANT UPDATE ON TABLE "public"."inventory_location_change_requests" TO "authenticated";

GRANT DELETE ON TABLE "public"."inventory_location_change_requests" TO "postgres";

GRANT INSERT ON TABLE "public"."inventory_location_change_requests" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."inventory_location_change_requests" TO "postgres";

GRANT REFERENCES ON TABLE "public"."inventory_location_change_requests" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_location_change_requests" TO "postgres";

GRANT TRIGGER ON TABLE "public"."inventory_location_change_requests" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."inventory_location_change_requests" TO "postgres";

GRANT UPDATE ON TABLE "public"."inventory_location_change_requests" TO "postgres";

GRANT DELETE ON TABLE "public"."inventory_location_change_requests" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_location_change_requests" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."inventory_location_change_requests" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inventory_location_change_requests" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_location_change_requests" TO "service_role";

GRANT TRIGGER ON TABLE "public"."inventory_location_change_requests" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."inventory_location_change_requests" TO "service_role";

GRANT UPDATE ON TABLE "public"."inventory_location_change_requests" TO "service_role";

GRANT DELETE ON TABLE "public"."inventory_operation_receipts" TO "authenticated";

GRANT INSERT ON TABLE "public"."inventory_operation_receipts" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."inventory_operation_receipts" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."inventory_operation_receipts" TO "authenticated";

GRANT SELECT ON TABLE "public"."inventory_operation_receipts" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."inventory_operation_receipts" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."inventory_operation_receipts" TO "authenticated";

GRANT UPDATE ON TABLE "public"."inventory_operation_receipts" TO "authenticated";

GRANT DELETE ON TABLE "public"."inventory_operation_receipts" TO "postgres";

GRANT INSERT ON TABLE "public"."inventory_operation_receipts" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."inventory_operation_receipts" TO "postgres";

GRANT REFERENCES ON TABLE "public"."inventory_operation_receipts" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_operation_receipts" TO "postgres";

GRANT TRIGGER ON TABLE "public"."inventory_operation_receipts" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."inventory_operation_receipts" TO "postgres";

GRANT UPDATE ON TABLE "public"."inventory_operation_receipts" TO "postgres";

GRANT DELETE ON TABLE "public"."inventory_operation_receipts" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_operation_receipts" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."inventory_operation_receipts" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inventory_operation_receipts" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_operation_receipts" TO "service_role";

GRANT TRIGGER ON TABLE "public"."inventory_operation_receipts" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."inventory_operation_receipts" TO "service_role";

GRANT UPDATE ON TABLE "public"."inventory_operation_receipts" TO "service_role";

GRANT DELETE ON TABLE "public"."inventory_photo_hotspots" TO "anon";

GRANT INSERT ON TABLE "public"."inventory_photo_hotspots" TO "anon";

GRANT MAINTAIN ON TABLE "public"."inventory_photo_hotspots" TO "anon";

GRANT REFERENCES ON TABLE "public"."inventory_photo_hotspots" TO "anon";

GRANT SELECT ON TABLE "public"."inventory_photo_hotspots" TO "anon";

GRANT TRIGGER ON TABLE "public"."inventory_photo_hotspots" TO "anon";

GRANT TRUNCATE ON TABLE "public"."inventory_photo_hotspots" TO "anon";

GRANT UPDATE ON TABLE "public"."inventory_photo_hotspots" TO "anon";

GRANT DELETE ON TABLE "public"."inventory_photo_hotspots" TO "authenticated";

GRANT INSERT ON TABLE "public"."inventory_photo_hotspots" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."inventory_photo_hotspots" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."inventory_photo_hotspots" TO "authenticated";

GRANT SELECT ON TABLE "public"."inventory_photo_hotspots" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."inventory_photo_hotspots" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."inventory_photo_hotspots" TO "authenticated";

GRANT UPDATE ON TABLE "public"."inventory_photo_hotspots" TO "authenticated";

GRANT DELETE ON TABLE "public"."inventory_photo_hotspots" TO "postgres";

GRANT INSERT ON TABLE "public"."inventory_photo_hotspots" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."inventory_photo_hotspots" TO "postgres";

GRANT REFERENCES ON TABLE "public"."inventory_photo_hotspots" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_photo_hotspots" TO "postgres";

GRANT TRIGGER ON TABLE "public"."inventory_photo_hotspots" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."inventory_photo_hotspots" TO "postgres";

GRANT UPDATE ON TABLE "public"."inventory_photo_hotspots" TO "postgres";

GRANT DELETE ON TABLE "public"."inventory_photo_hotspots" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_photo_hotspots" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."inventory_photo_hotspots" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inventory_photo_hotspots" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_photo_hotspots" TO "service_role";

GRANT TRIGGER ON TABLE "public"."inventory_photo_hotspots" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."inventory_photo_hotspots" TO "service_role";

GRANT UPDATE ON TABLE "public"."inventory_photo_hotspots" TO "service_role";

GRANT DELETE ON TABLE "public"."inventory_photo_views" TO "anon";

GRANT INSERT ON TABLE "public"."inventory_photo_views" TO "anon";

GRANT MAINTAIN ON TABLE "public"."inventory_photo_views" TO "anon";

GRANT REFERENCES ON TABLE "public"."inventory_photo_views" TO "anon";

GRANT SELECT ON TABLE "public"."inventory_photo_views" TO "anon";

GRANT TRIGGER ON TABLE "public"."inventory_photo_views" TO "anon";

GRANT TRUNCATE ON TABLE "public"."inventory_photo_views" TO "anon";

GRANT UPDATE ON TABLE "public"."inventory_photo_views" TO "anon";

GRANT DELETE ON TABLE "public"."inventory_photo_views" TO "authenticated";

GRANT INSERT ON TABLE "public"."inventory_photo_views" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."inventory_photo_views" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."inventory_photo_views" TO "authenticated";

GRANT SELECT ON TABLE "public"."inventory_photo_views" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."inventory_photo_views" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."inventory_photo_views" TO "authenticated";

GRANT UPDATE ON TABLE "public"."inventory_photo_views" TO "authenticated";

GRANT DELETE ON TABLE "public"."inventory_photo_views" TO "postgres";

GRANT INSERT ON TABLE "public"."inventory_photo_views" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."inventory_photo_views" TO "postgres";

GRANT REFERENCES ON TABLE "public"."inventory_photo_views" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_photo_views" TO "postgres";

GRANT TRIGGER ON TABLE "public"."inventory_photo_views" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."inventory_photo_views" TO "postgres";

GRANT UPDATE ON TABLE "public"."inventory_photo_views" TO "postgres";

GRANT DELETE ON TABLE "public"."inventory_photo_views" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_photo_views" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."inventory_photo_views" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inventory_photo_views" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_photo_views" TO "service_role";

GRANT TRIGGER ON TABLE "public"."inventory_photo_views" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."inventory_photo_views" TO "service_role";

GRANT UPDATE ON TABLE "public"."inventory_photo_views" TO "service_role";

GRANT DELETE ON TABLE "public"."inventory_readiness_exceptions" TO "anon";

GRANT INSERT ON TABLE "public"."inventory_readiness_exceptions" TO "anon";

GRANT MAINTAIN ON TABLE "public"."inventory_readiness_exceptions" TO "anon";

GRANT REFERENCES ON TABLE "public"."inventory_readiness_exceptions" TO "anon";

GRANT SELECT ON TABLE "public"."inventory_readiness_exceptions" TO "anon";

GRANT TRIGGER ON TABLE "public"."inventory_readiness_exceptions" TO "anon";

GRANT TRUNCATE ON TABLE "public"."inventory_readiness_exceptions" TO "anon";

GRANT UPDATE ON TABLE "public"."inventory_readiness_exceptions" TO "anon";

GRANT DELETE ON TABLE "public"."inventory_readiness_exceptions" TO "authenticated";

GRANT INSERT ON TABLE "public"."inventory_readiness_exceptions" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."inventory_readiness_exceptions" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."inventory_readiness_exceptions" TO "authenticated";

GRANT SELECT ON TABLE "public"."inventory_readiness_exceptions" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."inventory_readiness_exceptions" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."inventory_readiness_exceptions" TO "authenticated";

GRANT UPDATE ON TABLE "public"."inventory_readiness_exceptions" TO "authenticated";

GRANT DELETE ON TABLE "public"."inventory_readiness_exceptions" TO "postgres";

GRANT INSERT ON TABLE "public"."inventory_readiness_exceptions" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."inventory_readiness_exceptions" TO "postgres";

GRANT REFERENCES ON TABLE "public"."inventory_readiness_exceptions" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_readiness_exceptions" TO "postgres";

GRANT TRIGGER ON TABLE "public"."inventory_readiness_exceptions" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."inventory_readiness_exceptions" TO "postgres";

GRANT UPDATE ON TABLE "public"."inventory_readiness_exceptions" TO "postgres";

GRANT DELETE ON TABLE "public"."inventory_readiness_exceptions" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_readiness_exceptions" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."inventory_readiness_exceptions" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inventory_readiness_exceptions" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_readiness_exceptions" TO "service_role";

GRANT TRIGGER ON TABLE "public"."inventory_readiness_exceptions" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."inventory_readiness_exceptions" TO "service_role";

GRANT UPDATE ON TABLE "public"."inventory_readiness_exceptions" TO "service_role";

GRANT DELETE ON TABLE "public"."inventory_scba_check_entries" TO "authenticated";

GRANT INSERT ON TABLE "public"."inventory_scba_check_entries" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."inventory_scba_check_entries" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."inventory_scba_check_entries" TO "authenticated";

GRANT SELECT ON TABLE "public"."inventory_scba_check_entries" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."inventory_scba_check_entries" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."inventory_scba_check_entries" TO "authenticated";

GRANT UPDATE ON TABLE "public"."inventory_scba_check_entries" TO "authenticated";

GRANT DELETE ON TABLE "public"."inventory_scba_check_entries" TO "postgres";

GRANT INSERT ON TABLE "public"."inventory_scba_check_entries" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."inventory_scba_check_entries" TO "postgres";

GRANT REFERENCES ON TABLE "public"."inventory_scba_check_entries" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_scba_check_entries" TO "postgres";

GRANT TRIGGER ON TABLE "public"."inventory_scba_check_entries" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."inventory_scba_check_entries" TO "postgres";

GRANT UPDATE ON TABLE "public"."inventory_scba_check_entries" TO "postgres";

GRANT DELETE ON TABLE "public"."inventory_scba_check_entries" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_scba_check_entries" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."inventory_scba_check_entries" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inventory_scba_check_entries" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_scba_check_entries" TO "service_role";

GRANT TRIGGER ON TABLE "public"."inventory_scba_check_entries" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."inventory_scba_check_entries" TO "service_role";

GRANT UPDATE ON TABLE "public"."inventory_scba_check_entries" TO "service_role";

GRANT DELETE ON TABLE "public"."inventory_scba_templates" TO "authenticated";

GRANT INSERT ON TABLE "public"."inventory_scba_templates" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."inventory_scba_templates" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."inventory_scba_templates" TO "authenticated";

GRANT SELECT ON TABLE "public"."inventory_scba_templates" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."inventory_scba_templates" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."inventory_scba_templates" TO "authenticated";

GRANT UPDATE ON TABLE "public"."inventory_scba_templates" TO "authenticated";

GRANT DELETE ON TABLE "public"."inventory_scba_templates" TO "postgres";

GRANT INSERT ON TABLE "public"."inventory_scba_templates" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."inventory_scba_templates" TO "postgres";

GRANT REFERENCES ON TABLE "public"."inventory_scba_templates" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_scba_templates" TO "postgres";

GRANT TRIGGER ON TABLE "public"."inventory_scba_templates" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."inventory_scba_templates" TO "postgres";

GRANT UPDATE ON TABLE "public"."inventory_scba_templates" TO "postgres";

GRANT DELETE ON TABLE "public"."inventory_scba_templates" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_scba_templates" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."inventory_scba_templates" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inventory_scba_templates" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_scba_templates" TO "service_role";

GRANT TRIGGER ON TABLE "public"."inventory_scba_templates" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."inventory_scba_templates" TO "service_role";

GRANT UPDATE ON TABLE "public"."inventory_scba_templates" TO "service_role";

GRANT DELETE ON TABLE "public"."inventory_stock_items" TO "anon";

GRANT INSERT ON TABLE "public"."inventory_stock_items" TO "anon";

GRANT MAINTAIN ON TABLE "public"."inventory_stock_items" TO "anon";

GRANT REFERENCES ON TABLE "public"."inventory_stock_items" TO "anon";

GRANT SELECT ON TABLE "public"."inventory_stock_items" TO "anon";

GRANT TRIGGER ON TABLE "public"."inventory_stock_items" TO "anon";

GRANT TRUNCATE ON TABLE "public"."inventory_stock_items" TO "anon";

GRANT UPDATE ON TABLE "public"."inventory_stock_items" TO "anon";

GRANT DELETE ON TABLE "public"."inventory_stock_items" TO "authenticated";

GRANT INSERT ON TABLE "public"."inventory_stock_items" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."inventory_stock_items" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."inventory_stock_items" TO "authenticated";

GRANT SELECT ON TABLE "public"."inventory_stock_items" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."inventory_stock_items" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."inventory_stock_items" TO "authenticated";

GRANT UPDATE ON TABLE "public"."inventory_stock_items" TO "authenticated";

GRANT DELETE ON TABLE "public"."inventory_stock_items" TO "postgres";

GRANT INSERT ON TABLE "public"."inventory_stock_items" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."inventory_stock_items" TO "postgres";

GRANT REFERENCES ON TABLE "public"."inventory_stock_items" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_stock_items" TO "postgres";

GRANT TRIGGER ON TABLE "public"."inventory_stock_items" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."inventory_stock_items" TO "postgres";

GRANT UPDATE ON TABLE "public"."inventory_stock_items" TO "postgres";

GRANT DELETE ON TABLE "public"."inventory_stock_items" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_stock_items" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."inventory_stock_items" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inventory_stock_items" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_stock_items" TO "service_role";

GRANT TRIGGER ON TABLE "public"."inventory_stock_items" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."inventory_stock_items" TO "service_role";

GRANT UPDATE ON TABLE "public"."inventory_stock_items" TO "service_role";

GRANT DELETE ON TABLE "public"."inventory_stock_lots" TO "anon";

GRANT INSERT ON TABLE "public"."inventory_stock_lots" TO "anon";

GRANT MAINTAIN ON TABLE "public"."inventory_stock_lots" TO "anon";

GRANT REFERENCES ON TABLE "public"."inventory_stock_lots" TO "anon";

GRANT SELECT ON TABLE "public"."inventory_stock_lots" TO "anon";

GRANT TRIGGER ON TABLE "public"."inventory_stock_lots" TO "anon";

GRANT TRUNCATE ON TABLE "public"."inventory_stock_lots" TO "anon";

GRANT UPDATE ON TABLE "public"."inventory_stock_lots" TO "anon";

GRANT DELETE ON TABLE "public"."inventory_stock_lots" TO "authenticated";

GRANT INSERT ON TABLE "public"."inventory_stock_lots" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."inventory_stock_lots" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."inventory_stock_lots" TO "authenticated";

GRANT SELECT ON TABLE "public"."inventory_stock_lots" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."inventory_stock_lots" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."inventory_stock_lots" TO "authenticated";

GRANT UPDATE ON TABLE "public"."inventory_stock_lots" TO "authenticated";

GRANT DELETE ON TABLE "public"."inventory_stock_lots" TO "postgres";

GRANT INSERT ON TABLE "public"."inventory_stock_lots" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."inventory_stock_lots" TO "postgres";

GRANT REFERENCES ON TABLE "public"."inventory_stock_lots" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_stock_lots" TO "postgres";

GRANT TRIGGER ON TABLE "public"."inventory_stock_lots" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."inventory_stock_lots" TO "postgres";

GRANT UPDATE ON TABLE "public"."inventory_stock_lots" TO "postgres";

GRANT DELETE ON TABLE "public"."inventory_stock_lots" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_stock_lots" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."inventory_stock_lots" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inventory_stock_lots" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_stock_lots" TO "service_role";

GRANT TRIGGER ON TABLE "public"."inventory_stock_lots" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."inventory_stock_lots" TO "service_role";

GRANT UPDATE ON TABLE "public"."inventory_stock_lots" TO "service_role";

GRANT DELETE ON TABLE "public"."inventory_transactions" TO "anon";

GRANT INSERT ON TABLE "public"."inventory_transactions" TO "anon";

GRANT MAINTAIN ON TABLE "public"."inventory_transactions" TO "anon";

GRANT REFERENCES ON TABLE "public"."inventory_transactions" TO "anon";

GRANT SELECT ON TABLE "public"."inventory_transactions" TO "anon";

GRANT TRIGGER ON TABLE "public"."inventory_transactions" TO "anon";

GRANT TRUNCATE ON TABLE "public"."inventory_transactions" TO "anon";

GRANT UPDATE ON TABLE "public"."inventory_transactions" TO "anon";

GRANT DELETE ON TABLE "public"."inventory_transactions" TO "authenticated";

GRANT INSERT ON TABLE "public"."inventory_transactions" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."inventory_transactions" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."inventory_transactions" TO "authenticated";

GRANT SELECT ON TABLE "public"."inventory_transactions" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."inventory_transactions" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."inventory_transactions" TO "authenticated";

GRANT UPDATE ON TABLE "public"."inventory_transactions" TO "authenticated";

GRANT DELETE ON TABLE "public"."inventory_transactions" TO "postgres";

GRANT INSERT ON TABLE "public"."inventory_transactions" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."inventory_transactions" TO "postgres";

GRANT REFERENCES ON TABLE "public"."inventory_transactions" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_transactions" TO "postgres";

GRANT TRIGGER ON TABLE "public"."inventory_transactions" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."inventory_transactions" TO "postgres";

GRANT UPDATE ON TABLE "public"."inventory_transactions" TO "postgres";

GRANT DELETE ON TABLE "public"."inventory_transactions" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_transactions" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."inventory_transactions" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inventory_transactions" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_transactions" TO "service_role";

GRANT TRIGGER ON TABLE "public"."inventory_transactions" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."inventory_transactions" TO "service_role";

GRANT UPDATE ON TABLE "public"."inventory_transactions" TO "service_role";

GRANT DELETE ON TABLE "public"."inventory_work_order_documents" TO "anon";

GRANT INSERT ON TABLE "public"."inventory_work_order_documents" TO "anon";

GRANT MAINTAIN ON TABLE "public"."inventory_work_order_documents" TO "anon";

GRANT REFERENCES ON TABLE "public"."inventory_work_order_documents" TO "anon";

GRANT SELECT ON TABLE "public"."inventory_work_order_documents" TO "anon";

GRANT TRIGGER ON TABLE "public"."inventory_work_order_documents" TO "anon";

GRANT TRUNCATE ON TABLE "public"."inventory_work_order_documents" TO "anon";

GRANT UPDATE ON TABLE "public"."inventory_work_order_documents" TO "anon";

GRANT DELETE ON TABLE "public"."inventory_work_order_documents" TO "authenticated";

GRANT INSERT ON TABLE "public"."inventory_work_order_documents" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."inventory_work_order_documents" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."inventory_work_order_documents" TO "authenticated";

GRANT SELECT ON TABLE "public"."inventory_work_order_documents" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."inventory_work_order_documents" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."inventory_work_order_documents" TO "authenticated";

GRANT UPDATE ON TABLE "public"."inventory_work_order_documents" TO "authenticated";

GRANT DELETE ON TABLE "public"."inventory_work_order_documents" TO "postgres";

GRANT INSERT ON TABLE "public"."inventory_work_order_documents" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."inventory_work_order_documents" TO "postgres";

GRANT REFERENCES ON TABLE "public"."inventory_work_order_documents" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_work_order_documents" TO "postgres";

GRANT TRIGGER ON TABLE "public"."inventory_work_order_documents" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."inventory_work_order_documents" TO "postgres";

GRANT UPDATE ON TABLE "public"."inventory_work_order_documents" TO "postgres";

GRANT DELETE ON TABLE "public"."inventory_work_order_documents" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_work_order_documents" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."inventory_work_order_documents" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inventory_work_order_documents" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_work_order_documents" TO "service_role";

GRANT TRIGGER ON TABLE "public"."inventory_work_order_documents" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."inventory_work_order_documents" TO "service_role";

GRANT UPDATE ON TABLE "public"."inventory_work_order_documents" TO "service_role";

GRANT DELETE ON TABLE "public"."inventory_work_orders" TO "anon";

GRANT INSERT ON TABLE "public"."inventory_work_orders" TO "anon";

GRANT MAINTAIN ON TABLE "public"."inventory_work_orders" TO "anon";

GRANT REFERENCES ON TABLE "public"."inventory_work_orders" TO "anon";

GRANT SELECT ON TABLE "public"."inventory_work_orders" TO "anon";

GRANT TRIGGER ON TABLE "public"."inventory_work_orders" TO "anon";

GRANT TRUNCATE ON TABLE "public"."inventory_work_orders" TO "anon";

GRANT UPDATE ON TABLE "public"."inventory_work_orders" TO "anon";

GRANT DELETE ON TABLE "public"."inventory_work_orders" TO "authenticated";

GRANT INSERT ON TABLE "public"."inventory_work_orders" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."inventory_work_orders" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."inventory_work_orders" TO "authenticated";

GRANT SELECT ON TABLE "public"."inventory_work_orders" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."inventory_work_orders" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."inventory_work_orders" TO "authenticated";

GRANT UPDATE ON TABLE "public"."inventory_work_orders" TO "authenticated";

GRANT DELETE ON TABLE "public"."inventory_work_orders" TO "postgres";

GRANT INSERT ON TABLE "public"."inventory_work_orders" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."inventory_work_orders" TO "postgres";

GRANT REFERENCES ON TABLE "public"."inventory_work_orders" TO "postgres";

GRANT SELECT ON TABLE "public"."inventory_work_orders" TO "postgres";

GRANT TRIGGER ON TABLE "public"."inventory_work_orders" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."inventory_work_orders" TO "postgres";

GRANT UPDATE ON TABLE "public"."inventory_work_orders" TO "postgres";

GRANT DELETE ON TABLE "public"."inventory_work_orders" TO "service_role";

GRANT INSERT ON TABLE "public"."inventory_work_orders" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."inventory_work_orders" TO "service_role";

GRANT REFERENCES ON TABLE "public"."inventory_work_orders" TO "service_role";

GRANT SELECT ON TABLE "public"."inventory_work_orders" TO "service_role";

GRANT TRIGGER ON TABLE "public"."inventory_work_orders" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."inventory_work_orders" TO "service_role";

GRANT UPDATE ON TABLE "public"."inventory_work_orders" TO "service_role";

GRANT DELETE ON TABLE "public"."platform_owners" TO "anon";

GRANT INSERT ON TABLE "public"."platform_owners" TO "anon";

GRANT MAINTAIN ON TABLE "public"."platform_owners" TO "anon";

GRANT REFERENCES ON TABLE "public"."platform_owners" TO "anon";

GRANT SELECT ON TABLE "public"."platform_owners" TO "anon";

GRANT TRIGGER ON TABLE "public"."platform_owners" TO "anon";

GRANT TRUNCATE ON TABLE "public"."platform_owners" TO "anon";

GRANT UPDATE ON TABLE "public"."platform_owners" TO "anon";

GRANT DELETE ON TABLE "public"."platform_owners" TO "authenticated";

GRANT INSERT ON TABLE "public"."platform_owners" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."platform_owners" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."platform_owners" TO "authenticated";

GRANT SELECT ON TABLE "public"."platform_owners" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."platform_owners" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."platform_owners" TO "authenticated";

GRANT UPDATE ON TABLE "public"."platform_owners" TO "authenticated";

GRANT DELETE ON TABLE "public"."platform_owners" TO "postgres";

GRANT INSERT ON TABLE "public"."platform_owners" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."platform_owners" TO "postgres";

GRANT REFERENCES ON TABLE "public"."platform_owners" TO "postgres";

GRANT SELECT ON TABLE "public"."platform_owners" TO "postgres";

GRANT TRIGGER ON TABLE "public"."platform_owners" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."platform_owners" TO "postgres";

GRANT UPDATE ON TABLE "public"."platform_owners" TO "postgres";

GRANT DELETE ON TABLE "public"."platform_owners" TO "service_role";

GRANT INSERT ON TABLE "public"."platform_owners" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."platform_owners" TO "service_role";

GRANT REFERENCES ON TABLE "public"."platform_owners" TO "service_role";

GRANT SELECT ON TABLE "public"."platform_owners" TO "service_role";

GRANT TRIGGER ON TABLE "public"."platform_owners" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."platform_owners" TO "service_role";

GRANT UPDATE ON TABLE "public"."platform_owners" TO "service_role";

GRANT SELECT ON TABLE "public"."portal_access_emails" TO "authenticated";

GRANT DELETE ON TABLE "public"."portal_access_emails" TO "postgres";

GRANT INSERT ON TABLE "public"."portal_access_emails" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."portal_access_emails" TO "postgres";

GRANT REFERENCES ON TABLE "public"."portal_access_emails" TO "postgres";

GRANT SELECT ON TABLE "public"."portal_access_emails" TO "postgres";

GRANT TRIGGER ON TABLE "public"."portal_access_emails" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."portal_access_emails" TO "postgres";

GRANT UPDATE ON TABLE "public"."portal_access_emails" TO "postgres";

GRANT DELETE ON TABLE "public"."portal_access_emails" TO "service_role";

GRANT INSERT ON TABLE "public"."portal_access_emails" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."portal_access_emails" TO "service_role";

GRANT REFERENCES ON TABLE "public"."portal_access_emails" TO "service_role";

GRANT SELECT ON TABLE "public"."portal_access_emails" TO "service_role";

GRANT TRIGGER ON TABLE "public"."portal_access_emails" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."portal_access_emails" TO "service_role";

GRANT UPDATE ON TABLE "public"."portal_access_emails" TO "service_role";

GRANT DELETE ON TABLE "public"."portal_invite_admins" TO "postgres";

GRANT INSERT ON TABLE "public"."portal_invite_admins" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."portal_invite_admins" TO "postgres";

GRANT REFERENCES ON TABLE "public"."portal_invite_admins" TO "postgres";

GRANT SELECT ON TABLE "public"."portal_invite_admins" TO "postgres";

GRANT TRIGGER ON TABLE "public"."portal_invite_admins" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."portal_invite_admins" TO "postgres";

GRANT UPDATE ON TABLE "public"."portal_invite_admins" TO "postgres";

GRANT DELETE ON TABLE "public"."portal_invite_admins" TO "service_role";

GRANT INSERT ON TABLE "public"."portal_invite_admins" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."portal_invite_admins" TO "service_role";

GRANT REFERENCES ON TABLE "public"."portal_invite_admins" TO "service_role";

GRANT SELECT ON TABLE "public"."portal_invite_admins" TO "service_role";

GRANT TRIGGER ON TABLE "public"."portal_invite_admins" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."portal_invite_admins" TO "service_role";

GRANT UPDATE ON TABLE "public"."portal_invite_admins" TO "service_role";

GRANT DELETE ON TABLE "public"."portal_pin_credentials" TO "postgres";

GRANT INSERT ON TABLE "public"."portal_pin_credentials" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."portal_pin_credentials" TO "postgres";

GRANT REFERENCES ON TABLE "public"."portal_pin_credentials" TO "postgres";

GRANT SELECT ON TABLE "public"."portal_pin_credentials" TO "postgres";

GRANT TRIGGER ON TABLE "public"."portal_pin_credentials" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."portal_pin_credentials" TO "postgres";

GRANT UPDATE ON TABLE "public"."portal_pin_credentials" TO "postgres";

GRANT DELETE ON TABLE "public"."portal_pin_credentials" TO "service_role";

GRANT INSERT ON TABLE "public"."portal_pin_credentials" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."portal_pin_credentials" TO "service_role";

GRANT REFERENCES ON TABLE "public"."portal_pin_credentials" TO "service_role";

GRANT SELECT ON TABLE "public"."portal_pin_credentials" TO "service_role";

GRANT TRIGGER ON TABLE "public"."portal_pin_credentials" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."portal_pin_credentials" TO "service_role";

GRANT UPDATE ON TABLE "public"."portal_pin_credentials" TO "service_role";

GRANT DELETE ON TABLE "public"."push_subscriptions" TO "anon";

GRANT INSERT ON TABLE "public"."push_subscriptions" TO "anon";

GRANT MAINTAIN ON TABLE "public"."push_subscriptions" TO "anon";

GRANT REFERENCES ON TABLE "public"."push_subscriptions" TO "anon";

GRANT SELECT ON TABLE "public"."push_subscriptions" TO "anon";

GRANT TRIGGER ON TABLE "public"."push_subscriptions" TO "anon";

GRANT TRUNCATE ON TABLE "public"."push_subscriptions" TO "anon";

GRANT UPDATE ON TABLE "public"."push_subscriptions" TO "anon";

GRANT DELETE ON TABLE "public"."push_subscriptions" TO "authenticated";

GRANT INSERT ON TABLE "public"."push_subscriptions" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."push_subscriptions" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."push_subscriptions" TO "authenticated";

GRANT SELECT ON TABLE "public"."push_subscriptions" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."push_subscriptions" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."push_subscriptions" TO "authenticated";

GRANT UPDATE ON TABLE "public"."push_subscriptions" TO "authenticated";

GRANT DELETE ON TABLE "public"."push_subscriptions" TO "postgres";

GRANT INSERT ON TABLE "public"."push_subscriptions" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."push_subscriptions" TO "postgres";

GRANT REFERENCES ON TABLE "public"."push_subscriptions" TO "postgres";

GRANT SELECT ON TABLE "public"."push_subscriptions" TO "postgres";

GRANT TRIGGER ON TABLE "public"."push_subscriptions" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."push_subscriptions" TO "postgres";

GRANT UPDATE ON TABLE "public"."push_subscriptions" TO "postgres";

GRANT DELETE ON TABLE "public"."push_subscriptions" TO "service_role";

GRANT INSERT ON TABLE "public"."push_subscriptions" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."push_subscriptions" TO "service_role";

GRANT REFERENCES ON TABLE "public"."push_subscriptions" TO "service_role";

GRANT SELECT ON TABLE "public"."push_subscriptions" TO "service_role";

GRANT TRIGGER ON TABLE "public"."push_subscriptions" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."push_subscriptions" TO "service_role";

GRANT UPDATE ON TABLE "public"."push_subscriptions" TO "service_role";

GRANT DELETE ON TABLE "public"."user_profiles" TO "anon";

GRANT INSERT ON TABLE "public"."user_profiles" TO "anon";

GRANT MAINTAIN ON TABLE "public"."user_profiles" TO "anon";

GRANT REFERENCES ON TABLE "public"."user_profiles" TO "anon";

GRANT SELECT ON TABLE "public"."user_profiles" TO "anon";

GRANT TRIGGER ON TABLE "public"."user_profiles" TO "anon";

GRANT TRUNCATE ON TABLE "public"."user_profiles" TO "anon";

GRANT UPDATE ON TABLE "public"."user_profiles" TO "anon";

GRANT DELETE ON TABLE "public"."user_profiles" TO "authenticated";

GRANT INSERT ON TABLE "public"."user_profiles" TO "authenticated";

GRANT MAINTAIN ON TABLE "public"."user_profiles" TO "authenticated";

GRANT REFERENCES ON TABLE "public"."user_profiles" TO "authenticated";

GRANT SELECT ON TABLE "public"."user_profiles" TO "authenticated";

GRANT TRIGGER ON TABLE "public"."user_profiles" TO "authenticated";

GRANT TRUNCATE ON TABLE "public"."user_profiles" TO "authenticated";

GRANT UPDATE ON TABLE "public"."user_profiles" TO "authenticated";

GRANT DELETE ON TABLE "public"."user_profiles" TO "postgres";

GRANT INSERT ON TABLE "public"."user_profiles" TO "postgres";

GRANT MAINTAIN ON TABLE "public"."user_profiles" TO "postgres";

GRANT REFERENCES ON TABLE "public"."user_profiles" TO "postgres";

GRANT SELECT ON TABLE "public"."user_profiles" TO "postgres";

GRANT TRIGGER ON TABLE "public"."user_profiles" TO "postgres";

GRANT TRUNCATE ON TABLE "public"."user_profiles" TO "postgres";

GRANT UPDATE ON TABLE "public"."user_profiles" TO "postgres";

GRANT DELETE ON TABLE "public"."user_profiles" TO "service_role";

GRANT INSERT ON TABLE "public"."user_profiles" TO "service_role";

GRANT MAINTAIN ON TABLE "public"."user_profiles" TO "service_role";

GRANT REFERENCES ON TABLE "public"."user_profiles" TO "service_role";

GRANT SELECT ON TABLE "public"."user_profiles" TO "service_role";

GRANT TRIGGER ON TABLE "public"."user_profiles" TO "service_role";

GRANT TRUNCATE ON TABLE "public"."user_profiles" TO "service_role";

GRANT UPDATE ON TABLE "public"."user_profiles" TO "service_role";

COMMIT;
