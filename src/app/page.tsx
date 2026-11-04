'use client';

import React from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Video,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Gift,
  Zap,
  Play,
  Heart,
  HelpCircle,
  Lock,
} from 'lucide-react';
import { AUTHORITATIVE_PLANS, GENERATION_COSTS } from '@/lib/billing/plans';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <header className="h-16 border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-30 px-6 sm:px-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
              A
            </div>
            <div>
              <span className="font-extrabold text-slate-900 tracking-tight text-base sm:text-lg">AffiMatik</span>
              <span className="text-[10px] text-indigo-600 font-semibold ml-1.5 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 hidden sm:inline-block">
                by Pawarna
              </span>
            </div>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
          <Link href="#styles" className="hover:text-indigo-600 transition">Gaya Video</Link>
          <Link href="#how-it-works" className="hover:text-indigo-600 transition">Cara Guna</Link>
          <Link href="#pricing" className="hover:text-indigo-600 transition">Pelan (Coming Soon)</Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 transition"
          >
            Log Masuk
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5"
          >
            <Gift className="w-3.5 h-3.5 text-amber-300" />
            <span>Daftar FREE (50 Kredit)</span>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="py-16 sm:py-24 px-6 sm:px-10 max-w-5xl mx-auto text-center space-y-6">
          {/* Trial Highlight Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-indigo-50 via-purple-50 to-amber-50 border border-indigo-200 text-indigo-800 text-xs font-bold shadow-xs">
            <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
            <span>Daftar FREE & Dapat 50 Kredit Percuma</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-950 leading-[1.15]">
            Video Affiliate Jadi Mudah Dengan AffiMatik
          </h1>

          {/* Supporting Text */}
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Tak pandai shoot? Tak reti edit? Tak pandai tulis prompt? Upload gambar produk, pilih gaya dan biar AffiMatik bantu jana video.
          </p>

          {/* CTA Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-extrabold transition shadow-md hover:shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              <span>Cuba AffiMatik FREE</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/factory"
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 text-sm font-bold transition shadow-xs flex items-center justify-center gap-2"
            >
              <Video className="w-4 h-4 text-indigo-600" />
              <span>Lihat Studio Video Factory</span>
            </Link>
          </div>

          {/* Trust Note */}
          <p className="text-xs text-slate-400 font-medium pt-1">
            ✨ Tak perlu kad bank. Tak perlu langgan. Cuba dulu.
          </p>
        </section>

        {/* Engine Showcase Section */}
        <section id="styles" className="py-12 bg-white border-y border-slate-200 px-6 sm:px-10">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                Dua Enjin Video Pintar
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Pilih Gaya Bersuara Atau Sinematik Ambien
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
                Setiap video dijana mengikut format vertikal 9:16 siap sedia untuk TikTok, Reels, dan Shorts.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Voice Card */}
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-100/60 px-2.5 py-0.5 rounded-md">
                      10 Saat • 10 Kredit
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">Spoken Voiceover BM</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-3">AffiMatik Voice</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Pembentang AI bertutur dialek Bahasa Melayu Malaysia santai & mesra, lengkap dengan etika pemakaian sopan dan tudung labuh. Sesuai untuk gaya unboxing, review santai, dan hook padu.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>5 video penuh dengan 50 kredit percuma</span>
                  <Link href="/factory?engine=nexabot" className="text-indigo-600 hover:text-indigo-700">Pilih Gaya &rarr;</Link>
                </div>
              </div>

              {/* Motion Card */}
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-600 bg-purple-100/60 px-2.5 py-0.5 rounded-md">
                      15 Saat • 15 Kredit
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">Visual Realism & Ambience</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-3">AffiMatik Motion</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Pergerakan visual sinematik produk seperti pusingan 360°, slider sisi, pencahayaan dramatik studio dan aksi angkat-letak meja dengan kualiti tekstur realistik tinggi.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>3 video penuh dengan 50 kredit percuma</span>
                  <Link href="/factory?engine=runninghub" className="text-purple-600 hover:text-purple-700">Pilih Gaya &rarr;</Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-16 px-6 sm:px-10 max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Hanya 3 Langkah Mudah
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Affiliate jadi automatik tanpa perlu peralatan studio mahal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 font-extrabold text-sm flex items-center justify-center mx-auto">
                1
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Upload Gambar Produk</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Muat naik gambar produk anda. AI Creative Director akan mengekstrak butiran dan ciri unik produk secara automatik.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 font-extrabold text-sm flex items-center justify-center mx-auto">
                2
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Pilih Gaya & Skrip</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Pilih daripada 13 Gaya Video Rasmi (Voice 10s atau Motion 15s). Anda boleh pratonton video contoh dengan audio sebenar.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 font-extrabold text-sm flex items-center justify-center mx-auto">
                3
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Jana & Download MP4</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tekan Jana Video. Enjin awan memproses tugasan secara latar belakang. Siap terus tonton dan muat turun fail MP4 berkualiti tinggi.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing Coming Soon Section */}
        <section id="pricing" className="py-16 bg-slate-100/60 border-t border-slate-200 px-6 sm:px-10">
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Soft Launch Notice */}
            <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100 border-2 border-amber-300 text-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-3xl">😂</span>
                  <h3 className="text-lg sm:text-xl font-extrabold text-amber-950">
                    Duit korang simpan dulu. Kami belum nak ambil lagi. 😂
                  </h3>
                </div>
                <span className="self-start sm:self-auto text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-200/80 px-3 py-1 rounded-full border border-amber-300">
                  Pelan Berbayar — Coming Soon
                </span>
              </div>
              <p className="text-xs sm:text-sm text-amber-900 leading-relaxed max-w-3xl">
                Kami bagi 50 kredit FREE dulu. Korang cuba buat video puas-puas, tengok hasil dia. Bila dah jatuh cinta dengan AffiMatik, baru kita sembang pasal duit. 😎
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-4">
                <Link
                  href="/register"
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shadow-sm inline-flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Cuba FREE — Dapat 50 Kredit</span>
                </Link>
                <a
                  href="mailto:support@affimatik.online?subject=Pertanyaan%20Akses%20Awal%20AffiMatik"
                  className="text-xs font-semibold text-amber-900 hover:text-amber-950 underline decoration-amber-400 hover:decoration-amber-700 transition"
                >
                  Dah tak sabar nak upgrade? Hubungi team AffiMatik untuk akses awal.
                </a>
              </div>
            </div>

            {/* Plans Grid with Coming Soon Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {AUTHORITATIVE_PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                    <div className="mt-3 flex items-baseline">
                      <span className="text-3xl font-extrabold text-slate-900">{plan.priceFormatted}</span>
                      <span className="text-xs text-slate-500 ml-1">{plan.billingPeriod}</span>
                    </div>
                    <p className="text-xs font-semibold text-indigo-600 mt-2">
                      {plan.monthlyCredits} Kredit Sebulan
                    </p>

                    <ul className="mt-6 space-y-2.5 text-xs text-slate-600">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 space-y-2 text-center">
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                    >
                      Coming Soon — Simpan Duit Dulu 😆
                    </button>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Langganan belum dibuka untuk umum. Sementara tu, korang boleh cuba AffiMatik secara percuma.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 px-6 sm:px-10 text-center text-xs text-slate-500 space-y-2">
        <p className="font-semibold text-slate-700">
          AffiMatik by Pawarna Studio &copy; 2026. Hak Cipta Terpelihara.
        </p>
        <p className="text-[11px] text-slate-400">
          Platform penjanaan video AI berorientasikan affiliate pasaran Malaysia. Sifar tanda air, aurat terpelihara, dialog Bahasa Melayu asli.
        </p>
      </footer>
    </div>
  );
}
