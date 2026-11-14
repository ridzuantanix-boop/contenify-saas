# DRAF NOTIS PRIVASI AFFIMATIK / AFFIMATIK PRIVACY NOTICE DRAFT

> **STATUS: DRAF UNTUK SEMAKAN PEMILIK DAN PENASIHAT UNDANG-UNDANG — BELUM BERKUAT KUASA DAN JANGAN DITERBITKAN.** Medan `[SEMAKAN PEMILIK]` mesti dilengkapkan. Jadual retensi dan mekanisme pemindahan rentas sempadan mesti diluluskan serta dilaksanakan sebelum notis ini dijadikan notis awam.

Tarikh audit aliran data: **14 November 2026**<br>
Tarikh kuat kuasa dicadangkan: **14 November 2026** (jika diterbitkan kemudian, gunakan tarikh penerbitan sebenar dan jangan backdate)

## Bahasa Melayu

### 1. Siapa yang mengendalikan AffiMatik

AffiMatik dikendalikan secara individu oleh **Muhammad Ridzuan bin Ramli** ("pengendali", "kami"). **Pawarna Studio** ialah nama jenama sahaja dan bukan syarikat atau enterprise berdaftar. Pada tarikh draf ini, tiada nombor pendaftaran SSM untuk perniagaan tersebut.

Alamat perniagaan: **TTGU, Tasek Gelugor, Pulau Pinang, Malaysia**<br>
E-mel sokongan dan privasi: **support@affimatik.online**<br>
Telefon sokongan: **019-521 6867**

Jangan masukkan nombor MyKad atau nombor dokumen identiti dalam notis ini.

### 2. Data peribadi yang kami proses

Mengikut fungsi yang digunakan, kami memproses kategori berikut:

- **Akaun dan hubungan:** nama, alamat e-mel, nombor WhatsApp, ID pengguna, status pengesahan e-mel, metadata akaun dan komunikasi sokongan.
- **Workspace dan kandungan kreatif:** produk, nama/kategori/catatan dan fakta produk yang disahkan pengguna, imej produk, avatar, latar, Creator Profile, preset, folder produk, arahan kreatif, nama fail dan metadata fail.
- **Penjanaan video:** gaya yang dipilih, CTA, tetapan audio, prompt provider, snapshot konfigurasi, ID task provider, status queue/retry, mesej ralat, output video, metadata media dan rekod muat turun/stream yang berkaitan.
- **Pesanan, bayaran dan kredit:** plan, jumlah MYR, rujukan pesanan, kaedah bayaran, bukti bayaran yang dimuat naik, hash fail, jenis/saiz fail, masa penghantaran bukti, status provisional atau pengesahan admin, wallet, bucket kredit, reservation dan ledger. Kami tidak meminta kata laluan perbankan, PIN atau TAC.
- **Affiliate:** permohonan, kod referral, attribution, status kelulusan, komisen, hold, reversal dan payout jika berkenaan.
- **Analitik pihak pertama:** ID pelawat rawak, nama event, dedupe key, halaman, masa dan metadata terhad seperti placement, demo, plan, provider atau style. Endpoint analytics menolak metadata kewangan sensitif dan direka supaya kegagalannya tidak menyekat pendaftaran, checkout atau generation.
- **Teknikal, keselamatan dan operasi:** alamat IP yang boleh muncul dalam log rangkaian/provider, jenis peranti/pelayar, cookie sesi, masa permintaan, rate-limit, log ralat, audit pentadbiran, dan maklumat diagnostik yang diperlukan untuk keselamatan dan pemulihan sistem.

Data diterima terus daripada anda, peranti/pelayar anda, pemilik workspace, aliran checkout, program referral, atau provider yang memproses job bagi pihak AffiMatik.

### 3. Mengapa data digunakan

Data digunakan untuk:

- mendaftar, mengesahkan, melindungi dan menyokong akaun;
- mengasingkan workspace dan mengawal akses kepada media persendirian;
- menyimpan aset produk serta tetapan kreatif;
- membina arahan provider dan mengurus queue, retry, reconciliation serta penghantaran video;
- mengurus pesanan, bukti bayaran, kredit provisional, wallet, ledger, refund/reversal dan audit kewangan;
- mencegah replay resit, duplicate grant, penyalahgunaan, akses silang workspace dan ancaman keselamatan;
- mengurus affiliate dan attribution;
- mengukur perjalanan landing, pendaftaran, checkout dan video pertama menggunakan analytics pihak pertama yang terhad;
- menghantar e-mel transaksi apabila saluran e-mel berkenaan dikonfigurasi; dan
- mematuhi kewajipan undang-undang serta menangani pertikaian atau permintaan pihak berkuasa yang sah.

Kami tidak akan menggunakan imej, video atau identiti pelanggan dalam pemasaran awam tanpa kebenaran berasingan. Komunikasi pemasaran mesti menyediakan cara untuk berhenti menerima mesej.

### 4. Penyedia perkhidmatan dan pendedahan

| Penerima/pemproses | Data dan tujuan | Lokasi/status yang telah dikenal pasti |
| --- | --- | --- |
| **Supabase** | PostgreSQL, Auth, Storage private, signed media link dan backup berkaitan projek | Endpoint production menunjukkan AWS `ap-northeast-1`, yang didokumenkan Supabase sebagai Tokyo. Database/Auth/Storage origin berada di region projek; CDN, telemetry dan sokongan boleh melibatkan lokasi lain. **[SEMAKAN PEMILIK: sahkan region dalam dashboard dan terima DPA/subprocessor list.]** |
| **Cloudflare** | Worker hosting, routing, TLS, keselamatan, asset delivery dan log operasi | Workers berjalan pada rangkaian global; negara pemprosesan bagi setiap request tidak dipinkan dalam konfigurasi semasa. **[SEMAKAN PEMILIK: semak DPA, log settings dan pilihan Data Localization jika diperlukan.]** |
| **Nexabot** | Imej rujukan, prompt/arahan kreatif, tetapan generation, task ID dan output sementara bagi menjana video | API ialah `nexabot.id`. Negara penyimpanan/pemprosesan, subprocessor dan kontrak perlindungan data **belum disahkan**. AffiMatik menyalin output yang siap ke Storage private miliknya. **Ini blocker sebelum penerbitan.** |
| **Resend / saluran SMTP** | Alamat e-mel, nama jika digunakan dan kandungan e-mel pengesahan/transaksi | Kod Worker hanya menggunakan Resend apabila `RESEND_API_KEY` dikonfigurasi; secret tersebut tidak terdapat pada Worker production ketika audit. Konfigurasi SMTP Supabase perlu disahkan berasingan. **[SEMAKAN PEMILIK: sahkan provider aktif, DPA, subprocessor dan lokasi.]** |
| **Penasihat/pihak berkuasa** | Rekod minimum yang perlu bagi nasihat, tuntutan, keselamatan atau kewajipan sah | Hanya apabila dibenarkan atau dikehendaki undang-undang. |

RunningHub tidak digunakan dalam aliran production semasa. AffiMatik tidak mempunyai integrasi bank masa nyata; muat naik bukti bayaran tidak bermaksud bank telah mengesahkan pembayaran.

### 5. Pemindahan data ke luar Malaysia

Penggunaan Supabase Tokyo, Cloudflare global, Nexabot dan saluran e-mel boleh melibatkan pemindahan atau akses di luar Malaysia. Sebelum notis ini diterbitkan, pengendali mesti:

1. mengesahkan lokasi dan subprocessor setiap provider;
2. menentukan serta merekodkan syarat Seksyen 129 Akta 709 yang digunakan bagi setiap pemindahan;
3. melengkapkan penilaian impak pemindahan jika diperlukan; dan
4. memastikan kontrak, langkah keselamatan dan notis/persetujuan yang sesuai tersedia.

Draf ini tidak mendakwa bahawa perlindungan rentas sempadan telah disahkan.

### 6. Keselamatan

Kawalan yang dikenal pasti dalam sistem termasuk sesi HttpOnly, rahsia server-side, pengasingan workspace, media private dengan signed URL terhad masa, RLS dan akses service-role, rate limit, hash bukti bayaran, transaksi atomik/idempotent, audit ledger, queue leases, backup terenkripsi dan semakan duplicate grant. Tiada sistem elektronik bebas risiko. Jangan hantarkan kata laluan, PIN, TAC atau nombor dokumen identiti melalui sokongan.

### 7. Retensi dan pemadaman — keadaan semasa

Audit kod mendapati:

- cookie sesi pelanggan tamat selepas 7 hari; sesi admin selepas 12 jam;
- cookie referral boleh bertahan 30 hari dan cookie analytics `affimatik_visitor` sehingga 180 hari;
- signed URL media lazimnya tamat selepas 15 minit hingga 1 jam, tetapi tamatnya URL tidak memadam objek asal;
- kredit Launch Pack/top-up boleh mempunyai tempoh sah 180 hari; ini tempoh entitlement, bukan tempoh pemadaman data;
- avatar dan background pelanggan mempunyai tindakan delete; penggantian/pembuangan QR juga memadam objek berkenaan;
- tiada scheduler purge umum yang ditemui untuk akaun, profil, produk, video, prompt snapshot, pesanan, bukti bayaran, ledger, affiliate, audit log atau conversion events; dan
- backup production dibuat secara manual dan terenkripsi, tetapi tempoh pemadaman backup belum ditetapkan.

Oleh itu, jadual retensi dalam `INDIVIDUAL_OPERATOR_RELEASE_CHECKLIST.md` ialah **cadangan**, bukan fungsi yang telah dilaksanakan. Notis awam tidak patut menjanjikan tempoh pemadaman tertentu sehingga owner meluluskan jadual dan sistem/runbook menyokongnya. Permintaan pemadaman akan dinilai dengan mengambil kira transaksi, keselamatan, pertikaian, backup dan rekod yang wajib dikekalkan.

### 8. Cookies dan storan pelayar

AffiMatik menggunakan cookie/storan yang perlu bagi sesi, keselamatan, niat pembelian, referral dan dedupe analytics. `affimatik_session` ialah HttpOnly; `affimatik_ref` menyimpan attribution referral; `affimatik_visitor` ialah ID rawak analytics pihak pertama. Session storage/local storage boleh menyimpan niat Launch Pack atau status penghantaran event pada peranti. Tiada pixel pengiklanan disahkan dalam audit ini.

### 9. Hak dan pilihan anda

Tertakluk kepada undang-undang, anda boleh meminta akses atau pembetulan data peribadi, menarik balik persetujuan yang berkaitan, menghentikan direct marketing, atau meminta penjelasan/pemadaman yang sesuai melalui **support@affimatik.online** atau **019-521 6867**. Kami mungkin perlu mengesahkan identiti tanpa meminta kata laluan. Rekod transaksi, keselamatan dan audit tertentu mungkin perlu dikekalkan.

### 10. Kanak-kanak, insiden dan perubahan

Umur minimum akaun ialah **12 tahun**. Pengguna berumur 12 hingga 17 tahun hanya boleh menggunakan AffiMatik dengan pengetahuan dan kebenaran ibu bapa atau penjaga yang sah; ibu bapa/penjaga mesti menyemak Terma dan membenarkan sebarang pembelian. AffiMatik boleh meminta pengesahan penjaga atau mengehadkan akaun jika kebenaran tidak dapat disahkan. Pengguna bawah 12 tahun tidak dibenarkan membuka akaun.

Insiden akan dinilai dan diurus menurut undang-undang serta garis panduan pemberitahuan pelanggaran data yang terpakai. Perubahan material akan dipaparkan bersama tarikh kuat kuasa baharu.

---

## English

### 1. Who operates AffiMatik

AffiMatik is operated by **Muhammad Ridzuan bin Ramli** as an individual (the "operator", "we", "us"). **Pawarna Studio** is a brand name only and is not a registered company or enterprise. As at the date of this draft, the business has no SSM registration number.

Business address: **TTGU, Tasek Gelugor, Penang, Malaysia**<br>
Support and privacy email: **support@affimatik.online**<br>
Support telephone: **019-521 6867**

No national identity-card or identity-document number should be published in this notice.

### 2. Personal data we process

Depending on the features used, we process:

- **Account and contact data:** name, email, WhatsApp number, user ID, email-verification status, account metadata and support communications.
- **Workspace and creative content:** products, user-confirmed product facts, product images, avatars, backgrounds, Creator Profiles, presets, product folders, creative instructions, filenames and file metadata.
- **Video generation data:** selected style, CTA, audio settings, provider prompt, immutable generation snapshot, provider task ID, queue/retry status, error messages, generated video, media metadata and related stream/download records.
- **Order, payment and credit data:** plan, MYR amount, order reference, payment method, uploaded payment evidence, file hash/type/size, evidence timestamp, provisional/admin-verification status, wallet, credit buckets, reservations and ledger records. We do not request online-banking passwords, PINs or TACs.
- **Affiliate data:** applications, referral codes and attribution, approval status, commissions, holds, reversals and payouts where applicable.
- **Limited first-party analytics:** random visitor ID, event name, deduplication key, path, time and restricted metadata such as placement, demo, plan, provider or style. The analytics endpoint rejects sensitive financial metadata and failures do not block registration, checkout or generation.
- **Technical, security and operations data:** IP addresses that may appear in network/provider logs, device/browser type, session cookies, request time, rate-limit state, error logs, administrative audit records and diagnostics required for security and recovery.

Data comes from you, your device/browser, the workspace owner, checkout and referral flows, or providers processing generation jobs for AffiMatik.

### 3. How and why we use data

We use data to register, verify, secure and support accounts; isolate workspaces and protect private media; store products and creative settings; instruct the AI provider and operate queues, retries, reconciliation and delivery; administer orders, payment evidence, provisional credits, wallets, ledgers and financial audits; prevent receipt replay, duplicate grants, abuse and cross-workspace access; operate affiliates; measure the landing-to-first-video journey using limited first-party analytics; send transactional email when configured; and meet lawful obligations or resolve disputes.

We will not use customer images, videos or identity in public marketing without separate permission. Marketing communications must provide an opt-out method.

### 4. Service providers and disclosures

| Recipient/processor | Data and purpose | Identified location/status |
| --- | --- | --- |
| **Supabase** | PostgreSQL, Auth, private Storage, signed media links and project-related backups | The production endpoint identifies AWS `ap-northeast-1`, documented by Supabase as Tokyo. Database/Auth/Storage origin are in the project region, while CDN, telemetry and support can involve other locations. **[OWNER REVIEW: confirm the dashboard region and accept/review the DPA and subprocessors.]** |
| **Cloudflare** | Worker hosting, routing, TLS, security, asset delivery and operational logs | Workers execute on a global network; the current configuration does not pin every request to one country. **[OWNER REVIEW: review the DPA, log settings and any required Data Localization controls.]** |
| **Nexabot** | Reference images, creative/provider prompts, generation settings, task IDs and temporary output | The API is hosted at `nexabot.id`. Processing/storage countries, subprocessors and contractual safeguards are **not verified**. AffiMatik ingests completed output into its own private Storage. **This is a publication blocker.** |
| **Resend / SMTP channel** | Email address, name where used and verification/transactional email content | Worker code uses Resend only when `RESEND_API_KEY` is configured; that secret was not present on the production Worker at audit. Supabase SMTP must be checked separately. **[OWNER REVIEW: confirm the active provider, DPA, subprocessors and locations.]** |
| **Advisers/authorities** | Minimum necessary records for advice, claims, security or lawful requirements | Only where permitted or required by law. |

RunningHub is not used in the current production path. AffiMatik has no real-time banking integration; uploading payment evidence does not mean a bank has confirmed payment.

### 5. International transfers

Supabase Tokyo, Cloudflare's global network, Nexabot and email delivery can involve transfer or access outside Malaysia. Before publication, the operator must verify locations and subprocessors, document the applicable condition under section 129 of Act 709, complete any required transfer assessment, and put appropriate contractual, security and notice/consent measures in place. This draft does not claim that international-transfer safeguards have been completed.

### 6. Security

Observed controls include HttpOnly sessions, server-side secrets, workspace isolation, private media with time-limited signed URLs, RLS/service-role access, rate limits, payment-evidence hashing, atomic/idempotent transactions, ledger auditing, queue leases and encrypted backups. No electronic system is risk-free. Do not send passwords, PINs, TACs or identity-document numbers through support.

### 7. Retention and deletion — current state

Customer sessions expire after 7 days and admin sessions after 12 hours. Referral cookies can last 30 days and the first-party `affimatik_visitor` cookie up to 180 days. Signed media links normally expire within 15 minutes to one hour, but link expiry does not delete source objects. A 180-day credit validity is an entitlement period, not a deletion period. Customer avatars/backgrounds and the configured QR have specific deletion paths, but no general purge scheduler was found for accounts, products, videos, prompts, orders, payment evidence, ledgers, affiliates, audit logs or conversion events. Encrypted backups are created manually and have no approved deletion period.

The schedule in `INDIVIDUAL_OPERATOR_RELEASE_CHECKLIST.md` is therefore a proposal, not implemented functionality. No fixed public deletion promise should be made until the schedule and its technical runbook are approved and implemented.

### 8. Cookies and browser storage

Necessary cookies/storage support sessions, security, purchase intent, referrals and analytics deduplication. `affimatik_session` is HttpOnly, `affimatik_ref` stores attribution and `affimatik_visitor` is a random first-party analytics identifier. Session/local storage may hold Launch Pack intent or event-delivery state. No advertising pixel was verified in this audit.

### 9. Your rights and choices

Subject to applicable law, you may request access or correction, withdraw relevant consent, stop direct marketing, or request an appropriate explanation/deletion by contacting **support@affimatik.online** or **019-521 6867**. We may verify identity without asking for a password. Certain transaction, security and audit records may need to be retained.

### 10. Children, incidents and updates

The minimum account age is **12**. Users aged 12 to 17 may use AffiMatik only with the knowledge and permission of a parent or legal guardian, who must review the Terms and authorize purchases. AffiMatik may request guardian confirmation or restrict an account if permission cannot be verified. Users under 12 may not open an account.

Incidents will be assessed and handled under applicable law and data-breach-notification guidance. Material changes will be published with a new effective date.

## Rujukan semakan / Review references

- Akta Perlindungan Data Peribadi 2010 dan pindaan: https://www.pdp.gov.my/en/akta/pdp-act-2010-en/
- Panduan Notis Privasi Seksyen 7: https://www.pdp.gov.my/en/akta/guidance-on-the-preparation-of-personal-data-protection-notices/
- Garis Panduan Pemindahan Data Peribadi Rentas Sempadan 3/2025: https://www.pdp.gov.my/en/akta/personal-data-protection-guidelines-on-cross-border-transfer-of-personal-data-cbpdt/
- Supabase regions: https://supabase.com/docs/guides/platform/regions
- Cloudflare Workers execution model: https://developers.cloudflare.com/workers/reference/how-workers-works/
