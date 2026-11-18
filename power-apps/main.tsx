import { useEffect, useState, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import "./portal-styles";
import DailyLog from "../app/daily-log";
import { currentPeriodStart } from "../app/payroll-period-start";
import { usePermissions, refreshPermissions } from "../app/use-permissions";

type Employees = ComponentProps<typeof DailyLog>["employees"];

function DailyLogWorkspace() {
  const [employees, setEmployees] = useState<Employees | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/payroll?period=${currentPeriodStart()}`, {
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load the staffing roster.");
        if (!Array.isArray(data.employees)) throw new Error("The server did not return a staffing roster.");
        if (!controller.signal.aborted) {
          setEmployees(data.employees);
          setError("");
        }
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : "Unable to load the staffing roster.");
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [reload]);

  const retry = () => setReload(current => current + 1);
  return <>
    {error && <div role="alert">{error} <button onClick={retry}>Retry roster</button></div>}
    {employees ? <DailyLog employees={employees} onPayrollSynced={retry} />
      : !error && <p role="status">Loading the staffing roster…</p>}
  </>;
}

function VerifiedWorkspace() {
  const access = usePermissions();
  if (access.verified && access.confirmation?.required === false && access.permissions.includes("daily_log.view")) {
    return <DailyLogWorkspace key={access.identity} />;
  }

  let message = "Verifying department access…";
  if (access.error) message = access.error;
  else if (access.verified) {
    message = access.confirmation?.required !== false
      ? "Complete the required confirmation in the department portal."
      : "Daily Log access is not enabled for this account.";
  }
  return <section className="content-card">
    <h1>Daily Logbook</h1>
    <p role="status">{message}</p>
    <a href="/" target="_blank" rel="noreferrer">Open the isolated department sign-in</a>
    <button onClick={() => void refreshPermissions()} disabled={access.checking}>Recheck access</button>
  </section>;
}

function App() {
  return <main className="main-content">
    {location.hostname === "127.0.0.1" && location.pathname.startsWith("/power-apps/")
      ? <VerifiedWorkspace />
      : <p role="status">The Power Apps backend connection has not been configured.</p>}
  </main>;
}

const root = document.getElementById("root");
if (!root) throw new Error("Firehouse Manager root element is missing.");
createRoot(root).render(<App />);
