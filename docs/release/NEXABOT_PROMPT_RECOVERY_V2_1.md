# Nexabot 1,000-character prompt recovery V2.1

## Provider boundary

The owner confirmed Nexabot's announced 1,000-character video-prompt limit. The public [Nexabot developer page](https://nexabot.id/developers) documents a single JSON `prompt` field and separate `media` array, but does not publish the character-count algorithm. An authenticated read-only `/api/v1/modes` response exposed no prompt-limit metadata. Until Nexabot specifies the algorithm, both compiler and transport require **max(UTF-16 code units, Unicode code points, UTF-8 bytes) ≤ 1,000** for the parsed `prompt` string. Image bytes, URLs and JSON syntax are not counted as prompt characters. There was no paid boundary probe.

No text is silently truncated. Customer instructions and product facts remain complete; an over-budget prompt fails preflight before credit reservation, and the provider adapter also rejects it before submission. The previous personalization sanitizer's `.slice(0, 1000)` was removed.

## Failure diagnosis

| Real task | Observation | Prompt cause or provider limitation |
| --- | --- | --- |
| NX01 `bbcb9527ffb95a82` | CTA repeated | Old prompt requested one CTA, but provider repeated it. Prompt compliance limitation, not evidence of truncation. |
| NX07 `2215131029562fde` | Garbled speech after completed CTA | Provider continued producing speech-like audio despite ending instruction. Prompt alone cannot guarantee termination. |
| NX03 `bc183d0a24025f59` | CTA began around 13.3 s and was cut by 15 s | Old prompt reserved too little room for the CTA; provider still controls actual speech timing. |
| NX02 `7bca5d05aea873fe` | CTA repeated and corrupted | Provider speech/ending failure despite an explicit CTA instruction. |

All four clips showed oversized bottles despite the previous size instruction. The old directive to speak only from visible product details offered no positive selling direction and plausibly favoured descriptions of bottles and labels. This is a prompt-design hypothesis supported by the assembled prompts and observed dialogue, not a claim that every defect is fixable by text. No video quality is marked PASS by this static audit.

## Targeted correction

The compact compiler now combines one global contract, the unchanged style concept, the customer's CTA, and conditional references/context. It tells Nexabot to sell supported uses or ordinary product function rather than defaulting to packaging talk. Nexabot still writes the hook, story and all speech. It preserves product/avatar identity, modesty and niqab coverage, plausible product scale, natural Malaysian UGC, true whites, and a single completed CTA. Faceless voiceover ends with hands settling; visible presenters stop speaking with a relaxed expression. No style director was rewritten.

Candidate A is the active staging choice. Candidate B is an offline comparison with a stronger CTA timing cue. Neither has been validated by a new MP4. The four rejected-job payloads have been reassembled with the exact earlier reference image hashes and provider settings. A duplicated, test-harness-authored customer-direction string was omitted because it repeated system instructions; real customer-authored text remains verbatim.

## Static evidence

`output/nexabot-prompt-recovery-v2-1/style-budget.tsv` contains each of 30 styles, both candidates, counts for global/style/CTA/context/niqab/separators and SHA-256 of the final prompt. `audit.json` contains the complete budgets and four rejected-job comparisons. The four exact candidate prompts and sanitized payloads are in the same folder.

All 30 styles passed mandatory-semantics checks and both candidates fit under 1,000 UTF-8 bytes. The longest tested prompt was 955 bytes for A and 965 for B (45/35 bytes of margin). This is a static, fixed-context result; longer customer facts may fail safely. Previous rejected-job prompt lengths were 920, 910, 994 and 907; matching candidate A lengths were 794, 784, 874 and 781.

The provider's published Omni Flash price is 0.30 credits per video. A future four-job controlled comparison would therefore cost about 1.20 supplier credits at that rate, subject to a fresh balance/price check and separate owner authorization. No Nexabot submission or customer-wallet debit occurred in this recovery.

**Production: BLOCKED pending real-video validation.** Staging deployment and test results are recorded in the release report after validation.
