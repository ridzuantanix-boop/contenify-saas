# CONTENIFY — MASTER BUILD BLUEPRINT
Version: 0.1 | Status: Proposed product architecture (not a functioning deployment) | Language: BM Malaysia for user-facing UI.

## 1. Product north star
Build a multi-tenant, cloud-native AI video production SaaS for Malaysian affiliates, creators and sellers. Customer registers/pays, owns private assets (product images/screenshots, avatars, prompts, generated videos), uploads in bulk, selects presets/settings, and presses Generate. Tasks continue server-side after browser closes. No Windows PC, extension, personal API key, or 24/7 local machine required.

Differentiator: high-quality conversational Malaysian Malay creator videos powered primarily by Nexabot for 10-second clips, with RunningHub for 15-second visual/video tasks, official Gems prompt presets, dynamic product-aware prompt building, durable batch processing and reusable assets.

Never market output as ready until the actual playable file has been validated and durably stored.

## 2. Verified vs not-yet-verified assumptions
- Product owner confirms existing Nexabot and RunningHub integrations work. Reuse exact current known-good request/response contracts, preferably from source code, real sanitized response samples and existing integration tests; do NOT invent endpoints, response fields or capabilities.
- Nexabot: highest priority for 10-second Malaysian Malay spoken video; vendor is understood to perform its own product research. Preserve its research strengths; send an adaptable universal dynamic masterprompt and image reference. Exact provider contract, cloud suitability, rate limits, billing rules and permission to offer downstream SaaS services must be confirmed.
- RunningHub: 15-second video path, optional silence and downstream Malaysian Malay TTS. Map exact webapp schema/node names; never apply generic node guessing. Confirm available task outputs and endpoint behavior against actual API account.
- 20/30/60-second sequences are orchestration of supported clips (not a claim that either provider natively supports these lengths). Image/face continuity is best-effort; not guaranteed by prompt alone.
- Never copy any provider credentials from the old HTML. Rotate previously embedded credentials before use. No secrets in code, client bundles, logs or screenshots.

## 3. Proposed technology decisions
- Monorepo in GitHub, pnpm workspace, strict TypeScript, CI with lint/types/tests.
- Responsive Next.js web app, Tailwind, shadcn/ui; Cloudflare-compatible target using current recommended Next.js adapter if compatibility checks pass. Keep UI and API boundaries explicit.
- Cloudflare Workers for public authenticated API and provider proxy/adapter.
- Supabase Auth + PostgreSQL with tenant-based row-level security (and server-side authorization, not relying on RLS alone). Consider separate workspaces later; V1 one workspace per user.
- Cloudflare R2 private buckets for originals, cleaned input assets, avatars, prompt source attachments, output clips, final MP4 and thumbnails. Use short-lived signed upload/download URLs (no public bucket by default).
- Cloudflare Queues for dispatch/backpressure + Cloudflare Workflows for durable per-video job orchestration, retries, resume, and waiting on callback/poll. Persist canonical job state in PostgreSQL; never use browser state as sole source of truth.
- Dedicated FFmpeg container worker via Google Cloud Run Jobs for stitching, audio, rendering captions and previews. Make this optional in V1 if raw single-provider MP4 is acceptable.
- Stripe subscription for supported recurring card methods, local one-time methods/top-ups according to documented capabilities; verify webhook handling and payment status. Do not assume FPX is auto-recurring.
- Error tracking, structured logs, alerting, cost dashboards and admin audit trail. Environments local, staging, production isolated, each with own data and secrets.

## 4. Primary information architecture / navigation
### Public
Landing, How it works, Features, Pricing, FAQ, Sign In, Sign Up, Terms, Privacy, Refunds, Support.
### Authenticated main nav
1. Dashboard — usage summary, recent batches, credit balance, quick create, alerts.
2. Video Factory — Quick Mode + Advanced Mode, bulk asset intake, presets, batch configurator.
3. Product Library — folders, collections, screenshots, product facts, analysis history, approved claims.
4. Avatar Library — image references, creator identity presets, consent and usage labels, thumbnails.
5. Prompt Library — My Prompts, Official Gems, prompt versions, favorite, clone custom presets.
6. Production Queue — all jobs, filters, statuses, retries, pause future dispatch, detail log.
7. Video Library — gallery, video player, generation details, regenerate, download MP4/ZIP.
8. Billing — plan, credits, usage, invoices, payment history, top-ups.
9. Settings — profile, workspace, asset retention, preferences, security.
### Owner/admin nav (role protected)
Overview, Users, Plans & Prices, Credits & Ledger, Provider Health, Jobs & Failures, Gems Control Center, Feature Flags, Support & Audit Logs, Finance/Cost report.

## 5. Design system and UX quality bar
Direction: editorial premium SaaS; airy neutral white/gray surfaces, charcoal typography, restrained single accent (indigo or violet), subtle borders and soft shadows. Do not make interface resemble the old dense single-page HTML form. Minimal icons, no emoji-based primary navigation, consistent rhythm and spacing, 14–16px legible body copy, WCAG AA contrast and keyboard navigation. Responsive mobile-first, desktop optimized.

Recommended desktop layout: persistent collapsible 240px left sidebar, compact 64px top bar (workspace name, balance, notifications, account), content 1200–1440px width, dashboard cards and jobs table. Sticky generation action summary on desktop. On mobile: compact header, drawer nav, bottom sticky Generate action, step-based input flow.

Product images should remain crisp and correctly cropped. Every upload has thumbnail, filename, status, validation error, and delete/select controls. Empty, loading, error and offline states must be designed (not just success state). Skeleton loading should be subtle.

Do not fake stats, progress, provider result previews, costs or number of completed videos. Demo content clearly labeled demo; real app uses actual state.

### UX screens
A. Onboarding: simple intro -> choose usage (affiliate/seller/agency) -> optional sample upload -> Dashboard.
B. Dashboard: 4 KPIs (balance, videos created, active jobs, products), create CTA, recent batch cards, current issues.
C. Video Factory Quick:
   - Step 1 Select/upload product images. Accept dozens via drag-drop, file picker, optional saved library products; group images by product with editable grouping.
   - Step 2 Select Gems preset card with visual thumbnail and concise description; choose duration, voice and output count.
   - Step 3 Preflight summary: N products, M video variations, expected credits, selected provider routing, rights/accuracy warning if needed. Generate button only if all inputs valid.
D. Video Factory Advanced: provider selection, exact duration supported, custom prompt, avatar per video, visual/lighting/shariah/identity settings, per-item overrides, audio/no-audio, TTS, multi-part outline and estimated cost.
E. Queue: summary progress + per-job status logs; real provider task ID shown only in detail. Pause means stop NEW dispatch; active externally running jobs may continue, and billing must reflect real provider events. Resume; retry error with cost disclosure; cancel if provider supports it (otherwise mark cannot cancel provider task).
F. Video Library: playback, thumbnail, metadata, copy prompt, regenerate, download, ZIP, filter by batch/product/preset/date, expiry/retention labels.
G. Admin: traffic/cost, alerts, provider latency and failures, key rotation (never reveal original secret), prompt versions and protected release gates.

## 6. Gems and prompt composition
Persist a canonical PromptPreset with ID, name, version, category, mode (10s/15s/multipart), supported providers, user-facing options, templates, reference requirements, safety/brand rules and evaluation test cases. User custom presets fork rather than overwrite official presets. Pinned version on every generation job so later changes don't mutate already-running jobs.

Gems preset examples: Real Affiliate Creator, Realistic UGC, Product Hand Demo, POV Customer, Product Reveal, Drawer Reveal, Unboxing Studio, Faceless Creator, Product Director, Book Creator, Long Video Story Director. Roll out small set for MVP, the rest behind flags.

Universal masterprompt = structured merge of: validated product images + product facts + provider-specific capabilities + selected Gems template + avatar reference + controls (duration, style, lighting, camera, audio, CTA) + safety constraints + per-product variations. Nexabot provider receives universal dynamic instruction and does its own research where supported. Never fabricate product-specific claims from generic template.

Recommended Malaysia content rules for official creator presets: natural Malaysian Malay, no Indonesian-sounding vocabulary; modest clothing when model is Muslimah, hijab covering properly, covered wrists, no jewelry on hand-only shots; preserve products' brand/logo/text/shape, no UI screenshot or watermark in final output, no unsupported cure/performance claims, no fake personal-use testimonials, natural camera and product scale. No 'beg kuning' script or screen button; if selling CTA needed, spoken 'tekan butang di bawah' unless user specifies permitted CTA. Respect user selection of no selling CTA for awareness videos.

For images that are raw screenshots, perform (a) content moderation/file safety, (b) identify primary product using user confirmation where ambiguous, (c) crop/remove only unrelated phone interface/text/watermark when authorized, (d) store original + cleaned derivative, (e) build structured product context; never delete original. Avoid false claims that cleaning is always accurate.

## 7. Provider adapters
Define interface:
- capabilities(): durations, video modes, voice languages, max reference images, concurrency policy, cost model, callback support.
- prepare(input): validate and transform into exact provider-specific schema.
- uploadAssets(input): upload/reuse provider-specific references.
- submit(input, idempotencyKey): returns providerTaskId and raw status.
- getStatus(providerTaskId): normalized status.
- getOutputs(providerTaskId): validated URLs/metadata.
- cancel(taskId): if documented supported.
- normalizeError(): category actionable/nonactionable, retryable status, billed or not.

NexabotAdapter is priority for 10s spoken BM. RunningHubAdapter for 15s and visual. Router only chooses an allowed path; fallback may require new permission when duration/voice differs. Do not invent Nexabot endpoint. Write sanitised contract fixtures + real smoke tests using injected secrets.

RunningHub must use exact, versioned webappId and nodeInfo schema mappings; never guess field types, clear secondary image slots or reuse a stale schema across different webapp IDs. Validate actual output type as playable video, not merely any file URL.

## 8. Data model outline
Tables (all tenant-scoped where relevant):
- users/profiles, workspaces, workspace_members (future), subscriptions, payment_events, credit_wallets, credit_ledger (append-only), credit_reservations.
- products, product_images, product_facts, product_collections, avatars, prompts, prompt_versions, brand_kits, assets (R2 object + owner + role), asset_tags.
- batches, video_jobs, job_steps, provider_tasks, generated_videos, video_segments, voice_tracks, batch_exports.
- provider_configs (server-only), provider_health_checks, system_notifications, audit_logs, usage_metrics, feature_flags.

Every job snapshot includes owner/workspace, chosen product & asset IDs, preset version, requested duration, segments plan, settings, calculated credit reservation, provider route, providerTask IDs, attempts, result asset, timestamps, errors, usage charge entries. Use UUID IDs and explicit unique constraints on request idempotency keys and external provider task IDs.

High-level job states: DRAFT -> VALIDATING -> QUEUED -> RESEARCHING -> PROMPT_READY -> SUBMITTING -> GENERATING -> PROCESSING -> QUALITY_CHECK -> COMPLETED. Failures go to FAILED_RETRYABLE or FAILED_FINAL; cancellation requested/cancelled distinguish from server-dispatched jobs. Never mark done without stored verified MP4. All transitions audited.

## 9. Server workflow (core)
1. Authenticated client requests signed upload URLs, uploads directly to private R2, submits final manifest containing object IDs (never raw key/name trust).
2. Server validates ownership, content-type, file size, checksum, group/duplicate hints, selected options and available credits.
3. Preflight calculates video and segment counts, allowed provider routing, credit ceiling, storage estimates. User confirms.
4. Create durable batch + per-video jobs atomically, reserve credits, enqueue IDs only (no image bytes in queue messages).
5. Workflow processes each job: prepare refs/context -> compile prompt snapshot -> choose eligible provider -> upload as needed -> submit with idempotency -> persist task ID -> wait on callback or bounded polling with durable sleeps -> validate result -> store R2 -> optionally composite FFmpeg/TTS -> QA -> complete -> settle credit reservation and show output.
6. On failure: classify, retry with bounded exponential backoff, dead-letter/owner notification on repeated failure, reconcile charges and provide user action.
7. Browser only polls/subscribes to job state; closing browser does not stop cloud workflow.
8. Deletion/export: presigned links, signed auth, short expiry; lifecycle rules by plan and clear UI retention policy.

## 10. Billing/abuse controls
Implement pricing as settings not hardcoded constants. Subscription entitlements: monthly included credits, top-up, max concurrent jobs, max batch size, storage cap, video retention, access to presets, advanced features. Never promise unlimited generation absent enforceable fair use and predictable provider cost.

Credit ledger events: grant, reserve, settle, release, refund, manual adjustment. All mutation idempotent. Provider billable failures and partial multipart results require explicit refund policy and support visibility.

Verify all checkout webhooks cryptographically; never trust redirect success page as paid. Prevent race conditions and duplicate webhook credits. Add anti-spam/rate limit, bot signup protection, file validation, abuse detection, user deletion/export flows, Malaysian PDPA-conscious privacy and retention controls.

Commercial launch prerequisite: independently verify Nexabot and RunningHub service terms, resale/white-label and API redistribution rights, data/image handling, rate limits and invoice responsibilities.

## 11. Phased delivery / quality gates
### Milestone 0 — Foundation
- Fresh repo, clean env, no copy of hard-coded secrets, pnpm workspace, builds, CI.
- Provider adapters with sanitized fixtures + documented config contracts.
- Local database migrations, typed models, R2 signed upload integration.
- Gate: automated tests green + real one-image 10s Nexabot smoke + one-image 15s RunningHub smoke (if credentials provided through safe server env), recorded actual provider task IDs and playable videos stored in test R2.

### Milestone 1 — Tenant and UX shell
- Real registration/login/email verification/password reset, dashboard/nav, product/avatar/prompt/video libraries, upload flows, workspace isolation.
- Gate: 2 test accounts never see each other's files, prompts, jobs or signed downloads; accessibility and responsive smoke tests.

### Milestone 2 — Durable Video Factory
- Quick + Advanced UI, route selection, preflight credit estimate, batch jobs, provider polling/callback, result store, retry, progress.
- Gate: upload 5 images, submit Nexabot jobs, close browser, return and retrieve the 5 real playable MP4s; refresh/restart workers and prove recovery; retry transient errors without duplicate billing.

### Milestone 3 — Monetization/Admin
- Checkout, verified webhook, subscriptions, topups, credit ledger, entitlements, admin analytics and audit logs.
- Gate: test checkout->active plan, cancel->correct expiry, duplicate webhook->one credit entry, failed payment->no activation, concurrency and quota enforced server-side.

### Milestone 4 — Multi-part + FFmpeg
- Segment planner, prompt continuity, optional last-frame reference, TTS and render worker, final MP4, ZIP export.
- Gate: 30s and 60s full renders; actual durations and audio streams inspected with ffprobe; no missing/duplicate segments; per-stage retries.

### Milestone 5 — Closed beta / prod readiness
- Load tests e.g. 10 users x 10 images, actual provider upstream concurrency limits observed, monitoring/alerts, privacy/legal terms, staging and prod separated, rollback and incident runbook, support process and financial cost report.
- Gate: results and cost metrics documented; no synthetic outputs presented as success. Invite paying users only after stable tests and rights review.

## 12. Codex working rules
- Work in small PRs/commits per milestone and don't skip gates. No "completed" claim without reproducible evidence.
- Never leave demo-only buttons that pretend an operation succeeded; disable clearly with feature flag instead.
- Keep `.env.example` placeholders only; never check in secrets; log redact tokens, personal info and presigned URLs.
- Test with mocked providers first; real API calls with actual cost require project-owner-controlled credentials and explicit cost guardrails.
- Document decisions (ADRs), SQL migration, diagrams, API contracts, test commands, deployment/rollback instructions.
- Prefer validated integration over speculative implementation. If Nexabot contract differs from assumption, document the difference rather than invent compatibility.
- Build accessible and visually polished UI, including loading/empty/error states. Screenshot actual pages at mobile and desktop widths in QA report.
- Attach or describe a short demo of the full working flow after each gate, listing what was actually tested and what remains unverified.

## 13. Immediate owner actions
1. Rotate RunningHub and Nexabot credentials exposed in old HTML and store replacements only in protected server secrets.
2. Provide Codex secure access to a new GitHub repository and a staging cloud project; do NOT paste API keys into prompts or chat.
3. Provide old HTML strictly as UX/legacy reference and sanitized existing successful provider request/response logs; ask Codex not to reuse unsafe auth or node mapping code.
4. Select the first three official Gems presets and three sample products to use as regression tests.
5. Confirm commercial SaaS rights and quotas from each provider before accepting paid customer volume.
6. Build milestone 0, run real paid-endpoint tests within controlled budget, then proceed stage by stage.

## 14. MVP acceptance test in one sentence
Two independent users can sign up and access only their own assets, upload five product screenshots, use Official Gems to create five 10-second Nexabot videos through a durable cloud queue, shut their devices off and later retrieve five real playable MP4 files from private storage, with accurate credits and errors; RunningHub 15-second integration passes its own smoke test.
