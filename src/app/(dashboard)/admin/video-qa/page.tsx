'use client';

import { useEffect, useState } from 'react';

type QaJob = {
  id: string;
  preset_id: string;
  provider: string;
  duration_seconds: number;
  actual_duration_seconds: number | null;
  output_has_audio: boolean | null;
  qa_started_at: string | null;
};

export default function VideoQaPage() {
  const [jobs, setJobs] = useState<QaJob[]>([]);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function refresh() {
    const response = await fetch('/api/admin/video-qa', { cache: 'no-store' });
    if (!response.ok) throw new Error('Senarai QA tidak tersedia.');
    setJobs((await response.json()).jobs);
  }

  useEffect(() => { refresh().catch((cause) => setError(cause.message)); }, []);

  async function decide(jobId: string, decision: 'APPROVE' | 'REJECT') {
    setBusy(jobId); setError('');
    try {
      const response = await fetch('/api/admin/video-qa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, decision, reason: reason[jobId] || '' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Keputusan gagal disimpan.');
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Keputusan gagal disimpan.'); }
    finally { setBusy(null); }
  }

  return <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-8">
    <h1 className="text-2xl font-bold">Semakan Kualiti Video</h1>
    <p className="text-sm text-slate-600">Tonton keseluruhan video dan dengar dialog sebelum meluluskan. Semak identiti produk, dakwaan, Bahasa Melayu, CTA dan grafik. Watermark rasmi pembekal dibenarkan. Penolakan melepaskan tempahan kredit pelanggan.</p>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    {jobs.length === 0 && !error && <p className="text-sm text-slate-600">Tiada video menunggu semakan.</p>}
    {jobs.map((job) => <section key={job.id} className="space-y-3 rounded-xl border bg-white p-4">
      <div className="text-sm font-semibold">{job.preset_id} · {job.provider} · {job.id}</div>
      <p className="text-xs text-slate-600">Sasaran {job.duration_seconds}s · Sebenar {job.actual_duration_seconds ?? 'belum diukur'}s · Audio {job.output_has_audio ? 'ada' : 'tiada'} · Menunggu sejak {job.qa_started_at || 'tidak diketahui'}</p>
      <video controls preload="metadata" playsInline className="max-h-[440px] w-full rounded-lg bg-black" src={`/api/videos/${job.id}/stream`} />
      <label className="block text-sm">Sebab atau nota QA
        <textarea value={reason[job.id] || ''} onChange={(event) => setReason({ ...reason, [job.id]: event.target.value })} maxLength={500} className="mt-1 min-h-20 w-full rounded-lg border p-2" placeholder="Wajib untuk penolakan" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy !== null} onClick={() => decide(job.id, 'APPROVE')} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Lulus & selesaikan kredit</button>
        <button disabled={busy !== null || !(reason[job.id] || '').trim()} onClick={() => decide(job.id, 'REJECT')} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Tolak & pulangkan tempahan</button>
      </div>
    </section>)}
  </main>;
}
