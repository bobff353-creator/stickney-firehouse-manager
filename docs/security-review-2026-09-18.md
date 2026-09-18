# Security review — September 18, 2026

## Scope and release identity

Reviewed `D:\stickney-scheduler-member-release`, branch `codex/scheduler-member-release`, GitHub repository `bobff353-creator/stickney-firehouse-manager`, Vercel project `prj_RTtTvD39FwyEGUovkPg8wxrdJCtF`. The requested first push published the prior three-pass update, commit `8fbc73d6b65be2ec5acced64461f5aad09e4f417`. Its deployment was READY and the canonical `stickney-firehouse-manager.vercel.app` alias was verified.

Production `/api/health` confirms the dedicated Stickney Supabase project `datqzdndkrfyovhwppuq`. No payroll, log, scheduling, dispatch, apparatus or employee records were edited for this review. No credentials were rotated, messages sent, or live accounts created.

## Fixes

- Updated Next.js to 16.3.5, React/React DOM/server components to 19.2.8, the image decoder and affected development dependencies. Applied compatible lockfile security fixes without a forced downgrade. The production-only npm audit has zero known findings; the full audit decreased from 23 findings (including one critical and 15 high) to four moderate development-only findings.
- Push registration now accepts recognized browser push services and correctly sized subscription keys, not arbitrary HTTPS URLs. CAD delivery, scheduling delivery and personal test delivery also validate existing saved subscriptions before network access. Invalid stored subscriptions use the existing permanent-failure retirement path. The live provider inventory contained FCM, which remains supported; no live notification was sent.
- Sign-in and activation reject cross-site or missing-origin POSTs before accessing credentials. The origin check uses the actual Host rather than a caller-supplied forwarded-host override and accommodates Next's internal localhost route URL. Existing same-origin sign-in remains supported.
- Confirmation return URLs are parsed and constrained to the same origin, closing the backslash/protocol-relative redirect case.
- Preplan photo upload rejects active SVG and disguised HTML using passive-format signature checks. This is not a complete image decoder or malware scanner. JPG, PNG, WebP, GIF, HEIC, HEIF and AVIF photos remain supported. Failed metadata writes now await upload cleanup and return a generic error.
- Eight authenticated file-serving route families now send a sandboxed content security policy and no-sniff header, including existing/legacy attachments. The sandbox has no scripts or same-origin privilege. Existing files were not deleted or transformed.
- Removed the framework-identification response header.
- Applied and verified two narrow database migrations: anonymous callers cannot execute the already owner-guarded department-creation function; activation-attempt rate-limit records now have RLS and no anonymous/member table privileges. The signed-in owner grant and server activation executor remain intact.

## Access-control review

Inspected API proxy authentication/membership/PIN checks, same-origin mutations, overwritten identity headers, server permission checks, employee identity/rank/admin edit restrictions, department-scoped inventory sessions and storage, signed dispatch/webhook handling, and server-only SQL boundaries. Existing regression tests exercise member/admin denials and the database permission boundary.

Live metadata checks confirmed both storage buckets are private. After the migrations, all tables in the public and firehouse schemas have RLS. Direct member SELECT grants in firehouse are limited to the two live-view lease tables; operational records use the existing server-authorized API boundary. This is not a claim that every database policy was exhaustively penetration-tested.

Targeted tracked-source and built-browser-bundle scans found no matching secret tokens/private keys. Only `.env.example` appears in the tracked environment-file history. These are scoped scans, not proof that a secret has never leaked.

## Verification

- Production build and TypeScript checks passed on Next.js 16.3.5.
- Focused security, login and notification suite: 33 tests passed. Follow-up origin/proxy tests passed after correcting the localhost/Host handling.
- Scoped ESLint passed with no errors or warnings after cleanup.
- Actual local HTTP responses: foreign-origin login/activation return 403; valid-origin empty input returns ordinary 400 validation; all eight file-route families include the sandbox policy. Without local production credentials, protected-file requests fail closed with 503; no protected file contents were inspected locally.
- Browser check of the upgraded local sign-in page: meaningful content and controls rendered, no error overlay or captured console errors. No real credentials were entered and a complete real-account sign-in was not claimed.
- Database grants and RLS were re-queried after both migrations. Supabase's anonymous SECURITY DEFINER warning is gone.
- Final full regression suite: 957 tests passed, zero failures, zero skipped. Live release verification is recorded in the task handoff.

## Remaining decisions and limits

1. **Rotate the previously pasted Supabase personal access token if still active.** Replace the backup-monitoring credential through secure settings, then revoke the old token. No secret value is repeated here. Rotation was not performed because it could interrupt monitoring.
2. **First-time activation still relies on email plus employee number.** Requiring a verified email link before setting a PIN is recommended, but is a meaningful workflow change; approval was requested. Existing activation was not removed or disabled.
3. **Four moderate npm findings remain in the development-only drizzle-kit → esbuild-kit → old esbuild chain.** npm proposes a breaking downgrade to drizzle-kit 0.18.1. That downgrade was deliberately not applied. Do not expose the database studio/development server to untrusted networks. The production-only audit is clean.
4. Supabase still reports intentional signed-in SECURITY DEFINER entry points (PIN, membership and owner checks) and RLS-with-no-policy information for server-only tables. Removing these grants or inventing permissive policies would break security/workflows. Leaked-password protection remains disabled in provider configuration; enabling it and an administrator MFA requirement need a coordinated authentication review, particularly with this PIN-derived password flow.
5. This was a scoped application review, not a guarantee of complete security. No load/DoS attacks, destructive tests, real-record mutations, physical-device notification delivery, account recovery, or full authenticated penetration test were performed.

## References

- [Next.js Windows-hosted server advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36)
- [Next.js image optimization advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4)
- [React Server Functions advisory](https://github.com/react/react/security/advisories/GHSA-wx67-qw84-cm4g)
- [Supabase anonymous function execution guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [Supabase signed-in function execution guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Supabase server-only tables/RLS information](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Supabase leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
