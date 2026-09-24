import type { PayLine } from "./payroll-calculation";

const hours = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const rate = (value: number) => `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

export default function PayrollPayBreakdown({ lines, gross, baseRate, overtimeThreshold, isDpw }: { lines: PayLine[]; gross: number; baseRate: number; overtimeThreshold: number; isDpw: boolean }) {
  return <section className="pay-calculation" aria-label="How pay is calculated">
    <h3>How pay is calculated</h3>
    <p>Each line shows the saved hours and the rate applied. Gross pay is the sum of these amounts.</p>
    <div className="pay-calculation-lines">
      {lines.filter(line => line.hours > 0).map(line => <div className="pay-calculation-line" key={line.key}>
        <div><strong>{line.label}</strong><span>{hours(line.hours)} hr × {line.multiplier === 1 ? `${rate(line.rate)}/hr` : `${rate(baseRate)} × ${line.multiplier} (${rate(line.rate)}/hr)`}{line.additive ? " · added to worked-hour pay" : ""}</span></div>
        <b>{money(line.amount)}</b>
      </div>)}
      {!lines.some(line => line.hours > 0) && <p>No paid hours entered.</p>}
      <div className="pay-calculation-total"><strong>Gross pay</strong><strong>{money(gross)}</strong></div>
    </div>
    <p>{isDpw ? "DPW employee: worked hours receive 1.5× once. No additional overtime or holiday multiplier." : `Overtime applies only to shift, drill, and callback hours above the saved ${hours(overtimeThreshold)}-hour threshold. DPW and holiday hours receive 1.5× once.`} AO adds the saved AO hourly rate without increasing worked hours or receiving another multiplier. Amounts are rounded to cents per pay line.</p>
  </section>;
}
