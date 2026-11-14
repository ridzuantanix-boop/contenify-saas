# AffiMatik Masterprompt Quality Audit V10.2

Date: 14 November 2026
Branch: `codex/masterprompt-quality-correction`

## Confirmed defects and corrections

1. **Overwritten style definitions — confirmed.** `compiler.ts` previously declared a partial `AUTHORITATIVE_STYLE_MASTERPROMPTS` object and then replaced every entry in a loop over `VIDEO_STYLES_REGISTRY`. The dead definitions and overwrite loop are removed. `src/lib/engine/style-directors.ts` is now the single authoritative source containing one complete specification for each of the twenty official styles.
2. **Ungrounded scene fallbacks — confirmed.** The compiler fallback `dapur atau ruang santai`, RunningHub's `ordinary domestic context`, and Creative Director's automatic kitchen/desk/vanity locations are removed. Missing context now remains missing. The provider is told to choose a culturally and physically relevant setting from recognizable category evidence and style, or use a neutral setting when evidence is insufficient.
3. **Audio contradictions — confirmed.** The compiler previously combined style text mentioning voiceover with Ambient/ASMR prohibitions. Every compiled Nexabot payload now contains one authoritative effective mode: `SPOKEN PRESENTER`, `OFF-CAMERA VOICEOVER`, `AMBIENT`, `ASMR`, or `NO SPEECH`. Sound-only payloads do not receive the spoken-output contract or native-dialogue block.
4. **Creative direction diluted by shared assembly — confirmed.** Each style now explicitly defines concept, audience experience, opening, composition, scene logic, interaction, visibility, acting, voice/audio, story objective, relevant information, ending and hard failures. Shared modules are limited to universal identity, factuality, realism, modesty and Zero UI requirements.
5. **Duplicated guardrails — reduced.** Claim restrictions are emitted once in the safety section instead of being repeated in both dialogue and safety blocks.

## Final provider payload order

1. Critical production contract.
2. Selected style full creative direction.
3. Product understanding and context.
4. Human performance and scene behaviour.
5. One authoritative voice/audio direction.
6. Necessary safety and visual locks.
7. Ending requirements.

AffiMatik still supplies no dialogue script. Nexabot remains responsible for product interpretation and original dialogue whenever the selected effective audio mode contains speech.

## Sales-page featured media audit

| Style | Current product | Provider task | Source prompt generation | Technical file | Finding |
|---|---|---|---|---|---|
| NX17 | SERIYA Radiance Serum | `638db4643b23825c` | `affimatik-human-realism-v8.1-reference-lock` | 15.04s, 720×1280, H.264/AAC | Valid real generated MP4. Product identity and presenter framing remain coherent. It is not evidence of V10.2 output. |
| NX01 | LUMÉA Collagen Glow Plus | `6c73eb116b3c820a` | `affimatik-human-realism-v8.1-reference-lock` | 15.04s, 720×1280, H.264/AAC | Valid real generated MP4 with stable presenter/product framing. It is not evidence of V10.2 output. |
| RH03 | NOVA LUMI Table Lamp | `9dc4157b80e7dd29` | `affimatik-human-realism-v8.1-reference-lock` | 15.04s, 720×1280, H.264/AAC | Valid real generated MP4 with believable pick-up/set-down and scale. It is not evidence of V10.2 output. |

The landing page calls these genuine MP4 examples and does not label them as V10.2. They may remain as historical real-output proof, but must not be described as validation of the corrected compiler. A new provider generation is required before claiming V10.2 creative-output PASS.
