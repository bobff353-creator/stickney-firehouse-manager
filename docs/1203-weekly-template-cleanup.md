# 1203 Weekly checklist correction

The September 17, 2026 request removes the annotated compartment/equipment groups
from **Weekly inspection**, not from Inventory or from the equipment catalog.
The saved `inventory_equipment.check_types` configuration drives both the template
editor and newly started checks; no UI hiding or application redeployment is needed.

## Scope

- Dedicated project: `datqzdndkrfyovhwppuq` (Stickney Firehouse Manager).
- Department: `14a76771-4c24-481b-8def-e6cce005c17b`.
- Apparatus 1203: `221ef2ce-2a51-4450-bc2a-62d6b6ecefe6`.
- Remove only `weekly` from 176 active equipment records in the 17 exact groups
  listed in `scripts/sql/1203-weekly-template-cleanup.sql`.
- Keep all other check types, especially `inventory` and `air_pack`.
- Keep Vehicle (15), Front Tires (2), Rear Tires (4), Pump / Booster Tank (3),
  and SCBA (11): 35 Weekly entries remain. SCBA removal was not confirmed.
- Never modify or delete existing checks, check results, or equipment records.

## Apply and verify

This is a one-time manual configuration correction, not an automatic migration
that should override later template edits. Save an exact before-state of the
equipment IDs and `check_types` outside Git before running it. The local execution
backup is under ignored `outputs/1203-weekly-before-2026-09-17.json`.

Run `node --test tests/inventory-1203-weekly-template.test.mjs` before applying.
The SQL is transactional, tenant/apparatus scoped, and permits only 176 changes
or an idempotent no-op. Any other affected count aborts the transaction for review.

Verify 35 active Weekly items, no Weekly tags in the 17 removed groups, and
unchanged Inventory/Air Pack membership. Compare all equipment IDs and tags with
the before-state. Verify existing checks/results are unchanged and confirm both
Weekly and Inventory in the signed-in template editor.

Existing in-progress checks retain their starting snapshot. The existing 1203
Weekly check has 212 snapshot items and must not be silently rewritten or canceled.
The corrected 35-item template applies when a new Weekly check is started after
the existing one is properly closed through the department workflow.

If rollback is authorized, restore the affected IDs' exact original `check_types`
from the local before-state, checking for intervening edits first. Do not rerun
the original equipment seed or modify other apparatus to undo this correction.
