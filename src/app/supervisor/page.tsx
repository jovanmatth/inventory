'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { useRealtimeSync, broadcastDataChange } from '@/lib/useRealtimeSync';
import {
  Boxes,
  Layers,
  Activity,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ShoppingBag,
  Plus,
  Minus,
  Clock,
  Search,
  Filter,
  Check,
  AlertTriangle,
  AlertOctagon,
  RefreshCw,
  ShoppingCart,
  Trash2,
  Eye,
  Camera,
  CheckCircle,
  X,
  Loader2,
} from 'lucide-react';
import {
  InventoryItem,
  BorrowingTransaction,
  ReturnedCondition,
  ResolutionStatus,
  User,
} from '@/types';
import { calculateDueDateLocal, formatDueDateTime } from '@/lib/date-utils';

const calculateDueDate = calculateDueDateLocal;

function SupervisorDashboardContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [stats, setStats] = useState<any>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<BorrowingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Cart for borrowing / reservation
  const [cart, setCart] = useState<{ item: InventoryItem; qty: number }[]>([]);
  const [borrowPurpose, setBorrowPurpose] = useState('');
  const [borrowDuration, setBorrowDuration] = useState('1 Hari');
  const [borrowReturnDate, setBorrowReturnDate] = useState(() => calculateDueDate('1 Hari'));
  const [borrowType, setBorrowType] = useState<'Direct_Borrow' | 'Reservation'>('Direct_Borrow');

  const handleSupervisorDurationChange = (newDur: string) => {
    setBorrowDuration(newDur);
    const autoDue = calculateDueDate(newDur);
    setBorrowReturnDate(autoDue);
  };

  // Approval state
  const [rejectModalTx, setRejectModalTx] = useState<BorrowingTransaction | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Return state
  const [selectedReturnTx, setSelectedReturnTx] = useState<BorrowingTransaction | null>(null);
  const [returnTicketId, setReturnTicketId] = useState('');
  const [returnedCondition, setReturnedCondition] = useState<ReturnedCondition>('Good');
  const [customPenalty, setCustomPenalty] = useState('');
  const [resolutionStatus, setResolutionStatus] = useState<ResolutionStatus>('Resolved');
  const [zoomProofUrl, setZoomProofUrl] = useState<string | null>(null);
  const [rejectReturnModalTx, setRejectReturnModalTx] = useState<BorrowingTransaction | null>(null);
  const [rejectReturnReason, setRejectReturnReason] = useState('');
  const [submittingRejectReturn, setSubmittingRejectReturn] = useState(false);
  const [verifyReturnModalTx, setVerifyReturnModalTx] = useState<BorrowingTransaction | null>(null);
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [loadingApproveId, setLoadingApproveId] = useState<string | null>(null);
  const [loadingPickupId, setLoadingPickupId] = useState<string | null>(null);
  const [submittingCheckout, setSubmittingCheckout] = useState(false);
  const returnFormRef = React.useRef<HTMLDivElement>(null);

  const handleConfirmPickup = async (ticketId: string) => {
    if (loadingPickupId) return;
    setLoadingPickupId(ticketId);
    const performerId = currentUser?.user_id || 'USR-002';
    try {
      const res = await fetch(`/api/transactions/${ticketId}/pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ performed_by: performerId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      showNotification(data.message);
      setRefreshTrigger((v) => v + 1);
      broadcastDataChange();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setLoadingPickupId(null);
    }
  };

  const handleConfirmVerifyReturn = async () => {
    if (!verifyReturnModalTx) return;
    setSubmittingReturn(true);

    let performerId = currentUser?.user_id || 'USR-002';
    if (!currentUser) {
      try {
        const saved = localStorage.getItem('pigeon_last_user');
        if (saved) {
          const u = JSON.parse(saved);
          if (u?.user_id) performerId = u.user_id;
        }
      } catch { }
    }

    try {
      const res = await fetch(`/api/transactions/${verifyReturnModalTx.ticket_id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returned_condition: returnedCondition,
          return_date: new Date().toISOString(),
          resolution_status: resolutionStatus,
          received_by: performerId,
          custom_penalty_note: customPenalty,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Gagal menyelesaikan pengembalian');

      showNotification(data.message || 'Pengembalian barang berhasil disetujui & tiket ditutup');
      setVerifyReturnModalTx(null);
      setSelectedReturnTx(null);
      setReturnTicketId('');
      setRefreshTrigger((v) => v + 1);
      broadcastDataChange();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setSubmittingReturn(false);
    }
  };

  const handleRejectReturn = async () => {
    if (!rejectReturnModalTx) return;
    setSubmittingRejectReturn(true);
    try {
      const res = await fetch(`/api/transactions/${rejectReturnModalTx.ticket_id}/reject-return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectReturnReason.trim() || 'Foto bukti pengembalian tidak valid / barang fisik belum diterima di laboratorium.',
          rejected_by: currentUser?.name ? `${currentUser.name} (Supervisor)` : 'Supervisor ICT Lab',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      showNotification(data.message || 'Bukti pengembalian telah ditolak');
      setRejectReturnModalTx(null);
      setRejectReturnReason('');
      setRefreshTrigger((v) => v + 1);
      broadcastDataChange();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setSubmittingRejectReturn(false);
    }
  };

  // Filter
  const [itemSearch, setItemSearch] = useState('');
  const [itemLocationFilter, setItemLocationFilter] = useState('All');

  // Toast
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const tabParam = searchParams.get('tab') || 'overview';
    setActiveTab(tabParam);
  }, [searchParams]);

  useEffect(() => {
    const handleSetTab = (e: any) => {
      if (e.detail) {
        setActiveTab(e.detail);
        window.history.pushState(null, '', e.detail === 'overview' ? '/supervisor?tab=overview' : `?tab=${e.detail}`);
      }
    };
    window.addEventListener('pigeon:set-tab', handleSetTab);
    return () => window.removeEventListener('pigeon:set-tab', handleSetTab);
  }, []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  // Load all supervisor data with silent background sync
  const loadSupervisorData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const [monData, invData, txData] = await Promise.all([
        fetch('/api/monitoring').then((r) => r.json()),
        fetch('/api/inventory').then((r) => r.json()),
        fetch('/api/transactions').then((r) => r.json()),
      ]);
      if (monData?.success) setStats(monData);
      if (invData?.success) setInventory(invData.items || []);
      if (txData?.success) setTransactions(txData.transactions || []);
    } catch (err) {
      console.error('Supervisor sync error:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    loadSupervisorData(false);
  }, [refreshTrigger]);

  useRealtimeSync({
    onRefresh: () => loadSupervisorData(true),
    pollIntervalMs: 3500,
  });

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

  const handleUpdateCartQty = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFromCart(itemId);
      return;
    }
    setCart((prev) =>
      prev.map((c) => {
        if (c.item.item_id === itemId) {
          const max = c.item.qty;
          if (newQty > max) {
            showNotification(`Jumlah maksimal tersedia untuk "${c.item.item_name}" adalah ${max} unit`, 'error');
            return { ...c, qty: max };
          }
          return { ...c, qty: newQty };
        }
        return c;
      })
    );
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart.length) {
      showNotification('Keranjang barang masih kosong', 'error');
      return;
    }
    if (submittingCheckout) return;
    setSubmittingCheckout(true);

    let borrowerId = currentUser?.user_id || 'USR-002';
    if (!currentUser) {
      try {
        const saved = localStorage.getItem('pigeon_last_user');
        if (saved) {
          const u = JSON.parse(saved);
          if (u?.user_id) borrowerId = u.user_id;
        }
      } catch {}
    }

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: borrowerId,
          transaction_type: borrowType,
          purpose: borrowPurpose,
          borrow_date: new Date().toISOString(),
          duration: borrowDuration,
          expected_return_date: borrowReturnDate ? new Date(borrowReturnDate).toISOString() : null,
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
      setBorrowDuration('1 Hari');
      setBorrowReturnDate(calculateDueDate('1 Hari'));
      setRefreshTrigger((v) => v + 1);
      broadcastDataChange();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setSubmittingCheckout(false);
    }
  };

  const handleApprove = async (ticketId: string) => {
    if (loadingApproveId) return;
    setLoadingApproveId(ticketId);
    const approverId = currentUser?.user_id || 'USR-002';
    try {
      const res = await fetch(`/api/transactions/${ticketId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', approved_by: approverId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      showNotification(data.message);
      setRefreshTrigger((v) => v + 1);
      broadcastDataChange();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setLoadingApproveId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModalTx) return;
    const approverId = currentUser?.user_id || 'USR-002';
    try {
      const res = await fetch(`/api/transactions/${rejectModalTx.ticket_id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          approved_by: approverId,
          rejection_reason: rejectionReason,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      showNotification(data.message);
      setRejectModalTx(null);
      setRejectionReason('');
      setRefreshTrigger((v) => v + 1);
      broadcastDataChange();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReturnTx) return;
    setSubmittingReturn(true);

    let performerId = currentUser?.user_id || 'USR-002';
    if (!currentUser) {
      try {
        const saved = localStorage.getItem('pigeon_last_user');
        if (saved) {
          const u = JSON.parse(saved);
          if (u?.user_id) performerId = u.user_id;
        }
      } catch { }
    }

    try {
      const res = await fetch(`/api/transactions/${selectedReturnTx.ticket_id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returned_condition: returnedCondition,
          return_date: new Date().toISOString(),
          resolution_status: resolutionStatus,
          received_by: performerId,
          custom_penalty_note: customPenalty,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Gagal menyelesaikan pengembalian');

      showNotification(data.message);
      setSelectedReturnTx(null);
      setReturnTicketId('');
      setRefreshTrigger((v) => v + 1);
      broadcastDataChange();
    } catch (err: any) {
      showNotification(err.message, 'error');
    } finally {
      setSubmittingReturn(false);
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
  const activeLoans = transactions.filter((t) => t.status === 'Picked_Up' || t.status === 'Approved' || t.status === 'Ready_for_Pickup' || t.status === 'Overdue');

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
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-in fade-in flex items-center gap-2 ${alertMsg.type === 'success'
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
              onClick={() => {
                setActiveTab(tab.id);
                window.history.pushState(null, '', tab.id === 'overview' ? '/supervisor?tab=overview' : `?tab=${tab.id}`);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${isActive
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isActive
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
                  <th className="p-3">Status Barang</th>
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
                      {item.status === 'Borrowed' || item.qty <= 0 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                          Dipinjam
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Tersedia
                        </span>
                      )}
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
                    <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-semibold">
                      Tersedia
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
                    <div key={c.item.item_id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 truncate" title={c.item.item_name}>{c.item.item_name}</p>
                        <p className="text-[10px] text-slate-400">
                          {c.item.location} • Tersedia: <strong className="text-slate-700">{c.item.qty}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Stepper with Minus, Input, and Plus */}
                        <div className="flex items-center border border-slate-300 bg-white rounded-lg p-0.5 shadow-sm">
                          <button
                            type="button"
                            onClick={() => handleUpdateCartQty(c.item.item_id, c.qty - 1)}
                            disabled={c.qty <= 1}
                            className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold text-xs"
                            title="Kurangi 1 unit"
                          >
                            <Minus className="w-3 h-3" />
                          </button>

                          <input
                            type="number"
                            min={1}
                            max={c.item.qty}
                            value={c.qty}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val)) handleUpdateCartQty(c.item.item_id, val);
                            }}
                            className="w-9 text-center font-bold text-slate-800 text-xs bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            title="Ketik jumlah unit"
                          />

                          <button
                            type="button"
                            onClick={() => handleUpdateCartQty(c.item.item_id, c.qty + 1)}
                            disabled={c.qty >= c.item.qty}
                            className="w-6 h-6 flex items-center justify-center text-pigeon-700 hover:bg-pigeon-50 rounded disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold text-xs"
                            title={c.qty >= c.item.qty ? 'Stok maksimal tercapai' : 'Tambah 1 unit (Add)'}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(c.item.item_id)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                          title="Hapus dari keranjang"
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Durasi Pinjam:</label>
                    <select
                      value={borrowDuration}
                      onChange={(e) => handleSupervisorDurationChange(e.target.value)}
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
                      value={borrowReturnDate}
                      onChange={(e) => setBorrowReturnDate(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-pigeon-500 font-mono"
                    />
                  </div>
                </div>

                {borrowReturnDate && (
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 flex items-center gap-1.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      Jatuh Tempo:{' '}
                      <strong className="text-emerald-950 font-bold">
                        {new Date(borrowReturnDate).toLocaleDateString('id-ID', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}{' '}
                        pukul{' '}
                        {new Date(borrowReturnDate).toLocaleTimeString('id-ID', {
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
                  className="w-full mt-2 py-2.5 bg-pigeon-600 hover:bg-pigeon-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submittingCheckout ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>{submittingCheckout ? 'Memproses Checkout...' : 'Ajukan Permohonan (Checkout)'}</span>
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
                      disabled={loadingApproveId === tx.ticket_id}
                      onClick={() => handleApprove(tx.ticket_id)}
                      className="px-3 py-1.5 bg-pigeon-600 hover:bg-pigeon-700 disabled:opacity-50 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {loadingApproveId === tx.ticket_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      <span>{loadingApproveId === tx.ticket_id ? 'Memproses...' : 'Setujui'}</span>
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
        <div className="space-y-5">
          {/* Section 1: Pending Return Requests with Photo Proof */}
          {(() => {
            const pendingReturns = transactions.filter((t) => t.is_return_pending);

            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-pigeon-600" />
                      <span>Permohonan Pengembalian Menunggu Approval</span>
                      {pendingReturns.length > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          {pendingReturns.length} Menunggu
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Peminjam telah mengunggah foto bukti fisik serah terima dan memohon penutupan tiket pinjaman.
                    </p>
                  </div>
                </div>

                {pendingReturns.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingReturns.map((tx) => (
                      <div
                        key={tx.ticket_id}
                        className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-black text-slate-900 text-sm">{tx.ticket_id}</span>
                            <div className="flex items-center gap-1.5">
                              {(() => {
                                const reqDate = tx.return_requested_at ? new Date(tx.return_requested_at) : new Date();
                                const isLate = tx.expected_return_date ? reqDate.getTime() > new Date(tx.expected_return_date).getTime() : false;
                                const lateDays = isLate && tx.expected_return_date ? Math.ceil((reqDate.getTime() - new Date(tx.expected_return_date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                                if (isLate) {
                                  return (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-900 border border-red-300 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-red-600" /> Terlambat {lateDays} Hari
                                    </span>
                                  );
                                }
                                return (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3 text-emerald-600" /> Tepat Waktu
                                  </span>
                                );
                              })()}
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-700" /> Menunggu Approval
                              </span>
                            </div>
                          </div>

                          <p className="text-xs text-slate-700">
                            <span className="font-semibold">Peminjam:</span> {tx.user_name} ({tx.user_email})
                          </p>

                          <div className="text-[11px] text-slate-500 space-y-0.5">
                            {tx.expected_return_date && (
                              <p>Batas Pengembalian: <span className="font-semibold text-slate-700">{formatDueDateTime(tx.expected_return_date)}</span></p>
                            )}
                            {tx.return_requested_at && (
                              <p>Waktu Diajukan: <span className="font-semibold text-slate-700">{new Date(tx.return_requested_at).toLocaleString('id-ID')}</span></p>
                            )}
                          </div>

                          {tx.return_notes && (
                            <div className="p-2 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900">
                              <span className="font-semibold">Catatan Peminjam:</span> "{tx.return_notes}"
                            </div>
                          )}

                          {/* Items */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {tx.items?.map((it) => (
                              <span key={it.id} className="text-[10px] bg-white border px-2 py-0.5 rounded text-slate-800 font-medium">
                                {it.item_name} ({it.qty_borrowed} unit)
                              </span>
                            ))}
                          </div>

                          {/* Return Proof Photo */}
                          {tx.return_proof_url && (
                            <div className="pt-2">
                              <p className="text-[11px] font-bold text-slate-700 mb-1">Foto Bukti Fisik:</p>
                              <div className="relative group inline-block">
                                <img
                                  src={tx.return_proof_url}
                                  alt="Foto Bukti"
                                  onClick={() => setZoomProofUrl(tx.return_proof_url!)}
                                  className="w-36 h-24 object-cover rounded-xl border border-slate-200 shadow-sm cursor-zoom-in group-hover:opacity-90 transition-opacity"
                                />
                                <button
                                  type="button"
                                  onClick={() => setZoomProofUrl(tx.return_proof_url!)}
                                  className="absolute inset-0 bg-black/30 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold gap-1 transition-opacity cursor-pointer"
                                >
                                  <Eye className="w-4 h-4" /> Perbesar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 pt-3 border-t border-slate-200">
                          <button
                            type="button"
                            onClick={() => {
                              setVerifyReturnModalTx(tx);
                              setReturnedCondition('Good');
                              setResolutionStatus('Resolved');
                              setCustomPenalty('');
                            }}
                            className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Verifikasi & Selesaikan</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectReturnModalTx(tx);
                              setRejectReturnReason('');
                            }}
                            className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                            title="Tolak Bukti"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Tolak Bukti</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-400">
                    Tidak ada permohonan pengembalian yang menunggu konfirmasi saat ini.
                  </div>
                )}
              </div>
            );
          })()}

          {/* Section 2: Return Quality Check Form */}
          <div ref={returnFormRef} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Pemeriksaan Kembali Barang Fisik (Form Manual)</h2>
            <p className="text-xs text-slate-500">
              Cari tiket berdasarkan Ticket ID atau pilih dari permohonan di atas untuk verifikasi serah terima.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Masukkan Ticket ID (PGE-XXXX)..."
                value={returnTicketId}
                onChange={(e) => setReturnTicketId(e.target.value.toUpperCase())}
                className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs uppercase flex-1 font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  const f = transactions.find((t) => t.ticket_id === returnTicketId.trim());
                  if (f) {
                    setSelectedReturnTx(f);
                    returnFormRef.current?.scrollIntoView({ behavior: 'smooth' });
                  } else {
                    showNotification('Tiket tidak ditemukan', 'error');
                  }
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Cari
              </button>
            </div>

            {selectedReturnTx && (
              <form onSubmit={handleSubmitReturn} className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div>
                    <span className="font-mono font-black text-slate-900 text-sm">{selectedReturnTx.ticket_id}</span>
                    <p className="text-xs text-slate-600 font-medium">Peminjam: {selectedReturnTx.user_name} ({selectedReturnTx.user_email})</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900">
                    Status: {selectedReturnTx.status}
                  </span>
                </div>

                {/* Return Proof Photo in Inspection Form */}
                {selectedReturnTx.return_proof_url && (
                  <div className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <img
                      src={selectedReturnTx.return_proof_url}
                      alt="Foto Bukti"
                      onClick={() => setZoomProofUrl(selectedReturnTx.return_proof_url!)}
                      className="w-28 h-20 object-cover rounded-lg border border-slate-200 shadow-sm cursor-zoom-in"
                    />
                    <div className="space-y-1">
                      <p className="font-bold text-slate-800 text-xs flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Foto Bukti Fisik Telah Dilampirkan Peminjam</span>
                      </p>
                      {selectedReturnTx.return_notes && (
                        <p className="text-slate-600 text-[11px]">
                          Catatan: "{selectedReturnTx.return_notes}"
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => setZoomProofUrl(selectedReturnTx.return_proof_url!)}
                        className="text-pigeon-600 font-bold hover:underline text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> Lihat Foto Ukuran Penuh
                      </button>
                    </div>
                  </div>
                )}

                {/* Items */}
                <div>
                  <p className="font-bold text-slate-800 mb-1">Barang Terpinjam:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedReturnTx.items?.map((it) => (
                      <span key={it.id} className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800">
                        {it.item_name} ({it.qty_borrowed} unit)
                      </span>
                    ))}
                  </div>
                </div>

                {/* Time Check & Penalty Preview */}
                {(() => {
                  const reqDate = selectedReturnTx.return_requested_at
                    ? new Date(selectedReturnTx.return_requested_at)
                    : new Date();
                  const isLate = selectedReturnTx.expected_return_date
                    ? reqDate.getTime() > new Date(selectedReturnTx.expected_return_date).getTime()
                    : false;
                  const lateDays = isLate && selectedReturnTx.expected_return_date
                    ? Math.ceil((reqDate.getTime() - new Date(selectedReturnTx.expected_return_date).getTime()) / (1000 * 60 * 60 * 24))
                    : 0;

                  return (
                    <div
                      className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                        isLate ? 'bg-red-50 border-red-200 text-red-950' : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center gap-1.5 text-xs">
                          {isLate ? (
                            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                          <span>
                            {isLate ? `Pemeriksaan Waktu: Terlambat ${lateDays} Hari` : 'Pemeriksaan Waktu: Tepat Waktu'}
                          </span>
                        </span>
                        <span className="text-[10px] font-semibold text-slate-600">
                          Batas: {formatDueDateTime(selectedReturnTx.expected_return_date)}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-700">
                        {isLate ? (
                          <>
                            <span className="font-bold text-red-800">Sanksi Sistem Berdasarkan Aturan: </span>
                            {lateDays <= 1
                              ? 'Terlambat 1 hari: Peringatan (Warning)'
                              : lateDays <= 3
                              ? `Terlambat ${lateDays} hari: Peringatan + Pembatasan Peminjaman Sementara`
                              : `Terlambat ${lateDays} hari: Pembatasan Peminjaman Selama 1 Minggu`}
                          </>
                        ) : (
                          'Pengembalian dilakukan tepat waktu sebelum batas jadwal berakhir. Bebas sanksi keterlambatan.'
                        )}
                      </p>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Kondisi Fisik Barang (Quality Check):</label>
                    <select
                      value={returnedCondition}
                      onChange={(e) => setReturnedCondition(e.target.value as ReturnedCondition)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-pigeon-500"
                    >
                      <option value="Good">Kondisi Baik (Good) — Tanpa Kerusakan</option>
                      <option value="Damaged_Light">Rusak Ringan (Light)</option>
                      <option value="Damaged_Medium">Rusak Sedang (Medium)</option>
                      <option value="Damaged_Heavy">Rusak Berat (Heavy)</option>
                      <option value="Lost">Hilang (Lost)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Status Resolusi:</label>
                    <select
                      value={resolutionStatus}
                      onChange={(e) => setResolutionStatus(e.target.value as ResolutionStatus)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-pigeon-500"
                    >
                      <option value="Resolved">Resolved (Selesai & Barang Masuk Kembali ke Stok)</option>
                      <option value="Not_Resolved">Not Resolved (Membutuhkan Tindak Lanjut Ganti Rugi)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Catatan Khusus / Sanksi (Opsional):</label>
                  <input
                    type="text"
                    placeholder="Contoh: Barang lengkap dan normal / Dikenakan biaya ganti rugi Rp..."
                    value={customPenalty}
                    onChange={(e) => setCustomPenalty(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-pigeon-500"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submittingReturn}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {submittingReturn ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Memproses Pengembalian...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Approve & Selesaikan Pengembalian (Tutup Tiket)</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={submittingReturn}
                    onClick={() => setSelectedReturnTx(null)}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer transition-colors"
                  >
                    Batal
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: MONITORING */}
      {activeTab === 'monitoring' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Pemantauan Sistem Laboratorium</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-bold text-xs mb-2">Stok ICT Lab 1</h4>
                <p className="text-xl font-black text-slate-900">
                  {stats?.stats?.labStats?.find((l: any) => l.location === 'ICT Lab 1')?.total_qty || 0} unit
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Rusak: {stats?.stats?.labStats?.find((l: any) => l.location === 'ICT Lab 1')?.damaged_items || 0} • Menipis: {stats?.stats?.labStats?.find((l: any) => l.location === 'ICT Lab 1')?.low_stock_items || 0}
                </p>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <h4 className="font-bold text-xs mb-2">Stok ICT Lab 2</h4>
                <p className="text-xl font-black text-slate-900">
                  {stats?.stats?.labStats?.find((l: any) => l.location === 'ICT Lab 2')?.total_qty || 0} unit
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Rusak: {stats?.stats?.labStats?.find((l: any) => l.location === 'ICT Lab 2')?.damaged_items || 0} • Menipis: {stats?.stats?.labStats?.find((l: any) => l.location === 'ICT Lab 2')?.low_stock_items || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Active Loans & Pickup Confirmation list */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Daftar Peminjaman Aktif & Siap Ambil</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Tiket ID</th>
                    <th className="p-3">Peminjam</th>
                    <th className="p-3">Barang Terpinjam</th>
                    <th className="p-3">Jadwal Kembali</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeLoans.map((tx) => (
                    <tr key={tx.ticket_id} className="hover:bg-slate-50/80">
                      <td className="p-3 font-mono font-bold text-slate-900">{tx.ticket_id}</td>
                      <td className="p-3">
                        <p className="font-semibold text-slate-900">{tx.user_name}</p>
                        <p className="text-[10px] text-slate-500">{tx.user_email}</p>
                      </td>
                      <td className="p-3">
                        {tx.items?.map((it) => (
                          <span key={it.id} className="inline-block mr-1 text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                            {it.item_name} ({it.qty_borrowed})
                          </span>
                        ))}
                      </td>
                      <td className="p-3">
                        {tx.expected_return_date ? (
                          <span className="text-slate-700">{formatDueDateTime(tx.expected_return_date)}</span>
                        ) : (
                          <span className="text-slate-400">Habis Pakai</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${tx.status === 'Overdue'
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : tx.status === 'Picked_Up'
                              ? 'bg-blue-100 text-blue-800'
                              : tx.status === 'Ready_for_Pickup'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1 whitespace-nowrap">
                        {tx.status !== 'Picked_Up' && (
                          <button
                            disabled={loadingPickupId === tx.ticket_id}
                            onClick={() => handleConfirmPickup(tx.ticket_id)}
                            className="px-2.5 py-1 bg-pigeon-600 hover:bg-pigeon-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            {loadingPickupId === tx.ticket_id && <Loader2 className="w-3 h-3 animate-spin" />}
                            <span>{loadingPickupId === tx.ticket_id ? 'Memproses...' : 'Ambil Barang (Pickup)'}</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedReturnTx(tx);
                            setReturnTicketId(tx.ticket_id);
                            setActiveTab('returns');
                          }}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Kembalikan
                        </button>
                      </td>
                    </tr>
                  ))}
                  {activeLoans.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400 text-xs">
                        Tidak ada peminjaman aktif atau barang yang menunggu diambil saat ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VERIFY RETURN APPROVAL MODAL */}
      {verifyReturnModalTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-slate-900 text-base">{verifyReturnModalTx.ticket_id}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    Menunggu Approval Pengembalian
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium mt-1">
                  Peminjam: <strong className="text-slate-900">{verifyReturnModalTx.user_name}</strong> ({verifyReturnModalTx.user_email})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVerifyReturnModalTx(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Items list */}
            <div>
              <p className="text-xs font-bold text-slate-700 mb-1.5">Barang yang Dikembalikan:</p>
              <div className="flex flex-wrap gap-1.5">
                {verifyReturnModalTx.items?.map((it) => (
                  <span key={it.id} className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800">
                    {it.item_name} ({it.qty_borrowed} unit)
                  </span>
                ))}
              </div>
            </div>

            {/* Return Proof Photo */}
            {verifyReturnModalTx.return_proof_url && (
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex items-center gap-3">
                <img
                  src={verifyReturnModalTx.return_proof_url}
                  alt="Bukti Pengembalian"
                  onClick={() => setZoomProofUrl(verifyReturnModalTx.return_proof_url!)}
                  className="w-24 h-18 object-cover rounded-xl border border-emerald-300 shadow-sm cursor-zoom-in hover:opacity-90 transition-opacity"
                />
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Foto Bukti Serah Terima Dilampirkan
                  </span>
                  {verifyReturnModalTx.return_notes && (
                    <p className="text-slate-600 text-[11px] italic">
                      "{verifyReturnModalTx.return_notes}"
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setZoomProofUrl(verifyReturnModalTx.return_proof_url!)}
                    className="text-pigeon-600 font-bold hover:underline text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3 h-3" /> Perbesar Foto Bukti
                  </button>
                </div>
              </div>
            )}

            {/* Time Check & Penalty Preview */}
            {(() => {
              const reqDate = verifyReturnModalTx.return_requested_at
                ? new Date(verifyReturnModalTx.return_requested_at)
                : new Date();
              const isLate = verifyReturnModalTx.expected_return_date
                ? reqDate.getTime() > new Date(verifyReturnModalTx.expected_return_date).getTime()
                : false;
              const lateDays = isLate && verifyReturnModalTx.expected_return_date
                ? Math.ceil((reqDate.getTime() - new Date(verifyReturnModalTx.expected_return_date).getTime()) / (1000 * 60 * 60 * 24))
                : 0;

              return (
                <div
                  className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                    isLate ? 'bg-red-50 border-red-200 text-red-950' : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5 text-xs">
                      {isLate ? (
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                      <span>
                        {isLate ? `Pemeriksaan Waktu: Terlambat ${lateDays} Hari` : 'Pemeriksaan Waktu: Tepat Waktu'}
                      </span>
                    </span>
                    <span className="text-[10px] font-semibold text-slate-600">
                      Batas: {formatDueDateTime(verifyReturnModalTx.expected_return_date)}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-700">
                    {isLate ? (
                      <>
                        <span className="font-bold text-red-800">Sanksi Sistem Berdasarkan Aturan: </span>
                        {lateDays <= 1
                          ? 'Terlambat 1 hari: Peringatan (Warning)'
                          : lateDays <= 3
                          ? `Terlambat ${lateDays} hari: Peringatan + Pembatasan Peminjaman Sementara`
                          : `Terlambat ${lateDays} hari: Pembatasan Peminjaman Selama 1 Minggu`}
                      </>
                    ) : (
                      'Pengembalian dilakukan tepat waktu sebelum batas jadwal berakhir. Bebas sanksi keterlambatan.'
                    )}
                  </p>
                </div>
              );
            })()}

            {/* Quality Check & Resolution */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Kondisi Fisik Barang:</label>
                <select
                  value={returnedCondition}
                  onChange={(e) => setReturnedCondition(e.target.value as ReturnedCondition)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Good">Kondisi Baik (Good) — Tanpa Cacat</option>
                  <option value="Damaged_Light">Rusak Ringan (Light Damage)</option>
                  <option value="Damaged_Medium">Rusak Sedang (Medium Damage)</option>
                  <option value="Damaged_Heavy">Rusak Berat (Heavy Damage)</option>
                  <option value="Lost">Hilang (Lost)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-800 mb-1">Status Resolusi:</label>
                <select
                  value={resolutionStatus}
                  onChange={(e) => setResolutionStatus(e.target.value as ResolutionStatus)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Resolved">Resolved (Kembali ke Stok Inventaris)</option>
                  <option value="Not_Resolved">Not Resolved (Butuh Tindak Lanjut)</option>
                </select>
              </div>
            </div>

            {/* Custom Penalty Note */}
            <div>
              <label className="block font-bold text-slate-800 mb-1 text-xs">Catatan Tambahan / Sanksi (Opsional):</label>
              <input
                type="text"
                placeholder="Barang diterima lengkap dan berfungsi normal..."
                value={customPenalty}
                onChange={(e) => setCustomPenalty(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={submittingReturn}
                onClick={handleConfirmVerifyReturn}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-colors"
              >
                {submittingReturn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memproses Verifikasi...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Setujui & Selesaikan Pengembalian</span>
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={submittingReturn}
                onClick={() => setVerifyReturnModalTx(null)}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer transition-colors"
              >
                Batal
              </button>
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

      {/* REJECT RETURN PROOF MODAL */}
      {rejectReturnModalTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Tolak Bukti Pengembalian {rejectReturnModalTx.ticket_id}</h3>
            <p className="text-xs text-slate-500">
              Peminjam akan diberitahu alasan penolakan dan diminta mengunggah ulang foto bukti serah terima fisik.
            </p>
            <textarea
              rows={3}
              value={rejectReturnReason}
              onChange={(e) => setRejectReturnReason(e.target.value)}
              placeholder="Contoh: Barang fisik belum ditemukan di meja lab / foto buram tidak terlihat..."
              className="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-red-500"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRejectReturnModalTx(null)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submittingRejectReturn}
                onClick={handleRejectReturn}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm"
              >
                {submittingRejectReturn ? 'Memproses...' : 'Tolak Bukti Pengembalian'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO PROOF ZOOM / LIGHTBOX */}
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
