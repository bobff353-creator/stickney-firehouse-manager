import { ensureDatabase } from "../../../db/bootstrap";
import {
  next24DepartmentSchedule,
  scheduleQueryDates,
  type DepartmentScheduleAssignment,
} from "../../department-schedule";
import { chicagoOperationalContext } from "../../operational-day";

export async function GET() {
  try {
    const db = await ensureDatabase();
    const now = chicagoOperationalContext();
    const range = scheduleQueryDates(now.calendarDate);
    const assignments = await db.prepare(
      "SELECT a.id,a.employee_id AS employeeId,e.name AS employeeName,a.work_date AS workDate,a.start_time AS startTime,a.end_time AS endTime,a.role,a.source,a.status FROM schedule_assignments a JOIN employees e ON e.id=a.employee_id WHERE a.status='assigned' AND a.work_date BETWEEN ? AND ? ORDER BY a.work_date,a.start_time,e.name COLLATE NOCASE",
    ).bind(range.startDate, range.endDate).all<DepartmentScheduleAssignment>();
    const items = next24DepartmentSchedule(assignments.results, now.calendarDate, now.minutes);
    return Response.json({
      source: "department_schedule",
      asOf: new Date().toISOString(),
      windowHours: 24,
      items,
    });
  } catch {
    return Response.json({ error: "The department schedule is temporarily unavailable.", items: [] }, { status: 500 });
  }
}
