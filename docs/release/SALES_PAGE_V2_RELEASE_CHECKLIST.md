# AffiMatik Sales Page V2 — Controlled Release Checklist

Status: release preparation only. Production deployment is not authorized by this document.

## Immutable release facts

- Candidate branch: `codex/sales-page-conversion-v2`
- Validated application commit: `e08e76a85fea241e01fa03367d918e738847de13`
- Candidate parent: `ee0a3f0` (current production hardening source)
- Current production Worker version: `30c4471d-3223-48df-bf6d-46c6f316715d`
- Previous production Worker version: `4474b3d3-a3d4-4175-ad17-60262066d7c7`
- Staging Worker version: `44c9e323-f236-46d0-b398-4330a367c804`
- Production config: `wrangler.production.toml`

## Backup and database gate

- Backup receipt: `output/release/backups/2026-11-14T03-46-10-823Z/receipt.json`
- Encrypted database SHA-256: `02edd7853a83c76704b51f81d949e4a9b7be8274b4ee98d86ff219206aa0d8fc`
- Encrypted manifest SHA-256: `10779eb8d767e062595a2d65000221decfddbf5e167d1931c572db9c83bee275`
- Storage: 1 bucket, 141 objects
- Restore rehearsal: PASS, including migration 00028 applied twice
- Before/after preserved: 56 Auth users, 55 profiles/wallets, total wallet 2,170, reserved 0, 97 jobs, 14 orders, 63 products/images and all identity/row hashes
- Migration 00028 production state: NOT APPLIED pending owner release authorization

Migration verification before deploy:

1. Confirm no active release incident and that backup directory is still readable.
2. Apply `supabase/migrations/00028_conversion_events.sql` once inside an atomic `psql -1 -v ON_ERROR_STOP=1` transaction.
3. Confirm `relrowsecurity=true`; `anon` and `authenticated` have no table access; `service_role` has SELECT/INSERT.
4. Confirm unique constraints on `event_id` and `(event_name,dedupe_key)`.
5. Re-run wallet/job/order counts and hashes. Stop before Worker deployment if any existing-data check changes.

## Functional gate

- Eight sales sections: verified by focused tests.
- Tutorial assets: genuine uploaded H.264/AAC portrait MP4 files.
- Proof assets: matched source images plus NX17, NX01 and RH03 sample MP4 routes, labelled as Creative V6 rather than V10.1 output.
- Launch Pack intent: `/register?intent=launch_pack` persists through registration/login/email callback and lands at `/billing?intent=launch_pack#launch-pack` behaviour.
- Analytics: 11 event names; financial truth events are server-only; route fails open with HTTP 202; client cannot submit `payment_bank_verified`.
- Responsive QA: 375, 390, 430, 768 and 1440 px completed on staging with no horizontal overflow.
- Physical iPhone Safari: PENDING until a real device opens the protected staging page, plays proof/tutorial MP4, follows the registration handoff and confirms layout.

## Legal publication gate

Drafts are in `docs/legal/`. Before adding public `/privacy` and `/terms` routes, owner/legal review must confirm:

- legal owner/business name and registration number;
- business address, support telephone and effective date;
- processor locations and cross-border safeguards/consent;
- internal retention schedule;
- age/eligibility and detailed refund/cancellation policy;
- bilingual Privacy Notice publication.

These missing identity/disclosure fields are a publication blocker for the legal pages, not a blocker to code/build validation.

## Authorized deployment sequence (future owner approval required)

1. Reconfirm production version is still `30c4471d-3223-48df-bf6d-46c6f316715d`; if not, reconcile the newer release before proceeding.
2. Create another backup if this receipt is no longer the latest release-window snapshot.
3. Apply/verify migration 00028 using the database gate above.
4. Run tests, TypeScript, ESLint and `npm run worker:build` from the exact approved SHA.
5. Dry-run Wrangler with `wrangler.production.toml`; verify production bindings and secrets without printing them.
6. Deploy to `affimatik-production-v2`; do not modify routes, DNS, payment methods, pricing or provider secrets.
7. Smoke-check homepage, eight sections, all proof/tutorial media, registration intent, auth callback, Billing Launch Pack, dashboard, wallet, private media, queue/cron and checkout state.

## Rollback

If authentication, wallet, QR checkout, queue, private media or callback fails critically:

```powershell
npx wrangler rollback 30c4471d-3223-48df-bf6d-46c6f316715d --config wrangler.production.toml --message "Rollback Sales Page V2 critical regression" --yes
```

Do not roll back the additive conversion-events table blindly; the previous Worker does not depend on it and can coexist with it. Verify restored Worker health and preserve all customer records.
