"use client";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  MessageSquarePlus,
  TriangleAlert,
  X,
} from "lucide-react";
import type { PlanRecord } from "../lib/preplan";
import {
  type Observation,
  type ObservationDraft,
  observationSchema,
} from "../lib/observations";
import {
  keepObservationDraft,
  removeObservationDraft,
} from "../lib/observation-device";
import { request } from "../lib/client";
import { Field, Pill } from "./ui";
export function ObservationCapture({
  initial,
  records,
  onClose,
  onSaved,
}: {
  initial: ObservationDraft;
  records: PlanRecord[];
  onClose: () => void;
  onSaved: (o: Observation) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [device, setDevice] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    heading.current?.focus();
    return () => {
      document.body.style.overflow = oldOverflow;
      previousFocus.current?.focus();
    };
  }, []);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (
        device !== "Saved on this device" &&
        (draft.data.text || draft.photo)
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [device, draft]);
  useEffect(() => {
    if (!draft.photo) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(draft.photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [draft.photo]);
  useEffect(() => {
    if (!draft.data.text && !draft.photo && !draft.data.address) return;
    let active = true;
    const timer = setTimeout(() => {
      keepObservationDraft(draft)
        .then(() => {
          if (active) setDevice("Saved on this device");
        })
        .catch(() => {
          if (active)
            setDevice("Device save unavailable — save online before closing");
        });
    }, 250);
    autosaveTimer.current = timer;
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [draft]);
  function change(values: Partial<ObservationDraft["data"]>) {
    setDraft((v) => ({
      ...v,
      data: { ...v.data, ...values },
      modifiedAt: Math.max(Date.now(), v.modifiedAt + 1),
    }));
    setDevice("");
    setError("");
  }
  async function close() {
    if (busy) return;
    if (draft.data.text || draft.photo || draft.data.address) {
      try {
        await keepObservationDraft(draft);
      } catch (e) {
        setError((e as Error).message);
        return;
      }
    }
    onClose();
  }
  async function save() {
    setError("");
    const parsed = observationSchema.safeParse(draft.data);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (!parsed.data.planId && !parsed.data.address) {
      setError("Choose a building or enter the address / location.");
      return;
    }
    setBusy(true);
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    try {
      try {
        await keepObservationDraft(draft);
      } catch {
        /* An online save is still possible when device storage is full. */
      }
      const form = new FormData();
      form.set("data", JSON.stringify(parsed.data));
      if (draft.photo) form.set("photo", draft.photo);
      const result = await request<{ observation: Observation }>(
        "/api/arrival/observations",
        { method: "POST", body: form },
      );
      try {
        await removeObservationDraft(draft.id);
      } catch {
        setError(
          "Saved online. This device copy could not be cleared; it will retry safely with the same observation ID.",
        );
      }
      onSaved(result.observation);
    } catch (e) {
      setError(
        (e as Error).message +
          " If a device save is shown, the note and photo remain available under Observations.",
      );
    } finally {
      setBusy(false);
    }
  }
  function keys(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      void close();
    }
    if (e.key === "Tab") {
      const all = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[href]",
        ) || [],
      );
      const first = all[0],
        last = all[all.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === heading.current)
      ) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }
  const linked = records.find((r) => r.id === draft.data.planId);
  return (
    <div className="observation-backdrop">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="observation-title"
        className="observation-dialog"
        onKeyDown={keys}
      >
        <header>
          <div>
            <h2 id="observation-title" tabIndex={-1} ref={heading}>
              Add an observation
            </h2>
          </div>
          <button
            className="icon-button"
            aria-label="Keep observation draft and close"
            onClick={() => void close()}
            disabled={busy}
          >
            <X size={20} />
          </button>
        </header>
        <fieldset disabled={busy} className="observation-form">
          <Field label="Building">
            <select
              value={draft.data.planId || ""}
              onChange={(e) =>
                change({ planId: e.target.value || null, address: "" })
              }
            >
              <option value="">Enter an address / location instead</option>
              {records.map((r) => (
                <option value={r.id} key={r.id}>
                  {r.name} · {r.address}
                </option>
              ))}
            </select>
          </Field>
          {draft.data.planId ? (
            <div className="observation-place">
              <b>{linked?.name || "Selected building"}</b>
              <span>{linked?.address || "Saved building reference"}</span>
            </div>
          ) : (
            <Field label="Address / location">
              <input
                value={draft.data.address}
                onChange={(e) => change({ address: e.target.value })}
                maxLength={500}
                placeholder="e.g. 200 Main St, Example City · rear alley"
              />
            </Field>
          )}
          <Field label="What did you notice?">
            <textarea
              rows={4}
              value={draft.data.text}
              onChange={(e) => change({ text: e.target.value })}
              maxLength={4000}
              placeholder="e.g. Rear exit blocked by stored pallets. C side, by loading dock."
            />
          </Field>
          <button
            type="button"
            className={
              "alert-choice " +
              (draft.data.priority === "crew-alert" ? "selected" : "")
            }
            aria-pressed={draft.data.priority === "crew-alert"}
            onClick={() =>
              change({
                priority:
                  draft.data.priority === "crew-alert" ? "note" : "crew-alert",
              })
            }
          >
            <TriangleAlert size={19} />
            <span>
              <b>Flag for arriving crews</b>
              <small>Highlights the note as an unreviewed crew alert.</small>
            </span>
            {draft.data.priority === "crew-alert" && <Check size={18} />}
          </button>
          {draft.photo ? (
            <div className="observation-photo">
              <img src={preview || undefined} alt="Observation photo preview" />
              <div>
                <b>{draft.photo.name}</b>
                <button
                  className="text-button"
                  onClick={() => {
                    setDraft((v) => ({
                      ...v,
                      photo: null,
                      modifiedAt: Math.max(Date.now(), v.modifiedAt + 1),
                    }));
                    setDevice("");
                  }}
                >
                  Remove photo from draft
                </button>
              </div>
            </div>
          ) : (
            <label className="btn upload-label">
              <Camera size={18} /> Add a photo{" "}
              <span className="muted">Optional</span>
              <input
                aria-label="Add observation photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (
                    file.size > 8 * 1024 * 1024 ||
                    !["image/jpeg", "image/png", "image/webp"].includes(
                      file.type,
                    )
                  ) {
                    setError("Use a JPG, PNG or WebP photo smaller than 8 MB.");
                    return;
                  }
                  setDraft((v) => ({
                    ...v,
                    photo: file,
                    modifiedAt: Math.max(Date.now(), v.modifiedAt + 1),
                  }));
                  setDevice("");
                }}
              />
            </label>
          )}
          <p className="field-help">
            This note stays separate from the approved preplan. It is labeled
            unreviewed until someone checks it.
          </p>
        </fieldset>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <footer>
          <span aria-live="polite">
            {busy
              ? "Saving online…"
              : device || "Changes not yet saved to this device"}
          </span>
          <div className="action-group">
            <button
              className="btn"
              disabled={busy}
              onClick={() => void close()}
            >
              Keep draft
            </button>
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => void save()}
            >
              <MessageSquarePlus size={17} />
              {busy ? "Saving…" : "Save observation"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
export function ObservationList({
  observations,
  onUpdate,
  review = false,
  onOpenBuilding,
}: {
  observations: Observation[];
  onUpdate: (o: Observation) => void;
  review?: boolean;
  onOpenBuilding?: (id: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function mark(o: Observation, state: string) {
    setBusy(true);
    setError("");
    try {
      const r = await request<{ observation: Observation }>(
        "/api/arrival/observations/" + o.id,
        {
          method: "PATCH",
          body: JSON.stringify({ revision: o.revision, state, note }),
        },
      );
      onUpdate(r.observation);
      setEditing(null);
      setNote("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="observation-list">
      {observations.map((o) => (
        <article
          className={
            "observation-card " +
            (o.priority === "crew-alert" && o.state !== "resolved"
              ? "crew-alert"
              : "")
          }
          key={o.id}
        >
          <div className="panel-title">
            <Pill
              tone={
                o.state === "resolved"
                  ? "neutral"
                  : o.priority === "crew-alert"
                    ? "orange"
                    : "blue"
              }
            >
              {o.state === "resolved"
                ? "Resolved"
                : o.state === "reviewed"
                  ? "Reviewed note"
                  : o.priority === "crew-alert"
                    ? "Unreviewed crew alert"
                    : "Unreviewed observation"}
            </Pill>
            <time>
              {new Date(o.createdAt).toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "America/Chicago",
              })}{" "}
              CT
            </time>
          </div>
          <p className="observation-address">{o.address}</p>
          <p className="observation-text">{o.text}</p>
          {o.hasPhoto && (
            <a
              href={"/api/arrival/observations/" + o.id + "/photo"}
              target="_blank"
              rel="noreferrer"
              className="observation-image-link"
            >
              <img
                src={"/api/arrival/observations/" + o.id + "/photo"}
                alt="Photo attached to field observation"
                loading="lazy"
              />
            </a>
          )}
          {o.reviewNote && (
            <p className="observation-review-note">
              <b>Review note:</b> {o.reviewNote}
            </p>
          )}
          <small>
            {o.state === "unreviewed"
              ? "Field report — not verified or incorporated into the approved preplan."
              : o.state === "reviewed"
                ? "Note reviewed. This does not change the approved preplan."
                : "Resolved note retained for history."}
          </small>
          <div className="action-group">
            {onOpenBuilding && o.planId && (
              <button
                className="text-button"
                onClick={() => onOpenBuilding(o.planId!)}
              >
                Open building
              </button>
            )}
            {review && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setEditing(editing === o.id ? null : o.id);
                  setNote("");
                  setError("");
                }}
              >
                Review / resolve
              </button>
            )}
          </div>
          {editing === o.id && (
            <div className="observation-review">
              <Field label="What did you check or resolve?">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  disabled={busy}
                />
              </Field>
              <div className="action-group">
                <button
                  className="btn small"
                  disabled={busy || !note.trim()}
                  onClick={() => void mark(o, "reviewed")}
                >
                  Mark note reviewed
                </button>
                <button
                  className="btn small"
                  disabled={busy || !note.trim()}
                  onClick={() => void mark(o, "resolved")}
                >
                  Resolve
                </button>
                {o.state !== "unreviewed" && (
                  <button
                    className="btn small"
                    disabled={busy || !note.trim()}
                    onClick={() => void mark(o, "unreviewed")}
                  >
                    Reopen for review
                  </button>
                )}
              </div>
            </div>
          )}
        </article>
      ))}
      {error && (
        <div role="alert" className="form-error">
          {error}
        </div>
      )}
    </div>
  );
}
