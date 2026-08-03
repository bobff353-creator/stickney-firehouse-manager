SET search_path TO firehouse, public;


CREATE OR REPLACE FUNCTION firehouse.has_department_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    COALESCE(public.is_platform_owner(), false)
    OR EXISTS (
      SELECT 1
      FROM public.department_memberships AS membership
      JOIN public.departments AS department ON department.id = membership.department_id
      WHERE membership.user_id = (SELECT auth.uid())
        AND membership.status = 'active'
        AND department.slug = 'stickney-fire-department'
    );
$$;
REVOKE ALL ON FUNCTION firehouse.has_department_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION firehouse.has_department_access() TO authenticated;


ALTER TABLE "box_cards" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_box_cards" ON "box_cards" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "box_cards" TO authenticated;

ALTER TABLE "cad_inbound_receipts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_cad_inbound_receipts" ON "cad_inbound_receipts" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "cad_inbound_receipts" TO authenticated;

ALTER TABLE "chief_board_attachments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_chief_board_attachments" ON "chief_board_attachments" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "chief_board_attachments" TO authenticated;

ALTER TABLE "chief_board_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_chief_board_items" ON "chief_board_items" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "chief_board_items" TO authenticated;

ALTER TABLE "daily_duties" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_daily_duties" ON "daily_duties" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "daily_duties" TO authenticated;

ALTER TABLE "daily_log_approvals" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_daily_log_approvals" ON "daily_log_approvals" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "daily_log_approvals" TO authenticated;

ALTER TABLE "daily_log_calls" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_daily_log_calls" ON "daily_log_calls" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "daily_log_calls" TO authenticated;

ALTER TABLE "daily_log_staffing" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_daily_log_staffing" ON "daily_log_staffing" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "daily_log_staffing" TO authenticated;

ALTER TABLE "daily_logs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_daily_logs" ON "daily_logs" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "daily_logs" TO authenticated;

ALTER TABLE "dispatch_incidents" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_dispatch_incidents" ON "dispatch_incidents" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "dispatch_incidents" TO authenticated;

ALTER TABLE "employee_permission_overrides" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_employee_permission_overrides" ON "employee_permission_overrides" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "employee_permission_overrides" TO authenticated;

ALTER TABLE "employee_profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_employee_profiles" ON "employee_profiles" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "employee_profiles" TO authenticated;

ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_employees" ON "employees" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "employees" TO authenticated;

ALTER TABLE "field_hydrant_flow_tests" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_field_hydrant_flow_tests" ON "field_hydrant_flow_tests" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "field_hydrant_flow_tests" TO authenticated;

ALTER TABLE "field_hydrant_flushes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_field_hydrant_flushes" ON "field_hydrant_flushes" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "field_hydrant_flushes" TO authenticated;

ALTER TABLE "field_hydrants" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_field_hydrants" ON "field_hydrants" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "field_hydrants" TO authenticated;

ALTER TABLE "field_preplan_features" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_field_preplan_features" ON "field_preplan_features" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "field_preplan_features" TO authenticated;

ALTER TABLE "field_preplan_imports" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_field_preplan_imports" ON "field_preplan_imports" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "field_preplan_imports" TO authenticated;

ALTER TABLE "field_preplan_photos" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_field_preplan_photos" ON "field_preplan_photos" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "field_preplan_photos" TO authenticated;

ALTER TABLE "field_preplans" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_field_preplans" ON "field_preplans" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "field_preplans" TO authenticated;

ALTER TABLE "fleet_apparatus" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_fleet_apparatus" ON "fleet_apparatus" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "fleet_apparatus" TO authenticated;

ALTER TABLE "important_phone_numbers" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_important_phone_numbers" ON "important_phone_numbers" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "important_phone_numbers" TO authenticated;

ALTER TABLE "incident_command_boards" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_incident_command_boards" ON "incident_command_boards" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "incident_command_boards" TO authenticated;

ALTER TABLE "incident_command_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_incident_command_events" ON "incident_command_events" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "incident_command_events" TO authenticated;

ALTER TABLE "inventory_audit_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_inventory_audit_events" ON "inventory_audit_events" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "inventory_audit_events" TO authenticated;

ALTER TABLE "inventory_compartments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_inventory_compartments" ON "inventory_compartments" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "inventory_compartments" TO authenticated;

ALTER TABLE "inventory_equipment" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_inventory_equipment" ON "inventory_equipment" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "inventory_equipment" TO authenticated;

ALTER TABLE "inventory_hotspots" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_inventory_hotspots" ON "inventory_hotspots" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "inventory_hotspots" TO authenticated;

ALTER TABLE "inventory_photos" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_inventory_photos" ON "inventory_photos" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "inventory_photos" TO authenticated;

ALTER TABLE "inventory_readiness" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_inventory_readiness" ON "inventory_readiness" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "inventory_readiness" TO authenticated;

ALTER TABLE "inventory_weekly_check_items" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_inventory_weekly_check_items" ON "inventory_weekly_check_items" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "inventory_weekly_check_items" TO authenticated;

ALTER TABLE "inventory_weekly_check_results" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_inventory_weekly_check_results" ON "inventory_weekly_check_results" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "inventory_weekly_check_results" TO authenticated;

ALTER TABLE "inventory_weekly_check_templates" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_inventory_weekly_check_templates" ON "inventory_weekly_check_templates" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "inventory_weekly_check_templates" TO authenticated;

ALTER TABLE "inventory_weekly_checks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_inventory_weekly_checks" ON "inventory_weekly_checks" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "inventory_weekly_checks" TO authenticated;

ALTER TABLE "pay_periods" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_pay_periods" ON "pay_periods" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "pay_periods" TO authenticated;

ALTER TABLE "pay_rate_history" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_pay_rate_history" ON "pay_rate_history" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "pay_rate_history" TO authenticated;

ALTER TABLE "pay_scales" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_pay_scales" ON "pay_scales" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "pay_scales" TO authenticated;

ALTER TABLE "payroll_settings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_payroll_settings" ON "payroll_settings" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "payroll_settings" TO authenticated;

ALTER TABLE "policies" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_policies" ON "policies" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "policies" TO authenticated;

ALTER TABLE "rank_permissions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_rank_permissions" ON "rank_permissions" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "rank_permissions" TO authenticated;

ALTER TABLE "record_revisions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_record_revisions" ON "record_revisions" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "record_revisions" TO authenticated;

ALTER TABLE "schedule_assignments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_schedule_assignments" ON "schedule_assignments" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "schedule_assignments" TO authenticated;

ALTER TABLE "schedule_coverage_rules" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_schedule_coverage_rules" ON "schedule_coverage_rules" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "schedule_coverage_rules" TO authenticated;

ALTER TABLE "schedule_notification_rules" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_schedule_notification_rules" ON "schedule_notification_rules" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

RESET search_path;
