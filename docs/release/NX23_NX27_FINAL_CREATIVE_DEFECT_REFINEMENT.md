# NX23 & NX27 Final Creative Defect Refinement

Date: 2026-11-16 (MYT)

## Boundary

- Branch: `codex/expansion-v1-nx21-nx30`
- Starting QA commit: `725dd50508b61e46060c97c4ac7621559428174b`
- Staging source only; no provider generation and no deployment
- No wallet, billing, queue, CTA catalogue, Product Scale Lock, Shariah Lock or existing production-style change

## Minimal prompt corrections

Only `STYLE_DIRECTORS.NX23` and `STYLE_DIRECTORS.NX27` changed.

### NX23

- Preserved the proven neutral daylight wall and no-amber source-background rule.
- Replaced broad benefit permission with one image-visible drape/coverage observation.
- Explicitly excluded inferred comfort, cooling, easy-styling, convenience and time-saving claims.
- Required a direct transition into the selected CTA once, with no paraphrased or repeated `nak tengok detail` lead-in.
- Discouraged repeated `sangat`, `memang`, `lah` and `la` without prescribing replacement dialogue.
- Preserved full hijab, chest and wrist coverage, product identity, style concept and spontaneous Pawarna delivery.

Compiled prompt SHA-256:

- Before: `9dc6d988cde67fbcec4f115365121656896b893ae543763c193aeb80eb9ba2ae`
- After: `bd653b19b6467b4fd1c798b1f8d2930b7b9627ee5f9d2316813b15edebd5afb4`

### NX27

- Preserved one-action cooking, realistic wok scale/geometry and the previously corrected unhurried CTA ending.
- Required bright neutral everyday kitchen exposure, visibly white surfaces and no dim amber/cream cast.
- Strengthened female-hand handling so a loose opaque sleeve continuously covers the entire forearm and wrist in every stirring/lifting frame.
- Restricted speech to one observation grounded in visible design or the ordinary cooking action before the selected CTA.
- Explicitly excluded inferred rapid heating, heat distribution, coating, durability, easier cooking and cooking performance.
- Discouraged stacked generic benefits, repeated CTA lead-ins and stock syntax without hardcoding a replacement script.

Compiled prompt SHA-256:

- Before: `a59f8c950d354820b1490ddd092594a314e951e49565a1129711cd967fcbf73a`
- After: `7f91611be4790cff00a1230b4c2ca55211851766e92cf099cdac817c780823d7`

## Unchanged-style proof

Compiled prompt SHA-256 remained byte-for-byte identical for:

- NX21 `6c5b175ce7f865e8adcc687f51151f3560fc2c03839ce1840a86e8fb33da9ed6`
- NX22 `e76ba24bd151a0f1edf86153de6d18b9c87fee7bf36b6e81514806bbff3a6341`
- NX24 `ae74b4282663e5fa3ef164db06a8a5562c4c350785ffcbd3722960c3c712483b`
- NX25 `863cbc7155b99a8502338dabd8624bee0800fc6c3d354ef3245287692e2a6b84`
- NX26 `46baab5eb8ef4e38f7decf651330e6d48437a47557a2f3a6d33d3ec97a6d5ad1`
- NX28 `ca0cee0c49b4229904dbfa545f251d5a4c000fb49c8191859211e18739c50c93`
- NX29 `07a7d0c36b0e2a88b819306a2065a58e5b85e48a03dbcd73a5d658d7e6211cc3`
- NX30 `3c93240d2c584692eba64b3858994f02fcacab9c8e0d9a3f29146384cf2e28a0`

The original twenty production style directors were untouched.

## Validation

- Focused Expansion V1: 8/8 tests passed.
- Full regression: 52/52 files and 275/275 tests passed.
- TypeScript `tsc --noEmit`: passed.
- ESLint: passed with zero errors; six unrelated existing `<img>` warnings remain in `tutorial-showcase/page.tsx`.
- OpenNext Cloudflare Worker build: passed; `.open-next/worker.js` generated.
- Compiled prompts confirm Nexabot remains the sole dialogue writer; no fixed script, mandatory silence or new creative gate was added.

## Creative status

Static validation is complete, but creative quality is **not marked PASS**. Only a future owner-authorized real MP4 generation can demonstrate whether CTA repetition, unsupported wording, NX27 lighting and female wrist coverage are improved in provider output.
