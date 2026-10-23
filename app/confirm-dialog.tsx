"use client";

import { useEffect, useRef } from "react";
import { containDialogTab } from "./dialog-keyboard";

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
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const overflow = document.body.style.overflow;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => { element.close(); document.body.style.overflow = overflow; queueMicrotask(() => { if (opener?.isConnected) opener.focus({ preventScroll: true }); }); };
  }, [open]);
  if (!open) return null;
  return <div className="confirm-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) onCancel(); }}>
    <dialog ref={dialog} className={`confirm-dialog ${tone}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" onKeyDown={containDialogTab} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
      <span className="confirm-icon" aria-hidden="true">{tone === "danger" ? "!" : tone === "warning" ? "i" : "✓"}</span>
      <div><h2 id="confirm-title">{title}</h2><p id="confirm-description">{description}</p></div>
      <div className="confirm-actions"><button autoFocus className="quiet-button" disabled={busy} onClick={onCancel}>Cancel</button><button className={`confirm-primary ${tone}`} disabled={busy} onClick={onConfirm}>{busy ? "Working…" : confirmLabel}</button></div>
    </dialog>
  </div>;
}
