'use client';

import { useEffect, useState } from 'react';

type Application = { id: string; userId: string; status: string; appliedAt?: string };
type Payout = { id: string; amount_myr: number; status: string; requested_at: string; affiliate_partners?: { user_id: string; payout_bank: string; payout_account_number: string; payout_account_holder: string } };

export default function AdminAffiliatesPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [payouts, setPayouts] = useState<Payout[]>([]);

  async function refresh() {
    const response = await fetch('/api/admin/affiliates', { cache: 'no-store' });
    if (!response.ok) throw new Error('Senarai permohonan tidak tersedia.');
    setApplications((await response.json()).applications);
    const payoutResponse = await fetch('/api/admin/affiliate-payouts', { cache: 'no-store' });
    if (!payoutResponse.ok) throw new Error('Senarai payout tidak tersedia.');
    setPayouts((await payoutResponse.json()).requests);
  }

  async function reviewPayout(id: string, action: 'APPROVED' | 'PAID' | 'REJECTED') {
    const reference = action === 'PAID' ? window.prompt('Masukkan rujukan transaksi bank sebenar:') : null;
    if (action === 'PAID' && !reference?.trim()) return;
    setBusy(id); setError('');
    try {
      const response = await fetch('/api/admin/affiliate-payouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, reference }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Semakan payout gagal.');
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Semakan payout gagal.'); }
    finally { setBusy(''); }
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
    <h2 className="text-xl font-bold pt-4">Permintaan payout</h2>
    <div className="space-y-3">{payouts.map((item) => <article key={item.id} className="rounded-xl border bg-white p-4 flex flex-col sm:flex-row gap-3 sm:justify-between"><div className="text-sm"><p className="font-semibold">RM{Number(item.amount_myr).toFixed(2)} · {item.status}</p><p>{item.affiliate_partners?.user_id}</p><p>{item.affiliate_partners?.payout_bank} · {item.affiliate_partners?.payout_account_holder} · {item.affiliate_partners?.payout_account_number}</p><p>{new Date(item.requested_at).toLocaleDateString('ms-MY')}</p></div><div className="flex gap-2 flex-wrap">{item.status === 'REQUESTED' && <><button disabled={busy === item.id} onClick={() => reviewPayout(item.id, 'APPROVED')} className="rounded bg-emerald-700 px-3 py-2 text-white">Lulus</button><button disabled={busy === item.id} onClick={() => reviewPayout(item.id, 'REJECTED')} className="rounded bg-slate-700 px-3 py-2 text-white">Tolak</button></>}{item.status === 'APPROVED' && <button disabled={busy === item.id} onClick={() => reviewPayout(item.id, 'PAID')} className="rounded bg-indigo-700 px-3 py-2 text-white">Rekod Dibayar</button>}</div></article>)}</div>
    {!payouts.length && <p className="text-sm text-slate-500">Tiada permintaan payout.</p>}
  </div>;
}
