import assert from "node:assert/strict";
import test from "node:test";
import { matchingTimeBlock, normalizeScheduleTime, scheduleTimeBlocks } from "../app/schedule-time.ts";

test("12 PM through 6 PM is accepted and normalized", () => {
  assert.equal(normalizeScheduleTime("12pm"), "12:00");
  assert.equal(normalizeScheduleTime("12:00 PM"), "12:00");
  assert.equal(normalizeScheduleTime("6pm"), "18:00");
  assert.equal(normalizeScheduleTime("6:00 PM"), "18:00");
  assert.equal(normalizeScheduleTime("0600"), "06:00");
  assert.equal(normalizeScheduleTime("1800"), "18:00");
});

test("afternoon preset fills 12:00 through 18:00", () => {
  const afternoon = scheduleTimeBlocks.find((block) => block.id === "afternoon");
  assert.deepEqual(afternoon, {
    id: "afternoon",
    label: "Afternoon · 12:00 PM–6:00 PM",
    startTime: "12:00",
    endTime: "18:00",
  });
  assert.equal(matchingTimeBlock("12:00", "18:00"), "afternoon");
});

test("invalid times are rejected", () => {
  assert.equal(normalizeScheduleTime("13pm"), null);
  assert.equal(normalizeScheduleTime("25:00"), null);
  assert.equal(normalizeScheduleTime("6:99 PM"), null);
  assert.equal(normalizeScheduleTime("2460"), null);
});
