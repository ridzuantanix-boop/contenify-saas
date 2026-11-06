# AffiMatik Launch-Lite release evidence — 7 November 2026

Candidate branch: `codex/launch-v2-audit`. Production remains on `main` commit `5c5430b4f15cc1c426b969c4c5c793f73aa0d61f`. Paid checkout and public generation remain OFF in production. No production database change or deploy was made during this task.

## Working customer path in the candidate

The default path is Upload Product → Select one of seven NX Voice styles → Jana Video → Watch → Download. The provider creates Malay dialogue from the complete style masterprompt and actual image. The server verifies workspace ownership on status/stream routes, stores the provider MP4 in workspace-scoped private Storage, checks the source MP4 video track and duration, reads the stored object back byte-for-byte, requires 15s Voice video with audio, settles the original reservation idempotently, then marks the job `COMPLETED`. Failed media validation releases the reservation; stale completed-provider output failures release after reconciliation timeout. The Video Library shows completed private MP4s. Mandatory `QA_PENDING` was removed from the ordinary path. Optional admin QA code was retained under `supabase/optional`, away from launch migrations, and its menu link was hidden.

RunningHub remains disabled for public use. The six historical RH Motion styles are visible as Coming Soon without outdated preview links. Voice costs 10 wallet credits. Free welcome 20, Starter RM49/100, Pro RM129/300, Agency RM399/1,000 remain unchanged. Paid checkout defaults OFF.

## Genuine style samples

Seven distinct V5 prompts were sent directly to the authenticated Nexabot `i2v` API with one NOVA LAMP reference image, `duration=15`, portrait 720p and no model override. Each provider task completed. The MP4s were downloaded within provider TTL, copied to versioned public style assets in Git and parsed with ffprobe. All seven contain H.264 video and AAC audio at 720×1280, with container duration 15.040s. The cards link to `/api/style-samples/{id}`, which serves the versioned static MP4 with byte-range responses for Safari. This is permanent versioned static storage for public examples, separate from private customer media.

| Style | Nexabot job | Bytes | Card preview path |
|---|---|---:|---|
| NX01 Sembang Kawan | `063d046f03b3a02d` | 4,461,328 | `/api/style-samples/NX01` |
| NX02 Review Sambil Pegang | `7f5b7423adb087a3` | 3,930,690 | `/api/style-samples/NX02` |
| NX03 First Impression | `994c2b11359054f6` | 5,346,325 | `/api/style-samples/NX03` |
| NX05 Masalah Seharian | `938509e119e60cef` | 5,177,006 | `/api/style-samples/NX05` |
| NX07 Soalan & Jawapan | `199967374847e8af` | 5,273,243 | `/api/style-samples/NX07` |
| NX09 Goyang Produk + VO | `3e60b67cdf4f5dcd` | 5,914,861 | `/api/style-samples/NX09` |
| NX10 Label Talk | `e4818af889795e84` | 5,645,320 | `/api/style-samples/NX10` |

Visual contact sheet and automatic Malay transcription are in ignored `output/provider-qa/`. They indicate different presenter/product-only actions, relevant lamp use and generally complete CTAs, but automatic speech recognition is not human listening. Minor visual and dialogue imperfections remain possible and are accepted under the owner’s revised policy. The static samples have not been tested on a physical iPhone. A separate RH01-on-Nexabot task `d5196690b569ced1` generated a 15.040s MP4 with audible speech according to transcription despite the no-dialogue prompt; therefore no Motion style was activated and no RunningHub credit was spent. Eight new `i2v` submissions reduced Nexabot API balance from 81.80 to 80.60, 0.15 provider credit per request; the account API separately quotes 0.4 for other video models. No customer wallet was charged for these samples.

## Verification and release blockers

- Automated suite: **147/147 passed across 25 files** on the final candidate, including isolated PostgreSQL migration, two-connection concurrency, wallet, affiliate, refund, auth, storage, historical recovery, release flags and sample byte ranges.
- ESLint and OpenNext Worker build: passed locally with the final byte-range route. Local HTTP checks served all seven sample MP4s and 13 catalogue styles.
- Cloudflare access: Wrangler now authenticates as `onealienz82@gmail.com` on the correct account `98f15d0c63af9cf87ea0233687691d65`. Production Pages secrets include session, Supabase, Nexabot and cron names, but encrypted values were not read. Voice release flag is absent, so public generation stays OFF.
- A separate secret-free OpenNext Worker preview was deployed at `https://affimatik-v2-candidate.nanotiva-garden.workers.dev` (latest version `6f5020f9-2357-4b2c-8def-15e5b1d23424`). Cloudflare Static Assets ignored `Range` requests, returning 200 instead of 206. The new card-preview API was then deployed: all seven `/api/style-samples/{id}` endpoints returned HTTP 206, `video/mp4`, exact `Content-Range` and 1,024 bytes for `Range: bytes=0-1023`; an invalid range returned 416. This supports Safari byte-range playback, but no physical iPhone test was performed. The preview has no production database or provider bindings and is not a live customer service.
- Existing Cloudflare Pages project uses `npx @cloudflare/next-on-pages` and `.vercel/output/static`. The latest candidate preview deployment failed because that deprecated adapter requires Edge runtime on every dynamic route; this code is built for OpenNext on Workers. Production `main` remains the older working Pages deployment. The release needs an OpenNext Worker deployment, secret bindings and a controlled domain cutover after data safeguards; pushing the candidate branch alone cannot deploy it.
- Supabase `affimatik-production` is on Free Plan with no dashboard backups or restore-to-new-project. Its direct PostgreSQL connection requires an unknown password, and the local network lacks direct IPv6 TCP access; an IPv4 session-pooler connection is needed for manual `pg_dump`. No encrypted production dump, Storage object export, manifest, isolated restore or production-derived migration rehearsal is available. Therefore migrations 00012–00017 and the new code were not applied to production. Optional 00018 QA migration is excluded from the launch path.
- A real isolated customer login/upload/generation/private-storage/credit/library/download smoke test cannot be marked PASS until the backup, migration, Worker binding and routing steps above are complete. SMTP inbox and physical iPhone/Android evidence also remain unavailable. Existing production data and balances were not touched.

**Verdict:** candidate code and seven real samples are ready for release preparation, but **production GO is blocked** by backup/restore and the Pages-to-Worker release path. Paid checkout remains **NO-GO/OFF**.

The next owner action is to locate the database password originally set for `affimatik-production` and make it available through a local secure prompt, not chat. Supabase's Connect dialog shows `[YOUR-PASSWORD]` and cannot reveal it. If forgotten, only the owner should reset it after checking other direct database clients. The existing Supabase service-role key is also needed through a secure local channel to export private Storage objects. Once credentials are available, take and hash the data/asset backup, restore it in isolation, rehearse migrations 00012–00017 and compare account, wallet, job and media counts before any domain or production change.
