"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Camera,
  CloudUpload,
  FileImage,
  Info,
  MapPin,
  Plus,
  Save,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  type PlanData,
  type PlanRecord,
  steps,
  blockers,
  unknowns,
  systemKeys,
  systemLabels,
  chicagoDate,
  answered,
  planSchema,
} from "../lib/preplan";
import { Choices, Field, Pill, StepHint } from "./ui";
import { request } from "../lib/client";
import { downloadJson } from "../lib/device";
export type Draft = {
  id: string;
  revision: number | null;
  data: PlanData;
  kind?: "quick" | "details" | "photos";
  section?:"outline";
};
type Props = {
  initial: Draft;
  storageKey: string;
  onSaved: (record: PlanRecord) => void;
  onClose: () => void;
  onSubmitted: (record: PlanRecord) => void;
};
const hints = [
  "Check the address on the building. Maps and GPS are optional; they never replace address confirmation.",
  "Record what you can verify. Unknown is a useful answer. Never guess a construction type or roof system.",
  "Write locations the next crew can recognize, such as “A side, left of the entrance.” Do not enter key or gate codes in notes.",
  "“No” means you verified it is absent. “Unknown” means it still needs checking. This distinction stays visible on arrival.",
  "A is the front / designated main entrance; B is the left, C the rear, D the right when facing A. Follow your department’s side convention.",
  "Review sends a working copy to the queue. Only a separate approval changes the published arrival view.",
];
export default function Editor({
  initial,
  storageKey,
  onSaved,
  onClose,
  onSubmitted,
}: Props) {
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const local = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (
        initial.kind !== "photos" &&
        local?.id === initial.id &&
        planSchema.safeParse(local.data).success
      )
        return local;
    } catch {}
    return initial;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cloudSaved, setCloudSaved] = useState(false);
  const [localStatus, setLocalStatus] = useState("");
  const [pin, setPin] = useState("");
  const [uploadSide, setUploadSide] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const [localAvailable, setLocalAvailable] = useState(true);
  function showError(message: string) {
    setError(message);
    if (message)
      requestAnimationFrame(() => {
        errorBox.current?.focus();
        errorBox.current?.scrollIntoView({
          block: "center",
          behavior: "instant",
        });
      });
  }
  const p = draft.data;
  const photosOnly = initial.kind === "photos";
  const step = photosOnly ? 4 : p.step;
  const pending = blockers(p);
  const u = unknowns(p);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
      setLocalStatus("Device draft saved");
      setLocalAvailable(true);
    } catch {
      setLocalAvailable(false);
      setLocalStatus("Device storage full — use Export draft");
    }
  }, [draft, storageKey]);
  useEffect(() => {
    if (error) {
      errorBox.current?.focus();
      errorBox.current?.scrollIntoView({
        block: "center",
        behavior: "instant",
      });
    }
  }, [error]);
  useEffect(() => {
    title.current?.focus();
    if (window.innerWidth <= 760)
      title.current
        ?.closest("header")
        ?.scrollIntoView({ block: "start", behavior: "instant" });
    else window.scrollTo({ top: 0, behavior: "instant" });
  }, [step]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!cloudSaved && !localAvailable) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [cloudSaved, localAvailable]);
  function update<K extends keyof PlanData>(key: K, value: PlanData[K]) {
    setCloudSaved(false);
    setDraft((v) => ({ ...v, data: { ...v.data, [key]: value } }));
    showError("");
  }
  async function persist(value: PlanData): Promise<PlanRecord> {
    const result = await request<{ plan: PlanRecord }>(
      draft.revision === null ? "/api/arrival/plans" : "/api/arrival/plans/" + draft.id,
      {
        method: draft.revision === null ? "POST" : "PUT",
        body: JSON.stringify({
          id: draft.id,
          revision: draft.revision,
          data: value,
        }),
      },
    );
    setDraft({
      ...draft,
      id: result.plan.id,
      revision: result.plan.revision,
      data: result.plan.working,
    });
    setCloudSaved(true);
    onSaved(result.plan);
    return result.plan;
  }
  async function save(exit = false) {
    showError("");
    setBusy(true);
    try {
      await persist(p);
      if (exit) {
        localStorage.removeItem(storageKey);
        onClose();
      }
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function recoverCloud() {
    setBusy(true);
    showError("");
    try {
      downloadJson(draft, "arrival-conflicting-device-draft.json");
      const result = await request<{ plan: PlanRecord }>(
        "/api/arrival/plans/" + draft.id,
      );
      setDraft({
        ...draft,
        id: result.plan.id,
        revision: result.plan.revision,
        data: result.plan.working,
      });
      onSaved(result.plan);
      setCloudSaved(true);
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function next() {
    const failures = pending.filter((x) => x.step === step);
    if (failures.length) {
      showError(failures.map((x) => x.text).join(" "));
      return;
    }
    setBusy(true);
    showError("");
    try {
      await persist({ ...p, step: Math.min(5, step + 1) });
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (pending.length) {
      showError("Complete the highlighted items before sending for review.");
      return;
    }
    setBusy(true);
    showError("");
    try {
      const saved = await persist(p);
      const result = await request<{ plan: PlanRecord }>(
        "/api/arrival/plans/" + saved.id + "/transition",
        {
          method: "POST",
          body: JSON.stringify({ action: "submit", revision: saved.revision }),
        },
      );
      localStorage.removeItem(storageKey);
      onSubmitted(result.plan);
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(side: string, file: File | undefined) {
    if (!file) return;
    if (side !== "Plan" && !file.type.startsWith("image/")) {
      showError(
        "Choose a JPG, PNG or WebP exterior photo. PDFs belong in Floor plans.",
      );
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showError("Choose a file under 8 MB.");
      return;
    }
    setBusy(true);
    showError("");
    setUploadSide(side);
    try {
      const saved = await persist(p);
      const form = new FormData();
      form.set("planId", saved.id);
      form.set("file", file);
      const result = await request<{
        file: {
          id: string;
          name: string;
          type: PlanData["photos"][number]["type"];
        };
      }>("/api/arrival/files", { method: "POST", body: form });
      const photo = {
        ...result.file,
        side: side as PlanData["photos"][number]["side"],
        caption: "",
      };
      const nextData = {
        ...saved.working,
        photos: [...saved.working.photos, photo],
      };
      const corrected = {
        ...nextData,
        photos:
          side === "Plan"
            ? nextData.photos
            : [...saved.working.photos.filter((x) => x.side !== side), photo],
      };
      const final = await request<{ plan: PlanRecord }>(
        "/api/arrival/plans/" + saved.id,
        {
          method: "PUT",
          body: JSON.stringify({ revision: saved.revision, data: corrected }),
        },
      );
      setDraft({
        ...draft,
        id: saved.id,
        revision: final.plan.revision,
        data: corrected,
      });
      onSaved(final.plan);
      setCloudSaved(true);
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setBusy(false);
      setUploadSide("");
    }
  }
  const setSystem = (
    key: (typeof systemKeys)[number],
    field: "answer" | "location",
    value: string,
  ) =>
    update("systems", {
      ...p.systems,
      [key]: { ...p.systems[key], [field]: value },
    });
  return (
    <div className="editor-page">
      <div className="editor-top">
        <button
          className="btn ghost"
          onClick={() => {
            if (!localAvailable && !cloudSaved) {
              showError(
                "Device storage is unavailable. Save to cloud or export this draft before exiting.",
              );
              return;
            }
            onClose();
          }}
          disabled={busy}
        >
          <ArrowLeft size={17} /> Keep draft & exit
        </button>
        <div className="save-state">
          <span className={cloudSaved ? "status-dot" : "status-dot amber"} />
          {busy
            ? "Saving…"
            : cloudSaved
              ? "Saved to cloud"
              : localStatus || "Preparing device draft"}
        </div>
        <button className="btn" disabled={busy} onClick={() => save(true)}>
          <Save size={16} /> Save & exit
        </button>
      </div>
      <div className="editor-heading">
        <div>
          <div className="eyebrow">
            {photosOnly ? "PHOTOS & PLANS" : "GUIDED FIELD VISIT"}{" "}
            <span>/</span>{" "}
            {draft.revision === null ? "NEW PREPLAN" : "WORKING COPY"}
          </div>
          <h1>{p.name || "One building. One clear plan."}</h1>
          <p>Record what you see. We’ll guide the next step.</p>
        </div>
        {!photosOnly && <Pill tone="orange">Step {step + 1} of 6</Pill>}
      </div>
      {!photosOnly && (
        <nav className="stepper" aria-label="Field visit steps">
          {steps.map((name, i) => (
            <button
              key={name}
              type="button"
              className={
                (i === step ? "active" : "") + " " + (i < step ? "done" : "")
              }
              aria-current={i === step ? "step" : undefined}
              disabled={busy}
              onClick={() => update("step", i)}
            >
              <span>
                {i < step ? (
                  <Check size={16} />
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
              </span>
              <b>{name}</b>
            </button>
          ))}
        </nav>
      )}
      <div className={"editor-layout " + (photosOnly ? "photos-only" : "")}>
        <section className="editor-card">
          <header>
            <div className="eyebrow">
              {String(step + 1).padStart(2, "0")} / {steps[step].toUpperCase()}
            </div>
            <h2 tabIndex={-1} ref={title}>
              {
                [
                  "Let’s confirm the building.",
                  "What kind of building is it?",
                  "How will the next crew get in?",
                  "What needs the crew’s attention?",
                  "Give the next crew a visual.",
                  "A final look before review.",
                ][step]
              }
            </h2>
            <p>
              {
                [
                  "Start with the address on the building. No outline or map work required.",
                  "Tap an occupancy, then record the details you know.",
                  "Use short, recognizable directions. Unknown is better than a guess.",
                  "Tap one answer for each system. Record locations when present.",
                  "Photos and a simple site sketch are optional. Missing photos remain flagged.",
                  "Check the summary. You can return to any section without losing your work.",
                ][step]
              }
            </p>
          </header>
          <fieldset
            disabled={busy}
            className="form-body"
            aria-label={steps[step]}
          >
            {step === 0 && (
              <>
                <Field
                  label="Building or business name"
                  help="Use the name crews will recognize."
                >
                  <input
                    autoComplete="organization"
                    value={p.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="e.g. Main Street Market"
                    maxLength={200}
                  />
                </Field>
                <Field label="Street address">
                  <input
                    autoComplete="street-address"
                    value={p.address}
                    onChange={(e) => {
                      update("address", e.target.value);
                      setDraft((d) => ({
                        ...d,
                        data: { ...d.data, addressConfirmed: false },
                      }));
                    }}
                    placeholder="Street number and street name"
                    maxLength={300}
                  />
                </Field>
                <div className="form-grid">
                  <Field label="City / town">
                    <input
                      autoComplete="address-level2"
                      value={p.city}
                      onChange={(e) => {
                        update("city", e.target.value);
                        setDraft((d) => ({
                          ...d,
                          data: { ...d.data, addressConfirmed: false },
                        }));
                      }}
                      placeholder="City"
                      maxLength={100}
                    />
                  </Field>
                  <Field label="State / region">
                    <input
                      autoComplete="address-level1"
                      value={p.region}
                      onChange={(e) => {
                        update("region", e.target.value);
                        setDraft((d) => ({
                          ...d,
                          data: { ...d.data, addressConfirmed: false },
                        }));
                      }}
                      placeholder="e.g. IL"
                      maxLength={50}
                    />
                  </Field>
                </div>
                <label className="check-card">
                  <input
                    type="checkbox"
                    checked={p.addressConfirmed}
                    onChange={(e) =>
                      update("addressConfirmed", e.target.checked)
                    }
                  />
                  <span>
                    <b>I checked this address against the building</b>
                    <small>
                      Confirm the building number and street. Do not rely on GPS
                      alone.
                    </small>
                  </span>
                </label>
                <Field label="Date of field visit">
                  <input
                    type="date"
                    max={chicagoDate()}
                    value={p.visited}
                    onChange={(e) => update("visited", e.target.value)}
                  />
                </Field>
                <details className="optional">
                  <summary>
                    <MapPin size={17} /> Add map coordinates{" "}
                    <span>Optional</span>
                  </summary>
                  <p>
                    Enter a verified location if you have one. Address entry
                    works without coordinates.
                  </p>
                  <div className="form-grid">
                    <Field label="Latitude">
                      <input
                        inputMode="decimal"
                        placeholder="-90 to 90"
                        value={p.latitude}
                        onChange={(e) => update("latitude", e.target.value)}
                      />
                    </Field>
                    <Field label="Longitude">
                      <input
                        inputMode="decimal"
                        placeholder="-180 to 180"
                        value={p.longitude}
                        onChange={(e) => update("longitude", e.target.value)}
                      />
                    </Field>
                  </div>
                </details>
              </>
            )}
            {step === 1 && (
              <>
                <Choices
                  label="Primary occupancy"
                  value={p.occupancy}
                  options={[
                    "Residential",
                    "Commercial",
                    "Industrial",
                    "School",
                    "Healthcare",
                    "Assembly",
                    "Mixed use",
                    "Unknown",
                  ]}
                  onChange={(v) => update("occupancy", v)}
                />
                <div className="form-grid">
                  <Field
                    label="Floors above ground"
                    help="Leave blank if unknown."
                  >
                    <input
                      type="number"
                      min="1"
                      max="200"
                      inputMode="numeric"
                      placeholder="Unknown"
                      value={p.floors}
                      onChange={(e) => update("floors", e.target.value)}
                    />
                  </Field>
                  <Field label="Construction type">
                    <select
                      value={p.construction}
                      onChange={(e) => update("construction", e.target.value)}
                    >
                      {[
                        "Unknown",
                        "Type I · Fire resistive",
                        "Type II · Noncombustible",
                        "Type III · Ordinary",
                        "Type IV · Heavy timber",
                        "Type V · Wood frame",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Choices
                  label="Is there a basement?"
                  options={["Yes", "No", "Unknown"]}
                  value={p.basement}
                  onChange={(v) =>
                    update("basement", v as PlanData["basement"])
                  }
                />
                <Field
                  label="Roof construction / features"
                  help="Only record what you can verify."
                >
                  <input
                    value={p.roof}
                    onChange={(e) => update("roof", e.target.value)}
                    maxLength={150}
                    placeholder="Unknown"
                  />
                </Field>
                <Field
                  label="Occupant / rescue considerations"
                  help="Example: sleeping rooms, mobility assistance, upper-floor classrooms. Leave blank if unknown."
                >
                  <textarea
                    rows={3}
                    value={p.lifeSafety}
                    onChange={(e) => update("lifeSafety", e.target.value)}
                    maxLength={2000}
                    placeholder="What would the next crew need to know?"
                  />
                </Field>
              </>
            )}
            {step === 2 && (
              <>
                <Field
                  label="Main entrance / A-side location"
                  help="If unverified, enter Unknown."
                >
                  <input
                    value={p.entrance}
                    onChange={(e) => update("entrance", e.target.value)}
                    maxLength={1500}
                    placeholder="e.g. Front entrance facing Main Street"
                  />
                </Field>
                <Field
                  label="Access restrictions"
                  help="Gates, narrow lanes, overhead obstructions or locked doors. Leave blank if unknown. Do not record access codes."
                >
                  <textarea
                    value={p.access}
                    onChange={(e) => update("access", e.target.value)}
                    rows={2}
                    maxLength={2000}
                    placeholder="Describe access conditions"
                  />
                </Field>
                <div className="section-rule">
                  <span>WATER SUPPLY</span>
                </div>
                <Field
                  label="Hydrant / water-source location"
                  help="Describe a verified source, or enter Unknown. A nearby hydrant does not establish available flow."
                >
                  <input
                    value={p.hydrant}
                    onChange={(e) => update("hydrant", e.target.value)}
                    placeholder="e.g. Across Main Street at the A / D corner"
                    maxLength={1500}
                  />
                </Field>
                <Choices
                  label="Water-source status at this visit"
                  value={p.hydrantStatus}
                  options={["In service", "Out of service", "Unknown"]}
                  onChange={(v) =>
                    update("hydrantStatus", v as PlanData["hydrantStatus"])
                  }
                />
                <details className="optional">
                  <summary>
                    Record a tested flow <span>Optional</span>
                  </summary>
                  <p>
                    Use a verified test result. Arrival does not calculate
                    required fire flow or combine hydrant flows.
                  </p>
                  <div className="form-grid">
                    <Field label="Tested flow (GPM)">
                      <input
                        type="number"
                        min="1"
                        value={p.flow}
                        onChange={(e) => update("flow", e.target.value)}
                        placeholder="Not entered"
                      />
                    </Field>
                    <Field label="Flow-test date">
                      <input
                        type="date"
                        max={chicagoDate()}
                        value={p.flowDate}
                        onChange={(e) => update("flowDate", e.target.value)}
                      />
                    </Field>
                  </div>
                </details>
                <div className="section-rule">
                  <span>EMERGENCY CONTACT · OPTIONAL</span>
                </div>
                <div className="form-grid">
                  <Field label="Contact name / role">
                    <input
                      value={p.contactName}
                      onChange={(e) => update("contactName", e.target.value)}
                      placeholder="e.g. Building manager"
                      maxLength={150}
                    />
                  </Field>
                  <Field label="Contact phone">
                    <input
                      type="tel"
                      value={p.contactPhone}
                      onChange={(e) => update("contactPhone", e.target.value)}
                      placeholder="Phone number"
                      maxLength={60}
                    />
                  </Field>
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <div className="system-questions">
                  {systemKeys.map((k) => (
                    <div className="system-question" key={k}>
                      <Choices
                        label={systemLabels[k]}
                        help={
                          k === "fdc"
                            ? "The exterior connection used to supply the fire protection system."
                            : k === "keybox"
                              ? "A secure box that provides authorized building access."
                              : undefined
                        }
                        value={p.systems[k].answer}
                        options={["Yes", "No", "Unknown"]}
                        onChange={(v) => setSystem(k, "answer", v)}
                      />
                      {p.systems[k].answer === "Yes" && (
                        <Field
                          label={systemLabels[k] + " location"}
                          help="Enter Unknown if the location needs checking."
                        >
                          <input
                            value={p.systems[k].location}
                            onChange={(e) =>
                              setSystem(k, "location", e.target.value)
                            }
                            maxLength={1000}
                            placeholder="Side, landmark and access details"
                          />
                        </Field>
                      )}
                    </div>
                  ))}
                </div>
                <div className="section-rule">
                  <span>HAZARDS & SPECIAL CONSIDERATIONS</span>
                </div>
                <Choices
                  label="Did you identify hazards?"
                  help="None observed is a visit observation, not proof the building is hazard-free."
                  value={p.hazardStatus}
                  options={["Present", "None observed", "Unknown"]}
                  onChange={(v) =>
                    update("hazardStatus", v as PlanData["hazardStatus"])
                  }
                />
                {(p.hazardStatus === "Present" || p.hazards.length > 0) && (
                  <div className="hazard-picks">
                    {[
                      "Lightweight truss",
                      "Solar / battery",
                      "Hazardous materials",
                      "Collapse concern",
                      "Limited access",
                      "Vacant / unsafe",
                      "Other",
                    ].map((h) => (
                      <button
                        type="button"
                        aria-pressed={p.hazards.includes(h)}
                        className={p.hazards.includes(h) ? "selected" : ""}
                        key={h}
                        onClick={() =>
                          update(
                            "hazards",
                            p.hazards.includes(h)
                              ? p.hazards.filter((v) => v !== h)
                              : [...p.hazards, h],
                          )
                        }
                      >
                        {p.hazards.includes(h) ? (
                          <Check size={15} />
                        ) : (
                          <Plus size={15} />
                        )}{" "}
                        {h}
                      </button>
                    ))}
                  </div>
                )}
                <Field
                  label="Hazard observations and locations"
                  help={
                    p.hazardStatus === "Present"
                      ? "Required when hazards are present. Record locations and what is unverified."
                      : "Optional. Record limitations or follow-up needs."
                  }
                >
                  <textarea
                    value={p.hazardNotes}
                    onChange={(e) => update("hazardNotes", e.target.value)}
                    maxLength={4000}
                    rows={3}
                    placeholder="What is the concern, and where is it?"
                  />
                </Field>
              </>
            )}
            {step === 4 && (
              <>
                <div className="photo-grid">
                  {(["A", "B", "C", "D"] as const).map((side, i) => {
                    const photo = p.photos.find((x) => x.side === side);
                    return (
                      <div className="photo-tile" key={side}>
                        <div className="photo-preview">
                          {photo ? (
                            <img
                              src={"/api/arrival/files/" + photo.id}
                              alt={side + " side exterior"}
                            />
                          ) : (
                            <Camera size={30} strokeWidth={1.4} />
                          )}
                          <span className="side-tag">{side}</span>
                        </div>
                        <div className="photo-info">
                          <b>
                            {
                              [
                                "Front / main entrance",
                                "Left side",
                                "Rear side",
                                "Right side",
                              ][i]
                            }
                          </b>
                          <small>
                            {photo
                              ? "Uploaded · " + photo.name
                              : "No photo · will remain flagged"}
                          </small>
                          <label className="btn small upload-label">
                            <CloudUpload size={15} />
                            {uploadSide === side
                              ? "Uploading…"
                              : photo
                                ? "Replace photo"
                                : "Add photo"}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              capture="environment"
                              aria-label={"Add " + side + " side photo"}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                e.target.value = "";
                                void upload(side, f);
                              }}
                              disabled={busy}
                            />
                          </label>
                          {photo && (
                            <>
                              <Field label={side + " side caption"}>
                                <input
                                  value={photo.caption}
                                  maxLength={1000}
                                  onChange={(e) =>
                                    update(
                                      "photos",
                                      p.photos.map((x) =>
                                        x.id === photo.id
                                          ? { ...x, caption: e.target.value }
                                          : x,
                                      ),
                                    )
                                  }
                                />
                              </Field>
                              <button
                                type="button"
                                className="text-button muted"
                                onClick={() =>
                                  update(
                                    "photos",
                                    p.photos.filter((x) => x.side !== side),
                                  )
                                }
                              >
                                Detach from working copy
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="field-help">
                  JPG, PNG or WebP · up to 8 MB each. The device offers camera
                  or photo-library options. Convert HEIC photos to JPG before
                  upload.
                </p>
                <details className="optional">
                  <summary>
                    <FileImage size={17} /> Add floor plans or documents{" "}
                    <span>Optional</span>
                  </summary>
                  <p>
                    Upload a PDF or image. Files stay private. PDF documents are
                    online-only.
                  </p>
                  <label className="btn upload-label">
                    <Plus size={16} /> Upload floor plan
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      aria-label="Upload floor plan"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        void upload("Plan", f);
                      }}
                      disabled={busy}
                    />
                  </label>
                  {p.photos
                    .filter((x) => x.side === "Plan")
                    .map((f) => (
                      <div className="file-row" key={f.id}>
                        <a
                          href={"/api/arrival/files/" + f.id}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {f.name}
                        </a>
                        <button
                          className="icon-button"
                          aria-label={"Detach " + f.name}
                          onClick={() =>
                            update(
                              "photos",
                              p.photos.filter((x) => x.id !== f.id),
                            )
                          }
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                </details>
                <div className="section-rule">
                  <span>RELATIVE SITE SKETCH · OPTIONAL</span>
                </div>
                <p className="field-help">
                  This is a diagram, not a geographic map. A side is at the
                  bottom. Choose a symbol, then tap its approximate location.
                  Use the location fields for directions.
                </p>
                <div className="sketch-tools">
                  {[
                    "FDC",
                    "Key box",
                    "Gas",
                    "Electrical",
                    "Hydrant",
                    "Hazard",
                  ].map((label) => (
                    <button
                      type="button"
                      className={
                        "btn small " + (pin === label ? "active-tool" : "")
                      }
                      key={label}
                      aria-pressed={pin === label}
                      onClick={() => setPin(pin === label ? "" : label)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div
                  className={"site-sketch " + (pin ? "placing" : "")}
                  role="group"
                  aria-label="Relative site sketch"
                >
                  <div className="sketch-building">
                    BUILDING<span>Not to scale</span>
                  </div>
                  <span className="sketch-side side-a">A · FRONT</span>
                  <span className="sketch-side side-b">B</span>
                  <span className="sketch-side side-c">C · REAR</span>
                  <span className="sketch-side side-d">D</span>
                  <button
                    type="button"
                    className="sketch-surface"
                    aria-label={
                      pin
                        ? "Place " + pin + " in center of sketch"
                        : "Select a symbol to add to the sketch"
                    }
                    disabled={!pin}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      update("pins", [
                        ...p.pins,
                        {
                          id: crypto.randomUUID(),
                          label: pin,
                          x:
                            e.detail === 0
                              ? 50
                              : Math.max(
                                  2,
                                  Math.min(
                                    98,
                                    ((e.clientX - rect.left) / rect.width) *
                                      100,
                                  ),
                                ),
                          y:
                            e.detail === 0
                              ? 50
                              : Math.max(
                                  2,
                                  Math.min(
                                    98,
                                    ((e.clientY - rect.top) / rect.height) *
                                      100,
                                  ),
                                ),
                        },
                      ]);
                      setPin("");
                    }}
                  />
                  <div className="sketch-pins">
                    {p.pins.map((mark) => (
                      <span
                        className={
                          "sketch-pin " +
                          (mark.label === "Hazard" ? "hazard" : "")
                        }
                        key={mark.id}
                        style={{ left: mark.x + "%", top: mark.y + "%" }}
                      >
                        {mark.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="sketch-footer">
                  <span>
                    {pin
                      ? "Tap the sketch to place " + pin
                      : "Select a symbol above to add a location."}
                  </span>
                  <button
                    type="button"
                    className="text-button"
                    disabled={!p.pins.length}
                    onClick={() => update("pins", p.pins.slice(0, -1))}
                  >
                    <Undo2 size={16} /> Undo last
                  </button>
                </div>
                {p.pins.length > 0 && (
                  <details className="optional">
                    <summary>
                      Edit symbol positions <span>Keyboard accessible</span>
                    </summary>
                    {p.pins.map((mark) => (
                      <div key={mark.id} className="pin-edit">
                        <b>{mark.label}</b>
                        <Field label={"Horizontal position of " + mark.label}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={Math.round(mark.x)}
                            onChange={(e) =>
                              update(
                                "pins",
                                p.pins.map((x) =>
                                  x.id === mark.id
                                    ? {
                                        ...x,
                                        x: Math.max(
                                          0,
                                          Math.min(100, Number(e.target.value)),
                                        ),
                                      }
                                    : x,
                                ),
                              )
                            }
                          />
                        </Field>
                        <Field label={"Vertical position of " + mark.label}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={Math.round(mark.y)}
                            onChange={(e) =>
                              update(
                                "pins",
                                p.pins.map((x) =>
                                  x.id === mark.id
                                    ? {
                                        ...x,
                                        y: Math.max(
                                          0,
                                          Math.min(100, Number(e.target.value)),
                                        ),
                                      }
                                    : x,
                                ),
                              )
                            }
                          />
                        </Field>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label={"Remove " + mark.label + " symbol"}
                          onClick={() =>
                            update(
                              "pins",
                              p.pins.filter((x) => x.id !== mark.id),
                            )
                          }
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    ))}
                  </details>
                )}
              </>
            )}
            {step === 5 && (
              <>
                <div
                  className={
                    "review-notice " + (pending.length ? "warning" : "success")
                  }
                >
                  {pending.length ? (
                    <Info size={22} />
                  ) : (
                    <CheckCircle2 size={22} />
                  )}
                  <div>
                    <b>
                      {pending.length
                        ? pending.length + " items need an answer"
                        : "Ready to send for review"}
                    </b>
                    <p>
                      {pending.length
                        ? "Tap an item below to go to the right step."
                        : "Unknown answers remain visible. Sending for review does not publish this plan."}
                    </p>
                  </div>
                </div>
                {pending.length > 0 && (
                  <div className="issue-list">
                    {pending.map((x, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => update("step", x.step)}
                      >
                        {x.text}
                        <ArrowRight size={16} />
                      </button>
                    ))}
                  </div>
                )}
                <div className="review-summary">
                  {[
                    [
                      "Location",
                      p.name +
                        " · " +
                        p.address +
                        ", " +
                        p.city +
                        " " +
                        p.region,
                      0,
                    ],
                    [
                      "Building",
                      [
                        p.occupancy || "Unknown occupancy",
                        p.floors ? p.floors + " floors" : "Unknown floors",
                        p.construction,
                      ].join(" · "),
                      1,
                    ],
                    [
                      "Access & water",
                      p.entrance || "Entrance not recorded",
                      2,
                    ],
                    [
                      "Systems & hazards",
                      systemKeys.filter((k) => p.systems[k].answer === "Yes")
                        .length +
                        " systems present · hazards " +
                        (p.hazardStatus || "unanswered"),
                      3,
                    ],
                    [
                      "Photos & sketch",
                      p.photos.filter((x) => x.side !== "Plan").length +
                        " exterior photos · " +
                        p.pins.length +
                        " sketch symbols",
                      4,
                    ],
                  ].map(([label, desc, i]) => (
                    <button
                      type="button"
                      key={String(label)}
                      onClick={() => update("step", Number(i))}
                    >
                      <div>
                        <b>{label}</b>
                        <small>{desc}</small>
                      </div>
                      <span>
                        Edit <ArrowRight size={15} />
                      </span>
                    </button>
                  ))}
                </div>
                <div className="unknown-box">
                  <b>{u.length} unknown or missing details</b>
                  <p>
                    These do not mean “not present.” Reviewers and arriving
                    crews will see them.
                  </p>
                  <div className="tags">
                    {u.map((v) => (
                      <span key={v}>{v}</span>
                    ))}
                  </div>
                </div>
                <Field
                  label="Next review date"
                  help="Optional. Set this using your department’s policy; no interval is assumed."
                >
                  <input
                    type="date"
                    min={chicagoDate()}
                    value={p.reviewDue}
                    onChange={(e) => update("reviewDue", e.target.value)}
                  />
                </Field>
                <Field label="Additional field notes">
                  <textarea
                    value={p.notes}
                    onChange={(e) => update("notes", e.target.value)}
                    maxLength={4000}
                    rows={3}
                    placeholder="Follow-up needs or other verified observations"
                  />
                </Field>
              </>
            )}
          </fieldset>
          {error && (
            <div
              role="alert"
              className="form-error"
              tabIndex={-1}
              ref={errorBox}
            >
              {error}
              <button
                className="text-button"
                onClick={() => downloadJson(draft, "arrival-device-draft.json")}
              >
                Export device draft
              </button>
              {/newer version|already exists/i.test(error) && (
                <button
                  className="btn small"
                  onClick={() => void recoverCloud()}
                  disabled={busy}
                >
                  Export device draft & open latest cloud copy
                </button>
              )}
            </div>
          )}
          <footer className="editor-footer">
            <button
              className="btn"
              disabled={busy || step === 0}
              onClick={() => update("step", Math.max(0, step - 1))}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <span>
              {step === 4
                ? "Missing photos stay marked unknown."
                : step === 5
                  ? "Review is separate from publication."
                  : "Progress is saved when you continue."}
            </span>
            {photosOnly ? (
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => void save(true)}
              >
                Save photos & done
              </button>
            ) : step < 5 ? (
              <button
                type="button"
                className="btn primary"
                disabled={busy}
                onClick={next}
              >
                {busy ? "Saving…" : "Save & continue"}
                <ArrowRight size={17} />
              </button>
            ) : (
              <button
                type="button"
                className="btn primary"
                disabled={busy || pending.length > 0}
                onClick={submit}
              >
                {busy ? "Sending…" : "Send for review"}
                <ArrowRight size={17} />
              </button>
            )}
          </footer>
        </section>
        {!photosOnly && (
          <aside className="visit-sidebar">
            <StepHint>{hints[step]}</StepHint>
            <div className="visit-progress">
              <span className="eyebrow">THIS FIELD VISIT</span>
              <strong>
                {answered(p)}
                <small> / 12 essentials answered</small>
              </strong>
              <div className="progress-track">
                <span style={{ width: (answered(p) / 12) * 100 + "%" }} />
              </div>
              <p>
                Answers measure collection progress, not operational readiness.
              </p>
            </div>
            <div className="tip-note">
              <b>A call can interrupt the visit.</b>
              <p>
                Use Keep draft & exit. Your answers stay on this device. Save &
                exit also saves them to the cloud.
              </p>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => downloadJson(draft, "arrival-device-draft.json")}
              >
                Export draft <ArrowRight size={15} />
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
