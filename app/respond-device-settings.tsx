"use client";

import { useEffect, useState } from "react";
import {
  APPARATUS_UNITS,
  defaultRespondDeviceSettings,
  readRespondDeviceSettings,
  RESPOND_ALERT_DURATION_SECONDS,
  type RespondDeviceMode,
  type RespondDeviceSettings,
  writeRespondDeviceSettings,
} from "./respond-device";

export default function RespondDeviceSettingsPage({ onSaved }: { onSaved: (settings: RespondDeviceSettings) => void }) {
  const [draft, setDraft] = useState<RespondDeviceSettings>(defaultRespondDeviceSettings);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setDraft(readRespondDeviceSettings(window.localStorage)), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function chooseMode(mode: RespondDeviceMode) {
    setSaved(false);
    setDraft((current) => ({ ...current, mode }));
  }

  function save() {
    const settings = writeRespondDeviceSettings(window.localStorage, draft);
    setDraft(settings);
    setSaved(true);
    onSaved(settings);
  }

  return <section className="respond-device-settings">
    <header className="standard-page-header">
      <div><span className="page-icon">R</span><div><p className="eyebrow">This browser or installed app</p><h1>Respond Device Modes</h1><p>Choose how this specific TV, iPad, laptop, or apparatus computer handles new CAD calls.</p></div></div>
    </header>

    <div className="respond-device-intro">
      <strong>No separate device account is required.</strong>
      <span>The selection is stored only on this browser. Repeat this one-time setup on each apparatus device or Operations Board TV.</span>
    </div>

    <div className="respond-mode-options" role="radiogroup" aria-label="Respond device mode">
      <button type="button" role="radio" aria-checked={draft.mode === "standard"} className={draft.mode === "standard" ? "selected" : ""} onClick={() => chooseMode("standard")}>
        <b>Standard portal</b><span>Respond remains available from the Field menu. New calls never change the page automatically.</span>
      </button>
      <button type="button" role="radio" aria-checked={draft.mode === "apparatus"} className={draft.mode === "apparatus" ? "selected" : ""} onClick={() => chooseMode("apparatus")}>
        <b>Option 1 · Apparatus Respond</b><span>Open this device on Respond and show only calls whose CAD responding-units field includes the selected rig.</span>
      </button>
      <button type="button" role="radio" aria-checked={draft.mode === "operations-alert"} className={draft.mode === "operations-alert" ? "selected" : ""} onClick={() => chooseMode("operations-alert")}>
        <b>Option 2 · Operations Alert</b><span>Only while Live Operations is already open, show a new call full-screen for {RESPOND_ALERT_DURATION_SECONDS} seconds, then return to the board.</span>
      </button>
    </div>

    <div className="respond-device-fields">
      <label><span>Device name</span><input value={draft.deviceName} onChange={(event) => { setSaved(false); setDraft((current) => ({ ...current, deviceName: event.target.value })); }} placeholder="Example: 1204 iPad or Bay TV" maxLength={60}/><small>Optional label to help identify what you configured.</small></label>
      {draft.mode === "apparatus" && <label><span>Assigned apparatus</span><input list="respond-apparatus-units" value={draft.apparatus} onChange={(event) => { setSaved(false); setDraft((current) => ({ ...current, apparatus: event.target.value })); }} placeholder="Enter the exact CAD unit ID"/><datalist id="respond-apparatus-units">{APPARATUS_UNITS.map((unit) => <option value={unit} key={unit}>Unit {unit}</option>)}</datalist><small>Choose a listed rig or enter its exact CAD unit ID.</small></label>}
    </div>

    <footer className="respond-device-actions">
      <div>{saved ? <strong>✓ Saved on this device</strong> : <span>Changes take effect after you select Save device mode.</span>}</div>
      <button type="button" className="primary-action" onClick={save}>Save device mode</button>
    </footer>

    <aside className="respond-device-safety">
      <strong>Interruption protection</strong>
      <p>Operations Alert can take over only when this device is already displaying Live Operations. It will not interrupt Scheduling, Daily Log, Payroll, Preplans, employee forms, or any other page.</p>
    </aside>
  </section>;
}
