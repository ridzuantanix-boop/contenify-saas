'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Job = { id: string; styleName: string; provider: string; status: string; createdAt: string; errorMessage?: string; videoUrl?: string; nextRetryAt?: string; retryCount?: number; providerRecoveryDeadline?: string };

export default function QueuePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const response = await fetch('/api/jobs?list=1', { cache: 'no-store' });
      if (!response.ok) throw new Error('Tugasan tidak dapat dimuatkan.');
      setJobs((await response.json()).jobs || []);
      setError('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Tugasan tidak tersedia.'); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const active = jobs.filter((job) => ['QUEUED', 'SUBMITTING', 'PROCESSING', 'QA_PENDING'].includes(job.status)).length;
  const recovering = jobs.filter((job) => job.status === 'SUBMITTING' && Boolean(job.nextRetryAt)).length;
  return <div className="space-y-5">
    <div className="flex flex-wrap justify-between gap-3 items-center"><div><h1 className="text-2xl font-bold">Production Queue</h1><p className="text-sm text-slate-600">{active} tugasan aktif · Data daripada rekod kerja akaun anda</p></div><button type="button" onClick={refresh} className="rounded-lg border bg-white px-4 py-2 text-sm">Segarkan</button></div>
    {recovering > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-bold">Pelayan AI sedang mengalami gangguan · {recovering} tugasan dalam Auto Retry</p><p className="mt-1 text-xs leading-relaxed">Tak perlu jana semula atau biarkan browser terbuka. AffiMatik akan cuba secara berkala di cloud sehingga Nexabot pulih. Tempahan kredit dibuat sekali sahaja dan tidak akan dicaj dua kali.</p></div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {loading && <p className="text-sm">Memuatkan tugasan…</p>}
    {!loading && !jobs.length && !error && <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-600">Belum ada tugasan. <Link href="/factory" className="text-indigo-700 underline">Jana video pertama</Link>.</div>}
    <div className="space-y-3">{jobs.map((job) => { const isRecovering=job.status==='SUBMITTING'&&Boolean(job.nextRetryAt); return <div key={job.id} className={`rounded-xl border bg-white p-4 flex flex-col sm:flex-row sm:justify-between gap-3 ${isRecovering?'border-amber-300 shadow-sm shadow-amber-100':''}`}>
      <div><p className="font-semibold">{job.styleName}</p><p className="text-xs text-slate-500">{job.provider} · {new Date(job.createdAt).toLocaleString('ms-MY')}</p>{job.errorMessage && <p className={`mt-2 text-sm ${isRecovering?'text-amber-800':'text-red-700'}`}>{job.errorMessage}</p>}{isRecovering&&<div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900"><p className="font-bold">Video anda masih aktif dan selamat.</p><p>Tak perlu buat apa-apa. Sistem cloud akan retry walaupun anda tutup browser.</p>{job.nextRetryAt&&<p className="mt-1 font-semibold">Cubaan seterusnya: {new Date(job.nextRetryAt).toLocaleString('ms-MY')}</p>}</div>}</div>
      <div className="text-sm sm:min-w-44 sm:text-right"><p className={`font-bold ${isRecovering?'text-amber-700':''}`}>{isRecovering ? 'Pelayan AI Terganggu · Auto Retry Aktif' : job.status === 'QA_PENDING' ? 'Menunggu semakan' : job.status === 'REJECTED' ? 'Tidak lulus QA' : job.status}</p>{isRecovering&&<p className="mt-1 text-xs text-slate-500">Cubaan ke-{job.retryCount||1} · kredit tidak dicaj dua kali</p>}{job.status === 'COMPLETED' && job.videoUrl && <a href={job.videoUrl} target="_blank" rel="noreferrer" className="text-indigo-700 underline">Lihat hasil</a>}{(job.status === 'FAILED' || job.status === 'REJECTED') && <p className="text-xs text-slate-500">Tempahan kredit dilepaskan; semak sejarah kredit.</p>}</div>
    </div>})}</div>
  </div>;
}
