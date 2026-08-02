"use client";

/* Authenticated inventory images must load directly so the browser sends the department session cookie. */
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { IScannerControls } from "@zxing/browser";

type OperationsView = "check" | "readiness" | "service" | "stock" | "builder" | "legacy_check" | "legacy_service";
type Row = Record<string, string | number | string[] | null>;
type Employee = { id: string; name: string; rank?: string };
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
  viewer?: { email?: string; role?: string };
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

const inspectionTypes = [
  ["daily", "Daily inspection"],
  ["weekly", "Weekly inspection"],
  ["inventory", "Inventory check"],
  ["air_pack", "Air pack check"],
] as const;

const categoryOptions = [
  ["vehicle", "Vehicle"],
  ["air_pack", "Air pack"],
  ["equipment", "Equipment"],
] as const;

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

function formatStatus(input: Row[string]) {
  return value({ status: input }, "status")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Not recorded";
}

type ScannedEquipment = {
  name?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  barcode: string;
};

function parseScannedEquipment(rawValue: string): ScannedEquipment {
  const raw = rawValue.trim();
  const fields: ScannedEquipment = { barcode: raw };
  const assign = (key: string, input: unknown) => {
    if (typeof input !== "string" && typeof input !== "number") return;
    const item = String(input).trim();
    if (!item) return;
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (["name", "equipment", "product", "description"].includes(normalized)) fields.name = item;
    if (["manufacturer", "maker", "brand"].includes(normalized)) fields.manufacturer = item;
    if (["model", "modelnumber", "partnumber", "sku"].includes(normalized)) fields.model = item;
    if (["serial", "serialnumber", "sn"].includes(normalized)) fields.serialNumber = item;
    if (["barcode", "asset", "assettag", "gtin", "upc", "ean"].includes(normalized)) fields.barcode = item;
  };

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      Object.entries(parsed).forEach(([key, item]) => assign(key, item));
    }
  } catch {
    // Most barcodes are plain text, so JSON parsing is intentionally optional.
  }

  try {
    const url = new URL(raw);
    url.searchParams.forEach((item, key) => assign(key, item));
  } catch {
    // A scanned value does not need to be a URL.
  }

  raw.split(/[\n|;]/).forEach((part) => {
    const match = part.match(/^\s*([^:=]+)\s*[:=]\s*(.+)\s*$/);
    if (match) assign(match[1], match[2]);
  });

  // GS1 application identifiers: (01) GTIN and (21) serial number.
  const gtin = raw.match(/(?:^|\()01\)?(\d{14})/);
  const serial = raw.match(/(?:\u001d|\()21\)?([^\u001d(]+)/i);
  if (gtin) fields.barcode = gtin[1];
  if (serial) fields.serialNumber = serial[1].trim();
  return fields;
}

export default function InventoryOperations({
  view,
  onSetup,
  initialApparatusId = "",
}: {
  view: OperationsView;
  onSetup: () => void;
  initialApparatusId?: string;
}) {
  const [data, setData] = useState<OperationsData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [accessRequired, setAccessRequired] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMessage, setScannerMessage] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [viewerEmployeeId, setViewerEmployeeId] = useState("");
  const [selectedApparatusId, setSelectedApparatusId] = useState(initialApparatusId);
  const [selectedCheckId, setSelectedCheckId] = useState("");
  const [inspectionMenuOpen, setInspectionMenuOpen] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [deficiencyItem, setDeficiencyItem] = useState<Row | null>(null);
  const [editingEquipment, setEditingEquipment] = useState<Row | null>(null);
  const [scannerTarget, setScannerTarget] = useState<"create" | "edit">("create");
  const equipmentFormRef = useRef<HTMLFormElement>(null);
  const equipmentEditorRef = useRef<HTMLFormElement>(null);
  const scannerVideoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);

  const closeScanner = useCallback(() => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setScannerOpen(false);
    setScannerMessage("");
  }, []);

  const fillEquipmentForm = useCallback((scan: ScannedEquipment) => {
    const form = scannerTarget === "edit" ? equipmentEditorRef.current : equipmentFormRef.current;
    if (!form) return;
    const fill = (name: string, input?: string) => {
      if (!input) return;
      const element = form.elements.namedItem(name);
      if (element instanceof HTMLInputElement) {
        element.value = input;
        element.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };
    fill("name", scan.name);
    fill("manufacturer", scan.manufacturer);
    fill("model", scan.model);
    fill("serialNumber", scan.serialNumber);
    fill("barcode", scan.barcode);
  }, [scannerTarget]);

  useEffect(() => {
    if (!scannerOpen || !scannerVideoRef.current) return;
    let cancelled = false;
    setScannerMessage("Point the rear camera at the equipment barcode.");
    void import("@zxing/browser").then(async ({ BrowserMultiFormatReader }) => {
      if (cancelled || !scannerVideoRef.current) return;
      const reader = new BrowserMultiFormatReader();
      try {
        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          scannerVideoRef.current,
          (result) => {
            if (!result) return;
            fillEquipmentForm(parseScannedEquipment(result.getText()));
            setMessage(scannerTarget === "edit"
              ? "Barcode scanned. Review the item, then save changes."
              : "Barcode scanned. Review the filled equipment fields, then add the equipment.");
            closeScanner();
          },
        );
        if (cancelled) {
          controls.stop();
        } else {
          scannerControlsRef.current = controls;
        }
      } catch (caught) {
        setScannerMessage(
          caught instanceof Error
            ? `Camera could not start: ${caught.message}`
            : "Camera could not start. Check camera permission and try again.",
        );
      }
    });
    return () => {
      cancelled = true;
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;
    };
  }, [closeScanner, fillEquipmentForm, scannerOpen, scannerTarget]);

  const load = useCallback(async ({ background = false }: { background?: boolean } = {}) => {
    if (!background) setLoading(true);
    try {
      const contextPromise = background ? null : Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }),
        fetch("/api/permissions", { cache: "no-store" }),
      ]);
      const response = await fetch("/api/operations", { cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as Partial<OperationsData>;
      if (!response.ok || payload.configured !== true) {
        if (!background) setAccessRequired(response.status === 401 || response.status === 403);
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
        viewer: payload.viewer,
      });
      if (contextPromise) {
        const [dashboardResponse, permissionsResponse] = await contextPromise;
        const [dashboard, permissions] = await Promise.all([
          dashboardResponse.json().catch(() => ({})) as Promise<{ viewer?: { employeeId?: string } }>,
          permissionsResponse.json().catch(() => ({})) as Promise<{ employees?: Employee[] }>,
        ]);
        setViewerEmployeeId(dashboard.viewer?.employeeId || "");
        setEmployees(Array.isArray(permissions.employees) ? permissions.employees : []);
      }
      setSelectedApparatusId((current) => current || initialApparatusId || payload.apparatus?.[0]?.id?.toString() || "");
      setLastSyncedAt(Date.now());
      setError("");
      setAccessRequired(false);
    } catch (caught) {
      if (!background) {
        setError(caught instanceof Error ? caught.message : "Operational records are unavailable.");
      }
    } finally {
      if (!background) setLoading(false);
    }
  }, [initialApparatusId]);

  useEffect(() => {
    // Loading is intentionally kicked off once when this operational panel opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const refresh = () => void load({ background: true });
    const interval = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
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

  async function uploadEvidence(apparatusId: string, photo: File, checkItemId?: string) {
    const form = new FormData();
    form.set("apparatusId", apparatusId);
    form.set("photo", photo);
    if (checkItemId) form.set("checkItemId", checkItemId);
    const response = await fetch("/api/operations/evidence", { method: "POST", body: form });
    const payload = await response.json().catch(() => ({})) as { photo?: { id?: string }; error?: string };
    if (!response.ok || !payload.photo?.id) {
      throw new Error(payload.error || "The deficiency photo could not be saved.");
    }
    return payload.photo.id;
  }

  async function uploadEquipmentPhoto(item: Row, photo: File) {
    const form = new FormData();
    form.set("apparatusId", value(item, "apparatus_id"));
    form.set("compartmentId", value(item, "compartment_id"));
    form.set("equipmentId", value(item, "id"));
    form.set("viewKey", `interior-equipment-${value(item, "id")}`);
    form.set("viewLevel", "equipment");
    form.set("doorState", "not_applicable");
    form.set("photo", photo);
    const response = await fetch("/api/digital-twin", { method: "POST", body: form });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(payload.error || "The equipment photo could not be saved.");
  }

  const apparatusActiveChecks = data.checks.filter((check) => (
    value(check, "status") === "in_progress"
    && (!selectedApparatusId || value(check, "apparatus_id") === selectedApparatusId)
  ));
  const activeCheck = apparatusActiveChecks.find((check) => value(check, "id") === selectedCheckId)
    || apparatusActiveChecks[0];
  const activeItems = activeCheck
    ? data.checkItems.filter((item) => value(item, "check_id") === value(activeCheck, "id"))
    : [];
  const pendingItems = activeItems.filter((item) => value(item, "result") === "pending").length;
  const remainingForCheck = (checkId: string) => data.checkItems.filter((item) => (
    value(item, "check_id") === checkId && value(item, "result") === "pending"
  )).length;
  const selectedApparatus = data.apparatus.find((item) => value(item, "id") === selectedApparatusId);
  const selectedEquipment = data.equipment.filter((item) => value(item, "apparatus_id") === selectedApparatusId);
  const myOpenRepairs = data.workOrders.filter((item) => (
    value(item, "status") !== "closed"
    && Array.isArray(item.assigned_employee_ids)
    && Boolean(viewerEmployeeId)
    && item.assigned_employee_ids.includes(viewerEmployeeId)
  ));
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
        <section className="ops-card unit-inspection-hub">
          <header>
            <div><span>FLEET / APPARATUS RECORD</span><h2>{selectedApparatus ? value(selectedApparatus, "name") : "Choose an apparatus"}</h2></div>
            {activeCheck && !inspectionMenuOpen ? <b>{pendingItems} remaining</b> : null}
          </header>
          {!data.apparatus.length ? (
            <div className="ops-empty"><strong>No apparatus added</strong><p>Build the fleet before starting inspections.</p><button onClick={onSetup}>Build Fleet &amp; Inventory</button></div>
          ) : (
            <label className="unit-picker">Apparatus
              <select value={selectedApparatusId} onChange={(event) => {
                setSelectedApparatusId(event.target.value);
                setSelectedCheckId("");
                setInspectionMenuOpen(false);
              }}>
                {data.apparatus.map((item) => <option key={value(item, "id")} value={value(item, "id")}>{value(item, "name")} · Fleet: {formatStatus(item.status)}</option>)}
              </select>
            </label>
          )}
          {selectedApparatus && (inspectionMenuOpen || !activeCheck) ? (
            <div className="inspection-menu">
              <div className="inspection-menu-note" role="status">
                <strong>Choose a checklist</strong>
                <span>Inspections save item by item. You can leave, answer a call, switch sections, and resume later.</span>
              </div>
              <div className="inspection-choice-grid" aria-label="Inspection choices">
                {inspectionTypes.map(([id, label]) => {
                  const inProgress = apparatusActiveChecks.find((check) => value(check, "check_type") === id);
                  const remaining = inProgress ? remainingForCheck(value(inProgress, "id")) : 0;
                  return (
                    <button key={id} type="button" disabled={Boolean(busy)} onClick={() => {
                      if (inProgress) {
                        setSelectedCheckId(value(inProgress, "id"));
                        setInspectionMenuOpen(false);
                        return;
                      }
                      void action(`start-${id}`, { action: "start_check", apparatusId: selectedApparatusId, checkType: id }).then((saved) => {
                        if (saved) {
                          setSelectedCheckId("");
                          setInspectionMenuOpen(false);
                        }
                      });
                    }}>
                      <strong>{inProgress ? `Resume ${label}` : label}</strong>
                      <span>{inProgress ? `${remaining} items remaining · shared crew progress` : `Start ${value(selectedApparatus, "name")} checklist`}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {activeCheck && !inspectionMenuOpen ? (
            <div className="check-worklist">
              <div className="inspection-workflow-actions">
                <button type="button" onClick={() => setInspectionMenuOpen(true)}>Back to inspection types</button>
                <button type="button" disabled={Boolean(busy)} onClick={() => void load({ background: true })}>Refresh crew progress</button>
              </div>
              <div className="active-inspection-title">
                <span>{formatStatus(activeCheck.check_type)} inspection in progress</span>
                <small>Shared department inspection · updates refresh every 5 seconds{lastSyncedAt ? ` · synced ${formatDate(lastSyncedAt)}` : ""}</small>
                <small>Pass each item or select Failed to add a required note and photo. You may leave and resume at any time.</small>
              </div>
              {activeItems.map((item) => (
                <article key={value(item, "id")} className={`check-row result-${value(item, "result")}`}>
                  <div><strong>{value(item, "equipment_name")}{Number(item.quantity_required || 1) > 1 ? ` × ${item.quantity_required}` : ""}</strong><small>{value(item, "compartment_label")}{value(item, "source_form") ? ` · ${value(item, "source_form")}` : ""}</small></div>
                  <div className="check-result">
                    <span>{value(item, "result").replace("_", " ")}</span>
                    {value(item, "result") !== "pending" && value(item, "checked_by") ? <small>By {value(item, "checked_by")} · {formatDate(item.checked_at)}</small> : null}
                  </div>
                  <div className="check-actions">
                    <button disabled={Boolean(busy)} onClick={() => void action(`item-${value(item, "id")}`, { action: "record_check_item", checkItemId: value(item, "id"), result: "pass" })}>Pass</button>
                    <button className="failed" disabled={Boolean(busy)} onClick={() => setDeficiencyItem(item)}>Failed</button>
                    <button disabled={Boolean(busy)} onClick={() => void action(`item-${value(item, "id")}`, { action: "record_check_item", checkItemId: value(item, "id"), result: "not_applicable" })}>N/A</button>
                  </div>
                </article>
              ))}
              <button className="ops-primary" disabled={Boolean(busy) || pendingItems > 0} onClick={() => void action("complete", { action: "complete_check", checkId: value(activeCheck, "id") })}>Complete {formatStatus(activeCheck.check_type)} inspection</button>
            </div>
          ) : null}
        </section>
      ) : null}

      {view === "builder" ? (
        <>
        <section className="ops-card">
          <header><div><span>BUILD INVENTORY CHECKLISTS</span><h2>Add real equipment and choose its inspections</h2></div><b>{data.equipment.length} items</b></header>
          {!data.compartments.length ? <div className="ops-empty"><strong>No compartments configured</strong><p>Create apparatus compartments before adding equipment.</p></div> : <form ref={equipmentFormRef} className="ops-form ops-form-wide" onSubmit={(event) => {
            const form = new FormData(event.currentTarget);
            submit(event, "equipment", { action: "create_equipment", compartmentId: form.get("compartmentId"), name: form.get("name"), manufacturer: form.get("manufacturer"), model: form.get("model"), serialNumber: form.get("serialNumber"), barcode: form.get("barcode"), quantityRequired: form.get("quantityRequired"), equipmentCategory: form.get("equipmentCategory"), checkTypes: form.getAll("checkTypes") });
          }}>
            <label>Compartment<select name="compartmentId" required>{data.compartments.map((item) => <option key={value(item, "id")} value={value(item, "id")}>{value(item, "label")} · {value(item, "side")}</option>)}</select></label>
            <label>Equipment or check item name<input name="name" required /></label>
            <label>Type<select name="equipmentCategory"><option value="vehicle">Vehicle</option><option value="air_pack">Air pack</option><option value="equipment">Equipment</option></select></label>
            <label>Manufacturer<input name="manufacturer" /></label>
            <label>Model<input name="model" /></label>
            <label>Serial number<input name="serialNumber" /></label>
            <label>Barcode / asset tag<input name="barcode" /></label>
            <label>Required quantity<input name="quantityRequired" type="number" min="1" defaultValue="1" /></label>
            <fieldset className="ops-check-grid ops-span-2"><legend>Include in checks</legend>{inspectionTypes.map(([id, label]) => <label key={id}><input type="checkbox" name="checkTypes" value={id} defaultChecked={id === "inventory"} /> {label}</label>)}</fieldset>
            <button className="ops-scan-button" type="button" onClick={() => { setScannerTarget("create"); setScannerOpen(true); }}>Scan barcode</button>
            <button className="ops-primary" disabled={Boolean(busy)}>Add to Inventory</button>
          </form>}
        </section>
        <section className="ops-card">
          <header><div><span>CLICKABLE APPARATUS INVENTORY</span><h2>Edit items, barcodes and photographs</h2></div><b>{selectedEquipment.length} items</b></header>
          <label className="unit-picker">Apparatus
            <select value={selectedApparatusId} onChange={(event) => setSelectedApparatusId(event.target.value)}>
              {data.apparatus.map((item) => <option key={value(item, "id")} value={value(item, "id")}>{value(item, "name")}</option>)}
            </select>
          </label>
          {data.compartments.filter((section) => value(section, "apparatus_id") === selectedApparatusId).map((section) => {
            const items = selectedEquipment.filter((item) => value(item, "compartment_id") === value(section, "id"));
            if (!items.length) return null;
            return <div className="equipment-section" key={value(section, "id")}><h3>{value(section, "label")}</h3><div className="equipment-grid">{items.map((item) => <button type="button" key={value(item, "id")} onClick={() => setEditingEquipment(item)}>
              {value(item, "photo_url") ? <img src={value(item, "photo_url")} alt="" /> : <span className="equipment-photo-required">Photo Required</span>}
              <strong>{value(item, "name")}</strong><small>Qty {value(item, "quantity_required")} · {value(item, "barcode") || "Barcode not assigned"}</small>
            </button>)}</div></div>;
          })}
        </section>
        </>
      ) : null}

      {view === "legacy_check" ? (
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
                <label>Apparatus<select name="apparatusId" required>{data.apparatus.map((item) => <option key={value(item, "id")} value={value(item, "id")}>{value(item, "name")} · Fleet: {formatStatus(item.status)}</option>)}</select></label>
                <label>Shift or assignment<input name="shiftId" placeholder="Optional shift identifier" /></label>
                <button className="ops-primary" disabled={Boolean(busy)}>Start check</button>
              </form>
            )}
          </section>

          <section className="ops-card">
            <header><div><span>EQUIPMENT SETUP</span><h2>Add real equipment to an apparatus compartment</h2></div><b>{data.equipment.length} items</b></header>
            {!data.compartments.length ? <div className="ops-empty"><strong>No compartments configured</strong><p>Create apparatus compartments before adding equipment.</p><button onClick={onSetup}>Manage apparatus setup</button></div> : <form ref={equipmentFormRef} className="ops-form ops-form-wide" onSubmit={(event) => {
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
              <button className="ops-scan-button" type="button" onClick={() => setScannerOpen(true)}>
                Scan barcode
              </button>
              <button className="ops-primary" disabled={Boolean(busy)}>Add equipment</button>
            </form>}
          </section>
        </>
      ) : null}

      {view === "readiness" ? (
        <section className="ops-card">
          <header><div><span>OPEN READINESS EXCEPTIONS</span><h2>Missing and damaged equipment</h2></div><b>{data.exceptions.length} open</b></header>
          {data.exceptions.length ? <div className="ops-list">{data.exceptions.map((item) => <article key={value(item, "id")}><div><strong>{value(item, "equipment_name") || "Equipment issue"}</strong><small>{value(item, "apparatus_name")} · Fleet: {formatStatus(item.apparatus_status)} · Reported {formatDate(item.opened_at)}</small></div><span className={`priority-${value(item, "priority")}`}>{value(item, "result")} · {value(item, "priority")}</span><p>{value(item, "notes")}</p></article>)}</div> : <div className="ops-empty"><strong>No open readiness exceptions</strong><p>Missing or damaged check results will appear here automatically.</p></div>}
        </section>
      ) : null}

      {view === "service" ? (
        <>
          <section className="ops-card">
            <header><div><span>ASSIGN A REPAIR NOTICE</span><h2>Notify selected employees about a fleet deficiency</h2></div></header>
            {!data.apparatus.length ? <div className="ops-empty"><strong>No apparatus added</strong><button onClick={onSetup}>Build Fleet &amp; Inventory</button></div> : <form className="ops-form ops-form-wide" onSubmit={(event) => {
              event.preventDefault();
              const element = event.currentTarget;
              const form = new FormData(element);
              const employeeIds = form.getAll("assignedEmployeeIds").map(String);
              const employeeNames = employeeIds.map((id) => employees.find((employee) => employee.id === id)?.name || "").filter(Boolean);
              const photo = form.get("photo");
              void (async () => {
                try {
                  setBusy("notice");
                  const evidencePhotoId = photo instanceof File && photo.size > 0 ? await uploadEvidence(String(form.get("apparatusId")), photo) : "";
                  const saved = await action("notice", { action: "create_notice", apparatusId: form.get("apparatusId"), priority: form.get("priority"), notes: form.get("notes"), issueCategories: form.getAll("issueCategories"), assignedEmployeeIds: employeeIds, assignedEmployeeNames: employeeNames, evidencePhotoId });
                  if (saved) element.reset();
                } catch (caught) {
                  setError(caught instanceof Error ? caught.message : "The notice could not be saved.");
                } finally {
                  setBusy("");
                }
              })();
            }}>
              <label>Apparatus<select name="apparatusId" required>{data.apparatus.map((item) => <option key={value(item, "id")} value={value(item, "id")}>{value(item, "name")} · Fleet: {formatStatus(item.status)}</option>)}</select></label>
              <label>Priority<select name="priority"><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option><option value="routine">Routine</option></select></label>
              <fieldset className="ops-check-grid ops-span-2"><legend>Notice type</legend>{categoryOptions.map(([id, label]) => <label key={id}><input type="checkbox" name="issueCategories" value={id} /> {label}</label>)}</fieldset>
              <fieldset className="ops-check-grid ops-span-2"><legend>Employees to notify</legend>{employees.length ? employees.map((employee) => <label key={employee.id}><input type="checkbox" name="assignedEmployeeIds" value={employee.id} /> {employee.name}{employee.rank ? ` · ${employee.rank}` : ""}</label>) : <p>Employee selection is available to an authorized officer or administrator.</p>}</fieldset>
              <label className="ops-span-2">Notice / repair details<textarea name="notes" rows={4} required /></label>
              <label className="ops-span-2">Attach photo (optional)<input name="photo" type="file" accept="image/*" capture="environment" /></label>
              <button className="ops-primary" disabled={Boolean(busy)}>Assign repair notice</button>
            </form>}
          </section>
          <section className="ops-card assigned-repairs">
            <header><div><span>MY ASSIGNED REPAIRS</span><h2>Repairs assigned to this employee</h2></div><b>{myOpenRepairs.length} open</b></header>
            {myOpenRepairs.length ? <div className="ops-list">{myOpenRepairs.map((item) => <article key={value(item, "id")}><div><strong>{value(item, "summary")}</strong><small>{value(item, "apparatus_name")} · Opened {formatDate(item.opened_at)}</small></div><span className={`priority-${value(item, "priority")}`}>{value(item, "priority")}</span><p>{value(item, "details")}</p><RepairCompletionForm item={item} busy={Boolean(busy)} onComplete={action} /></article>)}</div> : <div className="ops-empty"><strong>No repairs assigned to you</strong><p>Open notices assigned to this employee will appear here and on the home page.</p></div>}
          </section>
          <section className="ops-card">
            <header><div><span>ALL REPAIR RECORDS</span><h2>Open repairs and completed history</h2></div><b>{data.workOrders.filter((item) => value(item, "status") !== "closed").length} open</b></header>
            {data.workOrders.length ? <div className="ops-list">{data.workOrders.map((item) => <article key={value(item, "id")}><div><strong>{value(item, "summary")}</strong><small>{value(item, "apparatus_name")} · Fleet: {formatStatus(item.apparatus_status)} · Opened {formatDate(item.opened_at)}</small></div><span className={`priority-${value(item, "priority")}`}>{value(item, "priority")} · {value(item, "status")}</span>{value(item, "details") ? <p>{value(item, "details")}</p> : null}{Array.isArray(item.assigned_employee_names) && item.assigned_employee_names.length ? <small>Assigned to {item.assigned_employee_names.join(", ")}</small> : null}{value(item, "status") === "closed" ? <p>Repaired {value(item, "repair_date")} · Cost ${Number(item.repair_cost || 0).toFixed(2)}{value(item, "vendor") ? ` · ${value(item, "vendor")}` : ""}<br />{value(item, "resolution_notes")}</p> : <RepairCompletionForm item={item} busy={Boolean(busy)} onComplete={action} />}</article>)}</div> : <div className="ops-empty"><strong>No repair records yet</strong><p>Failed inspections and assigned repair notices create records automatically.</p></div>}
          </section>
        </>
      ) : null}

      {view === "legacy_service" ? (
        <>
          <section className="ops-card">
            <header><div><span>NEW WORK ORDER</span><h2>Record maintenance that needs attention</h2></div></header>
            {!data.apparatus.length ? <div className="ops-empty"><strong>No apparatus added</strong><button onClick={onSetup}>Add apparatus</button></div> : <form className="ops-form ops-form-wide" onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              submit(event, "work-order", { action: "create_work_order", apparatusId: form.get("apparatusId"), priority: form.get("priority"), summary: form.get("summary"), details: form.get("details"), assignedTo: form.get("assignedTo") });
            }}>
              <label>Apparatus<select name="apparatusId" required>{data.apparatus.map((item) => <option key={value(item, "id")} value={value(item, "id")}>{value(item, "name")} · Fleet: {formatStatus(item.status)}</option>)}</select></label>
              <label>Priority<select name="priority"><option value="routine">Routine</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
              <label className="ops-span-2">Summary<input name="summary" required /></label>
              <label className="ops-span-2">Details<textarea name="details" rows={3} /></label>
              <label>Assigned to<input name="assignedTo" /></label>
              <button className="ops-primary" disabled={Boolean(busy)}>Open work order</button>
            </form>}
          </section>
          <section className="ops-card">
            <header><div><span>WORK ORDERS</span><h2>Maintenance history</h2></div><b>{data.workOrders.filter((item) => value(item, "status") !== "closed").length} open</b></header>
            {data.workOrders.length ? <div className="ops-list">{data.workOrders.map((item) => <article key={value(item, "id")}><div><strong>{value(item, "summary")}</strong><small>{value(item, "apparatus_name")} · Fleet: {formatStatus(item.apparatus_status)} · Opened {formatDate(item.opened_at)}</small></div><span className={`priority-${value(item, "priority")}`}>{value(item, "priority")} · {value(item, "status")}</span>{value(item, "details") ? <p>{value(item, "details")}</p> : null}{value(item, "status") !== "closed" ? <button disabled={Boolean(busy)} onClick={() => void action(`close-${value(item, "id")}`, { action: "close_work_order", workOrderId: value(item, "id") })}>Close work order</button> : null}</article>)}</div> : <div className="ops-empty"><strong>No work orders recorded</strong><p>New work orders and closed maintenance history will appear here.</p></div>}
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
      {deficiencyItem && activeCheck ? (
        <div className="camera-overlay" role="presentation">
          <form className="camera-panel deficiency-panel" role="dialog" aria-modal="true" aria-label="Record failed inspection item" onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const photo = form.get("photo");
            const employeeIds = form.getAll("assignedEmployeeIds").map(String);
            const employeeNames = employeeIds.map((id) => employees.find((employee) => employee.id === id)?.name || "").filter(Boolean);
            if (!(photo instanceof File) || !photo.size) {
              setError("Attach a photo of the failed item.");
              return;
            }
            void (async () => {
              try {
                setBusy("deficiency");
                const evidencePhotoId = await uploadEvidence(selectedApparatusId, photo, value(deficiencyItem, "id"));
                const saved = await action("deficiency", { action: "record_check_item", checkItemId: value(deficiencyItem, "id"), result: "failed", notes: form.get("notes"), issueCategories: form.getAll("issueCategories"), assignedEmployeeIds: employeeIds, assignedEmployeeNames: employeeNames, evidencePhotoId });
                if (saved) setDeficiencyItem(null);
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "The deficiency could not be saved.");
              } finally {
                setBusy("");
              }
            })();
          }}>
            <header><div><span>FAILED INSPECTION ITEM</span><h3>{value(deficiencyItem, "equipment_name")}</h3></div><button type="button" onClick={() => setDeficiencyItem(null)}>Cancel</button></header>
            <p>Describe what failed and attach a picture. This creates the repair notice and Live Ops equipment issue.</p>
            <fieldset className="ops-check-grid"><legend>Issue type</legend>{categoryOptions.map(([id, label]) => <label key={id}><input type="checkbox" name="issueCategories" value={id} defaultChecked={(value(activeCheck, "check_type") === "air_pack" ? id === "air_pack" : id === "equipment")} /> {label}</label>)}</fieldset>
            <label>Failure notes<textarea name="notes" rows={4} required placeholder="What failed, where it is located, and whether the unit is impaired" /></label>
            <label>Required photo<input name="photo" type="file" accept="image/*" capture="environment" required /></label>
            <fieldset className="ops-check-grid"><legend>Employees to notify</legend>{employees.length ? employees.map((employee) => <label key={employee.id}><input type="checkbox" name="assignedEmployeeIds" value={employee.id} /> {employee.name}{employee.rank ? ` · ${employee.rank}` : ""}</label>) : <p>An officer can assign this repair from the Repairs section.</p>}</fieldset>
            <button className="ops-primary" disabled={Boolean(busy)}>Save failed item and create repair</button>
          </form>
        </div>
      ) : null}
      {editingEquipment ? (
        <div className="camera-overlay" role="presentation">
          <form ref={equipmentEditorRef} className="camera-panel equipment-editor" role="dialog" aria-modal="true" aria-label="Edit inventory item" onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const photo = form.get("photo");
            void (async () => {
              try {
                setBusy("edit-equipment");
                const saved = await action("edit-equipment", { action: "update_equipment", equipmentId: value(editingEquipment, "id"), compartmentId: form.get("compartmentId"), name: form.get("name"), manufacturer: form.get("manufacturer"), model: form.get("model"), serialNumber: form.get("serialNumber"), barcode: form.get("barcode"), quantityRequired: form.get("quantityRequired"), equipmentCategory: form.get("equipmentCategory"), checkTypes: form.getAll("checkTypes") });
                if (saved && photo instanceof File && photo.size > 0) {
                  await uploadEquipmentPhoto(editingEquipment, photo);
                  await load();
                }
                if (saved) setEditingEquipment(null);
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "The equipment could not be saved.");
              } finally {
                setBusy("");
              }
            })();
          }}>
            <header><div><span>EDIT INVENTORY ITEM</span><h3>{value(editingEquipment, "name")}</h3></div><button type="button" onClick={() => setEditingEquipment(null)}>Cancel</button></header>
            {value(editingEquipment, "photo_url") ? <img className="equipment-editor-photo" src={value(editingEquipment, "photo_url")} alt={value(editingEquipment, "name")} /> : null}
            <div className="ops-form ops-form-wide">
              <label>Compartment<select name="compartmentId" defaultValue={value(editingEquipment, "compartment_id")}>{data.compartments.filter((item) => value(item, "apparatus_id") === value(editingEquipment, "apparatus_id")).map((item) => <option key={value(item, "id")} value={value(item, "id")}>{value(item, "label")}</option>)}</select></label>
              <label>Item name<input name="name" defaultValue={value(editingEquipment, "name")} required /></label>
              <label>Type<select name="equipmentCategory" defaultValue={value(editingEquipment, "equipment_category")}><option value="vehicle">Vehicle</option><option value="air_pack">Air pack</option><option value="equipment">Equipment</option></select></label>
              <label>Required quantity<input name="quantityRequired" type="number" min="1" defaultValue={value(editingEquipment, "quantity_required")} /></label>
              <label>Manufacturer<input name="manufacturer" defaultValue={value(editingEquipment, "manufacturer")} /></label>
              <label>Model<input name="model" defaultValue={value(editingEquipment, "model")} /></label>
              <label>Serial number<input name="serialNumber" defaultValue={value(editingEquipment, "serial_number")} /></label>
              <label>Barcode / asset tag<input name="barcode" defaultValue={value(editingEquipment, "barcode")} /></label>
              <fieldset className="ops-check-grid ops-span-2"><legend>Include in checks</legend>{inspectionTypes.map(([id, label]) => <label key={id}><input type="checkbox" name="checkTypes" value={id} defaultChecked={Array.isArray(editingEquipment.check_types) && editingEquipment.check_types.includes(id)} /> {label}</label>)}</fieldset>
              <label className="ops-span-2">Take or attach item photo<input name="photo" type="file" accept="image/*" capture="environment" /></label>
              <button className="ops-scan-button" type="button" onClick={() => { setScannerTarget("edit"); setScannerOpen(true); }}>Scan barcode</button>
              <button className="ops-primary" disabled={Boolean(busy)}>Save item</button>
            </div>
          </form>
        </div>
      ) : null}
      {scannerOpen ? (
        <div className="camera-overlay" role="dialog" aria-modal="true" aria-label="Equipment barcode scanner">
          <div className="camera-panel barcode-scanner-panel">
            <header>
              <div><span>LIVE BARCODE SCANNER</span><h3>Scan real equipment</h3></div>
              <button type="button" onClick={closeScanner}>Cancel</button>
            </header>
            <div className="barcode-scanner-view">
              <video ref={scannerVideoRef} autoPlay playsInline muted />
              <i aria-hidden="true" />
            </div>
            <p role="status">{scannerMessage}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RepairCompletionForm({
  item,
  busy,
  onComplete,
}: {
  item: Row;
  busy: boolean;
  onComplete: (name: string, payload: Record<string, unknown>) => Promise<boolean>;
}) {
  return (
    <form className="repair-completion-form" onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      void onComplete(`close-${value(item, "id")}`, { action: "close_work_order", workOrderId: value(item, "id"), repairDate: form.get("repairDate"), repairCost: form.get("repairCost"), vendor: form.get("vendor"), invoiceNumber: form.get("invoiceNumber"), resolutionNotes: form.get("resolutionNotes") });
    }}>
      <label>Repair date<input name="repairDate" type="date" required /></label>
      <label>Cost<input name="repairCost" type="number" min="0" step="0.01" defaultValue="0.00" required /></label>
      <label>Vendor / repaired by<input name="vendor" /></label>
      <label>Invoice / PO<input name="invoiceNumber" /></label>
      <label className="ops-span-2">Repair details<textarea name="resolutionNotes" rows={3} required /></label>
      <button disabled={busy}>Mark repaired and clear Live Ops issue</button>
    </form>
  );
}
