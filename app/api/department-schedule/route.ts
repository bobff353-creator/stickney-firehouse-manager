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
      "SELECT s.id,s.employee_id AS employeeId,e.name AS employeeName,en.entry_date AS workDate,COALESCE(NULLIF(s.start_time,''),t.start_time) AS startTime,COALESCE(NULLIF(s.end_time,''),t.end_time) AS endTime,s.role,'station' AS source,'assigned' AS status FROM station_shift_slots s JOIN station_schedule_entries en ON en.id=s.entry_id JOIN station_shift_types t ON t.id=en.shift_type_id JOIN employees e ON e.id=s.employee_id WHERE s.status='filled' AND en.entry_date BETWEEN ? AND ? ORDER BY en.entry_date,COALESCE(NULLIF(s.start_time,''),t.start_time),e.name COLLATE NOCASE",
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
