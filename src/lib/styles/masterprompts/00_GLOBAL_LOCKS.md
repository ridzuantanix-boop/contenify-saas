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
