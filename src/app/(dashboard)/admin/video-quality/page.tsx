'use client';

import { useEffect, useState } from 'react';

type Report = { id: string; job_id: string; style_id: string; provider: string; generation_at: string; category: string; description: string; status: string; admin_note: string; created_at: string };

export default function VideoQualityAdminPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  async function load() {
    const response = await fetch('/api/admin/video-quality', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Laporan tidak tersedia.');
    setReports(data.reports || []);
  }
  useEffect(() => { void load().catch(reason => setError(reason instanceof Error ? reason.message : 'Laporan tidak tersedia.')); }, []);
  async function save(report: Report) {
    setBusy(report.id); setError('');
    try {
      const response = await fetch('/api/admin/video-quality', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: report.id, status: report.status, adminNote: report.admin_note }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Semakan gagal.');
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Semakan gagal.'); }
    finally { setBusy(''); }
  }
  return <div className="space-y-5"><header><h1 className="text-2xl font-bold">Semakan Kualiti Video</h1><p className="mt-1 text-sm text-slate-600">Laporan pelanggan untuk semakan manusia. Menukar status tidak memberi kredit atau menjalankan retry.</p></header>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    {!reports.length && !error && <p className="rounded-xl border bg-white p-6 text-sm text-slate-600">Tiada laporan video.</p>}
    {reports.map(report => <article key={report.id} className="space-y-3 rounded-2xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><div><h2 className="font-semibold">{report.style_id} · {report.category}</h2><p className="text-xs text-slate-500">{report.provider} · {new Date(report.generation_at).toLocaleString('ms-MY')} · Tugasan {report.job_id}</p></div><span className="text-sm font-semibold">{report.status}</span></div><p className="text-sm">{report.description || 'Tiada butiran tambahan.'}</p><div className="grid gap-3 sm:grid-cols-[12rem_1fr_auto]"><select aria-label={`Status ${report.job_id}`} value={report.status} onChange={event=>setReports(current=>current.map(item=>item.id===report.id?{...item,status:event.target.value}:item))} className="rounded-lg border px-3 py-2 text-sm">{['OPEN','REVIEWING','RESOLVED','DISMISSED'].map(value=><option key={value}>{value}</option>)}</select><input aria-label={`Nota ${report.job_id}`} value={report.admin_note} onChange={event=>setReports(current=>current.map(item=>item.id===report.id?{...item,admin_note:event.target.value}:item))} maxLength={2000} placeholder="Nota semakan" className="rounded-lg border px-3 py-2 text-sm" /><button disabled={busy===report.id} onClick={()=>void save(report)} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Simpan</button></div></article>)}
  </div>;
}
