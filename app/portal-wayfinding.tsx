"use client";
import { useId, useRef, useState } from "react";
import { useWorkspaceViewState } from "./workspace-view-state";
import { portalPageLabel, type PortalPage, type PortalRecord } from "./portal-navigation";
import { portalWorkflows } from "./portal-workflows";
import { useWorkspaceTaskNavigation } from "./workspace-task-navigation";
import { matchesWorkspace, workspaceHelp } from "./workspace-help";
import { availableAdminTasks } from "./admin-tasks";

export function WorkspaceGuide({ page, backLabel, onBack, returnLabel, onReturn, allowedPages = [], permissions = [], onNavigate }: { page: PortalPage; home: PortalPage; backLabel?: string; onBack: () => void; returnLabel?: string; onReturn?: () => void; allowedPages?: readonly PortalPage[]; permissions?: readonly string[]; onNavigate: (page: PortalPage, record?: PortalRecord) => void }) {
  const guide = portalWorkflows[page];
  const help = workspaceHelp[page];
  const toolsDialog = useRef<HTMLDialogElement>(null);
  const [helpSection, setHelpSection] = useState("Start & next");
  const related = (help.related ?? []).filter(item => allowedPages.includes(item));
  const setup = availableAdminTasks(permissions, allowedPages).filter(task => task.page === page);
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
    <div className="workspace-orientation-actions"><button type="button" onClick={() => toolsDialog.current?.showModal()}>All tools</button></div>
    <details className="workspace-guide" key={page} onToggle={event => { if (!event.currentTarget.open) setHelpSection("Start & next"); }}>
      <summary>How to use this screen</summary>
      <div className="workspace-help-content"><strong>{guide.purpose}</strong>
        <div className="workspace-help-tabs" role="group" aria-label="Help topics">{["Start & next", "Save & change", "Set up", "Notify"].map(label => <button key={label} type="button" aria-pressed={helpSection === label} onClick={() => setHelpSection(label)}>{label}</button>)}</div>
        <div className="workspace-help-answer" aria-live="polite">
          {helpSection === "Start & next" && <ol>{guide.steps.map(step => <li key={step}>{step}</li>)}</ol>}
          {helpSection === "Save & change" && <p>{help.save}</p>}
          {helpSection === "Notify" && <p>{help.notify}</p>}
          {helpSection === "Set up" && (setup.length ? <div className="workspace-setup-actions">{setup.map(task => <button key={task.id} type="button" onClick={() => onNavigate(task.page, { adminTask: task.id })}><strong>{task.title} →</strong><small>{task.steps}</small></button>)}</div> : <p>{permissions.length ? "There are no setup tools for your account on this screen. Use the related tools below, or ask your department administrator to change its configuration." : "Use the screen’s available controls. Your department administrator manages setup and access."}</p>)}
        </div>
        {related.length > 0 && <div className="workspace-related"><span>Related work</span>{related.map(item => <button type="button" key={item} onClick={() => onNavigate(item)}>{portalPageLabel(item)} →</button>)}</div>}
      </div>
    </details>
    <dialog ref={toolsDialog} className="workspace-tools-dialog" aria-labelledby="workspace-tools-title" onClick={event => { if (event.target === toolsDialog.current) toolsDialog.current?.close(); }}><header><div><h2 id="workspace-tools-title">Where do you want to go?</h2><p>Choose a task. Your current screen stays here until you choose.</p></div><button type="button" autoFocus onClick={() => toolsDialog.current?.close()}>Close tools</button></header><TaskDirectory allowedPages={allowedPages} onNavigate={item => { toolsDialog.current?.close(); onNavigate(item); }} /></dialog>
  </div>;
}

export function TaskDirectory({ allowedPages, onNavigate }: { allowedPages: readonly PortalPage[]; onNavigate: (page: PortalPage) => void }) {
  const headingId = useId();
  const [search, setSearch] = useWorkspaceViewState("task-directory-search", "");
  const pages = allowedPages.filter(page => page !== "Dashboard" && matchesWorkspace(page, search));
  const groupOrder = ["Live operations", "Checks & duties", "Schedule & hours", "Field reference", "People", "Documents", "Administration"];
  const groups = [...new Set(pages.map(page => portalWorkflows[page].group))].sort((a,b) => groupOrder.indexOf(a)-groupOrder.indexOf(b));
  return <section className="portal-task-directory" aria-labelledby={headingId} data-test-safe>
    <header><div><h2 id={headingId}>What do you need to do?</h2><p>Search the tools available to your account.</p></div><label><span>Find a task</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Try schedule, equipment, hours…" /></label></header>
    {!search && <div className="workspace-task-shortcuts">{([["Inventory","Start a vehicle check"],["Scheduling","Calendar & trades"],["Field Preplans","Preplans & hydrants"],["Daily Log","Record my shift"],["Daily Duties","Station duties"],["Policies","Find a policy"]] as [PortalPage,string][]).filter(([page])=>allowedPages.includes(page)).map(([page,label])=><button type="button" key={page} onClick={()=>onNavigate(page)}>{label} →</button>)}</div>}
    {search && <p role="status">{pages.length} matching tools <button type="button" onClick={() => setSearch("")}>Clear search</button></p>}
    <div className="portal-task-groups">{groups.map(group => <details key={group} open={search ? true : undefined}><summary>{group}<span>{pages.filter(page => portalWorkflows[page].group === group).length} tools</span></summary><div>{pages.filter(page => portalWorkflows[page].group === group).map(page => <button type="button" key={page} onClick={() => onNavigate(page)}><strong>{portalPageLabel(page)} <span aria-hidden="true">→</span></strong><small>{portalWorkflows[page].purpose}</small></button>)}</div></details>)}</div>
    {!pages.length && <p>No tools match. Try a shorter word or clear the search. Only your permitted tools appear here.</p>}
  </section>;
}
