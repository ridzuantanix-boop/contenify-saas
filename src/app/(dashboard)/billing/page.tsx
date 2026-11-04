'use client';

import React, { useState } from 'react';
import { CreditCard, Check, Sparkles, ShieldCheck, Zap } from 'lucide-react';
import { AUTHORITATIVE_PLANS, GENERATION_COSTS } from '@/lib/billing/plans';

export default function BillingPage() {
  const [currentBalance, setCurrentBalance] = useState(10);
  const currentPlanId = 'plan_pro';

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <div className="pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Billing & Kredit Pelan</h2>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
            AffiMatik v2.1
          </span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Pengurusan baki kredit telus, langganan bulanan, dan sejarah transaksi buku lejar tanpa caj tersembunyi.
        </p>
      </div>

      {/* Credit Balance Card */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase text-slate-400">Baki Kredit Semasa Anda</span>
          <div className="text-3xl font-extrabold text-slate-900 mt-1 flex items-baseline gap-2">
            <span>{currentBalance} Kredit</span>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Aktif
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Kadar penjanaan: <strong>{GENERATION_COSTS.TEN_SECONDS_NEXABOT} Kredit</strong> untuk video 10s (Nexabot Spoken BM) | <strong>{GENERATION_COSTS.FIFTEEN_SECONDS_RUNNINGHUB} Kredit</strong> untuk video 15s (RunningHub Visual).
          </p>
        </div>
        <button
          type="button"
          onClick={() => alert('Modul pembayaran gerbang (Payment Gateway) akan disambungkan dalam fasa seterusnya.')}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition shadow-sm cursor-pointer"
        >
          Beli Tambahan Kredit
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {AUTHORITATIVE_PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlanId;

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
                      Pelan Semasa
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

              <button
                type="button"
                className={`mt-6 w-full py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  isCurrent
                    ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                }`}
              >
                {isCurrent ? 'Urus Langganan' : 'Pilih Pelan Ini'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
