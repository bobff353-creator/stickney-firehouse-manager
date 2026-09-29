import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ResponseTypePanel } from "../../app/response-type-panel";
import type { ResponseTypeCount } from "../../app/response-type-groups";
import "../../app/globals.css";

const weekly: ResponseTypeCount[] = [["SICK PERSON", 5], ["EMS", 4], ["STROKE (CVA/TIA)", 2], ["ASSAULT/SEX ASLT/TAZER FD", 1], ["FIRE ALARM", 3], ["MVA", 2]];
const monthly: ResponseTypeCount[] = [...weekly, ["FALLS", 4], ["MUTUAL AID", 2]];
function Preview() {
  const [range, setRange] = useState("weekly");
  return <main style={{ maxWidth: 1000, margin: "0 auto", padding: 20 }}>
    <h1>Command Center · Isolated preview</h1><p>Fictional call counts. No records are read or saved.</p>
    <nav aria-label="Preview range" style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "20px 0" }}>
      {["weekly", "monthly", "empty", "nonmedical"].map((value) => <button type="button" key={value} aria-pressed={range === value} onClick={() => setRange(value)}>{value}</button>)}
    </nav>
    <ResponseTypePanel types={range === "weekly" ? weekly : range === "monthly" ? monthly : range === "nonmedical" ? [["FIRE ALARM", 3]] : []} range={range === "weekly" ? "Last 12 weeks" : range === "monthly" ? "Last 12 months" : "Test range"} />
  </main>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
