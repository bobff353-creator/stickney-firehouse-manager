# Preplan detail editing

Quick preplan review now offers an Edit all preplan details action. Each unknown detail opens the corresponding existing full editor section: Building, Access & water, Systems & hazards, or Photos & sketch. All four photo sides remain available through the existing uploader. Permission checks remain in the workspace and existing APIs.

The transition carries the current draft directly, retaining IDs, revision, photos and unsaved values rather than restoring an older device copy. Cloud save, review and publication remain separate existing actions. No database migration or department record write is part of this change.

Validation: 16 Arrival domain, preservation and actual migration/API tests passed. TypeScript, production build and changed-file ESLint completed (existing warnings, no errors); git diff check passed. A fictional local browser fixture verified unknown-detail navigation to systems and all-side photo editing, light/dark contrast, and 390/820/1440-width layouts. No real preplan was submitted or saved during verification.

This follow-up also preserves the Checks workspace URL when selecting a rig, so a refresh keeps the chosen workspace.
