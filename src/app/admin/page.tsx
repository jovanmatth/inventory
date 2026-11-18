'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { useRealtimeSync, broadcastDataChange } from '@/lib/useRealtimeSync';
import {
  Boxes,
  Users as UsersIcon,
  Layers,
  Activity,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowRightLeft,
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  Check,
  Shield,
  FileText,
  AlertOctagon,
  RefreshCw,
} from 'lucide-react';
import {
  User,
  InventoryItem,
  BorrowingTransaction,
  LabLocation,
  BorrowingType,
  ReturnedCondition,
  ResolutionStatus,
} from '@/types';

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Data states
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<BorrowingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modals & Action States
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetItem, setTransferTargetItem] = useState<InventoryItem | null>(null);
  const [transferQty, setTransferQty] = useState(1);
  const [transferLocation, setTransferLocation] = useState<LabLocation>('ICT Lab 2');
  const [transferDetail, setTransferDetail] = useState('');

  // Approval state
  const [rejectModalTx, setRejectModalTx] = useState<BorrowingTransaction | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Return & Penalty modal
  const [returnTicketId, setReturnTicketId] = useState('');
  const [selectedReturnTx, setSelectedReturnTx] = useState<BorrowingTransaction | null>(null);
  const [returnedCondition, setReturnedCondition] = useState<ReturnedCondition>('Good');
  const [customPenalty, setCustomPenalty] = useState('');
  const [resolutionStatus, setResolutionStatus] = useState<ResolutionStatus>('Resolved');

  // Search & Filters
  const [userSearch, setUserSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [itemLocationFilter, setItemLocationFilter] = useState('All');

  // Message alert
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) setActiveTab(tabParam);
  }, [searchParams]);

  // Load all data with silent real-time background sync
  const loadAdminData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const [monData, usrData, invData, txData] = await Promise.all([
        fetch('/api/monitoring').then((r) => r.json()),
        fetch('/api/users').then((r) => r.json()),
        fetch('/api/inventory').then((r) => r.json()),
        fetch('/api/transactions').then((r) => r.json()),
      ]);
      if (monData?.success) setStats(monData);
      if (usrData?.success) setUsers(usrData.users || []);
      if (invData?.success) setInventory(invData.items || []);
      if (txData?.success) setTransactions(txData.transactions || []);
    } catch (err) {
      console.error('Admin sync error:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData(false);
  }, [refreshTrigger]);

  useRealtimeSync({
    onRefresh: () => loadAdminData(true),
    pollIntervalMs: 3500,
  });

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  // User Actions
  const handleSaveUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      role: formData.get('role') as string,
      penalty_status: formData.get('penalty_status') as string,
    };

    const isEdit = Boolean(editingUser);
    const url = '/api/users';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { ...payload, user_id: editingUser?.user_id } : payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      showNotification(data.message || (isEdit ? 'User Data Updated' : 'User Added Successfully'));
      setShowAddUserModal(false);
      setEditingUser(null);
      setRefreshTrigger((v) => v + 1);
      broadcastDataChange();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const res = await fetch(`/api/users?id=${userToDelete.user_id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      showNotification('User Deleted Successfully');
      setUserToDelete(null);
      setRefreshTrigger((v) => v + 1);
      broadcastDataChange();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  // Inventory Item Actions
  const handleSaveItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      item_name: formData.get('item_name') as string,
      brand: formData.get('brand') as string,
      qty: Number(formData.get('qty')),
      min_qty_alert: Number(formData.get('min_qty_alert')),
      location: formData.get('location') as LabLocation,
      location_detail: formData.get('location_detail') as string,
      item_detail: formData.get('item_detail') as string,
      variant: formData.get('variant') as string,
      status: formData.get('status') as string,
      condition: formData.get('condition') as string,
      date_added: formData.get('date_added') as string || new Date().toISOString().split('T')[0],
      borrowing_type: formData.get('borrowing_type') as BorrowingType,
      performed_by: 'USR-001',
    };

    const isEdit = Boolean(editingItem);
    const url = '/api/inventory';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isEdit ? { ...payload, item_id: editingItem?.item_id } : payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      showNotification(data.message || (isEdit ? 'Item Updated Successfully' : 'Item Added Successfully'));
      setShowAddItemModal(false);
      setEditingItem(null);
      setRefreshTrigger((v) => v + 1);
      broadcastDataChange();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      const res = await fetch(`/api/inventory?id=${itemToDelete.item_id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      showNotification('Barang berhasil dihapus');
      setItemToDelete(null);
      setRefreshTrigger((v) => v + 1);
      broadcastDataChange();
    } catch (err: any) {
      showNotification(err.message, 'error');
      setItemToDelete(null);
    }
  };

  // Inventory Transfer
  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTargetItem) return;

    try {
      const res = await fetch('/api/inventory/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: transferTargetItem.item_id,
          target_location: transferLocation,
          target_detail: transferDetail,
          transfer_qty: transferQty,
          performed_by: 'USR-001',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      showNotification(data.message);
      setShowTransferModal(false);
      setTransferTargetItem(null);
      setRefreshTrigger((v) => v + 1);
      broadcastDataChange();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  // Approval actions
  const handleApprove = async (ticketId: string) => {
    try {
      const res = await fetch(`/api/transactions/${ticketId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', approved_by: 'USR-001' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      showNotification(data.message);
      setRefreshTrigger((v) => v + 1);
      broadcastDataChange();
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
          approved_by: 'USR-001',
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

  // Confirm Pickup
  const handleConfirmPickup = async (ticketId: string) => {
    try {
      const res = await fetch(`/api/transactions/${ticketId}/pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ performed_by: 'USR-001' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      showNotification(data.message);
      setRefreshTrigger((v) => v + 1);
      broadcastDataChange();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  // Submit Return & Quality Check
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
          received_by: 'USR-001',
          custom_penalty_note: customPenalty,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message);

      showNotification(data.message);
      setSelectedReturnTx(null);
      setReturnTicketId('');
      setRefreshTrigger((v) => v + 1);
      broadcastDataChange();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  // Filtered lists
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.role.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredItems = inventory.filter((item) => {
    const matchSearch =
      item.item_name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      item.brand.toLowerCase().includes(itemSearch.toLowerCase()) ||
      item.location_detail.toLowerCase().includes(itemSearch.toLowerCase());
    const matchLoc = itemLocationFilter === 'All' || item.location === itemLocationFilter;
    return matchSearch && matchLoc;
  });

  const pendingRequests = transactions.filter((t) => t.status === 'Pending_Approval' || t.status === 'In_Queue');
  const activeLoans = transactions.filter((t) => t.status === 'Picked_Up' || t.status === 'Approved' || t.status === 'Ready_for_Pickup');

  return (
    <AppShell activeMenu={
      activeTab === 'users' ? 'Kelola Pengguna & Whitelist' :
      activeTab === 'inventory' ? 'Manajemen Inventaris & Transfer' :
      activeTab === 'approvals' ? 'Persetujuan Peminjaman' :
      activeTab === 'returns' ? 'Pemeriksaan Kembali & Sanksi' :
      activeTab === 'monitoring' ? 'Sistem Pemantauan (Monitoring)' :
      'Overview Dashboard'
    }>
      {/* Toast Alert */}
      {alertMsg && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-in fade-in slide-in-from-top-4 flex items-center gap-2 ${
            alertMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          {alertMsg.type === 'success' ? <Check className="w-4 h-4 text-emerald-600" /> : <AlertOctagon className="w-4 h-4 text-red-600" />}
          <span>{alertMsg.text}</span>
        </div>
      )}

      {/* Header with Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Admin ICT Control Center</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
              Role: Admin
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Pengelolaan menyeluruh inventaris Lab 1 & 2, Whitelist pengguna, alur persetujuan tiket, dan sanksi.
          </p>
        </div>

        <button
          onClick={() => setRefreshTrigger((v) => v + 1)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2 mb-6 border-b border-slate-200">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'users', label: 'Kelola Pengguna', icon: UsersIcon, count: users.length },
          { id: 'inventory', label: 'Inventaris & Transfer', icon: Boxes, count: inventory.length },
          { id: 'approvals', label: 'Persetujuan Tiket', icon: CheckCircle2, count: pendingRequests.length, highlight: pendingRequests.length > 0 },
          { id: 'returns', label: 'Pengembalian & Sanksi', icon: RotateCcw, count: activeLoans.length },
          { id: 'monitoring', label: 'Monitoring Sistem', icon: Layers },
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
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Stok ICT Lab 1</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">
                  {stats?.stats?.labStats?.find((l: any) => l.location === 'ICT Lab 1')?.total_qty || 0}{' '}
                  <span className="text-xs font-normal text-slate-500">unit</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  {stats?.stats?.labStats?.find((l: any) => l.location === 'ICT Lab 1')?.total_items || 0} jenis barang
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-pigeon-100 text-pigeon-700 flex items-center justify-center font-bold">
                L1
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Stok ICT Lab 2</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">
                  {stats?.stats?.labStats?.find((l: any) => l.location === 'ICT Lab 2')?.total_qty || 0}{' '}
                  <span className="text-xs font-normal text-slate-500">unit</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  {stats?.stats?.labStats?.find((l: any) => l.location === 'ICT Lab 2')?.total_items || 0} jenis barang
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                L2
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Menunggu Persetujuan</p>
                <h3 className="text-2xl font-black text-amber-600 mt-1">
                  {stats?.stats?.pendingApprovalsCount || 0}{' '}
                  <span className="text-xs font-normal text-slate-500">tiket</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">Perlu tinjauan Admin/Supervisor</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Peringatan Stok Rendah</p>
                <h3 className="text-2xl font-black text-red-600 mt-1">
                  {stats?.stats?.lowStockAlerts?.length || 0}{' '}
                  <span className="text-xs font-normal text-slate-500">item</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">Mencapai batas minimum</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Quick Action Alerts */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Pending Requests quick table */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Permintaan Peminjaman Terbaru</span>
                </h3>
                <button
                  onClick={() => setActiveTab('approvals')}
                  className="text-xs text-pigeon-600 hover:text-pigeon-700 font-semibold"
                >
                  Lihat Semua ({pendingRequests.length})
                </button>
              </div>

              {pendingRequests.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">Tidak ada permohonan yang menunggu persetujuan.</p>
              ) : (
                <div className="space-y-2.5">
                  {pendingRequests.slice(0, 3).map((tx) => (
                    <div
                      key={tx.ticket_id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{tx.ticket_id}</span>
                          <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded font-medium text-[10px]">
                            {tx.transaction_type}
                          </span>
                        </div>
                        <p className="text-slate-600 mt-0.5">{tx.user_name} • <span className="italic">{tx.purpose}</span></p>
                      </div>
                      <button
                        onClick={() => setActiveTab('approvals')}
                        className="px-2.5 py-1 bg-pigeon-600 hover:bg-pigeon-700 text-white rounded-lg text-xs font-semibold"
                      >
                        Tinjau
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Low stock alerts */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>Barang Perlu Restock Segera</span>
                </h3>
                <button
                  onClick={() => setActiveTab('inventory')}
                  className="text-xs text-pigeon-600 hover:text-pigeon-700 font-semibold"
                >
                  Buka Inventaris
                </button>
              </div>

              {(!stats?.stats?.lowStockAlerts || stats.stats.lowStockAlerts.length === 0) ? (
                <p className="text-xs text-emerald-600 py-6 text-center font-medium">Semua stok barang berada dalam batas aman.</p>
              ) : (
                <div className="space-y-2.5">
                  {stats.stats.lowStockAlerts.slice(0, 3).map((it: any) => (
                    <div
                      key={it.item_id}
                      className="p-3 bg-red-50/50 rounded-xl border border-red-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{it.item_name}</p>
                        <p className="text-[11px] text-slate-500">{it.location} • {it.location_detail}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-red-600 text-sm">{it.qty}</span>
                        <span className="text-[10px] text-slate-500"> / min {it.min_qty_alert}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MANAGE USERS & WHITELIST */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Kelola Pengguna & Whitelist</h2>
              <p className="text-xs text-slate-500">
                Pintu gerbang Gate Check 2. Hanya akun yang terdaftar di sini yang diizinkan mengakses PIGEON.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingUser(null);
                setShowAddUserModal(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 bg-pigeon-600 hover:bg-pigeon-700 text-white font-semibold text-xs rounded-xl shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah User ke Whitelist</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari berdasarkan nama, email (@mutiarabangsa.sch.id), atau role..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-pigeon-500"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Nama</th>
                  <th className="p-3">Email (@mutiarabangsa.sch.id)</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status Sanksi</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => (
                  <tr key={u.user_id} className="hover:bg-slate-50/80">
                    <td className="p-3 font-semibold text-slate-900">{u.name}</td>
                    <td className="p-3 font-mono text-slate-600">{u.email}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded font-medium text-[10px] uppercase ${
                          u.role === 'Admin'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : u.role === 'Supervisor'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3">
                      {u.penalty_status === 'None' ? (
                        <span className="text-slate-400">Normal</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800 border border-red-200">
                          {u.penalty_status}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button
                        onClick={() => {
                          setEditingUser(u);
                          setShowAddUserModal(true);
                        }}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                        title="Edit User"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setUserToDelete(u)}
                        className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
                        title="Delete User"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: INVENTORY MANAGEMENT & TRANSFER */}
      {activeTab === 'inventory' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Manajemen Inventaris & Transfer Barang</h2>
              <p className="text-xs text-slate-500">
                Pencatatan barang ICT Lab 1 & 2, penyesuaian stok, serta fitur mutasi transfer antar laboratorium.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEditingItem(null);
                  setShowAddItemModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-pigeon-600 hover:bg-pigeon-700 text-white font-semibold text-xs rounded-xl shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Barang</span>
              </button>
            </div>
          </div>

          {/* Search & Location Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8 relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari barang, brand, model, atau lokasi rak..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-pigeon-500"
              />
            </div>
            <div className="sm:col-span-4 flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={itemLocationFilter}
                onChange={(e) => setItemLocationFilter(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-pigeon-500"
              >
                <option value="All">Semua Lokasi Lab</option>
                <option value="ICT Lab 1">ICT Lab 1</option>
                <option value="ICT Lab 2">ICT Lab 2</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Nama Barang</th>
                  <th className="p-3">Brand / Model</th>
                  <th className="p-3">Lokasi Lab & Rak</th>
                  <th className="p-3">Stok Saat Ini</th>
                  <th className="p-3">Tipe Peminjaman</th>
                  <th className="p-3">Kondisi</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.item_id} className="hover:bg-slate-50/80">
                    <td className="p-3">
                      <p className="font-semibold text-slate-900">{item.item_name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{item.variant}</p>
                    </td>
                    <td className="p-3">
                      <p className="font-medium text-slate-800">{item.brand}</p>
                      <p className="text-[10px] text-slate-400">{item.item_detail}</p>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-slate-800">{item.location}</span>
                      <p className="text-[10px] text-slate-500">{item.location_detail}</p>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-bold ${
                            item.qty <= item.min_qty_alert ? 'text-red-600' : 'text-slate-800'
                          }`}
                        >
                          {item.qty}
                        </span>
                        {item.qty <= item.min_qty_alert && (
                          <span className="text-[9px] bg-red-100 text-red-700 px-1 py-0.2 rounded font-semibold">
                            Low Stock
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          item.borrowing_type === 'Loan'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : item.borrowing_type === 'Habis Pakai'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {item.borrowing_type}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          item.condition === 'Good'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.condition}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1 whitespace-nowrap">
                      {/* Transfer button */}
                      <button
                        onClick={() => {
                          setTransferTargetItem(item);
                          setTransferLocation(item.location === 'ICT Lab 1' ? 'ICT Lab 2' : 'ICT Lab 1');
                          setTransferQty(1);
                          setTransferDetail(item.location_detail);
                          setShowTransferModal(true);
                        }}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium inline-flex items-center gap-1"
                        title="Mutasi Transfer Lab"
                      >
                        <ArrowRightLeft className="w-3 h-3 text-pigeon-600" />
                        <span>Transfer</span>
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setShowAddItemModal(true);
                        }}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                        title="Edit Item"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setItemToDelete(item)}
                        className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
                        title="Delete Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: APPROVAL SYSTEM */}
      {activeTab === 'approvals' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Persetujuan Tiket Peminjaman & Reservasi</h2>
            <p className="text-xs text-slate-500">
              Verifikasi permohonan peminjaman langsung (Direct Borrow) dan reservasi terjadwal dari Guru & Siswa.
            </p>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500/50 mb-2" />
              <p className="text-sm font-semibold text-slate-700">Semua permohonan telah diproses</p>
              <p className="text-xs text-slate-400">Tidak ada tiket peminjaman atau reservasi dalam antrean saat ini.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((tx) => (
                <div
                  key={tx.ticket_id}
                  className="p-4 bg-slate-50/70 border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-sm">{tx.ticket_id}</span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold text-[10px]">
                        {tx.transaction_type}
                      </span>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold text-[10px]">
                        Status: {tx.status}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-slate-800">
                      Peminjam: <span className="text-pigeon-700">{tx.user_name}</span> ({tx.user_email})
                    </p>

                    <p className="text-xs text-slate-600">
                      <span className="font-medium">Tujuan:</span> {tx.purpose}
                    </p>

                    <div className="text-[11px] text-slate-500 flex flex-wrap gap-4 pt-1">
                      <span>Waktu Pinjam: {new Date(tx.borrow_date).toLocaleString('id-ID')}</span>
                      <span>Durasi: {tx.duration}</span>
                      {tx.expected_return_date && (
                        <span className="text-red-600 font-medium">
                          Batas Kembali: {new Date(tx.expected_return_date).toLocaleDateString('id-ID')}
                        </span>
                      )}
                    </div>

                    {/* Items Requested */}
                    <div className="pt-2">
                      <p className="text-[11px] font-bold text-slate-700 mb-1">Daftar Barang yang Diajukan:</p>
                      <div className="flex flex-wrap gap-2">
                        {tx.items?.map((it) => (
                          <div
                            key={it.id}
                            className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                          >
                            <span>{it.item_name}</span>
                            <span className="text-slate-400 font-normal"> ({it.qty_borrowed} unit • {it.borrowing_type})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex md:flex-col gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(tx.ticket_id)}
                      className="flex-1 md:flex-none px-4 py-2 bg-pigeon-600 hover:bg-pigeon-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Setujui (Approve)</span>
                    </button>

                    <button
                      onClick={() => {
                        setRejectModalTx(tx);
                        setRejectionReason('');
                      }}
                      className="flex-1 md:flex-none px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Tolak (Reject)</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: RETURN & PENALTY MANAGEMENT */}
      {activeTab === 'returns' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-base font-bold text-slate-900 mb-1">Verifikasi Pengembalian & Perhitungan Sanksi</h2>
            <p className="text-xs text-slate-500 mb-4">
              Lakukan Quality & Time Check pada barang yang dikembalikan. Sistem secara otomatis menghitung tingkat keterlambatan dan sanksi yang berlaku.
            </p>

            {/* Quick Ticket Input or Selection */}
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Masukkan Ticket ID (Contoh: PGE-0001)..."
                value={returnTicketId}
                onChange={(e) => {
                  setReturnTicketId(e.target.value.toUpperCase());
                  const found = transactions.find((t) => t.ticket_id === e.target.value.toUpperCase());
                  if (found) setSelectedReturnTx(found);
                }}
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-pigeon-500 uppercase"
              />
              <button
                onClick={() => {
                  const found = transactions.find((t) => t.ticket_id === returnTicketId);
                  if (found) {
                    setSelectedReturnTx(found);
                  } else {
                    showNotification('Tiket tidak ditemukan dalam data transaksi', 'error');
                  }
                }}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm"
              >
                Cari Tiket
              </button>
            </div>

            {/* If a ticket is selected, display Quality & Time check form */}
            {selectedReturnTx && (
              <form onSubmit={handleSubmitReturn} className="mt-6 p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div>
                    <span className="font-mono font-bold text-slate-900 text-sm">{selectedReturnTx.ticket_id}</span>
                    <p className="text-xs text-slate-600">Peminjam: {selectedReturnTx.user_name} ({selectedReturnTx.user_email})</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">
                    Status: {selectedReturnTx.status}
                  </span>
                </div>

                {/* Items in ticket */}
                <div>
                  <p className="text-xs font-bold text-slate-700 mb-1">Barang Terpinjam:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedReturnTx.items?.map((it) => (
                      <span key={it.id} className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800">
                        {it.item_name} ({it.qty_borrowed} unit • {it.borrowing_type})
                      </span>
                    ))}
                  </div>
                </div>

                {/* Quality & Condition Check */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Kondisi Fisik Barang (Quality Check):
                    </label>
                    <select
                      value={returnedCondition}
                      onChange={(e) => setReturnedCondition(e.target.value as ReturnedCondition)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-pigeon-500"
                    >
                      <option value="Good">Kondisi Baik (Good) — Tidak Ada Kerusakan</option>
                      <option value="Damaged_Light">Rusak Ringan (Light) — Masih Dapat Berfungsi</option>
                      <option value="Damaged_Medium">Rusak Sedang (Medium) — Membutuhkan Servis</option>
                      <option value="Damaged_Heavy">Rusak Berat (Heavy) — Rusak Total / Tak Berfungsi</option>
                      <option value="Lost">Hilang (Lost) — Barang Tidak Ditemukan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Status Penyelesaian Masalah:
                    </label>
                    <select
                      value={resolutionStatus}
                      onChange={(e) => setResolutionStatus(e.target.value as ResolutionStatus)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-pigeon-500"
                    >
                      <option value="Resolved">Resolved (Selesai — Sanksi Diselesaikan / Kondisi Baik)</option>
                      <option value="Not_Resolved">Not Resolved (Belum Selesai — Butuh Tindak Lanjut)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Catatan Khusus Sanksi / Perjanjian:
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Menanggung biaya perbaikan Rp 150.000 / Mengganti kabel HDMI baru..."
                    value={customPenalty}
                    onChange={(e) => setCustomPenalty(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-pigeon-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedReturnTx(null)}
                    className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-pigeon-600 hover:bg-pigeon-700 text-white text-xs font-bold rounded-xl shadow-sm"
                  >
                    Konfirmasi Pengembalian & Simpan Sanksi
                  </button>
                </div>
              </form>
            )}
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
                          <span className="text-slate-700">{new Date(tx.expected_return_date).toLocaleDateString('id-ID')}</span>
                        ) : (
                          <span className="text-slate-400">Habis Pakai</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            tx.status === 'Picked_Up'
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
                            onClick={() => handleConfirmPickup(tx.ticket_id)}
                            className="px-2.5 py-1 bg-pigeon-600 hover:bg-pigeon-700 text-white rounded-lg text-xs font-semibold"
                          >
                            Ambil Barang (Pickup)
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedReturnTx(tx);
                            setReturnTicketId(tx.ticket_id);
                          }}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
                        >
                          Kembalikan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: MONITORING SYSTEM */}
      {activeTab === 'monitoring' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Overdue Items list */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-red-600" />
                <span>Monitoring Tiket Terlambat (Overdue)</span>
              </h3>

              {(!stats?.stats?.overdueTransactions || stats.stats.overdueTransactions.length === 0) ? (
                <p className="text-xs text-slate-400 py-8 text-center">Tidak ada peminjaman yang melewati batas waktu.</p>
              ) : (
                <div className="space-y-2">
                  {stats.stats.overdueTransactions.map((tx: any) => (
                    <div key={tx.ticket_id} className="p-3 bg-red-50/60 border border-red-200 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono font-bold text-red-900">{tx.ticket_id}</span>
                        <p className="text-slate-800 font-semibold">{tx.user_name} ({tx.user_email})</p>
                        <p className="text-[10px] text-red-700">
                          Batas: {new Date(tx.expected_return_date).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setActiveTab('returns');
                          setReturnTicketId(tx.ticket_id);
                          const found = transactions.find((t) => t.ticket_id === tx.ticket_id);
                          if (found) setSelectedReturnTx(found);
                        }}
                        className="px-2.5 py-1 bg-red-600 text-white font-semibold rounded-lg text-xs"
                      >
                        Beri Sanksi
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Damaged or Maintenance Items */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-amber-600" />
                <span>Barang Rusak & Dalam Perbaikan (Maintenance)</span>
              </h3>

              {(!stats?.stats?.damagedItems || stats.stats.damagedItems.length === 0) ? (
                <p className="text-xs text-slate-400 py-8 text-center">Semua barang berada dalam kondisi operasional baik.</p>
              ) : (
                <div className="space-y-2">
                  {stats.stats.damagedItems.map((it: any) => (
                    <div key={it.item_id} className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{it.item_name} ({it.brand})</p>
                        <p className="text-[11px] text-slate-600">{it.location} • {it.location_detail}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                        {it.condition === 'Damaged' ? 'Rusak' : it.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Audit Log / Transaction History */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-600" />
              <span>Log Riwayat Audit Sistem (Transaction History)</span>
            </h3>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Waktu (Timestamp)</th>
                    <th className="p-3">Aksi</th>
                    <th className="p-3">Nama Barang</th>
                    <th className="p-3">Perubahan Stok</th>
                    <th className="p-3">Pelaksana</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats?.recentHistory?.map((log: any) => (
                    <tr key={log.log_id} className="hover:bg-slate-50/80">
                      <td className="p-3 font-mono text-slate-500">
                        {new Date(log.timestamp).toLocaleString('id-ID')}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            log.action_type === 'Transferred'
                              ? 'bg-purple-100 text-purple-800'
                              : log.action_type === 'Stock_In'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.action_type === 'Stock_Out'
                              ? 'bg-blue-100 text-blue-800'
                              : log.action_type === 'Damaged'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {log.action_type}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-900">{log.item_name || log.item_id}</td>
                      <td className="p-3 font-bold font-mono">
                        <span className={log.qty_changed >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                          {log.qty_changed >= 0 ? `+${log.qty_changed}` : log.qty_changed}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">{log.performer_name || log.performed_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT USER */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="font-bold text-base text-slate-900 mb-1">
              {editingUser ? 'Edit User Whitelist' : 'Tambah User ke Whitelist'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Pengguna hanya dapat login apabila email berakhiran @mutiarabangsa.sch.id.
            </p>

            <form onSubmit={handleSaveUser} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap:</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingUser?.name || ''}
                  required
                  placeholder="Contoh: Sarah Wijaya"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-pigeon-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email (@mutiarabangsa.sch.id):</label>
                <input
                  type="email"
                  name="email"
                  defaultValue={editingUser?.email || ''}
                  required
                  placeholder="nama@mutiarabangsa.sch.id"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-pigeon-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role Akses:</label>
                <select
                  name="role"
                  defaultValue={editingUser?.role || 'User'}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-pigeon-500"
                >
                  <option value="Admin">Admin (Akses Penuh & Transfer)</option>
                  <option value="Supervisor">Supervisor (Approval & Monitoring)</option>
                  <option value="User">User (Guru, Siswa, Staff)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status Sanksi:</label>
                <select
                  name="penalty_status"
                  defaultValue={editingUser?.penalty_status || 'None'}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-pigeon-500"
                >
                  <option value="None">None (Normal)</option>
                  <option value="Warning">Warning (Peringatan)</option>
                  <option value="Restricted_Temp">Restricted_Temp (Pembatasan Sementara)</option>
                  <option value="Restricted_1_Week">Restricted_1_Week (Pembatasan 1 Minggu)</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-pigeon-600 hover:bg-pigeon-700 text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  Simpan User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE USER CONFIRMATION */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Konfirmasi Hapus User?</h3>
            <p className="text-xs text-slate-500 mb-6">
              Apakah Anda yakin ingin menghapus <span className="font-semibold text-slate-800">{userToDelete.name}</span> dari daftar Whitelist? Pengguna tidak akan dapat login kembali.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setUserToDelete(null)}
                className="py-2.5 px-4 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
              >
                Batal (NO)
              </button>
              <button
                onClick={handleDeleteUser}
                className="py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl shadow-sm"
              >
                Hapus (YES)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE INVENTORY ITEM CONFIRMATION */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Konfirmasi Hapus Barang?</h3>
            <p className="text-xs text-slate-500 mb-6">
              Apakah Anda yakin ingin menghapus barang <span className="font-semibold text-slate-800">{itemToDelete.item_name}</span> ({itemToDelete.brand} - {itemToDelete.location})? Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setItemToDelete(null)}
                className="py-2.5 px-4 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-200 transition-colors"
              >
                Batal (NO)
              </button>
              <button
                onClick={handleDeleteItem}
                className="py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors"
              >
                Hapus (YES)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT INVENTORY ITEM */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8">
            <h3 className="font-bold text-base text-slate-900 mb-1">
              {editingItem ? 'Edit Data Barang' : 'Tambah Barang Baru'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Lengkapi seluruh atribut inventaris barang untuk ICT Lab 1 atau Lab 2.
            </p>

            <form onSubmit={handleSaveItem} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Barang:</label>
                  <input
                    type="text"
                    name="item_name"
                    defaultValue={editingItem?.item_name || ''}
                    required
                    placeholder="Contoh: Laptop Lenovo ThinkPad"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-pigeon-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Brand / Merek:</label>
                  <input
                    type="text"
                    name="brand"
                    defaultValue={editingItem?.brand || ''}
                    required
                    placeholder="Contoh: Lenovo / Epson"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-pigeon-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Stok Qty:</label>
                  <input
                    type="number"
                    name="qty"
                    defaultValue={editingItem?.qty || 1}
                    min="0"
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-pigeon-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Min Qty Alert:</label>
                  <input
                    type="number"
                    name="min_qty_alert"
                    defaultValue={editingItem?.min_qty_alert || 2}
                    min="1"
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-pigeon-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tipe Peminjaman:</label>
                  <select
                    name="borrowing_type"
                    defaultValue={editingItem?.borrowing_type || 'Loan'}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-pigeon-500"
                  >
                    <option value="Loan">Loan (Pinjam)</option>
                    <option value="Habis Pakai">Habis Pakai</option>
                    <option value="Used">Used</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lokasi Laboratorium:</label>
                  <select
                    name="location"
                    defaultValue={editingItem?.location || 'ICT Lab 1'}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-pigeon-500"
                  >
                    <option value="ICT Lab 1">ICT Lab 1</option>
                    <option value="ICT Lab 2">ICT Lab 2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Lokasi Detail (Rak/Lemari):</label>
                  <input
                    type="text"
                    name="location_detail"
                    defaultValue={editingItem?.location_detail || ''}
                    placeholder="Contoh: Lemari A - Rak 2"
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-pigeon-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Detail / Serial Number:</label>
                  <input
                    type="text"
                    name="item_detail"
                    defaultValue={editingItem?.item_detail || ''}
                    placeholder="Contoh: SN: 2026-LN-991"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-pigeon-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Varian (Warna/Spesifikasi):</label>
                  <input
                    type="text"
                    name="variant"
                    defaultValue={editingItem?.variant || ''}
                    placeholder="Contoh: Black / Core i5"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-pigeon-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kondisi Fisik:</label>
                  <select
                    name="condition"
                    defaultValue={editingItem?.condition || 'Good'}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-pigeon-500"
                  >
                    <option value="Good">Good (Baik)</option>
                    <option value="Damaged">Damaged (Rusak)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status Ketersediaan:</label>
                  <select
                    name="status"
                    defaultValue={editingItem?.status || 'Available'}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-pigeon-500"
                  >
                    <option value="Available">Available (Tersedia)</option>
                    <option value="Borrowed">Borrowed (Dipinjam)</option>
                    <option value="Damaged">Damaged (Rusak)</option>
                    <option value="Maintenance">Maintenance (Servis)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-pigeon-600 hover:bg-pigeon-700 text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  Simpan Barang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INVENTORY TRANSFER */}
      {showTransferModal && transferTargetItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-pigeon-100 text-pigeon-700 flex items-center justify-center">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Transfer Antar Laboratorium</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Pindahkan stok dari <span className="font-semibold text-slate-800">{transferTargetItem.location}</span> ke laboratorium tujuan.
            </p>

            <form onSubmit={handleExecuteTransfer} className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <p className="font-bold text-slate-900">{transferTargetItem.item_name}</p>
                <p className="text-slate-500">Stok Tersedia Saat Ini: <span className="font-bold text-pigeon-700">{transferTargetItem.qty} unit</span></p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Jumlah yang Ditransfer (Qty):</label>
                <input
                  type="number"
                  min="1"
                  max={transferTargetItem.qty}
                  value={transferQty}
                  onChange={(e) => setTransferQty(Number(e.target.value))}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-pigeon-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Laboratorium Tujuan:</label>
                <select
                  value={transferLocation}
                  onChange={(e) => setTransferLocation(e.target.value as LabLocation)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-pigeon-500"
                >
                  <option value="ICT Lab 1">ICT Lab 1</option>
                  <option value="ICT Lab 2">ICT Lab 2</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Lokasi Detail di Lab Tujuan (Rak/Laci):</label>
                <input
                  type="text"
                  placeholder="Contoh: Rak B - Bagian Atas"
                  value={transferDetail}
                  onChange={(e) => setTransferDetail(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-pigeon-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-pigeon-600 hover:bg-pigeon-700 text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  Konfirmasi Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REJECT REASON */}
      {rejectModalTx && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-left">
            <h3 className="font-bold text-slate-900 text-base mb-1">Tolak Permohonan Tiket?</h3>
            <p className="text-xs text-slate-500 mb-4">
              Tiket <span className="font-mono font-bold text-slate-800">{rejectModalTx.ticket_id}</span> oleh {rejectModalTx.user_name}. Sertakan alasan penolakan.
            </p>

            <textarea
              placeholder="Contoh: Barang sedang dialokasikan untuk ujian sekolah / Jadwal bertabrakan..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              required
              rows={3}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-red-500 mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectModalTx(null)}
                className="py-2 px-4 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl"
              >
                Batal
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim()}
                className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl shadow-sm disabled:opacity-50"
              >
                Kirim Penolakan
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function AdminDashboard() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center text-xs text-slate-500">Memuat Admin...</div>}>
      <AdminDashboardContent />
    </React.Suspense>
  );
}
