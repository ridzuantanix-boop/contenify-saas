# AffiMatik V10.2 — Zero-Cost Sales Demo Diagnosis

Date: 15 November 2026 (MYT)  
Branch: `codex/masterprompt-quality-correction`  
Input QA commit: `a056a6a98882e6f1b196366242b2ae05f5ccea94`

## Scope and safety

- No Nexabot submission was made.
- No provider credit was consumed.
- No production code, Worker, customer wallet, job or media was changed.
- The rejected MP4 files remain unchanged. Audio experiments were written to
  `output/provider-qa/sales-demo-final-v10-2/repaired-copies/` only.
- This experiment is not an automatic customer-video trimming feature.

## 1. Product-fact and generated-claim audit

The available evidence consists of the three authorized reference images and the
confirmed physical facts recorded in the QA manifest. There is no owner-confirmed
benefit, efficacy, fragrance, performance or suitability fact for these products.

| Product | Evidence that may be stated | Generated statement | Classification | Reason |
| --- | --- | --- | --- | --- |
| SERIYA Radiance Serum | The label identifies `SERIYA Radiance Serum`; it is a small frosted dropper bottle with a separate matching box. Calling it a serum/skincare product is an ordinary category description. | “Korang yang tengah cari serum baru…” | Supported | Identifies the ordinary product category without promising a result. |
| SERIYA Radiance Serum | Same evidence as above. | “SERIYA Radiance Serum ni memang sesuai untuk kulit.” | Unsupported / unverifiable | The image does not establish skin type, suitability, ingredients, efficacy or who should use it. `memang sesuai` is a suitability claim, not merely product identity. |
| SERIYA Radiance Serum | CTA does not assert a product fact. | “Kalau nak tengok detail, tekan beg kuning sekarang.” | Supported | Neutral navigation/action CTA. |
| POTONGGO Manual Chopper | The image shows a transparent container, turquoise lid, white pull handle and visible blades. `Manual chopper` and `mencincang bahan dapur` describe its ordinary visible function. | “Kalau nak jimat masa memasak…” | Unsupported | `Jimat masa` is a comparative performance outcome. No timed comparison or owner-confirmed evidence exists. |
| POTONGGO Manual Chopper | Same evidence as above. | “Boleh cuba POTONGGO Manual Chopper ini.” | Supported as recommendation language | `Boleh cuba` is a recommendation, not a measurable product claim. |
| POTONGGO Manual Chopper | Same evidence as above. | “Sangat mudah nak cincang bahan dapur.” | Mixed: function supported; ease claim unsupported | Chopping kitchen ingredients is the ordinary function. `Sangat mudah` is a subjective performance claim not established by the image. |
| POTONGGO Manual Chopper | CTA does not assert a product fact. | “Tekan butang di bawah.” | Supported | Neutral navigation/action CTA. |
| AROMAÉ Home Mist | The label identifies `AROMAÉ Home Mist`; it is an amber trigger-spray bottle with a separate floral box. Calling it a home mist/spray for a home space is an ordinary category description. | “Nak rumah sentiasa segar dan selesa?” | Unsupported | `Sentiasa segar dan selesa` promises a continuing sensory/outcome benefit. The image confirms neither scent nor deodorizing/comfort performance. |
| AROMAÉ Home Mist | Same evidence as above. | “Boleh cuba AROMAÉ Home Mist ni.” | Supported as recommendation language | Product identity plus a non-factual recommendation. |
| AROMAÉ Home Mist | CTA does not assert a product fact. | “Tengok detail dekat beg kuning.” | Supported | Neutral navigation/action CTA. |

Natural marketing language is not categorically prohibited. Product identity,
ordinary visible function, neutral recommendation language and action CTAs are
usable. Measurable/comparative outcomes, suitability, sensory results and efficacy
need explicit customer-confirmed evidence; plausibility is not evidence.

## 2. Post-CTA audio diagnosis and repair feasibility

Two independent Whisper model passes and waveform silence detection agree that
NX01 and NX17 contain new speech-like vocal material after a complete CTA. The
material is not normal room tone. It is most consistent with failed/garbled
provider speech synthesis.

| Video | Complete CTA boundary | Damaged speech | Safe edit boundary tested | Result on repaired copy |
| --- | ---: | ---: | ---: | --- |
| NX01 | about 5.84–7.88s | about 8.40–9.62s | 8.30s, inside the silence before the damaged utterance | CTA remains complete; repaired transcript ends at 7.86s with the CTA and detects no later speech. |
| NX17 | about 8.09–9.23s | about 9.70–11.59s (one model extends the speech-like region to about 12.05s) | 9.50s, inside the silence before the damaged utterance | CTA remains complete; repaired transcript ends at 9.24s with the CTA and detects no later speech. |

The diagnostic edit fades only the audio after the manually verified boundary and
fills the remaining tail with a loop from that same video's clean room-tone tail.
The video bitstreams are unchanged:

- NX01 original and repaired video-stream MD5: `fa95a8aa811bdf59caf52abdf4e440ea`.
- NX17 original and repaired video-stream MD5: `70c45203ae60c2116668acacbfbd8213`.

Repair is technically feasible, but neither video becomes suitable for the sales
page: NX01 still contains the unsupported suitability claim and NX17 still contains
unsupported time-saving/ease claims. The repaired copies are evidence only.

## 3. Source-image composition finding

The live-test submitter uses Nexabot `i2v` and sends the same full styled product
image twice in the `media` array. The current provider payload has no structured
field that distinguishes `product identity reference` from `starting frame`; that
role exists only in prompt text.

AROMAÉ's output closely reproduces the source photograph's beige counter,
bottle/box arrangement, flowers and window-light composition. This behaviour also
appeared in the preceding AROMAÉ attempt. The repeated result is evidence that the
i2v visual conditioning can dominate the textual instruction not to copy the
source composition. It does not prove that every Nexabot i2v request always uses
the first reference as a literal first frame.

Safe isolation approach for a future bounded test:

1. Create a deterministic, pixel-preserving cutout of the real bottle and box.
2. Retain the original label pixels, brand, packaging shape, colour and the
   relative scale of the product pair; do not redraw or generatively invent text.
3. Remove marketplace UI, photographic background, flowers and decorative props.
4. Place the cutout on a plain neutral canvas with sufficient padding.
5. If the API still requires two media entries, provide the same isolated identity
   asset rather than duplicating the styled source photograph.
6. Keep physical size anchors and the independent-scene instruction in the prompt.

This reduces composition leakage but cannot be represented as a provider guarantee
until one separately authorized controlled test passes.

## 4. Root causes versus provider limitations

### Technical/input causes

- The request carries a full styled source photograph twice in an i2v media array.
  Reference role is not machine-readable in the payload, so prompt text is the only
  mechanism asking the provider to treat it as identity rather than composition.
- API completion and valid MP4 checks do not validate claims, CTA termination or
  scene independence. Human creative QA correctly rejected these three files.
- Available verified facts contain physical identity only. The provider was told
  not to invent benefits, but it was not given any verified benefit because none
  exists.

### Provider limitations observed

- Nexabot introduced plausible but unsupported marketing language despite the
  factual-claim contract.
- Nexabot appended garbled speech after an otherwise complete CTA in NX01 and NX17
  despite the final-utterance instruction.
- Nexabot's i2v conditioning reconstructed AROMAÉ's source composition despite the
  scene-independence instruction.
- Prompt instructions reduce risk but did not guarantee semantic, audio or visual
  compliance in these real outputs.

## 5. Minimal corrections recommended

These are targeted corrections, not a redesign of the 20 directors:

1. For curated promotional demos, attach a factual context block that explicitly
   separates observed identity, ordinary category/function, customer-confirmed
   facts and prohibited/unverified outcomes. This is context, never a script.
2. Use low-risk products with at least one useful owner-confirmed physical fact.
   If no buyer-relevant fact exists, select a different demo product.
3. Use a deterministic isolated product-identity asset for source photographs with
   strong decorative composition.
4. Retain “CTA is the final spoken utterance”, but treat it as an instruction rather
   than a guarantee. Gate promotional samples by actual transcript/audio review.
5. Allow manual audio-tail repair only for a curated asset after the full CTA is
   proven complete and the preceding video independently passes claim/visual QA.
   Do not enable automatic trimming for customer output.

## 6. Salvage decision

| Video | Audio-tail repair | Sales-page salvage | Decision |
| --- | --- | --- | --- |
| NX01 SERIYA | Technically clean on a copy | No | Unsupported skin-suitability claim remains before the CTA. |
| NX17 POTONGGO | Technically clean on a copy | No | Unsupported `jimat masa` and `sangat mudah` claims remain before the CTA. |
| NX09 AROMAÉ | Not needed; CTA ends cleanly | No | Unsupported freshness/comfort claim plus strong source-composition copying. |

**Recommendation:** publish none of the three candidates. Preserve them only as QA
evidence. Do not spend more provider credit until a future demo uses the explicit
fact classification and an isolated identity reference, and receives a separately
authorized bounded generation test.
