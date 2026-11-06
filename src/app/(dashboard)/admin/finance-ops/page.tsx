'use client';

import { useEffect, useState } from 'react';

type Order = { id: string; status: string; amountMyr: number; planId: string; createdAt: string };
type Clawback = { id: string; order_id: string; amount_myr: number; status: string; created_at: string };
type CreditDebt = { order_id: string; workspace_id: string; outstanding_credits: number; created_at: string };

export default function FinanceOpsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [clawbacks, setClawbacks] = useState<Clawback[]>([]);
  const [debts, setDebts] = useState<CreditDebt[]>([]);
  const [orderId, setOrderId] = useState('');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function refresh() {
    const [orderResponse, clawbackResponse, debtResponse] = await Promise.all([
      fetch('/api/admin/operations?view=orders', { cache: 'no-store' }),
      fetch('/api/admin/affiliate-clawbacks', { cache: 'no-store' }),
      fetch('/api/admin/credit-refund-debts', { cache: 'no-store' }),
    ]);
    if (!orderResponse.ok || !clawbackResponse.ok || !debtResponse.ok) throw new Error('Data kewangan tidak tersedia.');
    setOrders((await orderResponse.json()).orders);
    setClawbacks((await clawbackResponse.json()).clawbacks);
    setDebts((await debtResponse.json()).debts);
  }
  useEffect(() => { refresh().catch((err) => setError(err.message)); }, []);
  async function recordRefund(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/refunds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, reference, reason }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Refund tidak dapat direkodkan.');
      setMessage('Refund direkodkan. Semak pembalikan komisen dan clawback di bawah.'); setOrderId(''); setReference(''); setReason(''); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Refund gagal.'); }
    finally { setBusy(false); }
  }
  async function recover(id: string) {
    const recoveryReference = window.prompt('Rujukan pemulihan wang affiliate yang disahkan:');
    if (!recoveryReference?.trim()) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/affiliate-clawbacks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, reference: recoveryReference }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Clawback gagal.');
      setMessage('Clawback telah direkodkan sebagai pulih.'); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Clawback gagal.'); }
    finally { setBusy(false); }
  }
  async function recoverCreditDebt(orderId: string) {
    const recoveryReference = window.prompt('Rujukan pemulihan kredit yang disahkan:');
    if (!recoveryReference?.trim()) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/credit-refund-debts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId, reference: recoveryReference }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Pemulihan kredit gagal.');
      setMessage('Hutang kredit refund telah dipulihkan.'); await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Pemulihan kredit gagal.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6"><h1 className="text-2xl font-bold">Operasi refund & clawback</h1><p className="text-sm text-slate-600">Rekod refund hanya selepas wang benar-benar dipulangkan melalui bank/gateway. Rujukan transaksi wajib. Kredit pembelian yang belum digunakan ditarik balik; baki yang telah digunakan menjadi hutang kredit dan menyekat penjanaan baharu.</p>{error && <p role="alert" className="text-red-700">{error}</p>}{message && <p role="status" className="text-emerald-700">{message}</p>}<form onSubmit={recordRefund} className="rounded-xl border bg-white p-5 grid gap-3 sm:grid-cols-2"><h2 className="font-semibold sm:col-span-2">Rekod refund disahkan</h2><input required value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder="ID pesanan" aria-label="ID pesanan" className="rounded border p-2 text-sm" /><input required value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Rujukan refund bank/gateway" aria-label="Rujukan refund" className="rounded border p-2 text-sm" /><textarea required minLength={8} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Sebab refund" aria-label="Sebab refund" className="rounded border p-2 text-sm sm:col-span-2" /><button disabled={busy} className="rounded bg-red-700 px-4 py-3 text-white disabled:opacity-50">Rekod Refund</button></form><section><h2 className="font-semibold mb-2">Pesanan terkini</h2><div className="space-y-2 text-sm">{orders.map((order) => <div key={order.id} className="rounded border bg-white p-3 flex flex-wrap justify-between gap-2"><span className="break-all">{order.id} · {order.planId} · {order.status}</span><span>RM{Number(order.amountMyr).toFixed(2)} <button onClick={() => setOrderId(order.id)} className="text-indigo-700 ml-2">Pilih</button></span></div>)}</div></section><section><h2 className="font-semibold mb-2">Hutang kredit refund</h2><div className="space-y-2 text-sm">{debts.map((item) => <div key={item.order_id} className="rounded border bg-white p-3 flex flex-wrap justify-between gap-2"><span className="break-all">{item.order_id} · {item.outstanding_credits} kredit tertunggak</span><button disabled={busy} onClick={() => recoverCreditDebt(item.order_id)} className="text-indigo-700">Pulihkan daripada baki tersedia</button></div>)}</div>{!debts.length && <p className="text-sm text-slate-500">Tiada hutang kredit refund.</p>}</section><section><h2 className="font-semibold mb-2">Clawback affiliate</h2><div className="space-y-2 text-sm">{clawbacks.map((item) => <div key={item.id} className="rounded border bg-white p-3 flex flex-wrap justify-between gap-2"><span>{item.order_id} · RM{Number(item.amount_myr).toFixed(2)} · {item.status}</span>{item.status === 'OPEN' && <button disabled={busy} onClick={() => recover(item.id)} className="text-indigo-700">Rekod pemulihan</button>}</div>)}</div>{!clawbacks.length && <p className="text-sm text-slate-500">Tiada clawback.</p>}</section></div>;
}
