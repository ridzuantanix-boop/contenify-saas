# NX23 & NX27 Final Real-Video Validation — Provider Incident

Date: 2026-11-16 (MYT)

## Scope and release boundary

- Branch: `codex/expansion-v1-nx21-nx30`
- Approved correction commit: `9cea5cad8100fd6cb3e5187e92240460882cd71c`
- Staging Worker: `7a4504fb-ba7b-4453-b468-e9d4e846f27c`
- Production modified: no
- Customer wallets charged: no
- Automatic retries: no

## Preflight

- Provider model: Omni Flash 1.2 (`omni_flash`)
- Mode: i2v
- Duration: 15 seconds
- Resolution: 720p, vertical 9:16
- Live unit price: 0.30 Nexabot credits
- Authorized total: 0.60 Nexabot credits
- Supplier balance before submission: 24.45 credits
- Active provider jobs before submission: 0

Both test slots used the original fixture bytes twice and preserved the approved image order, style, CTA, model, duration, resolution and provider settings. The harness verified that only the targeted NX23 and NX27 prompt corrections differed from the previous Anti-AI payloads.

## Submission result

| Style | Submission | Provider response | Task ID | Debit | MP4 |
|---|---:|---|---|---:|---|
| NX23 Tudung Styling | 1 of 1 | HTTP 500, nginx `Internal Server Error` | none | 0.00 | none |
| NX27 Kuali Cooking | 1 of 1 | HTTP 500, nginx `Internal Server Error` | none | 0.00 | none |

Submission timestamps were recorded in `output/expansion-v1-final-validation/provider-state.json`. The provider job list was reconciled after the requests: no task newer than the submission window existed and no active job existed. Supplier balance remained 24.45 credits, so the actual debit was 0.00.

## Evidence

- `output/expansion-v1-final-validation/manifest.json`
- `output/expansion-v1-final-validation/provider-state.json`
- `output/expansion-v1-targeted-root-cause/after/NX23.txt`
- `output/expansion-v1-targeted-root-cause/after/NX27.txt`
- NX23 fixture SHA-256: `1843370064abc23e09f23f1387b3a364e40e35f1c8e000c6c2c760f5c7324a10`
- NX27 fixture SHA-256: `3a18b438691246dd8545edb0a65cad59bf7aae27ee642176fb06a515aa0be663`

No transcript, CTA timing, contact sheet, colour comparison or creative-quality verdict can be produced for this run because the provider created no task and returned no media. Existing baseline and Anti-AI videos remain unchanged.

## Safety correction

The diagnostic harness now treats an HTTP 5xx without a task ID as an ambiguous provider outcome and stops without retrying. This prevents a later submission from proceeding until the original request is reconciled.

## Recommendation

Do not infer success or failure of the targeted NX23/NX27 creative corrections from this incident. A new bounded authorization is required for any further paid submission because both approved one-shot slots were consumed, even though the provider charged zero credits.
