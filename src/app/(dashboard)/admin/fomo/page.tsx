'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock3, Gift, MessageCircle, ReceiptText, ShieldCheck, ShoppingCart, TrendingUp } from 'lucide-react';

type Report = {
  featureFlag: boolean;
  campaign: null | { enabled: boolean; starts_at: string; ends_at: string; offer_minutes: number; payment_reservation_hours: number; holdout_bps: number };
  events: Record<string, number>;
  claims: number;
  expiredClaims: number;
  confirmedPurchases: number;
  bonusCreditsGranted: number;
  conservativeBonusLiabilityMyr: number;
};

export default function FomoAdminPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { fetch('/api/admin/fomo', { cache: 'no-store' }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Laporan tidak tersedia.'); setReport(data.report); }).catch(reason => setError(reason.message)); }, []);
  const cards = [
    ['Eligible views', report?.events.fomo_offer_view || 0, TrendingUp],
    ['Claims', report?.claims || 0, Gift],
    ['Expired', report?.expiredClaims || 0, Clock3],
    ['WhatsApp', report?.events.fomo_whatsapp_request || 0, MessageCircle],
    ['Checkout', report?.events.fomo_checkout_start || 0, ShoppingCart],
    ['Resit', report?.events.fomo_receipt_uploaded || 0, ReceiptText],
    ['Bonus granted', report?.events.fomo_bonus_granted || 0, ShieldCheck],
    ['Confirmed', report?.confirmedPurchases || 0, ShieldCheck],
  ] as const;
  return <div className="mx-auto max-w-6xl space-y-6 pb-16">
    <Link href="/admin?tab=sales" className="inline-flex items-center gap-2 text-xs font-black text-indigo-700"><ArrowLeft className="h-4 w-4"/>Kembali ke Jualan</Link>
    <header className="rounded-3xl bg-slate-950 p-6 text-white"><p className="text-[10px] font-black uppercase tracking-[.2em] text-amber-300">Internal experiment report</p><h1 className="mt-2 text-3xl font-black">FOMO Bonus V1</h1><p className="mt-2 text-sm text-slate-300">Metrik sebenar dipisahkan antara view, claim, resit, bonus provisional dan pembelian bank-confirmed.</p></header>
    {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
    {!report && !error && <div className="rounded-2xl border p-8 text-center text-sm text-slate-500">Memuatkan laporan…</div>}
    {report && <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map(([label, value, Icon]) => <article key={label} className="rounded-2xl border bg-white p-4"><Icon className="h-5 w-5 text-violet-600"/><p className="mt-3 text-2xl font-black">{value}</p><p className="text-[11px] font-bold text-slate-500">{label}</p></article>)}</section>
      <section className="grid gap-4 md:grid-cols-2"><article className="rounded-2xl border bg-white p-5"><h2 className="font-black">Campaign state</h2><dl className="mt-4 space-y-2 text-xs"><div className="flex justify-between"><dt>Worker feature flag</dt><dd className="font-black">{report.featureFlag ? 'ON' : 'OFF'}</dd></div><div className="flex justify-between"><dt>Database campaign</dt><dd className="font-black">{report.campaign?.enabled ? 'ON' : 'OFF'}</dd></div><div className="flex justify-between"><dt>Offer window</dt><dd className="font-black">{report.campaign?.offer_minutes || 0} minit</dd></div><div className="flex justify-between"><dt>Payment reservation</dt><dd className="font-black">{report.campaign?.payment_reservation_hours || 0} jam</dd></div><div className="flex justify-between"><dt>Holdout</dt><dd className="font-black">{Number(report.campaign?.holdout_bps || 0) / 100}%</dd></div></dl></article><article className="rounded-2xl border bg-white p-5"><h2 className="font-black">Credit liability</h2><p className="mt-4 text-3xl font-black">{report.bonusCreditsGranted.toLocaleString('ms-MY')} kredit</p><p className="mt-1 text-sm text-slate-500">Bonus provisional/confirmed yang telah diberi.</p><p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">Anggaran kos bonus — belum direkonsiliasi: RM{report.conservativeBonusLiabilityMyr.toFixed(2)}</p></article></section>
    </>}
  </div>;
}
