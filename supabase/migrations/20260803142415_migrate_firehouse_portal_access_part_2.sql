SET search_path TO firehouse, public;

GRANT SELECT, INSERT, UPDATE, DELETE ON "schedule_notification_rules" TO authenticated;

ALTER TABLE "schedule_notifications" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_schedule_notifications" ON "schedule_notifications" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "schedule_notifications" TO authenticated;

ALTER TABLE "schedule_requests" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_schedule_requests" ON "schedule_requests" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "schedule_requests" TO authenticated;

ALTER TABLE "schedule_rotation_members" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_schedule_rotation_members" ON "schedule_rotation_members" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "schedule_rotation_members" TO authenticated;

ALTER TABLE "schedule_rotations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_schedule_rotations" ON "schedule_rotations" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "schedule_rotations" TO authenticated;

ALTER TABLE "schedule_shift_patterns" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_schedule_shift_patterns" ON "schedule_shift_patterns" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "schedule_shift_patterns" TO authenticated;

ALTER TABLE "schedule_staffing_overrides" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_schedule_staffing_overrides" ON "schedule_staffing_overrides" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "schedule_staffing_overrides" TO authenticated;

ALTER TABLE "system_meta" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_system_meta" ON "system_meta" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "system_meta" TO authenticated;

ALTER TABLE "time_entries" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_time_entries" ON "time_entries" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "time_entries" TO authenticated;

ALTER TABLE "work_detail_members" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_work_detail_members" ON "work_detail_members" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "work_detail_members" TO authenticated;

ALTER TABLE "work_detail_postings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_work_detail_postings" ON "work_detail_postings" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "work_detail_postings" TO authenticated;

ALTER TABLE "work_detail_requests" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stickney_portal_access_work_detail_requests" ON "work_detail_requests" FOR ALL TO authenticated USING ((SELECT firehouse.has_department_access())) WITH CHECK ((SELECT firehouse.has_department_access()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "work_detail_requests" TO authenticated;

RESET search_path;
