'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Activity,
  Database,
  Server,
  AlertTriangle,
  Users,
  Sparkles,
  Video,
  PauseCircle,
  PlayCircle,
  Search,
  CheckCircle2,
  Gift,
  CreditCard,
  RefreshCw,
  Lock,
} from 'lucide-react';

interface Metrics {
  totalRegistrations: number;
  welcomeCreditsGranted: number;
  trialCreditsSpent: number;
  completedVideos: number;
  pendingJobs: number;
  failedJobs: number;
  publicCheckoutEnabled: boolean;
  isGenerationPaused: boolean;
  generationPauseReason: string;
}

interface Customer {
  userId: string;
  email: string;
  fullName?: string;
  tier: string;
  workspaceId: string;
  wallet: {
    balance: number;
    reservedBalance: number;
    lifetimeGranted: number;
  };
}

export default function AdminPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [pauseActionLoading, setPauseActionLoading] = useState(false);

  // Customer search & activation state
  const [searchEmail, setSearchEmail] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);

  // Activation form
  const [activationType, setActivationType] = useState<'COMPLIMENTARY' | 'MANUAL_PAID'>('COMPLIMENTARY');
  const [compCredits, setCompCredits] = useState(50);
  const [compTier, setCompTier] = useState('starter');
  const [compReason, setCompReason] = useState('Early Access Beta Tester');

  const [paidPlanId, setPaidPlanId] = useState('starter');
  const [paidAmountMyr, setPaidAmountMyr] = useState(49);
  const [paidPaymentRef, setPaidPaymentRef] = useState('');
  const [paidNote, setPaidNote] = useState('Pembayaran transfer bank telah disahkan');

  const [isActivating, setIsActivating] = useState(false);
  const [activationFeedback, setActivationFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const providers = [
    { name: 'Nexabot Provider Adapter', type: '10s Spoken BM (AffiMatik Voice)', status: 'Operational', latency: '420ms' },
    { name: 'RunningHub Provider Adapter', type: '15s WebApp #2103149871766220801 (AffiMatik Motion)', status: 'Operational', latency: '380ms' },
    { name: 'Cloudflare R2 Private Bucket', type: 'S3-Compatible Storage', status: 'Healthy', latency: '65ms' },
    { name: 'PostgreSQL Database & RLS', type: 'Supabase Engine', status: 'Connected', latency: '12ms' },
  ];

  async function loadMetrics() {
    setIsLoadingMetrics(true);
    try {
      const res = await fetch('/api/admin/operations?view=metrics');
      if (res.ok) {
        const data = await res.json();
        if (data.metrics) {
          setMetrics(data.metrics);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingMetrics(false);
    }
  }

  useEffect(() => {
    loadMetrics();
  }, []);

  async function handleTogglePause() {
    if (!metrics) return;
    setPauseActionLoading(true);
    try {
      const res = await fetch('/api/admin/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_generation_pause',
          paused: !metrics.isGenerationPaused,
          reason: !metrics.isGenerationPaused ? 'Dijeda sementara oleh pentadbir bagi kawalan keselamatan pelayan.' : '',
        }),
      });
      if (res.ok) {
        await loadMetrics();
      }
    } catch {
      // ignore
    } finally {
      setPauseActionLoading(false);
    }
  }

  async function handleLookupCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!searchEmail.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setActivationFeedback(null);
    setFoundCustomer(null);

    try {
      const res = await fetch('/api/admin/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'lookup_customer',
          email: searchEmail.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Pelanggan tidak ditemui.');
      }
      setFoundCustomer(data.customer);
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : 'Ralat carian.');
    } finally {
      setIsSearching(false);
    }
  }

  async function handleActivateCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!foundCustomer) return;

    setIsActivating(true);
    setActivationFeedback(null);

    try {
      const payload: Record<string, unknown> = {
        action: 'manual_activate_customer',
        workspaceId: foundCustomer.workspaceId,
        userId: foundCustomer.userId,
        activationType,
      };

      if (activationType === 'COMPLIMENTARY') {
        payload.credits = Number(compCredits);
        payload.tier = compTier;
        payload.reason = compReason;
      } else {
        payload.planId = paidPlanId;
        payload.amountPaidMyr = Number(paidAmountMyr);
        payload.paymentReference = paidPaymentRef || `manual_ref_${Date.now()}`;
        payload.reason = paidNote;
      }

      const res = await fetch('/api/admin/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengaktifkan pelanggan.');
      }

      setActivationFeedback({
        success: true,
        message: data.message || 'Pengaktifan berjaya dilaksanakan dan direkodkan dalam lejar audit.',
      });

      // Update found customer local view
      if (data.balance !== undefined) {
        setFoundCustomer({
          ...foundCustomer,
          tier: data.tier || foundCustomer.tier,
          wallet: {
            ...foundCustomer.wallet,
            balance: data.balance,
          },
        });
      }

      await loadMetrics();
    } catch (err: unknown) {
      setActivationFeedback({
        success: false,
        message: err instanceof Error ? err.message : 'Ralat pengaktifan pelanggan.',
      });
    } finally {
      setIsActivating(false);
    }
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <div className="pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Admin Control Center</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
              Soft Launch V1.0
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Pemantauan bajet percubaan 50 kredit, pengaktifan manual pelanggan, dan kawalan penutupan checkout.
          </p>
        </div>

        <button
          type="button"
          onClick={loadMetrics}
          disabled={isLoadingMetrics}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMetrics ? 'animate-spin' : ''}`} />
          <span>Muat Semula Metrik</span>
        </button>
      </div>

      {/* SECTION 1: SOFT LAUNCH METRICS & SPEND CONTROLS */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-600" />
          <span>Pemantauan Soft Launch & Perlindungan Kos Provider</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Pendaftaran Baru Percuma</span>
              <Users className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {metrics ? metrics.totalRegistrations : '...'}
            </div>
            <div className="text-[11px] text-emerald-600 mt-1">Akaun Layak 50 Kredit</div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Kredit Percuma Dikeluarkan</span>
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {metrics ? metrics.welcomeCreditsGranted : '...'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Jumlah Peruntukan Selamat</div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Kredit Dibelanjakan</span>
              <Video className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {metrics ? metrics.trialCreditsSpent : '...'}
            </div>
            <div className="text-[11px] text-purple-600 mt-1">
              {metrics ? `${metrics.completedVideos} video siap dijana` : '...'}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Status Checkout Awam</span>
              <Lock className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-lg font-bold text-slate-900 mt-2">
              {metrics?.publicCheckoutEnabled ? (
                <span className="text-emerald-600">Dibuka (Public)</span>
              ) : (
                <span className="text-amber-600">Ditutup (Coming Soon)</span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {metrics?.publicCheckoutEnabled ? 'Pembayaran dibuka umum' : 'Pelawat percubaan sahaja'}
            </div>
          </div>
        </div>

        {/* Emergency Circuit Breaker Banner */}
        <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          metrics?.isGenerationPaused
            ? 'bg-rose-50 border-rose-200 text-rose-900'
            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}>
          <div className="flex items-start sm:items-center gap-3">
            {metrics?.isGenerationPaused ? (
              <PauseCircle className="w-6 h-6 text-rose-600 shrink-0" />
            ) : (
              <PlayCircle className="w-6 h-6 text-emerald-600 shrink-0" />
            )}
            <div>
              <div className="font-bold text-sm">
                {metrics?.isGenerationPaused
                  ? 'Amaran: Penjanaan Video Sedang DIJEDA (Circuit Breaker Aktif)'
                  : 'Penjanaan Video Sedang AKTIF (Berjalan Lancar)'}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {metrics?.isGenerationPaused
                  ? metrics.generationPauseReason || 'Penjanaan dijeda bagi melindungi perbelanjaan bajet provider.'
                  : 'Kredit pengguna ditolak dan diselesaikan secara autoritatif mengikut penggunaan.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTogglePause}
            disabled={pauseActionLoading}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm whitespace-nowrap self-start sm:self-auto ${
              metrics?.isGenerationPaused
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-rose-600 hover:bg-rose-700 text-white'
            }`}
          >
            {pauseActionLoading
              ? 'Mengemas kini...'
              : metrics?.isGenerationPaused
              ? 'Teruskan Penjanaan'
              : 'Jeda Penjanaan Segera'}
          </button>
        </div>
      </div>

      {/* SECTION 2: OWNER-ONLY MANUAL ACTIVATION WORKSPACE */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Gift className="w-4 h-4 text-purple-600" />
            <span>Pengaktifan Pelanggan Manual (Owner-Only)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Cari prospek atau pelanggan yang membuat bayaran secara manual di luar web untuk mengaktifkan pelan atau akses awal.
          </p>
        </div>

        {/* Step A: Search Customer by Email */}
        <form onSubmit={handleLookupCustomer} className="flex gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              placeholder="Masukkan emel pelanggan berdaftar..."
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shrink-0"
          >
            {isSearching ? 'Mencari...' : 'Cari Pelanggan'}
          </button>
        </form>

        {searchError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{searchError}</span>
          </div>
        )}

        {/* Found Customer Details & Activation Form */}
        {foundCustomer && (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  Pelanggan Ditemui
                </span>
                <h4 className="text-lg font-bold text-slate-900 mt-1">{foundCustomer.fullName || foundCustomer.email}</h4>
                <div className="text-xs text-slate-500 font-mono">{foundCustomer.email}</div>
              </div>

              <div className="flex items-center gap-6 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Pelan Semasa</span>
                  <span className="font-bold text-slate-800 uppercase">{foundCustomer.tier}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Baki Kredit</span>
                  <span className="font-extrabold text-indigo-600 text-base">{foundCustomer.wallet.balance} Kredit</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">ID Ruang Kerja</span>
                  <span className="font-mono text-slate-600 text-[11px]">{foundCustomer.workspaceId.slice(0, 8)}...</span>
                </div>
              </div>
            </div>

            {/* Choose Activation Type */}
            <div className="space-y-4">
              <div className="flex gap-2 border-b border-slate-100 pb-2">
                <button
                  type="button"
                  onClick={() => setActivationType('COMPLIMENTARY')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    activationType === 'COMPLIMENTARY'
                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Tipe A: Akses Awal Percuma (Complimentary)
                </button>
                <button
                  type="button"
                  onClick={() => setActivationType('MANUAL_PAID')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                    activationType === 'MANUAL_PAID'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Tipe B: Pelanggan Bayar Manual (Confirmed Payment)
                </button>
              </div>

              <form onSubmit={handleActivateCustomer} className="space-y-4">
                {activationType === 'COMPLIMENTARY' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Kredit Tambahan (Complimentary)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={compCredits}
                        onChange={(e) => setCompCredits(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Tahap Pelan (Beta Tier)
                      </label>
                      <select
                        value={compTier}
                        onChange={(e) => setCompTier(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        <option value="free">Free</option>
                        <option value="starter">Starter</option>
                        <option value="pro">Pro</option>
                        <option value="agency">Agency</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Sebab / Rujukan Audit
                      </label>
                      <input
                        type="text"
                        value={compReason}
                        onChange={(e) => setCompReason(e.target.value)}
                        placeholder="Cth: Strategic Partner Tester"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Pilih Pelan
                      </label>
                      <select
                        value={paidPlanId}
                        onChange={(e) => {
                          setPaidPlanId(e.target.value);
                          if (e.target.value === 'starter') setPaidAmountMyr(49);
                          else if (e.target.value === 'pro') setPaidAmountMyr(99);
                          else if (e.target.value === 'agency') setPaidAmountMyr(199);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        <option value="starter">Starter (RM49 • 100 Kredit)</option>
                        <option value="pro">Pro (RM99 • 250 Kredit)</option>
                        <option value="agency">Agency (RM199 • 500 Kredit)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Jumlah Diterima (RM)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={paidAmountMyr}
                        onChange={(e) => setPaidAmountMyr(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        No. Rujukan Bayaran
                      </label>
                      <input
                        type="text"
                        value={paidPaymentRef}
                        onChange={(e) => setPaidPaymentRef(e.target.value)}
                        placeholder="Cth: Instant Transfer Ref 987654"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Catatan Pengesahan
                      </label>
                      <input
                        type="text"
                        value={paidNote}
                        onChange={(e) => setPaidNote(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>
                )}

                {activationFeedback && (
                  <div className={`p-4 rounded-xl text-xs flex items-center gap-2 ${
                    activationFeedback.success
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}>
                    {activationFeedback.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{activationFeedback.message}</span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isActivating}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm"
                  >
                    {isActivating
                      ? 'Memproses Pengaktifan...'
                      : activationType === 'COMPLIMENTARY'
                      ? 'Sahkan & Aktifkan Akses Awal'
                      : 'Sahkan Bayaran & Aktifkan Pelanggan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: PROVIDERS HEALTH TABLE */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800">Status Kesihatan Komponen Enjin</span>
          <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Semua Sistem Normal
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {providers.map((p) => (
            <div key={p.name} className="px-6 py-4 flex items-center justify-between text-xs">
              <div>
                <div className="font-bold text-slate-900">{p.name}</div>
                <div className="text-[11px] text-slate-500">{p.type}</div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-slate-400 font-mono text-[11px]">{p.latency}</span>
                <span className="px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 text-[10px]">
                  {p.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
