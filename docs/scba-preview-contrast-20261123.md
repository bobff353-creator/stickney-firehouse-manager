# SCBA setup and member preview contrast

The legacy bento stylesheet kept dark SCBA editor and preview row backgrounds while the Watchline workspace applied dark text for light mode. This made position labels, the RIT option, spare-bottle label, item names and location text difficult to read.

Scoped overrides now use the existing crew theme colors for both surfaces and text. Changes are limited to the SCBA template card and read-only member preview. Controls, disabled preview behavior, saved templates, check results, IDs and API handlers are unchanged. No migration or operational write is needed.

Local verification used real inventory components with fictional fixture data. Both cards were inspected at 390, 820 and 1388 pixels in light and dark mode. Measured label/name contrast is 13.51–15.52:1 in light mode and 11.34–14.08:1 in dark mode; supporting text is 6.90:1 and 9.13:1 respectively. No horizontal page overflow was detected. Preview result controls remained disabled, and the fixture showed zero writes. Temporary device/theme overrides were reset.

Verification artifacts are in `outputs/scba-preview-contrast-20261123/`. This is CSS-only; no JavaScript unit tests were added and ESLint has no supported source change to lint. TypeScript, production build and diff checks are run before publishing. Deployment revision and live read-only screenshots are recorded separately in that output directory.

## Additional medication preview variant

The follow-up drug-inventory screenshot exposed a separate `.meter-check` card used for structured logging. Its background inherited a dark portal color while headings, preview status and fieldset labels used the light crew theme. Scoped member-preview overrides now pair card/header/fieldset surfaces with the crew palette and explicitly color titles, status, legends, labels, summary and supporting text. The same container styles also cover structured meter previews. Active check entry and all validation remain unchanged.

An isolated medication fixture exercises quantity, two container-expiration/location groups and comments. Expanded fields remain disabled in read-only preview. Both themes and 390/820/1388 widths were checked; zero enabled preview inputs or fixture writes. Artifacts and separate release evidence are in `outputs/drug-preview-contrast-20261123/`.
