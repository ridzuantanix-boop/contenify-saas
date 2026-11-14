# Final Sales Demo Generation — Real Nexabot QA

Date: 15 November 2026 (MYT)  
Branch: `codex/masterprompt-quality-correction`  
Paid submissions: exactly three; no retries

## Provider receipt

| Style | Task ID | Debit | Technical output | Creative result |
|---|---|---:|---|---|
| NX01 | `b9e8c955bdb15c72` | 0.30 credit | H.264/AAC, 720×1280, 15.04s | FAIL |
| NX17 | `aef6c38693d30c7d` | 0.30 credit | H.264/AAC, 720×1280, 15.04s | FAIL |
| NX09 | `c649795ed1cf21d9` | 0.30 credit | H.264/AAC, 720×1280, 15.04s | FAIL |

Opening provider balance: 26.25. Closing balance: 25.35. Total debit: 0.90 Nexabot credit.

## NX01 — SERIYA Radiance Serum — FAIL

Transcript confirmed using two Malay Whisper passes:

> “Korang yang tengah cari serum baru, boleh tengok yang ni. SERIYA Radiance Serum ni memang sesuai untuk kulit. Kalau nak tengok detail, tekan beg kuning sekarang. [speech-like gibberish: ‘Sasebria sesiram detail.’]”

- CTA completes once at approximately 7.88s.
- Additional voiced/gibberish speech occurs at approximately 8.42–9.62s.
- “Memang sesuai untuk kulit” is an unsupported skincare suitability claim.
- SERIYA bottle and box remain recognizable; small-bottle scale is plausible against hands, face and torso.
- Presenter movement is generally natural and the room is independent from the source composition.
- Fine label text is not perfectly reliable at every frame.

## NX17 — POTONGGO Manual Chopper — FAIL

Transcript confirmed using two Malay Whisper passes:

> “Kalau nak jimat masa memasak, boleh cuba POTONGGO Manual Chopper ini. Sangat mudah nak cincang bahan dapur. Tekan butang di bawah. [speech-like gibberish]”

- CTA completes once at approximately 9.23s.
- Additional voiced/gibberish speech occurs at approximately 9.71–11.59s.
- “Jimat masa” and “sangat mudah” are unsupported performance/ease claims.
- POTONGGO identity, transparent container, turquoise lid and white pull handle remain recognizable.
- Product scale is plausible against both hands, torso, bowl and kitchen counter.
- Pull-handle interaction and presenter movement are physically believable.
- Kitchen scene is independent from the isolated source composition.

## NX09 — AROMAÉ Home Mist — FAIL

Transcript confirmed using two Malay Whisper passes:

> “Nak rumah sentiasa segar dan selesa? Boleh cuba AROMAÉ Home Mist ni. Tengok detail dekat beg kuning.”

- CTA completes once at approximately 10.24s.
- No additional speech is detected after the CTA.
- “Sentiasa segar dan selesa” is an unsupported scent/freshness/comfort outcome.
- AROMAÉ bottle and box remain recognizable and product-to-hand scale is plausible.
- Hand movement is restrained and physically plausible.
- Critical scene failure: the video reconstructs the source composition—beige counter, bottle/box arrangement, floral decoration and the same window-light pattern—despite the independent-scene instruction.

## Release decision

All three candidates failed mandatory creative gates. None was copied into public assets, none replaced a Sales Page V2 proof card, and no production Worker was deployed. The historical videos retain their existing attribution; no failed candidate is presented as V10.2 proof.

## Evidence

- Campaign receipt: `output/provider-qa/sales-demo-final-v10-2/receipt.json`
- NX01 MP4: `output/provider-qa/sales-demo-final-v10-2/NX01-candidate.mp4`
- NX17 MP4: `output/provider-qa/sales-demo-final-v10-2/NX17-candidate.mp4`
- NX09 MP4: `output/provider-qa/sales-demo-final-v10-2/NX09-candidate.mp4`
- Primary transcript: `output/provider-qa/sales-demo-final-v10-2/transcripts-small.json`
- Independent transcript: `output/provider-qa/sales-demo-final-v10-2/transcripts-base.json`
- Visual contact sheets: `output/provider-qa/sales-demo-final-v10-2/NX01-contact.jpg`, `NX17-contact.jpg`, `NX09-contact.jpg`
