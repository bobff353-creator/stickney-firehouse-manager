"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type ApparatusVehicleProfile = {
  id: string;
  name: string;
  vin?: string;
  vin_decoded_json?: Record<string, unknown>;
  vin_decoded_at?: string;
  vin_source?: string;
  oil_specification?: string;
  oil_capacity?: string;
  transmission_fluid_specification?: string;
  coolant_specification?: string;
  front_tire_size?: string;
  rear_tire_size?: string;
  tire_pressure_notes?: string;
  fuel_capacity?: string;
  battery_specification?: string;
  filter_part_numbers?: string;
  maintenance_schedule?: string;
  owner_manual_url?: string;
  service_manual_url?: string;
  parts_catalog_url?: string;
  preferred_vendor?: string;
  ordering_notes?: string;
  service_profile_verified_at?: string;
};

type DecodedVin = Record<string, string> & { vin: string; sourceName: string; sourceUrl: string; decodedAt: string };

const decodedFields: Array<[keyof DecodedVin, string]> = [
  ["modelYear", "Model year"], ["make", "Make"], ["manufacturer", "Manufacturer"],
  ["model", "Model"], ["series", "Series"], ["trim", "Trim"],
  ["vehicleType", "Vehicle type"], ["bodyClass", "Body class"], ["cabType", "Cab type"],
  ["engineManufacturer", "Engine manufacturer"], ["engineModel", "Engine model"],
  ["engineConfiguration", "Engine configuration"], ["engineCylinders", "Cylinders"],
  ["displacementLiters", "Displacement"], ["fuelTypePrimary", "Fuel"], ["driveType", "Drive type"],
  ["transmissionStyle", "Transmission"], ["transmissionSpeeds", "Transmission speeds"],
  ["gvwr", "GVWR"], ["brakeSystemType", "Brake system"], ["plantCompanyName", "Plant company"],
  ["plantCity", "Plant city"], ["plantState", "Plant state"], ["plantCountry", "Plant country"],
];

function stringValue(value: unknown) { return typeof value === "string" ? value : ""; }
function normalizeVin(value: string) { return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17); }

export default function InventoryVinProfile({ apparatus, onReload, notify }: {
  apparatus: ApparatusVehicleProfile;
  onReload: () => Promise<void>;
  notify: (message: string) => void;
}) {
  const [vin, setVin] = useState(apparatus.vin || "");
  const [decoded, setDecoded] = useState<DecodedVin | null>(
    apparatus.vin_decoded_json && Object.keys(apparatus.vin_decoded_json).length
      ? apparatus.vin_decoded_json as DecodedVin : null,
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMessage, setScannerMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    setVin(apparatus.vin || "");
    setDecoded(apparatus.vin_decoded_json && Object.keys(apparatus.vin_decoded_json).length
      ? apparatus.vin_decoded_json as DecodedVin : null);
    setError("");
  }, [apparatus.id, apparatus.vin, apparatus.vin_decoded_json]);

  useEffect(() => {
    if (!scannerOpen || !videoRef.current) return;
    let cancelled = false;
    setScannerMessage("Point the rear camera at the VIN barcode on the dashboard, door label, or apparatus record.");
    void import("@zxing/browser").then(async ({ BrowserMultiFormatReader }) => {
      if (cancelled || !videoRef.current) return;
      const reader = new BrowserMultiFormatReader();
      try {
        const controls = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current,
          (result) => {
            if (!result) return;
            const scanned = normalizeVin(result.getText());
            if (scanned.length !== 17) {
              setScannerMessage(`Scanner read ${scanned.length || "no"} VIN characters. Hold steady and try again.`);
              return;
            }
            setVin(scanned);
            controlsRef.current?.stop();
            setScannerOpen(false);
            setScannerMessage("");
            notify("VIN scanned. Review it, then select Decode VIN.");
          },
        );
        if (cancelled) controls.stop(); else controlsRef.current = controls;
      } catch (caught) {
        setScannerMessage(caught instanceof Error ? `Camera could not start: ${caught.message}` : "Camera could not start. Check camera permission and try again.");
      }
    });
    return () => { cancelled = true; controlsRef.current?.stop(); controlsRef.current = null; };
  }, [scannerOpen, notify]);

  function closeScanner() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScannerOpen(false);
  }

  async function decodeVin() {
    setBusy("decode"); setError("");
    try {
      const response = await fetch("/api/vin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ vin }) });
      const result = await response.json() as { decoded?: DecodedVin; error?: string };
      if (!response.ok || !result.decoded) throw new Error(result.error || "The VIN could not be decoded.");
      setVin(result.decoded.vin);
      setDecoded(result.decoded);
      notify("Official NHTSA VIN details loaded. Review them before saving.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The VIN could not be decoded."); }
    finally { setBusy(""); }
  }

  async function saveVin() {
    setBusy("save-vin"); setError("");
    try {
      const response = await fetch("/api/digital-twin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "decode_and_save_vin", apparatusId: apparatus.id, vin }) });
      const result = await response.json() as { decoded?: DecodedVin; error?: string };
      if (!response.ok) throw new Error(result.error || "The VIN could not be saved.");
      if (result.decoded) setDecoded(result.decoded);
      await onReload();
      notify("VIN and official decoded specifications saved to this apparatus.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The VIN could not be saved."); }
    finally { setBusy(""); }
  }

  async function saveServiceProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("service"); setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch("/api/digital-twin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "update_vehicle_service_profile", apparatusId: apparatus.id, ...payload }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The service profile could not be saved.");
      await onReload();
      notify("Department-verified vehicle service profile saved.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The service profile could not be saved."); }
    finally { setBusy(""); }
  }

  return <section className="vin-profile" aria-labelledby="vin-profile-heading">
    <header><div><span>VIN &amp; VEHICLE SPECIFICATIONS</span><h4 id="vin-profile-heading">Decode the chassis, then verify service information</h4></div><b>{apparatus.vin_decoded_at ? "VIN SAVED" : "VIN NOT DECODED"}</b></header>
    <p className="vin-truth-note"><strong>Official VIN facts:</strong> NHTSA can identify the chassis, engine, transmission, weight class, fuel and manufacturing data. <strong>Department verified:</strong> oil, tire, maintenance, manual, catalog and ordering details below must be confirmed from the apparatus label, manual or vendor.</p>
    {error ? <div className="vin-error" role="alert">{error}</div> : null}
    <div className="vin-entry-row">
      <label>17-character VIN<input value={vin} onChange={(event) => setVin(normalizeVin(event.target.value))} inputMode="text" autoCapitalize="characters" autoComplete="off" placeholder="Scan or type VIN" maxLength={17} /><small>{vin.length}/17 characters</small></label>
      <button type="button" className="secondary" onClick={() => setScannerOpen(true)}>Scan VIN</button>
      <button type="button" className="primary" disabled={busy === "decode" || vin.length !== 17} onClick={() => void decodeVin()}>{busy === "decode" ? "Decoding…" : "Decode VIN"}</button>
    </div>
    {scannerOpen ? <div className="vin-scanner" role="dialog" aria-modal="true" aria-label="Scan apparatus VIN"><video ref={videoRef} autoPlay muted playsInline /><p>{scannerMessage}</p><button type="button" onClick={closeScanner}>Cancel scanner</button></div> : null}
    {decoded ? <div className="vin-results">
      <header><div><strong>{decoded.modelYear} {decoded.make || decoded.manufacturer} {decoded.model}</strong><small>Source: <a href={decoded.sourceUrl || "https://vpic.nhtsa.dot.gov/decoder/"} target="_blank" rel="noreferrer">NHTSA vPIC</a>. Missing values mean not reported, not necessarily absent.</small></div><button type="button" className="primary" disabled={busy === "save-vin"} onClick={() => void saveVin()}>{busy === "save-vin" ? "Saving…" : "Save decoded specifications"}</button></header>
      <dl>{decodedFields.filter(([key]) => stringValue(decoded[key])).map(([key, label]) => <div key={String(key)}><dt>{label}</dt><dd>{stringValue(decoded[key])}{key === "displacementLiters" ? " L" : ""}</dd></div>)}</dl>
      {decoded.decodeMessage ? <p className="vin-decode-message">Decoder note: {decoded.decodeMessage}</p> : null}
    </div> : null}
    <form className="service-profile-form" onSubmit={saveServiceProfile} key={`${apparatus.id}-${apparatus.service_profile_verified_at || "new"}`}>
      <fieldset><legend>Fluids, tires &amp; service parts</legend><div className="service-fields">
        <label>Engine oil specification<input name="oilSpecification" defaultValue={apparatus.oil_specification || ""} placeholder="Grade and manufacturer specification" /></label>
        <label>Oil capacity<input name="oilCapacity" defaultValue={apparatus.oil_capacity || ""} placeholder="Include units and filter allowance" /></label>
        <label>Transmission fluid<input name="transmissionFluidSpecification" defaultValue={apparatus.transmission_fluid_specification || ""} /></label>
        <label>Coolant specification<input name="coolantSpecification" defaultValue={apparatus.coolant_specification || ""} /></label>
        <label>Front tire size<input name="frontTireSize" defaultValue={apparatus.front_tire_size || ""} /></label>
        <label>Rear tire size<input name="rearTireSize" defaultValue={apparatus.rear_tire_size || ""} /></label>
        <label>Tire pressure / axle notes<textarea name="tirePressureNotes" defaultValue={apparatus.tire_pressure_notes || ""} /></label>
        <label>Fuel capacity<input name="fuelCapacity" defaultValue={apparatus.fuel_capacity || ""} /></label>
        <label>Battery specification<input name="batterySpecification" defaultValue={apparatus.battery_specification || ""} /></label>
        <label>Filter part numbers<textarea name="filterPartNumbers" defaultValue={apparatus.filter_part_numbers || ""} placeholder="Oil, fuel, air, transmission…" /></label>
      </div></fieldset>
      <fieldset><legend>Maintenance schedule</legend><label>Department-approved intervals<textarea name="maintenanceSchedule" defaultValue={apparatus.maintenance_schedule || ""} placeholder="Example: engine hours/miles/calendar intervals and inspection tasks" /></label></fieldset>
      <fieldset><legend>Manuals, catalogs &amp; ordering</legend><div className="service-fields">
        <label>Owner/operator manual URL<input type="url" name="ownerManualUrl" defaultValue={apparatus.owner_manual_url || ""} placeholder="https://…" /></label>
        <label>Service manual URL<input type="url" name="serviceManualUrl" defaultValue={apparatus.service_manual_url || ""} placeholder="https://…" /></label>
        <label>Parts catalog URL<input type="url" name="partsCatalogUrl" defaultValue={apparatus.parts_catalog_url || ""} placeholder="https://…" /></label>
        <label>Preferred vendor<input name="preferredVendor" defaultValue={apparatus.preferred_vendor || ""} /></label>
        <label>Ordering notes / approved equivalents<textarea name="orderingNotes" defaultValue={apparatus.ordering_notes || ""} /></label>
      </div></fieldset>
      <div className="service-save-row"><span>{apparatus.service_profile_verified_at ? `Last department verification: ${new Date(apparatus.service_profile_verified_at).toLocaleString()}` : "Not yet department verified"}</span><button className="primary" disabled={busy === "service"}>{busy === "service" ? "Saving…" : "Save & mark service details verified"}</button></div>
    </form>
  </section>;
}
