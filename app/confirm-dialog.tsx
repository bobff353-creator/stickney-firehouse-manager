"use client";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "default" | "warning" | "danger";
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDialog({ open, title, description, confirmLabel, tone = "default", busy = false, onCancel, onConfirm }: ConfirmDialogProps) {
  if (!open) return null;
  return <div className="confirm-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) onCancel(); }}>
    <section className={`confirm-dialog ${tone}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description">
      <span className="confirm-icon" aria-hidden="true">{tone === "danger" ? "!" : tone === "warning" ? "i" : "✓"}</span>
      <div><h2 id="confirm-title">{title}</h2><p id="confirm-description">{description}</p></div>
      <div className="confirm-actions"><button className="quiet-button" disabled={busy} onClick={onCancel}>Cancel</button><button className={`confirm-primary ${tone}`} disabled={busy} onClick={onConfirm}>{busy ? "Working…" : confirmLabel}</button></div>
    </section>
  </div>;
}
