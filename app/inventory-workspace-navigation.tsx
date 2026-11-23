"use client";

import { InventoryWorkIcon } from "./inventory-work-icon";
import type { MouseEvent } from "react";

type Destination = "due" | "fleet" | "service" | "equipment" | "maintenance" | "reports" | "inventory" | "air" | "stock" | "apparatus" | "setup";

export default function InventoryWorkspaceNavigation({ current, canSetup, canManageRepairs, onNavigate }: {
  current: string; canSetup: boolean; canManageRepairs: boolean; onNavigate: (view: Destination) => void;
}) {
  const primary: Array<{ id: Destination; label: string; icon: "home" | "check" | "repair" | "equipment" }> = [
    { id: "due", label: "Today", icon: "home" },
    { id: "fleet", label: "Checks", icon: "check" },
    { id: "service", label: "Repairs", icon: "repair" },
    { id: "equipment", label: "Equipment", icon: "equipment" },
    ...(canManageRepairs ? [{ id: "maintenance" as const, label: "Maintenance", icon: "repair" as const }] : []),
    { id: "reports", label: "Saved reports", icon: "check" },
  ];
  const extra: Array<[Destination, string]> = [["inventory", "Inventory counts"], ["air", "Air packs & bottles"], ["stock", "Meds & stock"], ["apparatus", "Apparatus status"]];
  function go(view: Destination, event: MouseEvent<HTMLButtonElement>) {
    onNavigate(view);
    event.currentTarget.closest(".inventory-workspace-drawer")?.removeAttribute("open");
  }
  return <aside className="inventory-workspace-navigation" aria-label="Apparatus workspace">
    <details className="inventory-workspace-drawer">
      <summary>All apparatus tools</summary>
      <div className="inventory-workspace-navigation-body">
        <p>Your shift</p>
        <nav aria-label="Apparatus workspaces">{primary.map(item => <button type="button" key={item.id} aria-current={current === item.id || current === "check" && item.id === "fleet" ? "page" : undefined} onClick={event => go(item.id, event)}><InventoryWorkIcon name={item.icon} /><span>{item.label}</span></button>)}</nav>
        <details className="inventory-workspace-extra"><summary>More tools</summary><nav aria-label="Additional apparatus tools">{extra.map(([id, label]) => <button key={id} type="button" aria-current={current === id ? "page" : undefined} onClick={event => go(id, event)}>{label}</button>)}</nav></details>
        {canSetup && <button className="inventory-workspace-admin" type="button" aria-current={current === "setup" ? "page" : undefined} onClick={event => go("setup", event)}><InventoryWorkIcon name="equipment" />Administration</button>}
        <p className="inventory-workspace-record-note">Saved department records</p>
      </div>
    </details>
  </aside>;
}
