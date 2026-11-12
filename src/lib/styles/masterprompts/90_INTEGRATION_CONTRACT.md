# 90 • IMPLEMENTATION / ANTIGRAVITY CONTRACT — NO MASTERPROMPT REWRITING
Treat this pack as authored creative source of truth. Implement faithfully, do not paraphrase or collapse all styles into generic strings.

## 1. Style ID mapping
- NX01 → `styles/NX01_SEMBANG_KAWAN.md`
- NX02 → `styles/NX02_REVIEW_SAMBIL_PEGANG.md`
- NX03 → `styles/NX03_FIRST_IMPRESSION.md`
- NX05 → `styles/NX05_MASALAH_SEHARIAN.md`
- NX07 → `styles/NX07_SOALAN_JAWAPAN.md`
- NX09 → `styles/NX09_GOYANG_PRODUK_VO.md`
- NX10 → `styles/NX10_LABEL_TALK_FUNCTION_FIRST.md`
- RH01 → `styles/RH01_GOYANG_PRODUK_NATURAL.md`
- RH02 → `styles/RH02_GENTLE_PRODUCT_TILT.md`
- RH03 → `styles/RH03_PICK_UP_PUT_DOWN.md`
- RH04 → `styles/RH04_SHELF_PICKUP.md`
- RH17 → `styles/RH17_DESK_SETUP.md`
- RH19 → `styles/RH19_WINDOW_DAYLIGHT.md`

## 2. Compatibility with actual repo
Relevant existing files at time of authored pack: `src/lib/styles/registry.ts`, `src/lib/engine/compiler.ts`, `src/lib/engine/voiceover-director.ts`, `src/lib/engine/creative-director.ts`, `src/app/api/jobs/route.ts`, `src/app/(dashboard)/factory/page.tsx`.
- **Do not rename style IDs or change 10s / 15s engine routing.** Registry metadata can keep customer style labels; NX10 copy should clarify usefulness first.
- Replace generic `scriptTemplate` priority: scripts come from Product Brain + style's own hook/flow. Never let a `registry.ts` packaging statement overwrite confirmed product benefit.
- Build a `styleScriptStrategy[styleId]`, `styleVisualChoreography[styleId]` versioned at `affimatik-gems-masterprompts-v5.0`. If internal architecture needs TypeScript data rather than raw MD parsing, translate each instruction exactly and keep MD as auditable canonical source.
- Video job records should snapshot `styleId`, `promptVersion`, canonical product-fact provenance, final `providerPrompt`, source image role and mode, CTA intent, and customer-authored creative direction.
- V10 never compiles or previews an AffiMatik-authored spoken script. Historical script fields remain storage-compatible but are ignored for new generations; Nexabot owns product understanding, dialogue and delivery.
- If user only uploads image, run configured real vision and official info retrieval if available. **No claimed research when no API call**; offer one-field fallback if no useful facts.
- Use provider-specific compact prompts, not entire MD dumped into provider. Respect provider length/format/asset limits; preserve mandatory locks and exact style action, prune redundant prose rather than core constraints.
- RH has no speech; don't turn it into Voice or add captions to communicate benefit. Use use-context + physical action.
- UI brand names: `AffiMatik Voice`, `AffiMatik Motion` for customers. Internal provider fields remain unchanged. Customer should not see underlying vendor strings.
- Existing sample MP4s are NOT automatically `quality_verified`; assess and regenerate only failing samples with approved funds, preserve old previews for audit.

## 3. Compiler pseudo-flow
```text
PRODUCT INPUT → VERIFY / GROUND FACTS → ONE BUYER VALUE
→ LOAD EXACT STYLE MD INSTRUCTIONS → SELECT HOOK/ANGLE FOR STYLE
→ SCRIPT DRAFT (NX only) → SAFETY + TIMING VALIDATOR
→ USER PREVIEW / OPTIONAL EDIT → COMPILE VISUAL ACTION + GLOBAL LOCKS
→ PROVIDER-SPECIFIC PAYLOAD → SUBMIT JOB
→ VERIFY REAL MP4 → PUBLISH OR REJECT
```

## 4. Acceptance contract
Test both the **compiled prompt** and **actual rendered video**. Run five safe product fixtures per NX style: skincare, packaged food, tudung, gadget and home; RH three diverse physical-product fixtures. Test 13 unique actions, unsupported-claim rejection, short 10s scripts, UI/watermark exclusion, full-frame, Shariah. No new real paid generation unless within owner-authorised budget.
