# AffiMatik V2 launch verification — 6 November 2026

## Release decision: NO-GO

This is an evidence record for the owner's Final One-Shot Master Launch Brief V2.0. The code changes below are an incomplete candidate, not a certified public release. Public paid checkout stays OFF. Do not merge or deploy this branch as a launch release until all critical gates pass.

## Revision and deployment

- Previous production commit: `5c5430b4f15cc1c426b969c4c5c793f73aa0d61f` (confirmed by `GET https://affimatik.online/api/jobs` on 6 November 2026).
- Candidate final commit: see Git history of this report's branch after commit.
- Cloudflare deployment SHA: `5c5430b4f15cc1c426b969c4c5c793f73aa0d61f`; the candidate code has **not** been deployed to production.
- Production database change: `supabase/migrations/00011_affiliate_application_policy.sql` was applied manually in Supabase SQL Editor; `pg_get_functiondef` confirmed APPROVED-only and 10% commission logic. Existing affiliate partner count was zero before this migration. A private `affimatik-assets` Supabase Storage bucket was created; it contained zero objects when checked. Neither step proves the new application code works in production.

## Candidate implementation

- Pricing and credit UI/API use RM49/100, RM129/300, RM399/1000; new account welcome grant changed to 20 while historical wallet balances are untouched. Generation charges remain 10 Voice and 15 Motion pending real supplier-cost evidence.
- Registration no longer silently confirms email through admin privileges. Production session signing no longer falls back to the admin access key.
- Order verification enforces workspace ownership for normal owners/admins; system superadmin retains audited cross-workspace ability.
- Job polling uses stored duration and provider. Completed video persistence stores MP4 in private workspace-scoped storage before credit settlement. Product image uploads and Video/Product Library API/routes are added. The queue displays stored jobs rather than samples.
- Affiliate application and admin review routes implement explicit PENDING/APPROVED status. Only APPROVED affiliates receive referral links and eligible first-payment commission at 10%. Subscription alone does not create an affiliate.
- Finance view no longer counts an order marked PAID as verified bank settlement or presents unverified projected supplier cost as distributable cash.

Key files: `src/lib/billing/plans.ts`, `src/app/api/auth/register/route.ts`, `src/app/api/billing/verify-order/route.ts`, `src/app/api/jobs/route.ts`, `src/app/api/products/route.ts`, `src/app/api/videos/route.ts`, `src/app/api/videos/[id]/stream/route.ts`, `src/lib/storage/supabase-assets.ts`, `src/lib/orchestration/persist-video.ts`, `src/app/api/affiliate/apply/route.ts`, `src/app/api/admin/affiliates/route.ts`, `supabase/migrations/00011_affiliate_application_policy.sql` and their dashboard pages.

## Gate A — code and security

| Check | Result |
|---|---|
| TypeScript `npx tsc --noEmit` | PASS |
| ESLint `npm run lint` | PASS, zero warnings |
| Production `npm run build` | PASS, Next.js 14.2.24 |
| Vitest `npm test` | PASS, 114/114 across 17 files, including real PostgreSQL and two-connection tests |
| `git diff --check` | PASS (line-ending warnings only) |
| Production dependency `npm audit --omit=dev` | **FAIL:** one critical Next.js package and one high PostCSS package finding. npm recommends a semver-major Next.js upgrade; current Cloudflare adapter compatibility requires separate migration and testing. |
| Secret scan in source/tests/migrations | No live provider token or service-role value found; test-only placeholders present. |

Passing code tests do not certify customer, payment, media, or real-device operation.

## Gate B — integration

| Requirement | Evidence/status |
|---|---|
| Supabase authentication, registration and email delivery | **UNVERIFIED.** Email confirmation delivery has not been demonstrated with an isolated inbox. Registration currently provisions workspace/wallet before confirmation; abuse and partial-provisioning risk remains. |
| Real Nexabot Voice and RunningHub Motion | **UNVERIFIED for this candidate.** No newly generated MP4, spoken CTA, provider duration metadata, product identity, visual quality, or actual supplier charge inspected. |
| Product image and permanent MP4 | Private bucket exists, but API upload/ingestion, persistence across devices, historical recovery and iPhone download have **not** been proven end to end. Eight historical completed Nexabot URLs were found in the prior Supabase host; recovery route has not been run. |
| Credit admission, reserve, settle and concurrency | Automated PostgreSQL tests pass. Production end-to-end charge and rollback are unverified. |
| Affiliate | Approval and 10% first-payment logic covered by tests and migration inspection. Referral attribution, 14-day hold, RM50 minimum payout, refund reversal, payout requests/history and fraud handling remain incomplete. |
| Payments | Public checkout remains OFF. Settlement, refund and gateway webhook operation unverified. |
| Dashboard and avatar management | Customer, admin and affiliate views are still partial. Avatar Library remains a placeholder. |

## Gate C — real devices and production

Not passed. No genuine full customer or affiliate journey, no physical iPhone Safari or Android Chrome test, no saved-to-Files proof, no cross-device asset check. Production homepage/API responded, but the candidate was not deployed.

## Financial safety

Plan prices and credit grants match the owner-approved targets. A worst-case margin calculation **cannot be signed off** without actual Nexabot/RunningHub API charges, gateway settlement/fees, storage and egress, retry losses, refund exposure and tax treatment. Current projected costs are not verified expenses. The finance screen displays safe-to-withdraw as zero when costs or bank settlement are unverified. Keep checkout OFF and do not change the 10/15 credit generation charges without the owner's explicit pricing decision.

## Data preservation, recovery and rollback

- No migration resets wallets or modifies existing customer balances. The affiliate migration changes policy prospectively; historical commissions must be reviewed separately before any payouts.
- Before deploying any later candidate, snapshot Supabase auth/database and storage, record existing wallet totals and media keys, and rehearse restore on an isolated project.
- Roll back application code by redeploying the verified production SHA above. The new affiliate DB constraint is not trivially reversible; restore from a database snapshot if rollback is required. Keep paid checkout OFF during rollback.
- Run historical MP4 recovery only after testing a single old job and verifying workspace ownership, MP4 integrity and idempotency. Do not regenerate or charge customers.

## Required closure before GO

1. Remove production dependency audit findings and validate Cloudflare adapter compatibility.
2. Fix and verify reliable email delivery, verified-user provisioning and signup abuse controls.
3. Prove real Voice and Motion provider runs, duration, complete audio/CTA, prompt/image delivery, output storage and credit behavior using unrelated product images.
4. Run end-to-end product/video libraries and historical recovery with isolated accounts; test playback and Files download on a physical iPhone.
5. Finish affiliate hold, payout, refunds/reversal, reporting and admin controls; prove a real approved first-payment commission of exactly 10% without self-referral or duplicates.
6. Verify supplier/gateway costs and worst-case plan margins, complete payment reconciliation, refund policy, dashboards, avatar scope and real-device QA.

**Decision:** NO-GO for public launch. Existing production application remains at its previous commit; checkout remains disabled.
