'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Boxes,
  Users as UsersIcon,
  Layers,
  Activity,
  CheckCircle2,
  RotateCcw,
  ShoppingBag,
  CalendarCheck,
  Ticket,
  LogOut,
  Menu,
  X,
  AlertTriangle,
  HelpCircle,
  ChevronRight,
  Shield,
  UserCheck,
  ArrowRightLeft,
  Clock,
} from 'lucide-react';
import { User, UserRole } from '@/types';

interface AppShellProps {
  children: React.ReactNode;
  activeMenu?: string;
}

export default function AppShell({ children, activeMenu }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) throw new Error('Not authenticated');
        return res.json();
      })
      .then((data) => {
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
          try {
            localStorage.setItem('pigeon_last_user', JSON.stringify(data.user));
          } catch {}
        } else {
          router.push('/');
        }
      })
      .catch(() => {
        router.push('/');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  const getDashboardHome = (role?: UserRole) => {
    if (role === 'Admin') return '/admin';
    if (role === 'Supervisor') return '/supervisor';
    return '/user';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-pigeon-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 font-medium text-sm">Memuat PIGEON...</p>
        </div>
      </div>
    );
  }

  const role = currentUser?.role || 'User';

  // Navigation Items by Role
  const navItems = [
    // Admin Only
    {
      name: 'Overview Dashboard',
      href: '/admin?tab=overview',
      icon: Activity,
      roles: ['Admin'],
    },
    {
      name: 'Kelola Pengguna & Whitelist',
      href: '/admin?tab=users',
      icon: UsersIcon,
      roles: ['Admin'],
    },
    {
      name: 'Manajemen Inventaris & Transfer',
      href: '/admin?tab=inventory',
      icon: Boxes,
      roles: ['Admin'],
    },
    {
      name: 'Persetujuan Peminjaman',
      href: '/admin?tab=approvals',
      icon: CheckCircle2,
      roles: ['Admin'],
    },
    {
      name: 'Pemeriksaan Kembali & Sanksi',
      href: '/admin?tab=returns',
      icon: RotateCcw,
      roles: ['Admin'],
    },
    {
      name: 'Sistem Pemantauan (Monitoring)',
      href: '/admin?tab=monitoring',
      icon: Layers,
      roles: ['Admin'],
    },

    // Supervisor Navigation
    {
      name: 'Supervisor Dashboard',
      href: '/supervisor?tab=overview',
      icon: Activity,
      roles: ['Supervisor'],
    },
    {
      name: 'Katalog Barang (View Only)',
      href: '/supervisor?tab=inventory',
      icon: Boxes,
      roles: ['Supervisor'],
    },
    {
      name: 'Pinjam & Reservasi Barang',
      href: '/supervisor?tab=borrow',
      icon: ShoppingBag,
      roles: ['Supervisor'],
    },
    {
      name: 'Persetujuan Request',
      href: '/supervisor?tab=approvals',
      icon: CheckCircle2,
      roles: ['Supervisor'],
    },
    {
      name: 'Pemeriksaan Kembali & Sanksi',
      href: '/supervisor?tab=returns',
      icon: RotateCcw,
      roles: ['Supervisor'],
    },
    {
      name: 'Pemantauan Stok & Overdue',
      href: '/supervisor?tab=monitoring',
      icon: Layers,
      roles: ['Supervisor'],
    },

    // User Navigation
    {
      name: 'Peminjaman Saya',
      href: '/user?tab=borrow',
      icon: Activity,
      roles: ['User'],
    },
    {
      name: 'Katalog Barang (Lab 1 & 2)',
      href: '/user?tab=inventory',
      icon: Boxes,
      roles: ['User'],
    },
    {
      name: 'Peminjaman Langsung',
      href: '/user?tab=borrow',
      icon: ShoppingBag,
      roles: ['User'],
    },
    {
      name: 'Reservasi Terjadwal',
      href: '/user?tab=reserve',
      icon: CalendarCheck,
      roles: ['User'],
    },
    {
      name: 'Tiket Saya (PGE-XXXX)',
      href: '/user?tab=tickets',
      icon: Ticket,
      roles: ['User'],
    },
    {
      name: 'Pengembalian Barang',
      href: '/user?tab=return',
      icon: RotateCcw,
      roles: ['User'],
    },
    {
      name: 'Riwayat Tiket',
      href: '/user?tab=history',
      icon: Clock,
      roles: ['User'],
    },
  ];

  const visibleNav = navItems.filter((item) => item.roles.includes(role));

  const homeHref = role === 'Admin' ? '/admin?tab=overview' : role === 'Supervisor' ? '/supervisor?tab=overview' : '/user?tab=borrow';
  const homeTab = role === 'User' ? 'borrow' : 'overview';

  const handleNavClick = (itemHref: string) => {
    try {
      const url = new URL(itemHref, 'http://localhost');
      const tab = url.searchParams.get('tab') || homeTab;
      window.dispatchEvent(new CustomEvent('pigeon:set-tab', { detail: tab }));
    } catch {}
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pigeon-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            P
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm tracking-wide">PIGEON</h1>
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live
              </span>
            </div>
            <p className="text-[10px] text-slate-400">ICT Lab 1 & 2 Organizer</p>
          </div>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-300 hover:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-pigeon-500"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Desktop / Tablet Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-200 border-r border-slate-800 shrink-0 sticky top-0 h-screen select-none">
        {/* Brand */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pigeon-600 text-white flex items-center justify-center font-black text-xl shadow-md">
              P
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-white text-lg tracking-wider">PIGEON</span>
                <span className="text-[10px] bg-pigeon-500/20 text-pigeon-400 font-medium px-1.5 py-0.5 rounded border border-pigeon-500/30">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">Sekolah Mutiara Bangsa</p>
              <div className="mt-1.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Live Realtime</span>
              </div>
            </div>
          </div>
        </div>

        {/* User Card */}
        <div className="p-4 mx-3 my-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-full bg-slate-700 text-pigeon-400 font-bold flex items-center justify-center text-sm border border-slate-600">
              {currentUser?.name.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="font-semibold text-white text-xs truncate">{currentUser?.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{currentUser?.email}</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-700/50">
            <span className="text-slate-400">Role:</span>
            <span
              className={`px-2 py-0.5 rounded font-medium text-[10px] uppercase tracking-wider ${
                role === 'Admin'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : role === 'Supervisor'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {role}
            </span>
          </div>

          {currentUser?.penalty_status && currentUser.penalty_status !== 'None' && (
            <div className="mt-2 text-[10px] bg-red-950/60 border border-red-700/50 text-red-300 p-1.5 rounded flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="truncate">Sanksi: {currentUser.penalty_status}</span>
            </div>
          )}
        </div>

        {/* Navigation links */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <Link
            href={homeHref}
            onClick={() => handleNavClick(homeHref)}
            className="flex items-center justify-between px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 hover:text-white hover:bg-slate-800/60 uppercase tracking-wider transition-colors cursor-pointer group mb-1"
            title="Kembali ke Menu Utama / Dashboard Overview"
          >
            <span>Menu Utama</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
          </Link>
          {visibleNav.map((item, idx) => {
            const Icon = item.icon;
            const isSelected = activeMenu ? activeMenu === item.name : pathname === item.href;
            return (
              <Link
                key={idx}
                href={item.href}
                onClick={() => handleNavClick(item.href)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-pigeon-600 text-white shadow-sm font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Session Loop / Footer Navigation */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          <button
            onClick={() => setShowSessionModal(true)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700/80 rounded-lg transition-colors"
          >
            <span className="flex items-center gap-2">
              <HelpCircle className="w-3.5 h-3.5 text-pigeon-400" />
              <span>Selesai Aksi?</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-950/30 hover:text-red-300 rounded-lg border border-red-900/30 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar (Logout)</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer (Hamburger Menu) */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm flex">
          <div className="w-4/5 max-w-xs bg-slate-900 text-white h-full flex flex-col p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-pigeon-600 text-white flex items-center justify-center font-bold">
                  P
                </div>
                <span className="font-bold text-base">PIGEON Menu</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User details */}
            <div className="my-3 p-3 bg-slate-800 rounded-xl">
              <p className="text-xs font-bold text-white truncate">{currentUser?.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{currentUser?.email}</p>
              <span className="mt-2 inline-block px-2 py-0.5 text-[10px] font-semibold rounded bg-pigeon-500/20 text-pigeon-300">
                ROLE: {role}
              </span>
            </div>

            {/* Mobile Nav Links */}
            <div className="flex-1 overflow-y-auto space-y-1 py-2">
              <Link
                href={homeHref}
                onClick={() => handleNavClick(homeHref)}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white uppercase tracking-wider transition-colors"
              >
                <span>Menu Utama</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
              {visibleNav.map((item, idx) => {
                const Icon = item.icon;
                const isSelected = activeMenu ? activeMenu === item.name : pathname === item.href;
                return (
                  <Link
                    key={idx}
                    href={item.href}
                    onClick={() => handleNavClick(item.href)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-pigeon-600 text-white shadow-sm font-semibold'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-pigeon-400'}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* Mobile Footer */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowSessionModal(true);
                }}
                className="w-full py-2 bg-slate-800 text-xs font-medium rounded-lg text-slate-300"
              >
                Another Action? (Sesi)
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-red-400 bg-red-950/40 rounded-lg border border-red-800/40"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>

      {/* Session Loop Modal: "Another Action?" */}
      {showSessionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-pigeon-100 text-pigeon-700 rounded-full flex items-center justify-center mx-auto mb-3">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Apakah ingin melakukan aksi lain?</h3>
            <p className="text-xs text-slate-500 mb-6">
              Sesuai alur sistem PIGEON, Anda dapat kembali ke Dashboard utama untuk melakukan tugas lain, atau
              mengakhiri sesi (Logout).
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setShowSessionModal(false);
                  router.push(getDashboardHome(currentUser?.role));
                }}
                className="w-full py-2.5 px-4 bg-pigeon-600 hover:bg-pigeon-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
              >
                Ya, Kembali ke Dashboard
              </button>
              <button
                onClick={handleLogout}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
              >
                Tidak, Logout Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
