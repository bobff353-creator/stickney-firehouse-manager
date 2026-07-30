"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type OperationsView = "check" | "readiness" | "service" | "stock";
type Row = Record<string, string | number | null>;
type OperationsData = {
  configured: boolean;
  apparatus: Row[];
  compartments: Row[];
  equipment: Row[];
  checks: Row[];
  checkItems: Row[];
  exceptions: Row[];
  workOrders: Row[];
  stock: Row[];
  error?: string;
};

const emptyData: OperationsData = {
  configured: false,
  apparatus: [],
  compartments: [],
  equipment: [],
  checks: [],
  checkItems: [],
  exceptions: [],
  workOrders: [],
  stock: [],
};

function value(row: Row, key: string) {
  const item = row[key];
  return item === null || item === undefined ? "" : String(item);
}

function formatDate(input: Row[string]) {
  if (input === null || input === undefined || input === "") return "Not recorded";
  const numeric = Number(input);
  const date = Number.isFinite(numeric) && numeric > 0
    ? new Date(numeric)
    : new Date(String(input));
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function InventoryOperations({
  view,
  onSetup,
}: {
  view: OperationsView;
  onSetup: () => void;
}) {
  const [data, setData] = useState<OperationsData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [accessRequired, setAccessRequired] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/operations", { cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as Partial<OperationsData>;
      if (!response.ok || payload.configured !== true) {
        setAccessRequired(response.status === 401 || response.status === 403);
        throw new Error(payload.error || "Operational records are unavailable.");
      }
      setData({
        configured: true,
        apparatus: payload.apparatus || [],
        compartments: payload.compartments || [],
        equipment: payload.equipment || [],
        checks: payload.checks || [],
        checkItems: payload.checkItems || [],
        exceptions: payload.exceptions || [],
        workOrders: payload.workOrders || [],
        stock: payload.stock || [],
      });
      setError("");
      setAccessRequired(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Operational records are unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Loading is intentionally kicked off once when this operational panel opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function action(name: string, payload: Record<string, unknown>) {
    setBusy(name);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/operations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "The change could not be saved.");
      await load();
      setMessage("Saved to the department Inventory.");
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The change could not be saved.");
      return false;
    } finally {
      setBusy("");
    }
  }

  const activeCheck = data.checks.find((check) => value(check, "status") === "in_progress");
  const activeItems = activeCheck
    ? data.checkItems.filter((item) => value(item, "check_id") === value(activeCheck, "id"))
    : [];
  const pendingItems = activeItems.filter((item) => value(item, "result") === "pending").length;
  const stockRows = useMemo(() => {
    const grouped = new Map<string, { row: Row; total: number; lots: Row[] }>();
    for (const row of data.stock) {
      const id = value(row, "id");
      const existing = grouped.get(id) || { row, total: 0, lots: [] };
      existing.total += Number(row.quantity_on_hand || 0);
      if (row.lot_id) existing.lots.push(row);
      grouped.set(id, existing);
    }
    return [...grouped.values()];
  }, [data.stock]);

  function submit(event: FormEvent<HTMLFormElement>, name: string, payload: Record<string, unknown>) {
    event.preventDefault();
    const form = event.currentTarget;
    void action(name, payload).then((saved) => {
      if (saved) form.reset();
    });
  }

  if (loading) return <div className="ops-state">Loading saved Inventory records…</div>;
  if (error && !data.configured) {
    return (
      <div className="ops-state ops-error" role="alert">
        {error}
        <div className="ops-state-actions">
          {accessRequired ? <Link href="/">Return to department portal</Link> : null}
          <button type="button" onClick={() => void load()}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="inventory-ops">
      {message ? <div className="ops-message" role="status">{message}</div> : null}
      {error ? <div className="ops-message ops-error" role="alert">{error}</div> : null}

      {view === "check" ? (
        <>
          <section className="ops-card">
            <header><div><span>APPARATUS CHECK</span><h2>{activeCheck ? value(activeCheck, "apparatus_name") : "Start a shift check"}</h2></div>{activeCheck ? <b>{pendingItems} remaining</b> : null}</header>
            {!data.apparatus.length ? (
              <div className="ops-empty"><strong>No apparatus added</strong><p>Add the first real department unit before starting checks.</p><button onClick={onSetup}>Add apparatus</button></div>
            ) : activeCheck ? (
              <div className="check-worklist">
                {activeItems.map((item) => (
                  <article key={value(item, "id")} className={`check-row result-${value(item, "result")}`}>
                    <div><strong>{value(item, "equipment_name")}</strong><small>{value(item, "compartment_label")}</small></div>
                    <span>{value(item, "result").replace("_", " ")}</span>
                    <div className="check-actions">
                      {(["pass", "missing", "damaged", "not_applicable"] as const).map((result) => <button key={result} disabled={Boolean(busy)} onClick={() => void action(`item-${value(item, "id")}`, { action: "record_check_item", checkItemId: value(item, "id"), result })}>{result === "not_applicable" ? "N/A" : result}</button>)}
                    </div>
                  </article>
                ))}
                <button className="ops-primary" disabled={Boolean(busy) || pendingItems > 0} onClick={() => void action("complete", { action: "complete_check", checkId: value(activeCheck, "id") })}>Complete apparatus check</button>
              </div>
            ) : (
              <form className="ops-form" onSubmit={(event) => {
                const form = new FormData(event.currentTarget);
                submit(event, "start", { action: "start_check", apparatusId: form.get("apparatusId"), shiftId: form.get("shiftId") });
              }}>
                <label>Apparatus<select name="apparatusId" required>{data.apparatus.map((item) => <option key={value(item, "id")} value={value(item, "id")}>{value(item, "name")}</option>)}</select></label>
                <label>Shift or assignment<input name="shiftId" placeholder="Optional shift identifier" /></label>
                <button className="ops-primary" disabled={Boolean(busy)}>Start check</button>
              </form>
            )}
          </section>

          <section className="ops-card">
            <header><div><span>EQUIPMENT SETUP</span><h2>Add real equipment to an apparatus compartment</h2></div><b>{data.equipment.length} items</b></header>
            {!data.compartments.length ? <div className="ops-empty"><strong>No compartments configured</strong><p>Create apparatus compartments before adding equipment.</p><button onClick={onSetup}>Manage apparatus setup</button></div> : <form className="ops-form ops-form-wide" onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              submit(event, "equipment", { action: "create_equipment", compartmentId: form.get("compartmentId"), name: form.get("name"), manufacturer: form.get("manufacturer"), model: form.get("model"), serialNumber: form.get("serialNumber"), barcode: form.get("barcode"), quantityRequired: form.get("quantityRequired") });
            }}>
              <label>Compartment<select name="compartmentId" required>{data.compartments.map((item) => <option key={value(item, "id")} value={value(item, "id")}>{value(item, "label")} · {value(item, "side")}</option>)}</select></label>
              <label>Equipment name<input name="name" required /></label>
              <label>Manufacturer<input name="manufacturer" /></label>
              <label>Model<input name="model" /></label>
              <label>Serial number<input name="serialNumber" /></label>
              <label>Barcode / asset tag<input name="barcode" /></label>
              <label>Required quantity<input name="quantityRequired" type="number" min="1" defaultValue="1" /></label>
              <button className="ops-primary" disabled={Boolean(busy)}>Add equipment</button>
            </form>}
          </section>
        </>
      ) : null}

      {view === "readiness" ? (
        <section className="ops-card">
          <header><div><span>OPEN READINESS EXCEPTIONS</span><h2>Missing and damaged equipment</h2></div><b>{data.exceptions.length} open</b></header>
          {data.exceptions.length ? <div className="ops-list">{data.exceptions.map((item) => <article key={value(item, "id")}><div><strong>{value(item, "equipment_name") || "Equipment issue"}</strong><small>{value(item, "apparatus_name")} · Reported {formatDate(item.opened_at)}</small></div><span className={`priority-${value(item, "priority")}`}>{value(item, "result")} · {value(item, "priority")}</span><p>{value(item, "notes")}</p></article>)}</div> : <div className="ops-empty"><strong>No open readiness exceptions</strong><p>Missing or damaged check results will appear here automatically.</p></div>}
        </section>
      ) : null}

      {view === "service" ? (
        <>
          <section className="ops-card">
            <header><div><span>NEW WORK ORDER</span><h2>Record maintenance that needs attention</h2></div></header>
            {!data.apparatus.length ? <div className="ops-empty"><strong>No apparatus added</strong><button onClick={onSetup}>Add apparatus</button></div> : <form className="ops-form ops-form-wide" onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              submit(event, "work-order", { action: "create_work_order", apparatusId: form.get("apparatusId"), priority: form.get("priority"), summary: form.get("summary"), details: form.get("details"), assignedTo: form.get("assignedTo") });
            }}>
              <label>Apparatus<select name="apparatusId" required>{data.apparatus.map((item) => <option key={value(item, "id")} value={value(item, "id")}>{value(item, "name")}</option>)}</select></label>
              <label>Priority<select name="priority"><option value="routine">Routine</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
              <label className="ops-span-2">Summary<input name="summary" required /></label>
              <label className="ops-span-2">Details<textarea name="details" rows={3} /></label>
              <label>Assigned to<input name="assignedTo" /></label>
              <button className="ops-primary" disabled={Boolean(busy)}>Open work order</button>
            </form>}
          </section>
          <section className="ops-card">
            <header><div><span>WORK ORDERS</span><h2>Maintenance history</h2></div><b>{data.workOrders.filter((item) => value(item, "status") !== "closed").length} open</b></header>
            {data.workOrders.length ? <div className="ops-list">{data.workOrders.map((item) => <article key={value(item, "id")}><div><strong>{value(item, "summary")}</strong><small>{value(item, "apparatus_name")} · Opened {formatDate(item.opened_at)}</small></div><span className={`priority-${value(item, "priority")}`}>{value(item, "priority")} · {value(item, "status")}</span>{value(item, "details") ? <p>{value(item, "details")}</p> : null}{value(item, "status") !== "closed" ? <button disabled={Boolean(busy)} onClick={() => void action(`close-${value(item, "id")}`, { action: "close_work_order", workOrderId: value(item, "id") })}>Close work order</button> : null}</article>)}</div> : <div className="ops-empty"><strong>No work orders recorded</strong><p>New work orders and closed maintenance history will appear here.</p></div>}
          </section>
        </>
      ) : null}

      {view === "stock" ? (
        <>
          <section className="ops-card">
            <header><div><span>ADD SUPPLY</span><h2>Create a real station stock record</h2></div></header>
            <form className="ops-form ops-form-wide" onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              submit(event, "stock", { action: "create_stock_item", name: form.get("name"), sku: form.get("sku"), barcode: form.get("barcode"), unit: form.get("unit"), parLevel: form.get("parLevel"), reorderPoint: form.get("reorderPoint"), quantity: form.get("quantity"), locationId: form.get("locationId") });
            }}>
              <label>Supply name<input name="name" required /></label>
              <label>Unit<input name="unit" required placeholder="each, box, roll..." /></label>
              <label>SKU<input name="sku" /></label>
              <label>Barcode<input name="barcode" /></label>
              <label>Par level<input name="parLevel" type="number" min="0" defaultValue="0" /></label>
              <label>Reorder point<input name="reorderPoint" type="number" min="0" defaultValue="0" /></label>
              <label>Starting quantity<input name="quantity" type="number" min="0" defaultValue="0" /></label>
              <label>Location<input name="locationId" defaultValue="Main station" /></label>
              <button className="ops-primary" disabled={Boolean(busy)}>Add supply</button>
            </form>
          </section>
          <section className="ops-card">
            <header><div><span>STATION STOCK</span><h2>Current quantities</h2></div><b>{stockRows.length} supplies</b></header>
            {stockRows.length ? <div className="stock-grid">{stockRows.map((item) => {
              const lot = item.lots[0];
              const belowPar = item.total <= Number(item.row.reorder_point || 0);
              return <article key={value(item.row, "id")} className={belowPar ? "stock-low" : ""}><div><strong>{value(item.row, "name")}</strong><small>{value(item.row, "sku") || "No SKU"} · {value(item.row, "unit")}</small></div><b>{item.total}</b><span>{belowPar ? "REORDER" : `PAR ${value(item.row, "par_level")}`}</span>{lot ? <div className="stock-actions"><button type="button" disabled={Boolean(busy) || Number(lot.quantity_on_hand || 0) <= 0} onClick={() => void action(`use-${value(lot, "lot_id")}`, { action: "adjust_stock", lotId: value(lot, "lot_id"), delta: -1, reason: "Used from station stock" })}>− Use 1</button><button type="button" disabled={Boolean(busy)} onClick={() => void action(`receive-${value(lot, "lot_id")}`, { action: "adjust_stock", lotId: value(lot, "lot_id"), delta: 1, reason: "Received into station stock" })}>+ Receive 1</button></div> : null}</article>;
            })}</div> : <div className="ops-empty"><strong>No stock records yet</strong><p>Add the first real supply and its current on-hand quantity.</p></div>}
          </section>
        </>
      ) : null}
    </div>
  );
}
