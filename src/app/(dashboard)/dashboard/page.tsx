'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Dashboard = {
  account: { email: string; name: string; tier: string };
  wallet: { balance: number; reserved: number; available: number; lifetimeSpent: number };
  monthlyAllowance: number;
  counts: { product_images: number; saved_videos: number; completed_jobs: number; active_jobs: number; failed_jobs: number; total_jobs: number } | null;
  recentJobs: Array<{ id: string; status: string; styleId: string; createdAt: string }>;
  billingHistory: Array<{ id: string; planId: string; amountMyr: number; status: string; createdAt: string }>;
  affiliateStatus: string;
  paymentControl:{paymentHold:boolean;holdReason?:string};
  notifications:Array<{id:string;title:string;message:string;notification_type:string;created_at:string}>;
};

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/dashboard', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error((await response.json()).error || 'Dashboard tidak tersedia.');
      setData(await response.json());
    }).catch((err) => setError(err.message));
  }, []);
  if (error) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</p>;
  if (!data) return <p>Memuatkan data akaun…</p>;
  const cards = [
    ['Baki kredit', data.wallet.balance], ['Ditempah', data.wallet.reserved], ['Boleh guna', data.wallet.available],
    ['Elaun pelan', data.monthlyAllowance], ['Produk', data.counts?.product_images ?? '—'],
    ['Video tersimpan', data.counts?.saved_videos ?? '—'], ['Tugasan aktif', data.counts?.active_jobs ?? '—'],
    ['Selesai', data.counts?.completed_jobs ?? '—'], ['Gagal', data.counts?.failed_jobs ?? '—'],
  ];
  return <div className="space-y-6">
    {data.paymentControl.paymentHold&&<div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900"><p className="font-bold">Penggunaan kredit dibekukan sementara</p><p className="mt-1">Pembayaran anda belum dapat disahkan. Sila hubungi sokongan atau kemukakan maklumat pembayaran yang betul untuk menyelesaikan masalah ini.</p></div>}
    {data.notifications?.slice(0,3).map(note=><div key={note.id} className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950"><p className="font-bold">{note.title}</p><p className="mt-1">{note.message}</p></div>)}
    <div className="flex flex-wrap justify-between gap-3 items-center"><div><h1 className="text-2xl font-bold">Dashboard</h1><p className="text-sm text-slate-600">{data.account.name || data.account.email} · Pelan {data.account.tier}</p></div><Link href="/factory" className="rounded-lg bg-indigo-600 text-white px-5 py-3 font-semibold">Jana Video</Link></div>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">{cards.map(([label, value]) => <div key={label} className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p></div>)}</div>
    <div className="flex flex-wrap gap-2 text-sm"><Link href="/products" className="rounded-lg border bg-white p-3">Pustaka Produk</Link><Link href="/library" className="rounded-lg border bg-white p-3">Pustaka Video</Link><Link href="/queue" className="rounded-lg border bg-white p-3">Giliran</Link><Link href="/billing" className="rounded-lg border bg-white p-3">Bil & Kredit</Link><Link href="/settings" className="rounded-lg border bg-white p-3">Tetapan Akaun</Link><Link href="/affiliate" className="rounded-lg border bg-white p-3">Affiliate: {data.affiliateStatus}</Link></div>
    <div className="grid gap-5 lg:grid-cols-2"><section className="rounded-xl border bg-white p-5"><h2 className="font-semibold mb-3">Tugasan terkini</h2>{data.recentJobs.length ? <ul className="space-y-2 text-sm">{data.recentJobs.map((job) => <li key={job.id} className="flex justify-between border-t pt-2"><span>{job.styleId} · {job.status}</span><span>{new Date(job.createdAt).toLocaleDateString('ms-MY')}</span></li>)}</ul> : <p className="text-sm text-slate-500">Belum ada tugasan.</p>}</section><section className="rounded-xl border bg-white p-5"><h2 className="font-semibold mb-3">Sejarah bil terkini</h2>{data.billingHistory.length ? <ul className="space-y-2 text-sm">{data.billingHistory.map((order) => <li key={order.id} className="flex justify-between border-t pt-2"><span>{order.planId} · {order.status}</span><span>RM{Number(order.amountMyr).toFixed(2)}</span></li>)}</ul> : <p className="text-sm text-slate-500">Belum ada pesanan.</p>}</section></div>
  </div>;
}
