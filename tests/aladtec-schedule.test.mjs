import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAladtecSchedule } from "../app/aladtec-schedule.ts";

test("maps Aladtec member, schedule, and position names without inventing records", () => {
  const result = normalizeAladtecSchedule(
    [{ member_id: 12, is_active: true, first_name: "Alex", last_name: "Rivera" }],
    [{ schedule_id: 4, name: "Station 1", positions: [{ position_id: 8, label: "Engine" }] }],
    [{ time_records: [{ member_id: 12, schedule_id: 4, position_id: 8, time_type: "Regular", start_datetime: "2026-07-26T06:00:00-05:00", stop_datetime: "2026-07-27T06:00:00-05:00" }] }],
  );
  assert.deepEqual(result, [{
    memberId: 12,
    name: "Alex Rivera",
    schedule: "Station 1",
    position: "Engine",
    timeType: "Regular",
    start: "2026-07-26T06:00:00-05:00",
    stop: "2026-07-27T06:00:00-05:00",
  }]);
});

test("merges only truly contiguous schedule segments for the same assignment", () => {
  const result = normalizeAladtecSchedule(
    [{ member_id: 12, first_name: "Alex", last_name: "Rivera" }],
    [{ schedule_id: 4, name: "Station 1", positions: [{ position_id: 8, label: "Engine" }] }],
    [
      { time_records: [{ member_id: 12, schedule_id: 4, position_id: 8, time_type: "Regular", start_datetime: "2026-07-26T06:00:00-05:00", stop_datetime: "2026-07-27T00:00:00-05:00" }] },
      { time_records: [{ member_id: 12, schedule_id: 4, position_id: 8, time_type: "Regular", start_datetime: "2026-07-27T00:00:00-05:00", stop_datetime: "2026-07-27T06:00:00-05:00" }] },
    ],
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].stop, "2026-07-27T06:00:00-05:00");
});
