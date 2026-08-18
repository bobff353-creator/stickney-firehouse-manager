// Structured preplan alerts domain logic (Preplan 2.0): critical warnings,
// access problems, command notes, and general operational notes.
// Pure functions only — no database access — so this stays independently testable.

export type AlertType = "critical_warning" | "access_problem" | "command_note" | "general_note";
export type AlertSeverity = "informational" | "advisory" | "warning" | "critical";

export type PreplanAlert = {
  id: string;
  preplanId: string;
  levelId: string | null;
  alertType: AlertType;
  title: string;
  instructions: string;
  severity: AlertSeverity;
  displayOrder: number;
  pinToRespond: boolean;
  effectiveAt: string | null;
  expiresAt: string | null;
  verificationRequired: boolean;
  verifiedBy: string;
  verifiedAt: string | null;
  archived: boolean;
  createdBy: string;
  createdAt?: string;
  updatedBy: string;
  updatedAt?: string;
};

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  advisory: 2,
  informational: 3,
};

/**
 * Critical and warning alerts must appear before ordinary building
 * information in Respond. Sorts by severity first (most severe first), then
 * by displayOrder, so an editor's explicit ordering is respected within a
 * severity tier.
 */
export function sortAlertsForRespond<T extends Pick<PreplanAlert, "severity" | "displayOrder">>(alerts: T[]): T[] {
  return [...alerts].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.displayOrder - b.displayOrder);
}

export function isCriticalOrWarning(severity: AlertSeverity): boolean {
  return severity === "critical" || severity === "warning";
}

/**
 * An alert is currently active if it has started (or has no effective date)
 * and has not expired. Expired-but-unverified critical/warning alerts must
 * still surface (per the Respond information-order requirement, "expired
 * but unverified critical records") rather than silently disappearing —
 * callers should check `needsVerification` separately from `isActive`.
 */
export function isAlertActive(alert: Pick<PreplanAlert, "effectiveAt" | "expiresAt" | "archived">, now: Date = new Date()): boolean {
  if (alert.archived) return false;
  if (alert.effectiveAt && new Date(alert.effectiveAt) > now) return false;
  if (alert.expiresAt && new Date(alert.expiresAt) <= now) return false;
  return true;
}

export function isAlertExpired(alert: Pick<PreplanAlert, "expiresAt">, now: Date = new Date()): boolean {
  return Boolean(alert.expiresAt && new Date(alert.expiresAt) <= now);
}

/**
 * An expired critical/warning alert that required verification and hasn't
 * been verified must keep surfacing to Respond and to the expiring-items
 * workspace, rather than silently vanishing once its expiration passes.
 */
export function needsVerification(alert: Pick<PreplanAlert, "expiresAt" | "verificationRequired" | "verifiedAt" | "archived">, now: Date = new Date()): boolean {
  if (alert.archived) return false;
  if (!alert.verificationRequired) return false;
  if (alert.verifiedAt) return false;
  return isAlertExpired(alert, now);
}

/** Alerts Respond should actually display: active ones, plus expired ones still awaiting verification. */
export function visibleInRespond(alerts: PreplanAlert[], now: Date = new Date()): PreplanAlert[] {
  return alerts.filter((alert) => isAlertActive(alert, now) || needsVerification(alert, now));
}

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  critical_warning: "Critical Warning",
  access_problem: "Access Problem",
  command_note: "Command Note",
  general_note: "General Operational Note",
};

export function alertTypeLabel(alertType: AlertType): string {
  return ALERT_TYPE_LABELS[alertType] ?? alertType;
}

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  informational: "Informational",
  advisory: "Advisory",
  warning: "Warning",
  critical: "Critical",
};

export function severityLabel(severity: AlertSeverity): string {
  return SEVERITY_LABELS[severity] ?? severity;
}
