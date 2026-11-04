'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, Bell, HelpCircle, LogOut, LogIn, Gift } from 'lucide-react';

export function Header() {
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [user, setUser] = useState<{ fullName?: string; email: string; tier?: string } | null>(null);

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setUser(data.user);
            if (data.wallet) {
              setBalance(data.wallet.balance);
            }
          } else {
            setUser(null);
            setBalance(null);
          }
        }
      } catch {
        setUser(null);
      }
    }
    loadSession();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
    } catch {
      // ignore
    }
    setUser(null);
    setBalance(null);
    router.push('/');
    router.refresh();
  };

  const displayName = user?.fullName || user?.email?.split('@')[0] || '';
  const displayTier = user?.tier ? `${user.tier.toUpperCase()} Member` : 'Free Plan';

  return (
    <header className="h-16 border-b border-slate-200 bg-white px-6 sm:px-8 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <h1 className="text-xs sm:text-sm font-medium text-slate-500">
          Penjana Video AI Pasaran Malaysia &mdash; <span className="text-slate-800 font-semibold">10s & 15s Cloud Engine</span>
        </h1>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {user ? (
          <>
            {/* Credits Pill */}
            <Link
              href="/billing"
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Baki: <strong>{balance !== null ? `${balance} Kredit` : '...'}</strong></span>
            </Link>

            {/* Support */}
            <button
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer hidden sm:block"
              title="Bantuan & Panduan"
              type="button"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* User Pill with Logout */}
            <div className="flex items-center gap-2 sm:gap-3 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-indigo-700 text-white flex items-center justify-center text-xs font-semibold uppercase shrink-0">
                {displayName.substring(0, 2).toUpperCase() || 'U'}
              </div>
              <div className="hidden md:block text-left max-w-[140px]">
                <div className="text-xs font-semibold text-slate-800 truncate">{displayName}</div>
                <div className="text-[10px] text-slate-400 truncate">{displayTier}</div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                title="Log Keluar Akaun"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition flex items-center gap-1"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Log Masuk</span>
            </Link>
            <Link
              href="/register"
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5"
            >
              <Gift className="w-3.5 h-3.5 text-amber-300" />
              <span>Daftar (50 Kredit)</span>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
