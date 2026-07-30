"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "./supabase-browser";

type Department = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  county: string | null;
  account_status: string;
  trial_status: string;
};

type DepartmentRow = {
  role: string;
  status: string;
  departments: Department | Department[] | null;
};

const blankDepartment = { name: "", slug: "", city: "", state: "IL", county: "" };

function departmentFrom(row: DepartmentRow) {
  return Array.isArray(row.departments) ? row.departments[0] : row.departments;
}

function readableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.toLowerCase().includes("duplicate")) return "That department name or web address is already in use.";
  return message || "The department could not be saved.";
}

export default function DepartmentSettings() {
  const [memberships, setMemberships] = useState<DepartmentRow[]>([]);
  const [counts, setCounts] = useState<Record<string, { properties: number; hydrants: number }>>({});
  const [draft, setDraft] = useState(blankDepartment);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    const { data, error } = await client
      .from("department_memberships")
      .select("role,status,departments(id,name,slug,city,state,county,account_status,trial_status)")
      .eq("status", "active")
      .order("created_at", { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as unknown as DepartmentRow[];
    setMemberships(rows);
    const departments = rows.map(departmentFrom).filter((item): item is Department => Boolean(item));
    const nextCounts: Record<string, { properties: number; hydrants: number }> = {};
    await Promise.all(departments.map(async (department) => {
      const [properties, hydrants] = await Promise.all([
        client.from("properties").select("id", { count: "exact", head: true }).eq("department_id", department.id),
        client.from("hydrants").select("id", { count: "exact", head: true }).eq("department_id", department.id),
      ]);
      nextCounts[department.id] = { properties: properties.count ?? 0, hydrants: hydrants.count ?? 0 };
    }));
    setCounts(nextCounts);
  }, []);

  useEffect(() => {
    void load().catch((error) => setMessage(readableError(error)));
  }, [load]);

  function updateName(name: string) {
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setDraft((current) => ({ ...current, name, slug: current.slug && current.slug !== current.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ? current.slug : slug }));
  }

  async function createDepartment(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const client = getSupabaseBrowserClient();
      const { error } = await client.rpc("create_department_with_admin", {
        p_name: draft.name,
        p_slug: draft.slug,
        p_city: draft.city,
        p_state: draft.state,
        p_county: draft.county,
      });
      if (error) throw error;
      setDraft(blankDepartment);
      setShowForm(false);
      await load();
      setMessage("Department created. Its records and access are separated from every other department.");
    } catch (error) {
      setMessage(readableError(error));
    } finally {
      setSaving(false);
    }
  }

  return <section className="department-settings-page">
    <header className="standard-page-header">
      <div><span className="page-icon">FD</span><div><p className="eyebrow">Platform administration</p><h1>Departments</h1><p>Create and manage separate department workspaces without mixing records.</p></div></div>
      <button className="primary-action" type="button" onClick={() => setShowForm((current) => !current)}>{showForm ? "Cancel" : "Add Department"}</button>
    </header>

    {showForm && <form className="content-card department-create-form" onSubmit={(event) => void createDepartment(event)}>
      <div className="section-header"><div><h2>Add a department</h2><p>This creates a clean department account. Employees, payroll, policies, preplans, hydrants, box cards, apparatus, and duties remain separate.</p></div></div>
      <div className="department-form-grid">
        <label><span>Department name *</span><input required value={draft.name} onChange={(event) => updateName(event.target.value)} placeholder="Fermilab FD" /></label>
        <label><span>Free web address *</span><div className="department-slug-input"><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder="fermilab-fd" /><b>.vercel.app</b></div></label>
        <label><span>City</span><input value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })} /></label>
        <label><span>State</span><input maxLength={2} value={draft.state} onChange={(event) => setDraft({ ...draft, state: event.target.value.toUpperCase() })} /></label>
        <label><span>County</span><input value={draft.county} onChange={(event) => setDraft({ ...draft, county: event.target.value })} /></label>
      </div>
      <div className="department-create-actions"><small>The department is created first. Its dedicated portal address is published as the next provisioning step.</small><button className="primary-action" disabled={saving}>{saving ? "Creating…" : "Create Department"}</button></div>
    </form>}

    <div className="department-card-grid">{memberships.map((row) => {
      const department = departmentFrom(row);
      if (!department) return null;
      const stats = counts[department.id] ?? { properties: 0, hydrants: 0 };
      const isFermilab = department.slug === "fermilab-fd";
      return <article className="content-card department-card" key={department.id}>
        <div className="department-card-head"><span>{department.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 3)}</span><div><h2>{department.name}</h2><p>{[department.city, department.state].filter(Boolean).join(", ") || "Location not entered"}</p></div><b>{row.role}</b></div>
        <div className="department-stats"><div><strong>{stats.properties}</strong><span>Properties</span></div><div><strong>{stats.hydrants}</strong><span>Hydrants</span></div><div><strong>{department.trial_status === "active" ? "Active" : department.account_status}</strong><span>Account</span></div></div>
        <footer><span>{department.slug}.vercel.app</span>{isFermilab ? <small>Fermilab source records imported · portal publishing next</small> : <small>Department workspace active</small>}</footer>
      </article>;
    })}</div>
    {message && <div className="toast">{message}</div>}
  </section>;
}
