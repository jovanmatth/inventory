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
  Camera,
  Upload,
  Eye,
  FileText,
  ArrowRight,
  Image as ImageIcon,
  X,
  Loader2,
} from 'lucide-react';
import { InventoryItem, BorrowingTransaction, User } from '@/types';
import { calculateDueDateLocal, formatDueDateTime } from '@/lib/date-utils';

const calculateDueDate = calculateDueDateLocal;

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
  const [submittingCheckout, setSubmittingCheckout] = useState(false);

  // Return workflow state
  const [returnInputTicketId, setReturnInputTicketId] = useState('');
  const [selectedReturnTx, setSelectedReturnTx] = useState<BorrowingTransaction | null>(null);
  const [returnProofFile, setReturnProofFile] = useState<File | null>(null);
  const [returnProofPreview, setReturnProofPreview] = useState<string | null>(null);
  const [returnNotes, setReturnNotes] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [ticketTabFilter, setTicketTabFilter] = useState<'active' | 'history'>('active');
  const [zoomProofUrl, setZoomProofUrl] = useState<string | null>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Sync selectedReturnTx with refreshed transactions
  useEffect(() => {
    if (selectedReturnTx) {
      const updated = transactions.find((t) => t.ticket_id === selectedReturnTx.ticket_id);
      if (updated) setSelectedReturnTx(updated);
    }
  }, [transactions]);

  const handleSelectTicketForReturn = (tx: BorrowingTransaction) => {
    setSelectedReturnTx(tx);
    setReturnInputTicketId(tx.ticket_id);
    setReturnProofFile(null);
    setReturnProofPreview(tx.return_proof_url || null);
    setReturnNotes(tx.return_notes || '');
    setActiveTab('return');
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 8MB)
      if (file.size > 8 * 1024 * 1024) {
        showNotification('Ukuran foto terlalu besar (maksimal 8MB)', 'error');
        return;
      }
      setReturnProofFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setReturnProofPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitReturnRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturnTx) return;
    if (!returnProofPreview) {
      showNotification('Wajib mengunggah foto bukti fisik sebelum mengajukan penutupan tiket', 'error');
      return;
    }

    setSubmittingReturn(true);
    try {
      let res;
      if (returnProofFile) {
        const formData = new FormData();
        formData.append('proof', returnProofFile);
        formData.append('notes', returnNotes);
        res = await fetch(`/api/transactions/${selectedReturnTx.ticket_id}/request-return`, {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch(`/api/transactions/${selectedReturnTx.ticket_id}/request-return`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proof_base64: returnProofPreview,
            notes: returnNotes,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      showNotification(data.message || 'Permohonan pengembalian berhasil diajukan! Menunggu persetujuan staf ICT.');
      setRefreshTrigger((v) => v + 1);
      broadcastDataChange();
    } catch (err: any) {
      showNotification(err.message || 'Gagal mengajukan pengembalian', 'error');
    } finally {
      setSubmittingReturn(false);
    }
  };

  // Toast
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const tabParam = searchParams.get('tab') || 'borrow';
    setActiveTab(tabParam);
  }, [searchParams]);

  useEffect(() => {
    const handleSetTab = (e: any) => {
      if (e.detail) {
        setActiveTab(e.detail);
        if (e.detail === 'borrow') setTransactionType('Direct_Borrow');
        if (e.detail === 'reserve') setTransactionType('Reservation');
        window.history.pushState(null, '', `?tab=${e.detail}`);
      }
    };
    window.addEventListener('pigeon:set-tab', handleSetTab);
    return () => window.removeEventListener('pigeon:set-tab', handleSetTab);
  }, []);

  // Handle ESC key to dismiss any open modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedTicket(null);
        setTicketToDelete(null);
        setZoomProofUrl(null);
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
    if (submittingCheckout) return;
    setSubmittingCheckout(true);

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
          expected_return_date: returnDate ? new Date(returnDate).toISOString() : null,
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
    } finally {
      setSubmittingCheckout(false);
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
                  activeTab === 'history' ? 'Riwayat Tiket' :
                    'Peminjaman Saya'
      }>
        {/* Toast Alert */}
        {alertMsg && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-in fade-in flex items-center gap-2 ${alertMsg.type === 'success'
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
              <span>Tiket Aktif ({transactions.filter((t) => t.status !== 'Returned').length})</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex overflow-x-auto gap-2 pb-2 mb-6 border-b border-slate-200">
          {[
            { id: 'borrow', label: 'Peminjaman Langsung', icon: ShoppingBag },
            { id: 'reserve', label: 'Reservasi Terjadwal', icon: CalendarCheck },
            { id: 'inventory', label: 'Katalog Barang', icon: Boxes },
            { id: 'tickets', label: 'Tiket Aktif', icon: Ticket, count: transactions.filter((t) => t.status !== 'Returned').length },
            { id: 'return', label: 'Pengembalian Barang', icon: RotateCcw },
            { id: 'history', label: 'Riwayat Tiket', icon: Clock, count: transactions.filter((t) => t.status === 'Returned').length },
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
                  window.history.pushState(null, '', `?tab=${tab.id}`);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${isActive
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
                      disabled={submittingCheckout}
                      className="w-full mt-2 py-3 bg-pigeon-600 hover:bg-pigeon-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {submittingCheckout && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>
                        {submittingCheckout
                          ? 'Memproses Permohonan...'
                          : activeTab === 'reserve'
                            ? 'Kirim Reservasi Terjadwal'
                            : 'Kirim Permohonan Peminjaman'}
                      </span>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Daftar Tiket Peminjaman Saya</h2>
                <p className="text-xs text-slate-500">
                  Tunjukkan Ticket ID ini kepada Admin atau Supervisor saat mengambil barang di laboratorium.
                </p>
              </div>
              {/* Filter Toggle: Active vs History */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setTicketTabFilter('active')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${ticketTabFilter === 'active'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  Tiket Aktif ({transactions.filter((t) => t.status !== 'Returned').length})
                </button>
                <button
                  type="button"
                  onClick={() => setTicketTabFilter('history')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${ticketTabFilter === 'history'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  Selesai / Dikembalikan ({transactions.filter((t) => t.status === 'Returned').length})
                </button>
              </div>
            </div>

            {(() => {
              const displayedTxs = transactions.filter((t) =>
                ticketTabFilter === 'active' ? t.status !== 'Returned' : t.status === 'Returned'
              );

              if (displayedTxs.length === 0) {
                return (
                  <div className="py-12 text-center text-slate-400">
                    <Ticket className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-700">
                      {ticketTabFilter === 'active'
                        ? 'Tidak ada tiket peminjaman aktif'
                        : 'Belum ada riwayat pengembalian barang'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {ticketTabFilter === 'active'
                        ? 'Pilih barang di menu Peminjaman Langsung untuk mengajukan tiket baru.'
                        : 'Tiket yang telah disetujui pengembaliannya akan tersimpan di sini.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {displayedTxs.map((tx) => (
                    <div
                      key={tx.ticket_id}
                      className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-slate-900 text-base">{tx.ticket_id}</span>
                          {tx.is_return_pending ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-700" />
                              Menunggu Approval Pengembalian
                            </span>
                          ) : (
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${tx.status === 'Approved' || tx.status === 'Ready_for_Pickup'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : tx.status === 'Picked_Up'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                  : tx.status === 'Pending_Approval' || tx.status === 'In_Queue'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : tx.status === 'Returned'
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : 'bg-red-100 text-red-800 border border-red-300'
                                }`}
                            >
                              {tx.status}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-700">
                          <span className="font-semibold">Tujuan:</span> {tx.purpose}
                        </p>

                        <div className="text-[11px] text-slate-500 flex flex-wrap gap-4 pt-1">
                          <span>Waktu: {new Date(tx.borrow_date).toLocaleDateString('id-ID')}</span>
                          <span>Durasi: {tx.duration}</span>
                          {tx.expected_return_date && (
                            <span className="text-red-600 font-semibold">
                              Batas Kembali: {formatDueDateTime(tx.expected_return_date)}
                            </span>
                          )}
                        </div>

                        {/* Return Rejection Warning Note */}
                        {tx.return_rejection_note && (
                          <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded-lg text-red-800 text-[11px] font-medium flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                            <span>Pengembalian Ditolak Staf: {tx.return_rejection_note}. Silakan unggah foto ulang.</span>
                          </div>
                        )}

                        {/* Items */}
                        <div className="pt-1.5 flex flex-wrap gap-1.5">
                          {tx.items?.map((it) => (
                            <span key={it.id} className="text-[10px] bg-white border px-2 py-0.5 rounded text-slate-800 font-medium">
                              {it.item_name} ({it.qty_borrowed} unit)
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center flex-wrap justify-end">
                        <button
                          onClick={() => setSelectedTicket(tx)}
                          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Detail & QR</span>
                        </button>

                        {/* Return Action Buttons */}
                        {(tx.status === 'Picked_Up' || tx.status === 'Overdue') && (
                          <>
                            {tx.is_return_pending ? (
                              <button
                                onClick={() => handleSelectTicketForReturn(tx)}
                                className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
                              >
                                <Eye className="w-3.5 h-3.5 text-amber-700" />
                                <span>Lihat Status Pengembalian</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSelectTicketForReturn(tx)}
                                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Kembalikan Barang</span>
                              </button>
                            )}
                          </>
                        )}

                        {/* If Returned and has proof photo */}
                        {tx.status === 'Returned' && tx.return_proof_url && (
                          <button
                            onClick={() => setZoomProofUrl(tx.return_proof_url!)}
                            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Foto Bukti</span>
                          </button>
                        )}

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
                        ) : tx.status !== 'Returned' && (
                          <span className="text-[10px] text-slate-400 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg font-medium">
                            Terkunci (Disetujui)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB: RETURN ITEM */}
        {activeTab === 'return' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-6 max-w-2xl mx-auto">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-pigeon-600" />
                <span>Pengembalian Barang Pinjaman</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Pilih tiket pinjaman aktif Anda, periksa rincian barang, dan wajib unggah foto bukti fisik serah terima di ICT Lab sebelum mengajukan penutupan tiket.
              </p>
            </div>

            {/* Quick Select from Active Borrowed Tickets */}
            {(() => {
              const activeBorrowed = transactions.filter(
                (t) => (t.status === 'Picked_Up' || t.status === 'Overdue' || t.is_return_pending) && t.status !== 'Returned'
              );

              return (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Pilih Tiket Pinjaman Aktif Anda:
                  </label>
                  {activeBorrowed.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeBorrowed.map((tx) => {
                        const isSelected = selectedReturnTx?.ticket_id === tx.ticket_id;
                        return (
                          <div
                            key={tx.ticket_id}
                            onClick={() => handleSelectTicketForReturn(tx)}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${isSelected
                              ? 'border-pigeon-600 bg-pigeon-50/70 ring-2 ring-pigeon-200'
                              : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'
                              }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono font-bold text-xs text-slate-900">{tx.ticket_id}</span>
                              {tx.is_return_pending ? (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                  ⏳ Menunggu Approval
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-900">
                                  {tx.status}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600 line-clamp-1">{tx.purpose}</p>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {tx.items?.map((it) => it.item_name).join(', ')}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                      Tidak ada barang pinjaman aktif saat ini.
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Manual Input Search */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Atau Cari Berdasarkan Ticket ID (Format PGE-XXXX):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="PGE-0001"
                  value={returnInputTicketId}
                  onChange={(e) => setReturnInputTicketId(e.target.value.toUpperCase())}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs uppercase font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    const found = transactions.find((t) => t.ticket_id === returnInputTicketId.trim());
                    if (found) {
                      handleSelectTicketForReturn(found);
                    } else {
                      showNotification('Ticket ID tidak ditemukan pada akun Anda', 'error');
                    }
                  }}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm whitespace-nowrap cursor-pointer"
                >
                  Cari Tiket
                </button>
              </div>
            </div>

            {/* Selected Return Details & Submission Form */}
            {selectedReturnTx ? (
              <div className="space-y-4 pt-4 border-t border-slate-200">
                {/* Card 1: Information of Ticket and Items */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-black text-slate-900 text-sm">{selectedReturnTx.ticket_id}</span>
                      <p className="text-xs text-slate-600 font-medium">Peminjam: {selectedReturnTx.user_name}</p>
                    </div>
                    {selectedReturnTx.status === 'Returned' ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        Status: Returned (Selesai)
                      </span>
                    ) : selectedReturnTx.is_return_pending ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-700" />
                        Menunggu Approval
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900">
                        Status: {selectedReturnTx.status}
                      </span>
                    )}
                  </div>

                  <div className="text-xs space-y-1 text-slate-600 pt-2 border-t border-slate-200">
                    <p><span className="font-semibold text-slate-700">Tujuan Peminjaman:</span> {selectedReturnTx.purpose}</p>
                    <p><span className="font-semibold text-slate-700">Waktu Pinjam:</span> {new Date(selectedReturnTx.borrow_date).toLocaleString('id-ID')}</p>
                    {selectedReturnTx.expected_return_date && (
                      <p><span className="font-semibold text-slate-700">Batas Pengembalian:</span> <span className="text-red-600 font-bold">{formatDueDateTime(selectedReturnTx.expected_return_date)}</span></p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200">
                    <p className="text-xs font-bold text-slate-800 mb-1.5">Barang Fisik yang Wajib Dikembalikan:</p>
                    <div className="space-y-1.5">
                      {selectedReturnTx.items?.map((it) => (
                        <div key={it.id} className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-800">{it.item_name} ({it.brand || 'Original'})</span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded-lg text-[11px]">
                            {it.qty_borrowed} unit • {it.location || 'ICT Lab'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card 2: Return Status (Returned vs Pending Approval vs Form Upload) */}
                {selectedReturnTx.status === 'Returned' ? (
                  <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs sm:text-sm">
                        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span>Tiket Telah Selesai & Ditutup</span>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-bold rounded-full">
                        Status: Returned
                      </span>
                    </div>

                    <p className="text-xs text-emerald-800">
                      Barang fisik telah dikembalikan dan diverifikasi serta disetujui staf ICT Lab. Seluruh kewajiban peminjaman untuk tiket ini telah selesai dan tiket telah ditutup.
                    </p>

                    {selectedReturnTx.return_proof_url && (
                      <div>
                        <p className="text-xs font-semibold text-emerald-950 mb-1.5">Foto Bukti Fisik Pengembalian Terverifikasi:</p>
                        <div className="relative inline-block group">
                          <img
                            src={selectedReturnTx.return_proof_url}
                            alt="Bukti Fisik Pengembalian"
                            onClick={() => setZoomProofUrl(selectedReturnTx.return_proof_url!)}
                            className="w-48 h-32 object-cover rounded-xl border border-emerald-300 shadow-sm cursor-zoom-in group-hover:opacity-90 transition-opacity"
                          />
                          <button
                            type="button"
                            onClick={() => setZoomProofUrl(selectedReturnTx.return_proof_url!)}
                            className="absolute inset-0 bg-black/30 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold gap-1 transition-opacity cursor-pointer"
                          >
                            <Eye className="w-4 h-4" /> Perbesar Foto
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="pt-3 border-t border-emerald-200/70 text-xs flex flex-wrap gap-4 text-emerald-800">
                      {selectedReturnTx.returned_at && (
                        <p><span className="font-semibold text-emerald-950">Waktu Selesai:</span> {new Date(selectedReturnTx.returned_at).toLocaleString('id-ID')}</p>
                      )}
                      {selectedReturnTx.returned_condition && (
                        <p><span className="font-semibold text-emerald-950">Kondisi Barang:</span> {selectedReturnTx.returned_condition}</p>
                      )}
                      {selectedReturnTx.received_by && (
                        <p><span className="font-semibold text-emerald-950">Diterima Oleh:</span> {selectedReturnTx.received_by}</p>
                      )}
                    </div>

                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedTicket(selectedReturnTx)}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Buka Detail Tiket</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span>Buka Riwayat Tiket</span>
                      </button>
                    </div>
                  </div>
                ) : selectedReturnTx.is_return_pending ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Permohonan Penutupan Tiket Sedang Diverifikasi Staf ICT</span>
                    </div>
                    <p className="text-xs text-amber-800">
                      Anda telah mengajukan penutupan tiket ini. Staf / Supervisor ICT Lab sedang memverifikasi fisik barang dan foto bukti yang telah Anda kirimkan. Tiket akan otomatis selesai dan hilang dari daftar pinjaman aktif setelah disetujui staf.
                    </p>

                    {selectedReturnTx.return_proof_url && (
                      <div>
                        <p className="text-[11px] font-semibold text-amber-900 mb-1.5">Foto Bukti Fisik yang Dikirimkan:</p>
                        <div className="relative inline-block group">
                          <img
                            src={selectedReturnTx.return_proof_url}
                            alt="Bukti Fisik Pengembalian"
                            onClick={() => setZoomProofUrl(selectedReturnTx.return_proof_url!)}
                            className="w-48 h-32 object-cover rounded-xl border border-amber-300 shadow-sm cursor-zoom-in group-hover:opacity-90 transition-opacity"
                          />
                          <button
                            type="button"
                            onClick={() => setZoomProofUrl(selectedReturnTx.return_proof_url!)}
                            className="absolute inset-0 bg-black/30 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold gap-1 transition-opacity cursor-pointer"
                          >
                            <Eye className="w-4 h-4" /> Perbesar
                          </button>
                        </div>
                        <span className="text-[10px] text-amber-700 italic block mt-1">
                          Klik foto di atas untuk melihat tampilan penuh
                        </span>
                      </div>
                    )}

                    {selectedReturnTx.return_notes && (
                      <div className="p-2.5 bg-amber-100/60 rounded-xl text-xs text-amber-900">
                        <span className="font-semibold">Catatan Anda:</span> "{selectedReturnTx.return_notes}"
                      </div>
                    )}

                    <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-amber-700 font-medium">
                        Status: Menunggu konfirmasi staf ICT Lab 1 & 2
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReturnTx({ ...selectedReturnTx, is_return_pending: false });
                        }}
                        className="text-amber-900 underline font-semibold hover:text-amber-950 cursor-pointer"
                      >
                        Unggah Ulang Bukti
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitReturnRequest} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                    {selectedReturnTx.return_rejection_note && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Permohonan Pengembalian Sebelumnya Ditolak:</p>
                          <p className="text-red-700">{selectedReturnTx.return_rejection_note}</p>
                          <p className="text-[10px] text-red-600 mt-1">Silakan ambil foto bukti fisik baru yang jelas dan ajukan kembali.</p>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center justify-between">
                        <span>Foto Bukti Pengembalian Fisik <span className="text-red-600">* (Wajib)</span></span>
                        <span className="text-[10px] text-slate-400 font-normal">Kamera HP / File Foto</span>
                      </label>

                      {returnProofPreview ? (
                        <div className="relative rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-4 text-center">
                          <img
                            src={returnProofPreview}
                            alt="Preview Bukti Pengembalian"
                            onClick={() => setZoomProofUrl(returnProofPreview)}
                            className="w-full max-h-56 object-contain rounded-xl mx-auto cursor-zoom-in shadow-sm"
                          />
                          <div className="flex items-center justify-center gap-2 mt-3">
                            <button
                              type="button"
                              onClick={() => setZoomProofUrl(returnProofPreview)}
                              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" /> Perbesar
                            </button>
                            <label className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer">
                              <Camera className="w-3.5 h-3.5" /> Ganti Foto
                              <input type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} className="hidden" />
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setReturnProofFile(null);
                                setReturnProofPreview(null);
                              }}
                              className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Hapus
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="border-2 border-dashed border-slate-300 hover:border-pigeon-500 bg-white hover:bg-slate-50/50 rounded-2xl p-6 text-center cursor-pointer transition-colors block">
                          <input type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} className="hidden" />
                          <div className="w-12 h-12 rounded-full bg-pigeon-50 text-pigeon-600 flex items-center justify-center mx-auto mb-2">
                            <Camera className="w-6 h-6" />
                          </div>
                          <p className="text-xs font-bold text-slate-800">Ambil Foto / Pilih Gambar Bukti</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Ambil foto barang fisik yang telah diletakkan di meja piket / lemari ICT Lab
                          </p>
                          <span className="inline-block mt-2 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold">
                            Buka Kamera / Galeri
                          </span>
                        </label>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Catatan Tambahan Pengembalian (Opsional):
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Contoh: Barang diletakkan di meja piket Lab 1, kondisi kabel adaptor lengkap dan rapi."
                        value={returnNotes}
                        onChange={(e) => setReturnNotes(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-pigeon-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!returnProofPreview || submittingReturn}
                      className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all ${!returnProofPreview || submittingReturn
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-pigeon-600 hover:bg-pigeon-700 active:bg-pigeon-800 text-white cursor-pointer active:scale-[0.99]'
                        }`}
                    >
                      {submittingReturn ? (
                        <span>Mengirim Permohonan...</span>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Ajukan Pengembalian & Tutup Tiket</span>
                        </>
                      )}
                    </button>

                    {!returnProofPreview && (
                      <p className="text-[11px] text-slate-400 text-center italic">
                        * Wajib melampirkan foto bukti fisik untuk mengaktifkan tombol pengajuan pengembalian
                      </p>
                    )}
                  </form>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 bg-slate-50 border border-slate-200 rounded-2xl">
                <RotateCcw className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">Pilih Tiket untuk Memulai Pengembalian</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Klik salah satu tiket pinjaman aktif di atas atau cari dengan Ticket ID.
                </p>
              </div>
            )}
          </div>
        )}
        {/* TAB: HISTORY / RIWAYAT TIKET */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-pigeon-600" />
                  <span>Riwayat Tiket & Pengembalian</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Daftar tiket peminjaman yang telah selesai dikembalikan dan diverifikasi oleh staf ICT Lab.
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari Ticket ID atau tujuan..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-pigeon-500"
                />
              </div>
            </div>

            {(() => {
              const historyTxs = transactions
                .filter((t) => t.status === 'Returned')
                .filter((t) => {
                  if (!historySearchQuery.trim()) return true;
                  const q = historySearchQuery.toLowerCase();
                  return (
                    t.ticket_id.toLowerCase().includes(q) ||
                    t.purpose.toLowerCase().includes(q) ||
                    t.items?.some((it) => it.item_name?.toLowerCase().includes(q))
                  );
                })
                .sort((a, b) => {
                  const timeA = a.returned_at ? new Date(a.returned_at).getTime() : new Date(a.borrow_date).getTime();
                  const timeB = b.returned_at ? new Date(b.returned_at).getTime() : new Date(b.borrow_date).getTime();
                  return timeB - timeA;
                });

              if (historyTxs.length === 0) {
                return (
                  <div className="py-12 text-center text-slate-400">
                    <Clock className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-700">
                      {historySearchQuery ? 'Tidak ada riwayat tiket yang cocok' : 'Belum Ada Riwayat Tiket'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {historySearchQuery
                        ? 'Coba gunakan kata kunci pencarian yang lain.'
                        : 'Tiket yang telah selesai dikembalikan dan diverifikasi staf akan tercatat di sini.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {historyTxs.map((tx) => (
                    <div
                      key={tx.ticket_id}
                      onClick={() => setSelectedTicket(tx)}
                      className="p-4 bg-slate-50 hover:bg-white rounded-2xl border border-slate-200 hover:border-slate-300 transition-all cursor-pointer shadow-sm group flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-slate-900 text-base">{tx.ticket_id}</span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            Returned (Selesai)
                          </span>
                        </div>

                        <p className="text-xs text-slate-800 font-medium">
                          <span className="text-slate-500">Tujuan:</span> {tx.purpose}
                        </p>

                        <div className="text-[11px] text-slate-500 flex flex-wrap gap-4">
                          <span>Dipinjam: {new Date(tx.borrow_date).toLocaleDateString('id-ID')}</span>
                          {tx.returned_at ? (
                            <span className="text-emerald-700 font-semibold">
                              Dikembalikan: {new Date(tx.returned_at).toLocaleString('id-ID')}
                            </span>
                          ) : (
                            <span className="text-slate-500">Durasi: {tx.duration}</span>
                          )}
                          {tx.returned_condition && (
                            <span className="text-slate-600">
                              Kondisi: <span className="font-semibold text-slate-800">{tx.returned_condition}</span>
                            </span>
                          )}
                        </div>

                        {/* Items tags */}
                        <div className="pt-1 flex flex-wrap gap-1.5">
                          {tx.items?.map((it) => (
                            <span
                              key={it.id}
                              className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-lg text-slate-700 font-medium"
                            >
                              {it.item_name} ({it.qty_borrowed} unit)
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Thumbnail of proof + Action buttons */}
                      <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                        {tx.return_proof_url && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setZoomProofUrl(tx.return_proof_url!);
                            }}
                            className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shadow-sm shrink-0 cursor-zoom-in group/img"
                            title="Klik untuk perbesar bukti pengembalian"
                          >
                            <img
                              src={tx.return_proof_url}
                              alt="Bukti Pengembalian"
                              className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/20 group-hover/img:bg-black/40 flex items-center justify-center text-white opacity-0 group-hover/img:opacity-100 transition-opacity">
                              <Eye className="w-4 h-4" />
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTicket(tx);
                          }}
                          className="px-3.5 py-2 bg-slate-900 group-hover:bg-pigeon-600 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Lihat Detail</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
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

            <div className={`inline-block px-3 py-1 rounded-full font-bold text-xs uppercase tracking-wider mb-2 ${selectedTicket.status === 'Returned'
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-pigeon-100 text-pigeon-800'
              }`}>
              {selectedTicket.status === 'Returned' ? 'Riwayat Pengembalian Tiket' : 'Tiket Pengambilan Barang'}
            </div>
            <h3 className="text-3xl font-black font-mono text-slate-900 tracking-tight">{selectedTicket.ticket_id}</h3>
            <p className="text-xs text-slate-500 mt-1">
              Status:{' '}
              <span className={`font-bold ${selectedTicket.status === 'Returned' ? 'text-emerald-700' : 'text-pigeon-700'
                }`}>
                {selectedTicket.status === 'Returned' ? 'Returned (Selesai & Ditutup)' : selectedTicket.status}
              </span>
            </p>

            <div className="my-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs space-y-2 max-h-[50vh] overflow-y-auto">
              <p><span className="text-slate-500">Peminjam:</span> <span className="font-bold text-slate-800">{selectedTicket.user_name}</span></p>
              <p><span className="text-slate-500">Tujuan:</span> {selectedTicket.purpose}</p>
              <p><span className="text-slate-500">Waktu Pinjam:</span> {new Date(selectedTicket.borrow_date).toLocaleString('id-ID')}</p>
              {selectedTicket.status === 'Returned' ? (
                <>
                  {selectedTicket.returned_at && (
                    <p><span className="text-slate-500">Waktu Pengembalian:</span> <span className="font-bold text-emerald-700">{new Date(selectedTicket.returned_at).toLocaleString('id-ID')}</span></p>
                  )}
                  {selectedTicket.returned_condition && (
                    <p><span className="text-slate-500">Kondisi Barang:</span> <span className="font-bold text-slate-800">{selectedTicket.returned_condition}</span></p>
                  )}
                  {selectedTicket.received_by && (
                    <p><span className="text-slate-500">Diverifikasi Oleh:</span> <span className="font-bold text-slate-800">{selectedTicket.received_by}</span></p>
                  )}
                  {selectedTicket.resolution_status && (
                    <p><span className="text-slate-500">Status Resolusi:</span> <span className="font-bold text-slate-800">{selectedTicket.resolution_status}</span></p>
                  )}
                </>
              ) : (
                <p>
                  <span className="text-slate-500">Batas Pengembalian:</span>{' '}
                  <span className="font-bold text-red-600">
                    {formatDueDateTime(selectedTicket.expected_return_date)}
                  </span>
                </p>
              )}

              {/* Photo Proof thumbnail */}
              {selectedTicket.return_proof_url && (
                <div className="pt-2 border-t border-slate-200">
                  <p className="font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Foto Bukti Fisik:</span>
                    <span className="text-[10px] text-slate-400 font-normal">Klik untuk perbesar</span>
                  </p>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomProofUrl(selectedTicket.return_proof_url!);
                    }}
                    className="relative rounded-xl overflow-hidden border border-slate-200 cursor-zoom-in group"
                  >
                    <img
                      src={selectedTicket.return_proof_url}
                      alt="Bukti Serah Terima"
                      className="w-full max-h-36 object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 flex items-center justify-center text-white text-xs font-semibold gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="w-4 h-4" /> Lihat Foto Penuh
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200">
                <p className="font-bold text-slate-700 mb-1">Barang Tertera:</p>
                {selectedTicket.items?.map((it) => (
                  <p key={it.id} className="text-slate-600">• {it.item_name} ({it.qty_borrowed} unit)</p>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mb-4">
              {selectedTicket.status === 'Returned'
                ? 'Tiket ini telah selesai diproses dan seluruh barang telah diverifikasi kembali ke inventaris lab.'
                : 'Tunjukkan layar ini kepada Admin / Supervisor ICT Lab 1 atau Lab 2 untuk serah terima barang fisik.'}
            </p>

            {selectedTicket.status === 'Returned' ? (
              <div className="w-full mb-2.5 py-2.5 px-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold rounded-xl flex items-center justify-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Tiket Selesai & Ditutup</span>
              </div>
            ) : (selectedTicket.status === 'Pending_Approval' ||
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
              {selectedTicket.status === 'Returned' ? 'Tutup Detail' : 'Tutup Tiket'}
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

      {/* MODAL: PHOTO PROOF ZOOM / LIGHTBOX */}
      {zoomProofUrl && (
        <div
          onClick={() => setZoomProofUrl(null)}
          className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="relative max-w-2xl w-full text-center my-auto" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setZoomProofUrl(null)}
              className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
              title="Tutup (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={zoomProofUrl}
              alt="Foto Bukti Pengembalian Fisik"
              className="max-h-[80vh] w-auto max-w-full rounded-2xl mx-auto shadow-2xl border border-white/20 object-contain"
            />
            <p className="text-white/80 text-xs mt-3 font-semibold">Foto Bukti Pengembalian Fisik Barang</p>
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
