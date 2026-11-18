'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  AlertOctagon,
  ArrowRight,
  QrCode,
  CheckCircle,
  Building2,
  Lock,
  UserCheck,
  Sparkles,
  Info,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import { createClient } from '@/lib/supabase-client';
import { User } from '@/types';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showGoogleGuide, setShowGoogleGuide] = useState(false);

  // Last Login & Quick Resume States
  const [lastUser, setLastUser] = useState<User | null>(null);
  const [hasActiveSession, setHasActiveSession] = useState(false);

  const [gateError, setGateError] = useState<{
    code: 'INVALID_DOMAIN' | 'NOT_WHITELISTED' | 'SERVER_ERROR' | null;
    title: string;
    message: string;
    email?: string;
  } | null>(null);

  // Check last login and active session on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setLastUser(data.user);
          setHasActiveSession(true);
          try {
            localStorage.setItem('pigeon_last_user', JSON.stringify(data.user));
          } catch {}
        } else {
          try {
            const saved = localStorage.getItem('pigeon_last_user');
            if (saved) {
              setLastUser(JSON.parse(saved));
            }
          } catch {}
        }
      })
      .catch(() => {
        try {
          const saved = localStorage.getItem('pigeon_last_user');
          if (saved) {
            setLastUser(JSON.parse(saved));
          }
        } catch {}
      });
  }, []);

  // Check URL params from OAuth callback redirects
  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam) {
      setGoogleLoading(true);
      window.location.replace(`/auth/callback?code=${encodeURIComponent(codeParam)}`);
      return;
    }

    const errorParam = searchParams.get('error');
    const emailParam = searchParams.get('email') || '';
    const messageParam = searchParams.get('message') || '';

    if (errorParam === 'INVALID_DOMAIN') {
      setGateError({
        code: 'INVALID_DOMAIN',
        title: 'Access Denied: Domain Tidak Valid',
        message: `Email Google Anda (${emailParam || 'akun luar'}) tidak menggunakan domain resmi @mutiarabangsa.sch.id.`,
        email: emailParam,
      });
    } else if (errorParam === 'NOT_WHITELISTED') {
      setGateError({
        code: 'NOT_WHITELISTED',
        title: 'Access Denied: Email tidak ada di Whitelist',
        message: `Akun Google Anda (${emailParam}) berhasil diverifikasi, namun belum terdaftar di daftar Whitelist pengguna PIGEON. Silakan hubungi Admin ICT.`,
        email: emailParam,
      });
    } else if (errorParam === 'AUTH_ERROR') {
      setGateError({
        code: 'SERVER_ERROR',
        title: 'Otentikasi Google Gagal',
        message: messageParam || 'Terjadi kesalahan saat otentikasi Google.',
      });
    }
  }, [searchParams]);

  // Real Google Sign-In via Supabase OAuth
  const handleRealGoogleSignIn = async () => {
    setGoogleLoading(true);
    setGateError(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
            hd: 'mutiarabangsa.sch.id', // Restricts/suggests @mutiarabangsa.sch.id in Google Account selector
          },
        },
      });

      if (error) {
        if (
          error.message?.toLowerCase().includes('provider is not enabled') ||
          error.message?.toLowerCase().includes('unsupported provider')
        ) {
          setShowGoogleGuide(true);
        } else {
          setGateError({
            code: 'SERVER_ERROR',
            title: 'Google OAuth Provider Perlu Diaktifkan',
            message: `Pesan Supabase: ${error.message}. Harap aktifkan Google Provider di Dashboard Supabase.`,
          });
        }
      }
    } catch (err: any) {
      setGateError({
        code: 'SERVER_ERROR',
        title: 'Gagal Membuka Google Sign-In',
        message: err.message || 'Terjadi kesalahan jaringan.',
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  // Quick Simulation Auth for Testing
  const handleGateAuth = async (emailToTest: string, nameToTest?: string) => {
    setLoading(true);
    setGateError(null);

    try {
      const res = await fetch('/api/auth/gate-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToTest, name: nameToTest || 'User' }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.code === 'INVALID_DOMAIN') {
          setGateError({
            code: 'INVALID_DOMAIN',
            title: 'Access Denied: Domain Tidak Valid',
            message: data.message || 'Hanya alamat email berakhiran @mutiarabangsa.sch.id yang diizinkan.',
          });
        } else if (data.code === 'NOT_WHITELISTED') {
          setGateError({
            code: 'NOT_WHITELISTED',
            title: 'Access Denied: Email tidak ada di Whitelist',
            message: data.message || 'Email Anda belum terdaftar di dalam database Whitelist pengguna PIGEON.',
          });
        } else {
          setGateError({
            code: 'SERVER_ERROR',
            title: 'Otentikasi Gagal',
            message: data.message || 'Terjadi gangguan saat memverifikasi kredensial.',
          });
        }
        return;
      }

      if (data.user) {
        setLastUser(data.user);
        setHasActiveSession(true);
        try {
          localStorage.setItem('pigeon_last_user', JSON.stringify(data.user));
        } catch {}
      }

      router.push(data.redirectUrl);
    } catch (err: any) {
      setGateError({
        code: 'SERVER_ERROR',
        title: 'Kesalahan Jaringan',
        message: err.message || 'Gagal menghubungi server.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Resume last login directly with 1 click
  const handleResumeLastLogin = async () => {
    if (!lastUser) return;
    if (hasActiveSession) {
      let dest = '/user';
      if (lastUser.role === 'Admin') dest = '/admin';
      else if (lastUser.role === 'Supervisor') dest = '/supervisor';
      router.push(dest);
      return;
    }
    await handleGateAuth(lastUser.email, lastUser.name);
  };

  // Clear last login session to switch account
  const handleClearLastLogin = async () => {
    try {
      localStorage.removeItem('pigeon_last_user');
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setLastUser(null);
    setHasActiveSession(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-slate-100 flex flex-col justify-between p-4 md:p-8">
      {/* Top Navbar */}
      <nav className="max-w-6xl mx-auto w-full flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pigeon-600 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-pigeon-500/30">
            P
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-wider text-white">PIGEON</h1>
            <p className="text-xs text-slate-400">ICT Lab 1 & 2 Organizer • Sekolah Mutiara Bangsa</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGoogleGuide(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-pigeon-400 border border-slate-700 transition"
          >
            <Info className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Setup Google OAuth</span>
          </button>

          <button
            onClick={() => setShowQrModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition"
          >
            <QrCode className="w-4 h-4 text-pigeon-400" />
            <span className="hidden sm:inline">QR Entry Point</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto w-full my-auto py-8">
        {/* If Gate Check Error Screen is active */}
        {gateError ? (
          <div className="bg-slate-900/90 border border-red-500/50 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl text-center max-w-xl mx-auto animate-in fade-in duration-200">
            <div className="w-16 h-16 bg-red-500/20 text-red-400 border border-red-500/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertOctagon className="w-8 h-8" />
            </div>

            <div className="inline-block px-3 py-1 bg-red-500/10 text-red-400 text-xs font-semibold rounded-full border border-red-500/20 mb-3">
              {gateError.code === 'INVALID_DOMAIN' ? 'Gate Check 1 Failed' : 'Gate Check 2 Failed'}
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">{gateError.title}</h2>
            <p className="text-sm text-slate-300 max-w-md mx-auto mb-6 leading-relaxed">
              {gateError.message}
            </p>

            <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-left text-xs text-slate-400 mb-6 space-y-1.5">
              <p className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-pigeon-400" /> Ketentuan Akses Sistem PIGEON:
              </p>
              <p>• Gate 1: Wajib menggunakan domain institusi <span className="font-mono text-pigeon-300">@mutiarabangsa.sch.id</span></p>
              <p>• Gate 2: Email harus terdaftar pada daftar izin (Whitelist) Admin ICT Lab</p>
            </div>

            <button
              onClick={() => {
                setGateError(null);
                router.replace('/');
              }}
              className="w-full sm:w-auto px-8 py-3 bg-pigeon-600 hover:bg-pigeon-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-pigeon-600/30 transition"
            >
              Kembali ke Halaman Login
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-12 gap-8 items-center">
            {/* Left Column: Description & System Gate Flow */}
            <div className="md:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-pigeon-500/10 border border-pigeon-500/30 text-pigeon-400 text-xs font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Practical Inventory, Goods & Equipment Organizer</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                Pusat Pengelolaan Inventaris <span className="text-pigeon-400">ICT Lab 1 & 2</span>
              </h2>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                Aplikasi resmi Sekolah Mutiara Bangsa untuk peminjaman langsung, reservasi terjadwal,
                monitoring ketersediaan barang, serta pengembalian dan sanksi dengan proteksi 2-Stage Gate Check.
              </p>

              {/* 2-Stage Gate Badge Cards */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-slate-800/70 border border-slate-700/60 rounded-xl">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200 mb-1">
                    <span className="w-5 h-5 rounded-full bg-pigeon-500/20 text-pigeon-400 flex items-center justify-center text-[10px]">
                      1
                    </span>
                    <span>Gate Check 1</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Validasi domain wajib <span className="text-pigeon-300 font-mono">@mutiarabangsa.sch.id</span>
                  </p>
                </div>

                <div className="p-3 bg-slate-800/70 border border-slate-700/60 rounded-xl">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200 mb-1">
                    <span className="w-5 h-5 rounded-full bg-pigeon-500/20 text-pigeon-400 flex items-center justify-center text-[10px]">
                      2
                    </span>
                    <span>Gate Check 2</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Pengecekan akun terdaftar pada database <span className="text-pigeon-300">Users (Whitelist)</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Real Google Sign-In & Test Personas */}
            <div className="md:col-span-5 bg-slate-900/90 border border-slate-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl backdrop-blur-xl">
              <div className="text-center pb-5 border-b border-slate-800">
                <div className="w-12 h-12 bg-white text-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md">
                  <Lock className="w-6 h-6 text-slate-800" />
                </div>
                <h3 className="font-bold text-lg text-white">Google Sign-In</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Masuk menggunakan akun Google Institusi Mutiara Bangsa
                </p>
              </div>

              {/* Real Google OAuth Button */}
              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={handleRealGoogleSignIn}
                  disabled={googleLoading}
                  className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs sm:text-sm rounded-xl shadow-lg flex items-center justify-center gap-3 transition duration-150 disabled:opacity-50 hover:shadow-white/10"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.8 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.7 0-1.2.2-2 .4-2.7L1.6 6.4C.6 8.3 0 10.4 0 12.7s.6 4.4 1.6 6.3l3.7-4.3z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.2 0-5.8-2.3-6.7-5.3L1.6 16.4C3.5 20.2 7.4 23.5 12 23.5z"
                    />
                  </svg>
                  <span>{googleLoading ? 'Membuka Google OAuth...' : 'Masuk dengan Google (OAuth)'}</span>
                </button>

                <p className="text-[11px] text-center text-slate-500">
                  Secara otomatis mengarahkan ke akun <span className="font-mono text-slate-400">@mutiarabangsa.sch.id</span>
                </p>
              </div>

              {/* Manual Input or Last Login */}
              <div className="mt-6 pt-5 border-t border-slate-800">
                {/* Last Login Card (1-Click Resume) - ONLY SHOWN IF PREVIOUSLY LOGGED IN */}
                {lastUser && (
                  <div className="p-3.5 mb-4 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-pigeon-500/50 shadow-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-pigeon-300">
                        <Sparkles className="w-3.5 h-3.5 text-pigeon-400" />
                        <span className="tracking-wide">LOGIN TERAKHIR (1-CLICK):</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        {hasActiveSession ? 'Sesi Aktif' : 'Tersimpan'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/70 border border-slate-700/60">
                      <div className="w-10 h-10 rounded-xl bg-pigeon-600 text-white font-black flex items-center justify-center text-sm shadow-md shrink-0">
                        {lastUser.name?.charAt(0) || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-white text-xs truncate">{lastUser.name}</p>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                              lastUser.role === 'Admin'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : lastUser.role === 'Supervisor'
                                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            }`}
                          >
                            {lastUser.role}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{lastUser.email}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleResumeLastLogin}
                      disabled={loading}
                      className="w-full py-2.5 px-4 bg-pigeon-600 hover:bg-pigeon-500 active:bg-pigeon-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-pigeon-600/30 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                    >
                      <span>{loading ? 'Menghubungkan...' : `Lanjutkan sebagai ${lastUser.name} →`}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <div className="flex items-center justify-between text-[11px] pt-0.5 text-slate-400">
                      <button
                        type="button"
                        onClick={handleClearLastLogin}
                        className="hover:text-red-400 transition cursor-pointer underline underline-offset-2"
                      >
                        Ganti akun
                      </button>
                    </div>
                  </div>
                )}

                {/* Manual Email Input Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (emailInput) handleGateAuth(emailInput, nameInput);
                  }}
                  className="space-y-2"
                >
                  <label className="block text-[11px] font-medium text-slate-400">
                    Atau Masukkan Email Institusi:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="nama@mutiarabangsa.sch.id"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-pigeon-500 font-mono"
                    />
                    <button
                      type="submit"
                      disabled={loading || !emailInput}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl border border-slate-700 transition disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? '...' : 'Masuk'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <footer className="max-w-6xl mx-auto w-full text-center text-xs text-slate-500 py-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>© 2026 PIGEON — ICT Lab 1 & 2 • Sekolah Mutiara Bangsa</p>
        <p className="text-[11px]">Protected by Supabase Auth & 2-Stage Gate Check</p>
      </footer>

      {/* QR Code Entry Point Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-sm w-full">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center border border-slate-700 shadow-lg hover:bg-slate-700 z-10"
            >
              ✕
            </button>
            <QRCodeDisplay
              title="QR Code Masuk PIGEON"
              subtitle="Pindai kode QR ini menggunakan kamera ponsel untuk membuka aplikasi PIGEON secara langsung"
            />
          </div>
        </div>
      )}

      {/* Google OAuth Setup Guide Modal */}
      {showGoogleGuide && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl text-left space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center font-bold">
                  G
                </div>
                <h3 className="font-bold text-white text-base">Panduan Google Provider Supabase</h3>
              </div>
              <button
                onClick={() => setShowGoogleGuide(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Untuk mengaktifkan tombol Google OAuth asli pada project Supabase <span className="font-mono text-pigeon-300">hiezrrvpkwsegeexgwsf</span>, Anda cukup memasukkan Google Client ID di dashboard Supabase:
            </p>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <p className="font-bold text-white">1. Authorized Redirect URI (Google Cloud Console):</p>
                <p className="text-[11px] text-slate-400">Masukkan URI ini saat membuat OAuth 2.0 Client ID di Google Cloud Console:</p>
                <p className="font-mono text-pigeon-400 text-[11px] select-all bg-slate-900 p-2 rounded border border-slate-700 break-all">
                  https://hiezrrvpkwsegeexgwsf.supabase.co/auth/v1/callback
                </p>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <p className="font-bold text-white">2. Aktifkan di Supabase Dashboard:</p>
                <p className="text-[11px] text-slate-400">
                  Buka menu <span className="text-white font-semibold">Authentication $\rightarrow$ Providers $\rightarrow$ Google</span>:
                </p>
                <p className="text-[11px] text-slate-400">• Aktifkan toggle <span className="text-pigeon-400 font-semibold">Enable Google provider</span>.</p>
                <p className="text-[11px] text-slate-400">• Masukkan <span className="text-white font-semibold">Client ID</span> dan <span className="text-white font-semibold">Client Secret</span> yang didapat dari Google.</p>
                <p className="text-[11px] text-slate-400">• Klik <span className="text-pigeon-400 font-semibold">Save</span>.</p>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <a
                href="https://supabase.com/dashboard/project/hiezrrvpkwsegeexgwsf/auth/providers"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-pigeon-600 hover:bg-pigeon-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition"
              >
                <span>Buka Supabase Providers</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setShowGoogleGuide(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-xs text-slate-400">Memuat PIGEON...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
