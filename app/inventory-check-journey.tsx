"use client";
import type { CheckSection } from "./inventory-check-flow";
import "./inventory/check-journey.css";

export default function InventoryCheckJourney({ sections, current, onChange, busy, footer = false }: {
  sections: CheckSection[]; current: string; onChange: (id: string) => void; busy: boolean; footer?: boolean;
}) {
  const index = sections.findIndex(section => section.id === current);
  const previous = current === "review" ? sections.at(-1) : sections[index - 1];
  const next = sections[index + 1];
  return <nav className={`check-journey ${footer ? "check-journey-footer" : ""}`} aria-label={footer ? "Next inspection step" : "Inspection sections"}>
    {!footer && <>
      <p className="check-journey-path">Choose check → Record results → Review → Submit</p>
      <label>Current section<select value={current} disabled={busy} onChange={event => onChange(event.target.value)}>
        {sections.map((section, i) => <option key={section.id} value={section.id}>{i + 1}. {section.label} · {section.pending} remaining</option>)}
        <option value="all">All sections / search</option><option value="review">Review &amp; submit</option>
      </select></label>
    </>}
    <div className="check-journey-actions">
      <button type="button" disabled={busy || !previous} onClick={() => previous && onChange(previous.id)}>← {previous ? previous.label : "First section"}</button>
      <span>{current === "review" ? "Review before submitting" : index >= 0 ? `Section ${index + 1} of ${sections.length}` : "All sections"}</span>
      {current !== "review" && <button className="ops-primary" type="button" disabled={busy} onClick={() => onChange(next?.id || "review")}>{next ? `Next: ${next.label}` : "Review & submit"} →</button>}
    </div>
  </nav>;
}
