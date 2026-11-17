'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Stats = {
  status: string;
  hasEverQualifiedPaidSubscription: boolean;
  canApply: boolean;
  lifetimeAccess: boolean;
  affiliateUsername: string;
  legacyReferralUrl: string;
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
  const [username, setUsername] = useState('');

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
        body: JSON.stringify({ acceptTerms: accepted, username }),
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
    <div><h1 className="text-2xl font-bold">Langgan Sekali. Jadi Affiliate Selamanya.</h1><p className="text-sm text-slate-600 mt-1">Langgan mana-mana pelan AffiMatik yang layak sekali sahaja, kemudian mohon menjadi affiliate. Selepas diluluskan, kongsi link referral menggunakan username pilihan anda dan jana komisen daripada pembelian pelanggan baharu yang layak. Tidak perlu renew subscription untuk terus menjadi affiliate.</p><p className="mt-2 text-xs text-slate-500">Kelulusan dan pematuhan terma program masih diperlukan. Akaun boleh digantung bagi fraud atau pelanggaran serius.</p></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!stats && !error && <p>Memuatkan status…</p>}
    {stats?.status === 'NOT_APPLIED' && !stats.hasEverQualifiedPaidSubscription && <div className="rounded-xl border bg-white p-5 space-y-4">
      <p className="font-semibold">Langganan berbayar diperlukan sekali sahaja</p><p className="text-sm">Untuk menjadi Affiliate AffiMatik, anda hanya perlu melanggan mana-mana pelan berbayar sekali sahaja. Selepas diluluskan, keahlian affiliate kekal aktif walaupun anda tidak memperbaharui langganan.</p>
      <p className="text-xs text-slate-500">Launch Pack, top-up, kredit promosi dan akses percuma tidak dikira sebagai subscription yang layak.</p>
      <Link href="/billing" className="inline-flex rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white">Lihat Pelan Langganan</Link>
    </div>}
    {stats?.status === 'NOT_APPLIED' && stats.hasEverQualifiedPaidSubscription && <div className="rounded-xl border bg-white p-5 space-y-4">
      <p className="text-sm">Komisen 20% bagi pembelian pelanggan rujukan yang layak. Komisen ditahan 14 hari dan minimum payout RM50.</p>
      <label className="block text-sm font-medium">Pilih username referral<input aria-label="Username affiliate" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))} placeholder="contoh: creator88" minLength={3} maxLength={20} className="mt-1 w-full rounded border p-3" /></label>
      <p className="text-xs text-slate-500">3–20 aksara: huruf kecil, nombor dan _. Username menjadi identifier kekal selepas diluluskan.</p>
      <label className="flex gap-3 text-sm"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>Saya memohon keahlian affiliate dan menerima terma program, termasuk semakan kelayakan dan kelulusan pentadbir.</span></label>
      <button type="button" onClick={apply} disabled={!accepted || username.length < 3 || busy} className="rounded-lg bg-indigo-600 px-4 py-3 text-white disabled:opacity-50">{busy ? 'Menghantar…' : 'Mohon Jadi Affiliate'}</button>
    </div>}
    {stats && stats.status !== 'NOT_APPLIED' && <div className="rounded-xl border bg-white p-5 space-y-3">
      <p className="font-semibold">Status: {stats.status}</p>
      {stats.status === 'PENDING' && <p className="text-sm text-slate-600">Permohonan sedang menunggu semakan pentadbir. Pautan rujukan belum aktif.</p>}
      {stats.status === 'APPROVED' && <>
        <p className="text-sm text-emerald-700">Keahlian affiliate kekal aktif walaupun subscription tamat atau dibatalkan. Penggantungan hanya dibuat berasingan bagi fraud atau pelanggaran program.</p>
        {!stats.affiliateUsername && <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 space-y-2"><p className="text-sm font-medium">Tuntut username referral kekal (sekali sahaja)</p><input aria-label="Username affiliate" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))} placeholder="contoh: pawarna" className="w-full rounded border p-2" /><label className="flex gap-2 text-xs"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />Saya menerima terma username affiliate.</label><button type="button" onClick={apply} disabled={!accepted || username.length < 3 || busy} className="rounded bg-violet-700 px-3 py-2 text-sm text-white disabled:opacity-50">Tuntut username</button></div>}
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
    <section className="rounded-xl border bg-white p-5 text-sm space-y-2"><h2 className="font-semibold">Soalan ringkas</h2><p><strong>Perlu renew?</strong> Tidak. Selepas subscription layak dibayar sekali dan permohonan diluluskan, status affiliate tidak bergantung pada subscription aktif.</p><p><strong>Launch Pack atau top-up dikira?</strong> Tidak untuk kelayakan memohon.</p><p><strong>Boleh tukar username?</strong> Tidak untuk V1. Kod lama affiliate sedia ada terus berfungsi sebagai alias.</p><p><strong>Boleh digantung?</strong> Ya, secara berasingan bagi fraud atau pelanggaran serius terma program.</p></section>
  </div>;
}
