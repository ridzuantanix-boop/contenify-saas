'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Clock3, Gift, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';

type OfferState = {
  enabled: boolean;
  cohort?: 'OFFER' | 'CONTROL';
  server_now?: string;
  offer_expires_at?: string;
  campaign_ends_at?: string;
  base_credits?: number;
  bonus_credits?: number;
  total_credits?: number;
  amount_myr?: number;
  payment_reservation_hours?: number;
  claim?: { id: string; status: string; paymentExpiresAt: string; orderId?: string | null } | null;
};

function clock(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0 ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function FomoBonusOffer() {
  const [state, setState] = useState<OfferState | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [assistOpen, setAssistOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const anchor = useRef<{ seconds: number; performance: number } | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/fomo-offer', { cache: 'no-store' }).then(async response => response.json()).then((next: OfferState) => {
      if (!active) return;
      setState(next);
      if (next.enabled && next.cohort === 'OFFER' && next.server_now && next.offer_expires_at) {
        const seconds = Math.max(0, Math.floor((new Date(next.offer_expires_at).getTime() - new Date(next.server_now).getTime()) / 1000));
        anchor.current = { seconds, performance: performance.now() };
        setRemaining(seconds);
      }
    }).catch(() => setState({ enabled: false }));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!anchor.current) return;
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((performance.now() - anchor.current!.performance) / 1000);
      setRemaining(Math.max(0, anchor.current!.seconds - elapsed));
    }, 500);
    return () => window.clearInterval(timer);
  }, [state]);

  if (!state) return <span hidden data-heatmap-variant="pending" />;
  if (!state.enabled || state.cohort !== 'OFFER') return <span hidden data-heatmap-variant="base_v1" />;
  const claimed = state.claim && ['CLAIMED', 'ORDER_LINKED', 'GRANTED', 'PURCHASE_CONFIRMED'].includes(state.claim.status);
  const expired = !claimed && remaining <= 0;

  async function claim() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/fomo-offer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'claim' }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.code === 'OFFER_EXPIRED' ? 'Tempoh bonus sudah tamat. Launch Pack biasa masih tersedia.' : data.error || 'Bonus tidak dapat diclaim.');
      setState(current => current ? { ...current, claim: { id: String(data.claim_id), status: String(data.status), paymentExpiresAt: String(data.payment_expires_at) } } : current);
      setMessage('Bonus berjaya ditempah. Anda ada 24 jam untuk daftar dan selesaikan bayaran QR.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Bonus tidak dapat diclaim.'); }
    finally { setBusy(false); }
  }

  async function requestHelp(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/fomo-offer/assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ whatsapp: phone, privacyAccepted, marketingConsent }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Permintaan bantuan gagal.');
      setMessage('Permintaan direkodkan. WhatsApp akan dibuka untuk anda menghantar mesej kepada admin.');
      window.open(data.whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Permintaan bantuan gagal.'); }
    finally { setBusy(false); }
  }

  return <section id="bonus-launch-pack" data-heatmap-variant="bonus_v1" data-heatmap-region="bonus" className="px-4 pb-16 sm:px-8 sm:pb-24">
    <div className="mx-auto max-w-5xl overflow-hidden rounded-[32px] border border-amber-300 bg-[radial-gradient(circle_at_top_right,_rgba(250,204,21,.28),_transparent_42%),linear-gradient(135deg,#2e1065,#5b21b6_55%,#312e81)] p-5 text-white shadow-2xl shadow-violet-200 sm:p-9">
      <div className="grid gap-7 lg:grid-cols-[1fr_.72fr] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-300/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] text-amber-100"><Sparkles className="h-4 w-4"/> Tawaran sebenar · satu claim sahaja</span>
          <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">Bonus 100 Kredit Untuk Launch Pack RM19</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-violet-100">Biasanya dapat 150 kredit untuk sehingga 15 video. Sepanjang tawaran ini, kami tambah 100 kredit lagi.</p>
          <div className="mt-6 grid grid-cols-3 gap-2 text-center"><div className="rounded-2xl bg-white/10 p-3"><p className="text-2xl font-black">150</p><p className="text-[10px] text-violet-200">Kredit Asas</p></div><div className="rounded-2xl bg-amber-300/15 p-3"><p className="text-2xl font-black text-amber-200">+100</p><p className="text-[10px] text-amber-100">Kredit Bonus</p></div><div className="rounded-2xl bg-white p-3 text-violet-950"><p className="text-2xl font-black">250</p><p className="text-[10px] font-bold">Jumlah Kredit</p></div></div>
          <p className="mt-4 flex items-center gap-2 text-sm font-black text-amber-200"><Gift className="h-5 w-5"/> Sehingga 25 video affiliate 15 saat.</p>
        </div>
        <div className="rounded-3xl bg-white p-5 text-slate-950 shadow-xl sm:p-6">
          <p className="text-center text-5xl font-black">RM19</p>
          {!claimed && !expired && <><p className="mt-4 text-center text-xs font-bold text-slate-500">Tempoh claim bonus yang tinggal</p><div className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 font-mono text-3xl font-black text-amber-300" role="timer"><Clock3 className="h-6 w-6"/>{clock(remaining)}</div></>}
          {expired && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-xs leading-5 text-slate-600">Tempoh bonus untuk sesi ini telah tamat dan tidak akan dimulakan semula. Launch Pack biasa RM19 masih tersedia.</div>}
          {claimed && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center text-xs font-bold leading-5 text-emerald-800">Bonus sudah ditempah. Selesaikan pembayaran sebelum {new Intl.DateTimeFormat('ms-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'}).format(new Date(state.claim!.paymentExpiresAt))}.</div>}
          {!expired && !claimed && <button type="button" data-heatmap-action="bonus_claim" onClick={claim} disabled={busy} className="mt-4 min-h-12 w-full rounded-xl bg-amber-400 px-5 text-sm font-black text-violet-950 shadow-sm hover:bg-amber-300 disabled:opacity-60">{busy ? 'Menyimpan claim…' : 'Claim 100 Kredit Bonus'}</button>}
          {claimed && <Link href="/register?intent=launch_pack&promo=fomo_v1&source=fomo_bonus" data-heatmap-action="bonus_register" className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-violet-600 px-5 text-sm font-black text-white">Teruskan Daftar & Bayar QR</Link>}
          <button type="button" data-heatmap-action="bonus_help_open" onClick={() => setAssistOpen(value => !value)} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-xs font-black text-slate-700"><MessageCircle className="h-4 w-4"/> Tanya Dulu di WhatsApp</button>
          <p className="mt-4 text-center text-[10px] leading-4 text-slate-500">Bayaran sekali sahaja · Tiada auto-renew · Kredit sah 180 hari</p>
        </div>
      </div>
      {assistOpen && <form onSubmit={requestHelp} className="mt-6 rounded-2xl border border-white/15 bg-white/10 p-4">
        <label className="text-xs font-bold">Nombor WhatsApp<input value={phone} onChange={event => setPhone(event.target.value)} placeholder="Contoh: 0195216867" className="mt-1 block min-h-11 w-full rounded-xl border border-white/20 bg-white px-3 text-slate-950" required/></label>
        <label className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-violet-100"><input type="checkbox" checked={privacyAccepted} onChange={event => setPrivacyAccepted(event.target.checked)} required className="mt-1"/>Saya setuju nombor ini digunakan untuk menjawab pertanyaan bantuan ini. Rujuk <Link href="/privacy" className="font-bold underline">Notis Privasi</Link>.</label>
        <label className="mt-2 flex items-start gap-2 text-[11px] leading-5 text-violet-100"><input type="checkbox" checked={marketingConsent} onChange={event => setMarketingConsent(event.target.checked)} className="mt-1"/>Saya juga setuju menerima mesej pemasaran (pilihan, tidak wajib untuk checkout).</label>
        <button disabled={busy} data-heatmap-action="bonus_help_submit" className="mt-3 min-h-11 rounded-xl bg-emerald-500 px-5 text-xs font-black text-white disabled:opacity-60">Hantar Permintaan & Buka WhatsApp</button>
      </form>}
      {message && <p aria-live="polite" className="mt-4 rounded-xl bg-white/10 p-3 text-xs font-bold leading-5 text-white"><ShieldCheck className="mr-2 inline h-4 w-4"/>{message}</p>}
    </div>
  </section>;
}
