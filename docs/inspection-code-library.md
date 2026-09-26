# Stickney inspection reference library

The starter contains 150 curated IBC 2009 section locators and 34 Stickney adoption/amendment references. It is not a statistical ranking of violations. No inspection-frequency dataset was supplied. The administrator chooses which entries are Frequent.

## Verified sources

- [Current Municode adoption, section 18-101](https://library.municode.com/il/stickney/codes/code_of_ordinances?nodeId=MUCO_CH18BUBURE_ARTIIIBUCO_S18-101ADBUCO): May 26, 2026 version lists IBC 2009, including appendices C, E, F, G, H, I and J.
- [Current local amendments, section 18-102](https://library.municode.com/il/stickney/codes/code_of_ordinances?nodeId=MUCO_CH18BUBURE_ARTIIIBUCO_S18-102ADINDECH).
- [Village Ordinance 2015-03](https://www.villageofstickney.com/media/4gge4vnk/ordinance-2015-03.pdf), adopted March 17, 2015, corroborates the adoption and amendments.
- [IBC 2009 government-hosted source book](https://www.natchez.ms.us/DocumentCenter/View/1046/2009-International-Building-Code): all 150 section headings and PDF page locators were checked. Each catalogue tuple stores the one-based PDF page, not the book's printed page number. Catalogue wording is an original inspection prompt, not a copy of the complete code section.
- [Illinois Capital Development Board code FAQ](https://cdb.illinois.gov/business/codes/illinois-codes-faq.html): project date and state requirements can affect applicability. Published local adoption does not independently establish every project's governing requirements.

Checked September 25, 2026. A 2024-or-newer IBC adoption was not found in the current municipal building-code article, so no speculative second-edition pack is installed. Administrators can add a verified edition separately. Building age does not automatically select an old edition.

Local references use edition 2009 to group with the IBC edition they modify; their applicability notes identify the 2015 ordinance and 2026 codification version. Unclear published wording in the hydraulic safety-factor and FDC fitting provisions is flagged for authority review, not silently rewritten. The base IBC entries flag related local amendments.

## Installing without replacing edits

`node scripts/inspection-code-seed.mjs <verified-department-id> <output.sql>` prepares a single atomic SQL statement. Execute it through the authorized database connection. It inserts deterministic department-scoped IDs and matching version-1 audit records. Rerunning inserts only missing entries and preserves edits, archived records and citation history.

The private pilot's existing owner-only boundary still controls viewing and editing. Library edits create new versions; past inspection citations retain the exact saved version. Filters search saved text, year, jurisdiction, topic and administrator-selected Frequent entries. Attached documents are stored as evidence and are not automatically full-text indexed.
