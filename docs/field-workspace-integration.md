# Stickney preplan workspace integration

The Maps & Preplans module uses the existing Stickney portal, verified department
session, canonical preplan IDs, hydrant IDs, permissions and private storage.
It does not embed Arrival or create a second operational database.

## Field workflow

- Map opens on the department. Map/List share search and building/hydrant filters.
- Street/Satellite reuses `/api/maps-config` and the existing Google browser key.
  The fallback uses aligned Cook County 2025 imagery for the Stickney area and
  OpenStreetMap streets. Existing outlines remain editable in Building details.
- Quick preplan: address and confirmed map position, essentials, save as a draft.
  An outline, contacts, equipment and photos can be added afterward. Unknown
  construction, floor count or sprinkler facts do not create a fire-flow estimate.
- Quick observations are separate, unreviewed field notes, optionally with a
  private photo. They appear beside the linked building without replacing its
  approved information. They are not automatically dispatched or published.
- Hydrants open to Maintenance, Flushing and Flow update. Full guided flow tests,
  profile edits, archiving and existing history remain available. Recorded flow
  updates are distinct from calculated available flow in a full test. Neither
  flushing nor a flow update automatically changes service status.
- Hydrant icons use recorded GPM colors; unknown flow stays visibly unknown.
  Out-of-service hydrants remain individual symbols when other hydrants cluster.

## Reconciliation

The reviewed comparison covered 70 Stickney-owned FlowMSP locations and 212 owned
hydrants; regional/shared department datasets were excluded. The prepared import
adds 53 missing buildings to the 23 existing plans, reuses all 212 hydrants, links
65 existing address-queue rows, adds 185 recorded flow values without inventing
test dates, and identifies 33 unique missing photos. Existing 109 photos and 13
documents keep their original IDs and private file keys.

Existing building rows, operational features, levels, rooms, alerts, revisions,
reviews, photographs, documents and hydrant profiles are preserved. New buildings
are drafts; importing records is not a new visit, approval or field verification.
Full FlowMSP details and original outlines remain in the private source archive.
Invalid outlines are retained there and flagged rather than repaired by guessing.

Eight identity questions remain held: two original legacy plans and six address
queue entries. Distinct mapped campus structures remain separate. Held queue
entries show Review match and do not create a new plan automatically.

The import script consumes a local before-change snapshot, reviewed reconciliation
package and current FlowMSP export. Those private inputs and original file bodies
are not committed. The rehearsal verifies original rows and repeat-run counts.
Production import used a transaction guarded by original table fingerprints.

## Boundaries and verification

The two additive migrations enable department RLS and require the existing signed
portal server proof for the new source, service-event and observation tables.
There is no anonymous table access or new account sharing. New write routes check
the existing field permissions and same origin; photo import additionally checks
the reviewed photo ID, owning plan, content hash, size and passive image signature.

Quick preplans, observations, maintenance and recorded-flow entries preserve an ID across retries.
Failed saves keep their forms open. These are online saves; no background sync or
physical-device camera acceptance is claimed. Existing publication and review
tools remain the authority for approved preplans.

Automated verification covers the additive schema, signed-server boundary,
permissions, wrong-origin requests, missing/archived hydrants, validation,
retry conflicts, draft creation without invented geometry, separate field notes,
flow precedence, and the existing preplan/hydrant/Respond regression suite.
Browser verification uses isolated fixtures for writes and real production data
for read-only checks and the explicitly requested missing-photo import.

Release results, exact revision, deployment, record-preservation comparisons and
screenshots are recorded separately in the task's private verification report.
