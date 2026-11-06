'use client';

import { useEffect, useState } from 'react';

type Stats = {
  status: string;
  referralUrl: string;
  commissionRate: number;
  pendingCommissionsMyr: number;
  approvedCommissionsMyr: number;
  paidCommissionsMyr: number;
  availableCommissionsMyr: number;
  clicks: number;
  registrations: number;
  qualifiedCustomers: number;
  campaigns: Record<string, number>;
  outstandingClawbackMyr: number;
  commissionsHistory: Array<{ id: string; amountMyr: number; status: string; createdAt: string }>;
};

export default function AffiliatePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [payouts, setPayouts] = useState<{ availableMyr: number; destination: { bank: string; holder: string; maskedAccount: string } | null; requests: Array<{ id: string; amount_myr: number; status: string; requested_at: string }> } | null>(null);
  const [bank, setBank] = useState('');
  const [account, setAccount] = useState('');
  const [holder, setHolder] = useState('');
  const [campaign, setCampaign] = useState('');

  async function refresh() {
    const res = await fetch('/api/affiliate/stats', { cache: 'no-store' });
    if (!res.ok) throw new Error('Gagal memuatkan status affiliate.');
    setStats(await res.json());
    const payoutResponse = await fetch('/api/affiliate/payouts', { cache: 'no-store' });
    if (payoutResponse.ok) setPayouts(await payoutResponse.json());
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

  async function saveDestination() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/affiliate/stats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payoutBank: bank, payoutAccountNumber: account, payoutAccountHolder: holder }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Maklumat bank tidak dapat disimpan.');
      setAccount(''); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Gagal menyimpan.'); }
    finally { setBusy(false); }
  }

  async function requestPayout() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/affiliate/payouts', { method: 'POST' });
      if (!response.ok) throw new Error((await response.json()).error || 'Permintaan payout gagal.');
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Permintaan payout gagal.'); }
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
        <label className="block text-sm">Nama kempen (pilihan)<input maxLength={64} value={campaign} onChange={(event) => setCampaign(event.target.value)} placeholder="Contoh: TikTok November" className="mt-1 w-full rounded border p-2" /></label>
        <div className="flex flex-wrap gap-2 items-center"><input readOnly value={campaign.trim() ? `${stats.referralUrl}&campaign=${encodeURIComponent(campaign.trim())}` : stats.referralUrl} aria-label="Pautan rujukan" className="min-w-0 flex-1 rounded border p-2 text-sm" /><button type="button" onClick={() => navigator.clipboard.writeText(campaign.trim() ? `${stats.referralUrl}&campaign=${encodeURIComponent(campaign.trim())}` : stats.referralUrl)} className="rounded bg-indigo-600 px-3 py-2 text-white">Salin</button></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm"><p>Klik: {stats.clicks}</p><p>Daftar: {stats.registrations}</p><p>Pembeli layak: {stats.qualifiedCustomers}</p><p>Menunggu: RM{stats.pendingCommissionsMyr.toFixed(2)}</p><p>Sedia payout: RM{stats.availableCommissionsMyr.toFixed(2)}</p><p>Dibayar: RM{stats.paidCommissionsMyr.toFixed(2)}</p></div>
        {stats.outstandingClawbackMyr > 0 && <p className="text-sm text-red-700">Clawback refund belum dipulihkan: RM{stats.outstandingClawbackMyr.toFixed(2)}. Payout baharu disekat.</p>}
        <div className="text-sm"><h3 className="font-medium">Klik mengikut kempen</h3>{Object.entries(stats.campaigns).length ? <ul>{Object.entries(stats.campaigns).map(([name, count]) => <li key={name}>{name}: {count}</li>)}</ul> : <p className="text-slate-500">Belum ada klik.</p>}</div>
        <h2 className="font-semibold">Sejarah komisen</h2>
        {stats.commissionsHistory.length ? <ul className="space-y-2">{stats.commissionsHistory.map((item) => <li key={item.id} className="border-t pt-2 text-sm">{new Date(item.createdAt).toLocaleDateString('ms-MY')} · RM{item.amountMyr.toFixed(2)} · {item.status}</li>)}</ul> : <p className="text-sm text-slate-500">Belum ada komisen.</p>}
      </>}
    </div>}
    {stats?.status === 'APPROVED' && <section className="rounded-xl border bg-white p-5 space-y-3"><h2 className="font-semibold">Payout affiliate</h2><p className="text-sm">Komisen tersedia selepas 14 hari. Minimum permintaan RM50.</p><p className="text-sm">Destinasi: {payouts?.destination?.bank || 'Belum disimpan'} {payouts?.destination?.maskedAccount || ''} {payouts?.destination?.holder || ''}</p><div className="grid gap-2 sm:grid-cols-3"><input aria-label="Nama bank" placeholder="Nama bank" value={bank} onChange={(event) => setBank(event.target.value)} className="rounded border p-2 text-sm" /><input aria-label="Nombor akaun" placeholder="Nombor akaun" value={account} onChange={(event) => setAccount(event.target.value)} className="rounded border p-2 text-sm" /><input aria-label="Nama pemegang akaun" placeholder="Nama pemegang akaun" value={holder} onChange={(event) => setHolder(event.target.value)} className="rounded border p-2 text-sm" /></div><button type="button" disabled={busy || !bank || !account || !holder} onClick={saveDestination} className="rounded bg-slate-700 px-3 py-2 text-white text-sm disabled:opacity-50">Simpan destinasi</button><div><button type="button" disabled={busy || (payouts?.availableMyr || 0) < 50 || !payouts?.destination?.maskedAccount} onClick={requestPayout} className="rounded bg-indigo-600 px-4 py-3 text-white text-sm disabled:opacity-50">Mohon payout RM{(payouts?.availableMyr || 0).toFixed(2)}</button></div><h3 className="font-medium">Sejarah permintaan</h3>{payouts?.requests.length ? <ul className="text-sm space-y-1">{payouts.requests.map((request) => <li key={request.id}>RM{Number(request.amount_myr).toFixed(2)} · {request.status} · {new Date(request.requested_at).toLocaleDateString('ms-MY')}</li>)}</ul> : <p className="text-sm text-slate-500">Tiada permintaan.</p>}</section>}
  </div>;
}
