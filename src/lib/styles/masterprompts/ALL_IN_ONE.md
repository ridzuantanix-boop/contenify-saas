# AFFIMATIK • ALL-IN-ONE MASTERPROMPTS V5

# AFFIMATIK • GEMS-GRADE MASTERPROMPT PACK V5.0
**Status:** Creative source of truth, hand-authored; NOT an automatic code patch.  
**Scope:** 13 published styles: NX01, NX02, NX03, NX05, NX07, NX09, NX10; RH01, RH02, RH03, RH04, RH17, RH19.  
**Engines (internal):** NX = 10s with spoken natural Malaysian Malay; RH = 15s visual-only, optional authentic ambient/ASMR if supported. **Customer UI:** AffiMatik Voice / AffiMatik Motion.

## Matlamat produk
**Gambar Produk Masuk. Video Affiliate Keluar.** Sama macam Gems AI Factory: user pilih gaya, upload gambar, arahan ringkas jika mahu; **sistem sendiri** buat product analysis, positioning, skrip, aksi dan prompt. User bukan penulis prompt. Antigravity/Codex hanyalah *implementer*; **jangan cipta atau tulis semula masterprompt ini** tanpa kelulusan pemilik.

## Masalah semasa yang hendak dimatikan
- Skrip menerangkan botol, kotak, packaging, jahitan logo atau tulisan label **sebagai idea jualan utama**.
- Semua gaya keluarkan ayat/hook yang sama.
- Manfaat produk direka sendiri tanpa bukti.
- Produk hanya digoyang tanpa sebab / framing mengganggu.
- Klip ada logo aplikasi, bingkai telefon, tangkapan skrin, teks palsu, manusia nampak AI, atau aurat terdedah.

## Baca ikut urutan (sumber autoritatif)
1. `00_GLOBAL_LOCKS.md` — pengunci wajib semua gaya.
2. `01_PRODUCT_AND_SCRIPT_BRAIN.md` — ilmu produk, fakta, USP, manfaat, skrip dan kategori.
3. `02_SCRIPT_FIXTURES.md` — contoh beza gaya, bukan skrip universal untuk semua produk.
4. `styles/<STYLE_ID>_*.md` — **satu masterprompt lengkap bagi setiap gaya**; action tidak boleh diganti.
5. `90_INTEGRATION_CONTRACT.md` — cara implement tanpa mengubah semantik.
6. `91_QA_ACCEPTANCE.md` — ujian penerimaan dan penggunaan sebenar.

## Peraturan utama
- **Voice 10s**: hook ringkas → fungsi / manfaat yang berasas → relevansi kepada pembeli → CTA pilihan, dengan gaya bercakap berbeza bagi setiap NX.
- **Motion 15s**: *tidak ada dialog*. Video mesti **menunjukkan konteks penggunaan / kegunaan produk secara visual** mengikut aksi gaya; jangan tambah VO atau overlay manfaat palsu. Jika mahu semua klip bersuara, itu perubahan capability produk, bukan ubah masterprompt RH diam-diam.
- 13 gaya = 13 konsep produksi yang berbeza. Bukan 13 salinan prompt sama dengan nama lain.
- Produk **bukan** topik tentang rupa packaging; packaging cuma *identity reference*, tidak menjadi jualan kecuali fakta pembelian itu sendiri relevan dan disahkan.
- Manuskrip ini tidak mengesahkan keadaan provider, kualiti MP4 lama, atau fungsi API; semuanya memerlukan ujian sebenar.

## Status pelaksanaan
Fail-fail ini belum dipasang ke repo / production secara automatik. Menggantikan string dalam registry sahaja **tidak memadai**; compiler dan script brain perlu menggunakan struktur ini ketika membina payload provider dan mengekalkan version pin pada job.


---

# 00 • UNIVERSAL MASTER LOCKS V5
Baca dan gabungkan bersama masterprompt STYLE yang dipilih, tanpa mengubah aksi gaya. Jika arahan global bercanggah dengan gaya, **keselamatan, hak pengguna dan bukti produk** mengatasi pilihan estetik; jangan menukar style kepada gaya lain.

## A. Output & identity
- Orientasi 9:16, footage penuh tanpa bingkai. NX **10.0s** / RH **15.0s** seperti capability yang dikonfigurasikan; jangan reka durasi jika provider tidak menyokong.
- Gambar upload ialah **rujukan identiti produk**, BUKAN screenshot pertama atau wajib frame pertama. Jika mode API sebenarnya mengenakan first-frame, jelaskan batasan dan gunakan mode yang disokong; jangan palsukan kemampuan.
- **PRESERVE EXACT PRODUCT**: shape, scale, cap, material, logo, brand, label, typographic marks, proportions, colour, count, visible printed text. Jangan hallucinate tulisan yang tidak dapat dibaca; jangan tulis semula label.
- Benda dipegang dengan graviti nyata; tiada morph, teleport, duplikasi, float, label beralih atau saiz tiba-tiba berubah. Produk secara umum sekitar **20–30% bingkai** untuk demonstrasi kecil, dengan pengecualian yang masuk akal seperti tudung / pakaian / produk bersaiz besar.

## B. Zero UI / Zero watermark
**Full-frame real-world footage only.** Tiada logo TikTok, Shopee, Instagram, nama akaun, like/comment/share, beg kuning, ikon aplikasi, video-player frame, timeline/progress, UI tangkapan skrin, fake subtitles, watermark, media overlay, picture-in-picture, frame telefon, browser chrome, border tebal. Telefon sebagai alat rakaman **tidak muncul dalam rakaman** kecuali benar-benar produk fizikal yang ingin dijual.
- Jangan tulis positive prompt "a TikTok video inside a phone" atau "social media interface".
- Watermark/element pengguna yang memang pada imej rujukan: jangan memalsukan seolah-olah milik produk; edit imej rujukan hanya jika dibenarkan dan jangan melanggar hak pemilik.

## C. Realistic UGC profile (default untuk semua 13 style semasa)
- Visual seperti video pengguna Malaysia yang dirakam menggunakan kamera telefon biasa, **1x**, 9:16, handheld micro-shake, satu rakaman berterusan, terang neutral daylight 5000–5600K, latar rumah/ruang sebenar yang sesuai kategori.
- Natural skin, fingers, fingernails (tanpa polish bagi hand-only), eye gaze, gravity, shadows, object contact, motion blur ringan. Bukan muka plastik, badan robotik atau generated CGI.
- **NO zoom, push-in, orbit, spin, cut, crash pan, first-frame flash, colour filter kuning/suram/sepia/teal-orange, bokeh sinematik berlebihan, ringlight reflection**. Jangan gunakan kata "cinematic" dalam gaya UGC.
- Kamera tidak berputar, produk tidak berputar 360°, badan tidak berjalan jika gaya tidak minta. Satu fokus aksi sahaja setiap klip.
- Studio/commercial hanya jika satu style tersendiri nanti mengisytiharkan `productionProfile=STUDIO_COMMERCIAL`; **jangan paksa 13 style sedia ada menjadi commercial**.

## D. SHARIAH LOCK™ — mandatory, end-to-end
- Wanita Muslim dewasa: **hijab labuh tutup rambut, leher dan dada sepenuhnya**, baju longgar, lengan tutup hingga pergelangan, tiada barang kemas, tidak ketat/jarang, tiada terbuka ketika bergerak. Niqab kalau dipilih **hidung dan mulut tak kelihatan**, guna VO off-camera apabila lip-sync bertembung.
- Hand-only: **tepat satu tangan dewasa**, lengan/wrist bertutup, tanpa cincin, gelang, pengilat kuku/kuku palsu. Jari dan cengkaman fizikal normal. Tiada tangan lelaki jika pengguna minta tangan wanita.
- Lelaki: pakaian sopan, tidak dedah aurat. Jangan wujudkan model kalau hand-only atau produk-only.
- Arahan ini untuk prompt **dan** QA setiap bingkai; pandangan awal yang patuh tidak bermaksud keseluruhan klip patuh.

## E. Audio & bahasa
- **NX** = audio BM Malaysia, intonasi santai/bersahaja; skrip exact diluluskan; satu suara sahaja. Bukan loghat Indonesia, bukan bahasa Inggeris penuh, bukan robotic, bukan sebut "beg kuning" atau "keranjang kuning". CTA dibenarkan: `tekan butang di bawah` **secara suara sahaja**, jangan cipta butang dalam visual. Jika `CTA_NONE`, tiada CTA. Jangan berpura-pura user/presenter pernah guna produk sendiri.
- **RH** = tiada dialog dan tiada lip-sync. Bunyi sentuhan/ambience/ASMR atau muzik berlesen hanya jika dibekalkan provider / sumber audio sah. Jangan cipta perkataan bercakap dalam prompt RH.
- Video sudah mempunyai audio? Preview default muted, user boleh unmute; audio tiada? Jangan papar ikon speaker seolah-olah ada lagu.

## F. Business truthfulness
- Script mesti tentang **fungsi, manfaat, kegunaan, pembeli yang sesuai atau penyelesaian masalah**, bukan packaging/label/botol sebagai isi.
- Hanya pakai fakta tersokong dari input pelanggan, spesifikasi rasmi yang dapat disahkan, atau fungsi umum kategori yang benar-benar jelas. "Mudah", "selesa", "tahan", "cepat", "selamat", "terbukti", "ramai review" ialah **claim** dan perlu asas tersendiri; jangan mengada.
- Produk pemakanan, penjagaan kulit, baja, kesihatan: elakkan sembuh/kurus/putih/hasil dramatik. Boleh nyatakan "digunakan untuk" atau fungsi umum yang berasas. Label mendakwa sesuatu ≠ bukti kajian bebas.
- Elakkan misleading claims, fake scarcity, fake testimonials, fake discounts. Produk bukan milik creator tidak boleh diklaim sebagai sudah digunakan sendiri.

## G. Working English prompt fragment
Use this AFTER structured product context and exact style action, not in place of it:

```text
AUTHENTIC FULL-FRAME FOOTAGE. Use the uploaded image as product identity reference only, not a mandatory video frame or a screen to be depicted. Preserve exact product geometry, color, logo, cap, material and visible label with stable consistency. One continuous 9:16 real-world video; natural 1x smartphone camera, authentic Malaysian daylight (neutral white balance), realistic human skin, covered modest clothing and wrist, physically plausible small movements. No social app UI/logo, no watermarks, no subtitles, no artificial buttons, no browser/video-player/phone frame. No jump cuts, no zoom, no spinning, no morphing, no CGI. Follow the STYLE ACTION and AUDIO SCRIPT exactly. The actual product usefulness, not its packaging, is the creative point.
```

Negative wording cannot guarantee clean videos; actual render must be inspected and rejected when wrong.


---

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


---

# 02 • SCRIPT FIXTURES / GEMS-STYLE QUALITY EXAMPLES
**Fixtures sahaja, bukan product claims dari real customer.** Product fictitious: `Lampu Meja LED 3 Mod`; available, USER-CONFIRMED facts for these examples: *lampu meja*, *mempunyai tiga tahap kecerahan*, *digunakan di meja belajar*. Assume nothing about rechargeable battery, colour temperature, energy saving, certification or actual ownership.

## 7 gaya Voice: SATU produk → 7 skrip berbeza
**NX01 Sembang Kawan**  
"Kalau korang selalu belajar waktu malam, lampu meja ni ada tiga tahap kecerahan. Boleh pilih ikut keadaan. Tekan butang di bawah."

**NX02 Review Sambil Pegang**  
"Lampu meja ni ada tiga tahap kecerahan. Korang boleh pilih ikut aktiviti dekat meja belajar. Nak tengok lebih lanjut? Tekan butang di bawah."

**NX03 First Impression**  
"Eh, lampu meja ni rupanya ada tiga tahap kecerahan. Boleh pilih cahaya ikut aktiviti belajar. Nak tengok? Tekan butang di bawah."

**NX05 Masalah Seharian**  
"Meja belajar perlukan cahaya yang sesuai? Lampu ni ada tiga tahap kecerahan untuk dipilih ikut keadaan. Tekan butang di bawah."

**NX07 Soalan & Jawapan**  
"Lampu ni boleh ubah tahap cahaya ke? Ya, model ni ada tiga tahap kecerahan. Kalau nak tengok detail, tekan butang di bawah."

**NX09 Goyang Produk + VO**  
"Untuk ruang belajar, lampu meja ni ada tiga tahap kecerahan. Korang boleh pilih ikut keadaan. Kalau berminat, tekan butang di bawah."

**NX10 Label Talk → Fakta & Fungsi Produk**  
"Yang penting tentang lampu meja ni, ada tiga tahap kecerahan. Jadi korang boleh pilih ikut keperluan belajar. Tekan butang di bawah."

> Wording needs exact real duration and pronunciation check before paid API generation. The fixtures demonstrate **different hook style + benefit logic**, not seven audio clones. Every future product takes its own supported facts.

## Variation matrix, jangan copy/paste skrip contoh
| Style | Hook strategy | Main benefit perspective | Presenter |
|---|---|---|---|
| NX01 | Casual "korang..." | Why useful for a familiar situation | On-camera friend |
| NX02 | Direct product statement | Feature → practical meaning | On-camera reviewer |
| NX03 | Curious first glance | A noteworthy confirmed function, no self-use claim | Curious on-camera |
| NX05 | Pain point/question | Problem → product helps in specified way | Empathetic on-camera |
| NX07 | One common question | Answer with one substantiated fact | Q&A on-camera |
| NX09 | Usage scenario | Benefit-focused off-camera narration | Exactly one hand |
| NX10 | "Yang penting..." | One factual feature → real utility | Exactly one hand, show evidence |

## RH visual fixture: same product, no dialogue
Do not put words/CTA in RH clips. Place lamp on study desk. Show lamp naturally as a study accessory **without inventing illumination modes by changing light unless physically controlled and visible in the actual reference/product**. Each RH has a separate action from its style file. A Motion style cannot magically become a spoken sales review without updating product capability and job pricing.


---

# NX01 • SEMBANG KAWAN — MASTERPROMPT V5.0
**Engine:** AffiMatik Voice 10s (`nexabot` internal)  
**Category:** Creator review / hand demo as applicable  
**Audio:** One natural BM Malaysia dialogue / VO  
**Production:** Realistic UGC; full-frame phone camera 1x; 9:16; one take.

## 1. Core creative DNA
Kawan kongsi satu benda berguna; spontan tetapi bukan cerita pengalaman yang direka.

## 2. Hook engine
Situation-based familiar opening: “Kalau korang [SITUASI]...” or “Yang tengah [AKTIVITI]...”

## 3. Voice DNA
Friendly natural Malaysian female adult voice, warm and casual, not announcer. Speak directly to viewer. Use short spontaneous rhythm.

## 4. Product-benefit sales script architecture
User situation → introduce product early → one supported benefit → why this solves/helps situation → light CTA. No broad unsupported performance adjectives.

**Script planner:** Name product naturally early, deliver only one evidence-backed function/benefit and meaningful situation. Use 14–23 words as a useful target, never cut off speech. If selling, end with ONE verbal "tekan butang di bawah". No CTA for awareness. Script must NOT focus on packaging, botol, label, logo, box, or generic look/size.

## 5. Exact 10-second one-take choreography
| Time | Action + meaning |
|---|---|
| 0.0–1.5 | Perempuan Muslimah dewasa dalam medium shot; terus pegang produk di paras dada; pandang kamera seperti bercakap dengan kawan. Hook situasi, bukan "weh" overacting. |
| 1.5–4.0 | Bersembang natural dan namakan produk. Produk kekal sekitar 20–30% frame; tangan lain hanya gestur kecil. |
| 4.0–7.8 | Terangkan satu manfaat betul dengan contoh situasi pembeli. Jangan beralih kepada cerita botol/label. |
| 7.8–10.0 | Ucap CTA lembut jika selling; produk kekal jelas dan steady; tiada tunjuk butang palsu. |

## 6. Provider visual direction — authoritative English masterprompt
```text
A single adult modest Malaysian Muslimah creator, full hijab covering hair neck and chest, loose long-sleeved clothing. Natural smartphone 1x eye-level medium shot in a bright lived-in Malaysian home. She casually chats as if recommending a relevant product to a friend, gently holding the EXACT reference product at chest height without bringing it into macro-close-up. Natural hand gesture, soft sincere expression and believable lip-sync. First mention the buyer situation, then the actual supported function/benefit of [PRODUCT], how it relates to [BUYER_USE_CASE], finish with the exact approved [SPOKEN_SCRIPT]. One continuous handheld take, no cut.

Append the compact global realism, exact product-identity, SHARIAH LOCK and ZERO-UI constraints from 00_GLOBAL_LOCKS. Keep the user-approved spoken words exactly; do not ask the provider to improvise alternative dialogue.
```

## 7. Specific prohibitions
No first-person “saya dah guna”; no hyperactive presenter, no product zoom, no packaging review, no voiceover double track.

## 8. Acceptance criteria
- Product use/benefit mentioned naturally; **no packaging-as-benefit**.
- Exact approved spoken BM Malaysia script, finished within 10s.
- Action matches NX01's creative concept and stays physically natural.
- Product stable, no UI/watermark/frame, modesty compliant throughout.
- Correct original style identity even if pre-existing preview video illustrates something else.

## Required shot and dialogue alignment
Use the timeline above as **creative beats**, not a request for jump-cuts. Dialog happens while movement is plausible and slow. No montage. If the shot starts without product, it enters naturally by the documented beat; never materialises from thin air.

## Product truth gate
Every spoken `{BENEFIT}` and `{FEATURE}` must be grounded in Product Brain evidence. If unknown: choose honest category function + use case. If still unknown, request ONE product fact before sending a paid generation. Never fill with packaging commentary.

## Output composition
Compile: `00_GLOBAL_LOCKS` + `01_PRODUCT_AND_SCRIPT_BRAIN` + this STYLE's action/voice/timeline + structured product facts + exact final user-approved script. Do not include docs as a dump in user-visible captions; construct a coherent provider prompt. Preserve selected style ID and prompt version in job metadata.


---

# NX02 • REVIEW SAMBIL PEGANG — MASTERPROMPT V5.0
**Engine:** AffiMatik Voice 10s (`nexabot` internal)  
**Category:** Creator review / hand demo as applicable  
**Audio:** One natural BM Malaysia dialogue / VO  
**Production:** Realistic UGC; full-frame phone camera 1x; 9:16; one take.

## 1. Core creative DNA
Straightforward product explainer; spesifik, tenang, meyakinkan, tanpa pseudo-testimonial.

## 2. Hook engine
Start with explicit product + user function within first 1.5s: “[PRODUK] ni untuk [TUJUAN]...”

## 3. Voice DNA
Direct, grounded Malaysian Malay, concise and useful; not a paid-ad announcer.

## 4. Product-benefit sales script architecture
What product does → one verified spec/benefit → practical translation (“jadi korang boleh...”) → soft CTA.

**Script planner:** Name product naturally early, deliver only one evidence-backed function/benefit and meaningful situation. Use 14–23 words as a useful target, never cut off speech. If selling, end with ONE verbal "tekan butang di bawah". No CTA for awareness. Script must NOT focus on packaging, botol, label, logo, box, or generic look/size.

## 5. Exact 10-second one-take choreography
| Time | Action + meaning |
|---|---|
| 0.0–1.8 | On-camera Muslimah holds physical product upright naturally. Start with product name and what it is for. No prolonged reveal. |
| 1.8–4.5 | A gentle 5–10-degree hand adjustment keeps original product visible, not a 360 spin. |
| 4.5–7.8 | State exactly one real feature and what it means to the buyer; maintain eye contact and natural speaking pace. |
| 7.8–10.0 | Finish one CTA or final relevance point if non-selling. Hold product steady, stop dialogue cleanly. |

## 6. Provider visual direction — authoritative English masterprompt
```text
Adult modest Malaysian Muslimah reviewer in a bright ordinary room, direct eye-level smartphone 1x handheld shot. The EXACT reference product is in one hand at comfortable chest height. She gives a concise, honest explanation of what [PRODUCT] is for and the single grounded [FEATURE_OR_BENEFIT], translating it into a practical user situation [USE_CASE]. Very small natural object adjustment only, no label examination monologue, no close-up. Deliver exactly [SPOKEN_SCRIPT] in natural Malaysian Malay with accurate lip-sync.

Append the compact global realism, exact product-identity, SHARIAH LOCK and ZERO-UI constraints from 00_GLOBAL_LOCKS. Keep the user-approved spoken words exactly; do not ask the provider to improvise alternative dialogue.
```

## 7. Specific prohibitions
Do not pretend to have personally tested it. Do not say “kemasan packaging nampak kemas” as review substance.

## 8. Acceptance criteria
- Product use/benefit mentioned naturally; **no packaging-as-benefit**.
- Exact approved spoken BM Malaysia script, finished within 10s.
- Action matches NX02's creative concept and stays physically natural.
- Product stable, no UI/watermark/frame, modesty compliant throughout.
- Correct original style identity even if pre-existing preview video illustrates something else.

## Required shot and dialogue alignment
Use the timeline above as **creative beats**, not a request for jump-cuts. Dialog happens while movement is plausible and slow. No montage. If the shot starts without product, it enters naturally by the documented beat; never materialises from thin air.

## Product truth gate
Every spoken `{BENEFIT}` and `{FEATURE}` must be grounded in Product Brain evidence. If unknown: choose honest category function + use case. If still unknown, request ONE product fact before sending a paid generation. Never fill with packaging commentary.

## Output composition
Compile: `00_GLOBAL_LOCKS` + `01_PRODUCT_AND_SCRIPT_BRAIN` + this STYLE's action/voice/timeline + structured product facts + exact final user-approved script. Do not include docs as a dump in user-visible captions; construct a coherent provider prompt. Preserve selected style ID and prompt version in job metadata.


---

# NX03 • FIRST IMPRESSION — MASTERPROMPT V5.0
**Engine:** AffiMatik Voice 10s (`nexabot` internal)  
**Category:** Creator review / hand demo as applicable  
**Audio:** One natural BM Malaysia dialogue / VO  
**Production:** Realistic UGC; full-frame phone camera 1x; 9:16; one take.

## 1. Core creative DNA
Reaksi pertama yang jujur pada FUNGSI diketahui, bukan testimonial penggunaan.

## 2. Hook engine
“Eh, [PRODUK] ni [FAKTA]...” / “Oh, yang ni rupanya [FAKTA]...” — sound interested, not astonished or miraculous.

## 3. Voice DNA
Spontaneous short reaction, thoughtful and clear. No proven-sounding satisfaction.

## 4. Product-benefit sales script architecture
Curiosity → product identification → verified noteworthy fact → why buyer might care → CTA. Avoid “wow botol lawa” as core.

**Script planner:** Name product naturally early, deliver only one evidence-backed function/benefit and meaningful situation. Use 14–23 words as a useful target, never cut off speech. If selling, end with ONE verbal "tekan butang di bawah". No CTA for awareness. Script must NOT focus on packaging, botol, label, logo, box, or generic look/size.

## 5. Exact 10-second one-take choreography
| Time | Action + meaning |
|---|---|
| 0.0–2.0 | Muslimah holds product already in frame; looks briefly at it, then the camera. One small genuine curious expression. |
| 2.0–4.5 | She says product name and newly noticed FACT (clearly based on available product facts). No on-camera use/test claim. |
| 4.5–7.8 | One concise explanation of who benefits/how it may fit buyer need. Only one subtle head nod. |
| 7.8–10.0 | Light CTA; no exaggerated surprise or fake “first ever” claims. |

## 6. Provider visual direction — authoritative English masterprompt
```text
Authentic first-look creator footage with an adult modest Malaysian Muslimah. Start with the EXACT reference product already naturally held near chest. She looks down at it briefly, notices the grounded [REAL_PRODUCT_FEATURE], then looks up naturally with mild curiosity, explaining the useful [BENEFIT_OR_USE_CASE] to the viewer. She has not used it in this scene and makes no personal testing claim. Speak approved Malaysian Malay [SPOKEN_SCRIPT]. Small real movements, no fake unboxing, no reaction exaggeration, 1x smartphone full-frame one take.

Append the compact global realism, exact product-identity, SHARIAH LOCK and ZERO-UI constraints from 00_GLOBAL_LOCKS. Keep the user-approved spoken words exactly; do not ask the provider to improvise alternative dialogue.
```

## 7. Specific prohibitions
Do not claim “aku dah try”; avoid treating physical packaging appearance as benefit.

## 8. Acceptance criteria
- Product use/benefit mentioned naturally; **no packaging-as-benefit**.
- Exact approved spoken BM Malaysia script, finished within 10s.
- Action matches NX03's creative concept and stays physically natural.
- Product stable, no UI/watermark/frame, modesty compliant throughout.
- Correct original style identity even if pre-existing preview video illustrates something else.

## Required shot and dialogue alignment
Use the timeline above as **creative beats**, not a request for jump-cuts. Dialog happens while movement is plausible and slow. No montage. If the shot starts without product, it enters naturally by the documented beat; never materialises from thin air.

## Product truth gate
Every spoken `{BENEFIT}` and `{FEATURE}` must be grounded in Product Brain evidence. If unknown: choose honest category function + use case. If still unknown, request ONE product fact before sending a paid generation. Never fill with packaging commentary.

## Output composition
Compile: `00_GLOBAL_LOCKS` + `01_PRODUCT_AND_SCRIPT_BRAIN` + this STYLE's action/voice/timeline + structured product facts + exact final user-approved script. Do not include docs as a dump in user-visible captions; construct a coherent provider prompt. Preserve selected style ID and prompt version in job metadata.


---

# NX05 • MASALAH SEHARIAN — MASTERPROMPT V5.0
**Engine:** AffiMatik Voice 10s (`nexabot` internal)  
**Category:** Creator review / hand demo as applicable  
**Audio:** One natural BM Malaysia dialogue / VO  
**Production:** Realistic UGC; full-frame phone camera 1x; 9:16; one take.

## 1. Core creative DNA
Problem → solution, in ONE continuous shot with 1 practical everyday problem.

## 2. Hook engine
Ask one specific plausible buyer question: “[MASALAH]? [PRODUK] ...”. The problem should match a supported function.

## 3. Voice DNA
Empathetic Malaysian Malay; quick and matter-of-fact, not dramatic false promise.

## 4. Product-benefit sales script architecture
Problem 0–2s → product visible 2s → supported function 2–6s → realistic outcome/use 6–8s → CTA 8–10s.

**Script planner:** Name product naturally early, deliver only one evidence-backed function/benefit and meaningful situation. Use 14–23 words as a useful target, never cut off speech. If selling, end with ONE verbal "tekan butang di bawah". No CTA for awareness. Script must NOT focus on packaging, botol, label, logo, box, or generic look/size.

## 5. Exact 10-second one-take choreography
| Time | Action + meaning |
|---|---|
| 0.0–2.0 | Same scene, creator casually indicates a harmless real-use problem, e.g. dim study desk or untidy small item; no disaster dramatization. |
| 2.0–4.0 | She raises the EXACT reference product into frame with a small natural movement; no hard cut, no fake teleport. |
| 4.0–7.8 | Explains one grounded function aligned with problem. Visual action should support function if feasible; not full demonstration of unsupported effects. |
| 7.8–10.0 | CTA if selling; final steady hold. No “masalah confirm selesai” overclaim. |

## 6. Provider visual direction — authoritative English masterprompt
```text
Single-take realistic Malaysian home UGC. Adult modest Muslimah creator starts with a relatable specific [BUYER_PROBLEM] implied by naturally arranged real objects in the same scene, then lifts the EXACT reference [PRODUCT] into frame by second two and calmly explains one supported [PRODUCT_FUNCTION_OR_BENEFIT]. Show a credible *possible use context*, not a miraculous instant transformation. Same camera position, no jump cut, no zoom, neutral daylight. Natural Malaysian speech exactly [SPOKEN_SCRIPT].

Append the compact global realism, exact product-identity, SHARIAH LOCK and ZERO-UI constraints from 00_GLOBAL_LOCKS. Keep the user-approved spoken words exactly; do not ask the provider to improvise alternative dialogue.
```

## 7. Specific prohibitions
No before/after fake transformation, no panicked acting, no unrelated product, no camera push-in.

## 8. Acceptance criteria
- Product use/benefit mentioned naturally; **no packaging-as-benefit**.
- Exact approved spoken BM Malaysia script, finished within 10s.
- Action matches NX05's creative concept and stays physically natural.
- Product stable, no UI/watermark/frame, modesty compliant throughout.
- Correct original style identity even if pre-existing preview video illustrates something else.

## Required shot and dialogue alignment
Use the timeline above as **creative beats**, not a request for jump-cuts. Dialog happens while movement is plausible and slow. No montage. If the shot starts without product, it enters naturally by the documented beat; never materialises from thin air.

## Product truth gate
Every spoken `{BENEFIT}` and `{FEATURE}` must be grounded in Product Brain evidence. If unknown: choose honest category function + use case. If still unknown, request ONE product fact before sending a paid generation. Never fill with packaging commentary.

## Output composition
Compile: `00_GLOBAL_LOCKS` + `01_PRODUCT_AND_SCRIPT_BRAIN` + this STYLE's action/voice/timeline + structured product facts + exact final user-approved script. Do not include docs as a dump in user-visible captions; construct a coherent provider prompt. Preserve selected style ID and prompt version in job metadata.


---

# NX07 • SOALAN & JAWAPAN — MASTERPROMPT V5.0
**Engine:** AffiMatik Voice 10s (`nexabot` internal)  
**Category:** Creator review / hand demo as applicable  
**Audio:** One natural BM Malaysia dialogue / VO  
**Production:** Realistic UGC; full-frame phone camera 1x; 9:16; one take.

## 1. Core creative DNA
One useful buyer question answered with ONE verified fact, no fake comment screenshot.

## 2. Hook engine
Direct spoken question at 0s: “[SOALAN_SEBENAR]?”; derived from safe supported product fact.

## 3. Voice DNA
Conversational answer, crisp short, natural Malaysian Malay, no imaginary customer quotation.

## 4. Product-benefit sales script architecture
Question 0–2s → product proof/answer 2–6s → practical meaning 6–8s → CTA 8–10s.

**Script planner:** Name product naturally early, deliver only one evidence-backed function/benefit and meaningful situation. Use 14–23 words as a useful target, never cut off speech. If selling, end with ONE verbal "tekan butang di bawah". No CTA for awareness. Script must NOT focus on packaging, botol, label, logo, box, or generic look/size.

## 5. Exact 10-second one-take choreography
| Time | Action + meaning |
|---|---|
| 0.0–2.0 | Muslimah faces camera and asks one sensible product-related question, product visible on table or in covered hand. No comment overlay. |
| 2.0–5.5 | She answers with one verified feature/function, pointing lightly at actual product only if physically relevant. |
| 5.5–8.0 | Explain what answer means to buyer. No second question or unrelated property. |
| 8.0–10.0 | Soft CTA; calm finish. |

## 6. Provider visual direction — authoritative English masterprompt
```text
Modest Malaysian Muslimah Q&A creator in a naturally bright Malaysian room, single continuous phone 1x shot, with the EXACT reference [PRODUCT] visible from the start. She verbally asks ONE common and meaningful factual question [BUYER_QUESTION], then answers it using ONLY [EVIDENCED_ANSWER] and succinctly ties it to [USE_CASE]. No fake comment box, chat bubble, text graphics, or extra people. Speak the exact approved [SPOKEN_SCRIPT] in natural Malaysian Malay.

Append the compact global realism, exact product-identity, SHARIAH LOCK and ZERO-UI constraints from 00_GLOBAL_LOCKS. Keep the user-approved spoken words exactly; do not ask the provider to improvise alternative dialogue.
```

## 7. Specific prohibitions
Do not state “ramai tanya” unless supported, and do not display a simulated customer question screenshot.

## 8. Acceptance criteria
- Product use/benefit mentioned naturally; **no packaging-as-benefit**.
- Exact approved spoken BM Malaysia script, finished within 10s.
- Action matches NX07's creative concept and stays physically natural.
- Product stable, no UI/watermark/frame, modesty compliant throughout.
- Correct original style identity even if pre-existing preview video illustrates something else.

## Required shot and dialogue alignment
Use the timeline above as **creative beats**, not a request for jump-cuts. Dialog happens while movement is plausible and slow. No montage. If the shot starts without product, it enters naturally by the documented beat; never materialises from thin air.

## Product truth gate
Every spoken `{BENEFIT}` and `{FEATURE}` must be grounded in Product Brain evidence. If unknown: choose honest category function + use case. If still unknown, request ONE product fact before sending a paid generation. Never fill with packaging commentary.

## Output composition
Compile: `00_GLOBAL_LOCKS` + `01_PRODUCT_AND_SCRIPT_BRAIN` + this STYLE's action/voice/timeline + structured product facts + exact final user-approved script. Do not include docs as a dump in user-visible captions; construct a coherent provider prompt. Preserve selected style ID and prompt version in job metadata.


---

# NX09 • GOYANG PRODUK + VO — MASTERPROMPT V5.0
**Engine:** AffiMatik Voice 10s (`nexabot` internal)  
**Category:** Creator review / hand demo as applicable  
**Audio:** One natural BM Malaysia dialogue / VO  
**Production:** Realistic UGC; full-frame phone camera 1x; 9:16; one take.

## 1. Core creative DNA
Natural hand-held goyang2-style demonstration with OFF-CAMERA benefit narration, not a product shaking uncontrollably.

## 2. Hook engine
VO begins with product purpose/use case immediately, not “tengok botol ni”.

## 3. Voice DNA
One natural off-camera Malaysian adult woman voiceover; no visible mouth/person; conversational and measured.

## 4. Product-benefit sales script architecture
Purpose → one confirmed benefit → relevant daily context → optional CTA. Camera focuses only on physical item, not packaging as selling point.

**Script planner:** Name product naturally early, deliver only one evidence-backed function/benefit and meaningful situation. Use 14–23 words as a useful target, never cut off speech. If selling, end with ONE verbal "tekan butang di bawah". No CTA for awareness. Script must NOT focus on packaging, botol, label, logo, box, or generic look/size.

## 5. Exact 10-second one-take choreography
| Time | Action + meaning |
|---|---|
| 0.0–2.0 | Exactly one modest sleeve-covered hand already holding reference product naturally; upright centered and correctly scaled; slight microshake from natural grip. |
| 2.0–5.0 | Hand gently tilts 8–12 degrees left, not shake/spin; label remains reasonably clear; narration introduces real use. |
| 5.0–8.0 | Return center then tilt 8–12 degrees right. Narration states one relevant grounded benefit; stable light and one background. |
| 8.0–10.0 | Hold steady and finish VO/CTA, natural micro-motion. No other hand or camera zoom. |

## 6. Provider visual direction — authoritative English masterprompt
```text
HAND ONLY. Exactly one naturally proportioned adult female hand, wrist fully covered by loose long sleeve; no ring, bracelet, nail polish or extra hands. Hold the EXACT product reference upright in an ordinary brightly lit Malaysian home, product realistically scaled around 20–30% frame. Gentle small 8–12-degree tilt left and right; no wobbling or rotation. Camera 1x, slight authentic handheld movement, one continuous take, no face, no full body. Single OFF-CAMERA Malay Malaysian female narration says ONLY [SPOKEN_SCRIPT], focusing on [FUNCTION] and [REAL_BENEFIT].

Append the compact global realism, exact product-identity, SHARIAH LOCK and ZERO-UI constraints from 00_GLOBAL_LOCKS. Keep the user-approved spoken words exactly; do not ask the provider to improvise alternative dialogue.
```

## 7. Specific prohibitions
No presenter mouth, no dramatic bottle dance, no 360 spin, no sticker/doodle/UI, no macro shot, no discussion of label or cap.

## 8. Acceptance criteria
- Product use/benefit mentioned naturally; **no packaging-as-benefit**.
- Exact approved spoken BM Malaysia script, finished within 10s.
- Action matches NX09's creative concept and stays physically natural.
- Product stable, no UI/watermark/frame, modesty compliant throughout.
- Correct original style identity even if pre-existing preview video illustrates something else.

## Required shot and dialogue alignment
Use the timeline above as **creative beats**, not a request for jump-cuts. Dialog happens while movement is plausible and slow. No montage. If the shot starts without product, it enters naturally by the documented beat; never materialises from thin air.

## Product truth gate
Every spoken `{BENEFIT}` and `{FEATURE}` must be grounded in Product Brain evidence. If unknown: choose honest category function + use case. If still unknown, request ONE product fact before sending a paid generation. Never fill with packaging commentary.

## Output composition
Compile: `00_GLOBAL_LOCKS` + `01_PRODUCT_AND_SCRIPT_BRAIN` + this STYLE's action/voice/timeline + structured product facts + exact final user-approved script. Do not include docs as a dump in user-visible captions; construct a coherent provider prompt. Preserve selected style ID and prompt version in job metadata.


---

# NX10 • LABEL TALK • FUNGSI DULU — MASTERPROMPT V5.0
**Engine:** AffiMatik Voice 10s (`nexabot` internal)  
**Category:** Creator review / hand demo as applicable  
**Audio:** One natural BM Malaysia dialogue / VO  
**Production:** Realistic UGC; full-frame phone camera 1x; 9:16; one take.

## 1. Core creative DNA
Aksi label sebagai bukti atribut, **dialog TIDAK bercakap pasal label**. Sebut fungsi, USP sahih dan manfaat pembeli. Kekalkan ID NX10 demi compatibility.

## 2. Hook engine
“Yang penting tentang [PRODUK], [FUNGSI/FAKTA]...” / “[PRODUK] ni ada [FEATURE] untuk [USE].”

## 3. Voice DNA
Voiceover or off-camera BM Malaysia, factual, simple, clear; no pseudo-legal endorsements.

## 4. Product-benefit sales script architecture
State actual verified feature → translate into customer use → optional CTA. Label is shown only as physical evidence of *printed* specification, not a talking point.

**Script planner:** Name product naturally early, deliver only one evidence-backed function/benefit and meaningful situation. Use 14–23 words as a useful target, never cut off speech. If selling, end with ONE verbal "tekan butang di bawah". No CTA for awareness. Script must NOT focus on packaging, botol, label, logo, box, or generic look/size.

## 5. Exact 10-second one-take choreography
| Time | Action + meaning |
|---|---|
| 0.0–2.5 | Covered hand holds product steady front facing camera in medium framing. Show physical item fully and relevant printed info if legible. |
| 2.5–5.0 | Single subtle finger gesture near factual text *without obscuring or altering it*. Voice states verified function, not “label ni cantik”. |
| 5.0–8.0 | Gentle return to neutral, VO explains practical use. Do not invent words or zoom to unreadable print. |
| 8.0–10.0 | Natural still hold and CTA if selling. No pan to cap, packaging beauty reveal or barcode story. |

## 6. Provider visual direction — authoritative English masterprompt
```text
One fully covered modest adult hand holds the EXACT physical [PRODUCT] in a neutral bright Malaysian setting, standard 1x phone perspective. Front-facing product orientation allows existing label to be visible, but the camera never zooms to typography or recreates text. A single small pointing gesture indicates an actually verified feature if present and readable, while the OFF-CAMERA native Malaysian Malay voice explains [VERIFIED_FEATURE] and what it lets the buyer do [USE_CASE], saying exactly [SPOKEN_SCRIPT]. Identity and all printed marks remain unchanged. One continuous stable take.

Append the compact global realism, exact product-identity, SHARIAH LOCK and ZERO-UI constraints from 00_GLOBAL_LOCKS. Keep the user-approved spoken words exactly; do not ask the provider to improvise alternative dialogue.
```

## 7. Specific prohibitions
Never say “label cantik”, “botol kemas”, “packaging premium” as core, no false certifications, no text overlays.

## 8. Acceptance criteria
- Product use/benefit mentioned naturally; **no packaging-as-benefit**.
- Exact approved spoken BM Malaysia script, finished within 10s.
- Action matches NX10's creative concept and stays physically natural.
- Product stable, no UI/watermark/frame, modesty compliant throughout.
- Correct original style identity even if pre-existing preview video illustrates something else.

## Required shot and dialogue alignment
Use the timeline above as **creative beats**, not a request for jump-cuts. Dialog happens while movement is plausible and slow. No montage. If the shot starts without product, it enters naturally by the documented beat; never materialises from thin air.

## Product truth gate
Every spoken `{BENEFIT}` and `{FEATURE}` must be grounded in Product Brain evidence. If unknown: choose honest category function + use case. If still unknown, request ONE product fact before sending a paid generation. Never fill with packaging commentary.

## Output composition
Compile: `00_GLOBAL_LOCKS` + `01_PRODUCT_AND_SCRIPT_BRAIN` + this STYLE's action/voice/timeline + structured product facts + exact final user-approved script. Do not include docs as a dump in user-visible captions; construct a coherent provider prompt. Preserve selected style ID and prompt version in job metadata.


---

# RH01 • GOYANG PRODUK NATURAL — MASTERPROMPT V5.0
**Engine:** AffiMatik Motion 15s (`runninghub` internal)  
**Audio:** No spoken dialogue. Ambient/ASMR only when truly available.  
**Production:** Realistic everyday smartphone UGC, not cinematic studio.  
**Physical subject:** Actual uploaded product, ONE covered hand where indicated.

## 1. Visual benefit DNA
POV tangan pengguna; natural small handheld tilt. The selling value is placing product in the buyer's relevant real use context, NOT an empty product dance.

**Important:** This style has no narration. Its value is in showing where/how the product belongs in a buyer's life. Do not overlay textual claims or pretend an unverified performance. When actions are constrained to a gentle hold, **use-context background** carries the buyer relevance.

## 2. Scene matching
Choose authentic everyday context where [PRODUCT] belongs — kitchen counter for food, study table for desk gear, wardrobe for clothing accessories, garden bench for gardening products.

## 3. Strict 15-second timeline (one continuous shot)
| Time | Visual beat |
|---|---|
| 0–3s | Product already held upright by one sleeved hand; correct scale, medium field, stable label, buyer-use background readable. |
| 3–7s | Small gentle left tilt 8–12°, back center; hand makes natural balance adjustment. No shaking camera aggressively. |
| 7–11s | Small right tilt 8–12°; allow realistic material response. The product stays physically present. |
| 11–15s | Settle steady 3–4s; final product fully visible with useful context; no CTA overlays. |

## 4. Provider masterprompt (authoritative, English)
```text
One continuous real smartphone 1x handheld shot. Exactly ONE fully sleeve-covered adult hand holds the EXACT reference [PRODUCT] upright in a grounded real-world [USE_CONTEXT]. Small authentic left tilt, center, small right tilt, then hold steady. Slight natural micro-shake only. The object should clearly belong to its intended usage context, conveying purpose visually rather than merely showing packaging. Full-frame 9:16, daylight, no face, no second hand, no graphic overlays.

Apply compact GLOBAL PRODUCT IDENTITY MAX LOCK, SHARIAH LOCK, ZERO-UI LOCK, 9:16 full-frame, realistic 1x camera, neutral daylight and continuity locks. Do not add any spoken dialogue, presenter mouth, captions or shopping UI.
```

## 5. Sound policy
Soft real hand contact / room ambience only if supported. No speech, no lip movement, no intrusive music.

## 6. Negative / failure signatures
No 360 rotation, no literal wobble dance, no forced close-up, no dramatic zoom.
- No TikTok/social logo, phone/video frame, watermark, fake overlays, product morph or altered printed markings.
- No speech, lip sync or robotic/generated vocal artefacts.

## 7. PASS criteria
- Physical action matches RH01 exactly and is distinct from the other RH styles.
- Visual context actually relates to the product category; no irrelevant showroom/counter backdrop.
- Product identity, proportions and light constant throughout.
- Wrist fully covered, no rings, no extra hand, no visible inappropriate human subject.
- Entire MP4 checked at beginning/middle/end; not just a prompt test.

## 8. Variable handling
`[PRODUCT]` = reference-identical product; `[USE_CONTEXT]` = buyer-relevant supported context from Product Brain; no additional made-up benefits. If context unknown, ask one quick user category question rather than inventing a fake usage demonstration.


---

# RH02 • GENTLE PRODUCT TILT — MASTERPROMPT V5.0
**Engine:** AffiMatik Motion 15s (`runninghub` internal)  
**Audio:** No spoken dialogue. Ambient/ASMR only when truly available.  
**Production:** Realistic everyday smartphone UGC, not cinematic studio.  
**Physical subject:** Actual uploaded product, ONE covered hand where indicated.

## 1. Visual benefit DNA
Controlled 10–12-degree product orientation change. Show real usable form and grip/action while preserving the appearance.

**Important:** This style has no narration. Its value is in showing where/how the product belongs in a buyer's life. Do not overlay textual claims or pretend an unverified performance. When actions are constrained to a gentle hold, **use-context background** carries the buyer relevance.

## 2. Scene matching
Natural suitable surface at the place where product would be used. Never add fake active features.

## 3. Strict 15-second timeline (one continuous shot)
| Time | Visual beat |
|---|---|
| 0–3s | Item rests normally on surface; one covered hand contacts item lightly. |
| 3–7s | Small 10–12° tilt to reveal useful physical form and how item may be held. |
| 7–11s | Return to centre, carefully tilt other way; product does not become an exploded animation. |
| 11–15s | Place back properly with real contact shadow, hand rests or exits without abrupt cut. |

## 4. Provider masterprompt (authoritative, English)
```text
Realistic tabletop video of exact [PRODUCT] in [RELEVANT_USE_CONTEXT]. A single modest covered adult hand gently tilts the physical product left 10–12 degrees, returns to center, tilts the other way, and rests it on the real surface. Normal object weight, accurate product identity, clean neutrally lit 1x handheld smartphone footage, no macro exaggeration or changing label. Visual attention follows a buyer-relevant feature/form without any unverified performance demonstration.

Apply compact GLOBAL PRODUCT IDENTITY MAX LOCK, SHARIAH LOCK, ZERO-UI LOCK, 9:16 full-frame, realistic 1x camera, neutral daylight and continuity locks. Do not add any spoken dialogue, presenter mouth, captions or shopping UI.
```

## 5. Sound policy
Subtle touch and object-contact ASMR if naturally available. No speech.

## 6. Negative / failure signatures
No product spin, no floating, no glossy fake studio showroom, no invented mechanism.
- No TikTok/social logo, phone/video frame, watermark, fake overlays, product morph or altered printed markings.
- No speech, lip sync or robotic/generated vocal artefacts.

## 7. PASS criteria
- Physical action matches RH02 exactly and is distinct from the other RH styles.
- Visual context actually relates to the product category; no irrelevant showroom/counter backdrop.
- Product identity, proportions and light constant throughout.
- Wrist fully covered, no rings, no extra hand, no visible inappropriate human subject.
- Entire MP4 checked at beginning/middle/end; not just a prompt test.

## 8. Variable handling
`[PRODUCT]` = reference-identical product; `[USE_CONTEXT]` = buyer-relevant supported context from Product Brain; no additional made-up benefits. If context unknown, ask one quick user category question rather than inventing a fake usage demonstration.


---

# RH03 • PICK UP & PUT DOWN — MASTERPROMPT V5.0
**Engine:** AffiMatik Motion 15s (`runninghub` internal)  
**Audio:** No spoken dialogue. Ambient/ASMR only when truly available.  
**Production:** Realistic everyday smartphone UGC, not cinematic studio.  
**Physical subject:** Actual uploaded product, ONE covered hand where indicated.

## 1. Visual benefit DNA
Real interaction proves handling and physical size. Single take only: pick up, hold, put down. Set in practical usage context.

**Important:** This style has no narration. Its value is in showing where/how the product belongs in a buyer's life. Do not overlay textual claims or pretend an unverified performance. When actions are constrained to a gentle hold, **use-context background** carries the buyer relevance.

## 2. Scene matching
Appropriate real counter / desk / kitchen shelf edge corresponding to category.

## 3. Strict 15-second timeline (one continuous shot)
| Time | Visual beat |
|---|---|
| 0–2s | Product standing safely on real surface. One hand not yet in frame. |
| 2–5s | One covered hand enters, properly grips object without deformation, lifts approx 5–10cm. |
| 5–10s | Hold at ordinary viewing distance and in useful usage setting; natural minor hand adjustment. |
| 10–14s | Lower until base visibly contacts surface and hand releases. |
| 14–15s | Hand withdraws slightly, product remains completely still. |

## 4. Provider masterprompt (authoritative, English)
```text
Natural continuous 15-second smartphone 1x footage. Exact physical [PRODUCT] starts on a real [RELEVANT_SURFACE]. Exactly one covered adult hand enters from the side, grips, lifts 5–10 cm with plausible object weight, holds naturally in [USE_CONTEXT], slowly places the product back with clear contact shadow, releases it, and withdraws. The product remains the same object from beginning to end. Neutral bright daylight. Capture believable everyday handling, not a 360 product turntable or stage effect.

Apply compact GLOBAL PRODUCT IDENTITY MAX LOCK, SHARIAH LOCK, ZERO-UI LOCK, 9:16 full-frame, realistic 1x camera, neutral daylight and continuity locks. Do not add any spoken dialogue, presenter mouth, captions or shopping UI.
```

## 5. Sound policy
Natural object pickup and put-down sound if provider supports it; otherwise honest silence. No dialogue.

## 6. Negative / failure signatures
No automatic product levitation, no spin, no cut, no multiple hands, no fake turntable.
- No TikTok/social logo, phone/video frame, watermark, fake overlays, product morph or altered printed markings.
- No speech, lip sync or robotic/generated vocal artefacts.

## 7. PASS criteria
- Physical action matches RH03 exactly and is distinct from the other RH styles.
- Visual context actually relates to the product category; no irrelevant showroom/counter backdrop.
- Product identity, proportions and light constant throughout.
- Wrist fully covered, no rings, no extra hand, no visible inappropriate human subject.
- Entire MP4 checked at beginning/middle/end; not just a prompt test.

## 8. Variable handling
`[PRODUCT]` = reference-identical product; `[USE_CONTEXT]` = buyer-relevant supported context from Product Brain; no additional made-up benefits. If context unknown, ask one quick user category question rather than inventing a fake usage demonstration.


---

# RH04 • SHELF PICKUP — MASTERPROMPT V5.0
**Engine:** AffiMatik Motion 15s (`runninghub` internal)  
**Audio:** No spoken dialogue. Ambient/ASMR only when truly available.  
**Production:** Realistic everyday smartphone UGC, not cinematic studio.  
**Physical subject:** Actual uploaded product, ONE covered hand where indicated.

## 1. Visual benefit DNA
Product is where a buyer would store/reach for it; hand takes it off shelf and holds naturally. Actual retail demo context, no fake shop interface.

**Important:** This style has no narration. Its value is in showing where/how the product belongs in a buyer's life. Do not overlay textual claims or pretend an unverified performance. When actions are constrained to a gentle hold, **use-context background** carries the buyer relevance.

## 2. Scene matching
Household shelf/organizer appropriate to product category; avoid unsafe storage (e.g., chemicals next to food).

## 3. Strict 15-second timeline (one continuous shot)
| Time | Visual beat |
|---|---|
| 0–3s | Real shelf with one exact product at a visible, natural scale. No oversized display. |
| 3–7s | One covered hand enters, reaches, grips and lifts the item from shelf using real contact. |
| 7–11s | Bring product only modestly forward without zoom, show practical reachability/use association. |
| 11–15s | Hold at comfortable distance in front of shelf, settle still; no direct-to-camera acting. |

## 4. Provider masterprompt (authoritative, English)
```text
One continuous authentic Malaysian home shelf interaction, handheld smartphone 1x, bright neutral daylight. The exact referenced [PRODUCT] sits on a suitable tidy shelf in [USE_CONTEXT]. One sleeve-covered hand reaches in, grasps the product, lifts it naturally off shelf, holds it at ordinary arm distance, keeps product stable. This should feel like a shopper/customer casually taking a relevant item for use, not an ad with visual effects. No second hand, no face, no branded social media UI.

Apply compact GLOBAL PRODUCT IDENTITY MAX LOCK, SHARIAH LOCK, ZERO-UI LOCK, 9:16 full-frame, realistic 1x camera, neutral daylight and continuity locks. Do not add any spoken dialogue, presenter mouth, captions or shopping UI.
```

## 5. Sound policy
Natural finger/shelf contact audio if available; no speech or music by default.

## 6. Negative / failure signatures
No impossible floating, no teleport, no shelf morph, no product tumbling, no phone frame.
- No TikTok/social logo, phone/video frame, watermark, fake overlays, product morph or altered printed markings.
- No speech, lip sync or robotic/generated vocal artefacts.

## 7. PASS criteria
- Physical action matches RH04 exactly and is distinct from the other RH styles.
- Visual context actually relates to the product category; no irrelevant showroom/counter backdrop.
- Product identity, proportions and light constant throughout.
- Wrist fully covered, no rings, no extra hand, no visible inappropriate human subject.
- Entire MP4 checked at beginning/middle/end; not just a prompt test.

## 8. Variable handling
`[PRODUCT]` = reference-identical product; `[USE_CONTEXT]` = buyer-relevant supported context from Product Brain; no additional made-up benefits. If context unknown, ask one quick user category question rather than inventing a fake usage demonstration.


---

# RH17 • DESK SETUP — MASTERPROMPT V5.0
**Engine:** AffiMatik Motion 15s (`runninghub` internal)  
**Audio:** No spoken dialogue. Ambient/ASMR only when truly available.  
**Production:** Realistic everyday smartphone UGC, not cinematic studio.  
**Physical subject:** Actual uploaded product, ONE covered hand where indicated.

## 1. Visual benefit DNA
Show how product belongs within a genuine desk workflow. One modest hand adjustment. Does not fabricate feature demonstrations.

**Important:** This style has no narration. Its value is in showing where/how the product belongs in a buyer's life. Do not overlay textual claims or pretend an unverified performance. When actions are constrained to a gentle hold, **use-context background** carries the buyer relevance.

## 2. Scene matching
Everyday Malaysian study/work desk with 1–2 relevant props only (not brand ads).

## 3. Strict 15-second timeline (one continuous shot)
| Time | Visual beat |
|---|---|
| 0–4s | Product naturally placed in a functional position on a tidy desk beside notebook / appropriate usage object. |
| 4–8s | One covered hand gently positions or straightens product for actual desk use. |
| 8–12s | Small natural tabletop camera drift, not cinematic pan; keep product identity stable and in context. |
| 12–15s | Hold a believable composed final desk scene with soft daylight. No fake text graphics. |

## 4. Provider masterprompt (authoritative, English)
```text
Everyday Malaysian work/study desk, not a commercial showroom. Exact referenced [PRODUCT] in a believable [PRODUCT_SPECIFIC_DESK_USE_CASE] beside minimal realistic desk items. One covered hand enters, makes a small practical position adjustment, then exits. Realistic daylight, normal 1x phone camera with barely noticeable handheld drift, one continuous 15-second take. The arrangement visually shows where the product helps in everyday life without inventing specific functions or adding floating icons.

Apply compact GLOBAL PRODUCT IDENTITY MAX LOCK, SHARIAH LOCK, ZERO-UI LOCK, 9:16 full-frame, realistic 1x camera, neutral daylight and continuity locks. Do not add any spoken dialogue, presenter mouth, captions or shopping UI.
```

## 5. Sound policy
Quiet real room ambience, subtle desk contact; no dialogue. No music unless explicitly selected and licensed.

## 6. Negative / failure signatures
No dramatic studio shadows, no sweeping dolly pan, no product floating, no fake laptop app UI.
- No TikTok/social logo, phone/video frame, watermark, fake overlays, product morph or altered printed markings.
- No speech, lip sync or robotic/generated vocal artefacts.

## 7. PASS criteria
- Physical action matches RH17 exactly and is distinct from the other RH styles.
- Visual context actually relates to the product category; no irrelevant showroom/counter backdrop.
- Product identity, proportions and light constant throughout.
- Wrist fully covered, no rings, no extra hand, no visible inappropriate human subject.
- Entire MP4 checked at beginning/middle/end; not just a prompt test.

## 8. Variable handling
`[PRODUCT]` = reference-identical product; `[USE_CONTEXT]` = buyer-relevant supported context from Product Brain; no additional made-up benefits. If context unknown, ask one quick user category question rather than inventing a fake usage demonstration.


---

# RH19 • WINDOW DAYLIGHT — MASTERPROMPT V5.0
**Engine:** AffiMatik Motion 15s (`runninghub` internal)  
**Audio:** No spoken dialogue. Ambient/ASMR only when truly available.  
**Production:** Realistic everyday smartphone UGC, not cinematic studio.  
**Physical subject:** Actual uploaded product, ONE covered hand where indicated.

## 1. Visual benefit DNA
Clear natural daylight to see real product as it is. Use-context meaningful; no sunlight miracles or beautification.

**Important:** This style has no narration. Its value is in showing where/how the product belongs in a buyer's life. Do not overlay textual claims or pretend an unverified performance. When actions are constrained to a gentle hold, **use-context background** carries the buyer relevance.

## 2. Scene matching
Appropriate bright corner of Malaysian home near window. Avoid projecting sunbeams as CGI.

## 3. Strict 15-second timeline (one continuous shot)
| Time | Visual beat |
|---|---|
| 0–4s | One covered hand holds exact product with bright window side-light; no blown highlights. |
| 4–8s | Subtle 5–8° angle change to make true surface details readable, without spinning. |
| 8–12s | Settle product in comfortable orientation, showing its natural shape and believable use-context. |
| 12–15s | Hold steady in clean white-balanced daylight, no artificial glow. |

## 4. Provider masterprompt (authoritative, English)
```text
Single real-looking handheld smartphone 1x clip of the exact [PRODUCT] held in one modest sleeve-covered adult hand near an ordinary Malaysian home window. Pure neutral clean window daylight, soft true shadow, no golden or sepia tint. Small authentic 5–8-degree hand adjustment, otherwise stable. Product naturally scaled and appropriate to [USE_CONTEXT]; visible real object, not a stylized commercial showcase. One continuous full-frame 15-second shot with absolutely no embedded interface or phone frame.

Apply compact GLOBAL PRODUCT IDENTITY MAX LOCK, SHARIAH LOCK, ZERO-UI LOCK, 9:16 full-frame, realistic 1x camera, neutral daylight and continuity locks. Do not add any spoken dialogue, presenter mouth, captions or shopping UI.
```

## 5. Sound policy
Soft genuine indoor ambient sound only if available. No dialogue.

## 6. Negative / failure signatures
No stop-motion, no visual pulses, no dramatic lens flare, no colour changing, no label redrawing.
- No TikTok/social logo, phone/video frame, watermark, fake overlays, product morph or altered printed markings.
- No speech, lip sync or robotic/generated vocal artefacts.

## 7. PASS criteria
- Physical action matches RH19 exactly and is distinct from the other RH styles.
- Visual context actually relates to the product category; no irrelevant showroom/counter backdrop.
- Product identity, proportions and light constant throughout.
- Wrist fully covered, no rings, no extra hand, no visible inappropriate human subject.
- Entire MP4 checked at beginning/middle/end; not just a prompt test.

## 8. Variable handling
`[PRODUCT]` = reference-identical product; `[USE_CONTEXT]` = buyer-relevant supported context from Product Brain; no additional made-up benefits. If context unknown, ask one quick user category question rather than inventing a fake usage demonstration.


---

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


---

# 91 • REAL QUALITY TEST / PROMPT QA — GEMS STANDARD

## Automated assertions (not sufficient alone)
- All 13 exact IDs mapped to their own independent style MD. No fallback to generic packaging script.
- No final NX speech matches `packaging|bungkusan|botol|label|kotak|kemasan` as the main selling proposition; words may occur incidentally for product identity only if meaningful, but generated draft should be rewritten to actual purpose.
- All output claims have source provenance; user claim ≠ external verification.
- Per-style hook strategy and physical action differ; fake variety (synonyms of same sentence) fails.
- No user script overwritten by compiler; no user visual text inserted as spoken script.
- NX 10s has exactly one BM speech plan, timed/tested in real output; no Indonesia words, self-use fake, forbidden CTA; RH 15s has no spoken dialogue.
- Validate exact duration, aspect, MP4 decode, audio presence; store status as factual metadata.

## Human video rubric (score 0–5; actual video only)
| Axis | Description |
|---|---|
| Benefit clarity | NX: user learns a genuine buyer benefit. RH: meaningful context (not empty product dance). |
| Product truth | No unsupported result/spec or misrepresented use. |
| Style adherence | Exact style-specific action and hook. |
| UGC realism | No AI skin, false contact, fake movement, first-frame flash, overly cinematic shots. |
| Product identity | Shape, cap, branding and label stable. |
| Shariah | Full coverage, one hand, modest, correct anatomy throughout. |
| Zero UI | No watermark, fake frame, logo, CTA overlay, subtitles. |
| Audio | NX clear natural spoken BM; RH no dialogue, ambience truthful. |

**Hard FAIL regardless of score:** visible social logo or embedded phone frame, exposed aurat, altered product identity, unsupported medical claim, video showing wrong style, unverified fake review or creator self-use claim.

## Stress tests
1. Image-only, no written product info → safe category function or request one missing purpose; NEVER packaging filler.
2. Very long product name → use accurate short spoken alias, maintain 10s pacing.
3. Tudung → hijab labuh proper, don't casually show hair/neck; real fabric behaviour.
4. Niqab → never animate mouth; use off-screen speech.
5. Food → verbs eat/serve, no false halal claim.
6. Ingestible/health → no cure.
7. Bottle with screenshot overlay in uploaded ref → do not regenerate UI overlay; use authorised clean source where available.
8. RH03 → actual pickup and put-down; not turntable.
9. RH19 → actual window daylight; not stop motion.
10. NX10 → fact/use benefits; no packaging-review spoken filler.
11. Regen script same product 3 times → different hook/angle, facts consistent.
12. Video sample in gallery → only label `quality_verified` after reviewing real MP4.

## Suggested human decision
`PASS` = quality>=4 for applicable axes and no hard fail. `REVISE` = recoverable prompt issue or uncertain fact. `REJECT` = unsafe/misleading/morphed/wrong video; do not publish.

## Version / approval
Store `promptVersion=affimatik-gems-masterprompts-v5.0`, date, styleId, rendered prompt snapshot, review status and human reviewer. Never mutate prompts for jobs already submitted; allow rollback to previous known version when necessary.

