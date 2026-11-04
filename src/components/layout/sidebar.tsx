'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Video,
  ShoppingBag,
  Users,
  Sparkles,
  ListOrdered,
  Film,
  CreditCard,
  ShieldCheck,
  Send,
  Sliders,
  Settings,
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Video Factory', href: '/factory', icon: Video, badge: 'Quick / Adv' },
  { name: 'Video Styles', href: '/styles', icon: Sparkles, badge: '12 Gaya' },
  { name: 'Product Library', href: '/products', icon: ShoppingBag },
  { name: 'Avatar Library', href: '/avatars', icon: Users },
  { name: 'Video Library', href: '/library', icon: Film },
  { name: 'Production Queue', href: '/queue', icon: ListOrdered },
  { name: 'Posting Automation', href: '#', icon: Send, badge: 'Akan Datang', disabled: true },
  { name: 'Billing & Credits', href: '/billing', icon: CreditCard },
  { name: 'Style Testing Lab', href: '/admin/styles', icon: ShieldCheck, badge: 'Admin' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col h-screen sticky top-0 shrink-0">
      {/* Brand Header */}
      <div className="h-18 flex items-center px-5 border-b border-slate-100 gap-3 py-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-md shrink-0">
          A
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold tracking-tight text-slate-900 text-base">AffiMatik</span>
            <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              Pawarna
            </span>
          </div>
          <span className="text-[10px] text-slate-500 truncate font-medium">
            Affiliate Jadi Automatik
          </span>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Studio Utama
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '#' && pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;
          if (item.disabled) {
            return (
              <div
                key={item.name}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-slate-400 opacity-70 cursor-not-allowed select-none"
                title="Ciri ini akan dilancarkan tidak lama lagi"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-slate-400" />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                    {item.badge}
                  </span>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${
                  isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Workspace & Footer */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
          <span>Ruang Kerja:</span>
          <span className="font-medium text-slate-700">Workspace Utama</span>
        </div>
        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-600 rounded-full w-2/5" />
        </div>
        <div className="flex justify-between items-center mt-1.5 text-[11px] text-slate-500">
          <span>Kredit: 10 / 25</span>
          <Link href="/billing" className="text-indigo-600 hover:underline font-medium">
            Top-up
          </Link>
        </div>
      </div>
    </aside>
  );
}
