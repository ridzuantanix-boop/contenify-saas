# AffiMatik V2 provider QA — 6 November 2026

This records actual Nexabot generations using two unrelated synthetic product images. Transcripts below are machine estimates from local faster-whisper `small`; a Malay-speaking human must verify the audio before a release gate can pass. Test media and contact sheets are kept locally in ignored `output/provider-qa/`, not in Git.

## Final strict-budget run

Two new `i2v` jobs, 0.15 Nexabot credit each (0.30 total), with full compiled prompts and actual PNG reference images. No customer wallet was used. Nexabot balance moved from 83.30 to 83.00. Both jobs returned `done` and downloadable H.264/AAC MP4, video track 10.000s and overall duration 10.026667s.

| Product/style | Provider job | Dialogue and CTA (estimated) | Image/visual QA | Decision |
|---|---|---|---|---|
| LUMA DISH SOAP / NX01 | `eb2e22bf7ae7667a` | Relevant oily-dish problem, ordinary kitchen use and a complete CTA. Says “Sekarang tak perlu risau lagi”, which may imply an unproved result. | Bottle, pump and brand broadly consistent; a white star graphic appears in later frames despite Zero UI/graphic ban. | FAIL: unsupported implication and graphic overlay. |
| NOVA LAMP / NX05 | `5dd64a25e4e88731` | Relevant low-light problem; flexible neck and USB port are visible on the input image. No distinct final CTA; sentence ends with suitability for study desk. | Lamp/head broadly consistent, but a white star appears on the base, changing product identity. | FAIL: missing CTA and altered identity/graphic. |

Earlier Nexabot outputs: `4c158356c9ef8e94` (LUMA), `c1dcfd367c88631d` (NOVA), `9d3e930e4396c53e` (LUMA retry), `aa10bb82be1f015d` (LUMA grounded retry). They proved 10s delivery and product-dependent dialogue, but showed an introductory still frame, Indonesian word forms, unsupported instant-cleaning/eye-relief/special-formula claims, or decorative sparkle overlays. Prompt revisions removed the introductory still in later samples but did not reliably eliminate the other defects.

## Outcome and credit-safe policy

The image gives product identity, visible form and perhaps legible intended use. It cannot prove performance or formulation. The V5 compiler now tells the provider to omit all unsupported claims, forbids decorative glints and reserves the end for a neutral CTA. The final CTA tightening happened **after** the two-job run and has only automated prompt coverage, not live-output validation.

Prompt constraints alone are insufficient for an automatic customer release. Both public generation switches remain OFF. Before enabling Voice, implement or operate an explicit output review that checks the whole audio, product identity, overlay-free visuals, full CTA and 10s duration. A rejected output must never be exposed as completed or settled as a successful customer job. Release the original reservation with an idempotency key; if an automatic retry is offered, cap it at one provider attempt, reuse the same customer request identity, and never reserve or settle customer credits twice. Provider charges from rejected attempts belong in the operator cost ledger, not an extra customer charge. A machine transcript can flag risks but cannot certify Malay claims or visual identity without human QA.

RunningHub Motion remains unverified: image upload succeeded but live submission returned provider code 605 (insufficient balance), so no Motion output or provider cost was measured.
