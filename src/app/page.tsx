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
  KeyRound,
  Eye,
  EyeOff,
  UserPlus,
} from 'lucide-react';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import { createClient } from '@/lib/supabase-client';
import { User } from '@/types';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [emailInput, setEmailInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showGoogleGuide, setShowGoogleGuide] = useState(false);

  // Last Login & Quick Resume States
  const [lastUser, setLastUser] = useState<User | null>(null);
  const [hasActiveSession, setHasActiveSession] = useState(false);

  const [gateError, setGateError] = useState<{
    code:
      | 'INVALID_DOMAIN'
      | 'NOT_WHITELISTED'
      | 'PIN_NOT_SET'
      | 'PIN_REQUIRED'
      | 'INVALID_PIN'
      | 'INVALID_PIN_FORMAT'
      | 'PIN_MISMATCH'
      | 'SERVER_ERROR'
      | null;
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

  // Direct Credentials Auth (Email + 4-Digit PIN)
  const handleGateAuth = async (emailToTest: string, pinToTest?: string) => {
    setLoading(true);
    setGateError(null);

    const trimmed = (emailToTest || '').trim().toLowerCase();
    if (!trimmed.endsWith('@mutiarabangsa.sch.id')) {
      setGateError({
        code: 'INVALID_DOMAIN',
        title: 'Access Denied: Domain Tidak Valid',
        message: 'Hanya alamat email berakhiran @mutiarabangsa.sch.id yang diizinkan untuk masuk ke sistem PIGEON.',
        email: trimmed,
      });
      setLoading(false);
      return;
    }

    if (!pinToTest || pinToTest.length !== 4) {
      setGateError({
        code: 'PIN_REQUIRED',
        title: 'PIN 4-Angka Wajib Diisi',
        message: 'Silakan masukkan 4 digit PIN numerik akun Anda.',
        email: trimmed,
      });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/gate-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, pin: pinToTest }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.code === 'PIN_NOT_SET') {
          setGateError({
            code: 'PIN_NOT_SET',
            title: 'Akun Belum Memiliki PIN',
            message: data.message || 'Email Anda terdaftar di Whitelist, namun belum memiliki PIN 4-angka. Silakan atur PIN akun Anda terlebih dahulu.',
            email: trimmed,
          });
        } else if (data.code === 'INVALID_DOMAIN') {
          setGateError({
            code: 'INVALID_DOMAIN',
            title: 'Access Denied: Domain Tidak Valid',
            message: data.message || 'Hanya alamat email berakhiran @mutiarabangsa.sch.id yang diizinkan.',
            email: trimmed,
          });
        } else if (data.code === 'NOT_WHITELISTED') {
          setGateError({
            code: 'NOT_WHITELISTED',
            title: 'Access Denied: Email Tidak Ada di Whitelist',
            message: data.message || 'Email Anda belum terdaftar di dalam database Whitelist pengguna PIGEON.',
            email: trimmed,
          });
        } else if (data.code === 'INVALID_PIN') {
          setGateError({
            code: 'INVALID_PIN',
            title: 'PIN Salah',
            message: 'PIN 4-angka yang Anda masukkan salah. Harap periksa kembali atau hubungi Admin untuk reset PIN.',
            email: trimmed,
          });
        } else {
          setGateError({
            code: 'SERVER_ERROR',
            title: 'Otentikasi Gagal',
            message: data.message || 'Terjadi gangguan saat memverifikasi kredensial.',
            email: trimmed,
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

  // Direct Account Activation / Set PIN (Requires Email already in Whitelist)
  const handleRegisterAuth = async (emailToRegister: string, pinToSet: string, confirmPinToSet: string) => {
    setLoading(true);
    setGateError(null);

    const trimmed = (emailToRegister || '').trim().toLowerCase();
    if (!trimmed.endsWith('@mutiarabangsa.sch.id')) {
      setGateError({
        code: 'INVALID_DOMAIN',
        title: 'Access Denied: Domain Tidak Valid',
        message: 'Pendaftaran akun wajib menggunakan domain resmi @mutiarabangsa.sch.id.',
        email: trimmed,
      });
      setLoading(false);
      return;
    }

    if (!pinToSet || pinToSet.length !== 4 || !/^\d{4}$/.test(pinToSet)) {
      setGateError({
        code: 'INVALID_PIN_FORMAT',
        title: 'Format PIN Tidak Valid',
        message: 'PIN harus terdiri dari tepat 4 digit angka (0-9). Contoh: 1234.',
        email: trimmed,
      });
      setLoading(false);
      return;
    }

    if (pinToSet !== confirmPinToSet) {
      setGateError({
        code: 'PIN_MISMATCH',
        title: 'Konfirmasi PIN Tidak Cocok',
        message: 'PIN dan Konfirmasi PIN yang Anda masukkan tidak sesuai.',
        email: trimmed,
      });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, pin: pinToSet, confirm_pin: confirmPinToSet }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.code === 'NOT_WHITELISTED') {
          setGateError({
            code: 'NOT_WHITELISTED',
            title: 'Access Denied: Email Belum Ada di Whitelist',
            message: data.message || 'Email Anda belum terdaftar di database Whitelist pengguna PIGEON. Harap hubungi Admin ICT Lab untuk didaftarkan sebelum membuat PIN.',
            email: trimmed,
          });
        } else {
          setGateError({
            code: data.code || 'SERVER_ERROR',
            title: 'Aktivasi Akun Gagal',
            message: data.message || 'Gagal mengatur PIN akun.',
            email: trimmed,
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
    setEmailInput(lastUser.email);
    setAuthMode('login');
    // Focus or prompt for PIN
  };

  // Clear last login session to switch account
  const handleClearLastLogin = async () => {
    try {
      localStorage.removeItem('pigeon_last_user');
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    setLastUser(null);
    setHasActiveSession(false);
    setEmailInput('');
    setPinInput('');
    setConfirmPinInput('');
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-pigeon-400 border border-slate-700 transition cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Setup Google OAuth</span>
          </button>

          <button
            onClick={() => setShowQrModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition cursor-pointer"
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
              {gateError.code === 'INVALID_DOMAIN'
                ? 'Gate Check 1 Failed'
                : gateError.code === 'NOT_WHITELISTED'
                ? 'Gate Check 2 Failed'
                : gateError.code === 'PIN_NOT_SET'
                ? 'Perlu Aktivasi PIN'
                : 'Pemberitahuan Otentikasi'}
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
              <p>• Gate 3: Wajib memasukkan PIN 4-angka yang sesuai atau verifikasi Google OAuth</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              {gateError.code === 'PIN_NOT_SET' && (
                <button
                  type="button"
                  onClick={() => {
                    const email = gateError.email || emailInput;
                    setGateError(null);
                    setAuthMode('register');
                    if (email) setEmailInput(email);
                    setPinInput('');
                    setConfirmPinInput('');
                  }}
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Aktivasi / Buat PIN Sekarang</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setGateError(null);
                  router.replace('/');
                }}
                className="w-full sm:w-auto px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl border border-slate-700 transition cursor-pointer"
              >
                Kembali ke Halaman Login
              </button>
            </div>
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
                monitoring ketersediaan barang, serta pengembalian dan sanksi dengan proteksi 2-Stage Gate Check & PIN 4-Angka.
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

            {/* Right Column: Google Sign-In & Direct PIN Authentication */}
            <div className="md:col-span-5 bg-slate-900/90 border border-slate-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl backdrop-blur-xl">
              <div className="text-center pb-4 border-b border-slate-800">
                <div className="w-12 h-12 bg-white text-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md">
                  <Lock className="w-6 h-6 text-slate-800" />
                </div>
                <h3 className="font-bold text-lg text-white">Akses Masuk PIGEON</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sekolah Mutiara Bangsa • Akun Terverifikasi
                </p>
              </div>

              {/* Real Google OAuth Button */}
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={handleRealGoogleSignIn}
                  disabled={googleLoading}
                  className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs sm:text-sm rounded-xl shadow-lg flex items-center justify-center gap-3 transition duration-150 disabled:opacity-50 hover:shadow-white/10 cursor-pointer"
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
                <p className="text-[10px] text-center text-slate-400">
                  Data otomatis sinkron sama persis dengan login PIN
                </p>
              </div>

              {/* Divider */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                  <span className="bg-slate-900 px-3 text-slate-400 font-semibold">
                    Atau Masuk dengan PIN 4 Angka
                  </span>
                </div>
              </div>

              {/* Tab Selector: Masuk PIN vs Aktivasi Akun / Buat PIN */}
              <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setGateError(null);
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    authMode === 'login'
                      ? 'bg-pigeon-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Masuk dengan PIN</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setGateError(null);
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    authMode === 'register'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Aktivasi / Buat PIN</span>
                </button>
              </div>

              {/* TAB 1: MASUK DENGAN PIN */}
              {authMode === 'login' && (
                <div className="space-y-3">
                  {/* Last Login Card (1-Click Resume if active session, or Quick PIN if expired) */}
                  {lastUser && (
                    <div className="p-3 mb-2 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-pigeon-500/50 shadow-md space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-pigeon-300">
                          <Sparkles className="w-3 h-3 text-pigeon-400" />
                          <span>PENGGUNA TERAKHIR:</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          {hasActiveSession ? 'Sesi Aktif' : 'Tersimpan'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-950/70 border border-slate-700/60">
                        <div className="w-8 h-8 rounded-lg bg-pigeon-600 text-white font-black flex items-center justify-center text-xs shrink-0">
                          {lastUser.name?.charAt(0) || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-white text-xs truncate">{lastUser.name}</p>
                            <span
                              className={`text-[9px] px-1 py-0.2 rounded font-bold shrink-0 ${
                                lastUser.role === 'Admin'
                                  ? 'bg-amber-100 text-amber-900'
                                  : lastUser.role === 'Supervisor'
                                  ? 'bg-blue-100 text-blue-900'
                                  : 'bg-emerald-100 text-emerald-900'
                              }`}
                            >
                              {lastUser.role}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono truncate">{lastUser.email}</p>
                        </div>
                      </div>

                      {hasActiveSession ? (
                        <button
                          type="button"
                          onClick={handleResumeLastLogin}
                          disabled={loading}
                          className="w-full py-2 px-3 bg-pigeon-600 hover:bg-pigeon-500 active:bg-pigeon-700 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                        >
                          <span>{loading ? 'Menghubungkan...' : `Lanjutkan sebagai ${lastUser.name} →`}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input
                              type={showPin ? 'text' : 'password'}
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={4}
                              placeholder="PIN 4 Digit"
                              value={pinInput}
                              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                              className="w-full px-3 py-1.5 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-pigeon-500 font-mono text-center tracking-widest"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPin(!showPin)}
                              className="absolute right-2 top-2 text-slate-400 hover:text-white"
                            >
                              {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleGateAuth(lastUser.email, pinInput)}
                            disabled={loading || pinInput.length !== 4}
                            className="px-3 py-1.5 bg-pigeon-600 hover:bg-pigeon-500 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 cursor-pointer"
                          >
                            Masuk
                          </button>
                        </div>
                      )}

                      <div className="flex items-center justify-end text-[10px] pt-0.5 text-slate-400">
                        <button
                          type="button"
                          onClick={handleClearLastLogin}
                          className="hover:text-red-400 transition cursor-pointer underline underline-offset-2"
                        >
                          Gunakan email lain
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Manual Login Form */}
                  {(!lastUser || !hasActiveSession) && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (emailInput && pinInput) handleGateAuth(emailInput, pinInput);
                      }}
                      className="space-y-2.5 pt-1"
                    >
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Email Institusi:
                        </label>
                        <input
                          type="email"
                          placeholder="nama@mutiarabangsa.sch.id"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          required
                          className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-pigeon-500 font-mono"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-300">
                            PIN 4-Angka:
                          </label>
                          <span className="text-[10px] text-slate-400">4 digit angka (0-9)</span>
                        </div>
                        <div className="relative">
                          <input
                            type={showPin ? 'text' : 'password'}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={4}
                            placeholder="Contoh: 1234"
                            value={pinInput}
                            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            required
                            className="w-full px-3 py-2 pr-10 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-pigeon-500 font-mono tracking-widest"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPin(!showPin)}
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                          >
                            {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading || !emailInput || pinInput.length !== 4}
                        className="w-full py-2.5 bg-pigeon-600 hover:bg-pigeon-500 active:bg-pigeon-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-pigeon-600/30 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>{loading ? 'Memverifikasi...' : 'Masuk ke Sistem'}</span>
                      </button>

                      <p className="text-[11px] text-center text-slate-400 pt-1">
                        Belum punya PIN?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode('register');
                            setGateError(null);
                          }}
                          className="text-pigeon-400 hover:text-pigeon-300 font-semibold underline underline-offset-2 cursor-pointer"
                        >
                          Aktivasi / Buat PIN Akun
                        </button>
                      </p>
                    </form>
                  )}
                </div>
              )}

              {/* TAB 2: AKTIVASI AKUN / BUAT PIN */}
              {authMode === 'register' && (
                <div className="space-y-3">
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-200 leading-relaxed">
                    <p className="font-semibold text-amber-300 flex items-center gap-1 mb-0.5">
                      <ShieldCheck className="w-3.5 h-3.5" /> Syarat Whitelist Admin:
                    </p>
                    Email harus sudah didaftarkan terlebih dahulu oleh Admin ICT Lab ke dalam Whitelist PIGEON sebelum dapat mengaktifkan PIN.
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleRegisterAuth(emailInput, pinInput, confirmPinInput);
                    }}
                    className="space-y-2.5"
                  >
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Email Institusi Terdaftar:
                      </label>
                      <input
                        type="email"
                        placeholder="nama@mutiarabangsa.sch.id"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-300">
                            PIN 4 Angka:
                          </label>
                        </div>
                        <div className="relative">
                          <input
                            type={showPin ? 'text' : 'password'}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={4}
                            placeholder="4 digit"
                            value={pinInput}
                            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            required
                            className="w-full px-3 py-2 pr-9 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono tracking-widest text-center"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPin(!showPin)}
                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                          >
                            {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-semibold text-slate-300">
                            Konfirmasi PIN:
                          </label>
                        </div>
                        <input
                          type={showPin ? 'text' : 'password'}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={4}
                          placeholder="4 digit"
                          value={confirmPinInput}
                          onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          required
                          className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono tracking-widest text-center"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !emailInput || pinInput.length !== 4 || confirmPinInput.length !== 4}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{loading ? 'Mengaktivasi Akun...' : 'Aktivasi & Simpan PIN'}</span>
                    </button>

                    <p className="text-[11px] text-center text-slate-400 pt-1">
                      Sudah memiliki PIN?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('login');
                          setGateError(null);
                        }}
                        className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 cursor-pointer"
                      >
                        Masuk ke Akun Anda
                      </button>
                    </p>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <footer className="max-w-6xl mx-auto w-full text-center text-xs text-slate-500 py-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>© 2026 PIGEON — ICT Lab 1 & 2 • Sekolah Mutiara Bangsa</p>
        <p className="text-[11px]">Protected by Supabase Auth, Whitelist & 4-Digit PIN Security</p>
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
