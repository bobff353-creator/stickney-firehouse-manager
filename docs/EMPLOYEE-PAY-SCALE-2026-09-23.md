# Employee rank and pay scale clarity

The employee editor displayed duplicate Deputy Chief labels without rates, making the intended scale difficult to identify. The existing Babinec assignment already uses the $29.72/hour scale. This release changes the interface, not any saved employee, rate, permission, or payroll record.

The Rank & pay section shows the scale label and straight-time hourly rate for the selected payroll period. Payroll managers can open Rates & Rules with that scale highlighted and assigned employees identified. A return button goes to the employee roster. Unsaved employee changes must be saved or canceled before opening shared rates. Existing server permissions and effective-date rules remain in place. Users without payroll management access see an access explanation rather than redacted zero rates.

Employee input text and rate row text use explicit dark colors on their light backgrounds so they remain readable in dark mode.

## Validation

- Production build and targeted ESLint passed.
- Four existing pay-rate-history and employee-readability tests passed.
- Fictional browser fixture verified duplicate-rank selection, correct edit target, unsaved-change gating, permissions, and 343-pixel mobile layout. It blocks application requests.
- Production data was read only; no employee assignment, rate, administrator access, or payroll was changed.

Deployment and live verification receipt will be appended after publication.
