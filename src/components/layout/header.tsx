'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, Bell, HelpCircle } from 'lucide-react';

export function Header() {
  const [balance, setBalance] = useState<number | null>(null);
  const [userName, setUserName] = useState<string>('AffiMatik Creator');
  const [userTier, setUserTier] = useState<string>('Pro Creator');

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data.wallet) {
            setBalance(data.wallet.balance);
          }
          if (data.user) {
            setUserName(data.user.fullName || data.user.email);
            setUserTier(`${data.user.tier?.toUpperCase()} Member`);
          }
        }
      } catch {
        // ignore
      }
    }
    loadSession();
  }, []);

  return (
    <header className="h-16 border-b border-slate-200 bg-white px-8 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-medium text-slate-500">
          Penjana Video AI Pasaran Malaysia &mdash; <span className="text-slate-800 font-semibold">10s & 15s Cloud Engine</span>
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Credits Pill */}
        <Link
          href="/billing"
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>Baki: <strong>{balance !== null ? `${balance} Kredit` : '...'}</strong></span>
        </Link>

        {/* Support */}
        <button
          className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer"
          title="Bantuan & Panduan"
          type="button"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Notifications */}
        <button
          className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 relative cursor-pointer"
          title="Notifikasi"
          type="button"
        >
          <Bell className="w-4 h-4" />
          <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-2 right-2 ring-2 ring-white" />
        </button>

        {/* User Pill */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-indigo-700 text-white flex items-center justify-center text-xs font-semibold">
            {userName.substring(0, 2).toUpperCase()}
          </div>
          <div className="hidden md:block text-left">
            <div className="text-xs font-semibold text-slate-800">{userName}</div>
            <div className="text-[10px] text-slate-400">{userTier}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
