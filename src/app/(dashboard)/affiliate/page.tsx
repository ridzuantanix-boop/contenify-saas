'use client';

import { useEffect, useState } from 'react';

type Stats = {
  status: string;
  referralUrl: string;
  commissionRate: number;
  pendingCommissionsMyr: number;
  approvedCommissionsMyr: number;
  paidCommissionsMyr: number;
  commissionsHistory: Array<{ id: string; amountMyr: number; status: string; createdAt: string }>;
};

export default function AffiliatePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    const res = await fetch('/api/affiliate/stats', { cache: 'no-store' });
    if (!res.ok) throw new Error('Gagal memuatkan status affiliate.');
    setStats(await res.json());
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, []);

  async function apply() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/affiliate/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acceptTerms: accepted }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Permohonan gagal.');
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Permohonan gagal.'); }
    finally { setBusy(false); }
  }

  return <div className="space-y-5 max-w-3xl">
    <div><h1 className="text-2xl font-bold">Program Affiliate</h1><p className="text-sm text-slate-600 mt-1">Keahlian ini memerlukan permohonan dan kelulusan berasingan daripada langganan pelanggan.</p></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!stats && !error && <p>Memuatkan status…</p>}
    {stats?.status === 'NOT_APPLIED' && <div className="rounded-xl border bg-white p-5 space-y-4">
      <p className="text-sm">Komisen 10% pada pembayaran pelan pertama pelanggan rujukan yang layak. Komisen ditahan 14 hari dan bayaran minimum RM50.</p>
      <label className="flex gap-3 text-sm"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>Saya memohon keahlian affiliate dan menerima terma program, termasuk semakan kelayakan dan kelulusan pentadbir.</span></label>
      <button type="button" onClick={apply} disabled={!accepted || busy} className="rounded-lg bg-indigo-600 px-4 py-3 text-white disabled:opacity-50">{busy ? 'Menghantar…' : 'Mohon Jadi Affiliate'}</button>
    </div>}
    {stats && stats.status !== 'NOT_APPLIED' && <div className="rounded-xl border bg-white p-5 space-y-3">
      <p className="font-semibold">Status: {stats.status}</p>
      {stats.status === 'PENDING' && <p className="text-sm text-slate-600">Permohonan sedang menunggu semakan pentadbir. Pautan rujukan belum aktif.</p>}
      {stats.status === 'APPROVED' && <>
        <p className="text-sm">Kadar komisen: {stats.commissionRate}%</p>
        <div className="flex flex-wrap gap-2 items-center"><input readOnly value={stats.referralUrl} aria-label="Pautan rujukan" className="min-w-0 flex-1 rounded border p-2 text-sm" /><button type="button" onClick={() => navigator.clipboard.writeText(stats.referralUrl)} className="rounded bg-indigo-600 px-3 py-2 text-white">Salin</button></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm"><p>Menunggu: RM{stats.pendingCommissionsMyr.toFixed(2)}</p><p>Layak: RM{stats.approvedCommissionsMyr.toFixed(2)}</p><p>Dibayar: RM{stats.paidCommissionsMyr.toFixed(2)}</p></div>
        <h2 className="font-semibold">Sejarah komisen</h2>
        {stats.commissionsHistory.length ? <ul className="space-y-2">{stats.commissionsHistory.map((item) => <li key={item.id} className="border-t pt-2 text-sm">{new Date(item.createdAt).toLocaleDateString('ms-MY')} · RM{item.amountMyr.toFixed(2)} · {item.status}</li>)}</ul> : <p className="text-sm text-slate-500">Belum ada komisen.</p>}
      </>}
    </div>}
  </div>;
}
