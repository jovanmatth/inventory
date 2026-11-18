'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import {
  Boxes,
  Layers,
  Activity,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ShoppingBag,
  Plus,
  Clock,
  Search,
  Filter,
  Check,
  AlertTriangle,
  AlertOctagon,
  RefreshCw,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import {
  InventoryItem,
  BorrowingTransaction,
  ReturnedCondition,
  ResolutionStatus,
} from '@/types';

function SupervisorDashboardContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);

  const [stats, setStats] = useState<any>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<BorrowingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Cart for borrowing / reservation
  const [cart, setCart] = useState<{ item: InventoryItem; qty: number }[]>([]);
  const [borrowPurpose, setBorrowPurpose] = useState('');
  const [borrowDuration, setBorrowDuration] = useState('2 Hari');
  const [borrowReturnDate, setBorrowReturnDate] = useState('');
  const [borrowType, setBorrowType] = useState<'Direct_Borrow' | 'Reservation'>('Direct_Borrow');

  // Approval state
  const [rejectModalTx, setRejectModalTx] = useState<BorrowingTransaction | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Return state
  const [selectedReturnTx, setSelectedReturnTx] = useState<BorrowingTransaction | null>(null);
  const [returnTicketId, setReturnTicketId] = useState('');
  const [returnedCondition, setReturnedCondition] = useState<ReturnedCondition>('Good');
  const [customPenalty, setCustomPenalty] = useState('');
  const [resolutionStatus, setResolutionStatus] = useState<ResolutionStatus>('Resolved');

  // Filter
  const [itemSearch, setItemSearch] = useState('');
  const [itemLocationFilter, setItemLocationFilter] = useState('All');

  // Toast
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) setActiveTab(tabParam);
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/monitoring').then((r) => r.json()),
      fetch('/api/inventory').then((r) => r.json()),
      fetch('/api/transactions').then((r) => r.json()),
    ])
      .then(([monData, invData, txData]) => {
        if (monData.success) setStats(monData);
        if (invData.success) setInventory(invData.items);
        if (txData.success) setTransactions(txData.transactions);
      })
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  const handleAddToCart = (item: InventoryItem) => {
    if (item.qty <= 0) {
      showNotification('Stok barang sedang habis', 'error');
      return;
    }
    const existing = cart.find((c) => c.item.item_id === item.item_id);
    if (existing) {
      if (existing.qty >= item.qty) {
        showNotification('Jumlah melebihi stok yang tersedia', 'error');
        return;
      }
      setCart(cart.map((c) => (c.item.item_id === item.item_id ? { ...c, qty: c.qty + 1 } : c)));
    } else {
      setCart([...cart, { item, qty: 1 }]);
    }
    showNotification(`"${item.item_name}" ditambahkan ke keranjang`);
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCart(cart.filter((c) => c.item.item_id !== itemId));
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart.length) {
      showNotification('Keranjang barang masih kosong', 'error');
      return;
    }

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'USR-002', // Dr. Hendra Gunawan (Supervisor)
          transaction_type: borrowType,
          purpose: borrowPurpose,
          borrow_date: new Date().toISOString(),
          duration: borrowDuration,
          expected_return_date: borrowReturnDate || null,
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
      setBorrowPurpose('');
      setBorrowReturnDate('');
      setRefreshTrigger((v) => v + 1);
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleApprove = async (ticketId: string) => {
    try {
      const res = await fetch(`/api/transactions/${ticketId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', approved_by: 'USR-002' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      showNotification(data.message);
      setRefreshTrigger((v) => v + 1);
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleReject = async () => {
    if (!rejectModalTx) return;
    try {
      const res = await fetch(`/api/transactions/${rejectModalTx.ticket_id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          approved_by: 'USR-002',
          rejection_reason: rejectionReason,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      showNotification(data.message);
      setRejectModalTx(null);
      setRejectionReason('');
      setRefreshTrigger((v) => v + 1);
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturnTx) return;

    try {
      const res = await fetch(`/api/transactions/${selectedReturnTx.ticket_id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returned_condition: returnedCondition,
          return_date: new Date().toISOString(),
          resolution_status: resolutionStatus,
          received_by: 'USR-002',
          custom_penalty_note: customPenalty,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      showNotification(data.message);
      setSelectedReturnTx(null);
      setReturnTicketId('');
      setRefreshTrigger((v) => v + 1);
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const filteredItems = inventory.filter((item) => {
    const matchSearch =
      item.item_name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      item.brand.toLowerCase().includes(itemSearch.toLowerCase());
    const matchLoc = itemLocationFilter === 'All' || item.location === itemLocationFilter;
    return matchSearch && matchLoc;
  });

  const pendingRequests = transactions.filter((t) => t.status === 'Pending_Approval' || t.status === 'In_Queue');
  const activeLoans = transactions.filter((t) => t.status === 'Picked_Up' || t.status === 'Approved' || t.status === 'Ready_for_Pickup');

  return (
    <AppShell activeMenu={
      activeTab === 'inventory' ? 'Katalog Barang (View Only)' :
      activeTab === 'borrow' ? 'Pinjam & Reservasi Barang' :
      activeTab === 'approvals' ? 'Persetujuan Request' :
      activeTab === 'returns' ? 'Pemeriksaan Kembali & Sanksi' :
      activeTab === 'monitoring' ? 'Pemantauan Stok & Overdue' :
      'Supervisor Dashboard'
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Supervisor Dashboard</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
              Role: Supervisor
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pengawasan operasional lab, persetujuan peminjaman, pemeriksaan pengembalian, serta fasilitas peminjaman mandiri.
          </p>
        </div>

        <button
          onClick={() => setRefreshTrigger((v) => v + 1)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2 mb-6 border-b border-slate-200">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'inventory', label: 'Katalog Barang', icon: Boxes, count: inventory.length },
          { id: 'borrow', label: 'Pinjam & Reservasi', icon: ShoppingBag, count: cart.length > 0 ? cart.length : undefined },
          { id: 'approvals', label: 'Approval Tiket', icon: CheckCircle2, count: pendingRequests.length, highlight: pendingRequests.length > 0 },
          { id: 'returns', label: 'Pengembalian & Sanksi', icon: RotateCcw, count: activeLoans.length },
          { id: 'monitoring', label: 'Monitoring Lab', icon: Layers },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : tab.highlight
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Permintaan Menunggu Approval</p>
              <h3 className="text-2xl font-black text-amber-600 mt-1">{pendingRequests.length} tiket</h3>
              <p className="text-[11px] text-slate-400 mt-1">Peminjaman langsung & reservasi</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Peminjaman Aktif</p>
              <h3 className="text-2xl font-black text-blue-600 mt-1">{activeLoans.length} tiket</h3>
              <p className="text-[11px] text-slate-400 mt-1">Barang sedang digunakan</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Peringatan Overdue</p>
              <h3 className="text-2xl font-black text-red-600 mt-1">{stats?.stats?.overdueTransactions?.length || 0} item</h3>
              <p className="text-[11px] text-slate-400 mt-1">Melebihi tanggal kembali</p>
            </div>
          </div>

          {/* Pending approval preview */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-3">Antrean Persetujuan Tiket Terkini</h3>
            {pendingRequests.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Tidak ada antrean persetujuan.</p>
            ) : (
              <div className="space-y-2">
                {pendingRequests.slice(0, 3).map((tx) => (
                  <div key={tx.ticket_id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-slate-900">{tx.ticket_id}</span>
                      <p className="text-slate-800 font-semibold">{tx.user_name} • <span className="italic">{tx.purpose}</span></p>
                    </div>
                    <button
                      onClick={() => setActiveTab('approvals')}
                      className="px-3 py-1 bg-pigeon-600 text-white rounded-lg text-xs font-semibold"
                    >
                      Buka Approval
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INVENTORY (VIEW ONLY) */}
      {activeTab === 'inventory' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Katalog Barang ICT Lab 1 & 2 (View Only)</h2>
              <p className="text-xs text-slate-500">
                Pencarian dan peninjauan ketersediaan barang di kedua laboratorium.
              </p>
            </div>
            <span className="text-[11px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg border">
              Read-Only Access
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8 relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari barang, brand..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-4">
              <select
                value={itemLocationFilter}
                onChange={(e) => setItemLocationFilter(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
              >
                <option value="All">Semua Lokasi Lab</option>
                <option value="ICT Lab 1">ICT Lab 1</option>
                <option value="ICT Lab 2">ICT Lab 2</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Nama Barang</th>
                  <th className="p-3">Brand</th>
                  <th className="p-3">Lokasi</th>
                  <th className="p-3">Stok</th>
                  <th className="p-3">Tipe</th>
                  <th className="p-3">Kondisi</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.item_id} className="hover:bg-slate-50/80">
                    <td className="p-3 font-semibold text-slate-900">{item.item_name}</td>
                    <td className="p-3 text-slate-600">{item.brand}</td>
                    <td className="p-3">
                      <span className="font-semibold">{item.location}</span>
                      <p className="text-[10px] text-slate-400">{item.location_detail}</p>
                    </td>
                    <td className="p-3 font-bold">{item.qty} unit</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100">{item.borrowing_type}</span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${item.condition === 'Good' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                        {item.condition}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleAddToCart(item)}
                        className="px-2.5 py-1 bg-pigeon-600 hover:bg-pigeon-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Pinjam</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: BORROW & RESERVE WITH CART */}
      {activeTab === 'borrow' && (
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Pilih Barang untuk Dipinjam / Direservasi</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {inventory.filter((i) => i.qty > 0).map((it) => (
                <div key={it.item_id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded font-semibold">
                      {it.borrowing_type}
                    </span>
                    <p className="font-bold text-slate-900 text-xs mt-1">{it.item_name}</p>
                    <p className="text-[11px] text-slate-500">{it.brand} • {it.location}</p>
                    <p className="text-[11px] text-slate-700 font-semibold mt-1">Stok: {it.qty} unit</p>
                  </div>
                  <button
                    onClick={() => handleAddToCart(it)}
                    className="mt-3 w-full py-1.5 bg-pigeon-600 hover:bg-pigeon-700 text-white font-semibold text-xs rounded-lg shadow-sm"
                  >
                    + Masukkan Keranjang
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Cart & Checkout */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-pigeon-600" />
                <span>Keranjang Pengajuan ({cart.length})</span>
              </h3>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-xs text-red-600 hover:underline">
                  Kosongkan
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">Keranjang masih kosong. Pilih barang dari sisi kiri.</p>
            ) : (
              <form onSubmit={handleCheckout} className="space-y-3">
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {cart.map((c) => (
                    <div key={c.item.item_id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{c.item.item_name}</p>
                        <p className="text-[10px] text-slate-400">{c.item.location} • {c.item.borrowing_type}</p>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis Transaksi:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBorrowType('Direct_Borrow')}
                      className={`py-1.5 text-xs font-semibold rounded-lg border ${borrowType === 'Direct_Borrow' ? 'bg-pigeon-600 text-white border-pigeon-600' : 'bg-slate-50 text-slate-700'}`}
                    >
                      Peminjaman Langsung
                    </button>
                    <button
                      type="button"
                      onClick={() => setBorrowType('Reservation')}
                      className={`py-1.5 text-xs font-semibold rounded-lg border ${borrowType === 'Reservation' ? 'bg-pigeon-600 text-white border-pigeon-600' : 'bg-slate-50 text-slate-700'}`}
                    >
                      Reservasi Terjadwal
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tujuan Peminjaman:</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Praktikum Pemrograman Mobile"
                    value={borrowPurpose}
                    onChange={(e) => setBorrowPurpose(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-pigeon-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Durasi:</label>
                    <input
                      type="text"
                      value={borrowDuration}
                      onChange={(e) => setBorrowDuration(e.target.value)}
                      placeholder="Contoh: 3 Hari"
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Jadwal Kembali:</label>
                    <input
                      type="date"
                      value={borrowReturnDate}
                      onChange={(e) => setBorrowReturnDate(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-2.5 bg-pigeon-600 hover:bg-pigeon-700 text-white font-bold text-xs rounded-xl shadow-md"
                >
                  Ajukan Permohonan (Checkout)
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: APPROVAL */}
      {activeTab === 'approvals' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900">Persetujuan Tiket Peminjaman</h2>
          {pendingRequests.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">Tidak ada permohonan yang menunggu persetujuan.</p>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((tx) => (
                <div key={tx.ticket_id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-bold text-slate-900">{tx.ticket_id}</span>
                    <p className="font-semibold text-slate-800">{tx.user_name} • {tx.purpose}</p>
                    <p className="text-slate-500">Durasi: {tx.duration} • Status: {tx.status}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(tx.ticket_id)}
                      className="px-3 py-1.5 bg-pigeon-600 hover:bg-pigeon-700 text-white rounded-lg font-bold"
                    >
                      Setujui
                    </button>
                    <button
                      onClick={() => setRejectModalTx(tx)}
                      className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg font-bold"
                    >
                      Tolak
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: RETURNS & PENALTIES */}
      {activeTab === 'returns' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-base font-bold text-slate-900 mb-2">Pemeriksaan Kembali Barang</h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Masukkan Ticket ID (PGE-XXXX)..."
                value={returnTicketId}
                onChange={(e) => setReturnTicketId(e.target.value.toUpperCase())}
                className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs uppercase flex-1 font-mono"
              />
              <button
                onClick={() => {
                  const f = transactions.find((t) => t.ticket_id === returnTicketId);
                  if (f) setSelectedReturnTx(f);
                  else showNotification('Tiket tidak ditemukan', 'error');
                }}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Cari
              </button>
            </div>

            {selectedReturnTx && (
              <form onSubmit={handleSubmitReturn} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                <p className="font-bold text-slate-900">Verifikasi Tiket {selectedReturnTx.ticket_id} ({selectedReturnTx.user_name})</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Kondisi Barang:</label>
                    <select
                      value={returnedCondition}
                      onChange={(e) => setReturnedCondition(e.target.value as ReturnedCondition)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    >
                      <option value="Good">Kondisi Baik</option>
                      <option value="Damaged_Light">Rusak Ringan</option>
                      <option value="Damaged_Medium">Rusak Sedang</option>
                      <option value="Damaged_Heavy">Rusak Berat</option>
                      <option value="Lost">Hilang</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Status Resolusi:</label>
                    <select
                      value={resolutionStatus}
                      onChange={(e) => setResolutionStatus(e.target.value as ResolutionStatus)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    >
                      <option value="Resolved">Resolved (Selesai)</option>
                      <option value="Not_Resolved">Not Resolved</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-pigeon-600 hover:bg-pigeon-700 text-white rounded-xl font-bold"
                >
                  Konfirmasi Pengembalian
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: MONITORING */}
      {activeTab === 'monitoring' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900">Pemantauan Sistem Laboratorium</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h4 className="font-bold text-xs mb-2">Stok ICT Lab 1</h4>
              <p className="text-xl font-black text-slate-900">
                {stats?.stats?.labStats?.find((l: any) => l.location === 'ICT Lab 1')?.total_qty || 0} unit
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <h4 className="font-bold text-xs mb-2">Stok ICT Lab 2</h4>
              <p className="text-xl font-black text-slate-900">
                {stats?.stats?.labStats?.find((l: any) => l.location === 'ICT Lab 2')?.total_qty || 0} unit
              </p>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectModalTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="font-bold text-slate-900 mb-2">Alasan Penolakan Tiket {rejectModalTx.ticket_id}</h3>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Tuliskan alasan penolakan..."
              className="w-full p-2.5 border rounded-xl text-xs mb-3"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRejectModalTx(null)} className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs">Batal</button>
              <button onClick={handleReject} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold">Tolak Tiket</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function SupervisorDashboard() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs text-slate-500">Memuat Supervisor...</div>}>
      <SupervisorDashboardContent />
    </React.Suspense>
  );
}
