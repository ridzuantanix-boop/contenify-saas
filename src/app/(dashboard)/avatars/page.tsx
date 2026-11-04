import React from 'react';
import { Users, Plus, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function AvatarsPage() {
  const officialAvatars = [
    { id: 'av_1', name: 'Aisyah (Muslimah Creator)', style: 'Tudung Bawal & Kasual', tag: 'Official Gem' },
    { id: 'av_2', name: 'Farah (UGC Reviewer)', style: 'Shawl Moden & Sopan', tag: 'Official Gem' },
    { id: 'av_3', name: 'Hafiz (Affiliate Male)', style: 'Kemeja Kasual Kemas', tag: 'Official Gem' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Avatar Library</h2>
          <p className="text-sm text-slate-500 mt-1">
            Identiti watak pencipta rasmi & peribadi berpandukan garis panduan kesopanan dan keizinan.
          </p>
        </div>

        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium text-xs hover:bg-indigo-700 transition">
          <Plus className="w-4 h-4" />
          <span>Muat Naik Avatar Sendiri</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {officialAvatars.map((av) => (
          <div key={av.id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {av.tag}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Keizinan Sah</span>
                </span>
              </div>
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 mb-3 text-lg border border-slate-200">
                {av.name.charAt(0)}
              </div>
              <h4 className="font-bold text-slate-900 text-sm">{av.name}</h4>
              <p className="text-xs text-slate-500 mt-0.5">{av.style}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              Sesuai untuk AffiMatik Voice & Motion
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
