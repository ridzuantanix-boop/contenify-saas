# NX23 & NX27 Final Real-Video Validation

Date: 2026-11-16 (MYT)

## Execution boundary

- Branch: `codex/expansion-v1-nx21-nx30`
- Correction baseline: `9cea5cad8100fd6cb3e5187e92240460882cd71c`
- Staging Worker: `7a4504fb-ba7b-4453-b468-e9d4e846f27c`
- Production modified: no
- Customer wallets charged: no
- Paid retries beyond the two newly authorized slots: no

## Provider result

| Style | Task ID | Provider duration | Debit | MP4 SHA-256 |
|---|---|---:|---:|---|
| NX23 Tudung Styling | `5bb867b8772a0def` | 72.645s | 0.30 | `9a4e538bc44cc77ccfc7465cf2c4dde9bb72e97b6c92e3e3b16aeb595abdaab2` |
| NX27 Kuali Cooking | `e7aecd0e92b065d8` | 83.394s | 0.30 | `cf28987cdfe53b495f362fe10befba6e1aa7897d9d465cc9334a7fe06a01b325` |

Supplier balance moved from 23.95 to 23.35 credits. Actual debit: 0.60 credits.

Both MP4 files are H.264/AAC, 720×1280, 24 fps and 15.04 seconds.

## NX23 — Tudung Styling

Machine-assisted transcript, retaining audible/repeated wording:

> Korang selalu cari tudung yang terus kemas. Tengoklah, tudung sarung ini, awning dia elok sangat. Drape dekat bahu pun nampak cantik dan kemas. Selesa sangat untuk gaya seharian. Sesuai sangat kalau nak jimat masa. Nak tengok detail, nak tengok detail, klik butang dekat bawah.

- Speech: 0.00–13.30s.
- CTA sequence: 10.42–13.30s.
- Final required phrase `klik butang dekat bawah`: 12.18–13.30s.
- No detected speech after 13.30s.
- CTA defect: `nak tengok detail` is repeated twice.
- Unsupported wording: comfort and time-saving claims are not established by the source fixture.
- Colour: targeted scene correction materially improved the result. Bright low-saturation warm-bias proxy improved from 27.616 in Anti-AI V1 to 11.420, while bright neutral-pixel share increased from 5.80% to 19.73%. Visual review confirms a neutral wall and black garment without the earlier amber boutique cast.
- Product: black tudung identity, drape and coverage are recognizable, but the distinctive decorative forehead-edge detail visible in the fixture is not retained.
- Shariah: hair, neck and chest remain covered; sleeves and wrists remain covered in the sampled frames.
- Voice: intelligible, conversational Malaysian Malay, but the repeated CTA opening and unsupported claims prevent release acceptance.
- Recommendation: **TARGETED COLOUR CORRECTION IMPROVED; OVERALL NEEDS TARGETED FIX.**

## NX27 — Kuali Cooking

Machine-assisted transcript, retaining audible wording:

> Korang yang suka memasak itu tengok kuali wok ini memang sesuai sangat untuk dapur rumah kita, senang nak kacau dan cepat panas. Tengoklah rekaan dia yang kemas ini, buat masakan harian makin mudah. Nak tengok detail, klik butang dekat bawah.

- Speech: 0.00–13.48s.
- CTA: 11.04–13.48s.
- Final required phrase `klik butang dekat bawah`: 12.28–13.48s.
- No detected speech after 13.48s; no repeated CTA.
- Timing comparison: Anti-AI V1 speech ran to 15.02s and cut off at `Klik bu...`; the final output completes the CTA with about 1.56s remaining. The targeted timing correction worked.
- Unsupported wording: `cepat panas` is a cookware performance claim not established by the source fixture.
- Colour: the final warm-bias proxy is slightly lower than Anti-AI V1 (13.591 vs 15.714), but mean luminance regressed from 132.543 to 104.523 and the bright neutral-pixel share fell from 29.28% to 10.74%. Visual review confirms a duller/darker kitchen than the previous Anti-AI output.
- Product/physics: wok scale and stirring movement are plausible and remain stable in the sampled frames. Some source handle construction detail is not preserved reliably enough to claim exact identity fidelity.
- Shariah: **FAIL** — the generated hand and wrist are visibly uncovered in sampled frames.
- Voice: energetic and intelligible with a complete natural CTA, but it contains an unsupported performance statement.
- Recommendation: **TARGETED CTA CORRECTION IMPROVED; OVERALL NEEDS TARGETED FIX.**

## Evidence paths

- Provider ledger: `output/expansion-v1-final-validation-retry-1/provider-state.json`
- Run manifest: `output/expansion-v1-final-validation-retry-1/manifest.json`
- NX23 MP4: `output/expansion-v1-final-validation-retry-1/videos/NX23-5bb867b8772a0def.mp4`
- NX27 MP4: `output/expansion-v1-final-validation-retry-1/videos/NX27-e7aecd0e92b065d8.mp4`
- Transcripts: `output/expansion-v1-final-validation-retry-1/transcripts/`
- Matching-timestamp contact sheets: `output/expansion-v1-final-validation-retry-1/contact-sheets/`
- Colour signal comparison: `output/expansion-v1-final-validation-retry-1/color-signal-analysis.json`
- Exact submitted prompts: `output/expansion-v1-targeted-root-cause/after/NX23.txt` and `NX27.txt`

The owner remains the final creative judge. Neither MP4 was published, and NX21–NX30 remain absent from production.
