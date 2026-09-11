"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { permissionsChanged } from "./use-permissions";
import { confirmLeavingWork, useUnsavedWork } from "./use-unsaved-work";

type PermissionData = {
  revision: string | null;
  catalog: Array<{ key: string; label: string; group: string; required?: boolean }>;
  ranks: string[];
  rankSettings: Record<string, string[]>;
  overrides: Record<string, Record<string, "allow" | "deny">>;
  employees: Array<{ id: string; name: string; rank: string; isAdmin: number; isOwner?: boolean; loginLinked?: boolean; effectivePermissions: string[] }>;
};

type EditorSelection = { editor: "rank" | "member"; rank: string; employeeId: string; search: string; group: string };

export default function PermissionSettings({ initialTab, testEmployeeId, onTestEmployee, onPermissionsSaved, initialSelection, onSelectionChange }: { initialSelection?: EditorSelection; onSelectionChange?: (selection: EditorSelection) => void; initialTab: "permissions" | "test"; testEmployeeId: string; onTestEmployee: (employee: PermissionData["employees"][number] | null) => void; onPermissionsSaved: (data: PermissionData) => void }) {
  const [data, setData] = useState<PermissionData | null>(null), [tab, setTab] = useState(initialTab), [rank, setRank] = useState(initialSelection?.rank ?? ""), [employeeId, setEmployeeId] = useState(initialSelection?.employeeId ?? ""), [saving, setSaving] = useState(false), [message, setMessage] = useState("");
  const [saved, setSaved] = useState<PermissionData | null>(null);
  const [editor, setEditor] = useState<"rank" | "member">(initialSelection?.editor ?? "rank");
  const [search, setSearch] = useState(initialSelection?.search ?? ""), [groupFilter, setGroupFilter] = useState(initialSelection?.group ?? "");
  useEffect(() => { onSelectionChange?.({ editor, rank, employeeId, search, group: groupFilter }); }, [editor, rank, employeeId, search, groupFilter, onSelectionChange]);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const dirty = Boolean(data && saved && (JSON.stringify(data.rankSettings) !== JSON.stringify(saved.rankSettings) || JSON.stringify(data.overrides) !== JSON.stringify(saved.overrides)));
  useUnsavedWork(dirty, saving);
  function changeContext(change: () => void) {
    if (!confirmLeavingWork()) return;
    setData(saved); setSearch(""); setGroupFilter(""); setMessage(""); change();
  }
  useEffect(() => { if (!initialSelection?.employeeId && new URLSearchParams(window.location.search).get("adminTask") === "member-access") setEditor("member"); }, [initialSelection?.employeeId]);
  const load = useCallback(async () => { const response = await fetch(`/api/permissions?refresh=${Date.now()}`, { cache: "no-store" }); const payload = await response.json() as PermissionData & { error?: string }; if (!response.ok || !payload.catalog) throw new Error(payload.error || "Manage permissions access is no longer available. Return to your permitted tools."); setData(payload); setSaved(payload); setNeedsRefresh(false); setRank((current) => current || payload.ranks[0] || ""); setEmployeeId((current) => current || payload.employees[0]?.id || ""); return payload; }, []);
  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load permissions")); }, [load]);
  useEffect(() => setTab(initialTab), [initialTab]);
  const selectedEmployee = data?.employees.find((employee) => employee.id === employeeId);
  const rankPermissions = useMemo(() => new Set(data?.rankSettings[rank] ?? []), [data, rank]);
  const employeeRankPermissions = useMemo(() => new Set(data?.rankSettings[selectedEmployee?.rank ?? ""] ?? []), [data, selectedEmployee?.rank]);
  async function save(body: object) {
    if (saving || !dirty || needsRefresh) return;
    setSaving(true); setMessage("");
    let confirmed = false;
    try {
      const response = await fetch("/api/permissions", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, revision: data?.revision }) });
      const payload = await response.json() as { error?: string; saved?: boolean };
      if (!response.ok || !payload.saved) throw new Error(payload.error || "The permission change was not confirmed.");
      confirmed = true;
      await permissionsChanged();
      const refreshed = await load();
      onPermissionsSaved(refreshed);
      setMessage(`Permissions saved and active · ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`);
    } catch (error) {
      setNeedsRefresh(confirmed);
      setMessage(confirmed ? "The save succeeded, but current permissions could not be reloaded. Reload saved permissions before editing again." : `${error instanceof Error ? error.message : "Unable to save permissions"} Your draft has not been discarded.`);
    } finally { setSaving(false); }
  }
  if (!data) return <section className="content-card permission-page"><p role={message ? "alert" : "status"}>{message || "Loading permissions…"}</p>{message && <button type="button" className="quiet-button" onClick={() => { setMessage(""); void load().catch(error => setMessage(error instanceof Error ? error.message : "Unable to load permissions")); }}>Retry permissions</button>}</section>;
  const allGroups = [...new Set(data.catalog.map(permission => permission.group))];
  const filtered = data.catalog.filter(permission => (!groupFilter || permission.group === groupFilter) && `${permission.label} ${permission.group}`.toLowerCase().includes(search.trim().toLowerCase()));
  const groups = [...new Set(filtered.map(permission => permission.group))];
  return <section className="permission-page">
    <div className="permission-tabs"><button className={tab === "permissions" ? "active" : ""} type="button" aria-pressed={tab === "permissions"} onClick={() => changeContext(() => setTab("permissions"))}>Permission sets</button><button className={tab === "test" ? "active" : ""} type="button" aria-pressed={tab === "test"} onClick={() => changeContext(() => setTab("test"))}>Test as member</button></div>
    {tab === "permissions" ? <>
      <div className="content-card admin-editor-controls">
        <h2>Who needs different access?</h2><p>Choose shared rank defaults or one member. Nothing changes until you save.</p>
        <div className="permission-tabs" aria-label="Permission editor"><button type="button" className={editor === "rank" ? "active" : ""} aria-pressed={editor === "rank"} onClick={() => changeContext(() => setEditor("rank"))}>By rank</button><button type="button" className={editor === "member" ? "active" : ""} aria-pressed={editor === "member"} onClick={() => changeContext(() => setEditor("member"))}>Member exceptions</button></div>
        <div className="admin-filter-row"><label>Find a permission<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Try payroll, edit, preplans…" /></label><label>Area<select value={groupFilter} onChange={event => setGroupFilter(event.target.value)}><option value="">All areas</option>{allGroups.map(group => <option key={group}>{group}</option>)}</select></label></div>
        <p role="status">{filtered.length} of {data.catalog.length} permissions shown. {dirty ? "Unsaved changes." : "Showing saved settings."} {(search || groupFilter) && <button type="button" onClick={() => { setSearch(""); setGroupFilter(""); }}>Clear filters</button>}</p>
        {!filtered.length && <p>No matching permissions. Clear your filters to see every setting.</p>}
      </div>
      {needsRefresh && <div className="error-banner" role="alert">Reload required before further edits.<button type="button" disabled={saving} onClick={() => { setSaving(true); void load().then(onPermissionsSaved).catch(error => setMessage(String(error))).finally(() => setSaving(false)); }}>Reload saved permissions</button></div>}
      {editor === "rank" && <article className="content-card permission-section admin-permission-editor"><header><div><h2>Permissions by rank</h2><p>Set starting access by rank. Administrators start with full access; use employee exceptions to restrict them.</p></div><select aria-label="Rank to configure" value={rank} disabled={saving || needsRefresh} onChange={(event) => changeContext(() => setRank(event.target.value))}>{data.ranks.map((item) => <option key={item}>{item}</option>)}</select></header>
        <div className="permission-groups">{groups.map((group) => <fieldset key={group}><legend>{group}</legend>{filtered.filter((permission) => permission.group === group).map((permission) => <label key={permission.key}><input type="checkbox" checked={permission.required || rankPermissions.has(permission.key)} disabled={permission.required || saving || needsRefresh} onChange={(event) => { const next = new Set(rankPermissions); if (event.target.checked) next.add(permission.key); else next.delete(permission.key); setData({ ...data, rankSettings: { ...data.rankSettings, [rank]: [...next] } }); }}/><span>{permission.label}{permission.required && <small>Required for every employee</small>}</span></label>)}</fieldset>)}</div>
        <footer className="admin-save-bar"><span role="status">{saving ? "Saving…" : dirty ? "Unsaved changes" : "No unsaved changes"}</span><div><button type="button" className="quiet-button" disabled={!dirty || saving || needsRefresh} onClick={() => changeContext(() => setMessage("Draft discarded. Saved access is unchanged."))}>Discard changes</button><button type="button" className="primary-action" disabled={saving || !data.revision || !dirty || needsRefresh} onClick={() => void save({ scope: "rank", rank, permissions: [...rankPermissions] })}>Save rank permissions</button></div></footer>
      </article>}
      {editor === "member" && <article className="content-card permission-section admin-permission-editor"><header><div><h2>Employee exceptions</h2><p>Add or subtract access for one employee without changing their rank.</p></div><select aria-label="Employee exceptions" value={employeeId} disabled={saving || needsRefresh} onChange={(event) => changeContext(() => setEmployeeId(event.target.value))}>{data.employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.name} · {employee.rank}</option>)}</select></header>
        {selectedEmployee?.isOwner && <p className="permission-admin-note">Protected recovery owner: full access cannot be removed here.</p>}
        {selectedEmployee && <p role="status">{selectedEmployee.loginLinked ? "Login email is recorded. Department approval and PIN setup are still required." : "No login email is recorded. Add one on Employee Information before this member can sign in."} Saved access: {selectedEmployee.effectivePermissions.length} permissions{dirty ? " (does not include this draft)" : ""}.</p>}
        {selectedEmployee?.isAdmin && <p className="permission-admin-note">Administrators begin with full access. To limit a specific administrator, remove only the privileges they should not use. “Manage payroll, rates, and all timesheets” controls every employee timesheet and editing.</p>}
        <div className="permission-override-list">{filtered.map((permission) => { const effect = permission.required ? "allow" : data.overrides[employeeId]?.[permission.key] ?? "rank"; const baseAllowed = Boolean(selectedEmployee?.isAdmin) || employeeRankPermissions.has(permission.key); return <label key={permission.key}><span><b>{permission.label}</b><small>{permission.required ? "Required for every employee" : `${selectedEmployee?.isAdmin ? "Administrator default" : "Rank"}: ${baseAllowed ? "Allowed" : "Not allowed"}`}</small></span><select value={effect} disabled={permission.required || !selectedEmployee || selectedEmployee.isOwner || saving || needsRefresh} onChange={(event) => { const next = { ...(data.overrides[employeeId] ?? {}) }; if (event.target.value === "rank") delete next[permission.key]; else next[permission.key] = event.target.value as "allow" | "deny"; setData({ ...data, overrides: { ...data.overrides, [employeeId]: next } }); }}><option value="rank">Use {selectedEmployee?.isAdmin ? "administrator default" : "rank setting"}</option><option value="allow">Add permission</option><option value="deny">Remove permission</option></select></label>; })}</div>
        <footer className="admin-save-bar"><span role="status">{saving ? "Saving…" : dirty ? "Unsaved changes" : "No unsaved changes"}</span><div><button type="button" className="quiet-button" disabled={!dirty || saving || needsRefresh} onClick={() => changeContext(() => setMessage("Draft discarded. Saved access is unchanged."))}>Discard changes</button><button type="button" className="primary-action" disabled={saving || !data.revision || !dirty || needsRefresh || !selectedEmployee || selectedEmployee.isOwner} onClick={() => void save({ scope: "employee", employeeId, overrides: data.overrides[employeeId] ?? {} })}>Save employee exceptions</button></div></footer>
      </article>}
    </> : <article className="content-card test-member-card"><span className="test-badge">ADMINISTRATOR TEST TOOL</span><h2>Preview the portal as a member</h2><p>This changes what you see and does not sign you in as the employee. This is a read-only navigation preview, not a test of the employee’s real login, PIN, API access, or database access.</p><select aria-label="Member to preview" value={testEmployeeId} onChange={(event) => onTestEmployee(data.employees.find((employee) => employee.id === event.target.value) ?? null)}><option value="">Choose a member…</option>{data.employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.name} · {employee.rank}</option>)}</select>{testEmployeeId && <button onClick={() => onTestEmployee(null)}>Exit test view</button>}<small>Use Exit test view to return to your administrator tools.</small></article>}
    {message && <div className="phone-message" role="status">{message}</div>}
  </section>;
}
