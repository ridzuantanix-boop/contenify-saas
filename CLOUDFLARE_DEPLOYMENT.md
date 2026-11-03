# Panduan Deploy CONTENIFY ke Cloudflare Pages / Workers

CONTENIFY direka khas untuk beroperasi di atas infrastruktur **Cloudflare** (Cloudflare Pages, Cloudflare Workers, Cloudflare R2 untuk storan video peribadi, dan Cloudflare Queues).

---

## 🚀 Kaedah 1: Deploy Automatik Melalui Cloudflare Dashboard (Paling Mudah)

Ini adalah kaedah rasmi Cloudflare yang menyokong CI/CD automatik setiap kali anda membuat `git push`.

### Langkah-langkah:
1. **Tolak (*Push*) Kod ke GitHub**:
   ```bash
   git add .
   git commit -m "feat: configure Cloudflare Pages deployment"
   git remote add origin https://github.com/USERNAME/contenify.git
   git branch -M main
   git push -u origin main
   ```

2. **Buka Dashboard Cloudflare**:
   - Pergi ke [dash.cloudflare.com](https://dash.cloudflare.com/).
   - Di menu sebelah kiri, klik **Compute (Workers & Pages)** > **Create application** > Tab **Pages** > **Connect to Git**.
   - Pilih repositori `contenify` anda.

3. **Konfigurasi Binaan (*Build Settings*)**:
   - **Framework preset**: `Next.js`
   - **Build command**: `npx @cloudflare/next-on-pages`
   - **Build output directory**: `.vercel/output/static`

4. **Pemboleh Ubah Persekitaran (*Environment Variables*)**:
   Di bahagian *Environment Variables*, tambah:
   - `NODE_VERSION` = `20`
   - `USE_MOCK_PROVIDERS` = `true` (atau `false` jika anda telah meletakkan kunci API sebenar)
   - `NEXABOT_API_KEY` = `[Kunci Nexabot Anda]`
   - `RUNNINGHUB_API_KEY` = `[Kunci RunningHub Anda]`
   - `RUNNINGHUB_WEBAPP_ID` = `2103149871766220801`

5. **Tetapan Keserasian (*Compatibility Flag*)**:
   - Di tab **Settings** > **Functions** > **Compatibility flags**, pastikan nilai `nodejs_compat` diaktifkan untuk kedua-dua *Production* dan *Preview*.

6. **Klik *Save and Deploy***!
   Aplikasi anda akan siap dalam masa ~1–2 minit dengan domain percuma seperti `https://contenify.pages.dev`.

---

## 💻 Kaedah 2: Deploy Menggunakan Terminal (Wrangler CLI)

Jika anda ingin deploy terus dari laptop/terminal tanpa sambungan GitHub:

1. **Log masuk ke akaun Cloudflare anda**:
   ```bash
   npx wrangler login
   ```
   *(Pelayar anda akan dibuka untuk membenarkan akses Cloudflare)*.

2. **Bina projek untuk format Cloudflare Pages**:
   ```bash
   npm run pages:build
   ```

3. **Hantar ke Cloudflare Pages**:
   ```bash
   npm run pages:deploy --project-name=contenify
   ```

---

## 🪣 Konfigurasi Cloudflare R2 (Storan Video Peribadi)

Di dalam dashboard Cloudflare:
1. Klik **R2** > **Create bucket**.
2. Beri nama: `contenify-private-assets`.
3. Di projek Pages anda > **Settings** > **Functions** > **R2 bucket bindings**:
   - Variable name: `R2_BUCKET`
   - R2 bucket: `contenify-private-assets`
