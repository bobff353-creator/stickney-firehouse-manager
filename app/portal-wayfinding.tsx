"use client";
import { useWorkspaceViewState } from "./workspace-view-state";
import { portalPageLabel, type PortalPage } from "./portal-navigation";
import { portalWorkflows } from "./portal-workflows";
import { useWorkspaceTaskNavigation } from "./workspace-task-navigation";

export function WorkspaceGuide({ page, backLabel, onBack, returnLabel, onReturn }: { page: PortalPage; home: PortalPage; backLabel?: string; onBack: () => void; returnLabel?: string; onReturn?: () => void; onNavigate: (page: PortalPage) => void }) {
  const guide = portalWorkflows[page];
  const taskReturn = useWorkspaceTaskNavigation(page);
  const destination = taskReturn?.label || returnLabel || backLabel;
  return <div className="workspace-wayfinding no-print" data-test-safe>
    <nav aria-label="Workspace navigation">
      {destination && <button type="button" disabled={taskReturn?.disabled} onClick={taskReturn?.onBack ?? (returnLabel && onReturn ? onReturn : onBack)}>← Back to {destination}</button>}
      <span className="workspace-section">{guide.group} →</span>
      <span aria-current={taskReturn ? undefined : "page"}>{portalPageLabel(page)}</span>
      {taskReturn?.record && <span>→ {taskReturn.record}</span>}
      {taskReturn && <span aria-current="page">→ {taskReturn.task || "Current task"}</span>}
    </nav>
    <details className="workspace-guide" key={page}>
      <summary>How to use this screen</summary>
      <div><strong>{guide.purpose}</strong><ol>{guide.steps.map(step => <li key={step}>{step}</li>)}</ol><p>Need access or a record corrected? Contact your department administrator. Do not share your PIN.</p></div>
    </details>
  </div>;
}

export function TaskDirectory({ allowedPages, onNavigate }: { allowedPages: readonly PortalPage[]; onNavigate: (page: PortalPage) => void }) {
  const [search, setSearch] = useWorkspaceViewState("task-directory-search", "");
  const pages = allowedPages.filter(page => page !== "Dashboard" && `${portalPageLabel(page)} ${portalWorkflows[page].purpose} ${portalWorkflows[page].group}`.toLowerCase().includes(search.trim().toLowerCase()));
  const groups = [...new Set(pages.map(page => portalWorkflows[page].group))];
  return <section className="portal-task-directory" aria-labelledby="portal-tasks-title" data-test-safe>
    <header><div><h2 id="portal-tasks-title">What do you need to do?</h2><p>Search the tools available to your account.</p></div><label><span>Find a task</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Try schedule, equipment, hours…" /></label></header>
    {search && <p role="status">{pages.length} matching tools <button type="button" onClick={() => setSearch("")}>Clear search</button></p>}
    <div className="portal-task-groups">{groups.map(group => <details key={group} open={search ? true : undefined}><summary>{group}<span>{pages.filter(page => portalWorkflows[page].group === group).length} tools</span></summary><div>{pages.filter(page => portalWorkflows[page].group === group).map(page => <button type="button" key={page} onClick={() => onNavigate(page)}><strong>{portalPageLabel(page)} <span aria-hidden="true">→</span></strong><small>{portalWorkflows[page].purpose}</small></button>)}</div></details>)}</div>
    {!pages.length && <p>No tools match. Try a shorter word or clear the search. Only your permitted tools appear here.</p>}
  </section>;
}
