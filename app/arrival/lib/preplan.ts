import { z } from "zod";
import {footprintSchema} from './footprint.ts';
export const tri = z.enum(["", "Yes", "No", "Unknown"]);
export const systemKeys = [
  "sprinklers",
  "fdc",
  "alarm",
  "keybox",
  "gas",
  "electric",
] as const;
export const systemLabels: Record<(typeof systemKeys)[number], string> = {
  sprinklers: "Fire sprinklers",
  fdc: "Fire department connection (FDC)",
  alarm: "Fire alarm panel",
  keybox: "Key / Knox box",
  gas: "Gas shutoff",
  electric: "Electrical shutoff",
};
export const systemSchema = z.object({
  answer: tri,
  location: z.string().max(1000),
  status: z
    .enum(["Not checked", "In service", "Impaired", "Out of service"])
    .optional(),
});
export const detailSchema = z.object({
  standpipe: z.object({
    answer: tri,
    location: z.string().max(1000),
    type: z.string().max(150),
    status: z.enum(["Not checked", "In service", "Impaired", "Out of service"]),
  }),
  firePump: z.object({
    answer: tri,
    location: z.string().max(1000),
    notes: z.string().max(1500),
    status: z.enum(["Not checked", "In service", "Impaired", "Out of service"]),
  }),
  fdcSpec: z.string().max(1500),
  sprinklerCoverage: z.string().max(1500),
  levels: z
    .array(
      z.object({
        id: z.string().max(100),
        name: z.string().trim().min(1).max(100),
        notes: z.string().max(2000),
      }),
    )
    .max(100),
  occupants: z
    .array(
      z.object({
        id: z.string().max(100),
        name: z.string().trim().min(1).max(150),
        location: z.string().max(300),
        notes: z.string().max(2000),
      }),
    )
    .max(100),
  materials: z
    .array(
      z.object({
        id: z.string().max(100),
        name: z.string().trim().min(1).max(150),
        location: z.string().max(300),
        quantity: z.string().max(100),
        unNumber: z.string().max(30),
        notes: z.string().max(2000),
      }),
    )
    .max(100),
});
export type BuildingDetails = z.infer<typeof detailSchema>;
export function blankDetails(): BuildingDetails {
  return {
    standpipe: { answer: "", location: "", type: "", status: "Not checked" },
    firePump: { answer: "", location: "", notes: "", status: "Not checked" },
    fdcSpec: "",
    sprinklerCoverage: "",
    levels: [],
    occupants: [],
    materials: [],
  };
}
export const photoSchema = z.object({
  id: z.string().max(100),
  name: z.string().max(250),
  side: z.enum(["A", "B", "C", "D", "Plan", "Overview"]),
  caption: z.string().max(1000),
  type: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
});
export const planSchema = z.object({
  imported:z.object({recordId:z.string().max(100),sources:z.array(z.string().max(100)).max(10),importedAt:z.string(),linkedHydrantIds:z.array(z.string().max(100)).max(100)}).optional(),
  footprint:footprintSchema.optional(),
  scope: z.enum(["quick", "full"]).optional(),
  details: detailSchema.optional(),
  name: z.string().trim().max(200),
  address: z.string().trim().max(300),
  city: z.string().trim().max(100),
  region: z.string().trim().max(50),
  addressConfirmed: z.boolean(),
  visited: z.string().max(10),
  occupancy: z.string().max(100),
  floors: z.string().max(8),
  construction: z.string().max(150),
  roof: z.string().max(150),
  basement: tri,
  entrance: z.string().max(1500),
  access: z.string().max(2000),
  lifeSafety: z.string().max(2000),
  hydrant: z.string().max(1500),
  hydrantStatus: z.enum(["", "In service", "Out of service", "Unknown"]),
  flow: z.string().max(20),
  flowDate: z.string().max(10),
  hazardStatus: z.enum(["", "Present", "None observed", "Unknown"]),
  hazards: z.array(z.string().max(100)).max(20),
  hazardNotes: z.string().max(4000),
  systems: z.object({
    sprinklers: systemSchema,
    fdc: systemSchema,
    alarm: systemSchema,
    keybox: systemSchema,
    gas: systemSchema,
    electric: systemSchema,
  }),
  contactName: z.string().max(150),
  contactPhone: z.string().max(60),
  notes: z.string().max(4000),
  latitude: z.string().max(25),
  longitude: z.string().max(25),
  photos: z.array(photoSchema).max(200),
  pins: z
    .array(
      z.object({
        id: z.string().max(100),
        label: z.string().max(100),
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
      }),
    )
    .max(60),
  reviewDue: z.string().max(10),
  step: z.number().int().min(0).max(5),
});
export type PlanData = z.infer<typeof planSchema>;
export type PlanRecord = {
  id: string;
  name: string;
  address: string;
  working: PlanData;
  published: PlanData | null;
  status: "draft" | "review" | "published";
  revision: number;
  publishedRevision: number | null;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
};
export type PlanEvent = {
  action: string;
  revision: number;
  at: string;
  note: string;
};
export function chicagoDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function blankPlan(): PlanData {
  return {
    scope: "full",
    name: "",
    address: "",
    city: "",
    region: "",
    addressConfirmed: false,
    visited: chicagoDate(),
    occupancy: "",
    floors: "",
    construction: "Unknown",
    roof: "Unknown",
    basement: "",
    entrance: "",
    access: "",
    lifeSafety: "",
    hydrant: "",
    hydrantStatus: "",
    flow: "",
    flowDate: "",
    hazardStatus: "",
    hazards: [],
    hazardNotes: "",
    systems: Object.fromEntries(
      systemKeys.map((k) => [k, { answer: "", location: "" }]),
    ) as PlanData["systems"],
    contactName: "",
    contactPhone: "",
    notes: "",
    latitude: "",
    longitude: "",
    photos: [],
    pins: [],
    reviewDue: "",
    step: 0,
  };
}
export const steps = [
  "Location",
  "Building",
  "Access & water",
  "Systems & hazards",
  "Photos & sketch",
  "Review",
];
function validDate(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
export function blockers(p: PlanData): { text: string; step: number }[] {
  const r: { text: string; step: number }[] = [];
  const add = (test: unknown, text: string, step: number) => {
    if (!test) r.push({ text, step });
  };
  add(p.name.trim(), "Enter a building or business name.", 0);
  add(
    p.address.trim() && p.city.trim() && p.region.trim(),
    "Enter the street address, city and state / region.",
    0,
  );
  add(p.addressConfirmed, "Confirm the address against the building.", 0);
  add(
    validDate(p.visited) && p.visited <= chicagoDate(),
    "Enter a valid visit date, today or earlier.",
    0,
  );
  if (p.scope !== "quick") {
    add(p.occupancy, "Choose an occupancy, including Unknown if needed.", 1);
    add(p.basement, "Answer the basement question.", 1);
  }
  add(p.entrance.trim(), "Describe the main entrance, or enter Unknown.", 2);
  add(p.hydrant.trim(), "Describe the water source, or enter Unknown.", 2);
  add(p.hydrantStatus, "Select the water-source status.", 2);
  for (const k of systemKeys) {
    if (p.scope !== "quick")
      add(p.systems[k].answer, `Answer: ${systemLabels[k]}.`, 3);
    if (p.systems[k].answer === "Yes")
      add(
        p.systems[k].location.trim(),
        `Give the location of ${systemLabels[k].toLowerCase()}, or enter Unknown.`,
        3,
      );
  }
  add(p.hazardStatus, "Answer the hazard question.", 3);
  if (p.hazardStatus === "Present")
    add(p.hazardNotes.trim(), "Describe the hazards and their locations.", 3);
  if (p.hazardStatus === "None observed" && p.hazards.length)
    add(
      false,
      "Hazard tags are selected. Choose Present or remove the tags after verification.",
      3,
    );
  if (p.flow) {
    add(
      Number(p.flow) > 0 && Number.isFinite(Number(p.flow)),
      "Enter a positive tested flow in GPM.",
      2,
    );
    add(
      validDate(p.flowDate) && p.flowDate <= chicagoDate(),
      "Enter a valid flow-test date, today or earlier.",
      2,
    );
  }
  if (p.latitude || p.longitude)
    add(
      !!p.latitude &&
        !!p.longitude &&
        Number.isFinite(Number(p.latitude)) &&
        Number.isFinite(Number(p.longitude)) &&
        Math.abs(Number(p.latitude)) <= 90 &&
        Math.abs(Number(p.longitude)) <= 180,
      "Enter valid latitude and longitude together.",
      0,
    );
  if (p.floors)
    add(
      Number.isInteger(Number(p.floors)) &&
        Number(p.floors) > 0 &&
        Number(p.floors) <= 200,
      "Enter 1–200 floors, or leave unknown.",
      1,
    );
  if (p.reviewDue)
    add(
      validDate(p.reviewDue) && p.reviewDue > chicagoDate(),
      "Choose a future next-review date or leave it unset.",
      5,
    );
  return r;
}
export function unknowns(p: PlanData): string[] {
  const r: string[] = [];
  for (const k of systemKeys) {
    const s = p.systems[k];
    if (!s.answer || s.answer === "Unknown") r.push(systemLabels[k]);
    else if (s.answer === "Yes" && (!s.location || /unknown/i.test(s.location)))
      r.push(`${systemLabels[k]} location`);
  }
  if (!p.construction || p.construction === "Unknown") r.push("Construction");
  if (!p.roof || p.roof === "Unknown") r.push("Roof");
  if (!p.floors) r.push("Floor count");
  if (!p.basement || p.basement === "Unknown") r.push("Basement");
  if (!p.occupancy || p.occupancy === "Unknown") r.push("Occupancy");
  if (
    !p.hydrantStatus ||
    p.hydrantStatus === "Unknown" ||
    !p.hydrant ||
    /unknown/i.test(p.hydrant)
  )
    r.push("Water supply");
  if (!p.hazardStatus || p.hazardStatus === "Unknown") r.push("Hazards");
  if (!p.lifeSafety) r.push("Occupant / rescue considerations");
  if (!p.contactName) r.push("Emergency contact");
  for (const side of ["A", "B", "C", "D"])
    if (!p.photos.some((x) => x.side === side)) r.push(`${side}-side photo`);
  return r;
}
export function systemWarnings(p: PlanData): string[] {
  const result: string[] = [];
  for (const k of systemKeys) {
    const s = p.systems[k];
    if (
      s.answer === "Yes" &&
      (s.status === "Impaired" || s.status === "Out of service")
    )
      result.push(
        systemLabels[k] +
          ": " +
          s.status +
          " · " +
          (s.location || "location unknown"),
      );
  }
  for (const [label, s] of [
    ["Standpipe", p.details?.standpipe],
    ["Fire pump", p.details?.firePump],
  ] as const) {
    if (
      s?.answer === "Yes" &&
      (s.status === "Impaired" || s.status === "Out of service")
    )
      result.push(
        label + ": " + s.status + " · " + (s.location || "location unknown"),
      );
  }
  return result;
}
export function answered(p: PlanData): number {
  return [
    p.name && p.addressConfirmed,
    p.occupancy,
    p.entrance,
    p.hydrant,
    ...systemKeys.map((k) => p.systems[k].answer),
    p.hazardStatus,
    p.photos.length,
  ].filter(Boolean).length;
}
export function formatDate(v: string | null) {
  if (!v) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "America/Chicago",
  }).format(new Date(v.length === 10 ? v + "T12:00:00Z" : v));
}
export const example: PlanRecord = {
  id: "example",
  name: "Training Center — Example",
  address: "100 Training Way · Fictional address",
  status: "published",
  revision: 3,
  publishedRevision: 3,
  publishedAt: "2026-11-16T18:00:00Z",
  updatedAt: "2026-11-16T18:00:00Z",
  createdAt: "2026-11-16T18:00:00Z",
  working: {
    ...blankPlan(),
    visited: "2026-11-16",
    name: "Training Center — Example",
    address: "100 Training Way",
    city: "Example City",
    region: "IL",
    addressConfirmed: true,
    occupancy: "Commercial",
    floors: "2",
    basement: "No",
    construction: "Type III · Ordinary",
    roof: "Wood truss",
    entrance: "A side, glass doors beneath the orange canopy.",
    access: "Rear service lane is narrow. Confirm access on arrival.",
    lifeSafety: "Classrooms on second floor. Verify current occupancy.",
    hydrant: "Example hydrant across the street at A / D corner.",
    hydrantStatus: "Unknown",
    hazardStatus: "Present",
    hazards: ["Lightweight truss", "Solar / battery"],
    hazardNotes:
      "EXAMPLE ONLY: Lightweight roof trusses. Solar panels on roof; disconnect location unverified.",
    systems: {
      sprinklers: { answer: "Yes", location: "Riser room on C side" },
      fdc: { answer: "Yes", location: "A side, right of main entrance" },
      alarm: { answer: "Yes", location: "Inside main entrance, left wall" },
      keybox: { answer: "Yes", location: "A-side entrance, left of doors" },
      gas: { answer: "Unknown", location: "" },
      electric: { answer: "Yes", location: "C side, exterior service room" },
    },
    pins: [
      { id: "p1", label: "FDC", x: 68, y: 75 },
      { id: "p2", label: "Key box", x: 37, y: 75 },
      { id: "p3", label: "Electrical", x: 62, y: 24 },
    ],
    step: 5,
  },
  published: null,
};
example.published = structuredClone(example.working);
