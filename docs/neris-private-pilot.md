# Private NERIS reporting

Prepared September 29, 2026. Owner: `bobff353@gmail.com` only. Route: `/?display=portal&page=neris-reporting`.

## Scope

The form covers every top-level field in the official IncidentPayload, including all base fields, and the 149 schemas reachable from that payload. Thirteen sections cover identification, location, dispatch, units/personnel, aid/actions, fire/medical/hazmat details, emerging hazards, exposures, risk reduction, casualties/rescues, narratives, attachments, and review. Optional modules have explicit add controls and unanswered booleans remain unanswered. Fire/medical/hazmat sections follow selected incident types. Advanced geometry is entered as verified GeoJSON; no geocoding or map-drawing integration is claimed.

Draft, locally reviewed, correction, archive, saved revision history, private file download, print, and a JSON review package are available. Official NERIS submission and server validation are not connected. Reviewed is a local state; neither a save nor an export is an acceptance receipt. No outgoing messages or emails are generated. A saved CAD call can be reviewed and copied into a new draft, without inferring final incident classifications or timestamp meanings.

## Source precedence and review

- Current API: https://api.neris.fsri.org/openapi.json — pinned version **1.4.78** with original SHA-256 and retrieval date in `app/neris/schema.json`. `scripts/update-neris-schema.mjs` is an explicit maintenance action, not a scheduled update. Review schema changes and migrate existing drafts deliberately.
- Published Python package: https://pypi.org/project/neris-api-client/ — version 1.5.5 released July 29, 2026. Client version numbers differ from API version numbers. Reviewed as an integration reference; no Python runtime dependency was added to this Next.js app.
- Official Python client: https://github.com/ulfsri/neris-api-client — reviewed authentication, incident validation/create/patch, status updates, listing, station/unit methods and integration enrollment. Its generated models may omit specification detail; retain the full current OpenAPI definition as the validation source. OAuth client credentials and token handling belong only on the server. This pilot does not install or execute the Python client, create credentials, enroll an integration, or submit any incident.
- Official implementation notes: https://github.com/ulfsri/neris-framework
- Illinois OSFM: https://sfm.illinois.gov/iam/firedepartment/national-emergency-response-information-system--neris-.html
- Illinois compliance snapshot: https://sfm.illinois.gov/content/dam/soi/en/web/sfm/iam/firedepartment/neris-documents/NERIScompliancereport.pdf — lists Stickney Fire Department as FD17031679, separately from Central Stickney. A user must explicitly choose to use the published ID and confirm the NERIS department profile.
- Enrollment: https://sfm.illinois.gov/content/dam/soi/en/web/sfm/sfmdocuments/documents/neris-website-documents/NERISIntegrationEnrollment.pdf
- Partner process: https://neris.fsri.org/integration-partners — reviewed September 29, page updated September 28. Vendor account/integration, FSRI test enrollment, create incident, update its UID, create station/unit, and official compatibility check precede any compatibility claim. No request has been filed by this build.
- Core workbooks: https://neris-prod-public.s3.us-east-2.amazonaws.com/docs/NERIS_V1_Core_Schemas.zip — original hash `39b1cb9762d249c6ede644a98e527862d386a87ff64d3a981944669d2e5247d9`.
- Secondary workbooks: https://neris-prod-public.s3.us-east-2.amazonaws.com/docs/NERIS_V1_Secondary_Schemas.zip — health/safety, incident analysis, community risk reduction and their type tables. The workbooks label their framework November 2024 and explicitly refer development to the current API; they are not proof of a live secondary integration. Do not place responder-identifying health information in an official export without an approved schema/privacy mapping.
- Supplied User Reference Guide V1.4, June 21, 2026: https://neris-dev-public.s3.us-east-2.amazonaws.com/docs/NERIS-User-Reference-Guide-V1.4_21JUN2026.pdf — 118 pages. Reviewed workflow, statuses, no-activity process and incident sections, with direct page links in the editor. Local validation adds an explicit location and report-writer review safeguard, labelled as local review requirements.
- Six supplied one-page incident-type diagrams were read and compared with the API: fire, medical, hazardous situation, rescue, public service and no emergency. Links appear beside category selection and in setup; no answers are inferred from the diagrams.
- Product reference: https://www.firstdue.com/products/neris — workflow/integration comparison only, not an authority for NERIS requirements.

Core incident workbook comparison: 128 active rows versus 130 API choices. The API adds MEDICAL||ILLNESS and MEDICAL||INJURY; BACKOUNTRY_RESCUE in the workbook is BACKCOUNTRY_RESCUE in the API. The current API values are retained. No workbook example incident data are seeded into production.

## ESO reference boundary

Navigation-only review covered the visible core, location, times, resources and one unit, narratives, emerging hazards, exposures, risk reduction, casualty/rescue tabs, and attachments. No fields were edited and Save was not pressed. ESO's last-saved timestamp nonetheless advanced during navigation and the validation count changed; interaction stopped immediately. Conditional flows requiring edits were not exercised. Full ESO behavioral parity is **not** verified. Billing, ePCR/NEMSIS, IRWIN, vendor-specific lookups, mapping autocomplete, remote unit synchronization, rich-text formatting, and external delivery are not claimed.

## Data and security

The API validates verified owner identity plus department context on every route, and checks same-origin writes. The pilot permission cannot be delegated through the permission catalog. Database tables have RLS enabled and all direct anonymous/authenticated table grants revoked; controlled server SQL performs the writes. The private storage bucket separately verifies the actual authenticated owner, server request, and department membership. No public file URLs or client secrets are exposed.

Report and revision writes are atomic. Versions reject stale saves, identical retries return the previously committed record, reviewed reports require a reason to reopen, and failed writes keep the local draft. Recovery data are tab-scoped, expire after 24 hours, and preserve the original version. Reopening a stale recovery cannot silently overwrite a newer record. Archives retain history. Retention policy and official record handling must be approved by the department.

File uploads enforce 4 MB, an allowlist, content signatures, department ownership, draft/version checks, and metadata/storage cleanup on failure. Files are downloaded through the authorized endpoint with no-store and attachment headers. There is no file-delete UI. The pilot uses manual refresh, with no recurring polling.

## Validation evidence

- Thirteen focused tests cover private access, all official field coverage, malformed drafts, schema enums/formats, conditional rules, duration calculations, atomic saves/retries/conflicts, rollback, corrections/archive history, and private attachment round-trip/failure cleanup.
- Existing portal navigation, wayfinding, permissions, and permission-enforcement checks pass after the fixture includes the new owner-only permission.
- Production build, TypeScript and scoped lint pass.
- Local browser: blank report, official incident choices/search, unanswered fields, conditional alarm branch, failed save/retry, recovery, time entry with explicit offset, saved report reopening, and phone/tablet/desktop layouts, category search, and saved timestamp/offset surviving a reload.

Official end-to-end submission, receipt reconciliation, approved partner compatibility, and actual secondary-schema delivery remain pending external setup. These limits are visible in the app.

## Production verification

September 29: deployed to the verified Stickney Vercel project. The signed-in owner saved and reopened test/NERIS reporting verification (record eeb6bb9e-89f8-4103-ac0b-1bf38b91da33, version 1). Database confirms the test flag and revision. Live validation reports the expected nine missing items for this deliberately unanswered draft. Anonymous requests and spoofed owner headers both receive 401. Chrome blocked automated file selection, so a live attachment upload is not claimed; local endpoint tests cover upload/download and failure cleanup. No official NERIS connection or submission was made.
