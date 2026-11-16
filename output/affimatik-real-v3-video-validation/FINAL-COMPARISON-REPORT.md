# AffiMatik REAL V3 — controlled REAL V2 comparison

## Execution record

- Approved submissions: **4**
- Actual submissions: **4**
- Automatic retries: **0**
- Provider model: **omni_flash · i2v · 15s · 720p · 9:16**
- Supplier balance: **8.33 → 7.13 credits**
- Actual debit: **1.20 credits**
- Customer wallet debit: **none**
- Production/public demo changes: **none**

All four MP4 files are valid H.264/AAC 720×1280 files with a duration of 15.04 seconds. Transcripts and word timings use a multilingual Whisper Small pass. Phonetic spellings expose unclear provider pronunciation and should not be treated as corrected product names.

## Results

| Style | Task ID | CTA timing | Core REAL V3 finding | REAL V2 comparison | Commercial verdict |
|---|---|---:|---|---|---|
| NX01 | `d90ca7de68428053` | 13.72–14.48s | Stable product and fully modest presenter; speech finishes before cut. Brand/CTA pronunciation remains unclear and dialogue invents a refreshing smell. | Earlier speech ran to 15.02s and was more corrupted. Timing improved; factual integrity did not. | **FAIL** |
| NX09 | `f36b9a12e0af43ab` | 11.64–13.70s | CTA completes once, but the compact bottle is heavily enlarged, source-like warm composition remains, and scent/freshness/comfort claims are unsupported. | Warm-bias proxy improved slightly, but scale and claims remain unsuitable. | **FAIL** |
| NX23 | `85acb8b071cac165` | first CTA 11.90–13.12s; repeated 13.48–14.46s | Full hijab, chest and wrist coverage; clean garment continuity. Uses a prohibited formulaic opening, invents comfort, and repeats the CTA. | Visual presentation is more polished; CTA compliance is worse than the REAL V2 sample. | **FAIL** |
| NX27 | `985afe4a7da45bd5` | 12.46–13.88s | Wok geometry, handles, covered wrist and cooking action remain visually stable. Dialogue invents carbon-steel material, strength, handle comfort and perfect cooking; wording is formal/unnatural. | Practical cooking visuals are materially better than the mostly empty REAL V2 wok scene; speech safety remains poor. | **FAIL** |

## Complete machine-assisted transcripts

### NX01

> Korang tengok ni, minyak herbe as herb. Nampak tak ada herbe kayu kat dalam ni. Botol dia comel sangat 30 ml sesuai untuk minyak urut tradisional senang nak bawa ke mana-mana. Baunya pun mempun memang menyegarkan. Kalau korang nak, tekan bet kuning.

### NX09

> Korang kena tengok aromai homies ni, hiasan botol dia nampak eksklusif sangat. Sekali sembuh je, satu rumah rasa segar. Bau dia memang sangat menenangkan. Kalau nak semak, boleh tekan di bawah.

### NX23

> Assalamualaikum semua, hari ini saya nak kongsikan tentang tudung hijab hitam yang sangat selesa ini. Tengoklah rekaan sulaman di bahagian atasnya. Jatuhan kainya sangat kemas dan terletak. Tengok detail dekat bawah. Detail dekat bawah.

### NX27

> Tengok kuali wajan carbon steel ini, sangat praktikal untuk masakkan harian anda. Rekaan kukuh dengan pemegang kayu selesa, hidangan siap dimasak dengan sempurna. Tekan beg kuning.

## Objective comparison signals

The bright-pixel R−B value below is only a warm-bias proxy, not calibrated white-balance proof.

| Style | REAL V2 warm bias | REAL V3 warm bias | REAL V2 speech end | REAL V3 speech end |
|---|---:|---:|---:|---:|
| NX01 | 43.89 | 33.40 | 15.02s | 14.48s |
| NX09 | 46.40 | 39.10 | 13.30s | 13.70s |
| NX23 | 52.77 | 49.91 | 14.52s | 14.46s |
| NX27 | 12.02 | 19.54 | 13.12s | 13.88s |

## Requirement summary

- Natural Malaysian pronunciation: **0/4 clean passes**. NX23 is broadly intelligible but formulaic and repeats its CTA; the others contain brand, wording or CTA pronunciation defects.
- Human-like rhythm: **mixed**. Speech generally fits within 15 seconds, but NX23 is formulaic and NX27 sounds formal rather than like a Malaysian affiliate.
- Unsupported claims: **4/4 contain at least one unsupported statement**.
- CTA completed before cut: **4/4**.
- CTA accurate and unrepeated: **2/4 clear passes** (NX09, NX27); NX01 pronunciation is unclear and NX23 repeats.
- Neutral colour/true white: **not consistently demonstrated**. NX01/NX09 proxy values improve but remain warm; NX23 remains beige/warm; NX27 is visually usable but its proxy became warmer.
- Product identity: **4/4 recognizable in sampled frames**.
- Realistic scale: **NX09 fails** due to oversized compact bottle; other three are broadly plausible for their categories.
- Physical continuity: **no major geometry break in the seven sampled frames per video**; NX27 is the strongest visual improvement.
- Shariah compliance: **4/4 sampled-frame pass**, including covered hair/chest/wrists where applicable.

## Overall verdict

**REAL V3 is not demonstrated to be consistently better than REAL V2.** The compact architecture substantially reduces prompt size and produces some useful improvements—earlier speech completion for NX01, cleaner CTA completion for NX27, and stronger cooking action—but Nexabot still disregards factual boundaries, exact pronunciation, compact-product scale and CTA non-repetition in material ways.

This experiment supports the compact compiler as a cleaner engineering foundation, but not a production-wide creative-quality claim. More creative autonomy did not reliably improve dialogue accuracy or factual discipline in this four-style sample.

## Recommendation for all 30 styles

1. Keep REAL V3 in staging; do not roll it across all production styles based on this sample.
2. Do not restore an AffiMatik scriptwriter or Product Brain—the experiment does not justify violating the owner’s architecture.
3. Treat native provider dialogue, pronunciation and claim compliance as provider-dependent limitations requiring customer/owner review of completed output.
4. Do not launch another 30-style paid campaign. If further validation is approved, test only specific unresolved provider behaviours with bounded submissions.
5. Do not replace public demos with any of these four files without explicit owner creative acceptance.
