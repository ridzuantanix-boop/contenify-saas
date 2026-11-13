'use client';

import React, { useState, useEffect } from 'react';
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
  Gift,
  BadgePercent,
  X,
  ImageIcon,
  BookMarked,
  Cloud,
  ContactRound,
  FolderOpen,
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Video Factory', href: '/factory', icon: Video, badge: 'Quick / Adv' },
  { name: 'Cloud Auto Factory', href: '/auto-factory', icon: Cloud, badge: 'V9' },
  { name: 'Creator Profiles', href: '/creator-profiles', icon: ContactRound },
  { name: 'Product Folders', href: '/product-folders', icon: FolderOpen },
  { name: 'Video Styles', href: '/styles', icon: Sparkles, badge: '20 Gaya' },
  { name: 'Program Affiliate', href: '/affiliate', icon: BadgePercent },
  { name: 'Product Library', href: '/products', icon: ShoppingBag },
  { name: 'Avatar Library', href: '/avatars', icon: Users },
  { name: 'Background Library', href: '/backgrounds', icon: ImageIcon },
  { name: 'Preset Library', href: '/presets', icon: BookMarked },
  { name: 'Video Library', href: '/library', icon: Film },
  { name: 'Production Queue', href: '/queue', icon: ListOrdered },
  { name: 'Posting Automation', href: '#', icon: Send, badge: 'Akan Datang', disabled: true },
  { name: 'Billing & Credits', href: '/billing', icon: CreditCard },
  { name: 'Tetapan Akaun', href: '/settings', icon: Settings },
  { name: 'Style Testing Lab', href: '/admin/styles', icon: ShieldCheck, badge: 'Admin' },
  { name: 'Kelulusan Affiliate', href: '/admin/affiliates', icon: ShieldCheck, badge: 'Owner' },
  { name: 'Pulih MP4 Lama', href: '/admin/recovery', icon: Film, badge: 'Owner' },
  { name: 'Refund & Clawback', href: '/admin/finance-ops', icon: CreditCard, badge: 'Owner' },
  { name: 'Admin Console', href: '/admin', icon: ShieldCheck, badge: 'Owner' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [balance, setBalance] = useState<number | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [role, setRole] = useState<string>('member');

  useEffect(() => {
    async function loadSidebarSession() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setIsAuthenticated(true);
            setRole(data.user.role || 'member');
            setWorkspaceName(data.user.fullName ? `${data.user.fullName.split(' ')[0]}'s Workspace` : 'Workspace Utama');
            if (data.wallet) {
              setBalance(data.wallet.balance);
            }
          }
        }
      } catch {
        // ignore
      }
    }
    loadSidebarSession();
  }, []);

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-slate-200 bg-white h-screen sticky top-0 shrink-0">
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
          if (item.badge === 'Owner' && role !== 'superadmin') return null;
          if (item.badge === 'Admin' && role !== 'superadmin' && role !== 'admin') return null;
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
        {isAuthenticated ? (
          <>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span>Ruang Kerja:</span>
              <span className="font-semibold text-slate-700 truncate max-w-[120px]">{workspaceName}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.max(10, ((balance || 0) / 50) * 100))}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-1.5 text-[11px] text-slate-500">
              <span>Baki: <strong className="text-slate-800">{balance !== null ? `${balance} Kredit` : '...'}</strong></span>
              <Link href="/billing" className="text-indigo-600 hover:underline font-semibold">
                Kredit
              </Link>
            </div>
          </>
        ) : (
          <div className="space-y-2 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-700">
              <Gift className="w-3.5 h-3.5 text-amber-500" />
              <span>Launch Pack RM19</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Daftar akaun sekarang untuk mula jana video secara automatik.
            </p>
            <Link
              href="/register"
              className="block w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold text-center transition shadow-2xs"
            >
              Cipta Akaun
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}

export function MobileSidebarDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const [balance, setBalance] = useState<number | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [role, setRole] = useState<string>('member');

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setIsAuthenticated(true);
            setRole(data.user.role || 'member');
            setWorkspaceName(data.user.fullName ? `${data.user.fullName.split(' ')[0]}'s Workspace` : 'Workspace Utama');
            if (data.wallet) {
              setBalance(data.wallet.balance);
            }
          }
        }
      } catch {
        // ignore
      }
    }
    if (isOpen) {
      loadSession();
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu Navigasi Mobile">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 left-0 max-w-[280px] w-full bg-white shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
        {/* Header with Close Button */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
              A
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-slate-900 text-sm">AffiMatik</span>
              <span className="ml-1.5 text-[9px] font-semibold uppercase px-1 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                Pawarna
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 -mr-1 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center transition"
            aria-label="Tutup Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation links with touch targets >= 44px */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Studio Utama
          </div>
          {NAV_ITEMS.map((item) => {
            if (item.badge === 'Owner' && role !== 'superadmin') return null;
            if (item.badge === 'Admin' && role !== 'superadmin' && role !== 'admin') return null;
            const isActive = pathname === item.href || (item.href !== '#' && pathname.startsWith(`${item.href}/`));
            const Icon = item.icon;
            if (item.disabled) {
              return (
                <div
                  key={item.name}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 opacity-60 min-h-[44px]"
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
                onClick={onClose}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition min-h-[44px] ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-500'}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    isActive ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Mobile Drawer Footer with Balance & Touch Affordance */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80">
          {isAuthenticated ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Ruang Kerja:</span>
                <span className="font-semibold text-slate-800 truncate max-w-[140px]">{workspaceName}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-600">Baki Kredit:</span>
                <span className="font-bold text-indigo-700">{balance !== null ? `${balance} Kredit` : '...'}</span>
              </div>
              <Link
                href="/billing"
                onClick={onClose}
                className="block w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold text-center transition min-h-[44px] flex items-center justify-center"
              >
                Urus Kredit & Langganan
              </Link>
            </div>
          ) : (
            <Link
              href="/register"
              onClick={onClose}
              className="block w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold text-center transition min-h-[44px] flex items-center justify-center"
            >
              Cipta Akaun AffiMatik
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
