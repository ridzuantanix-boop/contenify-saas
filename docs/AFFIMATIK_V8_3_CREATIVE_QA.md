# AffiMatik V8.2/V8.3 Creative QA

Date: 10 November 2026  
Branch: `codex/creative-rebuild-v8-3`  
Baseline: `1eef6c1` above production runtime `c12c5f0`

## Root causes corrected

- Six RH Smart Scripts narrated visible hand/camera actions instead of giving buyer context.
- Universal 20–30% frame occupancy enlarged products regardless of real category scale.
- Voice personality was forwarded as a label without concrete acting and vocal behaviour.
- Presets were hidden inside Customize and could carry an old product fact or custom script into a new product.
- Posters used separately invented artwork rather than frames from their associated MP4.
- Hand-only language was insufficiently explicit for Nexabot and sometimes produced a presenter.

## V8.3 implementation

- Twenty distinct, human-authored Malaysian Smart Script patterns with category-safe buying considerations and three selectable variants: style, direct and helpful.
- Friendly, energetic, calm, confident, helpful and premium personalities now compile into concrete vocal-performance directions.
- Voiceover is prohibited from narrating camera angle, bottle rotation, hand action, label visibility, colour or packaging appearance.
- Fixed frame occupancy was replaced by category-aware plausible scale, grip, perspective and contact-shadow rules.
- Human Performance Director now covers irregular blinking, motivated gaze, relaxed jaw, breathing, weight distribution, posture, purposeful gestures, natural light and colour.
- Product-handling styles support Voiceover plus experimental Ambient and ASMR. Provider silence remains explicitly non-guaranteed until tested.
- Quick Create now follows Product → Preset → Style → Script/CTA → Generate. Presets are visible directly and never replace the newly selected product.
- Applying or saving a preset clears product facts and custom product scripts so old claims cannot leak into a new product.

## Genuine Nexabot tests

All media: Nexabot i2v, 15.04 seconds, 720×1280 H.264 video and AAC audio. Total provider cost was 1.65 credits: 1.05 for seven initial candidates and 0.60 for four bounded retries.

| Candidate | Final task | Product | Actual speech end | Result |
| --- | --- | --- | ---: | --- |
| RH01 Voice | `c7ac0c88f157f437` | AROMAÉ Home Mist | 12.80s | PASS; hand-only after retry, replacement selected |
| RH02 Voice | `d929ae7bf0cb5842` | SERIYA Radiance Serum | 8.03s | PASS; plausible small bottle, meaningful continued handling |
| RH03 Voice | `9dc4157b80e7dd29` | NOVA LUMI Table Lamp | 8.18s | PASS; plausible desk scale, clear pickup/place action |
| RH03 ASMR | `878028a85ff5c171` | NOVA LUMI Table Lamp | none | PASS as experimental comparison; no detected speech |
| RH04 Voice | `76243b79295d3a64` | VEILÉ Sun Fluid SPF 50 | 11.44s | PASS after category fix; hand-only shelf action |
| RH17 Voice | `10d9cee9a39f123e` | NOVA LUMI Table Lamp | 11.77s | PASS after retry; hand-only desk placement |
| RH19 Voice | `167ed54b10d11a41` | SERIYA Radiance Serum | 14.99s | NOT PROMOTED; hand-only fixed but speech ends too close to cut |

The five PASS voice candidates are the staging style previews. The verified RH03 ASMR comparison is retained at `/qa-previews/v8-3/RH03-asmr.mp4` for staging review and is not advertised as guaranteed silence.

Initial failed-comparison task IDs remain recorded in the private QA receipt: RH01 `77396fc053e34782`, RH04 `0cb558bda9964452`, RH17 `ceaf50992f0c15d4`, RH19 `32809c71c9bc3a96`.

### Actual transcript evidence

- RH01 retry: “Korang yang tengah survey Aromae Home Mist, jangan tengok rupa saja… sebelum pilih tengok dulu cara guna dan detail yang dinyatakan… tengok sesuai tak dengan keperluan korang.”
- RH04 retry: “Kalau memang tengah cari Veilé Sun Fluid SPF 50… jangan terus ambil satu, tengok detail dan cara guna yang dinyatakan dulu… semak dulu kandungan dan cara pakai yang dinyatakan.”
- RH17 retry: “Kalau korang selalu buat kerja dekat meja… lampu meja berbentuk kubah… bayangkan dulu kedudukan dia dalam setup yang korang ada… check dulu fungsi dan cara sambungan yang dinyatakan.”
- RH19 retry reached the final frame while speaking and is therefore evidence of a remaining provider timing limitation, not a PASS.

Automatic transcription can misspell brand names and colloquial words; the stored time-coded result is used for timing and semantic QA, not as a claim of exact provider pronunciation.

## Poster/video audit

All twenty style posters were rebuilt from the exact 7-second frame of their associated MP4, then branded with the matching style ID, title and tagline. This removes unrelated actor, product, environment and framing mismatches by construction.

| Styles | MP4 status | Poster status |
| --- | --- | --- |
| NX01, NX02, NX03, NX05, NX07, NX09, NX10 | Existing V8.1 samples retained | Rebuilt from exact matching MP4 frame |
| RH01, RH02, RH03, RH04, RH17 | Verified V8.3 replacements selected | Rebuilt from replacement MP4 frame |
| RH19 | Existing working sample retained; V8.3 comparison not promoted | Rebuilt from retained MP4 frame |
| NX11, NX12, NX13, NX14, NX15, NX16, NX17 | Existing V8.1 samples retained | Rebuilt from exact matching MP4 frame |

## Remaining provider limitations

- Nexabot can still mispronounce or partially alter brand names and requested wording.
- Hand-only compliance improved after the hard lock but remains model-dependent.
- Speech duration is not frame-exact; RH19 demonstrated an end-of-clip timing miss.
- Ambient/ASMR is experimental. One RH03 ASMR sample contained no detected speech, but this does not guarantee silence for every generation.
- Provider watermark is accepted under the existing Launch-Lite policy.

Production V8.1 media and customer data were not modified by this creative candidate. The separately requested maintenance wrapper is live in production while V8.3 remains staging-only.
