# Inventory phone and camera fixes — 2026-09-17

## Scope and safety

This records the pre-deployment audit. Live inventory and apparatus records were not changed. Test pages use fictional records or synthetic camera images, not departmental photographs. No dependencies, permissions policy, database schema or environment variables changed. Deployment status is recorded separately in the release handoff.

## Changes

- Phone summary cards use two columns, with larger labels and readable Scan Barcode text. Setup progress, step buttons and VIN information fit narrow screens.
- Setup headings have explicit contrast on their light surfaces, including when device dark mode is active.
- Photo, equipment and VIN cameras share one recoverable dialog: permission/error messages, retry, native Take photo, Choose photo and manual-code fallback.
- Camera cancellation releases late permission grants; parent refreshes do not restart camera requests. The shutter waits for a usable video preview.
- A captured apparatus photo returns to the actual photo form with a preview and an explicit unsaved status. Saving remains a separate action.
- VIN scanning validates the full 17-character barcode value instead of truncating unrelated text. Barcode photos are supported. Printed letters without a barcode are not OCR-scanned; manual entry remains available.

## Verification

- Production build passed; final TypeScript and targeted ESLint checks passed.
- All 102 inventory/VIN tests passed: `node --test --test-concurrency=2 tests/inventory-*.test.mjs tests/vin-decoder.test.mjs`.
- Actual Inventory component exercised with isolated fixtures at 320, 390 and 1280 pixels. Phone workspace navigation had no document/control horizontal overflow; desktop smoke check had no console errors.
- Shared camera fixture verified permission denial, retry, cancel-before-delayed-permission, synthetic photo capture, and standard Code 39 / QR barcode recognition from both video and a photo. Closing/decoding stopped the synthetic stream. Parent refresh did not request a new camera. Test values were not saved.
- Fixture entry points: `/inventory-audit-app.html?role=admin` and `/inventory-camera-audit.html` through `node scripts/preview-portal-usability.mjs` (loopback only).

## Remaining real-device acceptance

Browser resizing and synthetic streams do not prove physical iPhone/Android hardware behavior. On the affected phone, check permission allowed/denied, rear-camera focus, capture, cancel/reopen, native photo fallback, and a real VIN barcode. Review the unsaved preview, then explicitly save an approved test photo and confirm it reloads. No production upload was performed during this audit. Large-photo upload limits and HEIC preview compatibility were not changed or verified.
