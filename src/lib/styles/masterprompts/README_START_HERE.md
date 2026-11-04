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
