'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { CreditCard, Check, Sparkles, ShieldCheck, Zap, History, Clock, ArrowDownRight, ArrowUpRight, AlertCircle, QrCode, Building, ExternalLink, RefreshCw } from 'lucide-react';
import { AUTHORITATIVE_PLANS, GENERATION_COSTS, PricingPlan } from '@/lib/billing/plans';

interface LedgerItem {
  id: string;
  amount: number;
  eventType: string;
  referenceId: string;
  timestamp: string;
  description: string;
}

interface CheckoutData {
  orderId: string;
  plan: PricingPlan;
  amountMyr: number;
  creditsGranted: number;
  checkoutUrl?: string;
  manualPaymentDetails?: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    duitNowQrPayload: string;
    referenceCode: string;
    instructions: string[];
  };
}

export default function BillingPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [reservedBalance, setReservedBalance] = useState<number>(0);
  const [currentTier, setCurrentTier] = useState<string>('free');
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [publicCheckoutEnabled, setPublicCheckoutEnabled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Checkout modal states
  const [selectedPlanModal, setSelectedPlanModal] = useState<PricingPlan | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [pendingNotice, setPendingNotice] = useState<string | null>(null);

  async function fetchBilling() {
    try {
      const res = await fetch('/api/billing');
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
        setReservedBalance(data.reservedBalance || 0);
        setCurrentTier(data.currentTier || 'free');
        setLedger(data.ledger || []);
        setPublicCheckoutEnabled(Boolean(data.publicCheckoutEnabled));
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchBilling();
  }, []);

  async function handleStartCheckout(plan: PricingPlan, method: 'fpx' | 'card' = 'fpx') {
    if (!publicCheckoutEnabled) {
      setCheckoutError('Pelan berbayar belum dibuka untuk umum. Duit korang simpan dulu! Nikmati 50 kredit FREE dulu.');
      return;
    }

    setIsCheckingOut(true);
    setCheckoutError(null);
    setPaymentVerified(false);

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          paymentMethod: method,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Gagal memulakan proses pembayaran.');
      }

      setCheckoutData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCheckoutError(msg);
    } finally {
      setIsCheckingOut(false);
    }
  }

  async function checkPaymentStatus() {
    if (!checkoutData?.orderId) return;
    setIsVerifying(true);
    setPendingNotice(null);
    try {
      const res = await fetch(`/api/billing/verify-order?orderId=${checkoutData.orderId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'PAID') {
          setPaymentVerified(true);
          setBalance(data.walletBalance);
          await fetchBilling();
        } else {
          setPendingNotice('Pesanan anda berstatus PENDING. Kredit akan diperuntukkan serta-merta selepas pentadbir mengesahkan resit transaksi bank anda.');
        }
      }
    } catch {
      setPendingNotice('Ralat menyemak status pesanan. Sila cuba sebentar lagi.');
    } finally {
      setIsVerifying(false);
    }
  }

  function handleCloseModal() {
    setSelectedPlanModal(null);
    setCheckoutData(null);
    setPaymentVerified(false);
    setCheckoutError(null);
    setPendingNotice(null);
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Billing & Kredit Pelan</h2>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
            AffiMatik v3.0 Commercial
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Pengurusan baki kredit berpusat, gerbang pembayaran FPX tempatan Malaysia, dan rekod lejar audit telus.
        </p>
      </div>

      {/* Credit Balance Card */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <span className="text-xs font-semibold uppercase text-slate-400">Baki Kredit Semasa Akaun Anda</span>
          <div className="text-3xl font-extrabold text-slate-900 mt-1 flex items-baseline gap-2">
            {isLoading ? (
              <span className="text-slate-400 text-xl font-normal">Memuatkan baki...</span>
            ) : (
              <>
                <span>{balance ?? 0} Kredit</span>
                {reservedBalance > 0 && (
                  <span className="text-xs font-normal text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    ({reservedBalance} kredit sedang diproses)
                  </span>
                )}
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase">
                  Pelan {currentTier}
                </span>
              </>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Kadar penjanaan autoritatif: <strong>{GENERATION_COSTS.TEN_SECONDS_NEXABOT} Kredit</strong> untuk video 10s (AffiMatik Voice • Pertuturan BM) | <strong>{GENERATION_COSTS.FIFTEEN_SECONDS_RUNNINGHUB} Kredit</strong> untuk video 15s (AffiMatik Motion • Visual Realistik).
          </p>
        </div>

        {publicCheckoutEnabled ? (
          <button
            type="button"
            onClick={() => {
              setSelectedPlanModal(AUTHORITATIVE_PLANS[1]);
              handleStartCheckout(AUTHORITATIVE_PLANS[1], 'fpx');
            }}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition shadow-sm cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            Beli Tambahan Kredit
          </button>
        ) : (
          <Link
            href="/factory"
            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shadow-sm whitespace-nowrap self-start sm:self-auto inline-flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Cuba FREE — 50 Kredit</span>
          </Link>
        )}
      </div>

      {/* Soft Launch Notice: Coming Soon Friendly Malaysian Creator Copy */}
      {!publicCheckoutEnabled && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100 border-2 border-amber-300 text-slate-800 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">😂</span>
              <h3 className="text-base sm:text-lg font-extrabold text-amber-950">
                Duit korang simpan dulu. Kami belum nak ambil lagi. 😂
              </h3>
            </div>
            <span className="self-start sm:self-auto text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-200/80 px-2.5 py-0.5 rounded-full border border-amber-300">
              Pelan Berbayar — Coming Soon
            </span>
          </div>
          <p className="text-xs sm:text-sm text-amber-900 leading-relaxed max-w-3xl">
            Kami bagi 50 kredit FREE dulu. Korang cuba buat video puas-puas, tengok hasil dia. Bila dah jatuh cinta dengan AffiMatik, baru kita sembang pasal duit. 😎
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-4">
            <Link
              href="/factory"
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shadow-sm inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cuba FREE — Dapat 50 Kredit</span>
            </Link>
            <a
              href="mailto:support@affimatik.online?subject=Pertanyaan%20Akses%20Awal%20AffiMatik"
              className="text-xs font-semibold text-amber-900 hover:text-amber-950 underline decoration-amber-400 hover:decoration-amber-700 transition"
            >
              Dah tak sabar nak upgrade? Hubungi team AffiMatik untuk akses awal.
            </a>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {AUTHORITATIVE_PLANS.map((plan) => {
          const isCurrent = plan.id.toLowerCase().includes(currentTier.toLowerCase());

          return (
            <div
              key={plan.id}
              className={`p-6 rounded-2xl bg-white border flex flex-col justify-between transition-all ${
                isCurrent
                  ? 'border-indigo-600 ring-2 ring-indigo-600 shadow-md'
                  : 'border-slate-200 shadow-xs hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  {isCurrent ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full inline-block">
                      Pelan Semasa Anda
                    </span>
                  ) : plan.isPopular ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full inline-block">
                      {plan.highlightBadge}
                    </span>
                  ) : <div />}
                </div>

                <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                <div className="mt-3 flex items-baseline">
                  <span className="text-3xl font-extrabold text-slate-900">{plan.priceFormatted}</span>
                  <span className="text-xs text-slate-500 ml-1">{plan.billingPeriod}</span>
                </div>
                <p className="text-xs font-semibold text-indigo-600 mt-2">
                  {plan.monthlyCredits} Kredit Sebulan
                </p>

                <ul className="mt-6 space-y-2.5 text-xs text-slate-600">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                {publicCheckoutEnabled ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlanModal(plan);
                      handleStartCheckout(plan, 'fpx');
                    }}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isCurrent
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                    }`}
                  >
                    {isCurrent ? 'Pelan Semasa (Beli Lagi)' : `Langgan ${plan.name}`}
                  </button>
                ) : (
                  <div className="space-y-2 text-center">
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                    >
                      Coming Soon — Simpan Duit Dulu 😆
                    </button>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Langganan belum dibuka untuk umum. Sementara tu, korang boleh cuba AffiMatik secara percuma.
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Real Transaction Ledger History */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-xs p-6">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-slate-500" />
          <h3 className="text-base font-bold text-slate-900">Buku Lejar Transaksi Kredit (Audit Trail)</h3>
        </div>

        {ledger.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
            Tiada rekod transaksi kredit baharu lagi. Penjanaan video dan langganan akan direkodkan di sini secara automatik.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Masa & Tarikh</th>
                  <th className="py-2.5 px-3 font-semibold">Jenis Acara</th>
                  <th className="py-2.5 px-3 font-semibold">Penerangan</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Jumlah Kredit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleString('ms-MY', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                        item.eventType === 'SETTLE'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : item.eventType === 'RESERVE'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {item.eventType === 'SETTLE' ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {item.eventType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{item.description}</td>
                    <td className={`py-2.5 px-3 font-bold text-right ${
                      item.amount < 0 ? 'text-slate-800' : 'text-emerald-600'
                    }`}>
                      {item.amount > 0 ? `+${item.amount}` : item.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Operational Malaysian Checkout Modal */}
      {selectedPlanModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-base text-slate-900">
                  Langganan {selectedPlanModal.name}
                </h3>
              </div>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">
                {selectedPlanModal.priceFormatted} / bulan
              </span>
            </div>

            {checkoutError ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{checkoutError}</span>
              </div>
            ) : isCheckingOut ? (
              <div className="py-12 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                <p className="text-xs text-slate-600">Menyediakan invois pembayaran rasmi...</p>
              </div>
            ) : paymentVerified ? (
              <div className="py-8 text-center space-y-4">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8" />
                </div>
                <h4 className="font-extrabold text-lg text-slate-900">Pembayaran Berjaya Disahkan!</h4>
                <p className="text-xs text-slate-600 max-w-xs mx-auto">
                  Pelan anda kini dinaik taraf ke <strong>{selectedPlanModal.name}</strong> dan <strong>{selectedPlanModal.monthlyCredits} kredit</strong> telah dimasukkan ke dompet akaun anda.
                </p>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 cursor-pointer"
                >
                  Selesai & Mula Buat Video
                </button>
              </div>
            ) : checkoutData ? (
              <div className="space-y-4 text-xs">
                {checkoutData.checkoutUrl ? (
                  <div className="p-4 bg-slate-50 border rounded-xl space-y-3 text-center">
                    <p className="text-slate-600">Klik butang di bawah untuk membayar melalui portal selamat:</p>
                    <a
                      href={checkoutData.checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-700"
                    >
                      Buka Gerbang FPX / Kad <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                ) : checkoutData.manualPaymentDetails ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-amber-900 font-bold">
                        <span>Pindahan Segera (FPX / DuitNow QR)</span>
                        <span className="text-sm">RM {checkoutData.amountMyr}.00</span>
                      </div>
                      <div className="space-y-1 text-slate-700 pt-1">
                        <div><strong>Bank:</strong> {checkoutData.manualPaymentDetails.bankName}</div>
                        <div><strong>No. Akaun:</strong> <span className="font-mono bg-white px-2 py-0.5 rounded border border-amber-300 font-bold">{checkoutData.manualPaymentDetails.accountNumber}</span></div>
                        <div><strong>Penerima:</strong> {checkoutData.manualPaymentDetails.accountHolder}</div>
                        <div><strong>Kod Rujukan Wajib:</strong> <span className="font-mono bg-amber-200 text-amber-950 px-2 py-0.5 rounded font-black">{checkoutData.manualPaymentDetails.referenceCode}</span></div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-slate-600 text-[11px]">
                      {checkoutData.manualPaymentDetails.instructions.map((inst, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <span className="font-bold text-slate-900">{i + 1}.</span>
                          <span>{inst}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {pendingNotice && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-start gap-2">
                    <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <span>{pendingNotice}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 cursor-pointer"
                  >
                    Batal
                  </button>

                  <button
                    type="button"
                    disabled={isVerifying}
                    onClick={checkPaymentStatus}
                    className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isVerifying && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isVerifying ? 'Menyemak...' : 'Saya Telah Bayar (Sahkan)'}</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
