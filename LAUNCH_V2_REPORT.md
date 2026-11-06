# AffiMatik V2 — laporan pelaksanaan dan pelepasan

Tarikh: 6 November 2026. Candidate branch: `codex/launch-v2-audit`.
Keputusan: **NO-GO untuk public launch dan deployment produksi.** Checkout berbayar kekal OFF.

## Maksud status

- **Kod siap, ujian setempat lulus**: dilaksanakan dan diuji dengan Vitest/PostgreSQL/Worker setempat, tetapi belum diuji dengan akaun dan rahsia produksi.
- **Sebahagian**: masih ada keupayaan yang belum dilaksanakan atau dibuktikan.
- **Disekat luaran**: memerlukan SMTP, kredensial/peruntukan pembekal, peranti fizikal, backup atau proses release produksi.

## Senarai keperluan

| Keperluan | Status dan bukti ringkas |
|---|---|
| 13 masterprompt V5, direct-to-provider | Kod siap; ujian prompt semua gaya lulus. Tiada skrip dalaman dalam laluan automatik. Dua prompt penuh berbeza dihantar bersama imej produk sebenar kepada Nexabot dan menghasilkan video; hasil dialog masih mempunyai pelanggaran yang dinyatakan di bawah. |
| Nexabot Voice, durasi, CTA | Adapter menghantar `duration: 10`; dua video baharu H.264/AAC masing-masing 10.027s. CTA terhasil tetapi arahan klaim/BM tidak dipatuhi sepenuhnya oleh provider. Caj pelanggan kekal 10 kredit. |
| RunningHub Motion | Adapter kini memuat naik imej sebenar ke `/task/openapi/upload` dan menggunakan `fileName` pada nod imej. Permintaan RH01 dengan prompt penuh ditolak provider kod 605 kerana baki tidak cukup, sebelum tugas dicipta. Caj pelanggan kekal 15 kredit. |
| Factory dan Jana Video | Imej wajib, nama/arahan pilihan, gaya dan caj dipaparkan; butang Jana Video tersedia. Upload menyimpan aset produk. Laluan Provider→Job memelihara reservasi/settlement. Ujian setempat lulus; journey login produksi belum diuji. |
| Product Library | CRUD metadata, carian, pemilihan semula, deduplikasi atomik dan storan per-workspace berkod; ujian PostgreSQL dan storan tiruan lulus. Aset sebenar rentas peranti belum dibuktikan. |
| Video Library dan MP4 iPhone | Senarai, carian, stream per-workspace, Range 206/416, `Content-Disposition`, metadata sebenar dan muat turun disediakan. Struktur 13 MP4 preview diperiksa. Safari pada iPhone fizikal belum diuji. |
| Pemulihan MP4 sejarah | Route admin idempotent dan UI batch disediakan. 8 job lama belum diimport; URL lama mungkin luput. Tidak caj semula pelanggan. |
| Production Queue | Job sebenar, status/ralat, reload dan polling hanya semasa tab kelihatan disediakan. Data produksi belum dibuktikan dengan Worker baharu. |
| Avatar Library | Upload, senarai, padam, pilihan dan consent per-workspace disediakan. Penggunaan avatar sebagai rujukan provider belum disahkan, maka UI tidak menjanjikannya. |
| Customer Dashboard dan settings | Metrik SQL, wallet, jobs, produk, video, bil dan profil sebenar disediakan. Ujian pangkalan data lulus; integrasi akaun sebenar belum. |
| Affiliate application/approval | Permohonan berasingan, terma berasingan, status PENDING/APPROVED dan review admin disediakan. Tiada auto-enrol daripada langganan. |
| Referral dan dashboard affiliate | Cookie 30 hari, event klik/pendaftaran, attribution, pautan kempen, metrik dan sejarah komisen disediakan. Statistik pembeli layak dibetulkan berdasarkan `workspace_id`. Journey rujukan produksi belum diuji. |
| Komisen 10% bayaran pertama | Migrasi 00011 mengunci APPROVED, bukan diri sendiri, bayaran pertama dan 10%; telah disahkan pada produksi sebelum V2. Ujian lokal lulus. Tiada pesanan PAID produksi untuk ujian transaksi sebenar. |
| Tahanan 14 hari, minimum RM50, payout | Migrasi 00012, RPC atomik, UI pelanggan/admin dan ujian PostgreSQL lulus. Bayaran bank sebenar belum diuji. Laluan admin lama yang boleh terus menanda komisen PAID dibuang. |
| Refund dan reversal | Migrasi 00017 menarik balik kredit tidak terpakai, mencatat hutang kredit untuk kekurangan, menyekat job baharu, melarang settlement semula; komisen unpaid dibalik dan komisen paid membuka clawback. Ujian PostgreSQL lulus. Refund bank sebenar belum diuji. |
| Admin Dashboard | Pengguna, operasi, kewangan, affiliate, refund, clawback, recovery dan audit disediakan. Tiga endpoint admin global diketatkan kepada superadmin; status provider tidak lagi hijau palsu. Metrik kos pembekal sebenar belum ada. |
| Harga, trial dan billing | Satu konfigurasi pelan RM49/100, RM129/300, RM399/1000; 20 kredit sekali untuk akaun baru yang disahkan. Wallet lama kekal. Checkout awam OFF; webhook automatik memang ditutup. Renewal/rollover/expiry dan invois gateway sebenar masih bergantung dasar/pembayaran luaran. |
| Signup, emel dan recovery | Signup memerlukan pengesahan Supabase sebelum workspace/20 kredit diwujudkan; provisioning RPC idempotent, resend tersedia. **Produksi Confirm email ON tetapi custom SMTP OFF**; penghantaran emel sebenar gagal dibuktikan. |
| Keselamatan/tenant | RLS 11 jadual sensitif dalam migrasi 00014, service-role-only RPC, admin superadmin, akses order/video/asset per-workspace, SSRF allowlist, audit dan fail-closed. Ujian auth/tenant lulus. Migrasi V2 belum dipasang pada produksi. |
| Mobile UI | Homepage pada viewport 390×844 dan redirect Factory ke login diuji pada Worker setempat; tiada horizontal overflow yang kelihatan pada halaman awam. Paparan semua dashboard selepas login di iPhone/Android fizikal belum diuji. |
| Concurrency/retry/Cloudflare | Ujian dua sambungan PostgreSQL untuk admission, idempotency, polling Factory 10 saat dan Queue 60 saat dengan tab visible; Worker OpenNext dibina dan preview tempatan 200/401. Kuota sebenar Cloudflare belum diukur. |
| Financial monitoring/reserves | Admin membezakan bayaran disahkan dan unverified, safety buffer RM500, fixed RM300 dan reserve refund 10% kekal dalam model. Kos sebenar pembekal/gateway/storage/egress/tax belum diperoleh; surplus/owner salary tidak boleh diperakui. |

## Bukti ujian

- `npm test`: **126/126 lulus**, 19 fail ujian. Termasuk PGlite migrasi 00001–00017, refund/hutang kredit, affiliate hold/payout, auth provisioning, tenant, PostgreSQL dua sambungan, eksport prompt, adapter upload imej dan ralat RunningHub 605.
- `npm run lint`: lulus. `npm run build`: lulus pada Next.js 16.4.5. `npm run worker:build`: lulus pada OpenNext Cloudflare 1.20.16, dengan amaran keserasian Windows daripada OpenNext.
- `npm audit --omit=dev`: **0 vulnerability** dalam production dependencies. Dev dependency audit masih mempunyai temuan; semak semula sebelum rantaian CI/release.
- Worker tempatan `127.0.0.1:8788`: homepage/login/factory/register 200, sesi tanpa login dan laluan terlindung diuji. Frontend terlindung mengalih ke login. Tiada rahsia Supabase disuntik dalam Worker tempatan.
- 13 fail MP4 preview sedia ada diperiksa secara struktur untuk trek video dan durasi (Voice ~10s, Motion ~15s).
- Nexabot live QA: `4c158356c9ef8e94` (LUMA DISH SOAP, NX01) dan `c1dcfd367c88631d` (NOVA LAMP, NX05) kedua-duanya `done`, 10.027s, 720×1280, H.264/AAC. Muat turun disimpan setempat dalam `output/provider-qa/` (diabaikan Git). Payload menghantar imej PNG sebenar sebagai media data URI dan prompt penuh; perbezaan prompt disahkan.
- Pemeriksaan bingkai: lampu NOVA muncul dalam adegan hidup dengan bentuk/label konsisten. LUMA pertama bermula dengan imej produk pegun sebelum presenter. Prompt diperketat dan ulangan `9d3e930e4396c53e` (10.027s) kini bermula dengan adegan hidup dan botol/label konsisten. Transkripsi automatik model `faster-whisper-base` (anggaran, bukan audit telinga manusia) menunjukkan dialog LUMA tentang kotoran pinggan, NOVA tentang lampu/gelap dan CTA berbeza; NOVA menyebut kemungkinan klaim sakit mata hilang, LUMA pertama mungkin klaim segera bersih dan bentuk Indonesia `karena`/`cobalah`. Ulangan LUMA masih menyebut dakwaan minyak degil hilang dan pinggan terus licin tanpa bukti imej. Ini kegagalan kualiti provider yang belum selesai.
- RunningHub live QA: `accountStatus` berjaya, `remainCoins=39548`, `remainMoney=USD 0.0620`; upload imej NOVA berjaya dan mengembalikan `api/...png`. Dua endpoint submit menolak RH01 dengan `605 / NOT_ENOUGH_BALANCE`. Tiada task/video RunningHub dihasilkan. Adapter memetakan 605 kepada ralat tidak boleh dicuba semula dan tidak dibil pelanggan; diuji secara automatik.

## Pemeriksaan produksi baca sahaja

- Supabase `affimatik-production`: 6 auth users, 6 profiles, 6 wallets, jumlah baki 220 kredit, 8 job COMPLETED; 0 order PAID dan 0 rujukan PAID berulang pada 6 November 2026.
- `Confirm email` ON, custom SMTP OFF. Tiada bukti inbox menerima emel. Pengguna perlu menyediakan penghantar SMTP/domain yang sah dan menguji delivery.
- Kolum `affiliate_commissions.available_at` belum wujud: migrasi 00012–00017 **belum** digunakan pada produksi. Bucket private `affimatik-assets` wujud tetapi belum berisi objek ketika diperiksa sebelum ini.
- App produksi masih pada SHA `5c5430b4f15cc1c426b969c4c5c793f73aa0d61f` menurut semakan sebelumnya. Candidate belum dideploy. Tiada perubahan pada 6 pengguna, wallet, job, bayaran atau media produksi semasa tugasan ini.

## Halangan yang memerlukan tindakan sebenar di luar kod

1. Konfigurasi SMTP yang pemilik kawal, domain sender/DNS dan ujian emel ke inbox sebenar.
2. Snapshot/backup Supabase Auth, database dan Storage serta latihan restore pada projek terasing sebelum migrasi 00012–00017. Hanya migration 00011 telah dipasang sebelum tugasan ini. Fail `scripts/v2-production-preflight.sql` ialah query manifest baca sahaja.
3. Rahsia dan routing Worker OpenNext untuk Supabase, Nexabot, RunningHub, SESSION_SECRET, ADMIN_ACCESS_KEY dan cron; peralihan Cloudflare Pages→Worker/DNS mesti melalui proses release sah.
4. Tambah baki RunningHub yang mencukupi dan jalankan satu generasi Motion sebenar. Nexabot key semasa sah dan dua generasi sebenar selesai, tetapi kualiti dialog/identiti perlu lulus QA manual dan ulangan selepas pembetulan prompt. Kos Nexabot setiap ujian semasa 0.15 provider credit, bukan kredit pelanggan.
5. Ujian iPhone Safari dan Android Chrome fizikal bagi signup→video→Files→login semula; transaksi rujukan affiliate/payout/refund bank sebenar hanya selepas pembayaran dibenarkan.
6. Pemulihan 8 URL MP4 sejarah selepas snapshot dan import satu job yang disahkan; laporkan mana-mana URL yang sudah luput.

## Release dan rollback

Candidate ini tidak selamat untuk dipasang pada produksi sehingga halangan di atas dan ujian Gate B/C selesai. Sebelum release: eksport backup auth/database/storage, jalankan preflight SQL, rekod setiap jumlah, jalankan migrasi 00012–00017 ikut tertib dalam staging bersalinan, validasi delta data, konfigurasi Worker secrets, uji perjalanan pelanggan dan affiliate, barulah release. Kekalkan checkout OFF sehingga kos dan margin sebenar lulus dan pemilik mengaktifkannya secara jelas.

Jika perlu rollback aplikasi, redeploy SHA produksi `5c5430b4f15cc1c426b969c4c5c793f73aa0d61f` dan kekalkan checkout OFF. Migrasi tambahan tidak perlu dijalankan balik secara automatik; restore database/storage daripada snapshot jika perubahan skema perlu dipulangkan. **Backup produksi belum dibuat dalam tugasan ini**, jadi tiada migrasi produksi baharu dijalankan.
