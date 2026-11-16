# AffiMatik REAL V2 — production release outcome

Date: 2026-11-16 (MYT)  
Branch: `codex/expansion-v1-nx21-nx30`  
Implementation commit: `b522283862e66272446c917c6319b61a454cf8a6`

## Decision

**PRODUCTION DEPLOYMENT BLOCKED.**

The REAL V2 compiler foundation is implemented and passed engineering checks, but the real Nexabot campaign did not produce a complete, safe set of 30 commercially publishable demos. Publishing the generated media would violate the release brief's explicit prohibition against hard-failure, misleading, or incomplete demo videos.

Production was not modified. The last observed production Worker remains `b2f10c7d-0034-4cf3-bf93-2be541ae36e3`.

## Engineering result

- Applied shared REAL V2 true-colour and human-voice direction to all 30 styles.
- Preserved all 30 independent style directors, provider-owned dialogue, Product Scale Lock, Shariah Lock, and customer CTA selection.
- Removed the universal 40–48-word speech target.
- Confirmed the active prompt no longer contains the obsolete 20–30% compact-product scale instruction.
- Added deterministic, idempotent campaign ledgers and recovery-safe atomic evidence writes.
- Full tests: **275 passed across 52 files**.
- TypeScript: **PASS** (`tsc --noEmit`).
- ESLint: **PASS with 0 errors**; six pre-existing `<img>` warnings remain.
- OpenNext Worker build: **PASS**.
- Static prompt preflight: **30/30 PASS**, 30 unique compiled prompts.

## Provider campaign

| Campaign | Submitted | Completed/downloaded | Failed | Debit |
|---|---:|---:|---:|---:|
| Initial 30-style campaign | 30 | 30 | 0 | 9.00 credits |
| Selective bounded retries | 20 | 20 | 0 | 6.00 credits |
| **Total** | **50** | **50** | **0** | **15.00 credits** |

- Live unit price: 0.30 supplier credits per generation.
- Supplier balance: 23.33 before; 8.33 after.
- Approved supplier budget is exhausted; no further submission is allowed under this release.
- Customer wallet impact: **none**.
- Every MP4, prompt, input hash, task ID, poll history, output hash, transcript and contact sheet is stored under `output/affimatik-real-v2-release/`.

## Final media selection

No clip is approved for automatic public publication in this release. The closest review candidates are NX22, NX25 and retry NX29, but each still has a concrete defect:

- **NX22:** visually coherent and modest, complete CTA; warm/cream cast and malformed spoken words.
- **NX25:** coherent garment continuity and complete CTA; strong yellow/cream cast and unsupported comfort description.
- **NX29 retry:** strongest neutral visual presentation and complete CTA; malformed pronunciation plus an inferred ease-of-use claim.

The remaining clips contain one or more hard blockers: unsupported health/performance claims, false scarcity, repeated or incomplete CTA, speech-like gibberish, corrupted pronunciation, or persistent warm colour drift.

| Style | Selected evidence | Final state | Blocking observation |
|---|---|---|---|
| NX01 | retry `e5884a5c445d731a` | BLOCKED | Unsupported calming/aroma claim; corrupted brand/CTA pronunciation. |
| NX02 | initial `1c86daee34017c19` | BLOCKED | Unsupported antioxidant/health claim and corrupted speech. |
| NX03 | initial `658f67c2e6a1dd9f` | BLOCKED | Product identity and dialogue are materially malformed. |
| NX05 | retry `c035e9414b609eb3` | BLOCKED | Unsupported skin-radiance efficacy claim. |
| NX07 | initial `8a25a82a092d0160` | BLOCKED | Unsupported texture/absorption claims and product-name corruption. |
| NX09 | retry `55eadace8fb28f9e` | BLOCKED | Unsupported odour/freshness/scarcity claims. |
| NX10 | retry `447c785385f5d26b` | BLOCKED | Corrupted post-CTA speech and health framing. |
| RH01 | retry `8f2742ddd244a2f8` | BLOCKED | Unsupported glowing/healthy-skin promise. |
| RH02 | initial `39c7fe7505ff4a48` | BLOCKED | Unsupported texture/non-sticky product claims. |
| RH03 | retry `04de20486190ba92` | BLOCKED | Unsupported skin-radiance claim; corrupted CTA. |
| RH04 | retry `2b4bdcbe8aa61c33` | BLOCKED | CTA is cut/corrupted at the end. |
| RH17 | retry `0e4d8d5899a8396e` | BLOCKED | CTA incomplete; incoherent invented usage context. |
| RH19 | retry `a52be98f2450459e` | BLOCKED | Unsupported odour/freshness claim; corrupted CTA. |
| NX11 | retry `fcc5aa22647378e5` | BLOCKED | Unsupported body-relief context and malformed dialogue. |
| NX12 | initial `17c22f5fb06cab57` | BLOCKED | Unsupported hydration/healthy-skin claims. |
| NX13 | retry `ce07b7c4870f5c88` | BLOCKED | Unsupported performance claims; corrupted CTA. |
| NX14 | retry `83e9e059c5cd4350` | BLOCKED | CTA repeated; unsupported energy claim. |
| NX15 | retry `421e2bc211303855` | BLOCKED | Unsupported hydration/skin claims; malformed CTA. |
| NX16 | retry `ca456ae3d8debfb5` | BLOCKED | CTA absent/incomplete; unsupported texture claims. |
| NX17 | retry `35d8159b9947802d` | BLOCKED | CTA repeated; unsupported skin claims. |
| NX21 | retry `6cac4e19d098d74c` | BLOCKED | Fabric claim and fabricated scarcity. |
| NX22 | initial `7e5e71dcbca00ac3` | OWNER-REVIEW ONLY | Coherent visuals and CTA, but warm cast and malformed opening/ending words. |
| NX23 | retry `312ad711b0099624` | BLOCKED | CTA ends at 15.02s; inferred comfort/convenience claims and malformed words. |
| NX24 | initial `abd378afe6fb9fe0` | BLOCKED | Unsupported cool/comfortable fabric claims and corrupted CTA. |
| NX25 | initial `4499c2a596e0359c` | OWNER-REVIEW ONLY | Stable garment, but strong yellow cast and unsupported comfort claim. |
| NX26 | initial `825c86dfd919c6ea` | BLOCKED | Unsupported fabric claim and corrupted CTA. |
| NX27 | retry `d40303ed198d61ee` | BLOCKED | Unsupported durability/stability/scarcity claims; CTA reaches 15.02s. |
| NX28 | initial `ef268c0bf907d66a` | BLOCKED | Unsupported ease/performance claims and repeated/corrupted wording. |
| NX29 | retry `c13814642cb0bf84` | OWNER-REVIEW ONLY | Stronger neutral visuals and complete CTA, but malformed speech and inferred usability claim. |
| NX30 | retry `4f8a3b5153bf3457` | BLOCKED | Required CTA is missing; unsupported chopping-result claim. |

## Root cause and boundary

The provider reliably accepted and rendered jobs, but did not reliably obey truthfulness, pronunciation, CTA-finality, or neutral-white instructions. Selective retries changed individual outputs but did not establish dependable compliance. This is a provider-output reliability limitation, not a queue, billing, wallet or build failure.

Because the brief requires 30 genuine replacement demos and forbids publishing failed candidates, the style gallery and sales-page media were left unchanged. No Worker deployment, database migration, customer-wallet mutation or public asset replacement occurred.

## Evidence index

- Initial ledger: `output/affimatik-real-v2-release/provider-state.json`
- Retry ledger: `output/affimatik-real-v2-release/retries/provider-state.json`
- Initial media QA: `output/affimatik-real-v2-release/MEDIA-QA.md`
- Retry media QA: `output/affimatik-real-v2-release/retries/MEDIA-QA.md`
- Original MP4s: `output/affimatik-real-v2-release/videos/`
- Retry MP4s: `output/affimatik-real-v2-release/retries/videos/`
- Contact sheets: `output/affimatik-real-v2-release/contact-sheets/` and `retries/contact-sheets/`
- Provider prompts: `output/affimatik-real-v2-release/prompts/` and `retries/prompts/`

