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
  isAvailable?: boolean;
  error?: string;
}

interface RegisteredUser {
  id: string;
  emailMasked: string;
  fullName: string;
  whatsapp: string;
  tier: string;
  workspaceId: string;
  balance: number;
  createdAt: string;
  provisionStatus: 'provisioned' | 'pending';
}

interface Customer {
  userId: string;
  email: string;
  fullName?: string;
  whatsapp?: string;
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
  const [isAuthorized, setIsAuthorized] = useState<boolean>(true);
  const [adminAccessKey, setAdminAccessKey] = useState<string>('');
  const [unlockLoading, setUnlockLoading] = useState<boolean>(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Tabs: overview, users, activation
  const [adminTab, setAdminTab] = useState<'overview' | 'users' | 'activation'>('overview');

  // Registered users state
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [usersTotal, setUsersTotal] = useState<number>(0);
  const [isAuthoritativeData, setIsAuthoritativeData] = useState<boolean>(true);

  // Reconcile state
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileReport, setReconcileReport] = useState<any>(null);

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

  // Honest system status without fabricated latency numbers
  const providers = [
    { name: 'Nexabot Provider Adapter', type: 'AffiMatik Voice; status sebenar memerlukan ujian API', status: 'BELUM DISAHKAN' },
    { name: 'RunningHub Provider Adapter', type: 'AffiMatik Motion; status sebenar memerlukan ujian API', status: 'BELUM DISAHKAN' },
    { name: 'Supabase Storage', type: 'Storan imej dan video persendirian', status: 'BELUM DISAHKAN' },
    {
      name: 'PostgreSQL Database & Supabase Engine',
      type: 'Pangkalan Data Pengeluaran & RLS',
      status: metrics?.isAvailable === true ? 'Tersambung (Aktif)' : 'BELUM DISAHKAN',
    },
  ];

  async function loadUsers(query = '') {
    setIsLoadingUsers(true);
    try {
      const url = query.trim()
        ? `/api/admin/operations?view=users&search=${encodeURIComponent(query.trim())}`
        : `/api/admin/operations?view=users`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.users) {
          setRegisteredUsers(data.users);
          setUsersTotal(data.total || data.users.length);
          setIsAuthoritativeData(Boolean(data.isAuthoritative));
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingUsers(false);
    }
  }

  async function handleReconcileAccounts() {
    setIsReconciling(true);
    setReconcileReport(null);
    try {
      const res = await fetch('/api/admin/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reconcile_accounts' }),
      });
      const data = await res.json();
      if (res.ok && data.report) {
        setReconcileReport(data.report);
        await loadMetrics();
        await loadUsers(userSearchQuery);
      }
    } catch (err: unknown) {
      // ignore
    } finally {
      setIsReconciling(false);
    }
  }

  async function loadMetrics() {
    setIsLoadingMetrics(true);
    try {
      const res = await fetch('/api/admin/operations?view=metrics');
      if (res.ok) {
        const data = await res.json();
        if (data.metrics) {
          setMetrics(data.metrics);
          setIsAuthorized(true);
        }
      } else if (res.status === 401 || res.status === 403) {
        setIsAuthorized(false);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingMetrics(false);
    }
  }

  async function handleUnlockAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!adminAccessKey.trim()) return;
    setUnlockLoading(true);
    setUnlockError(null);
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessKey: adminAccessKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Kunci akses pentadbir tidak sah.');
      }
      setIsAuthorized(true);
      await loadMetrics();
    } catch (err: unknown) {
      setUnlockError(err instanceof Error ? err.message : 'Kunci akses tidak sah.');
    } finally {
      setUnlockLoading(false);
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

  if (!isAuthorized) {
    return (
      <div className="max-w-md mx-auto py-16 px-4">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-slate-900">Akses Terhad SuperAdmin</h3>
            <p className="text-xs text-slate-500">
              Sila masukkan Kunci Akses Pentadbir untuk mengakses panel kawalan, pemantauan kos, dan kelulusan pelanggan.
            </p>
          </div>

          {unlockError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 text-left">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{unlockError}</span>
            </div>
          )}

          <form onSubmit={handleUnlockAdmin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kunci Akses / Master Password
              </label>
              <input
                type="password"
                value={adminAccessKey}
                onChange={(e) => setAdminAccessKey(e.target.value)}
                placeholder="Masukkan kunci pentadbir..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                required
              />
            </div>
            <button
              type="submit"
              disabled={unlockLoading}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-sm cursor-pointer"
            >
              {unlockLoading ? 'Mengesahkan...' : 'Buka Akses Pentadbir'}
            </button>
          </form>
        </div>
      </div>
    );
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
            Pemantauan bajet percubaan 20 kredit untuk akaun baharu, pengaktifan manual pelanggan, dan kawalan penutupan checkout.
          </p>
        </div>

        <button
          type="button"
          onClick={loadMetrics}
          disabled={isLoadingMetrics}
          className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition min-h-[44px]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${(isLoadingMetrics || isLoadingUsers) ? 'animate-spin' : ''}`} />
          <span>Muat Semula</span>
        </button>
      </div>

      {/* Database Connection Alert (Honest status instead of false zeroes) */}
      {metrics?.isAvailable === false && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Pangkalan Data Pengeluaran Belum Disahkan / Terputus</strong>
              <span className="text-[11px] text-amber-800 leading-relaxed">
                {metrics.error || 'Sambungan ke pangkalan data Supabase pengeluaran belum dapat disahkan. Metrik langsung tidak dipalsukan sebagai sifar.'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={loadMetrics}
            className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 transition"
          >
            Uji Semula Sambungan
          </button>
        </div>
      )}

      {/* Admin Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setAdminTab('overview')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap min-h-[44px] ${
            adminTab === 'overview'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Ikhtisar & Perlindungan
        </button>
        <button
          type="button"
          onClick={() => {
            setAdminTab('users');
            loadUsers(userSearchQuery);
          }}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap min-h-[44px] flex items-center gap-1.5 ${
            adminTab === 'users'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Pengguna Berdaftar</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
            {usersTotal}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('activation')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap min-h-[44px] ${
            adminTab === 'activation'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Pengaktifan Pelanggan Manual
        </button>
      </div>

      {/* TAB 1: OVERVIEW & SPEND CONTROLS */}
      {adminTab === 'overview' && (
        <div className="space-y-6">
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
            <div className="text-[11px] text-emerald-600 mt-1">Akaun Baharu Layak 20 Kredit</div>
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
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm whitespace-nowrap self-start sm:self-auto min-h-[44px] ${
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

        {/* SECTION: PROVIDERS TELEMETRY TABLE */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">Status Komponen Enjin & Pangkalan Data</span>
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
              metrics?.isAvailable === false
                ? 'text-amber-700 bg-amber-50 border-amber-200'
                : 'text-emerald-700 bg-emerald-50 border-emerald-200'
            }`}>
              {metrics?.isAvailable === false ? 'Perlu Sambungan Pangkalan Data' : 'Semua Sistem Normal'}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {providers.map((p) => (
              <div key={p.name} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <div className="font-bold text-slate-900">{p.name}</div>
                  <div className="text-[11px] text-slate-500">{p.type}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full font-semibold text-[11px] ${
                    p.status.includes('Tersambung') || p.status.includes('Tersedia')
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* TAB 2: REGISTERED USERS LIST & RECONCILIATION */}
      {adminTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>Senarai Pengguna Berdaftar ({usersTotal})</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pengguna yang mendaftar akaun dengan nombor WhatsApp dan kelayakan 20 kredit percuma bagi akaun baharu.
              </p>
            </div>

            <button
              type="button"
              onClick={handleReconcileAccounts}
              disabled={isReconciling}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-2 self-start sm:self-auto min-h-[44px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin' : ''}`} />
              <span>{isReconciling ? 'Menyelaras Akaun...' : 'Selaras Akaun (Reconcile)'}</span>
            </button>
          </div>

          {/* Reconcile Outcome Banner */}
          {reconcileReport && (
            <div className={`p-4 rounded-xl text-xs space-y-1.5 ${
              reconcileReport.success
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border border-rose-200 text-rose-900'
            }`}>
              <div className="font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Laporan Penyelarasan Pangkalan Data Selesai</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                <div>Pengguna Diimbas: <strong>{reconcileReport.totalAuthUsersScanned}</strong></div>
                <div>Akaun Lengkap: <strong>{reconcileReport.completeAccounts}</strong></div>
                <div>Akaun Dipulihkan: <strong>{reconcileReport.orphansRecovered}</strong></div>
                <div>Dompet Diperuntukkan: <strong>{reconcileReport.walletsProvisioned}</strong></div>
              </div>
            </div>
          )}

          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={userSearchQuery}
              onChange={(e) => {
                setUserSearchQuery(e.target.value);
                loadUsers(e.target.value);
              }}
              placeholder="Cari mengikut nama, emel, atau WhatsApp..."
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white min-h-[44px]"
            />
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Nama Penuh</th>
                    <th className="py-3 px-4">Emel (Dilindungi)</th>
                    <th className="py-3 px-4">No. WhatsApp</th>
                    <th className="py-3 px-4">Pelan (Tier)</th>
                    <th className="py-3 px-4">Baki Kredit</th>
                    <th className="py-3 px-4">Tarikh Daftar</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingUsers ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Memuatkan senarai pengguna...
                      </td>
                    </tr>
                  ) : registeredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Tiada rekod pengguna berdaftar ditemui.
                      </td>
                    </tr>
                  ) : (
                    registeredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4 font-semibold text-slate-900">{u.fullName}</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600">{u.emailMasked}</td>
                        <td className="py-3 px-4 font-medium text-slate-800">{u.whatsapp}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {u.tier}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">{u.balance} kr</td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {new Date(u.createdAt).toLocaleDateString('ms-MY', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.provisionStatus === 'provisioned'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {u.provisionStatus === 'provisioned' ? 'Aktif' : 'Menunggu'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OWNER MANUAL ACTIVATION */}
      {adminTab === 'activation' && (
      <div className="space-y-4">
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
                {foundCustomer.whatsapp && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-slate-700 font-medium">WhatsApp: <strong className="text-slate-900">{foundCustomer.whatsapp}</strong></span>
                    <a
                      href={`https://wa.me/${foundCustomer.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold hover:bg-emerald-100 transition"
                    >
                      <span>WhatsApp Pelanggan</span>
                    </a>
                  </div>
                )}
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
                          else if (e.target.value === 'pro') setPaidAmountMyr(129);
                          else if (e.target.value === 'agency') setPaidAmountMyr(399);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        <option value="starter">Starter Creator (RM 49 • 100 Kredit)</option>
                        <option value="pro">Pro Creator (RM 129 • 300 Kredit)</option>
                        <option value="agency">Agency Studio (RM 399 • 1,000 Kredit)</option>
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
      )}
    </div>
  );
}
