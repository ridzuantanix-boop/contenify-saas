# AFFIMATIK P0 post-CTA loop diagnosis — offline

Source: staging commit `70ad98f8607ef7d0a6fc5d18bc1f2db966c5c4e3`, four original Candidate A MP4s in `../v2-1-real-creative-validation/`. No new Nexabot submission or customer-wallet charge was made for this diagnosis. Candidate C is opt-in code for a future controlled test; the active compiler still defaults to Candidate A.

## Actual media timeline

The timing combines the extracted AAC audio, two independent local Whisper model sizes, 0.25-second WAV RMS measurements, and closer frame sequences. ASR is imperfect around Malay product names and the word “beg”; the timestamped raw outputs remain adjacent to the MP4s. An RMS rise alone does not identify words, but the repeated phrases are independently recognized in the audio and visually corroborated where the mouth is visible.

| Style | First CTA | Unwanted audio after CTA | Type | Visible articulation |
|---|---|---|---|---|
| NX01 | “tekan [bet/back?] kuning” approximately 11.50–13.10s | None detected after 13.10s | Key CTA word unclear in both ASR passes; no loop | Mouth moves through CTA, then settles into a closed-mouth smile by about 13.4s |
| NX07 | “tekan butang di bawah” 8.66–9.58s | 9.82–12.98s | Same CTA repeated 9.82–10.90s; then returns to “ada yang tanya … penjagaan harian anda” | Mouth visibly changes shape during repeated CTA and looping dialogue; 10.15, 10.58, 11.89 and 12.33s frames |
| NX03 | “tengok detail dekat beg kuning” approximately 8.58–9.92s | 10.04–12.42s | Repeats “detail … dekat beg kuning” with garbled middle words | Mouth is covered by intact niqab, so lip movement cannot be determined; eye/hand motion continues |
| NX02 | “tekan beg kuning” 11.02–11.82s | 12.16–13.58s | Incoherent extra words, transcribed approximately “satu tablet ke, tatum batu” | Mouth visibly changes shape at 12.25, 12.84 and 13.13s, then settles |

Relevant evidence: `../v2-1-real-creative-validation/{A,B,C,D}-tail-frames.jpg`, matching `*-tail-rms.json`, `*.wav`, `*.transcript.json` and `*.small-transcript.json`. The provider's original MP4 files remain unchanged. NX07's 9.65–9.90s RMS falls to -33.7 dBFS between phrases, then rises to about -18 dBFS with the repeated CTA. NX02 has a similar pause at 11.8–12.1s followed by stronger audio at 12.3–12.8s. These are separate audible speech segments in the encoded media, not solely transcript hallucinations.

## Exact submitted payload and strongest hypothesis

`../v2-1-real-creative-validation/preflight.json` preserves the four exact provider-facing prompts and sanitized payloads. Each request used one `prompt` field, 15s, `omni_flash`, `i2v`, 720p, ratio 2, and three media entries in the order original product, identical product, avatar. There was no second narration field, speech control, or hidden app script. The exact ending in Candidate A was:

> Final CTA once: "[selected CTA]". End by ~13s; no more words. Presenter settles; smile if visible.

The prompt also says “15s 9:16 UGC” and “Lively BM Malaysia presenter; natural pace.” It does **not** require continuous talking for all 15 seconds. The style-specific lines ask for a buyer question, first-look reaction, or practical review, but do not ask for speech after CTA. Thus there is no direct contradiction commanding a repeated CTA. The weak point is that “End by ~13s” permits the model to put CTA much earlier, while “Presenter settles” describes a pose without an explicit audiovisual state for the remaining seconds. In this four-video sample, the two earliest CTAs end before 10s and both loop; NX02 ends at 11.82s and adds gibberish; NX01 ends at 13.10s and does not loop. **Strongest hypothesis:** Nexabot sometimes fills unscheduled remaining time with more speech despite the “no more words” instruction. This is a provider-following limitation suggested by the outputs, not a proven internal mechanism. The 15-second file boundary did not cut off the bad speech; it stopped before the end in all four clips.

## Isolated Variant C

Only the ending directive changes. The hook, buyer angle, product facts, restrictions, style concept, CTA text, reference files/order, model, duration and resolution remain the same. Candidate A remains byte-for-byte identical to the four submitted prompts. Candidate C is stored in `NX01-C.txt`, `NX07-C.txt`, `NX03-C.txt` and `NX02-C.txt`; `audit.json` includes exact A/C prompt hashes and sanitized provider payloads.

**Removed:** `Final CTA once: "[selected CTA]". End by ~13s; no more words. Presenter settles; smile if visible.`

**Added:** `One complete CTA: "[selected CTA]" ends speech ~13s. Then visual-only to 15s: no voice/lip-sync; room sound. Presenter settles; smile if visible.`

This requests a natural visual continuation with ordinary room sound, not an edited mute or artificial silent ending. Nexabot still writes all product-specific speech. The timing is approximate, not a fixed script or exact timeline.

| Style | Candidate A UTF-8 bytes | Candidate C UTF-8 bytes | C valid? |
|---|---:|---:|---|
| NX01 | 816 | 863 | Yes |
| NX07 | 806 | 853 | Yes |
| NX03 | 891 | 938 | Yes |
| NX02 | 803 | 850 | Yes |

All 30 style configurations were compiled offline with a customer avatar/background and selected CTA. Highest Candidate C prompt length was **989 UTF-8 bytes** (NX25); none exceeded 1,000. This does not claim every possible customer-authored direction will fit; the existing compiler rejects oversize text rather than truncating it.

## Provider controls and fallback

[Nexabot's current developer documentation](https://nexabot.id/developers) documents `prompt`, overall `duration`, `mode`, image `media`, ratio and resolution for video. It does not document a per-job speech duration, final-silent-segment, end-frame, or post-generation audio-replacement parameter for `i2v`. The separately documented voice endpoint generates audio from supplied text; it is not documented as replacing audio in an already generated video and would move scripting responsibility away from Nexabot. Therefore Variant C is a prompt hypothesis, not a guaranteed control. A future post-production repair could isolate only the unwanted post-CTA interval on a copy after exact boundary review; it cannot fix unclear CTA pronunciation or inherently guarantee natural lip sync. No media was automatically trimmed or muted.

## Validation and decision

Offline audit confirmed: Candidate A hashes match the four real submitted prompts; Variant C differs by one ending string; all four image hashes/order and provider parameters match; no new generated product text; all four C prompts and representative 30-style prompts fit the 1,000-character cap. Focused tests passed 18/18; TypeScript passed; ESLint passed with six existing image-element warnings; OpenNext Worker build passed. The full suite passed 347/349. The backup-encryption test timed out during concurrent build load and passed when rerun alone. The remaining sales-page-copy assertion expects text absent from the untouched `src/app/page.tsx` baseline and is unrelated to this patch. This is **static validation only**. Production is **BLOCKED** until a real Candidate C MP4 shows one complete CTA with no further speech and natural closing visuals. A single success would be promising but insufficient to establish reliability.

The first paid diagnostic should use **NX07** with the exact prior image/avatar/CTA/provider settings, Candidate C only, one submission, **0.30 supplier credit** at the last observed price. Compare it against the existing NX07 Candidate A MP4. If promising, seek separate authorization for repeated A/C trials under the same configuration (for example, two more of each, four jobs at approximately 1.20 credits) to check whether the loop rate improves; that small sample would still be exploratory. No paid test is authorized or submitted in this phase.
