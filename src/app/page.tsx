'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, CheckCircle2, Clock3, Download, Layers3, Play, ShieldCheck, Sparkles, Upload, WandSparkles, Zap } from 'lucide-react';
import { AUTHORITATIVE_PLANS, LAUNCH_PACK, effectiveMyrPerVideo } from '@/lib/billing/plans';

const demos = [
  { id: 'NX17', title: 'Recommend Secara Spontan', copy: 'Gaya creator yang nampak natural dan terus kepada sebab produk itu relevan.' },
  { id: 'NX01', title: 'Sembang Kawan Santai', copy: 'Penyampaian Bahasa Melayu Malaysia yang mesra dan tidak kedengaran terlalu menjual.' },
  { id: 'RH03', title: 'Ambient Product ASMR', copy: 'Visual produk yang bersih untuk kandungan tanpa dialog dan variasi feed.' },
];

const benefits = [
  { icon: Upload, title: 'Upload gambar sahaja', copy: 'Tak perlu rakam diri, susun studio atau belajar menulis prompt yang panjang.' },
  { icon: WandSparkles, title: '20 gaya siap pilih', copy: 'Daripada soft sell dan creator review hingga product handling dan visual ASMR.' },
  { icon: Bot, title: 'AI bina video lengkap', copy: 'Nexabot mentafsir produk, merancang adegan dan mencipta dialog mengikut gaya pilihan.' },
  { icon: Download, title: 'Terus dapat MP4', copy: 'Video siap disimpan dalam Video Library dan boleh dimuat turun untuk kegunaan anda.' },
  { icon: Layers3, title: 'Bulk & Auto Mix', copy: 'Pilih banyak produk dan biarkan AffiMatik mengurus batch melalui cloud queue.' },
  { icon: Clock3, title: 'Daily Auto Run', copy: 'Jadualkan penghasilan video harian tanpa browser atau komputer perlu sentiasa terbuka.' },
];

export default function LandingPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('ref');
    const campaign = params.get('campaign');
    if (code && /^[A-Za-z0-9_-]{4,50}$/.test(code)) {
      fetch(`/api/affiliate/visit?code=${encodeURIComponent(code)}${campaign ? `&campaign=${encodeURIComponent(campaign.slice(0, 64))}` : ''}`, { cache: 'no-store' }).catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f7fb] text-slate-950 selection:bg-violet-600 selection:text-white">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-sm font-black text-white shadow-lg shadow-violet-200">A</span>
            <span className="text-lg font-black tracking-tight">AffiMatik</span>
            <span className="hidden rounded-full bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700 sm:inline">by Pawarna</span>
          </Link>
          <nav className="hidden items-center gap-7 text-xs font-bold text-slate-600 md:flex">
            <Link href="#demo" className="hover:text-violet-700">Lihat Demo</Link>
            <Link href="#features" className="hover:text-violet-700">Apa Anda Dapat</Link>
            <Link href="#pricing" className="hover:text-violet-700">Harga</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="px-3 py-2 text-xs font-bold text-slate-700">Log Masuk</Link>
            <Link href="/register" className="rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-violet-700">Grab RM19</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20">
          <div className="absolute inset-x-0 top-0 -z-10 h-[540px] bg-[radial-gradient(circle_at_50%_0%,rgba(124,58,237,0.17),transparent_64%)]" />
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-extrabold text-violet-700 shadow-sm"><Sparkles className="h-4 w-4" /> Launch Pack: 15 video hanya RM19</div>
              <h1 className="max-w-3xl text-4xl font-black leading-[1.08] tracking-[-0.04em] sm:text-6xl">Dari gambar produk kepada video affiliate—<span className="bg-gradient-to-r from-violet-700 to-indigo-600 bg-clip-text text-transparent"> tanpa shoot, edit atau pening fikir skrip.</span></h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">Upload gambar, pilih gaya dan tekan Jana. AffiMatik mengurus dialog, visual, cloud queue dan MP4 anda—sesuai untuk affiliate yang perlu hasilkan content dengan konsisten.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-7 text-sm font-black text-white shadow-xl shadow-violet-200 transition hover:-translate-y-0.5 hover:bg-violet-700">Dapatkan 15 Video — RM19 <ArrowRight className="h-4 w-4" /></Link>
                <Link href="#demo" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-800 shadow-sm"><Play className="h-4 w-4 fill-violet-600 text-violet-600" /> Tengok Hasil Dulu</Link>
              </div>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> 150 kredit</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Sah 180 hari</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Bayaran sekali sahaja</span>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-lg">
              <div className="absolute -inset-5 -z-10 rounded-[36px] bg-gradient-to-br from-violet-200/60 to-indigo-100/40 blur-2xl" />
              <div className="overflow-hidden rounded-[28px] border border-white bg-slate-950 p-2 shadow-2xl"><video className="aspect-[9/12] w-full rounded-[22px] object-cover" src="/api/style-samples/NX17" poster="/style-posters/NX17.webp" controls playsInline preload="metadata" /></div>
              <div className="absolute -bottom-5 left-4 right-4 rounded-2xl border border-white/80 bg-white/95 p-4 shadow-xl backdrop-blur sm:left-8 sm:right-8"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black">Recommend Secara Spontan</p><p className="mt-0.5 text-xs text-slate-500">15 saat · Voice · MP4</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-extrabold text-emerald-700">Demo sebenar</span></div></div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white px-5 py-8 sm:px-8"><div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 text-center sm:grid-cols-4">{[['20','Gaya video'],['15s','Setiap video'],['9:16','Format vertikal'],['Cloud','Terus berjalan']].map(([value,label]) => <div key={label}><p className="text-2xl font-black text-violet-700 sm:text-3xl">{value}</p><p className="mt-1 text-xs font-bold text-slate-500">{label}</p></div>)}</div></section>

        <section id="demo" className="px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-violet-700">Tekan play. Nilai sendiri.</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Bukan template kosong. Ini contoh video AffiMatik.</h2><p className="mt-4 text-sm leading-6 text-slate-600">Hasil AI boleh berbeza mengikut produk dan gaya. Tiga demo ini menunjukkan pilihan penyampaian yang tersedia dalam studio.</p></div>
            <div className="mt-10 grid gap-6 md:grid-cols-3">{demos.map(demo => <article key={demo.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><video className="aspect-[9/12] w-full bg-slate-950 object-cover" src={`/api/style-samples/${demo.id}`} poster={`/style-posters/${demo.id}.webp`} controls playsInline preload="metadata" /><div className="p-5"><p className="text-[11px] font-black text-violet-700">{demo.id} · 15 SAAT</p><h3 className="mt-1 text-lg font-black">{demo.title}</h3><p className="mt-2 text-xs leading-5 text-slate-600">{demo.copy}</p></div></article>)}</div>
          </div>
        </section>

        <section id="features" className="bg-slate-950 px-5 py-16 text-white sm:px-8 sm:py-24">
          <div className="mx-auto max-w-7xl"><div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <div><p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">Satu sistem, bukan satu video sahaja</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Content factory yang terus bekerja walaupun browser ditutup.</h2><p className="mt-5 text-sm leading-7 text-slate-300">Buat satu video secara pantas, atau susun banyak produk dalam folder dan jalankan batch melalui cloud. Kerja kekal tersimpan dan video siap masuk ke library anda.</p><Link href="/register" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-xs font-black text-slate-950">Mula dengan Launch Pack <ArrowRight className="h-4 w-4" /></Link></div>
            <div className="grid gap-4 sm:grid-cols-2">{benefits.map(({ icon: Icon, title, copy }) => <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5"><Icon className="h-5 w-5 text-violet-300" /><h3 className="mt-4 text-sm font-black">{title}</h3><p className="mt-2 text-xs leading-5 text-slate-400">{copy}</p></div>)}</div>
          </div></div>
        </section>

        <section className="px-5 py-16 sm:px-8 sm:py-24"><div className="mx-auto max-w-6xl"><div className="text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-violet-700">Cara paling ringkas</p><h2 className="mt-3 text-3xl font-black">Upload. Pilih. Jana.</h2></div><div className="mt-10 grid gap-5 md:grid-cols-3">{[
          ['01','Masukkan produk','Upload gambar produk atau susun banyak produk dalam Product Folder.'],
          ['02','Pilih cara content','Gunakan Quick Create, avatar sendiri, preset, Quick Bulk atau Auto Mix.'],
          ['03','Biarkan cloud bekerja','Semak kredit, tekan Jana dan kembali bila MP4 sudah tersedia dalam Video Library.'],
        ].map(([number,title,copy]) => <div key={number} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><span className="text-3xl font-black text-violet-200">{number}</span><h3 className="mt-5 text-lg font-black">{title}</h3><p className="mt-2 text-xs leading-5 text-slate-600">{copy}</p></div>)}</div></div></section>

        <section id="pricing" className="border-y border-violet-200 bg-gradient-to-b from-violet-50 to-white px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-violet-700">Mula kecil. Naik taraf bila perlu.</p><h2 className="mt-3 text-3xl font-black sm:text-4xl">Grab 15 video pertama pada RM1.27/video</h2><p className="mt-4 text-sm text-slate-600">Launch Pack tidak mengaktifkan langganan bulanan. Kredit sah selama 180 hari.</p></div>
            <div className="mx-auto mt-10 max-w-3xl rounded-[30px] border-2 border-violet-500 bg-white p-7 shadow-xl shadow-violet-100 sm:p-9"><div className="flex flex-col justify-between gap-7 sm:flex-row sm:items-center">
              <div><span className="rounded-full bg-violet-600 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">Pilihan mula</span><h3 className="mt-4 text-2xl font-black">{LAUNCH_PACK.name}</h3><p className="mt-2 text-sm text-slate-600">{LAUNCH_PACK.credits} kredit · 15 video · sah {LAUNCH_PACK.validityDays} hari</p><ul className="mt-5 space-y-2 text-xs font-semibold text-slate-700"><li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Semua 20 gaya video</li><li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Personalization dan Cloud Auto Factory</li><li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Bayaran sekali sahaja</li></ul></div>
              <div className="sm:text-right"><p className="text-5xl font-black">{LAUNCH_PACK.priceFormatted}</p><p className="mt-1 text-xs font-bold text-emerald-700">RM{LAUNCH_PACK.effectiveMyrPerVideo.toFixed(2)} / video</p><Link href="/register" className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 text-sm font-black text-white sm:w-auto">Grab Launch Pack <Zap className="h-4 w-4" /></Link></div>
            </div></div>
            <div className="mt-8 grid gap-5 md:grid-cols-3">{AUTHORITATIVE_PLANS.map(plan => <article key={plan.id} className={`rounded-3xl border bg-white p-6 ${plan.isPopular ? 'border-violet-500 shadow-lg shadow-violet-100' : 'border-slate-200'}`}>{plan.isPopular && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black text-violet-700">PALING POPULAR</span>}<h3 className="mt-3 text-lg font-black">{plan.name}</h3><p className="mt-3 text-3xl font-black">{plan.priceFormatted}<span className="text-xs font-semibold text-slate-500"> {plan.billingPeriod}</span></p><p className="mt-2 text-xs font-bold text-violet-700">{plan.monthlyCredits.toLocaleString()} kredit · hingga {plan.voiceVideoAllowance} video</p><p className="mt-1 text-[11px] text-emerald-700">± RM{effectiveMyrPerVideo(plan).toFixed(2)} / video</p><Link href="/register" className="mt-6 flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xs font-black text-slate-800">Daftar & Pilih Pelan</Link></article>)}</div>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-8 sm:py-24"><div className="mx-auto max-w-4xl rounded-[32px] bg-gradient-to-br from-violet-700 to-indigo-700 px-6 py-12 text-center text-white shadow-2xl shadow-violet-200 sm:px-12"><ShieldCheck className="mx-auto h-9 w-9 text-violet-200" /><h2 className="mt-4 text-3xl font-black">Produk dah ada. Sekarang masa hasilkan content.</h2><p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-violet-100">Daftar akaun, dapatkan Launch Pack dan mula bina video affiliate pertama anda dalam AffiMatik.</p><Link href="/register" className="mt-7 inline-flex min-h-13 items-center gap-2 rounded-2xl bg-white px-7 text-sm font-black text-violet-700">Grab 15 Video — RM19 <ArrowRight className="h-4 w-4" /></Link></div></section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-5 py-9 text-center text-xs text-slate-500"><p className="font-bold text-slate-700">AffiMatik by Pawarna Studio © 2026</p><p className="mx-auto mt-2 max-w-2xl text-[11px] leading-5">Hasil video AI boleh berbeza mengikut imej, arahan dan keadaan provider. Semak kandungan sebelum diterbitkan. RunningHub kekal tidak aktif.</p></footer>
    </div>
  );
}
