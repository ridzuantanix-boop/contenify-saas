# Global Video Quality V2 — staging evidence

## Scope and evidence

The source is the existing REAL V2 collection at `output/affimatik-real-v2-release/`. It contains 30 MP4s, their provider task IDs, word-timed transcripts, probes and seven-frame contact sheets. The 20 historical bounded retries remain preserved. This audit did not submit Nexabot jobs or alter customer wallets.

| Sample | Actual evidence | Classification |
| --- | --- | --- |
| NX05, task `fe0ad1340aafde2c` | Target CTA “kalau nak cuba, tekan beg kuning”; final ASR segment 13.82–15.02s says “Kalau nak cuba, tekan...” in a 15.04s MP4. Contact sheet shows a presenter still gesturing at the end. | Confirmed incomplete CTA in existing review; word timing supports the late-start failure. |
| NX11, task `fd1d448a2a1ce937` | Target “tekan butang di bawah”; final ASR segment 13.06–15.02s ends “tekan butang di...”. | Confirmed incomplete CTA in existing review. |
| NX14, task `6443bd01d92e1c76` | Target includes “klik butang di bawah”; final ASR segment 14.22–15.02s ends “Kalau nak tengok lebih...”. | Confirmed incomplete CTA in existing review. |
| NX30, task `6406d3a50067b333` | Target “kalau nak cuba, tekan beg kuning”; final segment 11.70–14.96s ends “kalau nak cuba.” | Confirmed missing CTA ending in existing review. |
| NX23, task `e19e840ffc59f3cf` | Seven real frames show a stable black tudung but beige/cream surroundings. Existing ASR has repeated “untuk hari yang” near the end. | Visual colour observation and probable speech repetition. Cause not established by frames alone. |
| NX27, task `72284443073a1428` | Seven real frames show a wok on a gas hob with covered wrist in sampled frames; CTA appears in the transcript by 13.12s. | Sampled frames look plausible; complete moving-physics and pronunciation judgement remains manual. |

Fifteen of the 30 word-timed transcripts end speech at or after 14.5s. This is a **risk marker**, not 15 proven cutoffs. Existing ASR contains obvious phonetic errors, so text alone cannot prove exact pronunciation. The contact sheets show static appearance only; they do not prove motion, lip-sync or final-frame compliance. No authorized niqab-reference MP4 was found in this collection, so niqab preservation remains **unverified on real output**.

## Implementation

- The shared 15-second speaking contract prioritizes complete CTA over one more selling point, keeps Nexabot responsible for dialogue and avoids an artificial fixed script.
- Shared human direction asks for plausible phone footage, stable anatomy and natural stillness. A reference-conditional niqab rule blocks uncovered lip-sync or smile requests; speaking-avatar and faceless endings are separate from silent/ASMR modes.
- The media gate records structural checks after private MP4 storage. Missing speech audio, missing/empty file or duration mismatch are `QUALITY_FAIL`. Structurally valid outputs are `QUALITY_UNCERTAIN` because no validated speech or vision detector is present. `QUALITY_PASS` is intentionally not issued by this first detector. This prevents a technical MP4 check from being misrepresented as creative approval.
- Customer reports are bound server-side to a completed job in the user's workspace. Admin review changes report status only. It cannot issue wallet credits or trigger a provider job.
- Quality recording is disabled by default through `OUTPUT_QUALITY_GATE_V2_ENABLED`. Customer reporting requires migration `00042_video_quality_v2.sql` and should be enabled only in an environment where that migration is applied. Quality recording fails open for delivery.

## Detector benchmark on existing media

The current gate can identify metadata and audio-stream defects, but it cannot identify the four reviewed incomplete CTAs. If all 30 structurally valid MP4s are passed through it, they receive `QUALITY_UNCERTAIN`; CTA-cutoff recall is **0/4**, false automatic cutoff failures are **0/26**, and uncertain rate is **30/30**. Precision is undefined because this detector makes no CTA-positive claims. This is an explicit limit, not a claim of commercial quality.

## Financial boundary

No automatic quality retry or compensation is enabled or implemented in the customer wallet path. Existing provider-failure reservation release and idempotent job admission remain untouched. A future one-retry remedy needs a validated audio detector, authoritative finance entitlement, a durable one-attempt ledger and owner-approved provider budget before activation. The historical REAL V2 supplier charge was 0.30 credit per generation (50 jobs, 15.00 credits). [Nexabot's current developer documentation](https://nexabot.id/developers), checked 22 November 2026, also lists Omni Flash 1.2 at 0.30 supplier credit per video without API Unlimited; the account's actual plan remains to be verified. At that pay-as-you-go rate, retrying 5%/10%/20% of jobs would add 0.015/0.030/0.060 supplier credits per original job. The media-integrity check itself makes no paid provider call. Launch Pack and FOMO profitability cannot be certified without the account plan, MYR conversion, overhead and actual realized revenue; no prices were changed.

## Release gates

| Component | Decision | Reason |
| --- | --- | --- |
| Compact prompt and conditional ending | STAGING GO; production blocked | Static tests can prove payload consistency, not a better real MP4. Matched paid A/B needs separate approval. |
| Niqab identity rule | STAGING GO; production blocked | No real niqab-reference output is available for frame-by-frame validation. Text cannot guarantee coverage. |
| Structural quality assessment | STAGING GO; production blocked | Strong metadata failures only; CTA, voice and visual defects remain uncertain. |
| Customer problem reporting | STAGING GO after migration and browser test | Workspace ownership and service-only RLS are implemented; staging schema and UI journey must be checked. |
| Automatic quality retry | BLOCKED, OFF | No validated CTA detector or approved repeat supplier expenditure. |
| Automatic credit compensation | BLOCKED, OFF | No reviewed entitlement and finance transaction path for subjective or uncertain output. |

No production release or supplier submission is part of this implementation.
