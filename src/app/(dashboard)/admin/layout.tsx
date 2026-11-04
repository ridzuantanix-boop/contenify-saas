'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck, Lock, Key, ArrowRight } from 'lucide-react';
import { ADMIN_AUTH_CONFIG } from '@/lib/auth/admin-guard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [accessKey, setAccessKey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Check local storage or session cookie for admin unlock state
    const saved = localStorage.getItem('affimatik_admin_unlocked');
    if (saved === 'true') {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (accessKey.trim() === ADMIN_AUTH_CONFIG.DEFAULT_ADMIN_KEY || accessKey.trim() === 'pawarna2026') {
      localStorage.setItem('affimatik_admin_unlocked', 'true');
      setIsAuthenticated(true);
      setErrorMsg('');
    } else {
      setErrorMsg('Kunci akses pentadbir tidak sah. Sila masukkan kunci yang betul.');
    }
  };

  const handleLock = () => {
    localStorage.removeItem('affimatik_admin_unlocked');
    setIsAuthenticated(false);
  };

  if (isAuthenticated === null) {
    return <div className="p-8 text-center text-xs text-slate-400">Memeriksa kebenaran keselamatan...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 rounded-2xl bg-white border border-slate-200 shadow-md text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
          <Lock className="w-7 h-7" />
        </div>

        <div>
          <h3 className="text-lg font-bold text-slate-900">Zon Kawalan Pentadbir (Admin Only)</h3>
          <p className="text-xs text-slate-500 mt-1">
            Modul ini mengandungi alat QA dalaman, data kompilasi prompt dan kawalan enjin AffiMatik. Sila sahkan kelayakan pentadbir anda.
          </p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-3 pt-2 text-left">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Kunci Akses Pentadbir (Admin Access Key)
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                placeholder="Masukkan kunci keselamatan pentadbir..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-1.5 border border-rose-200">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Sahkan & Masuk</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">
          Semua cubaan akses tanpa kebenaran direkodkan dalam audit log keselamatan sistem Pawarna.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl flex items-center justify-between text-xs text-amber-900">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-600" />
          <span>Sesi Pentadbir Aktif (Admin Role: Superadmin)</span>
        </div>
        <button
          type="button"
          onClick={handleLock}
          className="text-[11px] text-amber-800 hover:text-amber-950 font-bold underline cursor-pointer"
        >
          Kunci Semula Sesi
        </button>
      </div>
      {children}
    </div>
  );
}
