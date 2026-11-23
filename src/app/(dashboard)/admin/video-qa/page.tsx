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
type QualityFlag = {
  id: string; job_id: string; provider_task_id: string | null; asset_id: string;
  code: 'POST_CTA_SPEECH_REVIEW' | 'PRODUCT_FACT_REVIEW'; category: 'SPEECH' | 'PRODUCT_FACT';
  issue: string; start_seconds: number | null; end_seconds: number | null;
  transcript_evidence: string; created_at: string; reviewed_at: string | null;
  reviewed_by: string | null; review_note: string | null;
};

export default function VideoQaPage() {
  const [jobs, setJobs] = useState<QaJob[]>([]);
  const [flags, setFlags] = useState<QualityFlag[]>([]);
  const [flagForm, setFlagForm] = useState({ jobId: '', code: 'POST_CTA_SPEECH_REVIEW', issue: '', startSeconds: '', endSeconds: '', transcriptEvidence: '' });
  const [reason, setReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function refresh() {
    const [response, flagResponse] = await Promise.all([
      fetch('/api/admin/video-qa', { cache: 'no-store' }),
      fetch('/api/admin/video-qa/flags', { cache: 'no-store' }),
    ]);
    if (!response.ok || !flagResponse.ok) throw new Error('Senarai QA tidak tersedia.');
    setJobs((await response.json()).jobs);
    setFlags((await flagResponse.json()).flags);
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

  async function addFlag(event: React.FormEvent) {
    event.preventDefault(); setBusy('flag'); setError('');
    try {
      const response = await fetch('/api/admin/video-qa/flags', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...flagForm, startSeconds: flagForm.startSeconds || null, endSeconds: flagForm.endSeconds || null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Flag gagal disimpan.');
      setFlagForm({ jobId: '', code: 'POST_CTA_SPEECH_REVIEW', issue: '', startSeconds: '', endSeconds: '', transcriptEvidence: '' });
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Flag gagal disimpan.'); }
    finally { setBusy(null); }
  }

  async function markReviewed(flagId: string) {
    setBusy(flagId); setError('');
    try {
      const response = await fetch('/api/admin/video-qa/flags', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ flagId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Semakan gagal disimpan.');
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Semakan gagal disimpan.'); }
    finally { setBusy(null); }
  }

  return <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-8">
    <h1 className="text-2xl font-bold">Semakan Kualiti Video</h1>
    <p className="text-sm text-slate-600">Tonton keseluruhan video dan dengar dialog sebelum meluluskan. Semak identiti produk, dakwaan, Bahasa Melayu, CTA dan grafik. Watermark rasmi pembekal dibenarkan. Penolakan melepaskan tempahan kredit pelanggan.</p>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h2 className="font-semibold text-slate-900">Flag untuk semakan manusia</h2>
      <p className="text-sm text-slate-700">Flag hanya memberi amaran. Ia tidak menolak video, menukar keputusan owner atau menyentuh kredit. Semak MP4 dan bukti sebelum menandakan telah diteliti.</p>
      <form onSubmit={addFlag} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">ID job AffiMatik<input required value={flagForm.jobId} onChange={e => setFlagForm({ ...flagForm, jobId: e.target.value })} className="mt-1 w-full rounded-lg border p-2" placeholder="UUID job" /></label>
        <label className="text-sm">Jenis bukti<select value={flagForm.code} onChange={e => setFlagForm({ ...flagForm, code: e.target.value })} className="mt-1 w-full rounded-lg border p-2"><option value="POST_CTA_SPEECH_REVIEW">Ucapan selepas CTA</option><option value="PRODUCT_FACT_REVIEW">Fakta produk</option></select></label>
        <label className="text-sm">Mula (saat)<input type="number" min="0" max="60" step="0.01" value={flagForm.startSeconds} onChange={e => setFlagForm({ ...flagForm, startSeconds: e.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="text-sm">Tamat (saat)<input type="number" min="0" max="60" step="0.01" value={flagForm.endSeconds} onChange={e => setFlagForm({ ...flagForm, endSeconds: e.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label>
        <label className="text-sm sm:col-span-2">Isu yang dikesan<input required minLength={3} maxLength={400} value={flagForm.issue} onChange={e => setFlagForm({ ...flagForm, issue: e.target.value })} className="mt-1 w-full rounded-lg border p-2" placeholder="Contoh: CTA disebut dua kali" /></label>
        <label className="text-sm sm:col-span-2">Bukti transkrip<textarea required maxLength={1000} value={flagForm.transcriptEvidence} onChange={e => setFlagForm({ ...flagForm, transcriptEvidence: e.target.value })} className="mt-1 min-h-20 w-full rounded-lg border p-2" placeholder="Petikan ucapan sebenar yang perlu diteliti" /></label>
        <button disabled={busy !== null} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">Simpan flag tanpa menolak video</button>
      </form>
    </section>
    {flags.length > 0 && <section className="space-y-3"><h2 className="font-semibold text-slate-900">Bukti dan keputusan semakan</h2>{flags.map(flag => <article key={flag.id} className={`space-y-2 rounded-xl border p-4 ${flag.reviewed_at ? 'bg-white' : 'border-amber-300 bg-amber-50'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{flag.category === 'SPEECH' ? 'Ucapan selepas CTA' : 'Fakta produk'} · {flag.issue}</strong><span className="text-xs font-semibold">{flag.reviewed_at ? 'Telah diteliti' : 'Perlu semakan manusia'}</span></div>
      <p className="break-all text-xs text-slate-600">Job {flag.job_id} · Provider {flag.provider_task_id || 'tiada'} · Asset {flag.asset_id}</p>
      <p className="text-sm">{flag.start_seconds === null ? 'Masa tidak ditetapkan' : `${flag.start_seconds}s–${flag.end_seconds}s`} · “{flag.transcript_evidence}”</p>
      <video controls preload="metadata" playsInline className="max-h-[360px] w-full rounded-lg bg-black" src={`/api/videos/${flag.job_id}/stream`} />
      {flag.reviewed_at ? <p className="text-xs text-slate-600">Ditandakan telah diteliti pada {flag.reviewed_at}. Bukti asal dikekalkan.</p> : <button disabled={busy !== null} onClick={() => markReviewed(flag.id)} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Tandakan telah diteliti</button>}
    </article>)}</section>}
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
