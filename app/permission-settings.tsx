"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PermissionData = {
  catalog: Array<{ key: string; label: string; group: string; required?: boolean }>;
  ranks: string[];
  rankSettings: Record<string, string[]>;
  overrides: Record<string, Record<string, "allow" | "deny">>;
  employees: Array<{ id: string; name: string; rank: string; isAdmin: number; effectivePermissions: string[] }>;
};

export default function PermissionSettings({ initialTab, testEmployeeId, onTestEmployee }: { initialTab: "permissions" | "test"; testEmployeeId: string; onTestEmployee: (employee: PermissionData["employees"][number] | null) => void }) {
  const [data, setData] = useState<PermissionData | null>(null), [tab, setTab] = useState(initialTab), [rank, setRank] = useState(""), [employeeId, setEmployeeId] = useState(""), [saving, setSaving] = useState(false), [message, setMessage] = useState("");
  const load = useCallback(async () => { const response = await fetch("/api/permissions"); const payload = await response.json() as PermissionData & { error?: string }; if (!response.ok) throw new Error(payload.error || "Unable to load permissions"); setData(payload); setRank((current) => current || payload.ranks[0] || ""); setEmployeeId((current) => current || payload.employees[0]?.id || ""); }, []);
  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load permissions")); }, [load]);
  useEffect(() => setTab(initialTab), [initialTab]);
  const selectedEmployee = data?.employees.find((employee) => employee.id === employeeId);
  const rankPermissions = useMemo(() => new Set(data?.rankSettings[rank] ?? []), [data, rank]);
  const employeeRankPermissions = useMemo(() => new Set(data?.rankSettings[selectedEmployee?.rank ?? ""] ?? []), [data, selectedEmployee?.rank]);
  async function save(body: object) { setSaving(true); setMessage(""); try { const response = await fetch("/api/permissions", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const payload = await response.json() as { error?: string }; if (!response.ok) throw new Error(payload.error || "Unable to save permissions"); await load(); setMessage("Permissions saved."); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save permissions"); } finally { setSaving(false); } }
  if (!data) return <section className="content-card permission-page"><p>{message || "Loading permissions…"}</p></section>;
  const groups = [...new Set(data.catalog.map((permission) => permission.group))];
  return <section className="permission-page">
    <div className="permission-tabs"><button className={tab === "permissions" ? "active" : ""} onClick={() => setTab("permissions")}>Permission sets</button><button className={tab === "test" ? "active" : ""} onClick={() => setTab("test")}>Test as member</button></div>
    {tab === "permissions" ? <>
      <article className="content-card permission-section"><header><div><h2>Permissions by rank</h2><p>Set the starting access for everyone assigned to a rank.</p></div><select value={rank} onChange={(event) => setRank(event.target.value)}>{data.ranks.map((item) => <option key={item}>{item}</option>)}</select></header>
        <div className="permission-groups">{groups.map((group) => <fieldset key={group}><legend>{group}</legend>{data.catalog.filter((permission) => permission.group === group).map((permission) => <label key={permission.key}><input type="checkbox" checked={permission.required || rankPermissions.has(permission.key)} disabled={permission.required} onChange={(event) => { const next = new Set(rankPermissions); event.target.checked ? next.add(permission.key) : next.delete(permission.key); setData({ ...data, rankSettings: { ...data.rankSettings, [rank]: [...next] } }); }}/><span>{permission.label}{permission.required && <small>Required for every employee</small>}</span></label>)}</fieldset>)}</div>
        <footer><button className="primary-action" disabled={saving} onClick={() => void save({ scope: "rank", rank, permissions: [...rankPermissions] })}>Save rank permissions</button></footer>
      </article>
      <article className="content-card permission-section"><header><div><h2>Employee exceptions</h2><p>Add or subtract access for one employee without changing their rank.</p></div><select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>{data.employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.name} · {employee.rank}</option>)}</select></header>
        {selectedEmployee?.isAdmin ? <p className="permission-admin-note">This employee is an administrator and retains the complete permission set.</p> : <div className="permission-override-list">{data.catalog.map((permission) => { const effect = permission.required ? "allow" : data.overrides[employeeId]?.[permission.key] ?? "rank"; return <label key={permission.key}><span><b>{permission.label}</b><small>{permission.required ? "Required for every employee" : `Rank: ${employeeRankPermissions.has(permission.key) ? "Allowed" : "Not allowed"}`}</small></span><select value={effect} disabled={permission.required} onChange={(event) => { const next = { ...(data.overrides[employeeId] ?? {}) }; if (event.target.value === "rank") delete next[permission.key]; else next[permission.key] = event.target.value as "allow" | "deny"; setData({ ...data, overrides: { ...data.overrides, [employeeId]: next } }); }}><option value="rank">Use rank setting</option><option value="allow">Add permission</option><option value="deny">Remove permission</option></select></label>; })}</div>}
        {!selectedEmployee?.isAdmin && <footer><button className="primary-action" disabled={saving} onClick={() => void save({ scope: "employee", employeeId, overrides: data.overrides[employeeId] ?? {} })}>Save employee exceptions</button></footer>}
      </article>
    </> : <article className="content-card test-member-card"><span className="test-badge">ADMINISTRATOR TEST TOOL</span><h2>Preview the portal as a member</h2><p>This changes only what you see in this browser. It does not sign you in as the employee and cannot approve, submit, or alter records as them.</p><select value={testEmployeeId} onChange={(event) => onTestEmployee(data.employees.find((employee) => employee.id === event.target.value) ?? null)}><option value="">Choose a member…</option>{data.employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.name} · {employee.rank}</option>)}</select>{testEmployeeId && <button onClick={() => onTestEmployee(null)}>Exit test view</button>}<small>This tab can be hidden later without deleting permission settings.</small></article>}
    {message && <div className="toast">{message}</div>}
  </section>;
}
