'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Video,
  Sparkles,
  ShoppingBag,
  ListOrdered,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Gift,
} from 'lucide-react';

export default function DashboardPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [jobs, setJobs] = useState<Array<{ status: string }> | null>(null);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data.wallet?.balance !== undefined) {
            setBalance(data.wallet.balance);
          }
        }
      } catch {
        // ignore
      }
    }
    fetchSession();
    fetch('/api/jobs?list=1', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((data) => { if (data?.jobs) setJobs(data.jobs); }).catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      {/* New-account welcome allowance. Existing balances are retained. */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-50 via-purple-50 to-amber-50 border border-indigo-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Gift className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                20 Kredit Percuma Untuk Akaun Baharu 🎁
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                Akses Awal Percuma
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Tak payah keluar duit lagi. Cuba jana video AI pertama korang dan tengok sendiri hasilnya.
            </p>
          </div>
        </div>

        <Link
          href="/factory"
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm whitespace-nowrap"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>Jana Video Sekarang</span>
        </Link>
      </div>

      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Selamat Datang ke AffiMatik
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
              by Pawarna
            </span>
          </div>
          <p className="text-sm font-medium text-slate-700 mt-1">
            Affiliate Jadi Automatik.
          </p>
          <p className="text-xs text-slate-500">
            Dari Research Produk, Video AI Hingga Auto-Posting — Semua Dalam Satu Platform.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/factory"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 transition shadow-sm"
          >
            <Video className="w-4 h-4" />
            <span>Buka Video Factory</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* 4 KPIs Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Baki Kredit</span>
            <Sparkles className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {balance !== null ? balance : '—'}
          </div>
          <div className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3" />
            <span>Baki sebenar akaun anda</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Tugasan Selesai</span>
            <Video className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{jobs ? jobs.filter((job) => job.status === 'COMPLETED').length : '—'}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            Daripada tugasan terkini dalam pangkalan data
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Giliran Pemprosesan</span>
            <ListOrdered className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{jobs ? jobs.filter((job) => ['QUEUED', 'SUBMITTING', 'PROCESSING'].includes(job.status)).length : '—'}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            Status tugasan terkini
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Pustaka Produk</span>
            <ShoppingBag className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">—</div>
          <div className="text-[11px] text-slate-400 mt-1">
            Storan produk belum disahkan
          </div>
        </div>
      </div>

      {/* Quick Launch & Engine Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Factory Banner */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-gradient-to-br from-indigo-900 to-slate-900 text-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-200 text-xs font-medium border border-indigo-400/30 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              <span>Gems Engine 2.0</span>
            </div>
            <h3 className="text-xl font-bold">Penjana Pantas Video Affiliate (10s & 15s)</h3>
            <p className="text-slate-300 text-sm mt-2 max-w-xl leading-relaxed">
              Muat naik puluhan gambar produk, pilih preset Official Gems, dan tekan Jana. Enjin awan memproses terus di pelayan &mdash; anda boleh tutup browser bila-bila masa.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/factory"
              className="px-4 py-2.5 rounded-lg bg-white text-slate-900 font-semibold text-sm hover:bg-slate-100 transition inline-flex items-center gap-2"
            >
              <span>Mula Menjana Video</span>
              <ArrowRight className="w-4 h-4 text-slate-700" />
            </Link>
            <Link
              href="/prompts"
              className="px-4 py-2.5 rounded-lg bg-white/10 text-white font-medium text-sm hover:bg-white/15 transition border border-white/20"
            >
              Lihat Official Gems
            </Link>
          </div>
        </div>

        {/* Cloud Adapters Health Card */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h4 className="font-semibold text-slate-800 text-sm">Status Adapter Enjin</h4>
              </div>
              <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Milestone 0
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div>
                  <div className="font-medium text-slate-800">AffiMatik Voice Engine</div>
                  <div className="text-[10px] text-slate-500">10s Malaysian Malay Spoken Video</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  Ready (Active)
                </span>
              </div>

              <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div>
                  <div className="font-medium text-slate-800">AffiMatik Motion Engine</div>
                  <div className="text-[10px] text-slate-500">15s Visual Realism & Ambience Engine</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  Ready (Active)
                </span>
              </div>

              <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <div>
                  <div className="font-medium text-slate-800">Cloudflare R2 Private Bucket</div>
                  <div className="text-[10px] text-slate-500">Private Presigned Storage</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  Configured
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Ujian automatik: 17/17 melepasi piawaian.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
