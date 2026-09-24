# Payroll calculation correction

## Department instruction

Regular worked hours and Work Detail use the normal hourly rate. The user explicitly confirmed straight-time Work Detail on September 23. Overtime applies only to overtime hours at base rate times 1.5. Holiday hours and DPW hours use base rate times 1.5. DPW receives that multiplier only once, including for an employee marked DPW. AO is an additional allowance equal to AO hours times the saved AO rate, with no overtime or holiday multiplier.

The existing saved overtime threshold remains in use. This change does not alter recorded hours, employee rates, permissions, employment flags, or period status. Calculated views of historical periods also use the corrected formulas; previously downloaded reports are not rewritten.

## Verified discrepancies

- The September 11-25 DelGatto sheet contains 36 shift hours, 7 Work Detail hours, and 6 AO hours at a $23 base rate. Prior code added an $80.50 Work Detail premium. Corrected worked-hour pay is $989, plus the saved $6 AO allowance, for $995 gross.
- The Raygoza sheet contains 36 shift hours and 3 Work Detail hours at $20, with no AO hours. Prior code added a $30 Work Detail premium. Corrected gross is $780.

## Implementation

- One shared category calculation drives timesheets, payroll totals, CSV pay rows, and command-center cost allocations.
- Premiums derive directly from base rate times 1.5. AO reads its saved rate. DPW hours do not consume the overtime threshold, and DPW employees never receive additional overtime or holiday premiums.
- Command-center calculations select rates at the same pay-period boundary as payroll, and zero thresholds are honored instead of silently defaulting to 106.
- Pay lines round to cents; gross and CSV totals sum those same amounts. Premium hourly rates retain fractional cents until the amount calculation.
- The timesheet shows every nonzero pay line with hours, rate, multiplier, and amount. Worked hours exclude AO allowance hours. Inputs and dates are readable on the light table in dark mode.
- CSV separates categories that use different rates, includes DPW, and preserves source-hour totals across regular and overtime rows.

## Validation

Fictional tests cover the two reported examples, all ranks, overtime boundaries, zero thresholds, AO rates, mixed DPW/holiday/overtime, and fractional hours/rates. A matrix of 70 combinations reconciles calculation totals, each CSV hours-times-rate line, and command-center costs. Existing Daily Log, historical rate, save failure, lost-response, retry, concurrency, finalized-period, and atomic rollback checks are retained. Browser preview uses fictional data with all application requests blocked.

Release receipt will be appended after deployment and authenticated live verification.
