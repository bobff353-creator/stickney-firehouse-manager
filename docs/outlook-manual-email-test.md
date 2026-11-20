# Manual Outlook email test

The System Health & Backups test is restricted to Bob's verified administrator
session in Stickney department `14a76771-4c24-481b-8def-e6cce005c17b`.
It sends no operational records or attachments. The recipient is fixed to
`bwyant@stickneyfire.com`; the API rejects recipient and message overrides.

The feature defaults off. A reviewed test needs server-only settings
`OUTLOOK_EMAIL_TEST_ENABLED=true`, `OUTLOOK_EMAIL_TEST_RUN_ID` (UUID), and
`OUTLOOK_EMAIL_TEST_WEBHOOK_URL` (the signed HTTPS Power Automate endpoint).
Never expose the signed URL in a public variable, source, browser response or log.

Each run ID permits at most one provider invocation across clicks, concurrent
requests and server instances. A receipt in existing `system_meta`, keyed by
department and run ID, is reserved before calling the provider. Reserved or
unconfirmed attempts must be checked in Outlook before authorizing another run ID.
Do not delete a receipt to retry. There is no automatic retry or cron caller.

Power Automate must independently fix the recipient, subject and body, require
the approved request ID and `testOnly=true`, impose a short test window, and
disable the Send email action's retry policy. Its Response action runs only after
Outlook succeeds and returns HTTP 200 with `status: Accepted`, the fixed recipient
and matching request ID. HTTP 202, failures and timeouts remain unconfirmed.
Acceptance does not prove inbox delivery; verify the matching reference in Bob's
mailbox separately. Turn off the flow after testing.

This feature does not enable inspection report sending, calendar invitations,
scheduled messages or other notification channels. Preserve the production
`INSPECTION_EMAIL_SENDING_ENABLED=false` setting. Authentication and inbound CAD
email processing are separate existing functions.
Department event invitations also default off unless
`CHIEF_EVENT_EMAIL_SENDING_ENABLED=true` is explicitly configured. Keep it false.

No database migration is required. Source checks and fixture tests are not a
claim of real app-to-Outlook delivery. Record the release, flow run, receipt and
inbox evidence after the live test.
