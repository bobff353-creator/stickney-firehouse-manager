"use client";

/* Authenticated inventory images must load directly so the browser sends the department session cookie. */
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { IScannerControls } from "@zxing/browser";

type OperationsView = "due" | "inventory" | "check" | "equipment" | "reports" | "readiness" | "service" | "stock" | "builder" | "legacy_check" | "legacy_service";
type Row = Record<string, string | number | string[] | null>;
type CheckCard = {
  apparatusId: string;
  name: string;
  checkType: "daily" | "weekly" | "inventory";
  active: Row | undefined;
  pending: number;
  total: number;
  configured: number;
};
type Employee = { id: string; name: string; rank?: string };
type OperationsData = {
  configured: boolean;
  apparatus: Row[];
  compartments: Row[];
  equipment: Row[];
  retiredEquipment: Row[];
  checks: Row[];
  checkItems: Row[];
  exceptions: Row[];
  workOrders: Row[];
  stock: Row[];
  restockRequests: Row[];
  locationChanges: Row[];
  viewer?: { email?: string; role?: string };
  error?: string;
};

const emptyData: OperationsData = {
  configured: false,
  apparatus: [],
  compartments: [],
  equipment: [],
  retiredEquipment: [],
  checks: [],
  checkItems: [],
  exceptions: [],
  workOrders: [],
  stock: [],
  restockRequests: [],
  locationChanges: [],
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

function isNumericReadingItem(item: Row) {
  return ["numeric", "mileage", "quantity"].includes(value(item, "response_type"))
    || /\b(mileage|odometer)\b/i.test(value(item, "equipment_name"));
}

function numericReadingLabel(item: Row) {
  const responseType = value(item, "response_type");
  if (responseType === "quantity") return "Quantity counted";
  if (responseType === "mileage") return "Current mileage / odometer";
  return "Numeric reading";
}

function numericReadingInputValue(input: Row[string]) {
  if (input === null || input === undefined || input === "") return "";
  const numeric = Number(input);
  return Number.isFinite(numeric) ? String(numeric) : "";
}

function displayNumericReading(input: Row[string]) {
  const inputValue = numericReadingInputValue(input);
  if (!inputValue) return "";
  const numeric = Number(inputValue);
  return Number.isFinite(numeric) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(numeric) : "";
}

const repairStages = [
  ["new", "New"],
  ["assigned", "Assigned"],
  ["in_repair", "In Repair"],
  ["waiting_parts", "Waiting Parts"],
  ["closed", "Completed"],
] as const;

function normalizedRepairStatus(item: Row) {
  const status = value(item, "status");
  return status === "open" ? "new" : status;
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
  initialCheckType = "",
  onOpenUnit,
  scanRequest = 0,
  canCheck = false,
  canManageRepairs = false,
  canSetup = false,
}: {
  view: OperationsView;
  onSetup: () => void;
  initialApparatusId?: string;
  initialCheckType?: "daily" | "weekly" | "inventory" | "air_pack" | "";
  onOpenUnit?: (apparatusId: string, checkType: "daily" | "weekly" | "inventory" | "air_pack") => void;
  scanRequest?: number;
  canCheck?: boolean;
  canManageRepairs?: boolean;
  canSetup?: boolean;
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
  const [inspectionMenuOpen, setInspectionMenuOpen] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [deficiencyItem, setDeficiencyItem] = useState<Row | null>(null);
  const [numericReadings, setNumericReadings] = useState<Record<string, string>>({});
  const [editingEquipment, setEditingEquipment] = useState<Row | null>(null);
  const [selectedDirectoryEquipment, setSelectedDirectoryEquipment] = useState<Row | null>(null);
  const [scannerTarget, setScannerTarget] = useState<"create" | "edit" | "search">("create");
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [equipmentRigFilter, setEquipmentRigFilter] = useState("all");
  const [equipmentSort, setEquipmentSort] = useState<"rig" | "name" | "compartment" | "status">("rig");
  const [repairEquipment, setRepairEquipment] = useState<Row | null>(null);
  const [selectedReportCheck, setSelectedReportCheck] = useState<Row | null>(null);
  const [checkReviewNotes, setCheckReviewNotes] = useState<Record<string, string>>({});
  const [checkSearch, setCheckSearch] = useState("");
  const [checkResultFilter, setCheckResultFilter] = useState<"pending" | "all" | "completed" | "failed">("pending");
  const [checkCompartmentFilter, setCheckCompartmentFilter] = useState("all");
  const [bulkPassGroup, setBulkPassGroup] = useState<{ label: string; itemIds: string[] } | null>(null);
  const [relocationItem, setRelocationItem] = useState<Row | null>(null);
  const [relocationApparatusId, setRelocationApparatusId] = useState("");
  const [relocationCompartmentId, setRelocationCompartmentId] = useState("");
  const [locationReviewNotes, setLocationReviewNotes] = useState<Record<string, string>>({});
  const equipmentFormRef = useRef<HTMLFormElement>(null);
  const equipmentEditorRef = useRef<HTMLFormElement>(null);
  const scannerVideoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const requestedCheckOpenedRef = useRef(false);
  const lastScanRequestRef = useRef(0);

  useEffect(() => {
    if (!scanRequest || scanRequest === lastScanRequestRef.current) return;
    lastScanRequestRef.current = scanRequest;
    setScannerTarget("search");
    setScannerOpen(true);
  }, [scanRequest]);

  const closeScanner = useCallback(() => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setScannerOpen(false);
    setScannerMessage("");
  }, []);

  const fillEquipmentForm = useCallback((scan: ScannedEquipment) => {
    if (scannerTarget === "search") {
      setEquipmentSearch(scan.barcode);
      return;
    }
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
            setMessage(scannerTarget === "search"
              ? "Barcode scanned. Matching department equipment is shown below."
              : scannerTarget === "edit"
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
        retiredEquipment: payload.retiredEquipment || [],
        checks: payload.checks || [],
        checkItems: payload.checkItems || [],
        exceptions: payload.exceptions || [],
        workOrders: payload.workOrders || [],
        stock: payload.stock || [],
        restockRequests: payload.restockRequests || [],
        locationChanges: payload.locationChanges || [],
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

  useEffect(() => {
    const timer = window.setTimeout(() => void (async () => {
      if (
        loading
        || requestedCheckOpenedRef.current
        || !initialCheckType
        || !selectedApparatusId
        || !data.configured
      ) return;
      requestedCheckOpenedRef.current = true;
      const existing = data.checks.find((check) => (
        value(check, "apparatus_id") === selectedApparatusId
        && value(check, "check_type") === initialCheckType
        && value(check, "status") === "in_progress"
      ));
      if (existing) {
        setSelectedCheckId(value(existing, "id"));
        setInspectionMenuOpen(false);
        setMessage(`Resumed the shared ${value(data.apparatus.find((item) => value(item, "id") === selectedApparatusId) || {}, "name")} ${initialCheckType.replace("_", " ")} inspection.`);
        return;
      }
      const configuredItems = data.equipment.filter((item) => (
        value(item, "apparatus_id") === selectedApparatusId
        && Array.isArray(item.check_types)
        && item.check_types.includes(initialCheckType)
      )).length;
      if (!configuredItems) {
        setError(`This apparatus does not have any items configured for its ${initialCheckType.replace("_", " ")} inspection.`);
        return;
      }
      setBusy(`start-${initialCheckType}-duty`);
      try {
        const response = await fetch("/api/operations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "start_check", apparatusId: selectedApparatusId, checkType: initialCheckType }),
        });
        const result = await response.json().catch(() => ({})) as { checkId?: string; error?: string };
        if (!response.ok || !result.checkId) throw new Error(result.error || "The apparatus inspection could not be opened.");
        await load();
        setSelectedCheckId(result.checkId);
        setInspectionMenuOpen(false);
        setMessage("Apparatus duty opened. Progress is shared with the crew and saves item by item.");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The apparatus inspection could not be opened.");
      } finally {
        setBusy("");
      }
    })(), 0);
    return () => window.clearTimeout(timer);
  }, [data, initialCheckType, load, loading, selectedApparatusId]);

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

  async function recordCheckItems(name: string, payload: Record<string, unknown>) {
    setBusy(name);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/operations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({})) as { checkItems?: Row[]; error?: string };
      if (!response.ok) throw new Error(result.error || "The inventory item could not be saved.");
      const savedItems = result.checkItems || [];
      const savedById = new Map(savedItems.map((item) => [value(item, "id"), item]));
      setData((current) => ({
        ...current,
        checkItems: current.checkItems.map((item) => {
          const saved = savedById.get(value(item, "id"));
          return saved ? { ...item, ...saved } : item;
        }),
      }));
      setLastSyncedAt(Date.now());
      setMessage(savedItems.length > 1 ? `${savedItems.length} inventory items passed.` : "Inventory item saved.");
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The inventory item could not be saved.");
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
  const completedItems = activeItems.length - pendingItems;
  const checkProgress = activeItems.length ? Math.round((completedItems / activeItems.length) * 100) : 0;
  const checkCompartments = [...new Set(activeItems.map((item) => value(item, "compartment_label") || "Location not assigned"))];
  const filteredActiveItems = activeItems.filter((item) => {
    const result = value(item, "result");
    const failed = ["failed", "missing", "damaged"].includes(result);
    const matchesResult = checkResultFilter === "all"
      || (checkResultFilter === "pending" && result === "pending")
      || (checkResultFilter === "failed" && failed)
      || (checkResultFilter === "completed" && result !== "pending" && !failed);
    const compartment = value(item, "compartment_label") || "Location not assigned";
    const matchesCompartment = checkCompartmentFilter === "all" || compartment === checkCompartmentFilter;
    const query = checkSearch.trim().toLowerCase();
    const matchesSearch = !query || [value(item, "equipment_name"), compartment, value(item, "source_form")]
      .some((field) => field.toLowerCase().includes(query));
    return matchesResult && matchesCompartment && matchesSearch;
  });
  const groupedActiveItems = [...filteredActiveItems.reduce((groups, item) => {
    const label = value(item, "compartment_label") || "Location not assigned";
    const group = groups.get(label) || [];
    group.push(item);
    groups.set(label, group);
    return groups;
  }, new Map<string, Row[]>())];
  const pendingLocationChanges = data.locationChanges.filter((item) => value(item, "status") === "pending");
  const pendingLocationChangeByEquipmentId = new Map(
    pendingLocationChanges.map((item) => [value(item, "equipment_id"), item]),
  );
  const openRelocation = (item: Row) => {
    const equipment = data.equipment.find((row) => value(row, "id") === value(item, "equipment_id"));
    const apparatusId = equipment ? value(equipment, "apparatus_id") : selectedApparatusId;
    const availableCompartments = data.compartments.filter((row) => value(row, "apparatus_id") === apparatusId);
    setRelocationItem(item);
    setRelocationApparatusId(apparatusId);
    setRelocationCompartmentId(equipment ? value(equipment, "compartment_id") : value(availableCompartments[0] || {}, "id"));
  };
  const renderActiveItem = (item: Row) => {
    const itemId = value(item, "id");
    const numericItem = isNumericReadingItem(item);
    const savedReading = displayNumericReading(item.numeric_reading);
    const reading = numericReadings[itemId] ?? numericReadingInputValue(item.numeric_reading);
    const compartment = value(item, "compartment_label") || "Location not assigned";
    const pendingLocationChange = pendingLocationChangeByEquipmentId.get(value(item, "equipment_id"));
    return (
      <article key={itemId} className={`check-row result-${value(item, "result")} ${numericItem ? "numeric-reading-row" : ""}`}>
        <div className="check-item-copy">
          <strong>{value(item, "equipment_name")}{Number(item.quantity_required || 1) > 1 ? ` × ${item.quantity_required}` : ""}</strong>
          <small>{compartment}</small>
          {value(item, "source_form") ? <details className="check-item-details"><summary>Details</summary><p>{value(item, "source_form")}</p></details> : null}
          {pendingLocationChange ? <small className="location-change-pending">Location change awaiting administrator review</small> : null}
        </div>
        <div className="check-result">
          <span>{numericItem && savedReading ? `${savedReading}${value(item, "response_type") === "mileage" || /\b(mileage|odometer)\b/i.test(value(item, "equipment_name")) ? " miles" : ""}` : value(item, "result").replace("_", " ")}</span>
          {value(item, "result") !== "pending" && value(item, "checked_by") ? <small>By {value(item, "checked_by")} · {formatDate(item.checked_at)}</small> : null}
        </div>
        {numericItem ? <div className="numeric-reading-entry">
          <label htmlFor={`numeric-reading-${itemId}`}>{numericReadingLabel(item)}</label>
          <div>
            <input id={`numeric-reading-${itemId}`} type="number" inputMode="decimal" min="0" step="0.1" placeholder="Enter reading" value={reading} onChange={(event) => setNumericReadings((current) => ({ ...current, [itemId]: event.target.value }))} disabled={Boolean(busy) || !canCheck} />
            <button type="button" disabled={Boolean(busy) || !canCheck || reading.trim() === "" || !Number.isFinite(Number(reading)) || Number(reading) < 0} onClick={() => void recordCheckItems(`item-${itemId}`, { action: "record_check_item", checkItemId: itemId, result: "pass", numericReading: reading })}>Save reading</button>
          </div>
        </div> : <div className="check-actions" aria-label={`Check ${value(item, "equipment_name")}`}>
          <button className="pass" disabled={Boolean(busy) || !canCheck} onClick={() => void recordCheckItems(`item-${itemId}`, { action: "record_check_item", checkItemId: itemId, result: "pass" })}>Pass</button>
          <button className="failed" disabled={Boolean(busy) || !canCheck} onClick={() => setDeficiencyItem(item)}>Issue</button>
          <button disabled={Boolean(busy) || !canCheck} onClick={() => void recordCheckItems(`item-${itemId}`, { action: "record_check_item", checkItemId: itemId, result: "not_applicable" })}>N/A</button>
          <button className="relocate" disabled={Boolean(busy) || !canCheck || Boolean(pendingLocationChange)} onClick={() => openRelocation(item)}>{pendingLocationChange ? "Move pending" : "Move"}</button>
        </div>}
      </article>
    );
  };
  const remainingForCheck = (checkId: string) => data.checkItems.filter((item) => (
    value(item, "check_id") === checkId && value(item, "result") === "pending"
  )).length;
  const selectedApparatus = data.apparatus.find((item) => value(item, "id") === selectedApparatusId);
  const selectedEquipment = data.equipment.filter((item) => value(item, "apparatus_id") === selectedApparatusId);
  const selectedCompartments = data.compartments.filter((item) => value(item, "apparatus_id") === selectedApparatusId);
  const configuredItemsFor = (checkType: string) => selectedEquipment.filter((item) => (
    Array.isArray(item.check_types) && item.check_types.includes(checkType)
  )).length;
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
  const equipmentMatches = useMemo(() => {
    const query = equipmentSearch.trim().toLowerCase();
    const apparatusName = (item: Row) => value(data.apparatus.find((row) => value(row, "id") === value(item, "apparatus_id")) || {}, "name");
    const matches = data.equipment.filter((item) => {
      const apparatus = data.apparatus.find((row) => value(row, "id") === value(item, "apparatus_id"));
      const matchesRig = equipmentRigFilter === "all" || value(item, "apparatus_id") === equipmentRigFilter;
      const matchesQuery = !query || [value(item, "name"), value(item, "manufacturer"), value(item, "model"), value(item, "serial_number"), value(item, "barcode"), value(item, "compartment_label"), value(item, "item_type"), value(item, "service_status"), apparatus ? value(apparatus, "name") : ""]
        .some((field) => field.toLowerCase().includes(query));
      return matchesRig && matchesQuery;
    });
    return [...matches].sort((left, right) => {
      const leftKey = equipmentSort === "name" ? value(left, "name")
        : equipmentSort === "compartment" ? `${apparatusName(left)} ${value(left, "compartment_label")} ${value(left, "name")}`
          : equipmentSort === "status" ? `${value(left, "service_status")} ${apparatusName(left)} ${value(left, "name")}`
            : `${apparatusName(left)} ${value(left, "compartment_label")} ${value(left, "name")}`;
      const rightKey = equipmentSort === "name" ? value(right, "name")
        : equipmentSort === "compartment" ? `${apparatusName(right)} ${value(right, "compartment_label")} ${value(right, "name")}`
          : equipmentSort === "status" ? `${value(right, "service_status")} ${apparatusName(right)} ${value(right, "name")}`
            : `${apparatusName(right)} ${value(right, "compartment_label")} ${value(right, "name")}`;
      return leftKey.localeCompare(rightKey, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [data.apparatus, data.equipment, equipmentRigFilter, equipmentSearch, equipmentSort]);
  const completedChecks = useMemo(() => data.checks.filter((check) => value(check, "status") === "completed"), [data.checks]);
  const pendingCheckReviews = useMemo(() => completedChecks.filter((check) => value(check, "review_status") === "pending"), [completedChecks]);
  const today = new Date();
  const chicagoWeekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short" }).format(today);
  const todayDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(chicagoWeekday);
  const chicagoToday = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(today);
  const dueChecks: CheckCard[] = data.apparatus.flatMap((apparatus) => {
    const apparatusId = value(apparatus, "id");
    const equipment = data.equipment.filter((item) => value(item, "apparatus_id") === apparatusId);
    const required = (["daily", ...(Number(apparatus.weekly_due_day) === todayDay ? ["weekly"] : [])] as Array<"daily" | "weekly">).filter((checkType) => equipment.some((item) => Array.isArray(item.check_types) && item.check_types.includes(checkType)));
    return required.flatMap((checkType) => {
      const completedToday = data.checks.some((check) => value(check, "apparatus_id") === apparatusId
        && value(check, "check_type") === checkType
        && value(check, "status") === "completed"
        && value(check, "review_status") !== "changes_requested"
        && value(check, "completed_at")
        && new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value(check, "completed_at"))) === chicagoToday);
      if (completedToday) return [];
      const active = data.checks.find((check) => value(check, "apparatus_id") === apparatusId && value(check, "check_type") === checkType && value(check, "status") === "in_progress");
      const checkItems = active ? data.checkItems.filter((item) => value(item, "check_id") === value(active, "id")) : [];
      const pending = checkItems.filter((item) => value(item, "result") === "pending").length;
      return [{ apparatusId, name: value(apparatus, "name"), checkType, active, pending, total: checkItems.length, configured: equipment.filter((item) => Array.isArray(item.check_types) && item.check_types.includes(checkType)).length }];
    });
  });
  const inventoryChecks: CheckCard[] = data.apparatus.flatMap((apparatus) => {
    const apparatusId = value(apparatus, "id");
    const configured = data.equipment.filter((item) => (
      value(item, "apparatus_id") === apparatusId
      && Array.isArray(item.check_types)
      && item.check_types.includes("inventory")
    )).length;
    const active = data.checks.find((check) => (
      value(check, "apparatus_id") === apparatusId
      && value(check, "check_type") === "inventory"
      && value(check, "status") === "in_progress"
    ));
    const checkItems = active ? data.checkItems.filter((item) => value(item, "check_id") === value(active, "id")) : [];
    const pending = checkItems.filter((item) => value(item, "result") === "pending").length;
    return [{ apparatusId, name: value(apparatus, "name"), checkType: "inventory" as const, active, pending, total: checkItems.length, configured }];
  });

  const renderCheckCards = (
    checks: CheckCard[],
    labelFor: (checkType: "daily" | "weekly" | "inventory") => string,
  ) => <div className="due-check-grid">{checks.map((item) => {
    const complete = item.total ? item.total - item.pending : 0;
    const percent = item.total ? Math.round((complete / item.total) * 100) : 0;
    return <article key={`${item.apparatusId}-${item.checkType}`} className={item.active ? "in-progress" : "pending"}>
      <div><span>{labelFor(item.checkType)}</span><h3>{item.name}</h3><p>{item.active ? `${item.pending} of ${item.total} items remaining. Crew progress is shared.` : `${item.configured} configured items are ready to check.`}</p></div>
      <div className="due-progress" aria-label={`${percent}% complete`}><i style={{ width: `${percent}%` }} /></div>
      <button type="button" disabled={!canCheck || (!item.active && item.configured === 0)} onClick={() => onOpenUnit?.(item.apparatusId, item.checkType)}>{item.active ? "Resume check" : item.configured ? "Start check" : "Not configured"}</button>
    </article>;
  })}</div>;

  function submit(event: FormEvent<HTMLFormElement>, name: string, payload: Record<string, unknown>) {
    event.preventDefault();
    const form = event.currentTarget;
    void action(name, payload).then((saved) => {
      if (saved) form.reset();
    });
  }

  const reportItemsFor = (check: Row) => data.checkItems.filter((item) => value(item, "check_id") === value(check, "id"));
  const reportSummaryFor = (check: Row) => {
    const items = reportItemsFor(check);
    const issues = items.filter((item) => ["failed", "missing", "damaged"].includes(value(item, "result"))).length;
    const passed = items.filter((item) => value(item, "result") === "pass").length;
    return { items, issues, passed };
  };
  const emailReport = (check: Row) => {
    const summary = reportSummaryFor(check);
    const subject = `${value(check, "apparatus_name")} ${formatStatus(check.check_type)} check report`;
    const body = [
      "Stickney Fire Department — Vehicle Checks & Inventory",
      `Report: ${value(check, "id")}`,
      `Apparatus: ${value(check, "apparatus_name")}`,
      `Check: ${formatStatus(check.check_type)}`,
      `Started: ${formatDate(check.started_at)}`,
      `Completed: ${formatDate(check.completed_at)}`,
      `Completed by: ${value(check, "started_by") || "Not recorded"}`,
      `Review: ${formatStatus(check.review_status)}`,
      `Items: ${summary.items.length} · Passed: ${summary.passed} · Issues: ${summary.issues}`,
      "",
      ...summary.items.filter((item) => value(item, "result") !== "pass").map((item) => `${value(item, "equipment_name")}: ${formatStatus(item.result)}${value(item, "notes") ? ` — ${value(item, "notes")}` : ""}`),
    ].join("\n");
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  const printReport = (check: Row) => {
    setSelectedReportCheck(check);
    window.setTimeout(() => window.print(), 80);
  };

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

      {view === "due" ? (
        <>
          <section className="ops-card due-now-card">
            <header><div><span>APPARATUS CHECKS DUE NOW</span><h2>{dueChecks.length ? `${dueChecks.length} required check${dueChecks.length === 1 ? "" : "s"}` : "All required checks are complete"}</h2></div><b>{data.checks.filter((check) => value(check, "status") === "in_progress" && value(check, "check_type") !== "inventory").length} in progress</b></header>
            {dueChecks.length ? renderCheckCards(dueChecks, (checkType) => checkType === "weekly" ? "WEEKLY · DUE TODAY" : "DAILY · DUE TODAY") : <div className="ops-empty due-clear"><strong>No required apparatus checks are waiting.</strong><p>Completed daily and scheduled weekly checks fall off this list automatically.</p></div>}
          </section>
          <section className="ops-card inventory-checks-card">
            <header><div><span>SEPARATE INVENTORY CHECKS</span><h2>Inventory by apparatus</h2></div><b>{inventoryChecks.length} apparatus</b></header>
            {inventoryChecks.length ? renderCheckCards(inventoryChecks, () => "INVENTORY CHECK") : <div className="ops-empty"><strong>No apparatus inventory checks are configured.</strong><p>An administrator can assign equipment to the Inventory check in Admin Configuration.</p></div>}
          </section>
        </>
      ) : null}

      {view === "inventory" ? (
        <section className="ops-card inventory-checks-card standalone-inventory-checks">
          <header><div><span>APPARATUS INVENTORY</span><h2>Choose the apparatus to inventory</h2></div><b>{inventoryChecks.length} apparatus</b></header>
          {inventoryChecks.length ? renderCheckCards(inventoryChecks, () => "INVENTORY CHECK") : <div className="ops-empty"><strong>No apparatus inventory checks are configured.</strong><p>An administrator can assign equipment to the Inventory check in Admin Configuration.</p></div>}
        </section>
      ) : null}

      {view === "equipment" ? (
        <section className="ops-card equipment-search-card">
          <header><div><span>EQUIPMENT DIRECTORY</span><h2>Search all apparatus and compartments</h2></div><b>{equipmentMatches.length} results</b></header>
          <div className="equipment-search-tools">
            <label className="equipment-search-query">Search equipment<input value={equipmentSearch} onChange={(event) => setEquipmentSearch(event.target.value)} placeholder="Name, barcode, serial, compartment, kit, or unit" /></label>
            <label>Apparatus<select value={equipmentRigFilter} onChange={(event) => setEquipmentRigFilter(event.target.value)}><option value="all">All apparatus</option>{data.apparatus.map((item) => <option key={value(item, "id")} value={value(item, "id")}>{value(item, "name")}</option>)}</select></label>
            <label>Sort by<select value={equipmentSort} onChange={(event) => setEquipmentSort(event.target.value as typeof equipmentSort)}><option value="rig">Rig and compartment</option><option value="name">Item name</option><option value="compartment">Compartment</option><option value="status">Service status</option></select></label>
            <button type="button" onClick={() => { setScannerTarget("search"); setScannerOpen(true); }}>Scan Barcode</button>
          </div>
          {equipmentMatches.length ? <div className="equipment-directory">{equipmentMatches.map((item) => {
            const apparatus = data.apparatus.find((row) => value(row, "id") === value(item, "apparatus_id"));
            return <button className="equipment-record-button" type="button" key={value(item, "id")} onClick={() => setSelectedDirectoryEquipment(item)} aria-label={`View ${value(item, "name")} equipment record`}><div><span className={`equipment-status status-${value(item, "service_status") || "in_service"}`}>{formatStatus(item.service_status) || "In Service"}</span><strong>{value(item, "name")}</strong><small>{apparatus ? value(apparatus, "name") : "Unknown apparatus"} · {value(item, "compartment_label") || "Location not recorded"}</small></div><dl><div><dt>Type</dt><dd>{formatStatus(item.item_type) || "Individual"}</dd></div><div><dt>Serial</dt><dd>{value(item, "serial_number") || "Not recorded"}</dd></div><div><dt>Required</dt><dd>{value(item, "quantity_required") || "1"}</dd></div></dl></button>;
          })}</div> : <div className="ops-empty"><strong>No equipment matches this search.</strong><p>Try a unit name, compartment, asset tag, barcode, or serial number.</p></div>}
          {selectedDirectoryEquipment ? (() => {
            const apparatus = data.apparatus.find((row) => value(row, "id") === value(selectedDirectoryEquipment, "apparatus_id"));
            const parent = data.equipment.find((item) => value(item, "id") === value(selectedDirectoryEquipment, "parent_equipment_id"));
            const containedItems = data.equipment.filter((item) => value(item, "parent_equipment_id") === value(selectedDirectoryEquipment, "id"));
            return <article className="equipment-record-summary" aria-label="Selected equipment record">
              <header><div><span>SELECTED EQUIPMENT</span><h3>{value(selectedDirectoryEquipment, "name")}</h3></div><button type="button" onClick={() => setSelectedDirectoryEquipment(null)}>Close</button></header>
              {value(selectedDirectoryEquipment, "photo_url") ? <img className="equipment-record-photo" src={value(selectedDirectoryEquipment, "photo_url")} alt={value(selectedDirectoryEquipment, "name")} /> : null}
              <dl>
                <div><dt>Assigned vehicle</dt><dd>{apparatus ? value(apparatus, "name") : "Not recorded"}</dd></div>
                <div><dt>Exact location</dt><dd>{value(selectedDirectoryEquipment, "compartment_label") || "Not recorded"}</dd></div>
                <div><dt>Item / grouping type</dt><dd>{formatStatus(selectedDirectoryEquipment.item_type) || "Individual"}{parent ? ` · inside ${value(parent, "name")}` : ""}</dd></div>
                <div><dt>Service status</dt><dd>{formatStatus(selectedDirectoryEquipment.service_status) || "In Service"}</dd></div>
                <div><dt>Manufacturer / model</dt><dd>{[value(selectedDirectoryEquipment, "manufacturer"), value(selectedDirectoryEquipment, "model")].filter(Boolean).join(" · ") || "Not recorded"}</dd></div>
                <div><dt>Serial number</dt><dd>{value(selectedDirectoryEquipment, "serial_number") || "Not recorded"}</dd></div>
                <div><dt>Barcode / asset tag</dt><dd>{value(selectedDirectoryEquipment, "barcode") || "Not assigned"}</dd></div>
                <div><dt>Required quantity</dt><dd>{value(selectedDirectoryEquipment, "quantity_required") || "1"}</dd></div>
                <div><dt>Required checks</dt><dd>{Array.isArray(selectedDirectoryEquipment.check_types) && selectedDirectoryEquipment.check_types.length ? selectedDirectoryEquipment.check_types.map(formatStatus).join(", ") : "Not assigned"}</dd></div>
                <div><dt>Check response</dt><dd>{formatStatus(selectedDirectoryEquipment.response_type) || "Pass Fail"}</dd></div>
                <div><dt>Purchase / in service</dt><dd>{[value(selectedDirectoryEquipment, "purchase_date"), value(selectedDirectoryEquipment, "in_service_date")].filter(Boolean).join(" · ") || "Not recorded"}</dd></div>
                <div><dt>Expiration</dt><dd>{value(selectedDirectoryEquipment, "expiration_date") || "Not tracked"}</dd></div>
                <div><dt>Contained equipment</dt><dd>{containedItems.length ? `${containedItems.length} linked item${containedItems.length === 1 ? "" : "s"}` : "None"}</dd></div>
              </dl>
              {value(selectedDirectoryEquipment, "service_notes") ? <p className="equipment-service-note">{value(selectedDirectoryEquipment, "service_notes")}</p> : null}
              <div className="equipment-record-actions">
                {canSetup ? <button className="ops-primary" type="button" onClick={() => setEditingEquipment(selectedDirectoryEquipment)}>Edit complete asset record</button> : null}
                {canManageRepairs ? <button type="button" onClick={() => setRepairEquipment(selectedDirectoryEquipment)}>Create repair ticket</button> : null}
                {canManageRepairs && value(selectedDirectoryEquipment, "service_status") !== "out_of_service" ? <button type="button" onClick={() => void action(`oos-${value(selectedDirectoryEquipment, "id")}`, { action: "set_equipment_status", equipmentId: value(selectedDirectoryEquipment, "id"), serviceStatus: "out_of_service", serviceNotes: "Placed out of service from equipment directory" }).then((saved) => { if (saved) setSelectedDirectoryEquipment(null); })}>Place out of service</button> : null}
                {canManageRepairs && value(selectedDirectoryEquipment, "service_status") === "out_of_service" ? <button type="button" onClick={() => void action(`return-${value(selectedDirectoryEquipment, "id")}`, { action: "set_equipment_status", equipmentId: value(selectedDirectoryEquipment, "id"), serviceStatus: "in_service", serviceNotes: "Returned to service from equipment directory" }).then((saved) => { if (saved) setSelectedDirectoryEquipment(null); })}>Return to service</button> : null}
              </div>
            </article>;
          })() : null}
        </section>
      ) : null}

      {view === "reports" ? (
        <div className="inventory-reports-workspace">
          {canSetup ? <section className="ops-card check-approval-card">
            <header><div><span>ADMINISTRATOR APPROVALS</span><h2>Completed checks awaiting review</h2></div><b>{pendingCheckReviews.length} pending</b></header>
            {pendingCheckReviews.length ? <div className="check-approval-list">{pendingCheckReviews.map((check) => {
              const summary = reportSummaryFor(check);
              const checkId = value(check, "id");
              return <article key={checkId}>
                <div><span>{formatStatus(check.check_type)} check</span><h3>{value(check, "apparatus_name")}</h3><small>Completed {formatDate(check.completed_at)} by {value(check, "started_by") || "department crew"}</small></div>
                <dl><div><dt>Items</dt><dd>{summary.items.length}</dd></div><div><dt>Passed</dt><dd>{summary.passed}</dd></div><div><dt>Issues</dt><dd>{summary.issues}</dd></div></dl>
                <label>Administrator review note<textarea rows={2} value={checkReviewNotes[checkId] || ""} onChange={(event) => setCheckReviewNotes((current) => ({ ...current, [checkId]: event.target.value }))} placeholder="Required when returning for correction" /></label>
                <div className="check-review-actions"><button type="button" onClick={() => setSelectedReportCheck(check)}>Review report</button><button type="button" disabled={Boolean(busy)} onClick={() => void action(`changes-${checkId}`, { action: "review_check", checkId, decision: "changes_requested", reviewNotes: checkReviewNotes[checkId] || "" })}>Request changes</button><button className="ops-primary" type="button" disabled={Boolean(busy)} onClick={() => void action(`approve-${checkId}`, { action: "review_check", checkId, decision: "approved", reviewNotes: checkReviewNotes[checkId] || "" })}>Approve check</button></div>
              </article>;
            })}</div> : <div className="ops-empty due-clear"><strong>All completed checks are reviewed.</strong><p>New daily, weekly, inventory, and air-pack checks appear here after completion.</p></div>}
          </section> : null}

          <section className="ops-card inventory-report-history">
            <header><div><span>REPORTS</span><h2>Vehicle checks and inventory history</h2></div><b>{completedChecks.length} reports</b></header>
            <p className="report-help">Every completed Daily, Weekly, Inventory, and Air Pack check creates a printable report. Email opens a prepared summary in your device&apos;s email application.</p>
            {completedChecks.length ? <div className="inventory-report-list">{completedChecks.map((check) => {
              const summary = reportSummaryFor(check);
              return <article key={value(check, "id")}>
                <div><span>{formatStatus(check.check_type)}</span><h3>{value(check, "apparatus_name")}</h3><small>{formatDate(check.completed_at)} · {summary.items.length} items · {summary.issues} issues</small></div>
                <b className={`review-${value(check, "review_status") || "pending"}`}>{formatStatus(check.review_status) || "Pending"}</b>
                <div><button type="button" onClick={() => setSelectedReportCheck(check)}>View</button><button type="button" onClick={() => printReport(check)}>Print</button><button type="button" onClick={() => emailReport(check)}>Email summary</button></div>
              </article>;
            })}</div> : <div className="ops-empty"><strong>No completed check reports yet.</strong><p>Reports appear automatically when an apparatus check is completed.</p></div>}
          </section>

          <section className="ops-card inventory-lifecycle-report">
            <header><div><span>ASSET LIFECYCLE</span><h2>Repairs and retired equipment</h2></div><b>{data.workOrders.length + data.retiredEquipment.length} records</b></header>
            <div className="lifecycle-report-grid"><article><strong>{data.workOrders.filter((item) => value(item, "status") !== "closed").length}</strong><span>Open repair tickets</span></article><article><strong>{data.workOrders.filter((item) => value(item, "status") === "closed").length}</strong><span>Completed repairs</span></article><article><strong>{data.retiredEquipment.length}</strong><span>Retired equipment records</span></article><article><strong>{data.equipment.filter((item) => value(item, "service_status") === "out_of_service").length}</strong><span>Items out of service</span></article></div>
          </section>

          {selectedReportCheck ? (() => {
            const summary = reportSummaryFor(selectedReportCheck);
            return <section className="ops-card inventory-report-detail inventory-report-print-host">
              <header><div><span>STICKNEY FIRE DEPARTMENT · CHECK REPORT</span><h2>{value(selectedReportCheck, "apparatus_name")} · {formatStatus(selectedReportCheck.check_type)}</h2></div><button type="button" onClick={() => setSelectedReportCheck(null)}>Close</button></header>
              <div className="report-metadata"><span><b>Report ID</b>{value(selectedReportCheck, "id")}</span><span><b>Started</b>{formatDate(selectedReportCheck.started_at)}</span><span><b>Completed</b>{formatDate(selectedReportCheck.completed_at)}</span><span><b>Completed by</b>{value(selectedReportCheck, "started_by") || "Not recorded"}</span><span><b>Approval</b>{formatStatus(selectedReportCheck.review_status)}</span><span><b>Reviewed by</b>{value(selectedReportCheck, "reviewed_by") || "Pending"}</span></div>
              {value(selectedReportCheck, "review_notes") ? <blockquote>{value(selectedReportCheck, "review_notes")}</blockquote> : null}
              <table><thead><tr><th>Equipment</th><th>Location</th><th>Result</th><th>Reading / notes</th><th>Checked by</th></tr></thead><tbody>{summary.items.map((item) => <tr key={value(item, "id")}><td>{value(item, "equipment_name")}</td><td>{value(item, "compartment_label")}</td><td>{formatStatus(item.result)}</td><td>{displayNumericReading(item.numeric_reading) || value(item, "notes") || "—"}</td><td>{value(item, "checked_by") || "—"}</td></tr>)}</tbody></table>
              <footer><span>{summary.items.length} items</span><span>{summary.passed} passed</span><span>{summary.issues} issues</span><span>Generated {formatDate(Date.now())}</span></footer>
              <div className="report-detail-actions"><button type="button" onClick={() => printReport(selectedReportCheck)}>Print report</button><button type="button" onClick={() => emailReport(selectedReportCheck)}>Email summary</button></div>
            </section>;
          })() : null}
        </div>
      ) : null}

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
                setInspectionMenuOpen(true);
                setCheckSearch("");
                setCheckResultFilter("pending");
                setCheckCompartmentFilter("all");
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
                  const configuredItems = configuredItemsFor(id);
                  const unavailable = !inProgress && configuredItems === 0;
                  return (
                    <button key={id} type="button" disabled={Boolean(busy) || unavailable || !canCheck} onClick={() => {
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
                      <small className="inspection-choice-action">{inProgress ? "Tap to resume" : "Tap to open"}</small>
                      <strong>{inProgress ? `Resume ${label}` : label}</strong>
                      <span>{inProgress
                        ? `${remaining} items remaining · shared crew progress`
                        : unavailable
                          ? "Not configured for this apparatus"
                          : `${configuredItems} configured items · start checklist`}</span>
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
                <small>Work one location at a time. Passed items leave the Pending view immediately; issues still require notes and a photo.</small>
              </div>
              <section className="check-progress-summary" aria-label="Inspection progress">
                <div><strong>{completedItems} of {activeItems.length} completed</strong><span>{pendingItems} remaining</span></div>
                <div className="check-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={checkProgress}><i style={{ width: `${checkProgress}%` }} /></div>
                <small>{checkProgress}% complete · your selections save immediately</small>
              </section>
              <div className="check-worklist-tools">
                <label>Find an item<input type="search" value={checkSearch} onChange={(event) => setCheckSearch(event.target.value)} placeholder="Search equipment or location" /></label>
                <label>Show<select value={checkResultFilter} onChange={(event) => setCheckResultFilter(event.target.value as typeof checkResultFilter)}><option value="pending">Pending</option><option value="all">All items</option><option value="completed">Completed</option><option value="failed">Issues</option></select></label>
                <label>Location<select value={checkCompartmentFilter} onChange={(event) => setCheckCompartmentFilter(event.target.value)}><option value="all">All locations</option>{checkCompartments.map((label) => <option key={label} value={label}>{label}</option>)}</select></label>
              </div>
              {groupedActiveItems.length ? groupedActiveItems.map(([label, items]) => {
                const pendingStandardItems = items.filter((item) => value(item, "result") === "pending" && !isNumericReadingItem(item));
                return (
                  <section className="check-location-group" key={label}>
                    <header>
                      <div><span>LOCATION</span><h3>{label}</h3><small>{items.length} shown</small></div>
                      {pendingStandardItems.length > 1 ? <button type="button" disabled={Boolean(busy) || !canCheck} onClick={() => setBulkPassGroup({ label, itemIds: pendingStandardItems.map((item) => value(item, "id")) })}>Pass remaining in this location</button> : null}
                    </header>
                    <div className="check-location-items">{items.map(renderActiveItem)}</div>
                  </section>
                );
              }) : <div className="ops-empty check-filter-empty"><strong>No items match these filters</strong><p>Change the search, status, or location to see more checklist items.</p><button type="button" onClick={() => { setCheckSearch(""); setCheckResultFilter("pending"); setCheckCompartmentFilter("all"); }}>Clear filters</button></div>}
              <div className="check-completion-bar">
                <div><strong>{pendingItems ? `${pendingItems} items still need a result` : "Ready for administrator review"}</strong><small>{pendingItems ? "Finish the remaining locations before completing this inspection." : "Submitting creates a printable report and sends this check to the approval queue."}</small></div>
                <button className="ops-primary" disabled={Boolean(busy) || pendingItems > 0 || !canCheck} onClick={() => void action("complete", { action: "complete_check", checkId: value(activeCheck, "id") })}>Submit {formatStatus(activeCheck.check_type)} check</button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {view === "builder" && canSetup ? (
        <>
        <section className="ops-card location-approval-card">
          <header><div><span>ADMIN · LOCATION APPROVALS</span><h2>Approve equipment moves</h2></div><b>{pendingLocationChanges.length} pending</b></header>
          {pendingLocationChanges.length ? <div className="location-approval-list">{pendingLocationChanges.map((request) => {
            const requestId = value(request, "id");
            return <article key={requestId}>
              <div className="location-change-route"><span>{value(request, "from_apparatus_name")} · {value(request, "from_compartment_label")}</span><b>→</b><span>{value(request, "proposed_apparatus_name")} · {value(request, "proposed_compartment_label")}</span></div>
              <h3>{value(request, "equipment_name")}</h3>
              <p>Requested by {value(request, "requested_by_email")} · {formatDate(request.requested_at)}</p>
              {value(request, "request_notes") ? <blockquote>{value(request, "request_notes")}</blockquote> : null}
              <label>Administrator review note<textarea rows={2} value={locationReviewNotes[requestId] || ""} onChange={(event) => setLocationReviewNotes((current) => ({ ...current, [requestId]: event.target.value }))} placeholder="Optional approval or denial note" /></label>
              <div className="location-review-actions"><button type="button" disabled={Boolean(busy)} onClick={() => void action(`deny-location-${requestId}`, { action: "review_location_change", requestId, decision: "denied", reviewNotes: locationReviewNotes[requestId] || "" })}>Deny</button><button className="ops-primary" type="button" disabled={Boolean(busy)} onClick={() => void action(`approve-location-${requestId}`, { action: "review_location_change", requestId, decision: "approved", reviewNotes: locationReviewNotes[requestId] || "" })}>Approve and move equipment</button></div>
            </article>;
          })}</div> : <div className="ops-empty due-clear"><strong>No location changes are waiting.</strong><p>Crew requests submitted during Inventory checks will appear here for approval.</p></div>}
        </section>
        <section className="ops-card">
          <header><div><span>ADMIN · CHECK PARAMETERS &amp; LOCATIONS</span><h2>Add or edit equipment, its exact location, and required checks</h2></div><b>{data.equipment.length} items</b></header>
          <label className="unit-picker">Apparatus
            <select value={selectedApparatusId} onChange={(event) => setSelectedApparatusId(event.target.value)}>
              {data.apparatus.map((item) => <option key={value(item, "id")} value={value(item, "id")}>{value(item, "name")}</option>)}
            </select>
          </label>
          {!selectedCompartments.length ? <div className="ops-empty"><strong>No compartments configured for this apparatus</strong><p>Create a compartment for {selectedApparatus ? value(selectedApparatus, "name") : "the selected apparatus"} before adding equipment.</p></div> : <form ref={equipmentFormRef} className="ops-form ops-form-wide" onSubmit={(event) => {
            const form = new FormData(event.currentTarget);
            submit(event, "equipment", { action: "create_equipment", compartmentId: form.get("compartmentId"), name: form.get("name"), manufacturer: form.get("manufacturer"), model: form.get("model"), serialNumber: form.get("serialNumber"), barcode: form.get("barcode"), quantityRequired: form.get("quantityRequired"), equipmentCategory: form.get("equipmentCategory"), checkTypes: form.getAll("checkTypes") });
          }}>
            <label>Required equipment location<select name="compartmentId" required>{selectedCompartments.map((item) => <option key={value(item, "id")} value={value(item, "id")}>{value(item, "label")} · {value(item, "side")}</option>)}</select></label>
            <label>Equipment or check item name<input name="name" required /></label>
            <label>Type<select name="equipmentCategory"><option value="vehicle">Vehicle</option><option value="air_pack">Air pack</option><option value="equipment">Equipment</option></select></label>
            <label>Manufacturer<input name="manufacturer" /></label>
            <label>Model<input name="model" /></label>
            <label>Serial number<input name="serialNumber" /></label>
            <label>Barcode / asset tag<input name="barcode" /></label>
            <label>Required quantity<input name="quantityRequired" type="number" min="1" defaultValue="1" /></label>
            <fieldset className="ops-check-grid ops-span-2"><legend>Required check parameters</legend>{inspectionTypes.map(([id, label]) => <label key={id}><input type="checkbox" name="checkTypes" value={id} defaultChecked={id === "inventory"} /> {label}</label>)}</fieldset>
            <button className="ops-scan-button" type="button" onClick={() => { setScannerTarget("create"); setScannerOpen(true); }}>Scan barcode</button>
            <button className="ops-primary" disabled={Boolean(busy)}>Add to Inventory</button>
          </form>}
        </section>
        <section className="ops-card">
          <header><div><span>CLICKABLE APPARATUS INVENTORY</span><h2>Edit items, barcodes and photographs</h2></div><b>{selectedEquipment.length} items</b></header>
          {selectedCompartments.map((section) => {
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
                {activeItems.map((item) => {
                  const itemId = value(item, "id");
                  const numericItem = isNumericReadingItem(item);
                  const savedReading = displayNumericReading(item.numeric_reading);
                  const reading = numericReadings[itemId] ?? numericReadingInputValue(item.numeric_reading);
                  return (
                  <article key={itemId} className={`check-row result-${value(item, "result")} ${numericItem ? "numeric-reading-row" : ""}`}>
                    <div><strong>{value(item, "equipment_name")}</strong><small>{value(item, "compartment_label")}</small></div>
                    <span>{numericItem && savedReading ? `${savedReading} miles` : value(item, "result").replace("_", " ")}</span>
                    {numericItem ? <div className="numeric-reading-entry"><label htmlFor={`legacy-numeric-reading-${itemId}`}>Current mileage / odometer</label><div><input id={`legacy-numeric-reading-${itemId}`} type="number" inputMode="decimal" min="0" step="0.1" placeholder="Enter mileage" value={reading} onChange={(event) => setNumericReadings((current) => ({ ...current, [itemId]: event.target.value }))} disabled={Boolean(busy)} /><button type="button" disabled={Boolean(busy) || reading.trim() === "" || !Number.isFinite(Number(reading)) || Number(reading) < 0} onClick={() => void action(`item-${itemId}`, { action: "record_check_item", checkItemId: itemId, result: "pass", numericReading: reading })}>Save mileage</button></div></div> : <div className="check-actions">
                      {(["pass", "missing", "damaged", "not_applicable"] as const).map((result) => <button key={result} disabled={Boolean(busy)} onClick={() => void action(`item-${value(item, "id")}`, { action: "record_check_item", checkItemId: value(item, "id"), result })}>{result === "not_applicable" ? "N/A" : result}</button>)}
                    </div>}
                  </article>
                )})}
                <button className="ops-primary" disabled={Boolean(busy) || pendingItems > 0} onClick={() => void action("complete", { action: "complete_check", checkId: value(activeCheck, "id") })}>Submit apparatus check for approval</button>
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
          {canManageRepairs ? <section className="ops-card">
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
          </section> : null}
          <section className="ops-card assigned-repairs">
            <header><div><span>MY ASSIGNED REPAIRS</span><h2>Repairs assigned to this employee</h2></div><b>{myOpenRepairs.length} open</b></header>
            {myOpenRepairs.length ? <div className="ops-list">{myOpenRepairs.map((item) => <article key={value(item, "id")}><div><strong>{value(item, "summary")}</strong><small>{value(item, "apparatus_name")} · Opened {formatDate(item.opened_at)}</small></div><span className={`priority-${value(item, "priority")}`}>{value(item, "priority")} · {formatStatus(normalizedRepairStatus(item))}</span><p>{value(item, "details")}</p>{canManageRepairs ? <><RepairStatusControl item={item} busy={Boolean(busy)} onUpdate={action} /><RepairCompletionForm item={item} busy={Boolean(busy)} onComplete={action} /></> : null}</article>)}</div> : <div className="ops-empty"><strong>No repairs assigned to you</strong><p>Open notices assigned to this employee will appear here and on the home page.</p></div>}
          </section>
          <section className="ops-card">
            <header><div><span>ALL REPAIR RECORDS</span><h2>Open repairs and completed history</h2></div><b>{data.workOrders.filter((item) => value(item, "status") !== "closed").length} open</b></header>
            {data.workOrders.length ? <div className="repair-board">{repairStages.map(([stage, label]) => {
              const stageItems = data.workOrders.filter((item) => normalizedRepairStatus(item) === stage);
              return <section key={stage} className={`repair-column stage-${stage}`}><header><strong>{label}</strong><span>{stageItems.length}</span></header>{stageItems.length ? stageItems.map((item) => <article key={value(item, "id")}><div><strong>{value(item, "summary")}</strong><small>{value(item, "apparatus_name")} · Opened {formatDate(item.opened_at)}</small></div><span className={`priority-${value(item, "priority")}`}>{formatStatus(item.priority)}</span>{value(item, "details") ? <p>{value(item, "details")}</p> : null}{Array.isArray(item.assigned_employee_names) && item.assigned_employee_names.length ? <small>Assigned to {item.assigned_employee_names.join(", ")}</small> : null}{stage === "closed" ? <p>Repaired {value(item, "repair_date")} · Cost ${Number(item.repair_cost || 0).toFixed(2)}{value(item, "vendor") ? ` · ${value(item, "vendor")}` : ""}<br />{value(item, "resolution_notes")}</p> : canManageRepairs ? <><RepairStatusControl item={item} busy={Boolean(busy)} onUpdate={action} /><RepairCompletionForm item={item} busy={Boolean(busy)} onComplete={action} /></> : null}</article>) : <p className="repair-column-empty">No repairs</p>}</section>;
            })}</div> : <div className="ops-empty"><strong>No repair records yet</strong><p>Failed inspections and assigned repair notices create records automatically.</p></div>}
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
          {canSetup ? <section className="ops-card">
            <header><div><span>ADD SUPPLY</span><h2>Create a real station stock record</h2></div></header>
            <form className="ops-form ops-form-wide" onSubmit={(event) => {
              const form = new FormData(event.currentTarget);
              submit(event, "stock", { action: "create_stock_item", name: form.get("name"), sku: form.get("sku"), barcode: form.get("barcode"), unit: form.get("unit"), parLevel: form.get("parLevel"), reorderPoint: form.get("reorderPoint"), quantity: form.get("quantity"), locationId: form.get("locationId"), lotNumber: form.get("lotNumber"), expiresAt: form.get("expiresAt"), expirationTracked: Boolean(form.get("expirationTracked")) });
            }}>
              <label>Supply name<input name="name" required /></label>
              <label>Unit<input name="unit" required placeholder="each, box, roll..." /></label>
              <label>SKU<input name="sku" /></label>
              <label>Barcode<input name="barcode" /></label>
              <label>Par level<input name="parLevel" type="number" min="0" defaultValue="0" /></label>
              <label>Reorder point<input name="reorderPoint" type="number" min="0" defaultValue="0" /></label>
              <label>Starting quantity<input name="quantity" type="number" min="0" defaultValue="0" /></label>
              <label>Location<input name="locationId" defaultValue="Main station" /></label>
              <label>Lot number<input name="lotNumber" /></label>
              <label>Expiration date<input name="expiresAt" type="date" /></label>
              <label className="stock-expiration-toggle"><input name="expirationTracked" type="checkbox" /> Track expiration alerts</label>
              <button className="ops-primary" disabled={Boolean(busy)}>Add supply</button>
            </form>
          </section> : null}
          <section className="ops-card">
            <header><div><span>STATION STOCK</span><h2>Current quantities</h2></div><b>{stockRows.length} supplies</b></header>
            {stockRows.length ? <div className="stock-grid">{stockRows.map((item) => {
              const lot = item.lots[0];
              const belowPar = item.total <= Number(item.row.reorder_point || 0);
              const expiration = lot && value(lot, "expires_at") ? new Date(`${value(lot, "expires_at")}T12:00:00`) : null;
              const daysToExpiration = expiration ? Math.ceil((expiration.getTime() - Date.now()) / 86_400_000) : null;
              const expirationAlert = daysToExpiration !== null && daysToExpiration <= 30;
              const openRequest = data.restockRequests.find((request) => value(request, "stock_item_id") === value(item.row, "id") && value(request, "transaction_type") !== "restock_fulfilled");
              return <article key={value(item.row, "id")} className={`${belowPar ? "stock-low" : ""} ${expirationAlert ? "stock-expiring" : ""}`}><div><strong>{value(item.row, "name")}</strong><small>{value(item.row, "sku") || "No SKU"} · {value(item.row, "unit")}</small>{lot ? <small>Lot {value(lot, "lot_number") || "not recorded"} · Expires {value(lot, "expires_at") || "not tracked"}</small> : null}</div><b>{item.total}</b><span>{expirationAlert ? daysToExpiration !== null && daysToExpiration < 0 ? "EXPIRED" : `EXPIRES IN ${daysToExpiration} DAYS` : belowPar ? "REORDER" : `PAR ${value(item.row, "par_level")}`}</span>{lot ? <div className="stock-actions"><button type="button" disabled={Boolean(busy) || Number(lot.quantity_on_hand || 0) <= 0 || !canCheck} onClick={() => void action(`use-${value(lot, "lot_id")}`, { action: "adjust_stock", lotId: value(lot, "lot_id"), delta: -1, reason: "Used from station stock" })}>− Use 1</button><button type="button" disabled={Boolean(busy) || !canCheck} onClick={() => void action(`receive-${value(lot, "lot_id")}`, { action: "adjust_stock", lotId: value(lot, "lot_id"), delta: 1, reason: "Received into station stock" })}>+ Receive 1</button></div> : null}<button type="button" className="restock-request-button" disabled={Boolean(busy) || !canCheck || Boolean(openRequest)} onClick={() => void action(`restock-${value(item.row, "id")}`, { action: "request_restock", stockItemId: value(item.row, "id"), quantity: Math.max(1, Number(item.row.par_level || 1) - item.total), reason: `Restock ${value(item.row, "name")} to par` })}>{openRequest ? formatStatus(openRequest.transaction_type) : "Request restock"}</button></article>;
            })}</div> : <div className="ops-empty"><strong>No stock records yet</strong><p>Add the first real supply and its current on-hand quantity.</p></div>}
          </section>
          {canSetup ? <section className="ops-card restock-approval-card">
            <header><div><span>RESTOCK APPROVALS</span><h2>Request to fulfillment</h2></div><b>{data.restockRequests.filter((item) => value(item, "transaction_type") !== "restock_fulfilled").length} open</b></header>
            {data.restockRequests.length ? <div className="ops-list">{data.restockRequests.map((request) => <article key={value(request, "id")}><div><strong>{value(request, "stock_item_name")}</strong><small>{value(request, "quantity")} {value(request, "unit")} requested · {formatDate(request.performed_at)}</small></div><span>{formatStatus(request.transaction_type)}</span><p>{value(request, "reason")}</p>{value(request, "transaction_type") === "restock_requested" ? <button disabled={Boolean(busy)} onClick={() => void action(`approve-${value(request, "id")}`, { action: "approve_restock", requestId: value(request, "id") })}>Approve request</button> : value(request, "transaction_type") === "restock_approved" ? <button disabled={Boolean(busy)} onClick={() => void action(`fulfill-${value(request, "id")}`, { action: "fulfill_restock", requestId: value(request, "id") })}>Mark fulfilled</button> : null}</article>)}</div> : <div className="ops-empty"><strong>No restock requests</strong><p>Crew supply requests will appear here for approval and fulfillment.</p></div>}
          </section> : null}
          <aside className="controlled-medication-note"><strong>Controlled medications</strong><p>Narcotics are intentionally excluded from ordinary stock. Custody signatures, immutable audit history, and discrepancy handling require a separate protected module.</p></aside>
        </>
      ) : null}
      {bulkPassGroup && activeCheck ? (
        <div className="camera-overlay" role="presentation">
          <section className="camera-panel bulk-pass-panel" role="dialog" aria-modal="true" aria-label="Confirm passing remaining inventory items">
            <header><div><span>CONFIRM LOCATION</span><h3>Pass {bulkPassGroup.itemIds.length} items in {bulkPassGroup.label}?</h3></div><button type="button" onClick={() => setBulkPassGroup(null)}>Cancel</button></header>
            <p>Use this only after physically checking every listed item in this location. Mileage and odometer entries are excluded and still require a number.</p>
            <div className="bulk-pass-actions"><button type="button" onClick={() => setBulkPassGroup(null)}>Go back</button><button className="ops-primary" type="button" disabled={Boolean(busy) || !canCheck} onClick={() => void recordCheckItems("bulk-pass", { action: "bulk_record_check_items", checkId: value(activeCheck, "id"), checkItemIds: bulkPassGroup.itemIds }).then((saved) => { if (saved) setBulkPassGroup(null); })}>Confirm {bulkPassGroup.itemIds.length} items passed</button></div>
          </section>
        </div>
      ) : null}
      {relocationItem && activeCheck ? (
        <div className="camera-overlay" role="presentation">
          <form className="camera-panel relocation-panel" role="dialog" aria-modal="true" aria-label="Request an equipment location change" onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void action("location-change", {
              action: "request_location_change",
              checkItemId: value(relocationItem, "id"),
              proposedApparatusId: relocationApparatusId,
              proposedCompartmentId: relocationCompartmentId,
              requestNotes: form.get("requestNotes"),
            }).then((saved) => { if (saved) setRelocationItem(null); });
          }}>
            <header><div><span>REQUEST LOCATION CHANGE</span><h3>{value(relocationItem, "equipment_name")}</h3></div><button type="button" onClick={() => setRelocationItem(null)}>Cancel</button></header>
            <p>The current apparatus is selected automatically. Choose the apparatus and one of its configured compartments; an administrator must approve the move.</p>
            <label>Destination apparatus<select value={relocationApparatusId} onChange={(event) => {
              const apparatusId = event.target.value;
              const firstCompartment = data.compartments.find((item) => value(item, "apparatus_id") === apparatusId);
              setRelocationApparatusId(apparatusId);
              setRelocationCompartmentId(firstCompartment ? value(firstCompartment, "id") : "");
            }}>{data.apparatus.map((item) => <option key={value(item, "id")} value={value(item, "id")}>{value(item, "name")}</option>)}</select></label>
            <label>Destination compartment<select value={relocationCompartmentId} onChange={(event) => setRelocationCompartmentId(event.target.value)} required><option value="" disabled>Choose a configured compartment</option>{data.compartments.filter((item) => value(item, "apparatus_id") === relocationApparatusId).map((item) => <option key={value(item, "id")} value={value(item, "id")}>{value(item, "label")} · {formatStatus(item.side)}</option>)}</select></label>
            <label>Why is this item moving?<textarea name="requestNotes" rows={3} placeholder="Optional note for the administrator" /></label>
            <button className="ops-primary" disabled={Boolean(busy) || !relocationApparatusId || !relocationCompartmentId}>Send for administrator approval</button>
          </form>
        </div>
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
                const saved = await recordCheckItems("deficiency", { action: "record_check_item", checkItemId: value(deficiencyItem, "id"), result: "failed", notes: form.get("notes"), issueCategories: form.getAll("issueCategories"), assignedEmployeeIds: employeeIds, assignedEmployeeNames: employeeNames, evidencePhotoId });
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
      {repairEquipment ? (
        <div className="camera-overlay" role="presentation">
          <form className="camera-panel equipment-repair-panel" role="dialog" aria-modal="true" aria-label="Create equipment repair ticket" onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void action(`repair-${value(repairEquipment, "id")}`, { action: "create_work_order", apparatusId: value(repairEquipment, "apparatus_id"), equipmentId: value(repairEquipment, "id"), priority: form.get("priority"), summary: form.get("summary"), details: form.get("details") }).then((saved) => { if (saved) { setRepairEquipment(null); setSelectedDirectoryEquipment(null); } });
          }}>
            <header><div><span>NEW REPAIR TICKET</span><h3>{value(repairEquipment, "name")}</h3></div><button type="button" onClick={() => setRepairEquipment(null)}>Cancel</button></header>
            <p>This item will be marked In Repair and the ticket will appear in the Repairs board.</p>
            <label>Priority<select name="priority" defaultValue="routine"><option value="routine">Routine</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
            <label>Repair summary<input name="summary" defaultValue={`Repair ${value(repairEquipment, "name")}`} required /></label>
            <label>Problem and work needed<textarea name="details" rows={5} required placeholder="Describe the problem, current condition, and required work" /></label>
            <button className="ops-primary" disabled={Boolean(busy)}>Create repair ticket</button>
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
                const saved = await action("edit-equipment", { action: "update_equipment", equipmentId: value(editingEquipment, "id"), compartmentId: form.get("compartmentId"), name: form.get("name"), manufacturer: form.get("manufacturer"), model: form.get("model"), serialNumber: form.get("serialNumber"), barcode: form.get("barcode"), quantityRequired: form.get("quantityRequired"), equipmentCategory: form.get("equipmentCategory"), checkTypes: form.getAll("checkTypes"), itemType: form.get("itemType"), parentEquipmentId: form.get("parentEquipmentId"), purchaseDate: form.get("purchaseDate"), inServiceDate: form.get("inServiceDate"), expirationDate: form.get("expirationDate"), responseType: form.get("responseType"), serviceStatus: form.get("serviceStatus"), serviceNotes: form.get("serviceNotes"), retirementReason: form.get("retirementReason") });
                if (saved && photo instanceof File && photo.size > 0) {
                  await uploadEquipmentPhoto(editingEquipment, photo);
                  await load();
                }
                if (saved) { setEditingEquipment(null); setSelectedDirectoryEquipment(null); }
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
              <label>Apparatus and compartment<select name="compartmentId" defaultValue={value(editingEquipment, "compartment_id")}>{data.apparatus.flatMap((apparatus) => data.compartments.filter((item) => value(item, "apparatus_id") === value(apparatus, "id")).map((item) => <option key={value(item, "id")} value={value(item, "id")}>{value(apparatus, "name")} · {value(item, "label")}</option>))}</select></label>
              <label>Item name<input name="name" defaultValue={value(editingEquipment, "name")} required /></label>
              <label>Type<select name="equipmentCategory" defaultValue={value(editingEquipment, "equipment_category")}><option value="vehicle">Vehicle</option><option value="air_pack">Air pack</option><option value="equipment">Equipment</option></select></label>
              <label>Item / grouping type<select name="itemType" defaultValue={value(editingEquipment, "item_type") || "individual"}><option value="individual">Individual item</option><option value="kit">Kit</option><option value="bag">Bag</option><option value="toolbox">Tool box</option><option value="container">Container</option><option value="consumable">Consumable</option></select></label>
              <label className="ops-span-2">Contained in kit, bag, or tool box<select name="parentEquipmentId" defaultValue={value(editingEquipment, "parent_equipment_id")}><option value="">Not grouped inside another item</option>{data.equipment.filter((item) => value(item, "id") !== value(editingEquipment, "id") && ["kit", "bag", "toolbox", "container"].includes(value(item, "item_type"))).map((item) => <option key={value(item, "id")} value={value(item, "id")}>{value(data.apparatus.find((apparatus) => value(apparatus, "id") === value(item, "apparatus_id")) || {}, "name")} · {value(item, "name")}</option>)}</select></label>
              <label>Required quantity<input name="quantityRequired" type="number" min="1" defaultValue={value(editingEquipment, "quantity_required")} /></label>
              <label>Manufacturer<input name="manufacturer" defaultValue={value(editingEquipment, "manufacturer")} /></label>
              <label>Model<input name="model" defaultValue={value(editingEquipment, "model")} /></label>
              <label>Serial number<input name="serialNumber" defaultValue={value(editingEquipment, "serial_number")} /></label>
              <label>Barcode / asset tag<input name="barcode" defaultValue={value(editingEquipment, "barcode")} /></label>
              <label>Purchase date<input name="purchaseDate" type="date" defaultValue={value(editingEquipment, "purchase_date")} /></label>
              <label>Placed in service<input name="inServiceDate" type="date" defaultValue={value(editingEquipment, "in_service_date")} /></label>
              <label>Expiration date<input name="expirationDate" type="date" defaultValue={value(editingEquipment, "expiration_date")} /></label>
              <label>Check response<select name="responseType" defaultValue={value(editingEquipment, "response_type") || "pass_fail"}><option value="pass_fail">Pass / fail</option><option value="quantity">Quantity count</option><option value="expiration_date">Expiration date</option><option value="numeric">Numeric reading</option><option value="mileage">Mileage / odometer</option><option value="text">Text entry</option></select></label>
              <label>Service status<select name="serviceStatus" defaultValue={value(editingEquipment, "service_status") || "in_service"}><option value="in_service">In service</option><option value="out_of_service">Out of service</option><option value="in_repair">In repair</option><option value="retired">Retired</option></select></label>
              <label>Retirement reason<input name="retirementReason" defaultValue={value(editingEquipment, "retirement_reason")} placeholder="Required when retiring equipment" /></label>
              <label className="ops-span-2">Asset and service notes<textarea name="serviceNotes" rows={3} defaultValue={value(editingEquipment, "service_notes")} placeholder="Condition, warranty, inspection interval, replacement notes, or service history" /></label>
              <fieldset className="ops-check-grid ops-span-2"><legend>Required check parameters</legend>{inspectionTypes.map(([id, label]) => <label key={id}><input type="checkbox" name="checkTypes" value={id} defaultChecked={Array.isArray(editingEquipment.check_types) && editingEquipment.check_types.includes(id)} /> {label}</label>)}</fieldset>
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

function RepairStatusControl({
  item,
  busy,
  onUpdate,
}: {
  item: Row;
  busy: boolean;
  onUpdate: (name: string, payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const status = normalizedRepairStatus(item);
  return (
    <label className="repair-status-control">Repair stage
      <select value={status} disabled={busy} onChange={(event) => void onUpdate(`status-${value(item, "id")}`, { action: "update_work_order_status", workOrderId: value(item, "id"), status: event.target.value })}>
        {repairStages.filter(([id]) => id !== "closed").map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select>
    </label>
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
