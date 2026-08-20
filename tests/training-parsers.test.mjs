import assert from "node:assert/strict";
import test from "node:test";

import {
  parseIfsiSchedule,
  parseNipstaCourseNames,
  parseNipstaEvents,
  parseRomeovilleActivity,
} from "../app/lib/training-parsers.ts";

test("extracts future Romeoville sessions from an official activity page", () => {
  const html = `
    <li class="session completed">
      <span class="title nonInteractive">Rope Operations</span>
      <span class="dates">4/6/2026 — 4/10/2026</span>
      <span class="location">North Aurora FD</span>
    </li>
    <li class="session">
      <span class="title nonInteractive">Rope Operations</span>
      <span class="time">8:00 AM — 5:00 PM</span>
      <span class="dates">8/10/2026 — 8/14/2026</span>
      <span class="location">North Aurora FD</span>
    </li>`;
  const courses = parseRomeovilleActivity(
    html,
    "https://www.romeoville.org/Activities/Activity/Detail/Rope-Operations-299",
    "Rope Operations",
    "2026-08-02",
  );
  assert.deepEqual(courses.map(({ title, startDate, endDate, location }) => ({
    title,
    startDate,
    endDate,
    location,
  })), [{
    title: "Rope Operations",
    startDate: "2026-08-10",
    endDate: "2026-08-14",
    location: "North Aurora FD",
  }]);
});

test("extracts and sorts future IFSI course rows", () => {
  const html = `<table><tbody>
    <tr><td><a onclick="showClass('100')">Past Class</a></td><td>7/31/26</td><td>POLO</td><td>IL</td><td>$0.00</td></tr>
    <tr><td><a onclick="showClass('200')">Fire Inspector</a></td><td>10/26/26</td><td>ORLAND PARK</td><td>IL</td><td>$800.00</td></tr>
    <tr><td><a onclick="showClass('300')">Pipeline Emergencies</a></td><td>8/10/26</td><td>SCHILLER PARK</td><td>IL</td><td>$0.00</td></tr>
  </tbody></table>`;
  const courses = parseIfsiSchedule(
    html,
    "https://www.fsi.illinois.edu/content/courses/schedule/",
    "2026-08-02",
  );
  assert.deepEqual(courses.map((course) => course.title), [
    "Pipeline Emergencies",
    "Fire Inspector",
  ]);
});

test("collapses NIPSTA calendar days into fire and rescue course sessions", () => {
  const page = `<script>var leagues_data = {
    "1":{"name":"Advanced Technician Firefighter"},
    "2":{"name":"LE Tactical Driving 3-Day"}
  };</script>`;
  const names = parseNipstaCourseNames(page);
  const courses = parseNipstaEvents([
    {
      title: "Advanced Technician Firefighter 2026 Summer SessionRental\nMain (NIPSTA)\n8:00 AM-4:30 PM",
      start: "2026-08-24 08:00:00",
      end: "2026-08-24 16:30:00",
    },
    {
      title: "Advanced Technician Firefighter 2026 Summer SessionRental\nMain (NIPSTA)\n8:00 AM-4:30 PM",
      start: "2026-08-28 08:00:00",
      end: "2026-08-28 16:30:00",
    },
    {
      title: "LE Tactical Driving 3-Day Fall SessionRental\nMain (NIPSTA)",
      start: "2026-09-01 08:00:00",
      end: "2026-09-03 16:30:00",
    },
  ], names, "https://secure.rec1.com/IL/nipsta-il/Public-Calendar-Main-Calendar/76202fcal", "2026-08-02");
  assert.deepEqual(courses.map(({ title, startDate, endDate, location }) => ({
    title,
    startDate,
    endDate,
    location,
  })), [{
    title: "Advanced Technician Firefighter",
    startDate: "2026-08-24",
    endDate: "2026-08-28",
    location: "Main (NIPSTA)",
  }]);
});
