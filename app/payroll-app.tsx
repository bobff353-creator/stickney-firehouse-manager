"use client";

import { useMemo, useState } from "react";

type Employee = {
  id: string;
  name: string;
  rank: string;
  hours: number;
  gross: number;
  status: "Ready" | "Review" | "Not started";
};

const previewEmployees: Employee[] = [
  { id: "wyant-robert", name: "Robert Wyant", rank: "Lieutenant", hours: 48, gross: 1789.92, status: "Ready" },
  { id: "espino-leonardo", name: "Leonardo Espino", rank: "Firefighter", hours: 43, gross: 946, status: "Review" },
  { id: "odowd-jon", name: "Jon O’Dowd", rank: "Chief", hours: 31.5, gross: 976.5, status: "Ready" },
  { id: "boulden-jamal", name: "Jamal Boulden", rank: "Firefighter", hours: 25, gross: 550, status: "Ready" },
  { id: "white-danny", name: "Danny White", rank: "Lieutenant", hours: 2, gross: 49.72, status: "Ready" },
];

const navItems = ["Payroll", "Timesheets", "Employees", "Rates & Rules"];

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function Icon({ name }: { name: "people" | "clock" | "document" | "warning" | "search" | "filter" | "export" }) {
  const symbols = { people: "👥", clock: "◷", document: "▤", warning: "!", search: "⌕", filter: "▽", export: "⇧" };
  return <span aria-hidden="true">{symbols[name]}</span>;
}

export default function PayrollApp() {
  const [activeNav, setActiveNav] = useState("Payroll");
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () => previewEmployees.filter((employee) => employee.name.toLowerCase().includes(search.toLowerCase())),
    [search],
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><span>◆</span></span>
          <span>Stickney Payroll Manager</span>
        </div>
        <nav aria-label="Primary navigation">
          {navItems.map((item) => (
            <button key={item} className={activeNav === item ? "nav-active" : ""} onClick={() => setActiveNav(item)}>{item}</button>
          ))}
        </nav>
        <div className="profile"><span className="avatar">BW</span><span>Bob Wyant</span><span aria-hidden="true">⌄</span></div>
      </header>

      <section className="workspace">
        <div className="period-row">
          <div>
            <p className="eyebrow">Current pay period</p>
            <div className="title-line"><h1>July 11–25, 2026</h1><span className="period-badge">▣ Draft</span></div>
          </div>
          <button className="primary-action" onClick={() => setActiveNav("Timesheets")}><span>◷</span> Enter Hours</button>
        </div>

        <section className="kpi-grid" aria-label="Payroll summary">
          <article className="kpi-card"><span className="kpi-icon blue"><Icon name="people" /></span><div><strong>43</strong><span>Active Employees</span></div></article>
          <article className="kpi-card"><span className="kpi-icon blue"><Icon name="clock" /></span><div><strong>106 <small>hr</small></strong><span>OT Threshold</span></div></article>
          <article className="kpi-card"><span className="kpi-icon blue"><Icon name="document" /></span><div><strong>Draft</strong><span>Pay Period Status</span></div></article>
          <article className="kpi-card alert"><span className="kpi-icon red"><Icon name="warning" /></span><div><strong>3</strong><span>Need Review</span></div></article>
        </section>

        <section className="payroll-panel">
          <div className="toolbar">
            <label className="search-box"><Icon name="search" /><span className="sr-only">Search employees</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees…" /></label>
            <div className="toolbar-actions"><button><Icon name="filter" /> Filter <span>⌄</span></button><button><Icon name="export" /> Export <span>⌄</span></button></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Rank</th><th className="number">Hours</th><th className="number">Gross Pay</th><th>Status</th></tr></thead>
              <tbody>
                {filtered.map((employee) => (
                  <tr key={employee.id}>
                    <td><span className="person-icon">♙</span><strong>{employee.name}</strong></td>
                    <td>{employee.rank}</td>
                    <td className="number tabular">{employee.hours.toFixed(1)} hrs</td>
                    <td className="number tabular">{formatMoney(employee.gross)}</td>
                    <td><span className={`status-pill ${employee.status.toLowerCase().replace(" ", "-")}`}>{employee.status === "Ready" ? "✓" : employee.status === "Review" ? "◷" : "–"} {employee.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
