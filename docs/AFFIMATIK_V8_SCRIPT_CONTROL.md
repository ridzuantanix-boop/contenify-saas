# AffiMatik V8 Script Control

V8 preserves the 20 Creative V6 style identities and changes only dialogue control, speech timing and human-behaviour prompting.

## Runtime flow

`Factory → validated V8 settings → deterministic script control → Human Realism compiler → Nexabot adapter → video job`

- **Smart Script** uses the style-specific curated pattern in `src/lib/engine/script-control.ts`. It may interpolate only the product name and the single fact explicitly confirmed by the customer. With no confirmed fact, it uses that style's neutral wording.
- **Custom Script** sends the customer's words plus the selected approved CTA. The UI states that provider speech and lip-sync can deviate and must be judged from the generated MP4.
- **Provider Auto** preserves provider-created dialogue as an optional legacy mode.
- No Gemini Vision call, model-based research or internal AI scriptwriter is used.

## Approved CTA phrases

| Choice | Spoken phrase |
| --- | --- |
| TikTok Shop — Beg Kuning | `Kalau sesuai, tekan Beg Kuning.` |
| Klik Butang Di Bawah | `Klik butang di bawah untuk maklumat lanjut.` |
| Tekan Butang Di Bawah | `Tekan butang di bawah untuk maklumat lanjut.` |
| Semak Bio | `Boleh semak pautan di bio.` |
| DM Untuk Info | `DM untuk info lanjut.` |
| Tanpa CTA | No spoken CTA |
| Custom CTA | Customer text, maximum 80 characters, after safety validation |

CTA settings, script mode, customer-confirmed fact and bounded custom text persist in creator presets and the immutable video-job `input_options` snapshot.

## Safety and timing

- The script validator allows a naturally short script and caps it at 48 words / 600 characters.
- Customer facts are capped at 180 characters; unsupported medical or guaranteed-performance claims are rejected.
- Speech is paced for roughly 12.5–14 seconds only when the script naturally supports it. A short script ends naturally and is followed by meaningful product interaction.
- The compiler forbids semantic repetition, invented claims, fake shopping UI and forced speech on the final frame.
- Product Identity MAX, Zero UI, Shariah, avatar identity and reference-order locks remain active.

## Verification boundary

Automated tests prove payload construction, validation, persistence and prompt constraints. They do not prove that Nexabot followed every word, produced natural acting or preserved every identity. Those qualities require inspection of the actual audio and MP4 output for the four-category V8 staging comparison.
