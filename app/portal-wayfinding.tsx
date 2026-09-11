"use client";
import { useState } from "react";
import { portalPageLabel, type PortalPage } from "./portal-navigation";
import { portalWorkflows } from "./portal-workflows";

export function WorkspaceGuide({ page, home, backLabel, onBack, onNavigate }: { page: PortalPage; home: PortalPage; backLabel?: string; onBack: () => void; onNavigate: (page: PortalPage) => void }) {
  const guide = portalWorkflows[page];
  return <div className="workspace-wayfinding no-print" data-test-safe>
    <nav aria-label="Workspace navigation">
      {backLabel && <button type="button" onClick={onBack}>← Back to {backLabel}</button>}
      {page !== home && <button type="button" onClick={() => onNavigate(home)}>{portalPageLabel(home)}</button>}
      <span aria-current="page">{portalPageLabel(page)}</span>
    </nav>
    <details className="workspace-guide" key={page}>
      <summary>How to use this screen</summary>
      <div><strong>{guide.purpose}</strong><ol>{guide.steps.map(step => <li key={step}>{step}</li>)}</ol><p>Need access or a record corrected? Contact your department administrator. Do not share your PIN.</p></div>
    </details>
  </div>;
}

export function TaskDirectory({ allowedPages, onNavigate }: { allowedPages: readonly PortalPage[]; onNavigate: (page: PortalPage) => void }) {
  const [search, setSearch] = useState("");
  const pages = allowedPages.filter(page => page !== "Dashboard" && `${portalPageLabel(page)} ${portalWorkflows[page].purpose} ${portalWorkflows[page].group}`.toLowerCase().includes(search.trim().toLowerCase()));
  const groups = [...new Set(pages.map(page => portalWorkflows[page].group))];
  return <section className="portal-task-directory" aria-labelledby="portal-tasks-title" data-test-safe>
    <header><div><h2 id="portal-tasks-title">What do you need to do?</h2><p>Search the tools available to your account.</p></div><label><span>Find a task</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Try schedule, equipment, hours…" /></label></header>
    {search && <p role="status">{pages.length} matching tools <button type="button" onClick={() => setSearch("")}>Clear search</button></p>}
    <div className="portal-task-groups">{groups.map(group => <details key={group} open={search ? true : undefined}><summary>{group}<span>{pages.filter(page => portalWorkflows[page].group === group).length} tools</span></summary><div>{pages.filter(page => portalWorkflows[page].group === group).map(page => <button type="button" key={page} onClick={() => onNavigate(page)}><strong>{portalPageLabel(page)} <span aria-hidden="true">→</span></strong><small>{portalWorkflows[page].purpose}</small></button>)}</div></details>)}</div>
    {!pages.length && <p>No tools match. Try a shorter word or clear the search. Only your permitted tools appear here.</p>}
  </section>;
}
