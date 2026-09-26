# NFPA 101B egress reference pack

Verified September 25, 2026 in the user's open publisher reader:
https://link.nfpa.org/free-access/publications/101b/2002

Publication: NFPA 101B, *Code for Means of Egress for Buildings and Structures*, 2002 edition. Reader has 106 pages. This pack is separate from NFPA 101 and NFPA 101A. No Stickney adoption of NFPA 101B was established.

## Source checks

- Publisher table of contents: 4.1, 4.2, 5.3–5.15 and 7.1 section locators. Chapter 5 is New Construction; Chapter 7 concerns alterations, repairs or change of occupancy in existing structures.
- Reader page 18 (printed 101B–15): 5.1.3 walking surfaces, 5.2.1.2 door width.
- Reader page 19 (printed 101B–16): 5.2.1.4 door swing and opening force, with exceptions.
- Reader page 20 (printed 101B–17): 5.2.1.5 locks, latches and alarm devices; 5.2.1.5.3 stair reentry and unlocking provisions, with exceptions.

The 21 entries contain original observation prompts and section locators. They do not reproduce the book, encode numerical compliance thresholds, decide occupancy classification, rank violations, or claim adoption. Inspectors must read the complete applicable provision and exceptions before citing a deficiency. Inserting a checkpoint starts Not checked, with no observations or violation citations.

## Data preservation

`scripts/inspection-nfpa101b-seed.mjs` uses the shared department-scoped seed with deterministic IDs and `ON CONFLICT DO NOTHING`. It inserts reference/audit records together and never replaces department edits, archived references or citations retained in inspections. Existing code-library permissions and private-pilot authorization apply.
