# 01 • PRODUCT BRAIN + SCRIPT BRAIN V5
**Role:** Satu otak produk untuk semua styles; bukan satu skrip sama untuk semua styles. Output per gaya berbeza mengikut style MD.

## 1. Product evidence schema (hantar sebagai structured object)
```json
{
  "product_name": "",
  "spoken_short_name": "",
  "category": "",
  "product_reference_images": [],
  "target_buyer": "",
  "buyer_problem": "",
  "core_function": "",
  "verified_benefits": [],
  "verified_features": [],
  "usage_context": "",
  "allowed_qa_question": "",
  "claims_sources": [],
  "unknowns": [],
  "explicit_cta": "spoken_button",
  "production_profile": "REALISTIC_UGC"
}
```
All fields can be unknown; never auto-fill with false certainty. `spoken_short_name` is a natural spoken alias validated against product identity (e.g. "lampu meja ni"), not another product name.

## 2. Input pipeline like the original Gems
Input: reference image(s) + optional product URL/name/category + one-line user brief + selected style. User should not need to write scripts. Engine should:
1. Detect broad category/likely core function via real configured image understanding or user data; **AI vision must actually run to claim image analysed**.
2. Where permitted, research product-specific facts against official producer/source; store evidence/source snapshots and freshness. If research not available, do not claim it ran.
3. Classify every potential claim: `CONFIRMED_BY_USER`, `OFFICIAL_SOURCE`, `VISUAL_OBSERVATION`, `CATEGORY_FUNCTION`, `UNSUPPORTED`. User statements are user-provided, not independently verified. For risky claims require appropriate validation rather than auto trust.
4. Identify **one central value proposition** for a 10s clip; optional supporting context. Rank: safe buyer problem → grounded key benefit → relevant use case.
5. `CATEGORY_FUNCTION` may state the literal broad purpose obvious from the category (e.g. "powerbank untuk mengecas peranti", "lampu meja untuk menerangi meja", "sambal sebagai pelengkap hidangan", "tudung untuk digayakan"), **NOT** novel performance ("pantas", "tahan 24 jam", "sejuk", "sedap", "berkesan").
6. If even core function is uncertain, request minimal user fact **before charged generation**, or use safe accurate category-level purpose if clear. NEVER replace missing facts with "packaging kemas" filler.
7. Compose a distinct style script and physical action. Run deterministic safety/word validation. Preview **exact final script**. On regenerate, change hook/angle and maintain facts.

## 3. Sales flow (from Gems Real Affiliate Creator)
- **HOOK:** Sebut masalah, situasi, soalan, atau rasa ingin tahu pembeli; satu pendek, tak hiperbola.
- **PRODUCT:** Sebut produk dengan `spoken_short_name` pada saat awal. Pembeli tahu apa yang dibincang.
- **VALUE:** Satu fungsi/benefit sahih yang spesifik; *benefit* ialah 'mengapa berguna', bukannya rupa botol.
- **RELEVANCE:** Kaitkan dengan aktiviti atau siapa yang perlukan, hanya bila berasas.
- **CTA:** Sekali, hujung, lembut `Tekan butang di bawah` jika mode berjualan. `CTA_NONE` untuk awareness. No on-screen button.

## 4. Spoken pacing
- Exact target 10 seconds includes breath and natural articulation. Aim **14–23 Malay words**, shorter when nama produk panjang. Word count is only guard; check real spoken timing. Prefer **1 main value** rather than 3 benefits. CTA at approx 8–10s, script must finish without being cut off.
- If too long: remove intro filler first; use approved short product alias; shorten detail; preserve concrete value. Never speed up voice unnaturally.
- Custom script user approved > supported dynamic generation > fact-safe category fallback. Old `scriptTemplate` must NOT override the actual dynamically selected script.
- `ramai review kata` permitted only if genuine review evidence exists and quote/summary accurately reflects them; do not use by default. No self-use claims.

## 5. Master Script Table by category (no made-up claims)
| Product type | Safe core function (when clearly identified) | Benefit angle requiring evidence | Avoid without proof |
|---|---|---|---|
| Tudung/pakaian | Dipakai/digayakan untuk situasi yang sesuai | Tak panas, mudah bentuk, tidak jarang, tak mudah kedut | "sejuk sepanjang hari", "premium", "semua orang puas" |
| Skincare | Digunakan dalam rutin membersih/melembap mengikut kategori | Melembapkan, bebas alkohol, kulit sensitif | "hilang jerawat", "lulus KKM", "selamat untuk semua" |
| Makanan | Dimakan/dihidang sebagai pelengkap hidangan | Pedas tahap tertentu, ready-to-eat, resepi khusus | "paling sedap", "halal" tanpa bukti, "ramai suka" |
| Gadget | Melaksanakan fungsi teknikal literal yang diketahui | Fast charging, kapasiti, 3 modes, ketahanan | "cas penuh 10 minit", "tahan 5 tahun" |
| Home | Kegunaan rumah kategori tersebut | Jimat masa, kuat, tahan lama jika disokong | "100% bersih", "mesra bayi" |
| Buku | Dibaca untuk isi/topik yang benar wujud pada buku | Isi kandungan, struktur bab, pembaca sasaran | "confirm jadi kaya/pandai" |
| Baja/tanaman | Digunakan untuk penjagaan/pembajaan mengikut produk | Kandungan NPK, hasil, serapan, ROI | "tuai dua kali ganda", "pulih pokok semalaman" |

## 6. Forbidden script patterns
Reject/edit candidate scripts whose selling point is:
- "Korang tengok **packaging** dia kemas..."
- "Botol ni cantik..."
- "Label ni mudah dibaca..."
- "Rekaan bungkusan nampak premium..."
- "Barang ni sesuai untuk kegunaan harian" with no category or use-case.
- "Kualiti memang terjamin" without substantiation.
- "Aku dah cuba, memang menjadi" without authentic, approved customer account.
- "Tekan beg kuning", "keranjang kuning".
These physical words may appear in **visual directions** as object identity anchors but not as the main benefit spoken to buyers.

## 7. Dynamic script planning algorithm
```text
verify input → identify safe category/function → choose one grounded feature/benefit
→ derive buyer's situation → choose STYLE-specific hook and framing
→ draft 1 natural BM sentence + 1 benefit sentence + optional CTA
→ measure spoken budget → validate claim source, word choice & modesty
→ show exact preview → send same text in provider payload
```
Each style file defines its own hook and action; no generic template replacement.

## 8. If there are no defensible benefits
Prefer specific, honest category function with a buyer use-case ("Lampu meja untuk ruang belajar. Model ini mempunyai pilihan cahaya tiga tahap" **only if this fact exists**). If even category is uncertain, stop before charging and ask for **one** missing product function. Never talk about labels to conceal absent knowledge.
