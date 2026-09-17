# Auto-Distribution assignment priority

Updated September 17, 2026 at the department administrator's direction.

1. Only active, qualified members whose saved Available blocks cover the full shift qualify. Blank dates, time off and conflicting assignments disqualify them. Existing recurring assignments are not modified.
2. Process each shift's Officer/AO, Engine Driver, Ambulance Driver and FF/Attendant positions in that order. Among qualified candidates, fewer scheduled hours wins.
3. Equal scheduled hours are resolved by higher rank, then earlier department start date. Exact ties use name and employee ID for repeatable results.

Hours are the union of active booked shifts starting within the From/End dates, including recurring assignments. Overlapping duplicate role rows count once. Each newly assigned shift adds its hours before the next choice. Retired imported shifts, payroll hours and the legacy manually entered hours counter are not ranking inputs. Legacy weight records remain stored but do not control this algorithm.

This change only fills future open positions when an administrator explicitly runs Auto-Distribution. It does not automatically run, replace existing assignments, or rebuild the October/November schedule.

Verification: pure comparator/hour-counting tests and route tests with an isolated PostgreSQL-compatible fixture. No production assignments are created by tests.
