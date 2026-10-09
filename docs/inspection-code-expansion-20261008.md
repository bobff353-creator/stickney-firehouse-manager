# Inspection code library expansion — October 8, 2026

This release adds 600 distinct section or clause references to the existing
Stickney library: 150 each for IBC 2009, NFPA 101 (2027), NFPA 101B (2002), and
local ordinances. These are additional locators, not renumbered copies of the
existing starter entries. Existing codes, administrative edits, archives,
inspection citations, and audit versions remain unchanged.

| Filter | Prior entries | Added | Expected total |
| --- | ---: | ---: | ---: |
| IBC 2009 | 150 | 150 | 300 |
| NFPA 101, 2027 | 25 | 150 | 175 |
| NFPA 101B, 2002 | 21 | 150 | 171 |
| Local ordinances | 34 | 150 | 184 |

The separate Illinois state-rule reference remains present, yielding 831 total
entries. One prior IBC reference was already archived during the verified
baseline, so the initial active totals are 299 IBC and 830 overall. Displayed
available counts are computed from the actual active department records
rather than these expected totals. The prior archive is preserved.

## Source verification

- **IBC 2009:** the complete 2009 book published by the City of Natchez at
  https://www.natchez.ms.us/DocumentCenter/View/1046/2009-International-Building-Code.
  Each added number and subject was checked against its printed heading in
  the source PDF. Each locator includes its one-based PDF page. The new set
  contains 60 fire-protection, 60 egress, and 30 fire-resistance/separation
  references. Do not treat the source-hosting city's jurisdiction as Stickney's.
- **NFPA 101, 2027:** final-edition contents viewed in the publisher's official
  signed-in reader at https://link.nfpa.org/free-access/publications/101/2027.
  Each added number and subject appears in the published contents, including
  occupancy-specific sections. Reserved chapters were excluded. This pack
  verifies section identities and topics; its observation aids do not restate
  the complete requirements or claim that every exception was reviewed.
- **NFPA 101B, 2002:** actual printed section numbers read directly from the
  publisher's scanned final-edition reader at
  https://link.nfpa.org/free-access/publications/101b/2002. Viewer pages 18, 19,
  20, 32, 34, 35, 36, 37, 38, and 39 contain the 150 added locators. The viewer
  page number is explicit in each entry; it is not the printed book page.
  These additions cover walking surfaces, doors, elevators, capacity, exit
  counts, and arrangements in Chapter 5 (new construction).
- **Local ordinances:** the Village of Stickney's published municipal version
  dated May 26, 2026, viewed on October 8, 2026, at
  https://library.municode.com/il/stickney/codes/code_of_ordinances.
  New references comprise 66 Chapter 34 fire-prevention/private-hydrant
  clauses, 35 Chapter 18 Article X emergency-radio clauses, 33 distinct IFC
  amendments within 34-2(6), and 16 building-safety/occupancy clauses.
  The JSON retains each published local provision, including its numbered
  children where applicable, with chapter/article source links. Whole parent
  provisions and their children are not counted twice. IFC amendments were
  checked directly in 34-2, separately from the existing IBC amendments.

All four source sets were checked on October 8, 2026. No missing section
numbers, threshold values, or substantive requirements were extrapolated.
Model-code rows provide actual locators with original observation aids, not
copies of complete copyrighted books or automatically issued violations.

## Adoption and interpretation

Stickney 18-101 publishes IBC 2009 adoption; 18-102 contains IBC changes.
Section 34-2 separately adopts IFC 2009 with amendments under Ordinance
2015-02. The NFPA 101 (2027) and NFPA 101B (2002) packs remain explicitly
marked **ADOPTION NOT VERIFIED**. Illinois section 100.7 identifies NFPA 101
(2015) with modifications; it does not establish Stickney adoption of 2027.

Local code publication includes older references and ambiguous wording.
In particular, radio provisions 18-351(b), 18-353 and 18-358 must be read
with the complete article and 18-365 exemptions. Published wording and
cross-references are retained, with an authority-clarification note, rather
than silently corrected. The codification date is not an assumed effective
date. Confirm governing authority, occupancy, new/existing scope, state
requirements, exceptions and approved plans before issuing a citation.

## Additive loading

`scripts/inspection-code-expansion.mjs` reads the four expansion JSON files,
checks 150 entries per set and rejects duplicate locators/IDs. It generates
SQL but does not connect to or mutate a database itself:

```text
node scripts/inspection-code-expansion.mjs <verified-department-id> <output.sql>
```

Use only the verified authorized department ID. The existing seeding function
inserts entries and their initial audit versions in the same SQL statement.
Stable department-scoped IDs and `ON CONFLICT(id) DO NOTHING` make reruns
preserve saved edits and archives. Do not replace this with an update/upsert.
No schema or permission changes are needed.

Before and after loading, compare the counts and hashes of all prior entry
and audit rows, including other departments. Verify the real Code library
filters and a newly added source locator after deploying the committed
release. Fixture tests alone do not establish production completion.
