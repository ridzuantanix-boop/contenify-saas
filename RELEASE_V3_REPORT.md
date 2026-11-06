# AffiMatik V3 — release evidence, 6 November 2026

Branch: `codex/launch-v2-audit`. Public Voice, public Motion and paid checkout remain **OFF**. No production deployment or database migration was performed. This report records the candidate implementation and the external gates still needed.

## Provider capability and direct QA

The authenticated `GET https://nexabot.id/api/v1/modes` returned `i2v` with 1–3 image references and default 15-second output. Its separate `omni` metadata says 10 seconds, start-frame input, 0.4 provider credit. The [public developer page](https://nexabot.id/developers) also describes Omni as 10 seconds; its request parameter text appears older than the authenticated `i2v` response. AffiMatik therefore uses `mode=i2v` with **no Omni model override**, `media=[data:image/png;base64,...]`, `ratio=2`, `resolution=720`, `duration=15`, and `use_unlimited=false`. Completed jobs reported internal `model=375`; no public model mapping for that number was found. Do not call these 15-second jobs Omni Flash.

| Test | Provider job | Direct API result | MP4 inspection | Creative QA |
|---|---|---|---|---|
| NOVA LAMP, focused 15s capability prompt | `989490fbd2fe0b78` | Accepted and completed, 0.15 provider credit | H.264 video 15.000s, AAC audio 15.040s, 720×1280, 4,323,311 bytes | Reference-derived lamp and label broadly consistent in sampled frames. Automatic Malay transcript suggests a grounded low-light hook, flexible neck/USB-C observations and full CTA ending near 14.7s. Human audio and whole-video QA outstanding. |
| LUMA DISH SOAP, compiled NX01 V5 masterprompt | `9616647a9dd11b0d` | Accepted and completed, 0.15 provider credit | H.264 video 15.000s, AAC audio 15.040s, 720×1280, 3,891,182 bytes | **FAIL:** frame near 7.5s adds `500ml` to the label, absent from the input. Automatic transcript suggests an unsupported gentleness-on-hands claim and repeats the CTA; human listening is still required. |

Provider balance was 82.10 before these two jobs, 81.95 after NOVA and 81.80 after LUMA. No customer job, wallet reservation or production media was used. Local MP4s, WAV files and contact sheets are ignored under `output/provider-qa/`. Both completed job records returned a storage URL on the exact previously allowlisted Nexabot Supabase host; unauthenticated direct retrieval of the LUMA MP4 returned HTTP 200, `video/mp4`, 3,891,182 bytes. Private customer storage ingestion itself remains untested with production credentials. Both references were extracted from earlier synthetic QA videos, not original customer uploads; NOVA came from the RunningHub sample and LUMA from a prior Nexabot sample. LUMA's reference frame already contains a star-like graphic. Its appearance in the new output cannot establish whether the mark is an official provider watermark, a copied input element or a graphic artifact. A confirmed official Omni watermark is allowed by owner policy; invented label text remains a rejection reason. The authenticated modes response and developer page expose no documented watermark-removal parameter, so none was added.

The new `i2v` capability proves the API can produce 15-second reference-image video with audio. The sampled opening frames are live presenter scenes, rather than copies of either uploaded reference frame, supporting the intended reference-image role. It does **not** prove all seven Voice styles meet quality, nor that a particular star is official. The last prompt tightening explicitly forbids invented printed volume/specification and happened after the live runs; no claim of output validation is made for that revision.

## Candidate implementation

| Requirement | State |
|---|---|
| 13 official style identities/masterprompts | Retained. Seven NX Voice styles now request 15s and are marked `prompt_validated`; six RH Motion styles remain in the catalogue marked `disabled`. Historical 10s preview MP4s and old job duration metadata remain intact. The older Markdown prompt pack is explicitly marked historical; the compiler and registry control generation. |
| Provider routing and payload | NX routes to Nexabot `i2v` at 15s with full provider-created dialogue prompt and actual image. Historical 10s compatibility is retained. Duration-only 15s routing is rejected as ambiguous; provider override cannot send an NX customer request to RunningHub. |
| RunningHub deactivation | Public availability is hard-disabled even if its old environment flag is set. Adapter, historical jobs and media are retained. No further RunningHub charge was made in V3. |
| Watermark exception | Compiled Voice prompt permits a genuine unavoidable Omni provider watermark while prohibiting copied/fabricated marks, UI, extra graphics and product morphing. Official source of the earlier star remains unverified. |
| Credits and QA | Voice remains 10 wallet credits; Motion historical price remains 15. New production MP4s are privately ingested and marked `QA_PENDING` without settlement or customer stream access. Superadmin can preview, approve or reject. Migration 00018 reviews under a row lock and atomically settles or releases the original reservation. Replays are idempotent; review timeouts reject/release after 24h. Public Voice additionally requires explicit manual-QA and Voice release switches. |
| Customer/admin surfaces | Factory, billing, styles, Queue and navigation identify 15s Voice and unavailable Motion. Historical 10s previews are labelled. Superadmin QA page and API added. Dashboard migration counts QA pending and rejected jobs correctly. |
| Product/Video/Avatar Libraries, affiliate, refunds, signup, payment | Existing V2 implementations preserved; prior local integration coverage remains. No live customer end-to-end test in V3. Checkout stays OFF. |
| Financial cost | Direct `i2v` API charged 0.15 provider credit per sample. MYR invoice/conversion, gateway fees, full-wallet utilization and bank settlement remain unverified. The finance model requires a verified 15s Nexabot cost setting before marking costs verified. |

The two speech transcripts were estimated with local `faster-whisper small` in Malay. NOVA's CTA appears complete near the end; LUMA's transcript suggests a claim about being gentle on hands and repeated closing words. These are QA flags, not a substitute for a Malay-speaking reviewer listening to the original AAC track. The new prompt forbids adding unseen printed volume, and the manual reviewer must reject such output even when a provider watermark is present.

## Local verification

- Full Vitest suite: **139/139 passed across 22 files** after the 15s update, including isolated PostgreSQL migration 00001–00018, QA decision/expiry accounting, affiliate, refund, auth, media privacy and historical recovery.
- ESLint: passed. Next.js production build: passed. OpenNext Cloudflare Worker build: passed on Windows with its standard compatibility warning.
- `npm audit --omit=dev`: 0 production dependency vulnerabilities at the time of this run.
- Direct provider: two authenticated 15s `i2v` submissions completed with MP4/audio inspection. No live customer wallet or private production storage operation was performed.

## Database and release gates

Migration `00018_manual_video_qa.sql` is additive for QA columns/functions and extends the status constraint; it also amends admission concurrency to count `QA_PENDING`. It passed isolated PGlite migration and wallet tests, including approval, rejection, replay and 24-hour expiry. Migrations 00012–00018 have **not** been run against a production-derived copy or production. The owner's manual encrypted PostgreSQL/Auth/Storage backup and isolated restore have not been supplied, so production migration is prohibited. No existing customer balances, jobs or media were changed.

The Wrangler session belongs to Cloudflare account `6af56159f79621677bac8e4db85c4403`; the production project is under `98f15d0c63af9cf87ea0233687691d65`. Production bindings, secret rotation, Worker/DNS deployment and end-to-end private storage cannot be verified through the current account. Read-only production probes returned HTTP 200 for `/api/styles` with 13 catalogue styles and `/api/jobs` with `buildCommit=5c5430b4f15cc1c426b969c4c5c793f73aa0d61f`; the V3 candidate is not live. Custom production SMTP and inbox delivery are still unverified. Physical iPhone Safari and Android Chrome download checks, real payment settlement, affiliate payout and supplier invoices remain external gates. No unavailable gate is marked PASS.

## Release decision

**Nexabot-only public generation: NO-GO.** The 15s API capability is proven, but the compiled NX01 sample invented label content and the other six 15s styles lack live QA. Manual QA code and migration require production-derived rehearsal and a real customer path test before any switch is enabled.

**Paid checkout: NO-GO.** Checkout remains OFF pending owner authorization after financial, payment, SMTP, backup and mobile verification.

Release sequence: obtain verified manual backup and restore, rehearse migrations 00012–00018 on the restored copy, gain the correct Cloudflare account access and verify secrets, configure SMTP, test customer signup→generation→QA→library→download on physical devices, validate MYR costs and settlement, then reassess public Voice. RunningHub remains disabled.
