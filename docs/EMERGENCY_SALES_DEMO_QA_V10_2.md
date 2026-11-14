# Emergency Sales Demo QA — V10.2

Date: 14 November 2026 (MYT)  
Compiler: `pawarna-masterprompt-director-v10.2-quality-audit`  
Campaign limit: three paid submissions, no retries

## Provider receipt

| Style | Product | Task ID | Provider debit | Technical media |
|---|---|---|---:|---|
| NX01 | SERIYA Radiance Serum | `a3134bba0af4f9e3` | 0.30 credit | H.264/AAC, 720×1280, 15.04s |
| NX17 | NURIVA Omega-3 | `518ed28c052b8d3a` | 0.30 credit | H.264/AAC, 720×1280, 15.04s |
| NX09 | AROMAÉ Home Mist | `d04d733f23e1a89c` | 0.30 credit | H.264/AAC, 720×1280, 15.04s |

Opening balance was 27.15 provider credits. Closing balance was 26.25. Total observed debit was 0.90 provider credits. The campaign did not retry or submit any fourth task.

## Audiovisual decisions

The transcript was checked with two local Malay Whisper passes. Product-name spelling below is normalized only where both the reference and intended pronunciation are unambiguous. Unintelligible generated syllables remain explicitly marked.

### NX01 — FAIL

Transcript:

> “Korang yang tengah cari serum, kena tengok yang ni. SERIYA Radiance Serum ni memang best untuk kulit. Kalau nak tengok detail, tekan beg kuning sekarang. Sama cari serum.”

- Product scale: PASS. The small bottle remains smaller than the presenter's face and plausible against both hands.
- Identity: visually recognizable as the SERIYA bottle family, although fine label text is not a reliable exact reproduction.
- CTA: “tekan beg kuning” is complete at approximately 7.7s.
- Speech end: approximately 9.4s.
- Hard failure: “memang best untuk kulit” is an unsupported cosmetic-benefit claim.
- Hard failure: the extra “Sama cari serum” after the CTA is semantically broken and violates the clean-ending contract.

### NX17 — FAIL

Transcript:

> “Kalau tengah cari suplemen harian, boleh pertimbangkan NURIVA Omega-3 ini. Tekan butang di bawah, [suku kata tidak jelas/tidak bermakna].”

- Product scale: PASS. Bottle and box remain plausible against the adult hand, torso and table.
- Identity: PASS at normal viewing size; NURIVA and OMEGA-3 remain recognizable.
- CTA: “Tekan butang di bawah” is complete at approximately 9.1s.
- Speech end: approximately 10.5s.
- Hard failure: the model continues with unintelligible generated syllables after the selected CTA instead of ending naturally.
- Quality failure: the opening “Kalau tengah cari…” remains too close to a generic catalogue-wide hook for a featured commercial demo.

### NX09 — FAIL

Transcript:

> “Rumah selalu berbau kurang segar. Guna AROMAÉ Home Mist ni memang sesuai untuk suasana yang lebih selesa. Kalau nak tengok detail, tekan beg kuning sekarang.”

- Product scale: PASS. The household spray bottle remains plausible against the hand and counter.
- Identity: AROMAÉ Home Mist remains recognizable.
- CTA: “tekan beg kuning” is complete at approximately 11.0s.
- Speech end: approximately 11.0s.
- Hard failure: “guna …” to remedy a less-fresh smell and “suasana yang lebih selesa” assert performance/benefit not established by the reference.
- Hard failure: the opening composition substantially reuses the isolated reference arrangement (same bottle/box relationship, beige counter, floral props and lighting) instead of a freshly composed live-action first frame.

## Release decision

No candidate meets the commercial creative acceptance gate. None is copied into `public/style-previews`, none is placed on the sales page, and no production Worker is deployed.

The existing production media remains unchanged because the brief prohibits publishing failed clips and prohibits removing functional media without a verified replacement. The existing desk-lamp featured demo is therefore a known unresolved requirement; removing it safely still requires a verified replacement asset.

## Evidence paths

- Receipt: `output/provider-qa/emergency-sales-demo-v10-2/receipt.json`
- Transcripts: `output/provider-qa/emergency-sales-demo-v10-2/transcripts-biased.json`
- NX01: `output/provider-qa/emergency-sales-demo-v10-2/NX01-candidate.mp4`
- NX17: `output/provider-qa/emergency-sales-demo-v10-2/NX17-candidate.mp4`
- NX09: `output/provider-qa/emergency-sales-demo-v10-2/NX09-candidate.mp4`
- Contact sheets: `output/provider-qa/emergency-sales-demo-v10-2/NX01-contact.jpg`, `NX17-contact.jpg`, `NX09-contact.jpg`
