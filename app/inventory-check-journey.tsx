"use client";

import type { CheckSection } from "./inventory-check-flow";
import "./inventory/check-journey.css";

export default function InventoryCheckJourney({ sections, current, onChange, busy, footer = false }: {
  sections: CheckSection[]; current: string; onChange: (id: string) => void; busy: boolean; footer?: boolean;
}) {
  const index = sections.findIndex(section => section.id === current);
  const previous = current === "review" ? sections.at(-1) : sections[index - 1];
  const next = index < 0 ? sections.find(section => section.pending > 0) : sections[index + 1];

  if (!footer) {
    return <details className="crew-check-jump">
      <summary>Find a section</summary>
      <label htmlFor="crew-check-section">Inspection section</label>
      <select id="crew-check-section" value={current} disabled={busy} onChange={event => onChange(event.target.value)}>
        {sections.map(section => <option key={section.id} value={section.id}>{section.label} · {section.pending} remaining</option>)}
        <option value="all">All sections / search</option>
        <option value="review">Review &amp; submit</option>
      </select>
    </details>;
  }

  return <nav className="check-journey check-journey-footer" aria-label="Next inspection step">
    <div className="check-journey-actions">
      {previous && <button type="button" disabled={busy} onClick={() => onChange(previous.id)}>← Previous section</button>}
      {index >= 0 && <span>Section {index + 1} of {sections.length}</span>}
      {current !== "review" && <button className="ops-primary" type="button" disabled={busy} onClick={() => onChange(next?.id || "review")}>{next ? "Next section" : "Review check"} →</button>}
    </div>
  </nav>;
}
