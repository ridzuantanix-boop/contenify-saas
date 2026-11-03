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
  Settings,
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Video Factory', href: '/factory', icon: Video, badge: 'Quick / Adv' },
  { name: 'Product Library', href: '/products', icon: ShoppingBag },
  { name: 'Avatar Library', href: '/avatars', icon: Users },
  { name: 'Prompt Library', href: '/prompts', icon: Sparkles },
  { name: 'Production Queue', href: '/queue', icon: ListOrdered },
  { name: 'Video Library', href: '/library', icon: Film },
  { name: 'Billing & Pelan', href: '/billing', icon: CreditCard },
  { name: 'Admin & Health', href: '/admin', icon: ShieldCheck },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col h-screen sticky top-0 shrink-0">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-100 gap-3">
        <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
          C
        </div>
        <div>
          <span className="font-bold tracking-tight text-slate-900 text-lg">CONTENIFY</span>
          <span className="ml-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
            MY v0.1
          </span>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Studio Utama
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
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
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-normal">
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
