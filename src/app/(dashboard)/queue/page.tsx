import React from 'react';
import { ListOrdered, Clock, CheckCircle2, AlertCircle, RefreshCw, XCircle } from 'lucide-react';

export default function QueuePage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Production Queue</h2>
          <p className="text-sm text-slate-500 mt-1">
            Status pemprosesan masa nyata dan giliran kerja awan. Tugasan diteruskan walaupun pelayar ditutup.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Queue Table */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800">Senarai Tugasan Video Awan</span>
          <span className="text-xs text-slate-400">0 Tugasan Aktif</span>
        </div>

        <div className="p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
            <ListOrdered className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-800">Tiada Tugasan Dalam Giliran</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Semua tugasan telah selesai atau belum dimulakan. Gunakan Video Factory untuk menjana batch video baharu.
          </p>
        </div>
      </div>
    </div>
  );
}
