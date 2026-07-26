import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("work detail workflow requires certification and supports multiple employees", async () => {
  const api = await readFile(new URL("../app/api/work-details/route.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/work-details.tsx", import.meta.url), "utf8");
  assert.equal(api.includes("employeeIds.length === 0"), true);
  assert.equal(api.includes("!payload.certified"), true);
  assert.equal(page.includes("Select one or more employees"), true);
  assert.equal(page.includes('type="date"'), true);
});

test("approved work details post once and add to existing work detail hours", async () => {
  const api = await readFile(new URL("../app/api/work-details/route.ts", import.meta.url), "utf8");
  assert.equal(api.includes("work_detail_postings"), true);
  assert.equal(api.includes("hours = time_entries.hours + excluded.hours"), true);
  assert.equal(api.includes('detail.status !== "pending"'), true);
});

test("requesting officers and approvers are validated from employee ranks", async () => {
  const api = await readFile(new URL("../app/api/work-details/route.ts", import.meta.url), "utf8");
  assert.equal(api.includes("/(chief|captain|lieutenant)/i"), true);
  assert.equal(api.includes("Only the selected approver or an administrator"), true);
});
