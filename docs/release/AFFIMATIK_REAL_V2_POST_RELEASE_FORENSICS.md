# AffiMatik REAL V2 — post-release quality recovery

Date: 2026-11-16 MYT  
Starting commit: `a41b45ee32cdcbe99b8c63b29e39a50690ec58f1`  
Scope: existing 50 Nexabot MP4s only; zero provider submissions and zero supplier spending.

## Executive finding

The dominant failure is not video transport, queueing, encoding or physical rendering. It is provider-authored language: unsupported selling claims, malformed Malaysian pronunciation and CTA non-compliance. Limited colour correction can improve selected clips, but cannot make the campaign publishable because it does not repair the spoken content.

The current prompt payload is also unusually dense: 24,106–26,686 characters, 3,337–3,707 words and an average of 64 strong `must`/`never`/`do not` directives per job. The campaign does not prove prompt length alone caused the defects, but it does reveal conflicting objectives that permit a buyer “benefit” while simultaneously forbidding unsupported claims, and that request a hook, product introduction, benefit, possible FOMO and CTA within 15 seconds. Those conflicts plausibly dilute truthfulness and CTA timing.

## Evidence inventory

- 30 initial MP4s and 20 retry MP4s were reconciled to their input-image SHA-256, prompt SHA-256, task ID, transcript, output SHA-256 and contact sheet.
- Machine-readable inventory: `output/affimatik-real-v2-release/forensics/inventory-50.csv`.
- Reproducible aggregate evidence: `output/affimatik-real-v2-release/forensics/defect-summary.json`.
- Visual review covered 350 representative frames (seven frames per MP4). This is explicitly not represented as full temporal motion certification.

## Root-cause ranking

| Rank | Defect | Evidence | Publication effect | Root cause |
|---:|---|---:|---|---|
| 1 | Unsupported product claims | 49/50, 98% | Blocking | Provider converts category knowledge or plausible marketing language into unverified efficacy, comfort, performance or scarcity claims. The prompt explicitly allows an “ordinary buyer benefit” without confirmed facts, contradicting its evidence lock. |
| 2 | Malaysian pronunciation risk | 49/50, 98% proxy | Usually blocking | At least three ASR words below 0.60 confidence in 49 clips, with manually visible corrupt forms such as product names and CTA words. This is a proxy, not proof for every word, but spot checks confirm the problem is widespread. |
| 3 | Warm/cream colour cast | 39/50, 78% proxy | Minor to blocking depending on product | Mean bright-region red-minus-blue delta ≥15 across seven sampled frames. Provider scene reconstruction often reintroduces warm interiors despite neutral-white instructions. |
| 4 | CTA incomplete, inexact or repeated | 38/50, 76% | Blocking | Only 12 clips contain the exact CTA once and finish before 14.90s. High dialogue density and provider deviation both contribute. |
| 5 | Human/product physics | 0 hard failures in 350 sampled frames | Requires full-motion owner review | No publication-blocking physics defect was objectively established from the sampled contact sheets. This does not certify all motion. Product identity and scale were generally stronger than speech compliance. |
| 6 | Shariah compliance | 0 hard failures in 350 sampled frames | Requires full-motion owner review | No obvious hair, neck, chest or wrist exposure was recorded in sampled frames. This is not a substitute for watching every transition. |

### By category

| Category | Videos | Warm cast | Pronunciation risk | CTA blocking | Unsupported claim |
|---|---:|---:|---:|---:|---:|
| Beauty | 6 | 6 | 5 | 2 | 6 |
| Fashion | 8 | 8 | 8 | 6 | 7 |
| Home fragrance | 4 | 3 | 4 | 4 | 4 |
| Kitchen | 11 | 7 | 11 | 9 | 11 |
| Supplement/wellness | 21 | 15 | 21 | 17 | 21 |

The rates are per generated MP4, not per unique style. Retries are counted separately because they are independent provider outcomes.

## What can be repaired without regeneration

### Limited colour correction — feasible

Two reversible copies were created with a conservative RGB-channel adjustment (`R×0.95`, `G×1.00`, `B×1.08`) and original audio copied bit-for-bit:

| Candidate | Bright RGB red-blue delta before | After | Finding |
|---|---:|---:|---|
| NX22 | 39.7 average | 17.2 average | Noticeably more neutral; garment pattern and product identity remain visually stable in sampled frames. |
| NX25 | 39.3 average | 16.5 average | Whites are cleaner; original beige/green garment palette remains recognizable. |

This processing is suitable only as an optional, bounded per-video correction. A universal filter would damage products that are intentionally warm, amber, beige or gold. The correct architecture must first identify a neutral reference or require an operator preview.

### Exposure and loudness — feasible but cosmetic

NX29 audio normalization changed integrated loudness from −18.8 LUFS to −16.8 LUFS and true peak from −4.3 to −2.7 dBFS. It did not change any spoken word, pronunciation, claim or CTA. EQ, denoising and normalization cannot repair mispronunciation.

### Tail removal — narrowly feasible, usually insufficient

If a complete CTA is followed only by unwanted speech, the mixed soundtrack can be faded or muted after the CTA boundary. Without isolated voice and room-tone stems, this also removes ambience and can sound artificial. It cannot repair a CTA that was never completed, a wrong word inside the CTA, or unsupported claims earlier in the clip. No customer video should be trimmed automatically.

## What fundamentally needs new media

- Wrong or unintelligible product/brand pronunciation.
- Unsupported claim spoken in the middle of a clip.
- Missing, wrong or incomplete CTA.
- Lip-synced presenter speech requiring replacement: a new voice track would no longer match the lips.
- Material product morphing, anatomy or Shariah failure across motion.
- Scene composition or product identity failure that is present throughout the render.

## Nexabot audio capability

The official Nexabot developer documentation lists a separate synchronous ElevenLabs voice endpoint, `POST /api/v1/voice`, with text, voice ID, language code and optional timing metadata. It does **not** document an endpoint that replaces the audio of an already generated MP4 or re-lip-syncs an existing presenter video.

Therefore:

- A separate TTS-and-mux path is technically possible outside Nexabot video generation.
- It is viable mainly for faceless/off-camera voiceover styles.
- It requires an approved text source, which changes the current “Nexabot writes every word” architecture.
- It is unsuitable for visible presenters without a supported lip-sync workflow.
- It would add a documented 0.02 provider-credit cost per TTS request in a future authorized experiment; none was spent here.

Official source: https://nexabot.id/developers

## Prompt-complexity findings

Observed payload statistics across all 50 jobs:

- Mean 24,828 characters.
- Mean 3,436 words.
- Mean 64 strong directives.
- All prompts contain the same large global foundation plus a style director.

Concrete conflicts:

1. The evidence contract says no confirmed benefit exists, but then permits “one ordinary buyer benefit” from category understanding. The provider repeatedly turns that permission into efficacy/performance claims.
2. The speech contract asks for hook + introduction + selling point/benefit + optional FOMO + CTA across most of 15 seconds. This increases word density and moves CTA delivery too close to the cut.
3. “Natural imperfect articulation” is useful creative direction but can be read too broadly when accurate brand and CTA pronunciation are also mandatory.
4. Dozens of repeated negative instructions do not produce stronger compliance; they compete with style-specific intent and make priority resolution opaque.

This is evidence for consolidation, not an arbitrary character limit and not a request to change the 30 style identities.

## Recommended premium-quality architecture

1. **Compact evidence packet:** keep product identity, image-observable facts, customer-confirmed facts and forbidden claims as separate structured fields. If no confirmed benefit exists, do not grant a generic “ordinary benefit” exception.
2. **Style director remains intact:** retain the 30 concepts, but send one concise effective director rather than repeating the entire catalogue-wide policy in multiple sections.
3. **Single authoritative speech budget:** describe one hook, one grounded point and one CTA. Do not require FOMO unless supported. Nexabot continues writing dialogue.
4. **Audio mode split:** presenter/lip-sync remains native generation; faceless voiceover may later offer an explicitly authorized TTS replacement path.
5. **Deterministic post-processing:** optional previewed neutral-white correction, standards-based loudness normalization and safe MP4 validation. Never claim these repair creative or factual defects.
6. **Evidence-backed review, not arbitrary rejection scores:** official demos receive transcript review, full-motion physics/Shariah review and owner sign-off. Customer videos expose retry/report controls rather than silently failing based on a synthetic score.
7. **Provider observability:** retain prompt, input hash, task ID, transcript, CTA boundary, cost and final media hash exactly as this campaign did.

## Financial impact

- Existing campaign: 15.00 supplier credits produced 50 diagnostic assets but no complete 30-demo publishable set.
- Repeating the same 30 + 20 retry pattern would cost another 15.00 credits with no evidence of a materially higher success rate.
- Deterministic colour/loudness processing is local compute only and costs zero provider credits.
- A future separate voice request is documented at 0.02 credits, but would not solve visible-presenter lip-sync and was not exercised.
- The largest expected improvement comes from eliminating contradictory benefit permissions and reducing speech density before any future bounded provider test. The magnitude cannot be honestly predicted without new authorized MP4 evidence.

## Recommended production-release criteria

These are review requirements, not a new automated creative-score gate:

- Full clip watched with audio by a reviewer.
- Product identity, scale and continuity remain plausible throughout.
- No unsupported efficacy, performance, scarcity, testimonial or regulated claim.
- Selected CTA is understandable, spoken once and complete before the cut.
- No speech-like gibberish after CTA.
- Malaysian Malay is natural enough for the intended style, with correct product and CTA pronunciation.
- Any colour correction is compared against the source product and approved visually; no universal filter.
- Presenter movement and every transition comply with Shariah requirements.
- Only owner-approved clips become official demos.

## Candidate reassessment

- **NX22:** best coherent fashion candidate; colour is substantially repairable, but malformed speech remains. Owner inspection only.
- **NX25:** visual garment continuity is strong and colour improves locally, but unsupported comfort language remains. Owner inspection only.
- **NX29 retry:** strongest neutral visual candidate and complete CTA; loudness is repairable, but malformed words and inferred usability remain. Owner inspection only.

None becomes publishable solely because the POC improves colour or loudness.

## Safety boundary confirmation

- New Nexabot submissions: 0.
- Additional supplier expenditure: 0.
- Customer wallet changes: none.
- Production deployment: none.
- Public demo replacement: none.
- Original 50 MP4s: unchanged and preserved.

