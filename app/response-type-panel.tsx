"use client";

import { useMemo, useRef, useState } from "react";
import { groupResponseTypes, type ResponseTypeCount } from "./response-type-groups";
import "./response-type-panel.css";

export function ResponseTypePanel({ types, range }: { types: readonly ResponseTypeCount[]; range: string }) {
  const [showEms, setShowEms] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const grouped = useMemo(() => groupResponseTypes(types), [types]);
  const visible = showEms ? grouped.breakdown : grouped.summary;
  const max = Math.max(1, ...visible.map(([, count]) => count));
  const navigate = (ems: boolean) => {
    setShowEms(ems);
    // Keep keyboard and mobile readers at the start of the changed chart.
    panel.current?.focus({ preventScroll: true });
    panel.current?.scrollIntoView({ block: "start", behavior: "instant" });
  };
  return <section ref={panel} tabIndex={-1} className="content-card response-type-panel grouped-response-panel" aria-label={showEms ? "EMS response breakdown" : "Response types"}>
    <div className="section-header"><div><h2>{showEms ? "EMS breakdown" : "Response types"}</h2><p>{range}</p></div><span className="count-badge">{showEms ? grouped.emsTotal : grouped.total} calls</span></div>
    {showEms ? <><button type="button" className="response-type-back" onClick={() => navigate(false)}>← All response types</button><p className="response-group-help">{grouped.emsTotal} EMS calls out of {grouped.total} total calls. Original dispatch labels are shown below.</p></> : grouped.breakdown.length > 0 && <p className="response-group-help">Medical call types are combined under EMS. Select EMS to see the breakdown.</p>}
    <div className="response-bars" aria-live="polite">{visible.length ? visible.map(([label, count]) => {
      const contents = <><span>{label}{!showEms && label === "EMS" && <small>View breakdown →</small>}</span><i aria-hidden="true"><b style={{ width: `${count / max * 100}%` }} /></i><strong>{count}</strong></>;
      return !showEms && label === "EMS" ? <button type="button" key={label} className="response-type-drilldown" onClick={() => navigate(true)} aria-label={`EMS: ${count} calls. View breakdown`}>{contents}</button> : <div key={label}>{contents}</div>;
    }) : <p>{showEms ? "No EMS calls recorded in this range." : "No calls recorded in this range."}</p>}</div>
  </section>;
}
