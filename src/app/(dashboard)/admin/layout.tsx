'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, ShieldCheck, Lock, Key, ArrowRight, LogOut } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [accessKey, setAccessKey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check server-side admin session status on mount
  const checkStatus = async () => {
    try {
      const res = await fetch('/api/auth/admin-login');
      const data = await res.json();
      setIsAuthenticated(Boolean(data.isAuthorized));
    } catch {
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessKey }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Pengesahan gagal');
      }

      setIsAuthenticated(true);
      setAccessKey('');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Kunci akses tidak sah.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLock = async () => {
    try {
      await fetch('/api/auth/admin-login', { method: 'DELETE' });
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
  };

  if (isAuthenticated === null) {
    return (
      <div className="p-12 text-center text-xs text-slate-400">
        Memeriksa kebenaran sesi pentadbir dengan pelayan selamat...
      </div>
    );
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
            Modul ini mengandungi alat QA dalaman, data kompilasi prompt dan kawalan enjin AffiMatik. Sila sahkan kelayakan pentadbir anda melalui sesi pelayan selamat.
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
                required
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
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>{isLoading ? 'Mengesahkan...' : 'Sahkan & Masuk'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">
          Disahkan secara kriptografi melalui HttpOnly secure session cookies. Tiada kelayakan disimpan dalam pelayar setempat (zero localStorage).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs text-amber-900">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Sesi Pentadbir Aktif:</strong> Anda mempunyai kebenaran penuh melihat audit enjin, Style Testing Lab, dan prompt compiler.
          </span>
        </div>
        <button
          onClick={handleLock}
          className="flex items-center gap-1 px-3 py-1 bg-white border border-amber-300 rounded-lg text-amber-800 font-semibold hover:bg-amber-100 transition cursor-pointer text-xs"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Kunci Semula</span>
        </button>
      </div>

      {children}
    </div>
  );
}
