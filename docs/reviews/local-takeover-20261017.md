# Local recovery of Dot's fixes

Recovered source: `43e42d37da93f933f15adfba9e33d674b512f8df`.
Verified base: `f8466609294970261d74e717256675e367aff66b`.
The incremental bundle passed `git bundle verify`; its SHA-256 matches the
handoff (`81eb7bb7c4fdde19de4e405dbb76046fa3e5bf3f636f0013d437ee33a7b7e7f3`).
All 13 original commits are preserved in a separate local worktree at
`D:/stickney-dot-release-20261017`.

## Backup branch versus production release

`codex/recovered-dot-20261017` is a source backup and review branch.
Its branch-specific `git.deploymentEnabled` setting is false. This prevents
Vercel's Git integration from automatically deploying this branch, including
previews which could otherwise inherit a production database connection.
Other branches retain their existing configuration. Explicit CLI deployments
are not disabled by this setting and must still follow release checks.

Production health and project identity were rechecked during takeover. The live
site still reports `f84666092949`. A read-only schema query confirms the required
instant columns are absent. The recovered application must not be released
before the reviewed additive migration and integration checks pass.

The user approved a local test environment with no paid cloud service. Windows
currently lacks WSL and a Docker-compatible runtime. Local setup and actual
Supabase Auth/PostgREST/RPC integration acceptance remain separate from PGlite
fixture tests. No production migration, operational record write, permission
change or paid provisioning is part of this source-backup push.

The earlier rollback-candidate API denial has not been retried. An executable
recovery plan must preserve occurrence selections after new-format records
exist; blindly deploying the older application can discard them on resave.

## Verification environment

Node 24.16.0 on Windows. The dependency lockfile exactly matches the previously
verified base checkout (SHA-256
`bc60e58d41c873327cb1e0b72ed9d2203ec171b1bbb2e606ec1f3f7c6ca63775`).
A fresh dependency extraction was incomplete and was stopped; its files were
preserved as `node_modules-incomplete`. The review checkout uses a local junction
to the complete, matching dependencies in the base checkout. An early test run
against the incomplete extraction is not acceptance evidence.

Fresh focused run: **67 passed, zero failures/skips/cancellations** using
`scripts/test-isolated.mjs` with repeated-hour, AO/DST, payroll access, atomic
saves, synthetic restore, dispatch bridge, email webhook, CAD outbox, payroll
submission API, table viewport and quarter-hour validation tests. External
networking and inherited provider credentials were blocked by the runner.
These are synthetic fixtures, not hosted Supabase integration acceptance.
Dot's historical full-suite counts remain historical, not a fresh-run claim.

The production build passed, including its TypeScript phase. Changed application
files passed ESLint with zero errors/warnings. Six localhost interaction flows
passed: employee search/edit/failed-save retention/retry, policy return,
timesheet day/period comparison, permission filtering, wide-table keyboard
scrolling and final-column action, and restricted member navigation. Cold local
module compilation exceeded the initial browser navigation timeout; the same
flows passed with a longer local-only timeout after compilation.

Rates & Rules and Callback Reviews were rechecked at 390, 768 and 1280 pixels;
all six page widths matched their viewports with no horizontal page overflow.
Screenshots and fresh command logs are local review evidence, not live proof.

Microsoft WSL 2.7.13 was installed using its official, digest-checked and
Microsoft-signed standalone installer after the Store package installer failed.
The required Virtual Machine Platform component and a possible Windows restart
are prerequisites to starting the local Linux/container environment. No hosted
database integration acceptance or live application release is claimed.
