import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  CreditCard,
  Download,
  FolderOpen,
  Play,
  Repeat2,
  ShieldCheck,
  Sparkles,
  Upload,
  Video,
  WandSparkles,
} from 'lucide-react';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'AffiMatik V9 — Tutorial Showcase',
  description: 'Paparan demo awam dan read-only untuk menghasilkan tutorial AffiMatik V9 Cloud Auto Factory.',
  robots: { index: false, follow: false },
};

const styles = [
  ['NX01', 'Sembang Kawan Santai'], ['NX02', 'Masalah Harian'], ['NX03', 'Demo Terus'],
  ['NX05', 'Cerita Ringkas'], ['NX07', 'POV Pengguna'], ['NX09', 'Review Jujur'],
  ['NX10', 'Unboxing Natural'], ['NX11', 'Hook Pantas'], ['NX12', 'Lifestyle Harian'],
  ['NX13', 'Creator Profesional'], ['NX14', 'Soft Sell'], ['NX15', 'FAQ Produk'],
  ['NX16', 'Kerja & Produktiviti'], ['NX17', 'Recommend Spontan'],
  ['RH01', 'Product Hero'], ['RH02', 'Shelf Pick'], ['RH03', 'Ambient ASMR'],
  ['RH04', 'Window Light'], ['RH17', 'Hands-on Detail'], ['RH19', 'Cinematic Product'],
];

const steps = [
  ['1', 'Pilih folder produk', 'Pilih satu folder atau muat naik beberapa imej produk terus dari telefon.'],
  ['2', 'Pilih Creator Profile', 'Gunakan profil tersimpan yang mengandungi avatar, latar, suara, CTA dan pilihan kreatif.'],
  ['3', 'Pilih gaya video', 'Pilih satu gaya untuk Quick Bulk atau beberapa gaya untuk Auto Mix.'],
  ['4', 'Tetapkan kuantiti', 'Tentukan bilangan video bagi setiap produk dan semak keperluan kredit.'],
  ['5', 'Mulakan Auto Run', 'Tugasan disimpan di cloud dan diteruskan walaupun pelayar ditutup.'],
];

const queueStatusClass: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-700',
  amber: 'bg-amber-50 text-amber-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  rose: 'bg-rose-50 text-rose-700',
};

function DemoBadge() {
  return <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-amber-800">Demo read-only</span>;
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="mb-6 max-w-3xl">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-indigo-600">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">{text}</p>
    </div>
  );
}

function DemoButton({ children, primary = false }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <span aria-disabled="true" className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm ${primary ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>
      {children}
    </span>
  );
}

export default function TutorialShowcasePage() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-600 font-black text-white">A</div>
            <div><p className="font-black leading-tight">AffiMatik V9</p><p className="text-xs text-slate-500">Cloud Auto Factory</p></div>
          </div>
          <DemoBadge />
        </div>
      </header>

      <section className="border-b border-indigo-100 bg-gradient-to-br from-indigo-950 via-indigo-800 to-violet-700 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_.8fr] lg:py-20">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-bold ring-1 ring-white/20"><Sparkles className="h-4 w-4 text-amber-300" /> Tutorial Showcase Tanpa Login</p>
            <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-6xl">Dari gambar produk ke video secara automatik.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-indigo-100 sm:text-lg">Halaman ini memaparkan perjalanan lengkap pelanggan AffiMatik menggunakan data simulasi. Ia selamat untuk rakaman tutorial dan tidak memberikan akses kepada akaun, kredit atau data production.</p>
            <nav aria-label="Bahagian tutorial" className="mt-7 flex flex-wrap gap-2 text-xs font-bold">
              {['dashboard', 'profiles', 'products', 'factory', 'queue', 'library', 'billing'].map((id) => <a key={id} href={`#${id}`} className="rounded-full bg-white/10 px-3 py-2 capitalize ring-1 ring-white/20 hover:bg-white/20">{id}</a>)}
            </nav>
          </div>
          <div className="rounded-3xl bg-white/10 p-5 ring-1 ring-white/20">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-200">Setup contoh</p>
            <div className="mt-4 space-y-3">
              {steps.map(([n, title]) => <div key={n} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-300 font-black text-indigo-950">{n}</span><span className="text-sm font-bold">{title}</span></div>)}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-16 px-4 py-12 sm:px-6">
        <section id="dashboard" data-tutorial-step="dashboard">
          <SectionTitle eyebrow="01 · Dashboard" title="Semua yang penting, sekali pandang" text="Ringkasan kredit, video, batch aktif dan jadual automasi pelanggan." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [CreditCard, 'Baki Kredit', '1,240', '10 kredit ditempah'],
              [Video, 'Video Siap', '38', '6 siap minggu ini'],
              [Repeat2, 'Batch Aktif', '2', '7 tugasan menunggu'],
              [CalendarClock, 'Auto Run Seterusnya', '9:00 pagi', 'Asia/Kuala_Lumpur'],
            ].map(([Icon, label, value, note]) => { const I = Icon as typeof CreditCard; return <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><I className="h-5 w-5 text-indigo-600" /><p className="mt-4 text-xs font-bold uppercase text-slate-500">{String(label)}</p><p className="mt-1 text-2xl font-black">{String(value)}</p><p className="mt-1 text-xs text-slate-500">{String(note)}</p></article>; })}
          </div>
        </section>

        <section id="profiles" data-tutorial-step="creator-profiles">
          <SectionTitle eyebrow="02 · Creator Profile Library" title="Simpan gaya creator sekali, guna berkali-kali" text="Creator Profile menyimpan identiti kreatif tanpa mengikatnya kepada satu produk tertentu." />
          <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
            <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-3">
                <img src="/official-assets/avatars/a01-aina-mesra.webp" alt="Avatar demo Aina Mesra" className="aspect-square w-full rounded-2xl object-cover" />
                <img src="/official-assets/backgrounds/thumbs/b01-ruang-tamu-beige.webp" alt="Latar demo ruang tamu beige" className="aspect-square w-full rounded-2xl object-cover" />
              </div>
              <div className="p-5"><div className="flex items-center justify-between"><h3 className="font-black">Aina · Lifestyle Santai</h3><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">DEFAULT</span></div><p className="mt-2 text-sm text-slate-600">Niche: lifestyle & rumah · Personaliti: mesra · CTA: Klik butang</p></div>
            </article>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                {['Nama profil: Aina · Lifestyle Santai', 'Voice: Mesra & natural', 'Dialog: Nexabot cipta ikut produk', 'CTA: Klik butang', 'Audio: Voice', 'Gaya default: NX01, NX09, NX17'].map((x) => <div key={x} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold">{x}</div>)}
              </div>
              <div className="mt-5 flex flex-wrap gap-2"><DemoButton>Edit</DemoButton><DemoButton>Duplicate</DemoButton><DemoButton primary>Simpan Profil</DemoButton></div>
            </div>
          </div>
        </section>

        <section id="products" data-tutorial-step="product-folders">
          <SectionTitle eyebrow="03 · Product Folders" title="Susun banyak produk dalam folder" text="Muat naik dari telefon, cari produk, pilih beberapa sekali gus dan simpan fakta produk yang telah disahkan." />
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><FolderOpen className="text-indigo-600" /><div><h3 className="font-black">Produk Affiliate November</h3><p className="text-xs text-slate-500">6 produk · 4 belum diproses</p></div></div><div className="flex gap-2"><DemoButton><Upload className="mr-2 h-4 w-4" />Muat Naik</DemoButton><DemoButton primary>Pilih Semua</DemoButton></div></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['NX01', 'Serum Wajah Premium', 'Belum diproses'], ['NX09', 'Lampu Meja Nova', '2 video siap'], ['NX17', 'Suplemen Harian', 'Belum diproses'], ['RH03', 'Pencuci Rumah', '1 video siap'],
              ].map(([poster, name, state]) => <article key={name} className="overflow-hidden rounded-2xl border border-slate-200"><img src={`/style-posters/${poster}.webp`} alt={`Contoh produk ${name}`} className="aspect-[4/3] w-full object-cover object-top" /><div className="p-3"><p className="font-bold">{name}</p><p className="mt-1 text-xs text-slate-500">{state}</p></div></article>)}
            </div>
          </div>
        </section>

        <section id="factory" data-tutorial-step="auto-factory">
          <SectionTitle eyebrow="04 · Auto Factory" title="Lima langkah untuk jana secara cloud" text="Pelanggan boleh menutup pelayar selepas memulakan batch. Queue dan cron meneruskan kerja di belakang tabir." />
          <div className="grid gap-4 lg:grid-cols-5">{steps.map(([n, title, text]) => <article key={n} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 font-black text-white">{n}</span><h3 className="mt-4 font-black">{title}</h3><p className="mt-2 text-xs leading-5 text-slate-600">{text}</p></article>)}</div>
          <div className="mt-5 rounded-3xl border border-indigo-200 bg-white p-6 shadow-sm">
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">Mode dipilih</p>
                <div className="mt-3 grid grid-cols-3 gap-2"><div className="rounded-xl border border-indigo-500 bg-indigo-50 p-3 text-center text-sm font-black text-indigo-700">Quick Bulk</div><div className="rounded-xl border p-3 text-center text-sm font-bold">Auto Mix</div><div className="rounded-xl border p-3 text-center text-sm font-bold">Daily Auto Run</div></div>
                <dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><dt className="text-slate-500">Produk dipilih</dt><dd className="text-right font-bold">4</dd><dt className="text-slate-500">Video / produk</dt><dd className="text-right font-bold">2</dd><dt className="text-slate-500">Jumlah video</dt><dd className="text-right font-bold">8</dd><dt className="text-slate-500">Kredit diperlukan</dt><dd className="text-right font-black text-indigo-700">80 kredit</dd></dl>
              </div>
              <div><p className="text-xs font-bold uppercase text-slate-500">Gaya dipilih</p><div className="mt-3 grid grid-cols-2 gap-3">{[['NX01','Sembang Santai'],['NX09','Review Jujur'],['NX17','Recommend'],['RH03','Ambient ASMR']].map(([id,name]) => <div key={id} className="flex items-center gap-3 rounded-xl border bg-slate-50 p-2"><img src={`/style-posters/${id}.webp`} alt={`Poster ${id}`} className="h-14 w-11 rounded-lg object-cover" /><div><p className="text-xs font-black">{id}</p><p className="text-xs text-slate-500">{name}</p></div></div>)}</div></div>
            </div>
            <div className="mt-6 flex items-center justify-between border-t pt-5"><p className="text-xs text-slate-500"><ShieldCheck className="mr-1 inline h-4 w-4 text-emerald-600" />Harga dan baki disahkan oleh server.</p><DemoButton primary><WandSparkles className="mr-2 h-4 w-4" />Mulakan Auto Run</DemoButton></div>
          </div>
        </section>

        <section data-tutorial-step="styles">
          <SectionTitle eyebrow="05 · 20 Gaya Rasmi" title="Pilih visual yang sesuai untuk setiap produk" text="Setiap job mengunci gaya pilihan sebelum dihantar supaya tetapan tidak berubah di tengah proses." />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{styles.map(([id, name]) => <article key={id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><img src={`/style-posters/${id}.webp`} alt={`Poster gaya ${id} ${name}`} className="aspect-[9/12] w-full object-cover" /><div className="p-3"><p className="text-xs font-black text-indigo-700">{id}</p><p className="mt-1 text-xs font-bold">{name}</p></div></article>)}</div>
        </section>

        <section id="queue" data-tutorial-step="queue">
          <SectionTitle eyebrow="06 · Smart Queue" title="Tinggalkan halaman—job tetap berjalan" text="Status sebenar disimpan dalam pangkalan data. Maksimum tiga job Nexabot aktif secara global dan selebihnya menunggu dengan selamat." />
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="grid grid-cols-[1.2fr_.8fr_.8fr] border-b bg-slate-50 px-5 py-3 text-xs font-bold uppercase text-slate-500"><span>Produk</span><span>Gaya</span><span>Status</span></div>
            {[
              ['Serum Wajah Premium', 'NX01', 'Sedang menjana video', 'indigo'],
              ['Lampu Meja Nova', 'NX09', 'Dalam giliran', 'amber'],
              ['Suplemen Harian', 'NX17', 'Video siap', 'emerald'],
              ['Pencuci Rumah', 'RH03', 'Retry provider dijadualkan', 'rose'],
            ].map(([product, style, status, color]) => <div key={product} className="grid grid-cols-[1.2fr_.8fr_.8fr] items-center border-b px-5 py-4 text-sm last:border-0"><span className="font-bold">{product}</span><span>{style}</span><span className={`w-fit rounded-full px-2 py-1 text-xs font-bold ${queueStatusClass[color]}`}>{status}</span></div>)}
          </div>
        </section>

        <section id="library" data-tutorial-step="video-library">
          <SectionTitle eyebrow="07 · Video Library" title="Semua video siap tersimpan secara automatik" text="Tapis mengikut folder, batch, Creator Profile, gaya atau tarikh; mainkan dan muat turun MP4 secara individu." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {['NX01','NX09','NX17','RH03'].map((id, i) => <article key={id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="relative"><img src={`/style-posters/${id}.webp`} alt={`Video Library demo ${id}`} className="aspect-[9/12] w-full object-cover" /><span className="absolute left-3 top-3 rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold text-white">15s · {id}</span><span className="absolute inset-0 grid place-items-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-white/90"><Play className="h-5 w-5 fill-indigo-600 text-indigo-600" /></span></span></div><div className="flex items-center justify-between p-3"><div><p className="text-sm font-bold">Video Batch #{1024 + i}</p><p className="text-xs text-slate-500">Siap · MP4</p></div><Download className="h-4 w-4 text-indigo-600" /></div></article>)}
          </div>
        </section>

        <section id="billing" data-tutorial-step="billing">
          <SectionTitle eyebrow="08 · Billing & Kredit" title="Semak keperluan kredit sebelum batch bermula" text="Setiap video Nexabot 15 saat menggunakan 10 kredit. Paparan ini ialah contoh sahaja dan tidak boleh membuat pesanan." />
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['Starter Creator', 'RM49', '500 kredit', '50 video'],
              ['Pro Creator', 'RM129', '2,000 kredit', '200 video'],
              ['Agency Studio', 'RM399', '8,000 kredit', '800 video'],
            ].map(([name, price, credits, videos], i) => <article key={name} className={`rounded-3xl border bg-white p-6 shadow-sm ${i === 1 ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'}`}><p className="font-black">{name}</p><p className="mt-4 text-3xl font-black">{price}</p><p className="mt-3 font-bold text-indigo-700">{credits} · {videos}</p><p className="mt-2 text-xs text-slate-500">Pembaharuan manual 30 hari</p><div className="mt-5"><DemoButton primary>Bayar Melalui QR</DemoButton></div></article>)}
          </div>
        </section>

        <section className="rounded-3xl bg-slate-950 p-7 text-white sm:p-10" data-tutorial-step="summary">
          <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto]">
            <div><p className="text-xs font-bold uppercase tracking-widest text-indigo-300">Ringkasan tutorial</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">Upload → Profile → Styles → Auto Run → Video siap</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">AffiMatik memproses batch dalam cloud, mengawal concurrency Nexabot, menyimpan MP4 secara private dan merekod kredit secara atomik. Pelanggan tidak perlu memasang extension atau membiarkan komputer hidup.</p></div>
            <Link href="#dashboard" className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-950">Ulang dari awal <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </div>
        </section>
      </div>

      <footer className="border-t bg-white px-4 py-8 text-center text-xs text-slate-500"><p><ShieldCheck className="mr-1 inline h-4 w-4 text-emerald-600" />Halaman tutorial awam · Tiada data pelanggan · Tiada tindakan production · Tidak memerlukan login</p></footer>
    </main>
  );
}
