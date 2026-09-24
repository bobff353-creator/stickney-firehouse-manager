"use client";

type Scale = { id: string; label: string; regularRate: number };
const hourly = (rate: number) => Number.isFinite(rate) ? `$${rate.toFixed(2)}/hr` : "Rate not entered";
export function payScaleLabel(scale: Scale, showRate: boolean) {
  return showRate ? `${scale.label} — ${hourly(scale.regularRate)}` : scale.label;
}

export default function EmployeePayScale({ scales, value, period, canChangeScale, canManageRates, employeeDirty, onChange, onEditRates }: {
  scales: Scale[]; value: string; period: string; canChangeScale: boolean; canManageRates: boolean; employeeDirty: boolean;
  onChange: (id: string) => void; onEditRates: () => void;
}) {
  const selected = scales.find(scale => scale.id === value);
  return <section id="employee-pay" className="employee-pay-scale" tabIndex={-1} aria-label="Rank and pay scale">
    <label htmlFor="employee-pay-scale"><span>Rank / pay scale *</span>
      <select id="employee-pay-scale" required disabled={!canChangeScale} value={value} onChange={event => onChange(event.target.value)}>
        {scales.map(scale => <option key={scale.id} value={scale.id}>{payScaleLabel(scale, canManageRates)}</option>)}
      </select>
    </label>
    <dl className="employee-pay-summary"><div><dt>Rank</dt><dd>{selected?.label || "Choose a scale"}</dd></div><div><dt>Straight-time pay</dt><dd>{canManageRates && selected ? hourly(selected.regularRate) : "Payroll access required"}</dd></div></dl>
    {canManageRates && <small>Rates shown for {period}.</small>}
    <p>{canChangeScale ? "Choose the employee’s rank and scale, then Save employee to apply the assignment." : "An administrator with Manage permissions access can change this assignment."}</p>
    {canManageRates ? <><button type="button" className="quiet-button" disabled={employeeDirty || !selected} onClick={onEditRates}>Edit this pay scale</button><small>{employeeDirty ? "Save or cancel your employee changes before opening pay rates." : "Opens Rates & Rules. A rate change applies to everyone assigned to that scale from its effective date."}</small></> : <small>Contact a payroll administrator to view or edit the hourly rates.</small>}
  </section>;
}
