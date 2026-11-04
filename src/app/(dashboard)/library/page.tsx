import React from 'react';
import { Film, Download, Play, Filter, Copy, CheckCircle2 } from 'lucide-react';

export default function LibraryPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Video Library</h2>
          <p className="text-sm text-slate-500 mt-1">
            Galeri video MP4 siap yang telah disahkan dan disimpan dengan selamat di storan peribadi Cloudflare R2.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Filter className="w-3.5 h-3.5" />
            <span>Tapis Mengikut Produk</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
          <Film className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-slate-800">Pustaka Video Masih Kosong</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Video yang berjaya disahkan dan dimuat turun daripada enjin AffiMatik Voice atau Motion akan dipaparkan di sini.
        </p>
      </div>
    </div>
  );
}
