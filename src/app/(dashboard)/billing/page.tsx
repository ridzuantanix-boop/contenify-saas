import React from 'react';
import { CreditCard, Check, Sparkles, ShieldCheck } from 'lucide-react';

export default function BillingPage() {
  const plans = [
    {
      name: 'Starter Creator',
      price: 'RM 49',
      period: '/bulan',
      credits: '50 Kredit / bulan',
      features: ['50x Video 10s Nexabot', 'Official Gems Presets', 'Resolusi 1080P HD', 'Storan R2 14 Hari'],
      current: false,
    },
    {
      name: 'Pro Affiliate',
      price: 'RM 129',
      period: '/bulan',
      credits: '160 Kredit / bulan',
      features: ['Semua ciri Starter', 'RunningHub 15s Workflow', 'Simpan Avatar Sendiri', 'Storan R2 60 Hari', 'Eksport Pukal ZIP'],
      current: true,
    },
    {
      name: 'Agency Studio',
      price: 'RM 399',
      period: '/bulan',
      credits: '600 Kredit / bulan',
      features: ['Sokongan Multi-Ruang Kerja', 'Akses API Terus', 'Sokongan Keutamaan 24/7', 'Storan R2 Tanpa Had'],
      current: false,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="pb-4 border-b border-slate-200">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Billing & Kredit Pelan</h2>
        <p className="text-sm text-slate-500 mt-1">
          Pengurusan baki kredit, langganan bulanan, dan sejarah transaksi buku lejar.
        </p>
      </div>

      {/* Credit Balance Card */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase text-slate-400">Baki Kredit Semasa</span>
          <div className="text-3xl font-extrabold text-slate-900 mt-1">10 Kredit</div>
          <p className="text-xs text-slate-500 mt-1">
            Setara dengan 1 video 10 saat (Nexabot) atau 0 video 15 saat (RunningHub).
          </p>
        </div>
        <button className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition shadow-sm">
          Beli Tambahan Kredit
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`p-6 rounded-2xl bg-white border flex flex-col justify-between ${
              plan.current ? 'border-indigo-600 ring-2 ring-indigo-600 shadow-md' : 'border-slate-200 shadow-sm'
            }`}
          >
            <div>
              {plan.current && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full mb-3 inline-block">
                  Pelan Semasa
                </span>
              )}
              <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
              <div className="mt-3 flex items-baseline">
                <span className="text-3xl font-extrabold text-slate-900">{plan.price}</span>
                <span className="text-xs text-slate-500 ml-1">{plan.period}</span>
              </div>
              <p className="text-xs font-semibold text-indigo-600 mt-2">{plan.credits}</p>

              <ul className="mt-6 space-y-2.5 text-xs text-slate-600">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              className={`mt-6 w-full py-2.5 rounded-xl text-xs font-bold transition ${
                plan.current
                  ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {plan.current ? 'Urus Langganan' : 'Naik Taraf Pelan'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
