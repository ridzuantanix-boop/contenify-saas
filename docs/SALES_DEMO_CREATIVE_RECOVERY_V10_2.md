# Sales Demo Creative Recovery — Static Release Gate

Date: 15 November 2026 (MYT)  
Branch: `codex/masterprompt-quality-correction`  
Provider submissions in this recovery: **0**

## Root cause from the three failed recordings

### NX01 / SERIYA

- The phrase after the completed CTA is intelligible generated speech, not room noise. Two local Malay Whisper passes identify a separate speech segment at approximately 8.33–9.43 seconds.
- The earlier phrase “memang best untuk kulit” is an unsupported cosmetic benefit. Removing only the tail would not make this clip safe.
- Contract cause: product/category context and generic buyer-problem language were not separated strongly enough from verified facts, allowing Nexabot to turn plausibility into a benefit.

### NX17 / NURIVA

- “Tekan butang di bawah” completes at approximately 9.1 seconds. A separate voiced segment continues until approximately 10.5 seconds.
- Two transcription passes detect speech-like syllables but cannot derive stable semantic words. This is most consistent with failed/garbled speech synthesis after a completed CTA, not an ordinary non-speech sound.
- A future tail cleanup could only be considered after reliable speech-boundary validation. It is not implemented automatically and cannot be used to hide an earlier false claim.

### NX09 / AROMAÉ

- The CTA finishes cleanly at approximately 11.0 seconds; post-CTA speech was not the failure.
- Nexabot invented a comfort/freshness outcome from the category.
- The opening substantially reconstructed the source photograph's counter, flowers, box arrangement and lighting. The old reference instruction protected identity and first-frame use, but did not explicitly exclude the entire source composition.

## Targeted corrections

1. Added a provider-facing `PRODUCT EVIDENCE CONTRACT` that keeps image identity, recognizable category, image-observable physical facts, customer-confirmed facts and unsupported claims in separate buckets.
2. Removed automatic category-to-benefit/core-function/buyer-problem inference from the active single-job path, Auto Factory path and fallback creative profile.
3. Stopped treating customer facts as `verifiedBenefits`; they remain factual context and are never a script.
4. Made a selected CTA the final spoken utterance. After its last word, no word, phoneme, tagline, thanks, outro or verbal filler may follow; only silent physical action and ordinary ambience remain.
5. Added an explicit source-composition exclusion: preserve the product, but do not copy surfaces, decorative props, lighting, shadows, crop, perspective or object arrangement.
6. Kept all 20 authoritative style directors unchanged.

Prompt instructions reduce risk but do not guarantee provider compliance. No automated audio trimming is enabled.

## Proposed bounded validation set

| Style | Product/category | Owner-authorized observable physical fact | Customer-confirmed benefit facts | Effective audio | CTA |
|---|---|---|---|---|---|
| NX01 | SERIYA Radiance Serum / skincare | Small frosted dropper bottle with matching box; both visibly read SERIYA Radiance Serum | None | Spoken presenter | Beg Kuning |
| NX17 | POTONGGO Manual Chopper / kitchen tool | Clear container, turquoise lid, white pull handle and visible blades; lid visibly reads POTONGGO | None | Spoken presenter | Tekan butang di bawah |
| NX09 | AROMAÉ Home Mist / home fragrance spray | Amber trigger-spray bottle with floral box; both visibly read AROMAÉ Home Mist | None | Off-camera voiceover | Tengok detail dekat beg kuning |

The supplement was replaced with the lower-risk POTONGGO physical kitchen tool. The lamp is absent.

## Scene and reference-role preflight

- NX01: neutral lived-in skincare-comparison setting, composition independent from the source image.
- NX17: ordinary food-preparation counter with adult hands and a standard bowl as scale anchors.
- NX09: home entryway shelf; the source counter, flowers, box arrangement and lighting composition are explicitly excluded.
- Product references are identity inputs only and cannot automatically become the opening frame.
- Marketplace UI, pricing, ratings, buttons and seller decoration are excluded.
- Each prompt contains a category-appropriate physical-scale lock.

## Static result

**PASS** — all three final provider prompts passed these checks:

- Evidence buckets separated.
- No known invented benefit inserted by AffiMatik.
- No hardcoded product script.
- Exactly one effective audio mode.
- Selected CTA appears once and is the final speech.
- Product identity preserved while source composition is excluded.
- Independent live-action opening required.
- Realistic scale anchors present.
- Nexabot retains dialogue ownership.
- Three prompt hashes are distinct.

Full prompts: `output/provider-qa/sales-demo-recovery-manifest.json`  
Machine-readable gate: `output/provider-qa/sales-demo-recovery-static-preflight.json`

## Test and next-test budget

- Automated tests: 247 passed.
- TypeScript: passed.
- ESLint: 0 errors; 6 pre-existing `<img>` warnings.
- OpenNext Worker build: passed.
- Estimated next bounded supplier budget: **0.90 Nexabot credits** for exactly three jobs at the latest observed 0.30 credit per job. Actual price must be checked immediately before submission.

No paid job, production deployment, wallet change or public-media replacement occurred in this recovery.
