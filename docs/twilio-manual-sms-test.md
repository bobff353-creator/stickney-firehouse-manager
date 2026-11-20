# Direct Twilio trial SMS test

System Health & Backups offers a manual test only to Bob's verified Stickney
administrator session. The API accepts only `confirmed:true`; recipient, sender,
message, links and attachments cannot be supplied by a caller. The approved
recipient is checked against its digest and only its last four digits appear in
the UI and saved receipt. The personal phone number and credentials are server
environment settings, never public variables or source values.

Set the seven `TWILIO_SMS_TEST_*` server settings in `.env.example` for a reviewed
test. The flag defaults false; use a new version-4 UUID and a short UTC expiry.
The endpoint refuses a Twilio account unless a live account lookup reports
`type=Trial` and `status=active`. There are no billing, provisioning, purchase,
scheduled-send or automatic-notification calls. Copy the Twilio-assigned trial sender;
the fixed `sms_customer_support` template is required by the limited trial.

The existing `system_meta` table stores a department-and-run-specific receipt
before provider I/O. Only the request winning that atomic insert can send.
Repeated or concurrent requests, timeouts, lost acknowledgments and failures
never resend that run ID. A new run requires an explicit reviewed configuration
change; never delete an old receipt to retry.

Refresh uses only GET at Twilio to check the saved message ID. Accepted and Sent
are different from Delivered. A provider delivery report is different from Bob
confirming receipt on his physical phone. Never infer either from fixtures.
After testing, set the test flag false for future deployments; the consumed
receipt and expiry also prevent another send from the running release.

Keep `INSPECTION_EMAIL_SENDING_ENABLED=false`,
`CHIEF_EVENT_EMAIL_SENDING_ENABLED=false`, and `OUTLOOK_EMAIL_TEST_ENABLED=false`.
No Power Automate connection is needed or created for this integration. No
database migration or operational-record changes are needed.
