"use client";

import { useRef, useState } from "react";
import { availableAdminTasks } from "./admin-tasks";
import { type PortalPage, type PortalRecord } from "./portal-navigation";

const sourceNotes: Partial<Record<PortalPage, string>> = {
  Dashboard: "Home summarizes saved records. Use Admin tools to change the source schedule, member, log, or checklist—not the summary card.",
  "Command Center": "Charts and totals come from operational records. Correct the source record; the charts are not manually editable.",
  "Activity Timeline": "This is saved activity history. Use the originating tool for a permitted correction; do not overwrite the audit trail.",
  "Employee Contacts": "Contact details come from Employees. Use Admin tools → Edit a member to correct a phone number or other profile details.",
  "My Timesheet": "This view is read-only. Submit a correction request, or use the permitted Timesheets editor for payroll administration.",
  "Holiday Policy": "This is reference information. Review payroll rules separately; reading a policy does not change saved hours or pay.",
  EMS: "These are reference documents. Updating the approved source is separate from editing a Daily Log or patient-related entry.",
  "Test View": "This is a read-only navigation preview. Exit test view before editing; it does not sign in as another member.",
};

export default function AdminTools({ page, permissions, allowedPages, onNavigate }: {
  page: PortalPage; permissions: readonly string[]; allowedPages: readonly PortalPage[];
  onNavigate: (page: PortalPage, record?: PortalRecord) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const tasks = availableAdminTasks(permissions, allowedPages);
  if (!tasks.length) return null;
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const directMatch = (title: string) => terms.length > 0 && terms.every(term => title.toLowerCase().includes(term));
  const matches = tasks.filter(task => terms.every(term => `${task.title} ${task.group} ${task.steps}`.toLowerCase().includes(term)))
    .sort((a, b) => Number(directMatch(b.title)) - Number(directMatch(a.title)));
  const groups = [...new Set(matches.map(task => task.group))];
  const here = tasks.filter(task => task.page === page);
  return <aside className="admin-tools no-print" aria-label="Administration tools">
    <button type="button" className="quiet-button" onClick={() => { setSearch(""); dialog.current?.showModal(); }}>Admin tools · Find what to edit</button>
    {here.length > 0 && <details className="admin-help" key={page}><summary>Editing this area</summary>{here.map(task => <div key={task.id}><strong>{task.title}</strong><p>{task.steps}</p><small><b>Check the result:</b> {task.preview}</small></div>)}</details>}
    {sourceNotes[page] && <details className="admin-help" key={`${page}-source`}><summary>Where to make changes</summary><p>{sourceNotes[page]}</p></details>}
    <dialog ref={dialog} className="admin-task-dialog" aria-labelledby="admin-task-title" onClick={event => { if (event.target === dialog.current) dialog.current?.close(); }}>
      <header><div><h2 id="admin-task-title">What do you want to change?</h2><p>Only tools allowed for your account appear here.</p></div><button type="button" className="quiet-button" onClick={() => dialog.current?.close()} aria-label="Close admin tools">Close</button></header>
      <label className="admin-task-search">Find an admin task<input autoFocus type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Try member, checklist, rates, reminders…" /></label>
      <p role="status">{matches.length} tasks{search && <> · <button type="button" onClick={() => setSearch("")}>Clear search</button></>}</p>
      <div className="admin-task-results">{groups.map(group => <details key={`${group}:${Boolean(search)}`} open={search ? true : undefined}><summary>{group}<span>{matches.filter(task => task.group === group).length} tasks</span></summary><div>{matches.filter(task => task.group === group).map(task => <button type="button" key={task.id} onClick={() => { dialog.current?.close(); onNavigate(task.page, { adminTask: task.id }); }}><strong>{task.title} <span aria-hidden="true">→</span></strong><small>{task.steps}</small></button>)}</div></details>)}</div>
      {!matches.length && <p>No matching tasks. Try a shorter word or clear your search.</p>}
      <footer>Opening a tool does not save changes. Use its Save control, then review the saved result.</footer>
    </dialog>
  </aside>;
}
