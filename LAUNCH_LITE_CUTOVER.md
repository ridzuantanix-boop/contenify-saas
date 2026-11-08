# AffiMatik Launch-Lite cutover plan

**State:** prepared, not authorised or executed. The live `affimatik.online` and
`www.affimatik.online` custom domains still belong to the `contenify-saas`
Cloudflare Pages project. The staging Worker is
`affimatik-launch-lite-staging.nanotiva-garden.workers.dev` (version
`39df326b-a4a4-4225-96aa-714e5a862166`).
The latest production Pages deployment listed at preparation time is
`c2b7f82e-ad9f-4572-949b-a138eb1cf501` from `main` commit `5c5430b`.

## Target and bindings

- Cloudflare account: `98f15d0c63af9cf87ea0233687691d65`; zone:
  `8f42ee34d2d77590dce8a05fb70a3319`.
- New production Worker: `affimatik-production-v2`, configured by
  `wrangler.production.toml`, with OpenNext `.open-next/worker.js` and static
  assets. `workers_dev=false`; no production domain route in the file.
- Public flags: Voice 15s on, Motion/RunningHub off, paid checkout off, mock
  providers off. Never add a RunningHub key to this release.
- Nonsecret binding: `SUPABASE_URL=https://oudxnvazrdmnxdndpgmy.supabase.co`.
- Secrets uploaded via an ephemeral `--secrets-file`: `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `ADMIN_ACCESS_KEY`,
  `CRON_SECRET`, `NEXABOT_API_KEY`. `WORKER_SELF_REFERENCE` and `ASSETS` are
  Worker bindings. Secret values remain in local Windows DPAPI files and are
  never printed or committed.
- The existing `affimatik-cron-reconciler` Worker runs every five minutes. At
  cutover its `CRON_SECRET` must be rotated to match the new production
  Worker. Its `APP_BASE_URL` remains `https://affimatik.online`.

## Before route changes

1. Obtain explicit owner cutover authorisation. Record the current Pages
   deployment and the latest backup receipt. Confirm six pre-existing customer
   wallets still total 220 credits with zero reservations, plus test-account
   activity separately. Confirm no pending paid checkout.
2. Run `npm test -- --run`, `npx tsc --noEmit`, and `npm run worker:build` on the
   release commit. Reconfirm staging login, one private MP4 full/Range
   download, all seven Voice sample routes, and the runtime availability flags.
3. Run `scripts/release/deploy-production-worker.ps1` without switches for a
   secrets-aware dry run. Then, only after owner authorisation, run it with
   `-Deploy -OwnerApproved`. This creates the Worker without a public route.
   Verify the uploaded version and secret binding names. Existing Pages stays
   live.
4. Dry-run `scripts/release/deploy-production-cron.ps1`; after authorisation,
   deploy it with `-Deploy -OwnerApproved` at the time of route switch so its
   secret matches the new Worker. Watch the next scheduled result.

## Traffic switch

In Cloudflare account `98f15d…`, zone `affimatik.online`, attach these two
Workers **routes** to `affimatik-production-v2`:

| Pattern | Worker |
| --- | --- |
| `affimatik.online/*` | `affimatik-production-v2` |
| `www.affimatik.online/*` | `affimatik-production-v2` |

Keep the existing Pages custom domains and proxied DNS records in place. This
route-based switch requires **no DNS edit**; the Pages project remains the
immediate rollback target. Confirm there is no conflicting, more-specific
route before attaching these patterns. The zone's Workers route API returned
zero existing routes during preparation. Cloudflare route behaviour and the
existing Pages DNS records should be checked in the dashboard at cutover.

## Immediate checks and rollback

Within minutes of the switch, check HTTPS `/`, JavaScript assets,
`/api/styles` (Voice on; RunningHub off), login for an existing account,
test-account wallet and reservation state, Product and Video Library,
authenticated full/Range MP4 download, seven sample previews, and that public
checkout returns unavailable. Confirm the cron reconciler succeeds at its
next five-minute interval. Do not run another paid provider generation unless
the owner specifically authorises the cost and test scope.

If login, credit integrity, private media access, assets, or reconciliation
fails, remove **only** the two new Worker routes. The unchanged Pages custom
domains and DNS then serve the prior deployment. Verify Pages login and wallet
state after rollback. Keep the new Worker and its logs for diagnosis; do not
delete customer data or alter balances. Existing signed Pages sessions may
require users to log in again after the Worker switch because this release
uses a new `SESSION_SECRET`.

Physical iPhone Safari Save to Files and Android Chrome download remain
device checks; desktop full/Range downloads and MP4 integrity passed staging.
