'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { useRealtimeSync, broadcastDataChange } from '@/lib/useRealtimeSync';
import {
  Boxes,
  ShoppingBag,
  CalendarCheck,
  Ticket,
  RotateCcw,
  Search,
  Filter,
  Check,
  CheckCircle,
  AlertTriangle,
  Clock,
  QrCode,
  ShoppingCart,
  Trash2,
  Plus,
  AlertOctagon,
  HelpCircle,
  Sparkles,
  X,
} from 'lucide-react';
import { InventoryItem, BorrowingTransaction, User } from '@/types';

// Helper to auto-calculate due date based on duration
const calculateDueDate = (dur: string): string => {
  const now = new Date();

  // Hari
  const dayMatch = dur.match(/(\d+)\s*Hari/i);
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    const target = new Date(now);
    target.setDate(target.getDate() + days);
    target.setHours(23, 59, 0, 0);
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const date = String(target.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}T23:59`;
  }

  // Jam
  const hourMatch = dur.match(/(\d+)\s*Jam/i);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10);
    const target = new Date(now.getTime() + hours * 60 * 60 * 1000);
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const date = String(target.getDate()).padStart(2, '0');
    const h = String(target.getHours()).padStart(2, '0');
    const m = String(target.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${date}T${h}:${m}`;
  }

  // Hari Ini EOD
  if (dur.toLowerCase().includes('hari ini')) {
    const target = new Date(now);
    target.setHours(23, 59, 0, 0);
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const date = String(target.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}T23:59`;
  }

  // Default fallback: 1 day at 23:59
  const target = new Date(now);
  target.setDate(target.getDate() + 1);
  target.setHours(23, 59, 0, 0);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const date = String(target.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}T23:59`;
};

function UserDashboardContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'borrow';
  const [activeTab, setActiveTab] = useState(initialTab);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<BorrowingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Cart state
  const [cart, setCart] = useState<{ item: InventoryItem; qty: number }[]>([]);
  const [purpose, setPurpose] = useState('');
  const [duration, setDuration] = useState('1 Hari');
  const [returnDate, setReturnDate] = useState(() => calculateDueDate('1 Hari'));
  const [transactionType, setTransactionType] = useState<'Direct_Borrow' | 'Reservation'>('Direct_Borrow');

  const handleDurationChange = (newDur: string) => {
    setDuration(newDur);
    const autoDue = calculateDueDate(newDur);
    setReturnDate(autoDue);
  };

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('All');

  // View Ticket Modal
  const [selectedTicket, setSelectedTicket] = useState<BorrowingTransaction | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState<BorrowingTransaction | null>(null);
  const [deletingTicket, setDeletingTicket] = useState(false);

  // Return submission state
  const [returnInputTicketId, setReturnInputTicketId] = useState('');

  // Toast
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) setActiveTab(tabParam);
  }, [searchParams]);

  // Handle ESC key to dismiss any open modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedTicket(null);
        setTicketToDelete(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load user data with silent real-time background sync
  const loadUserData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const authRes = await fetch('/api/auth/me');
      const authData = await authRes.json();
      if (authData.authenticated && authData.user) {
        setCurrentUser(authData.user);
        const [invRes, txRes] = await Promise.all([
          fetch('/api/inventory'),
          fetch(`/api/transactions?user_id=${authData.user.user_id}`),
        ]);
        const invData = await invRes.json();
        const txData = await txRes.json();
        if (invData?.success) setInventory(invData.items || []);
        if (txData?.success) {
          const freshTx = txData.transactions || [];
          setTransactions(freshTx);
          // Auto-sync status of currently viewed ticket if open
          setSelectedTicket((prev) => {
            if (!prev) return null;
            const updated = freshTx.find((t: BorrowingTransaction) => t.ticket_id === prev.ticket_id);
            return updated || prev;
          });
        }
      }
    } catch (err) {
      console.error('User sync error:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData(false);
  }, [refreshTrigger]);

  useRealtimeSync({
    onRefresh: () => loadUserData(true),
    pollIntervalMs: 3500,
  });

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  const handleAddToCart = (item: InventoryItem) => {
    if (currentUser?.penalty_status === 'Restricted_Temp' || currentUser?.penalty_status === 'Restricted_1_Week') {
      showNotification('Akun Anda sedang dalam masa pembatasan sanksi. Tidak dapat meminjam barang.', 'error');
      return;
    }
    if (item.qty <= 0) {
      showNotification('Stok barang sedang kosong', 'error');
      return;
    }
    const existing = cart.find((c) => c.item.item_id === item.item_id);
    if (existing) {
      if (existing.qty >= item.qty) {
        showNotification('Jumlah permintaan melebihi stok yang tersedia', 'error');
        return;
      }
      setCart(cart.map((c) => (c.item.item_id === item.item_id ? { ...c, qty: c.qty + 1 } : c)));
    } else {
      setCart([...cart, { item, qty: 1 }]);
    }
    showNotification(`"${item.item_name}" dimasukkan ke keranjang`);
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCart(cart.filter((c) => c.item.item_id !== itemId));
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart.length) {
      showNotification('Pilih barang terlebih dahulu', 'error');
      return;
    }
    if (!currentUser) return;

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.user_id,
          transaction_type: transactionType,
          purpose,
          borrow_date: new Date().toISOString(),
          duration,
          expected_return_date: returnDate || null,
          items: cart.map((c) => ({
            item_id: c.item.item_id,
            qty_borrowed: c.qty,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      showNotification(data.message);
      setCart([]);
      setPurpose('');
      setDuration('1 Hari');
      setReturnDate(calculateDueDate('1 Hari'));
      setRefreshTrigger((v) => v + 1);
      setActiveTab('tickets');
      broadcastDataChange();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    setDeletingTicket(true);
    try {
      const res = await fetch(`/api/transactions?ticket_id=${encodeURIComponent(ticketId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      showNotification(data.message || `Tiket ${ticketId} berhasil dibatalkan dan dihapus`);
      setTicketToDelete(null);
      setSelectedTicket(null);
      setRefreshTrigger((v) => v + 1);
      broadcastDataChange();
    } catch (err: any) {
      showNotification(err.message, 'error');
      setTicketToDelete(null);
    } finally {
      setDeletingTicket(false);
    }
  };

  const filteredItems = inventory.filter((item) => {
    const matchSearch =
      item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.brand.toLowerCase().includes(searchQuery.toLowerCase());
    const matchLoc = locationFilter === 'All' || item.location === locationFilter;
    return matchSearch && matchLoc;
  });

  return (
    <>
      <AppShell activeMenu={
      activeTab === 'inventory' ? 'Katalog Barang (Lab 1 & 2)' :
      activeTab === 'borrow' ? 'Peminjaman Langsung' :
      activeTab === 'reserve' ? 'Reservasi Terjadwal' :
      activeTab === 'tickets' ? 'Tiket Saya (PGE-XXXX)' :
      activeTab === 'return' ? 'Pengembalian Barang' :
      'Peminjaman Saya'
    }>
      {/* Toast Alert */}
      {alertMsg && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-in fade-in flex items-center gap-2 ${
            alertMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          {alertMsg.type === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertOctagon className="w-4 h-4 text-red-600" />}
          <span>{alertMsg.text}</span>
        </div>
      )}

      {/* Penalty Banner if user is restricted */}
      {currentUser?.penalty_status && currentUser.penalty_status !== 'None' && (
        <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold">Status Akun Dalam Sanksi: {currentUser.penalty_status}</p>
            <p className="text-red-700 mt-0.5">
              {currentUser.penalty_status === 'Warning'
                ? 'Anda memiliki catatan peringatan dari pengembalian sebelumnya. Harap selalu menjaga dan mengembalikan barang tepat waktu.'
                : 'Peminjaman barang dinonaktifkan sementara hingga masa pembatasan selesai atau penyelesaian ganti rugi disetujui Admin ICT.'}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Peminjaman & Reservasi ICT Lab</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
              Role: User
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Selamat datang, <span className="font-semibold text-slate-800">{currentUser?.name}</span>. Pilih barang, isi durasi, dan pantau tiket peminjaman Anda.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('tickets')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-pigeon-50 border border-pigeon-200 text-pigeon-800 rounded-lg text-xs font-bold shadow-sm"
          >
            <Ticket className="w-3.5 h-3.5 text-pigeon-600" />
            <span>Tiket Aktif ({transactions.length})</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2 mb-6 border-b border-slate-200">
        {[
          { id: 'borrow', label: 'Peminjaman Langsung', icon: ShoppingBag },
          { id: 'reserve', label: 'Reservasi Terjadwal', icon: CalendarCheck },
          { id: 'inventory', label: 'Katalog Barang', icon: Boxes },
          { id: 'tickets', label: 'Tiket Saya (PGE-XXXX)', icon: Ticket, count: transactions.length },
          { id: 'return', label: 'Pengembalian Barang', icon: RotateCcw },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'borrow') setTransactionType('Direct_Borrow');
                if (tab.id === 'reserve') setTransactionType('Reservation');
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-slate-100 text-slate-600">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB: BORROW / RESERVE */}
      {(activeTab === 'borrow' || activeTab === 'reserve') && (
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Items Selector */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari laptop, proyektor, kabel..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-pigeon-500"
                  />
                </div>
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"
                >
                  <option value="All">Semua Lab</option>
                  <option value="ICT Lab 1">ICT Lab 1</option>
                  <option value="ICT Lab 2">ICT Lab 2</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                {filteredItems.map((item) => (
                  <div
                    key={item.item_id}
                    className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold">
                          {item.borrowing_type}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">{item.location}</span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs">{item.item_name}</h4>
                      <p className="text-[11px] text-slate-500">{item.brand} • {item.variant}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{item.location_detail}</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        {item.qty > 0 ? (
                          <span className="text-emerald-700 font-semibold">{item.qty} tersedia</span>
                        ) : (
                          <span className="text-red-500">Stok habis</span>
                        )}
                      </span>
                      <button
                        onClick={() => handleAddToCart(item)}
                        disabled={item.qty <= 0}
                        className="px-3 py-1 bg-pigeon-600 hover:bg-pigeon-700 text-white rounded-lg text-xs font-bold shadow-sm disabled:opacity-40"
                      >
                        + Pilih
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Checkout & Cart Details Form */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 sticky top-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-pigeon-600" />
                  <span>Daftar Keranjang ({cart.length})</span>
                </h3>
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="text-xs text-red-500 hover:underline">
                    Reset
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="py-10 text-center text-slate-400 space-y-1">
                  <ShoppingBag className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-semibold">Keranjang masih kosong</p>
                  <p className="text-[11px]">Pilih barang di sebelah kiri untuk diajukan.</p>
                </div>
              ) : (
                <form onSubmit={handleCheckout} className="space-y-3">
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {cart.map((c) => (
                      <div
                        key={c.item.item_id}
                        className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-900 truncate max-w-[170px]">{c.item.item_name}</p>
                          <span className="text-[10px] text-slate-500">{c.item.borrowing_type}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{c.qty} unit</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(c.item.item_id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tujuan Peminjaman (Wajib):
                    </label>
                    <textarea
                      required
                      rows={2}
                      placeholder="Contoh: Praktikum Pemrograman Web / Ujian Praktik Sekolah..."
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-pigeon-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Durasi Pinjam:</label>
                      <select
                        value={duration}
                        onChange={(e) => handleDurationChange(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-pigeon-500 font-medium cursor-pointer"
                      >
                        <optgroup label="Pilihan Hari (Jatuh Tempo 23:59)">
                          <option value="1 Hari">1 Hari (Besok 23:59)</option>
                          <option value="2 Hari">2 Hari</option>
                          <option value="3 Hari">3 Hari</option>
                          <option value="4 Hari">4 Hari</option>
                          <option value="5 Hari">5 Hari (1 Pekan Kerja)</option>
                          <option value="7 Hari">7 Hari (1 Minggu)</option>
                          <option value="14 Hari">14 Hari (2 Minggu)</option>
                        </optgroup>
                        <optgroup label="Pilihan Jam (Hari Ini)">
                          <option value="1 Jam">1 Jam</option>
                          <option value="2 Jam">2 Jam</option>
                          <option value="3 Jam">3 Jam</option>
                          <option value="4 Jam">4 Jam</option>
                          <option value="6 Jam">6 Jam</option>
                          <option value="Hari Ini (23:59)">Hari Ini (s/d 23:59)</option>
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Kembali:</label>
                      <input
                        type="datetime-local"
                        required
                        value={returnDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-pigeon-500 font-mono"
                      />
                    </div>
                  </div>

                  {returnDate && (
                    <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        Jatuh Tempo:{' '}
                        <strong className="text-emerald-950 font-bold">
                          {new Date(returnDate).toLocaleDateString('id-ID', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}{' '}
                          pukul{' '}
                          {new Date(returnDate).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          WIB
                        </strong>
                      </span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full mt-2 py-3 bg-pigeon-600 hover:bg-pigeon-700 text-white font-bold text-xs rounded-xl shadow-md transition"
                  >
                    {activeTab === 'reserve' ? 'Kirim Reservasi Terjadwal' : 'Kirim Permohonan Peminjaman'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: VIEW INVENTORY */}
      {activeTab === 'inventory' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900">Katalog Barang ICT Lab 1 & 2</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Nama Barang</th>
                  <th className="p-3">Brand</th>
                  <th className="p-3">Lokasi Lab & Detail</th>
                  <th className="p-3">Stok Tersedia</th>
                  <th className="p-3">Tipe Peminjaman</th>
                  <th className="p-3">Kondisi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((it) => (
                  <tr key={it.item_id} className="hover:bg-slate-50/80">
                    <td className="p-3 font-semibold text-slate-900">{it.item_name}</td>
                    <td className="p-3 text-slate-600">{it.brand}</td>
                    <td className="p-3">
                      <span className="font-semibold text-slate-800">{it.location}</span>
                      <p className="text-[10px] text-slate-400">{it.location_detail}</p>
                    </td>
                    <td className="p-3 font-bold">{it.qty} unit</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100">{it.borrowing_type}</span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${it.condition === 'Good' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                        {it.condition}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: MY TICKETS (PGE-XXXX) */}
      {activeTab === 'tickets' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Daftar Tiket Peminjaman Saya</h2>
              <p className="text-xs text-slate-500">
                Tunjukkan Ticket ID ini kepada Admin atau Supervisor saat mengambil barang di laboratorium.
              </p>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Ticket className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">Belum ada tiket peminjaman</p>
              <p className="text-xs text-slate-400">Pilih barang di menu Peminjaman Langsung untuk mengajukan tiket baru.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.ticket_id}
                  className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-slate-900 text-base">{tx.ticket_id}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          tx.status === 'Approved' || tx.status === 'Ready_for_Pickup'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : tx.status === 'Picked_Up'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : tx.status === 'Pending_Approval' || tx.status === 'In_Queue'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : tx.status === 'Returned'
                            ? 'bg-slate-200 text-slate-800'
                            : 'bg-red-100 text-red-800 border border-red-300'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700">
                      <span className="font-semibold">Tujuan:</span> {tx.purpose}
                    </p>

                    <div className="text-[11px] text-slate-500 flex flex-wrap gap-4 pt-1">
                      <span>Waktu: {new Date(tx.borrow_date).toLocaleDateString('id-ID')}</span>
                      <span>Durasi: {tx.duration}</span>
                      {tx.expected_return_date && (
                        <span className="text-red-600 font-semibold">
                          Batas Kembali: {new Date(tx.expected_return_date).toLocaleDateString('id-ID')}
                        </span>
                      )}
                    </div>

                    {/* Items */}
                    <div className="pt-1.5 flex flex-wrap gap-1.5">
                      {tx.items?.map((it) => (
                        <span key={it.id} className="text-[10px] bg-white border px-2 py-0.5 rounded text-slate-800 font-medium">
                          {it.item_name} ({it.qty_borrowed} unit)
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      onClick={() => setSelectedTicket(tx)}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Detail & QR</span>
                    </button>
                    {/* Can only cancel if NOT approved yet */}
                    {(tx.status === 'Pending_Approval' || tx.status === 'In_Queue' || tx.status === 'Rejected') ? (
                      <button
                        onClick={() => setTicketToDelete(tx)}
                        className="px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-xl transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
                        title="Batalkan / Hapus Tiket"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Batalkan</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg font-medium">
                        Terkunci (Disetujui)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: RETURN ITEM */}
      {activeTab === 'return' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 max-w-lg mx-auto">
          <h2 className="text-base font-bold text-slate-900">Pengembalian Barang Pinjaman</h2>
          <p className="text-xs text-slate-500">
            Masukkan Ticket ID Anda untuk mengecek status dan memproses serah terima dengan staf ICT Lab.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ticket ID (Format PGE-XXXX):</label>
              <input
                type="text"
                placeholder="PGE-0001"
                value={returnInputTicketId}
                onChange={(e) => setReturnInputTicketId(e.target.value.toUpperCase())}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs uppercase font-mono"
              />
            </div>

            <button
              onClick={() => {
                const found = transactions.find((t) => t.ticket_id === returnInputTicketId);
                if (found) {
                  setSelectedTicket(found);
                } else {
                  showNotification('Ticket ID tidak ditemukan pada akun Anda', 'error');
                }
              }}
              className="w-full py-2.5 bg-pigeon-600 hover:bg-pigeon-700 text-white font-bold text-xs rounded-xl shadow-sm"
            >
              Periksa Detail Pengembalian
            </button>
          </div>
        </div>
      )}
      </AppShell>

      {/* TICKET MODAL - MOVED OUTSIDE APPSHELL WITH Z-[9999] AND MULTI-TOUCH/CLICK/ESC SUPPORT */}
      {selectedTicket && (
        <div
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setSelectedTicket(null);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedTicket(null);
          }}
          className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center my-auto"
          >
            {/* Top Right Close Button */}
            <button
              type="button"
              onClick={() => setSelectedTicket(null)}
              onTouchEnd={(e) => {
                e.preventDefault();
                setSelectedTicket(null);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                setSelectedTicket(null);
              }}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer z-10"
              title="Tutup (ESC)"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="inline-block px-3 py-1 bg-pigeon-100 text-pigeon-800 rounded-full font-bold text-xs uppercase tracking-wider mb-2">
              Tiket Pengambilan Barang
            </div>
            <h3 className="text-3xl font-black font-mono text-slate-900 tracking-tight">{selectedTicket.ticket_id}</h3>
            <p className="text-xs text-slate-500 mt-1">Status: <span className="font-bold text-pigeon-700">{selectedTicket.status}</span></p>

            <div className="my-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs space-y-2">
              <p><span className="text-slate-500">Peminjam:</span> <span className="font-bold text-slate-800">{selectedTicket.user_name}</span></p>
              <p><span className="text-slate-500">Tujuan:</span> {selectedTicket.purpose}</p>
              <p>
                <span className="text-slate-500">Batas Pengembalian:</span>{' '}
                <span className="font-bold text-red-600">
                  {selectedTicket.expected_return_date
                    ? (() => {
                        const d = new Date(selectedTicket.expected_return_date);
                        const formattedDate = d.toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        });
                        const hours = String(d.getHours()).padStart(2, '0');
                        const minutes = String(d.getMinutes()).padStart(2, '0');
                        return `${formattedDate} (${hours}:${minutes} WIB)`;
                      })()
                    : 'Selesai Pakai'}
                </span>
              </p>
              <div className="pt-2 border-t">
                <p className="font-bold text-slate-700 mb-1">Barang Tertera:</p>
                {selectedTicket.items?.map((it) => (
                  <p key={it.id} className="text-slate-600">• {it.item_name} ({it.qty_borrowed} unit)</p>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mb-4">
              Tunjukkan layar ini kepada Admin / Supervisor ICT Lab 1 atau Lab 2 untuk serah terima barang fisik.
            </p>

            {(selectedTicket.status === 'Pending_Approval' ||
              selectedTicket.status === 'In_Queue' ||
              selectedTicket.status === 'Rejected') ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const target = selectedTicket;
                  setSelectedTicket(null);
                  setTicketToDelete(target);
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  const target = selectedTicket;
                  setSelectedTicket(null);
                  setTicketToDelete(target);
                }}
                className="w-full mb-2.5 py-2.5 bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-700 border border-red-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Batalkan & Hapus Tiket Ini</span>
              </button>
            ) : (
              <div className="w-full mb-2.5 py-2.5 px-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold rounded-xl flex items-center justify-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Tiket Disetujui (Terkunci & Tidak Dapat Dibatalkan)</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setSelectedTicket(null)}
              onTouchEnd={(e) => {
                e.preventDefault();
                setSelectedTicket(null);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                setSelectedTicket(null);
              }}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 active:bg-black text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-sm select-none"
            >
              Tutup Tiket
            </button>
          </div>
        </div>
      )}

      {/* MODAL: DELETE / CANCEL TICKET CONFIRMATION */}
      {ticketToDelete && (
        <div
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setTicketToDelete(null);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setTicketToDelete(null);
          }}
          className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center my-auto"
          >
            {/* Top Right Close Button */}
            <button
              type="button"
              disabled={deletingTicket}
              onClick={() => setTicketToDelete(null)}
              onTouchEnd={(e) => {
                e.preventDefault();
                setTicketToDelete(null);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                setTicketToDelete(null);
              }}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer z-10"
              title="Tutup (ESC)"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Batalkan Tiket Peminjaman?</h3>
            <p className="text-xs text-slate-500 mb-6">
              Apakah Anda yakin ingin membatalkan dan menghapus tiket <span className="font-mono font-bold text-slate-900">{ticketToDelete.ticket_id}</span> ({ticketToDelete.purpose})? Permohonan ini akan dihapus secara permanen.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={deletingTicket}
                onClick={() => setTicketToDelete(null)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  setTicketToDelete(null);
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setTicketToDelete(null);
                }}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Kembali
              </button>
              <button
                type="button"
                disabled={deletingTicket}
                onClick={() => handleDeleteTicket(ticketToDelete.ticket_id)}
                className="py-2.5 px-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {deletingTicket ? 'Menghapus...' : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function UserDashboard() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs text-slate-500">Memuat User Dashboard...</div>}>
      <UserDashboardContent />
    </React.Suspense>
  );
}
