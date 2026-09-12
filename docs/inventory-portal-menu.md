# Inventory portal navigation

Implementation and pre-release verification record. Base: `348ef2336a2a1ab4e4baf158a6b1fa2bcc195242` on `codex/scheduler-member-release` in the verified Stickney repository. The user subsequently authorized push/release; deployment identity and health evidence are recorded separately under `outputs/inventory-portal-menu/` after verification.

## Change

Inventory keeps its existing workspace, inspection flow, barcode controls, apparatus selection, and records. Its upper-left Station Duties shortcut is replaced by the portal's familiar Show menu control (compact icon on phones). The drawer uses the same department patch, navigation labels, grouping, destinations, and permission mapping as the main portal. Station Duties remains available under More tools.

The shared menu configuration is extracted from the main portal without changing its grants. The menu consumes Inventory's already-verified current permissions; it adds no permission hook, operational data loader, notification feed, or polling timer. Server-side authorization and required-confirmation gates are unchanged. Main portal links use full-page navigation without prefetching operational workspaces. Current Apparatus Checks selection closes the menu without remounting/resetting Inventory or discarding its apparatus/check context.

The menu defaults closed. A native modal dialog keeps keyboard focus inside and background controls inert. Close, Escape, outside tap, and selecting a destination close it. Closing restores focus and body scrolling. The menu honors the existing cancelable portal navigation guard; it does not introduce autosave or new draft persistence. Its menu list scrolls independently and respects safe-area insets.

## Verification

- `node --test tests/inventory*.test.mjs tests/permissions.test.mjs tests/permission-enforcement.test.mjs tests/mobile-phone-layout.test.mjs`: **105 passed, zero failed/skipped**.
- Targeted ESLint on the menu, shared configuration, Inventory shell and main portal: passed.
- `npm run build`: passed, including TypeScript and production route generation.
- `scripts/audit-inventory-portal-menu.mjs`: **29 layout/interaction states passed** in the real React components using fictional browser-only API responses.
- Render sizes: 1213×666, 1024×768, 768×1024, 390×844, 370×666, and 844×390. Screenshots checked for menu placement, clipping, scroll containment, and content visibility.
- Browser checks covered initial closed menu; More tools; current-page selection; canceled navigation; Escape/focus restoration; Close; outside click; unfinished numeric entry preservation; and saved inspection progress preservation.
- Permission checks covered a regular member without Live Operations, an individual grant while open, grant removal while open, failed access verification, reconnect, and Inventory access removal. Failure/revocation unmounts the menu and restores scrolling.
- **Measured in the isolated browser fixture:** repeated menu interactions caused zero additional operational API requests and zero writes at all six viewport sizes. Existing permission checks continue unchanged. No production usage savings are inferred.
- Results and screenshots: `outputs/inventory-portal-menu/` (ignored local evidence).

## Limits

This is browser viewport emulation, not testing on physical iOS/Android/tablet devices. Browser data responses are fictional; no real check was submitted, edited, or deleted. Destination URLs are checked against the existing portal routing contract; authenticated production destination navigation was not included in the pre-release checks. There are no database migrations, security-policy changes, or hosting-configuration changes.
