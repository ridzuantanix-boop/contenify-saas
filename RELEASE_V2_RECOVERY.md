# AffiMatik V2 release recovery and external gates

Date: 6 November 2026. This is a release procedure, not evidence that production gates passed.

Public video generation is fail-closed in the V2 candidate. `AFFIMATIK_VOICE_PUBLIC_ENABLED` and `AFFIMATIK_MOTION_PUBLIC_ENABLED` must each be set to `true` only after that provider's quality, balance and storage gates pass. Until then the Factory shows the selected engine as unavailable and the production job API rejects customer generation before credit reservation. These switches do not enable paid checkout.

## Secure source candidate

- Local branch: `codex/launch-v2-audit`; baseline production commit: `5c5430b4f15cc1c426b969c4c5c793f73aa0d61f`.
- Check `git status --porcelain=v1 -b`, `git log --oneline -5`, and `git ls-remote --heads origin codex/launch-v2-audit` before publishing. Require the remote head to be an ancestor of the local candidate. Push normally, without `--force`.
- If Git authentication is unavailable, preserve `git bundle create <secure-local-path>.bundle main..HEAD` and run `git bundle verify <secure-local-path>.bundle`. A bundle does not publish the candidate.

## Backup and migration gate

**Production backup and restore rehearsal have not occurred. Do not run migrations 00012–00017 on production until they do.** The production dashboard reports Free Plan without scheduled backups; restore to a new project requires Pro Plan with physical backups. The owner must either enable that path or provide a complete manual database/Auth and Storage-object backup plus an isolated restore target. No database credentials were present in the local environment.

The owner selected the **manual backup** path on 6 November 2026. The handoff must include an encrypted `pg_dump -Fc` covering `auth`, `public` and `storage` metadata, a separate encrypted export of all private Storage objects, a manifest with counts and SHA-256 hashes, and an isolated restore destination. Do not send database passwords or service-role keys in the repository or report. Once supplied, verify checksums, rehearse restore, compare the preflight counts and only then try migrations 00012–00017 on that copy.

1. Record an immutable UTC timestamp, project ID, application SHA and the result of `scripts/v2-production-preflight.sql`. Record counts and sums for Auth users, profiles, workspaces, wallets, reservations, jobs, paid orders and commissions.
2. Take a database snapshot or `pg_dump -Fc` of the production PostgreSQL database with Auth, public and Storage metadata included, using a role permitted to read them. Keep connection credentials outside command output and source control. Encrypt the dump and record its size and SHA-256.
3. Export a manifest and copy of every object in the private `affimatik-assets` bucket, including key, size and SHA-256. Database metadata alone cannot restore MP4/image bytes. Keep the object backup encrypted and separate from the live bucket.
4. Restore database and objects into an **isolated** Supabase project or disposable PostgreSQL/Storage environment. Verify all manifest counts and samples of Auth users, wallets, reservations, old jobs and MP4 bytes. Record restore duration and any extension or role differences.
5. Apply migrations 00012–00017 in order to the restored copy. Re-run the preflight checks and compare every existing user, balance, reservation, order, job and media reference. Expected: no existing balance or record loss; only intended new schema and idempotent derived rows. Run the full automated suite against the candidate.
6. Take a fresh production backup immediately before the authorised release window. Record the rollback application SHA. If an application rollback is needed, redeploy the previous SHA; database reversal requires the validated snapshot and must never be attempted by automatically reversing these migrations.

The local PGlite migration suite verifies syntax and data invariants against fixtures; it does **not** substitute for a production copy restore rehearsal.

## External test gates

| Gate | Procedure | Expected result | Evidence needed |
|---|---|---|---|
| SMTP and inbox | Configure verified sending domain, DNS and custom SMTP in Supabase. Register a new isolated test address, request resend once, follow the received link, then log in. | One delivery, valid confirmation, one workspace and one 20-credit grant; no duplicate grant after resend. | SMTP configuration screenshot with secrets hidden, delivery logs, received message headers, user/workspace/wallet IDs and ledger query. |
| RunningHub Motion | Fund the account sufficiently, upload a test product image, submit RH01 with the complete compiled 15s prompt, poll and ingest the result. | Task accepted, 15s visual MP4 without spoken dialogue, product identity preserved, private stored output, single correct credit settlement. | Redacted request and response, provider task ID, provider charge, MP4 metadata and contact sheet, wallet ledger before/after. |
| iPhone Safari | On a physical iPhone, sign up/log in, generate or open a completed video, download it to Files, play it, and log in again. | Files contains a playable MP4; progress and library survive reload and session renewal. | Device/iOS/Safari versions, screen recording, saved file metadata and job ID. |
| Android Chrome | Repeat signup/login, Factory upload, Queue, Video Library, download and playback on a physical Android device. | No broken controls or horizontal overflow; playable MP4 and persistent job/library state. | Device/Android/Chrome versions, screen recording and job ID. |
| Provider cost and margin | For one Voice and one Motion task, reconcile provider balance before/after, Cloudflare usage, Supabase storage/egress, gateway fees and refunds against the approved plan prices. | Positive margin after reserves and no double customer charge. | Redacted provider invoices/ledger, infrastructure usage, gateway settlement and calculation worksheet. |
| Affiliate bank settlement | With authorised real payment and an approved affiliate, verify first-paid-order 10% accrual, 14-day hold, RM50 threshold, payout approval, bank settlement and refund clawback. | Exactly one eligible commission and payout; refunds reverse unpaid amounts or create a traceable clawback. | Order/affiliate/payout IDs, ledger states and redacted bank confirmation. |
| Historical MP4 | After backup, select one old completed job with a still-live URL, import once, repeat the same recovery, download the private result. | One stored object and metadata update, no new wallet event, repeat is a no-op. | Old job ID/URL validity, object key, SHA-256, wallet ledger before/after and playable MP4. |

## Dependency security

`npm audit --omit=dev --json` on 6 November 2026 reported **0 production dependency vulnerabilities**. Full `npm audit` reported **18 development-tree advisories** (2 critical, 5 high, 11 moderate), including direct `vitest`, `@opennextjs/cloudflare` and `eslint-config-next` packages. The suggested fixes involve major version changes or, for OpenNext, an old release. Keep test and development servers bound to a trusted environment and do not expose them publicly. These advisories remain open until compatible upgrades pass the full suite and Worker build; production-package audit alone does not clear the development toolchain.
