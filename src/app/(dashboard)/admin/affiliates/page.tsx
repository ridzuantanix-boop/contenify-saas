'use client';

import { useEffect, useState } from 'react';

type Application = { id: string; userId: string; status: string; appliedAt?: string };

export default function AdminAffiliatesPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  async function refresh() {
    const response = await fetch('/api/admin/affiliates', { cache: 'no-store' });
    if (!response.ok) throw new Error('Senarai permohonan tidak tersedia.');
    setApplications((await response.json()).applications);
  }
  useEffect(() => { refresh().catch((err) => setError(err.message)); }, []);

  async function review(id: string, status: 'APPROVED' | 'REJECTED' | 'SUSPENDED') {
    setBusy(id);
    setError('');
    try {
      const response = await fetch('/api/admin/affiliates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Semakan gagal.');
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Semakan gagal.'); }
    finally { setBusy(''); }
  }

  return <div className="space-y-5">
    <h1 className="text-2xl font-bold">Permohonan Affiliate</h1>
    <p className="text-sm text-slate-600">Kelulusan hanya untuk pemilik sistem. Akaun yang membeli pelan tidak didaftarkan secara automatik.</p>
    {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}
    <div className="space-y-3">{applications.map((item) => <div key={item.id} className="rounded-xl border bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
      <div><p className="font-semibold break-all">{item.userId}</p><p className="text-sm text-slate-600">{item.status} · {item.appliedAt ? new Date(item.appliedAt).toLocaleDateString('ms-MY') : 'Tarikh tidak tersedia'}</p></div>
      <div className="flex gap-2 flex-wrap">{item.status === 'PENDING' && <><button disabled={busy === item.id} onClick={() => review(item.id, 'APPROVED')} className="rounded bg-emerald-700 px-3 py-2 text-white">Lulus</button><button disabled={busy === item.id} onClick={() => review(item.id, 'REJECTED')} className="rounded bg-slate-700 px-3 py-2 text-white">Tolak</button></>}{item.status === 'APPROVED' && <button disabled={busy === item.id} onClick={() => review(item.id, 'SUSPENDED')} className="rounded bg-red-700 px-3 py-2 text-white">Gantung</button>}</div>
    </div>)}</div>
    {!applications.length && !error && <p className="text-sm text-slate-500">Tiada permohonan direkodkan.</p>}
  </div>;
}
