'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, Check, Sparkles, ShieldCheck, Zap, History, Clock, ArrowDownRight, ArrowUpRight, AlertCircle } from 'lucide-react';
import { AUTHORITATIVE_PLANS, GENERATION_COSTS, PricingPlan } from '@/lib/billing/plans';

interface LedgerItem {
  id: string;
  amount: number;
  eventType: string;
  referenceId: string;
  timestamp: string;
  description: string;
}

export default function BillingPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [reservedBalance, setReservedBalance] = useState<number>(0);
  const [currentTier, setCurrentTier] = useState<string>('pro');
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlanModal, setSelectedPlanModal] = useState<PricingPlan | null>(null);

  useEffect(() => {
    async function fetchBilling() {
      try {
        const res = await fetch('/api/billing');
        if (res.ok) {
          const data = await res.json();
          setBalance(data.balance);
          setReservedBalance(data.reservedBalance || 0);
          setCurrentTier(data.currentTier || 'pro');
          setLedger(data.ledger || []);
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    }
    fetchBilling();
  }, []);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Billing & Kredit Pelan</h2>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
            AffiMatik v2.1.1
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Pengurusan baki kredit berpusat, akaun berautentikasi, dan rekod transaksi buku lejar secara telus.
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
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Aktif ({currentTier.toUpperCase()})
                </span>
              </>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Kadar penjanaan autoritatif: <strong>{GENERATION_COSTS.TEN_SECONDS_NEXABOT} Kredit</strong> untuk video 10s (Nexabot Spoken BM) | <strong>{GENERATION_COSTS.FIFTEEN_SECONDS_RUNNINGHUB} Kredit</strong> untuk video 15s (RunningHub Visual).
          </p>
        </div>

        <button
          type="button"
          onClick={() => setSelectedPlanModal(AUTHORITATIVE_PLANS[1])}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition shadow-sm cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          Beli Tambahan Kredit
        </button>
      </div>

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
                <button
                  type="button"
                  onClick={() => setSelectedPlanModal(plan)}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                  }`}
                >
                  {isCurrent ? 'Pelan Semasa (Aktif)' : `Langgan ${plan.name}`}
                </button>
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

      {/* Gateway Integration Notice Modal */}
      {selectedPlanModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-indigo-600">
              <AlertCircle className="w-6 h-6" />
              <h3 className="font-bold text-base text-slate-900">Integrasi Pembayaran FPX / Kad</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Anda telah memilih <strong>{selectedPlanModal.name} ({selectedPlanModal.priceFormatted})</strong>.
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <strong>Status Semasa:</strong> Gerbang pembayaran automatik (FPX / Stripe) sedang dalam peringkat integrasi pengeluaran. Tiada sebarang caj kad dibuat pada masa ini.
            </div>
            <p className="text-xs text-slate-500">
              Untuk urusan langganan rasmi atau top-up manual, sila hubungi pengurusan AffiMatik by Pawarna melalui sokongan WhatsApp rasmi.
            </p>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedPlanModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
