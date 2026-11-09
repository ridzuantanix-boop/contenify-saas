# AffiMatik V8.1 Staging QA — 9 November 2026

## Release boundary

- Branch: `codex/human-realism-v8`
- Staging Worker: `affimatik-launch-lite-staging`
- Staging version: `1e3a051f-0676-4d88-ac3c-c7503fdec37f`
- Production was not deployed or changed.
- RunningHub and public paid checkout remained off.

## Dialogue correction

V8.1 removes compliance-sounding spoken phrases and the automatic minimum-word filler. Product facts are still validated before compilation, but the presenter no longer says phrases such as “fakta yang disahkan”, “maklumat yang disahkan”, “nilai kesesuaiannya” or “rujuk maklumat yang sah”.

The explicit creative source available in the repository was `src/lib/styles/masterprompts/02_SCRIPT_FIXTURES.md` for the seven original Voice styles. The remaining style hooks and physical identities were bounded by the approved 20-style V6 registry. No product benefit was added beyond the single customer-confirmed fact.

Examples:

| Style | V8 before | V8.1 after |
| --- | --- | --- |
| NX07 | “Apa yang perlu tahu tentang produk? Fakta yang disahkan ialah…” | “Produk ni ada apa? Yang jelas, {customer fact}. Ha, itu yang korang boleh tengok dulu.” |
| NX16 | “Kalau produk ini sesuai… fakta yang disahkan ialah…” plus formal filler | “Aku share santai je, produk ni {customer fact}. Kalau ngam dengan apa yang korang cari, boleh tengok.” |
| NX17 | “Satu perkara yang disahkan ialah…” plus suitability disclaimer | “Eh, tiba-tiba teringat produk ni. Yang ni {customer fact}. Boleh tengok kalau memang korang perlukan.” |

## Provider failure experience

- Customer messages now distinguish provider outage, provider rejection, unusable MP4 and unexplained generation failure.
- Customer copy never exposes the Nexabot vendor name.
- Failed dispatches and terminal provider failures explicitly confirm automatic credit restoration.
- Technical provider details are retained separately in `raw_status` for administrators.
- A browser that encounters provider unavailability pauses Generate for five minutes to prevent repeated submissions.
- Reconciliation releases an orphan after 30 minutes and closes any provider job still pending/running after a 45-minute hard limit. All release and settlement keys remain idempotent.

The first controlled V8.1 CTA run encountered three provider HTTP failures. All three local reservations were released; the isolated wallet remained 60 with no provider credit decrease. This exercised the new customer-safe failure response without production changes.

## Real MP4 CTA and timing evidence

| Test | Job / provider task | Result | Speech end | CTA result | Provider cost |
| --- | --- | --- | ---: | --- | ---: |
| Supplement NX07, Beg Kuning retest | `94fc2521-c150-4027-8930-8b810209f952` / `e9cc5ee0f0681e6f` | Completed, 15.04s | ~13.0s | **FAIL** — provider repeated Beg Kuning despite one literal CTA in final prompt | 0.15 |
| Beauty NX16, Klik Butang | `133b3859-ff16-4855-9a01-9cde2341ba14` / `90f0a75357fd29b4` | Completed, 15.04s | ~13.0s | PASS — spoken once and complete | 0.15 |
| Kitchen NX17, Tanpa CTA | `a6aa9ed7-ae3e-4117-9b64-24bf4c200cd2` / `33a9798df545b2d6` | Completed, 15.04s | ~7.84s | PASS — no CTA added | 0.15 |

The initial Beg Kuning output also cost 0.15 and repeated the CTA. Total successful V8.1 QA provider usage was 0.60 Nexabot credit. Failed pre-dispatch attempts did not reduce the observed provider balance.

All three accepted outputs contain H.264 video and AAC audio, were ingested into private storage, returned full HTTP 200 and Range HTTP 206, and settled exactly one 10-credit reservation each. The isolated QA wallet—not a customer wallet—was used.

The supplement did not add a health efficacy outcome. Product identity remained recognizable. The no-CTA kitchen output continued with a changed product-hold pose after speech rather than an identical frozen ending. The beauty output contained small star-like sleeve details that may be a provider-created visual artifact and is not represented as a perfect visual-quality pass.

## Verification

- Automated suite: 37 files, 194/194 tests passed.
- TypeScript: passed.
- ESLint: passed.
- OpenNext Worker build: passed.
- Staging deploy: passed.
- Real CTA generation: two accepted behaviours, one provider limitation.

V8.1 is technically stable on staging, but “TikTok Shop — Beg Kuning” is not verified reliable because Nexabot repeated it on both real attempts. Human realism is therefore not reported as a universal PASS.

## Duplicate ingredient-reference / first-frame lock

All 20 Nexabot styles now compile the same strong reference-role lock: the product image is ingredient/subject identity guidance and must never be reused, traced, extended or animated as the opening frame. The opening must be a freshly composed live-action scene with movement from frame zero. The adapter uses any spare Nexabot media slot to send the exact product image twice:

- Product only: product, duplicate product.
- Product plus one avatar or background: product, duplicate product, selected reference.
- Product plus avatar plus background: product, avatar, background. Nexabot's three-image limit prevents a fourth duplicate, and no customer-selected reference is dropped.

Controlled application-path evidence:

- Staging job `3f508821-ea29-4ffe-9615-1570dd74ce76`; provider task `a5db0afa477f1f0a`.
- NX17 kitchen product, no CTA, completed at 15.04 seconds; provider cost 0.15.
- The compiled prompt snapshot contains the ingredient lock, the duplicate-product declaration and the freshly composed opening directive.
- Opening frame is a new kitchen presenter scene, visually different from the isolated product reference. The product enters later and remains recognizable through the ending.
- Private MP4 persistence passed; full stream HTTP 200 and Range HTTP 206.
- Isolated wallet: 60 available / 0 reserved → 60 / 10 during processing → 50 / 0 after exactly one settlement.
