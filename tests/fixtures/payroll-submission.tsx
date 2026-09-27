import React, { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import PayrollSubmissions from "../../app/payroll-submissions";

function Fixture() {
  const [period, setPeriod] = useState("2026-09-11");
  const [generation, setGeneration] = useState(0);
  const [mode, setMode] = useState("admin");
  const [evidence, setEvidence] = useState("");
  const saved = useCallback(() => {}, []);
  async function request(path: string, body: unknown) { await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); }
  return <main style={{ maxWidth: 1100, margin: "auto", padding: 12, fontFamily: "Arial, sans-serif", background: "#f3f5f6" }}>
    <h1>Fictional payroll test — no live records</h1><p>Actual component → actual API handler → isolated PostgreSQL. All people and hours below are invented test fixtures only.</p>
    <label>Test period <select value={period} onChange={e => setPeriod(e.target.value)}><option value="2026-09-11">September 11–25</option><option value="2026-09-26">September 26–October 10</option></select></label>{" "}
    <button onClick={async () => { await request("/fixture/trade", {}); setEvidence("Fictional late trade recorded."); }}>Record fictional late trade</button>{" "}
    <button onClick={async () => { await request("/fixture/mode", { manager: mode !== "admin" }); setMode(mode === "admin" ? "employee" : "admin"); setGeneration(g => g + 1); }}>Switch to {mode === "admin" ? "employee" : "admin"} permissions</button>{" "}
    <button onClick={async () => { await request("/fixture/mode", { manager: true, loseResponse: true }); setEvidence("Next save response will be lost after commit."); }}>Simulate lost save response</button>{" "}
    <button onClick={async () => setEvidence(JSON.stringify(await (await fetch("/fixture/evidence")).json()))}>Check saved record counts</button>
    <p role="status">{evidence}</p>
    <PayrollSubmissions key={`${period}-${generation}`} period={period} end={period === "2026-09-11" ? "2026-09-25" : "2026-10-10"} disabled={false} finalized={false} onSaved={saved}/>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
