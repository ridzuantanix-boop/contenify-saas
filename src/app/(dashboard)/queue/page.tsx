'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Job = { id: string; styleName: string; provider: string; status: string; createdAt: string; errorMessage?: string; videoUrl?: string };

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

  const active = jobs.filter((job) => ['QUEUED', 'SUBMITTING', 'PROCESSING'].includes(job.status)).length;
  return <div className="space-y-5">
    <div className="flex flex-wrap justify-between gap-3 items-center"><div><h1 className="text-2xl font-bold">Production Queue</h1><p className="text-sm text-slate-600">{active} tugasan aktif · Data daripada rekod kerja akaun anda</p></div><button type="button" onClick={refresh} className="rounded-lg border bg-white px-4 py-2 text-sm">Segarkan</button></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {loading && <p className="text-sm">Memuatkan tugasan…</p>}
    {!loading && !jobs.length && !error && <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-600">Belum ada tugasan. <Link href="/factory" className="text-indigo-700 underline">Jana video pertama</Link>.</div>}
    <div className="space-y-3">{jobs.map((job) => <div key={job.id} className="rounded-xl border bg-white p-4 flex flex-col sm:flex-row sm:justify-between gap-2">
      <div><p className="font-semibold">{job.styleName}</p><p className="text-xs text-slate-500">{job.provider} · {new Date(job.createdAt).toLocaleString('ms-MY')}</p>{job.errorMessage && <p className="text-sm text-red-700 mt-2">{job.errorMessage}</p>}</div>
      <div className="text-sm sm:text-right"><p className="font-semibold">{job.status}</p>{job.status === 'COMPLETED' && job.videoUrl && <a href={job.videoUrl} target="_blank" rel="noreferrer" className="text-indigo-700 underline">Lihat hasil</a>}{job.status === 'FAILED' && <p className="text-xs text-slate-500">Semak kredit dipulangkan sebelum mencuba semula.</p>}</div>
    </div>)}</div>
  </div>;
}
