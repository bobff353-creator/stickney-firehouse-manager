"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  FileImage,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  blankDetails,
  planSchema,
  systemKeys,
  systemLabels,
  type PlanData,
  type PlanRecord,
  type BuildingDetails,
  chicagoDate,
  blockers,
} from "../lib/preplan";
import FootprintCapture from "./footprint";
import type { Draft } from "./editor";
import { request } from "../lib/client";
import { Choices, Field, Pill } from "./ui";
import { downloadJson } from "../lib/device";
const sections = [
  "Building",
  "Building outline",
  "Fire systems",
  "Floors & occupants",
  "HazMat",
  "Photos & plans",
];
const statuses = ["Not checked", "In service", "Impaired", "Out of service"];
export default function BuildingDetailEditor({
  initial,
  storageKey,
  onSaved,
  onClose,
  onSubmitted,
  onPhotos,
}: {
  initial: Draft;
  storageKey: string;
  onSaved: (p: PlanRecord) => void;
  onClose: () => void;
  onSubmitted: (p: PlanRecord) => void;
  onPhotos: (p: PlanRecord) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved?.id === initial.id && planSchema.safeParse(saved.data).success)
        return { ...saved, kind: "details" };
    } catch {}
    return { ...initial, kind: "details" };
  });
  const [tab, setTab] = useState(initial.section === "outline" ? 1 : 0);
  const [outlinePending, setOutlinePending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [device, setDevice] = useState(false);
  const [saved, setSaved] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const p = draft.data;
  const d = p.details || blankDetails();
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
      setDevice(true);
    } catch {
      setDevice(false);
    }
  }, [draft, storageKey]);
  useEffect(() => {
    heading.current?.focus();
  }, [tab]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if ((!device && !saved) || outlinePending) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [device, saved, outlinePending]);
  function change(v: Partial<PlanData>) {
    setDraft((old) => ({ ...old, data: { ...old.data, ...v } }));
    setSaved(false);
    setError("");
  }
  function detail(v: Partial<BuildingDetails>) {
    change({ details: { ...d, ...v } });
  }
  async function persist() {
    if (outlinePending)
      throw new Error(
        "Use this outline in the working copy, or discard outline changes, before saving.",
      );
    const parsed = planSchema.safeParse(p);
    if (!parsed.success)
      throw new Error(
        "Check " +
          parsed.error.issues[0].path.join(" → ") +
          ": " +
          parsed.error.issues[0].message,
      );
    const r = await request<{ plan: PlanRecord }>("/api/arrival/plans/" + draft.id, {
      method: "PUT",
      body: JSON.stringify({ revision: draft.revision, data: parsed.data }),
    });
    setDraft({
      id: r.plan.id,
      revision: r.plan.revision,
      kind: "details",
      data: r.plan.working,
    });
    onSaved(r.plan);
    setSaved(true);
    return r.plan;
  }
  async function save(exit = false) {
    setBusy(true);
    setError("");
    try {
      await persist();
      if (exit) {
        localStorage.removeItem(storageKey);
        onClose();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    setBusy(true);
    setError("");
    try {
      const missing = blockers(p);
      if (missing.length)
        throw new Error(
          missing[0].text +
            " Use Edit quick preplan if this is a first-in essential.",
        );
      const saved = await persist();
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
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function photos() {
    setBusy(true);
    setError("");
    try {
      const saved = await persist();
      onPhotos(saved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="details-editor">
      <div className="page-actions">
        <button
          className="btn ghost"
          disabled={busy}
          onClick={() => {
            if ((!device && !saved) || outlinePending) {
              setError(
                "Apply or discard any outline changes first. If device save is unavailable, save online or export before leaving.",
              );
              return;
            }
            onClose();
          }}
        >
          <ArrowLeft size={17} />
          Keep draft & exit
        </button>
        <button className="btn" disabled={busy} onClick={() => void save(true)}>
          <Save size={16} />
          Save & exit
        </button>
      </div>
      <header className="page-heading">
        <h1>Building details</h1>
        <p>{p.name}</p>
      </header>
      <p className="field-help">Working copy · changes require review.</p>
      <nav className="record-tabs" aria-label="Building detail sections">
        {sections.map((s, i) => (
          <button
            key={s}
            className={i === tab ? "active" : ""}
            aria-current={i === tab ? "page" : undefined}
            disabled={busy}
            onClick={() => {
              if (outlinePending) {
                setError(
                  "Apply or discard your outline changes before switching sections.",
                );
                return;
              }
              setTab(i);
            }}
          >
            {s}
          </button>
        ))}
      </nav>
      <section className="panel details-form-panel">
        <h2 ref={heading} tabIndex={-1}>
          {sections[tab]}
        </h2>
        <fieldset
          disabled={busy}
          className="details-fields"
          aria-label={sections[tab]}
        >
          {tab === 0 && (
            <>
              <div className="form-grid">
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
                    ].map((s) => (
                      <option value={s} key={s}>
                        {s || "Not checked"}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Floors above ground">
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={p.floors}
                    onChange={(e) => change({ floors: e.target.value })}
                    placeholder="Unknown"
                  />
                </Field>
                <Field label="Construction type">
                  <select
                    value={p.construction}
                    onChange={(e) => change({ construction: e.target.value })}
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
                <Field label="Roof construction / features">
                  <input
                    value={p.roof}
                    onChange={(e) => change({ roof: e.target.value })}
                    maxLength={150}
                  />
                </Field>
              </div>
              <Choices
                label="Basement"
                value={p.basement}
                options={["Yes", "No", "Unknown"]}
                onChange={(v) =>
                  change({ basement: v as PlanData["basement"] })
                }
              />
              <Field label="Occupant / rescue considerations">
                <textarea
                  rows={3}
                  value={p.lifeSafety}
                  onChange={(e) => change({ lifeSafety: e.target.value })}
                  maxLength={2000}
                  placeholder="What would arriving crews need to know?"
                />
              </Field>
              <Field label="Access restrictions">
                <textarea
                  rows={2}
                  value={p.access}
                  onChange={(e) => change({ access: e.target.value })}
                  maxLength={2000}
                />
              </Field>
              <div className="form-grid">
                <Field label="Emergency contact name / role">
                  <input
                    value={p.contactName}
                    onChange={(e) => change({ contactName: e.target.value })}
                    maxLength={150}
                  />
                </Field>
                <Field label="Emergency contact phone">
                  <input
                    type="tel"
                    value={p.contactPhone}
                    onChange={(e) => change({ contactPhone: e.target.value })}
                    maxLength={60}
                  />
                </Field>
                <Field label="Date information was checked">
                  <input
                    type="date"
                    max={chicagoDate()}
                    value={p.visited}
                    onChange={(e) => change({ visited: e.target.value })}
                  />
                </Field>
                <Field label="Next review date">
                  <input
                    type="date"
                    value={p.reviewDue}
                    onChange={(e) => change({ reviewDue: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Additional verified information / follow-up">
                <textarea
                  rows={3}
                  value={p.notes}
                  onChange={(e) => change({ notes: e.target.value })}
                  maxLength={4000}
                />
              </Field>
            </>
          )}
          {tab === 1 && (
            <FootprintCapture
              value={p.footprint}
              address={[p.address, p.city, p.region].filter(Boolean).join(", ")}
              latitude={p.latitude}
              longitude={p.longitude}
              onChange={(v) => change({ footprint: v })}
              onPendingChange={setOutlinePending}
            />
          )}
          {tab === 2 && (
            <>
              <p className="field-help">
                Presence and service condition are different. Record only what
                has been checked; leave the rest unknown.
              </p>
              <div className="details-systems">
                {systemKeys.map((k) => (
                  <div className="system-question" key={k}>
                    <Choices
                      label={systemLabels[k]}
                      value={p.systems[k].answer}
                      options={["Yes", "No", "Unknown"]}
                      onChange={(v) =>
                        change({
                          systems: {
                            ...p.systems,
                            [k]: {
                              ...p.systems[k],
                              answer: v,
                              status:
                                v === "No"
                                  ? "Not checked"
                                  : p.systems[k].status,
                            },
                          },
                        })
                      }
                    />
                    {p.systems[k].answer === "Yes" && (
                      <div className="form-grid">
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
                        <Field label={systemLabels[k] + " service condition"}>
                          <select
                            value={p.systems[k].status || "Not checked"}
                            onChange={(e) =>
                              change({
                                systems: {
                                  ...p.systems,
                                  [k]: {
                                    ...p.systems[k],
                                    status: e.target.value,
                                  },
                                },
                              })
                            }
                          >
                            {statuses.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Field label="FDC specifications and systems served">
                <textarea
                  rows={2}
                  value={d.fdcSpec}
                  onChange={(e) => detail({ fdcSpec: e.target.value })}
                  maxLength={1500}
                  placeholder="Size, connection type, locking means, systems served; leave unknown items unclaimed"
                />
              </Field>
              <Field label="Sprinkler coverage / riser locations">
                <textarea
                  rows={2}
                  value={d.sprinklerCoverage}
                  onChange={(e) =>
                    detail({ sprinklerCoverage: e.target.value })
                  }
                  maxLength={1500}
                />
              </Field>
              {(["standpipe", "firePump"] as const).map((k) => (
                <section className="system-question" key={k}>
                  <Choices
                    label={k === "standpipe" ? "Standpipe" : "Fire pump"}
                    value={d[k].answer}
                    options={["Yes", "No", "Unknown"]}
                    onChange={(v) =>
                      detail({
                        [k]: {
                          ...d[k],
                          answer: v,
                          status: v === "No" ? "Not checked" : d[k].status,
                        },
                      })
                    }
                  />
                  {d[k].answer === "Yes" && (
                    <>
                      <div className="form-grid">
                        <Field
                          label={
                            (k === "standpipe" ? "Standpipe" : "Fire pump") +
                            " location"
                          }
                        >
                          <input
                            value={d[k].location}
                            onChange={(e) =>
                              detail({
                                [k]: { ...d[k], location: e.target.value },
                              })
                            }
                            maxLength={1000}
                          />
                        </Field>
                        <Field
                          label={
                            (k === "standpipe" ? "Standpipe" : "Fire pump") +
                            " service condition"
                          }
                        >
                          <select
                            value={d[k].status}
                            onChange={(e) =>
                              detail({
                                [k]: { ...d[k], status: e.target.value },
                              })
                            }
                          >
                            {statuses.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      {k === "standpipe" ? (
                        <Field label="Standpipe type / connections">
                          <input
                            value={d.standpipe.type}
                            onChange={(e) =>
                              detail({
                                standpipe: {
                                  ...d.standpipe,
                                  type: e.target.value,
                                },
                              })
                            }
                            maxLength={150}
                          />
                        </Field>
                      ) : (
                        <Field label="Fire pump details">
                          <textarea
                            value={d.firePump.notes}
                            onChange={(e) =>
                              detail({
                                firePump: {
                                  ...d.firePump,
                                  notes: e.target.value,
                                },
                              })
                            }
                            maxLength={1500}
                            rows={2}
                          />
                        </Field>
                      )}
                    </>
                  )}
                </section>
              ))}
            </>
          )}
          {tab === 3 && (
            <>
              <div className="panel-title">
                <div>
                  <h3>Floors and other levels</h3>
                  <p>
                    Give each level a recognizable name and important
                    observations.
                  </p>
                </div>
                <button
                  className="btn small"
                  onClick={() =>
                    detail({
                      levels: [
                        ...d.levels,
                        { id: crypto.randomUUID(), name: "", notes: "" },
                      ],
                    })
                  }
                  disabled={d.levels.length >= 100}
                >
                  <Plus size={16} />
                  Add level
                </button>
              </div>
              {!d.levels.length && (
                <p className="field-help">
                  No level-specific information entered.
                </p>
              )}
              {d.levels.map((row, i) => (
                <div className="detail-entry" key={row.id}>
                  <div className="entry-heading">
                    <b>Level {i + 1}</b>
                    <button
                      className="icon-button"
                      aria-label={"Remove level " + (row.name || i + 1)}
                      onClick={() =>
                        detail({
                          levels: d.levels.filter((x) => x.id !== row.id),
                        })
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <Field label={"Level " + (i + 1) + " name"}>
                    <input
                      value={row.name}
                      onChange={(e) =>
                        detail({
                          levels: d.levels.map((x) =>
                            x.id === row.id
                              ? { ...x, name: e.target.value }
                              : x,
                          ),
                        })
                      }
                      maxLength={100}
                      placeholder="e.g. Basement, Floor 2, Roof"
                    />
                  </Field>
                  <Field label={"Level " + (i + 1) + " notes"}>
                    <textarea
                      rows={2}
                      value={row.notes}
                      onChange={(e) =>
                        detail({
                          levels: d.levels.map((x) =>
                            x.id === row.id
                              ? { ...x, notes: e.target.value }
                              : x,
                          ),
                        })
                      }
                      maxLength={2000}
                    />
                  </Field>
                </div>
              ))}
              <div className="section-rule">
                <span>OCCUPANTS / SUITES</span>
              </div>
              <button
                className="btn"
                onClick={() =>
                  detail({
                    occupants: [
                      ...d.occupants,
                      {
                        id: crypto.randomUUID(),
                        name: "",
                        location: "",
                        notes: "",
                      },
                    ],
                  })
                }
                disabled={d.occupants.length >= 100}
              >
                <Plus size={16} />
                Add occupant / suite
              </button>
              {d.occupants.map((row, i) => (
                <div className="detail-entry" key={row.id}>
                  <div className="entry-heading">
                    <b>Occupant {i + 1}</b>
                    <button
                      className="icon-button"
                      aria-label={"Remove occupant " + (row.name || i + 1)}
                      onClick={() =>
                        detail({
                          occupants: d.occupants.filter((x) => x.id !== row.id),
                        })
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <div className="form-grid">
                    <Field label={"Occupant " + (i + 1) + " name / use"}>
                      <input
                        value={row.name}
                        onChange={(e) =>
                          detail({
                            occupants: d.occupants.map((x) =>
                              x.id === row.id
                                ? { ...x, name: e.target.value }
                                : x,
                            ),
                          })
                        }
                        maxLength={150}
                      />
                    </Field>
                    <Field label={"Occupant " + (i + 1) + " floor / suite"}>
                      <input
                        value={row.location}
                        onChange={(e) =>
                          detail({
                            occupants: d.occupants.map((x) =>
                              x.id === row.id
                                ? { ...x, location: e.target.value }
                                : x,
                            ),
                          })
                        }
                        maxLength={300}
                      />
                    </Field>
                  </div>
                  <Field label={"Occupant " + (i + 1) + " notes"}>
                    <textarea
                      rows={2}
                      value={row.notes}
                      onChange={(e) =>
                        detail({
                          occupants: d.occupants.map((x) =>
                            x.id === row.id
                              ? { ...x, notes: e.target.value }
                              : x,
                          ),
                        })
                      }
                      maxLength={2000}
                    />
                  </Field>
                </div>
              ))}
            </>
          )}
          {tab === 4 && (
            <>
              <p className="field-help">
                Record identified material and location. No protective action or
                fire-flow calculation is generated from these entries.
              </p>
              <button
                className="btn"
                onClick={() =>
                  detail({
                    materials: [
                      ...d.materials,
                      {
                        id: crypto.randomUUID(),
                        name: "",
                        location: "",
                        quantity: "",
                        unNumber: "",
                        notes: "",
                      },
                    ],
                  })
                }
                disabled={d.materials.length >= 100}
              >
                <Plus size={16} />
                Add hazardous material
              </button>
              {!d.materials.length && (
                <p>
                  No materials entered. This does not establish that none are
                  present.
                </p>
              )}
              {d.materials.map((row, i) => (
                <div className="detail-entry" key={row.id}>
                  <div className="entry-heading">
                    <b>Material {i + 1}</b>
                    <button
                      className="icon-button"
                      aria-label={"Remove material " + (row.name || i + 1)}
                      onClick={() =>
                        detail({
                          materials: d.materials.filter((x) => x.id !== row.id),
                        })
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <div className="form-grid">
                    {(
                      ["name", "location", "quantity", "unNumber"] as const
                    ).map((key) => (
                      <Field
                        key={key}
                        label={
                          "Material " +
                          (i + 1) +
                          " " +
                          {
                            name: "name",
                            location: "location",
                            quantity: "quantity / units",
                            unNumber: "UN / NA number",
                          }[key]
                        }
                      >
                        <input
                          value={row[key]}
                          maxLength={
                            key === "name"
                              ? 150
                              : key === "location"
                                ? 300
                                : key === "quantity"
                                  ? 100
                                  : 30
                          }
                          onChange={(e) =>
                            detail({
                              materials: d.materials.map((x) =>
                                x.id === row.id
                                  ? { ...x, [key]: e.target.value }
                                  : x,
                              ),
                            })
                          }
                        />
                      </Field>
                    ))}
                  </div>
                  <Field label={"Material " + (i + 1) + " notes"}>
                    <textarea
                      rows={2}
                      value={row.notes}
                      onChange={(e) =>
                        detail({
                          materials: d.materials.map((x) =>
                            x.id === row.id
                              ? { ...x, notes: e.target.value }
                              : x,
                          ),
                        })
                      }
                      maxLength={2000}
                    />
                  </Field>
                </div>
              ))}
            </>
          )}
          {tab === 5 && (
            <>
              <p>
                Add exterior sides, relative symbols, floor-plan images or PDFs
                whenever you have them. They are optional and do not lengthen
                the quick preplan.
              </p>
              <button className="btn" onClick={() => void photos()}>
                <FileImage size={18} />
                Open photos & plans
              </button>
              {p.photos.length ? (
                p.photos.map((f) => (
                  <div className="file-row" key={f.id}>
                    <a
                      href={"/api/arrival/files/" + f.id}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {f.side === "Plan" ? "Plan / document" : f.side + " side"}{" "}
                      · {f.name}
                    </a>
                  </div>
                ))
              ) : (
                <p>No photos or plans uploaded yet.</p>
              )}
            </>
          )}
        </fieldset>
      </section>
      {error && (
        <div className="form-error" role="alert">
          {error}
          <button
            className="text-button"
            onClick={() =>
              downloadJson(draft, "arrival-building-details-draft.json")
            }
          >
            Export device draft
          </button>
        </div>
      )}
      <footer className="details-save-bar">
        <span aria-live="polite">
          {busy
            ? "Saving…"
            : saved
              ? "Working copy saved to cloud"
              : device
                ? "Device draft saved"
                : "Device save unavailable"}
        </span>
        <div className="action-group">
          <button className="btn" disabled={busy} onClick={() => void save()}>
            <Save size={16} />
            Save details
          </button>
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => void send()}
          >
            Send changes for review
            <ArrowRight size={16} />
          </button>
        </div>
      </footer>
    </div>
  );
}
