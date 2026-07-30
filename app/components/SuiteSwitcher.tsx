"use client";

import { useEffect, useState } from "react";

const commandCenter = "https://department-360-command-center.vercel.app";
const modules = [
  ["respond", "Respond 360"],
  ["preplans", "PrePlan 360"],
  ["inspections", "Inspection 360"],
  ["inventory", "Inventory"],
  ["schedule", "Schedule 360"],
  ["training", "Training 360"],
  ["fire-reports", "Fire Reports"],
  ["ems-reports", "EMS ePCR"],
] as const;

export function SuiteSwitcher({
  current,
  departmentId,
}: {
  current: string;
  departmentId: string;
}) {
  const [enabled, setEnabled] = useState(() => new Set([current]));
  useEffect(() => {
    fetch("/api/suite-context", { cache: "no-store" }).then((response) => response.ok ? response.json() : Promise.reject()).then((context: { profile?: { modules?: unknown } }) => {
      const approved = Array.isArray(context.profile?.modules) ? context.profile.modules.filter((id): id is string => typeof id === "string") : [];
      const expanded = new Set([...approved, current]);
      if (expanded.has("respond")) {
        expanded.add("fire-reports");
        expanded.add("ems-reports");
      }
      setEnabled(expanded);
    }).catch(() => setEnabled(new Set([current])));
  }, [current]);
  const visible = modules.filter(([id]) => enabled.has(id));
  const commandUrl = new URL(commandCenter);
  commandUrl.searchParams.set("departmentId", departmentId);
  return <details className="suite-switcher"><summary aria-label="Open authorized 360 applications"><span>360</span><b>Apps</b></summary><nav aria-label="360 Suite applications"><header><strong>360 Suite</strong><small>{visible.length} authorized app{visible.length === 1 ? "" : "s"}</small></header><a href={commandUrl.toString()}>Command Center</a>{visible.map(([id, label]) => {
    if (id === current) return <span aria-current="page" className="current" key={id}>{label}</span>;
    const destination = new URL(commandUrl);
    destination.searchParams.set("launch", id);
    return <a href={destination.toString()} key={id}>{label}</a>;
  })}</nav></details>;
}
