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

## NFPA 101 reference pack (September 25, 2026)

The user's open Chrome book was [NFPA 101, 2027](https://link.nfpa.org/free-access/publications/101/2027). The publisher's reader and section index were reviewed. The pack contains 25 original observation prompts, with verified section locators in Chapters 7–10, not verbatim code requirements or a ranked violation dataset. Section-level references intentionally require the inspector to locate the applicable subsection, occupancy chapter, exceptions, and referenced standards. Free-access links open the book; use its table of contents to reach the stored section number.

[Illinois 41 Ill. Adm. Code 100.7](https://my.ilga.gov/commission/jcar/admincode/041/041001000000070R.html) incorporates the 2015 edition with modifications, with some references to 2000. Sections 100.3 and 100.9 affect scope and equivalent/later editions. No evidence was found establishing Stickney adoption of NFPA 101 (2027). Every 2027 entry visibly flags adoption review, retains the explanation in saved citations/reports, and has no invented effective date. One separate State rule / 2015 entry links the adoption rule; it is not presented as a 2015 model-code pack.

`node scripts/inspection-nfpa-seed.mjs <verified-department-id> <output.sql>` prepares 26 append-only, department-scoped entries and their audit snapshots. Existing IBC/local entries and edits are untouched. The same atomic insert helper prevents duplicate seeds and preserves history.

Plan → Add checkpoints from code library works with both NFPA and IBC entries. Each addition preserves the reference description/version as its source, starts Not checked, and leaves actual observations and issued citations empty. Results are selected by the inspector; Findings has the separate verified-citation picker. Adding/removing a checkpoint invalidates signatures through the existing editor safeguards. No new database polling or background jobs are introduced.
