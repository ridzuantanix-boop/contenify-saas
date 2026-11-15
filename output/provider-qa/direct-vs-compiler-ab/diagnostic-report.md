# Direct Pawarna Masterprompt vs AffiMatik V10.2 NX09

Date: 15 November 2026 (MYT)

Product: POTONGGO Manual Chopper

Reference SHA-256: `7295d803484efa9c0db182930d555da3557de9b5e815f352d85cfb1d4740ec56`

CTA: `Kalau nak tengok detail, tekan beg kuning sekarang.`

## Experimental controls

Both arms used the same Nexabot account, i2v mode, product file bytes, duplicate-reference count/order, 15-second duration, 720p resolution, 9:16 ratio, product evidence and CTA. The only intended experimental variable was prompt construction.

| Setting | Test A | Test B |
|---|---|---|
| Prompt | Direct owner masterprompt, minimally adapted | Actual AffiMatik V10.2 NX09 compiler output |
| Product references | Same image twice | Same image twice |
| Mode / duration | i2v / 15s | i2v / 15s |
| Resolution / ratio | 720p / portrait 2 | 720p / portrait 2 |
| Provider debit | 0.30 credit | 0.30 credit |
| Customer wallet | Not used | Not used |
| Retry | None | None |

Latest actual pricing evidence before submission was 0.30 credit per completed 15-second job. Opening provider balance was 24.45 credits and closing balance was 23.85 credits. Total debit was exactly 0.60 credits.

## Provider results

| Arm | Task ID | Submitted (UTC) | Completed/downloaded (UTC) | MP4 |
|---|---|---|---|---|
| A | `1e304c34c4804e5e` | 2026-11-15 00:53:12 | 2026-11-15 00:54:43 | `test-a-final.mp4` |
| B | `066f2a642d44f354` | 2026-11-15 00:53:15 | 2026-11-15 00:54:49 | `test-b-final.mp4` |

Both files are 15.04-second, 720×1280 H.264 video with AAC stereo audio.

## Transcripts and audio boundaries

Whisper `small`, Malay language forced, decoded the actual MP4 audio. The English/Malay loanword `beg` was decoded as `back` with low confidence (0.24) in both clips; it is shown as `[beg/back]` rather than silently normalised.

### Test A — direct masterprompt

- 00.50–02.68: “Peningnya nak kena cincang bawang hari-hari.”
- 02.94–05.06: “Korang tengok pencincang manual POTONGGO ni.” (ASR raw: “pengisah manual potonggo”)
- 05.50–07.86: “Tarik-tarik je terus siap, senang sangat nak guna.”
- 08.18–09.90: “Yang ni memang ramai sangat cari.”
- 10.28–12.64: “Kalau nak tengok detail, tekan [beg/back] kuning sekarang.”
- 13.68–15.02: “Selain [beg/back] kuning semangka baru...” (corrupted/unintelligible post-CTA speech)

CTA boundary: approximately 10.28–12.64s. New speech restarts at 13.68s and continues to 15.02s, effectively reaching the clip boundary. This violates the final-utterance rule and creates an abrupt/broken ending.

Factual issues: “terus siap” asserts unverified chopping performance and “ramai sangat cari” invents popularity. These are critical factual-safety failures.

### Test B — AffiMatik V10.2 NX09

- 00.00–01.78: “Nak senang potong bahan dapur?”
- 02.28–04.62: “Gunanya POTONGGO manual chopper ni.” (ASR raw: “Gunanya potong go manual chopper ni.”)
- 05.44–07.10: “Tak payah guna elektrik pun.”
- 08.06–10.84: “Kalau nak tengok detail, tekan [beg/back] kuning sekarang.”

CTA boundary: approximately 08.06–10.84s. No further speech was detected during the remaining 4.20 seconds. The clip retains non-verbal room/action audio and ends without a spoken cutoff.

Factual note: “tak payah guna elektrik” is a direct ordinary consequence of the customer-confirmed manually operated pull-handle mechanism. It does not claim speed, capacity or efficacy. It is therefore grounded for this test, although future product records should state this explicitly when the owner wants zero inferential distance.

## Visual findings

### Test A

- POTONGGO wordmark, turquoise lid/base, white pull handle, transparent container and visible blades remain recognizable.
- Scale is plausible against the adult hand and consistent throughout.
- One hand with a black sleeve visibly covering the wrist; grip and hold are credible.
- Opening is a new live-action frame and does not reproduce the source photo exactly.
- Scene is a fixed pale tabletop/curtain environment with floral decor, closely following the original direct masterprompt.
- No marketplace UI or floating product was observed.

### Test B

- Product identity, label, colour, handle, transparent container and blade arrangement are strongly preserved.
- Pull-handle interaction is physically understandable and scale remains plausible.
- The scene closely reconstructs the source image: pale tiled kitchen wall, plant and cutting board. This violates the compiler's explicit source-composition exclusion and demonstrates a provider-side reference-conditioning limitation.
- The hand is plausible, but the crop does not show a sleeve-covered wrist; strict wrist-cover compliance is not evidenced.
- No marketplace UI or floating product was observed.

## Consistent rubric

Score: 1 = unusable/unsafe, 2 = major defect, 3 = mixed, 4 = good with minor limitation, 5 = strong pass. A critical failure overrides the average.

| Dimension | A | B | Evidence |
|---|---:|---:|---|
| Product understanding | 3 | 4 | Both identify a manual chopper; A adds performance language, B stays with manual/electricity distinction. |
| Hook quality | 4 | 4 | Both open on a relevant kitchen-prep problem. |
| Script relevance | 3 | 4 | A is relevant but padded with popularity; B is compact and product-specific. |
| Malaysian voice naturalness | 2 | 4 | A ends in corrupted speech; B is concise and coherent. |
| Product identity | 4 | 5 | Both preserve POTONGGO; B is especially stable. |
| Product physical scale | 4 | 4 | Both remain plausible and consistent. |
| Scene composition | 4 | 2 | A creates the directed fixed scene; B closely copies the input photo's kitchen composition. |
| Hand realism | 4 | 3 | A has a covered wrist and natural hold; B has credible interaction but no visible covered wrist. |
| CTA accuracy | 2 | 5 | A speaks CTA then restarts; B speaks it once as the last utterance. |
| Audio ending | 1 | 5 | A speech reaches 15.02s; B has 4.20s of speech-free ending. |
| Factual safety | 1 | 4 | A invents performance and popularity; B stays within the confirmed manual mechanism. |
| Commercial usefulness | 2 | 4 | A is unsafe/broken; B is usable except for source-scene copying and strict modesty evidence. |
| **Critical failure** | **YES** | **NO factual/audio critical failure; visual contract FAIL** | A: unsupported claims + post-CTA corruption. B: source composition copied and wrist-cover not evidenced. |

Average (diagnostic only): A 2.83/5; B 4.00/5. The averages do not override A's critical failures or B's visual-contract defects.

## Prompt differences that explain the result

1. The original direct prompt still contains a mandatory FOMO stage. The appended test facts explicitly said no popularity/scarcity evidence existed, but the provider followed the earlier FOMO pressure and invented “ramai sangat cari”. This is an internal priority conflict in the direct prompt, not a shared-input problem.
2. The direct prompt repeats the CTA target several times and retains a 32–38-word target plus a long multi-stage speech flow. The provider produced 42+ words and restarted after a completed CTA, indicating duration/content pressure despite the appended final-utterance instruction.
3. V10.2 places the short speech contract at Priority 0, asks for only two or three clauses, finishes words by 11.5 seconds and prohibits popularity explicitly. Those controls materially improved factual safety and audio termination in this pair.
4. V10.2's source-composition prohibition did not overcome the strong visual conditioning of the supplied image. The close kitchen reconstruction is a provider/reference limitation under this duplicated i2v input, not evidence that the directive was missing.
5. The original fixed tabletop scene produced a more independent background and visibly covered wrist. V10.2 was better in dialogue, while the direct prompt was better on these two visual aspects.

## Conclusion

For this single controlled pair, the original direct masterprompt did **not** produce the better affiliate video. AffiMatik V10.2 NX09 was materially stronger in factual safety, concise product-specific dialogue, CTA finality and audio ending. Test A is not publishable. Test B is also not a full creative PASS because it copied the source-photo composition and did not visibly prove the covered-wrist requirement.

The evidence does **not** justify rewriting all 20 styles. The highest-value correction is narrower: strengthen deterministic product isolation or use a more composition-neutral reference for i2v, and ensure hand-only shots visibly include the sleeve-covered wrist. The V10.2 short speech/factual contract should be retained.

No production code, customer wallet, sales-page media or deployment was changed.
