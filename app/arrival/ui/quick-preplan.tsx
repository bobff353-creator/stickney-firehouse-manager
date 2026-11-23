"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Save,
  TriangleAlert,
} from "lucide-react";
import {
  type PlanData,
  type PlanRecord,
  blockers,
  unknowns,
  planSchema,
  systemLabels,
  chicagoDate,
} from "../lib/preplan";
import type { Draft } from "./editor";
import { request } from "../lib/client";
import { Choices, Field, Pill } from "./ui";
import { downloadJson } from "../lib/device";
import { preplanDetailDestination } from "../lib/edit-navigation";
export default function QuickPreplan({
  initial,
  storageKey,
  onSaved,
  onClose,
  onSubmitted,
  onEditDetails,
}: {
  initial: Draft;
  storageKey: string;
  onSaved: (r: PlanRecord) => void;
  onClose: () => void;
  onSubmitted: (r: PlanRecord) => void;
  onEditDetails?: (draft: Draft, label: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const local = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (local?.id === initial.id && planSchema.safeParse(local.data).success)
        return {
          ...local,
          kind: "quick",
          data: { ...local.data, scope: "quick" },
        };
    } catch {}
    return {
      ...initial,
      kind: "quick",
      data: { ...initial.data, scope: "quick" },
    };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [localSaved, setLocalSaved] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const p = draft.data;
  const index = p.step >= 5 ? 2 : p.step >= 2 ? 1 : 0;
  const u = unknowns(p);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
      setLocalSaved(true);
    } catch {
      setLocalSaved(false);
    }
  }, [draft, storageKey]);
  useEffect(() => {
    heading.current?.focus();
    heading.current
      ?.closest("header")
      ?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [index]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (!localSaved && !saved) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [localSaved, saved]);
  function fail(message: string) {
    setError(message);
    requestAnimationFrame(() => {
      errorBox.current?.focus();
      errorBox.current?.scrollIntoView({
        block: "center",
        behavior: "instant",
      });
    });
  }
  function change(values: Partial<PlanData>) {
    setDraft((v) => ({ ...v, data: { ...v.data, ...values } }));
    setSaved(false);
    setError("");
  }
  async function persist(value: PlanData) {
    const r = await request<{ plan: PlanRecord }>(
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
      id: r.plan.id,
      revision: r.plan.revision,
      kind: "quick",
      data: r.plan.working,
    });
    onSaved(r.plan);
    setSaved(true);
    return r.plan;
  }
  async function next() {
    const missing = blockers(p).filter((x) =>
      index === 0 ? x.step === 0 : x.step !== 0,
    );
    if (missing.length) {
      fail(missing.map((x) => x.text).join(" "));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await persist({ ...p, step: index === 0 ? 2 : 5 });
    } catch (e) {
      fail((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveExit() {
    setBusy(true);
    setError("");
    try {
      await persist(p);
      localStorage.removeItem(storageKey);
      onClose();
    } catch (e) {
      fail((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    const missing = blockers(p);
    if (missing.length) {
      fail(missing.map((x) => x.text).join(" "));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = await persist(p);
      const r = await request<{ plan: PlanRecord }>(
        "/api/arrival/plans/" + saved.id + "/transition",
        {
          method: "POST",
          body: JSON.stringify({ action: "submit", revision: saved.revision }),
        },
      );
      localStorage.removeItem(storageKey);
      onSubmitted(r.plan);
    } catch (e) {
      fail((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    if (
      file.size > 8 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      fail(
        "Choose a JPG, PNG or WebP smaller than 8 MB. Convert HEIC to JPG first.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = await persist(p);
      const form = new FormData();
      form.set("planId", saved.id);
      form.set("file", file);
      const r = await request<{
        file: {
          id: string;
          name: string;
          type: "image/jpeg" | "image/png" | "image/webp";
        };
      }>("/api/arrival/files", { method: "POST", body: form });
      const next = {
        ...saved.working,
        photos: [
          ...saved.working.photos.filter((x) => x.side !== "A"),
          { ...r.file, side: "A" as const, caption: "" },
        ],
      };
      const result = await request<{ plan: PlanRecord }>(
        "/api/arrival/plans/" + saved.id,
        {
          method: "PUT",
          body: JSON.stringify({ revision: saved.revision, data: next }),
        },
      );
      setDraft({
        id: saved.id,
        revision: result.plan.revision,
        kind: "quick",
        data: result.plan.working,
      });
      onSaved(result.plan);
      setSaved(true);
    } catch (e) {
      fail((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function recover() {
    setBusy(true);
    try {
      downloadJson(draft, "arrival-conflicting-device-draft.json");
      const r = await request<{ plan: PlanRecord }>("/api/arrival/plans/" + draft.id);
      setDraft({
        id: r.plan.id,
        revision: r.plan.revision,
        kind: "quick",
        data: { ...r.plan.working, scope: "quick" },
      });
      onSaved(r.plan);
      setError("");
    } catch (e) {
      fail((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function close() {
    if (!localSaved && !saved) {
      fail(
        "Device storage is unavailable. Save online or export the draft before leaving.",
      );
      return;
    }
    onClose();
  }
  const photo = p.photos.find((x) => x.side === "A");
  return (
    <div className="editor-page quick-page">
      <div className="editor-top">
        <button className="btn ghost" disabled={busy} onClick={close}>
          <ArrowLeft size={17} />
          Keep draft & exit
        </button>
        <span className="save-state" aria-live="polite">
          {busy
            ? "Saving…"
            : saved
              ? "Saved to cloud"
              : localSaved
                ? "Device draft saved"
                : "Device save unavailable"}
        </span>
        <button className="btn" onClick={() => void saveExit()} disabled={busy}>
          <Save size={16} />
          Save & exit
        </button>
      </div>
      <div className="editor-heading">
        <div>
          <span className="eyebrow">QUICK PREPLAN</span>
          <h1>{p.name || "Quick preplan"}</h1>

        </div>
        <Pill tone="orange">{index + 1} of 3</Pill>
      </div>
      <nav className="quick-steps" aria-label="Quick preplan steps">
        {["Building", "First-in essentials", "Check & send"].map((s, i) => (
          <button
            type="button"
            key={s}
            aria-current={index === i ? "step" : undefined}
            disabled={busy || i > index}
            className={i === index ? "active" : ""}
            onClick={() => change({ step: [0, 2, 5][i] })}
          >
            <span>{i < index ? <Check size={16} /> : i + 1}</span>
            {s}
          </button>
        ))}
      </nav>
      <section className="editor-card quick-card">
        <header>
          <span className="eyebrow">STEP {index + 1} / 3</span>
          <h2 ref={heading} tabIndex={-1}>
            {
              [
                "Building",
                "Access, water & hazards",
                "Review",
              ][index]
            }
          </h2>
          {onEditDetails && <button type="button" className="btn" disabled={busy} onClick={() => onEditDetails(draft, "Building")}><ArrowRight size={16} />Edit all preplan details</button>}
        </header>
        <fieldset
          className="form-body"
          disabled={busy}
          aria-label={
            ["Building", "First-in essentials", "Check and send"][index]
          }
        >
          {index === 0 && (
            <>
              <Field label="Building or business name">
                <input
                  value={p.name}
                  onChange={(e) => change({ name: e.target.value })}
                  maxLength={200}
                  placeholder="Name crews will recognize"
                />
              </Field>
              <Field label="Street address">
                <input
                  value={p.address}
                  onChange={(e) =>
                    change({ address: e.target.value, addressConfirmed: false })
                  }
                  maxLength={300}
                  autoComplete="street-address"
                  placeholder="Street number and name"
                />
              </Field>
              <div className="form-grid">
                <Field label="City / town">
                  <input
                    value={p.city}
                    onChange={(e) =>
                      change({ city: e.target.value, addressConfirmed: false })
                    }
                    maxLength={100}
                  />
                </Field>
                <Field label="State / region">
                  <input
                    value={p.region}
                    onChange={(e) =>
                      change({
                        region: e.target.value,
                        addressConfirmed: false,
                      })
                    }
                    maxLength={50}
                  />
                </Field>
              </div>
              <label className="check-card">
                <input
                  type="checkbox"
                  checked={p.addressConfirmed}
                  onChange={(e) =>
                    change({ addressConfirmed: e.target.checked })
                  }
                />
                <span>
                  <b>I checked this address against the building</b>
                  <small>Confirm the building number and street.</small>
                </span>
              </label>
              <details className="optional">
                <summary>
                  Occupancy and visit date<span>Optional</span>
                </summary>
                <Field label="Occupancy">
                  <select
                    value={p.occupancy}
                    onChange={(e) => change({ occupancy: e.target.value })}
                  >
                    {[
                      "",
                      "Residential",
                      "Commercial",
                      "Industrial",
                      "School",
                      "Healthcare",
                      "Assembly",
                      "Mixed use",
                      "Unknown",
                    ].map((v) => (
                      <option key={v} value={v}>
                        {v || "Not checked"}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Visit date">
                  <input
                    type="date"
                    max={chicagoDate()}
                    value={p.visited}
                    onChange={(e) => change({ visited: e.target.value })}
                  />
                </Field>
              </details>
            </>
          )}
          {index === 1 && (
            <>
              <Field label="Main entrance / A side">
                <input
                  value={p.entrance}
                  onChange={(e) => change({ entrance: e.target.value })}
                  maxLength={1500}
                  placeholder="e.g. Front doors facing Main Street"
                />
              </Field>
              <button
                className="text-button"
                onClick={() => change({ entrance: "Unknown" })}
              >
                Entrance not checked — mark Unknown
              </button>
              <Field label="Hydrant / water-source location">
                <input
                  value={p.hydrant}
                  onChange={(e) => change({ hydrant: e.target.value })}
                  maxLength={1500}
                  placeholder="e.g. Across street at A / D corner"
                />
              </Field>
              <button
                className="text-button"
                onClick={() =>
                  change({ hydrant: "Unknown", hydrantStatus: "Unknown" })
                }
              >
                Water supply not checked — mark Unknown
              </button>
              <Choices
                label="Water-source status at this visit"
                value={p.hydrantStatus}
                options={["In service", "Out of service", "Unknown"]}
                onChange={(v) =>
                  change({ hydrantStatus: v as PlanData["hydrantStatus"] })
                }
              />
              <Choices
                label="Any hazards or access concerns?"
                value={p.hazardStatus}
                options={["Present", "None observed", "Unknown"]}
                onChange={(v) =>
                  change({ hazardStatus: v as PlanData["hazardStatus"] })
                }
              />
              {(p.hazardStatus === "Present" ||
                p.hazardNotes ||
                p.hazards.length > 0) && (
                <>
                  <Field label="What and where is the concern?">
                    <textarea
                      rows={3}
                      value={p.hazardNotes}
                      onChange={(e) => change({ hazardNotes: e.target.value })}
                      maxLength={4000}
                      placeholder="Short description and recognizable location"
                    />
                  </Field>
                  {p.hazards.length > 0 && (
                    <div className="tags">
                      {p.hazards.map((h) => (
                        <span key={h}>
                          {h}
                          <button
                            aria-label={"Remove hazard tag " + h}
                            onClick={() =>
                              change({
                                hazards: p.hazards.filter((x) => x !== h),
                              })
                            }
                          >
                            {" "}
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
              <details className="optional">
                <summary>
                  FDC and key box<span>If you can see them</span>
                </summary>
                <p>Skip anything you have not checked. It will stay unknown.</p>
                {(["fdc", "keybox"] as const).map((k) => (
                  <div className="quick-optional-system" key={k}>
                    <Choices
                      label={systemLabels[k]}
                      value={p.systems[k].answer}
                      options={["Yes", "No", "Unknown"]}
                      onChange={(v) =>
                        change({
                          systems: {
                            ...p.systems,
                            [k]: { ...p.systems[k], answer: v },
                          },
                        })
                      }
                    />
                    {p.systems[k].answer === "Yes" && (
                      <Field label={systemLabels[k] + " location"}>
                        <input
                          value={p.systems[k].location}
                          onChange={(e) =>
                            change({
                              systems: {
                                ...p.systems,
                                [k]: {
                                  ...p.systems[k],
                                  location: e.target.value,
                                },
                              },
                            })
                          }
                          maxLength={1000}
                          placeholder="Location, or Unknown"
                        />
                      </Field>
                    )}
                  </div>
                ))}
              </details>
              <div className="quick-front-photo">
                <div>
                  <h3>Front / A-side photo</h3>
                  <p>Optional. A quick visual for the next crew.</p>
                </div>
                {photo && (
                  <img src={"/api/arrival/files/" + photo.id} alt="Front / A side" />
                )}
                <label className="btn upload-label">
                  <Camera size={17} />
                  {photo ? "Replace front photo" : "Add front photo"}
                  <input
                    type="file"
                    aria-label="Add front photo"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      void upload(f);
                    }}
                  />
                </label>
              </div>
            </>
          )}
          {index === 2 && (
            <>
              <p className="field-help">Send for review. Publishing is separate.</p>
              <div className="review-summary">
                <button onClick={() => change({ step: 0 })}>
                  <div>
                    <b>{p.name}</b>
                    <small>
                      {p.address}, {p.city} {p.region}
                    </small>
                  </div>
                  <span>
                    Edit
                    <ArrowRight size={15} />
                  </span>
                </button>
                <button onClick={() => change({ step: 2 })}>
                  <div>
                    <b>Main entrance</b>
                    <small>{p.entrance || "Unknown"}</small>
                  </div>
                  <span>
                    Edit
                    <ArrowRight size={15} />
                  </span>
                </button>
                <button onClick={() => change({ step: 2 })}>
                  <div>
                    <b>Water supply · {p.hydrantStatus || "Unknown"}</b>
                    <small>{p.hydrant || "Unknown"}</small>
                  </div>
                  <span>
                    Edit
                    <ArrowRight size={15} />
                  </span>
                </button>
                <button onClick={() => change({ step: 2 })}>
                  <div>
                    <b>Hazards · {p.hazardStatus || "Unknown"}</b>
                    <small>
                      {p.hazardNotes || "No further observation entered"}
                    </small>
                  </div>
                  <span>
                    Edit
                    <ArrowRight size={15} />
                  </span>
                </button>
              </div>
              <details className="optional">
                <summary>
                  <TriangleAlert size={16} />
                  {u.length} details still unknown<span>View & edit</span>
                </summary>
                <p>
                  Unknown never means absent. These details stay visible in the
                  approved brief. Select a detail below to open its editor. Your current draft is kept.
                </p>
                <div className="tags">
                  {u.map((s) => (
                    onEditDetails ? <button type="button" className="unknown-edit-link" key={s} disabled={busy} onClick={() => onEditDetails(draft, s)}><span>{s}</span><small>Edit · {preplanDetailDestination(s).section}</small><ArrowRight size={14} /></button> : <span key={s}>{s}</span>
                  ))}
                </div>
              </details>

            </>
          )}
        </fieldset>
        {error && (
          <div role="alert" className="form-error" ref={errorBox} tabIndex={-1}>
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
                disabled={busy}
                onClick={() => void recover()}
              >
                Export draft & open cloud copy
              </button>
            )}
          </div>
        )}
        <footer className="editor-footer">
          <button
            className="btn"
            disabled={busy || index === 0}
            onClick={() => change({ step: [0, 2, 5][index - 1] })}
          >
            <ArrowLeft size={16} />
            Back
          </button>
          {index < 2 ? (
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => void next()}
            >
              {busy ? "Saving…" : "Save & continue"}
              <ArrowRight size={17} />
            </button>
          ) : (
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => void send()}
            >
              {busy ? "Sending…" : "Send quick preplan for review"}
              <ArrowRight size={17} />
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
