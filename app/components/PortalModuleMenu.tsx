"use client";
/* eslint-disable @next/next/no-img-element -- match the portal's direct, fixed-size department patch without an image proxy. */
/* eslint-disable @next/next/no-html-link-for-pages -- explicit full-page module navigation; never prefetch other operational workspaces. */

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { adminNavGroups, featuredNavItems, featuredNavPages, portalNavigationForPermissions } from "../portal-menu-items";
import { portalPageLabel, portalPageUrl, type PortalPage } from "../portal-navigation";
import { confirmLeavingWork } from "../use-unsaved-work";
import "./portal-module-menu.css";

const marks: Partial<Record<PortalPage, string>> = { Dashboard: "⌂", Respond: "!", "Operations Board": "▤", "Field Preplans": "⌖", "Daily Log": "▤", Scheduling: "◷", Inventory: "□" };

/** Navigation only: reuse verified grants; never mount or poll another portal screen. */
export default function PortalModuleMenu({ permissions, currentPage, departmentName }: {
  permissions: readonly string[];
  currentPage: PortalPage;
  departmentName: string;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const pages = portalNavigationForPermissions(permissions);
  const featured = featuredNavItems.filter(item => pages.includes(item.page));
  const groups = adminNavGroups.map(group => ({ ...group, items: group.items.filter(item => pages.includes(item.page) && !featuredNavPages.has(item.page)) })).filter(group => group.items.length);
  const grouped = new Set(groups.flatMap(group => group.items.map(item => item.page)));
  const personal = pages.filter(page => !featuredNavPages.has(page) && !grouped.has(page));

  useEffect(() => {
    if (!open || !dialog.current) return;
    const panel = dialog.current;
    const previousOverflow = document.body.style.overflow;
    panel.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      panel.close();
      document.body.style.overflow = previousOverflow;
      if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
    };
  }, [open]);

  function follow(event: MouseEvent<HTMLAnchorElement>, page: PortalPage) {
    if (page === currentPage) { event.preventDefault(); setOpen(false); return; }
    if (!confirmLeavingWork()) { event.preventDefault(); return; }
    setOpen(false);
  }
  function href(page: PortalPage) { return page === "Inventory" ? "/inventory" : portalPageUrl("/", "", page); }
  function link(page: PortalPage, label: string, tone?: string) {
    return <a key={page} href={href(page)} aria-current={page === currentPage ? "page" : undefined} onClick={event => follow(event, page)}>
      <span aria-hidden="true" className={`portal-module-mark ${tone || "tool"}`}>{marks[page] || "›"}</span>
      <span>{label}</span>{page === currentPage && <small>Current</small>}
    </a>;
  }

  return <>
    <button ref={trigger} type="button" className="portal-module-menu-trigger" aria-label={open ? "Hide navigation menu" : "Show navigation menu"} aria-controls={id} aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>{open ? "Hide menu" : "Show menu"}</span>
    </button>
    <dialog ref={dialog} id={id} className="portal-module-menu" aria-labelledby={`${id}-title`} onClose={() => setOpen(false)} onCancel={event => { event.preventDefault(); setOpen(false); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) setOpen(false);
    }}>
      <header className="portal-module-menu-heading">
        <img src="/stickney-fd-patch.png?v=3" alt="Fire Department patch" width={48} height={48}/>
        <div><strong id={`${id}-title`}>{departmentName}</strong><span>Operations Portal</span></div>
        <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)}>×</button>
      </header>
      <p className="portal-module-menu-context">You’re in {portalPageLabel(currentPage)}. Choose another portal tool below.</p>
      <nav aria-label="Portal navigation" className="portal-module-menu-links">
        <div className="portal-module-core">{featured.map(item => link(item.page, item.label, item.tone))}</div>
        {groups.length > 0 || personal.length > 0 ? <details className="portal-module-more"><summary>More tools</summary>
          {personal.length > 0 && <section><h2>Personal</h2>{personal.map(page => link(page, portalPageLabel(page)))}</section>}
          {groups.map(group => <section key={group.label}><h2>{group.label}</h2>{group.items.map(item => link(item.page, item.label))}</section>)}
        </details> : null}
      </nav>
      <footer className="portal-module-menu-footer"><a href="/?display=portal" onClick={event => { if (!confirmLeavingWork()) { event.preventDefault(); return; } setOpen(false); }}>Portal home & account</a><span>Only tools allowed for your account are shown.</span></footer>
    </dialog>
  </>;
}
