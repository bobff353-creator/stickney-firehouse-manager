# Inventory and schedule filters

All four requested controls are included:

1. Inventory items has a visible Compartment / location filter scoped to the selected rig's saved IDs. Unassigned and orphaned saved locations remain reachable.
2. Bag, kit or tool box becomes available after choosing a location and lists containers saved in that location. Selecting one shows the container and its direct contents. Not inside another item shows items without a parent. Changing location clears the container selection; changing the builder rig clears both.
3. Saved schedules has separate rig and check-type filters, counts and a Clear action. These controls do not submit the Add or replace form. Filtered rows stay mounted and hidden so unsaved fields are retained when switching filters.
4. The main Checklist selector immediately limits the inventory list to that checklist. Include items from other checklists is an explicit option under Item filters; selecting a different checklist returns to the normal limited view. Search, location and container filters combine with this selection. Clear item filters retains the selected checklist and rig.

No database schema, API, operational record, checklist membership or saved schedule is changed by filtering.

Verification: 23 focused location-filter, workspace-filter/navigation, preview and fleet-duty tests passed. Real-component local browser checks verified compartment/container choices, location reset, checklist empty results and Clear recovery, saved-schedule type filtering and retained unsaved start time, with zero fixture writes. Both filter panels were checked at 390/820/1388 widths in light/dark appearance. Device/theme overrides were reset. TypeScript, changed-file ESLint, production build and diff checks are performed before publication; release and live read-only verification are recorded in outputs/inventory-filters-20261123.
