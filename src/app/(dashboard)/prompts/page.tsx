import React from 'react';
import { OFFICIAL_GEMS_PRESETS } from '@/lib/gems/presets';
import { Sparkles, Copy, Check, Clock } from 'lucide-react';

export default function PromptsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Prompt Library & Official Gems</h2>
          <p className="text-sm text-slate-500 mt-1">
            Koleksi templat dan formula prompt rasmi Malaysia untuk menghasilkan visual dan audio berkualiti tinggi.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {OFFICIAL_GEMS_PRESETS.map((preset) => (
          <div key={preset.id} className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">{preset.name}</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {preset.targetDurationSeconds} Saat
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{preset.description}</p>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] font-mono text-slate-700">
              {preset.templateText}
            </div>
            <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Peraturan: {preset.systemRules.slice(0, 50)}...</span>
              <span className="text-indigo-600 font-medium">Versi {preset.version}.0</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
