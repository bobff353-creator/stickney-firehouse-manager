# Payroll Excel and CSV export

The department's OneDrive workbook, `27 year end bi monthly .xlsx`, was inspected in Chrome without editing any cells. The `AUG26-SEPT10` and `SEPT11th- Sept25` sheets establish the layout: period title; Name, Rank, Shift, Drill, Work Detail, Call Back, Acting Officer, Holiday, Total, Rate, Pay; alphabetical employees with adjacent premium rows; blue overtime, yellow Acting Officer, green holiday; and a totals footer.

Payroll now provides **Export Excel** for a formatted `.xlsx` and **CSV** with the same column order. DPW appears as a separate column only when used, with purple DPW rows. The download includes every employee on the selected payroll, independently of screen search/status filters. It does not copy reference-workbook hours, rates, or historical totals into the app.

The existing shared payroll calculation remains authoritative. Straight-time Work Detail combines into the employee's regular row when the amount reconciles exactly; rare fractional-cent differences keep separate rows. Overtime, holiday, DPW, and AO stay at their own rates. AO hours remain an allowance, not additional worked hours. Excel uses numeric hours/rates and simple cached formulas for row totals, pay, and the final total. Fractional-cent rates remain visible. A Rates & notes sheet records the app period's rates, status, scope, and color key.

Excel generation is lazy-loaded and runs in the browser with no new database request or storage. Export is blocked while the period is loading or hours are unsaved, in flight, or failed. CSV quotes fields and neutralizes formula-like employee text. The toolbar's fields and export buttons remain readable in either theme.

Validation: production build and changed-file ESLint passed; 24 focused calculation/export/rounding tests passed, including 80 mixed-rate/DPW/boundary combinations, fractional-cent reconciliation, empty payroll, CSV escaping, and XLSX read-back. The generated fictional workbook was imported and recalculated independently with Artifact Tool; formulas showed no errors, gross reconciled, and both sheets were visually checked.

The reference workbook and real hours, rates, employees, and payroll status were not changed.
