import React from 'react';
import { ShieldCheck, Activity, Database, Server, AlertTriangle } from 'lucide-react';

export default function AdminPage() {
  const providers = [
    { name: 'Nexabot Provider Adapter', type: '10s Spoken BM', status: 'Operational', latency: '420ms' },
    { name: 'RunningHub Provider Adapter', type: '15s WebApp #2103149871766220801', status: 'Operational', latency: '380ms' },
    { name: 'Cloudflare R2 Private Bucket', type: 'S3-Compatible Storage', status: 'Healthy', latency: '65ms' },
    { name: 'PostgreSQL Database & RLS', type: 'Supabase Engine', status: 'Connected', latency: '12ms' },
  ];

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-200">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Admin Control Center</h2>
        <p className="text-sm text-slate-500 mt-1">
          Kesihatan infrastruktur, pemantauan adapter AI, audit log keselamatan dan kawalan ciri.
        </p>
      </div>

      {/* Providers Health Table */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800">Status Kesihatan Komponen</span>
          <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Semua Sistem Normal
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {providers.map((p) => (
            <div key={p.name} className="px-6 py-4 flex items-center justify-between text-xs">
              <div>
                <div className="font-bold text-slate-900">{p.name}</div>
                <div className="text-[11px] text-slate-500">{p.type}</div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-slate-400 font-mono text-[11px]">{p.latency}</span>
                <span className="px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 text-[10px]">
                  {p.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
