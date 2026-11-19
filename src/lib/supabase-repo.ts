import { supabaseAdmin, isSupabaseConfigured } from './supabase';
import {
  User,
  InventoryItem,
  BorrowingTransaction,
  TransactionItemDetail,
  ReturnPenaltyRecord,
  TransactionHistoryRecord,
} from '@/types';
import {
  userRepo as sqliteUserRepo,
  inventoryRepo as sqliteInventoryRepo,
  transactionRepo as sqliteTransactionRepo,
  returnRepo as sqliteReturnRepo,
  historyRepo as sqliteHistoryRepo,
} from './db';

// ==========================================
// HYBRID REPOSITORY: SUPABASE + SQLITE FALLBACK
// ==========================================

export const hybridUserRepo = {
  async getByEmail(email: string): Promise<User | undefined> {
    if (isSupabaseConfigured() && supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .ilike('email', email)
        .maybeSingle();
      if (!error && data) return data as User;
    }
    return sqliteUserRepo.getByEmail(email);
  },

  async getById(id: string): Promise<User | undefined> {
    if (isSupabaseConfigured() && supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('user_id', id)
        .maybeSingle();
      if (!error && data) return data as User;
    }
    return sqliteUserRepo.getById(id);
  },

  async getAll(): Promise<User[]> {
    if (isSupabaseConfigured() && supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .order('name', { ascending: true });
      if (!error && data) return data as User[];
    }
    return sqliteUserRepo.getAll();
  },

  async create(user: User): Promise<void> {
    if (isSupabaseConfigured() && supabaseAdmin) {
      await supabaseAdmin.from('users').insert({
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        penalty_status: user.penalty_status,
        restriction_end_date: user.restriction_end_date,
      });
    }
    sqliteUserRepo.create(user);
  },

  async update(user: User): Promise<void> {
    if (isSupabaseConfigured() && supabaseAdmin) {
      await supabaseAdmin
        .from('users')
        .update({
          name: user.name,
          email: user.email,
          role: user.role,
          penalty_status: user.penalty_status,
          restriction_end_date: user.restriction_end_date,
        })
        .eq('user_id', user.user_id);
    }
    sqliteUserRepo.update(user);
  },

  async delete(id: string): Promise<void> {
    if (isSupabaseConfigured() && supabaseAdmin) {
      await supabaseAdmin.from('users').delete().eq('user_id', id);
    }
    sqliteUserRepo.delete(id);
  },
};

export const hybridInventoryRepo = {
  async getAll(filter?: { location?: string; status?: string; search?: string }): Promise<InventoryItem[]> {
    if (isSupabaseConfigured() && supabaseAdmin) {
      let query = supabaseAdmin.from('inventory').select('*');
      if (filter?.location && filter.location !== 'All') {
        query = query.eq('location', filter.location);
      }
      if (filter?.status) {
        query = query.eq('status', filter.status);
      }
      if (filter?.search) {
        query = query.or(`item_name.ilike.%${filter.search}%,brand.ilike.%${filter.search}%`);
      }
      const { data, error } = await query.order('location', { ascending: true }).order('item_name', { ascending: true });
      if (!error && data) return data as InventoryItem[];
    }
    return sqliteInventoryRepo.getAll(filter);
  },

  async getById(id: string): Promise<InventoryItem | undefined> {
    if (isSupabaseConfigured() && supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('inventory')
        .select('*')
        .eq('item_id', id)
        .maybeSingle();
      if (!error && data) return data as InventoryItem;
    }
    return sqliteInventoryRepo.getById(id);
  },

  async create(item: InventoryItem): Promise<void> {
    if (isSupabaseConfigured() && supabaseAdmin) {
      await supabaseAdmin.from('inventory').insert(item);
    }
    sqliteInventoryRepo.create(item);
  },

  async update(item: InventoryItem): Promise<void> {
    if (isSupabaseConfigured() && supabaseAdmin) {
      await supabaseAdmin.from('inventory').update(item).eq('item_id', item.item_id);
    }
    sqliteInventoryRepo.update(item);
  },

  async delete(id: string): Promise<void> {
    if (isSupabaseConfigured() && supabaseAdmin) {
      // 1. Check if item has active transactions that cannot be deleted
      const { data: activeTx } = await supabaseAdmin
        .from('transaction_items')
        .select('ticket_id, borrowing_transactions!inner(status)')
        .eq('item_id', id);

      const hasActive = activeTx?.some((t: any) =>
        ['Pending_Approval', 'Approved', 'In_Queue', 'Ready_for_Pickup', 'Picked_Up', 'Overdue'].includes(
          t.borrowing_transactions?.status
        )
      );

      if (hasActive) {
        throw new Error('Barang tidak dapat dihapus karena masih terkait peminjaman aktif atau antrean reservasi.');
      }

      // 2. Cascade delete historical references in transaction_items and transaction_history
      await supabaseAdmin.from('transaction_items').delete().eq('item_id', id);
      await supabaseAdmin.from('transaction_history').delete().eq('item_id', id);

      // 3. Delete from inventory
      const { error } = await supabaseAdmin.from('inventory').delete().eq('item_id', id);
      if (error) {
        throw new Error(`Gagal menghapus dari database: ${error.message}`);
      }
    }
    sqliteInventoryRepo.delete(id);
  },

  async transfer(
    itemId: string,
    targetLocation: 'ICT Lab 1' | 'ICT Lab 2',
    targetDetail: string,
    transferQty: number,
    performedBy: string
  ): Promise<void> {
    if (isSupabaseConfigured() && supabaseAdmin) {
      const source = await this.getById(itemId);
      if (!source || source.qty < transferQty) {
        throw new Error('Stok barang asal tidak mencukupi');
      }

      // Deduct from source in Supabase
      await supabaseAdmin
        .from('inventory')
        .update({ qty: source.qty - transferQty })
        .eq('item_id', itemId);

      // Check target in Supabase
      const { data: targetExisting } = await supabaseAdmin
        .from('inventory')
        .select('*')
        .eq('item_name', source.item_name)
        .eq('brand', source.brand)
        .eq('variant', source.variant)
        .eq('location', targetLocation)
        .maybeSingle();

      let targetItemId = targetExisting?.item_id;
      if (targetExisting) {
        await supabaseAdmin
          .from('inventory')
          .update({ qty: targetExisting.qty + transferQty })
          .eq('item_id', targetExisting.item_id);
      } else {
        targetItemId = `ITM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await supabaseAdmin.from('inventory').insert({
          ...source,
          item_id: targetItemId,
          location: targetLocation,
          location_detail: targetDetail || source.location_detail,
          qty: transferQty,
          date_added: new Date().toISOString().split('T')[0],
        });
      }

      await hybridHistoryRepo.log({
        log_id: `LOG-${Date.now()}-1`,
        item_id: itemId,
        action_type: 'Transferred',
        qty_changed: -transferQty,
        timestamp: new Date().toISOString(),
        performed_by: performedBy,
      });

      if (targetItemId) {
        await hybridHistoryRepo.log({
          log_id: `LOG-${Date.now()}-2`,
          item_id: targetItemId,
          action_type: 'Transferred',
          qty_changed: transferQty,
          timestamp: new Date().toISOString(),
          performed_by: performedBy,
        });
      }
    }

    // Always keep SQLite synchronized
    try {
      sqliteInventoryRepo.transfer(itemId, targetLocation, targetDetail, transferQty, performedBy);
    } catch (e) {
      // If sqlite already synchronized or failed
    }
  },
};

export function parseReturnMetadata(rejectionReason: string | null | undefined) {
  let return_proof_url: string | null = null;
  let return_notes: string | null = null;
  let return_requested_at: string | null = null;
  let is_return_pending = false;
  let return_rejection_note: string | null = null;
  let returned_at: string | null = null;
  let received_by: string | null = null;
  let returned_condition: any = null;
  let resolution_status: any = null;
  let penalty: string | null = null;

  if (rejectionReason && typeof rejectionReason === 'string' && rejectionReason.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rejectionReason);
      if (parsed.type === 'RETURN_PENDING') {
        return_proof_url = parsed.proof_url || null;
        return_notes = parsed.notes || null;
        return_requested_at = parsed.requested_at || null;
        is_return_pending = true;
      } else if (parsed.type === 'RETURN_REJECTED') {
        return_rejection_note = parsed.reason || null;
      } else if (parsed.type === 'RETURNED') {
        return_proof_url = parsed.proof_url || null;
        return_notes = parsed.notes || null;
        returned_at = parsed.returned_at || null;
        received_by = parsed.received_by || null;
        returned_condition = parsed.returned_condition || null;
        resolution_status = parsed.resolution_status || null;
        penalty = parsed.penalty || null;
      }
    } catch (e) {}
  }
  return {
    return_proof_url,
    return_notes,
    return_requested_at,
    is_return_pending,
    return_rejection_note,
    returned_at,
    received_by,
    returned_condition,
    resolution_status,
    penalty,
  };
}

export const hybridTransactionRepo = {
  async getNextTicketId(): Promise<string> {
    if (isSupabaseConfigured() && supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from('borrowing_transactions')
        .select('ticket_id')
        .order('ticket_id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.ticket_id) {
        const match = data.ticket_id.match(/PGE-(\d+)/);
        if (match) {
          const nextNum = parseInt(match[1], 10) + 1;
          return `PGE-${String(nextNum).padStart(4, '0')}`;
        }
      }
    }
    return sqliteTransactionRepo.getNextTicketId();
  },

  async getAll(filter?: { status?: string; user_id?: string }): Promise<BorrowingTransaction[]> {
    if (isSupabaseConfigured() && supabaseAdmin) {
      // Auto-update active overdue transactions whose expected_return_date has passed
      const nowIso = new Date().toISOString();
      try {
        await supabaseAdmin
          .from('borrowing_transactions')
          .update({ status: 'Overdue' })
          .not('expected_return_date', 'is', null)
          .lt('expected_return_date', nowIso)
          .neq('status', 'Returned')
          .neq('status', 'Rejected')
          .neq('status', 'Overdue');
      } catch (err) {
        console.warn('Auto overdue check error:', err);
      }

      let query = supabaseAdmin
        .from('borrowing_transactions')
        .select(`
          *,
          users:user_id(name, email),
          transaction_items(
            id, ticket_id, item_id, qty_borrowed, borrowing_type,
            inventory:item_id(item_name, brand, location)
          )
        `);

      if (filter?.status) {
        query = query.eq('status', filter.status);
      }
      if (filter?.user_id) {
        query = query.eq('user_id', filter.user_id);
      }

      const { data, error } = await query.order('borrow_date', { ascending: false });
      if (!error && data) {
        return data.map((t: any) => {
          const retMeta = parseReturnMetadata(t.rejection_reason);
          return {
            ticket_id: t.ticket_id,
            user_id: t.user_id,
            transaction_type: t.transaction_type,
            purpose: t.purpose,
            borrow_date: t.borrow_date,
            duration: t.duration,
            expected_return_date: t.expected_return_date,
            status: t.status,
            approved_by: t.approved_by,
            rejection_reason: t.rejection_reason,
            ...retMeta,
            user_name: t.users?.name,
            user_email: t.users?.email,
            items: t.transaction_items?.map((ti: any) => ({
              id: ti.id,
              ticket_id: ti.ticket_id,
              item_id: ti.item_id,
              qty_borrowed: ti.qty_borrowed,
              borrowing_type: ti.borrowing_type,
              item_name: ti.inventory?.item_name,
              brand: ti.inventory?.brand,
              location: ti.inventory?.location,
            })),
          };
        }) as BorrowingTransaction[];
      }
    }
    return sqliteTransactionRepo.getAll(filter);
  },

  async getByTicketId(ticketId: string): Promise<BorrowingTransaction | undefined> {
    if (isSupabaseConfigured() && supabaseAdmin) {
      // Auto-update ticket if overdue
      const nowIso = new Date().toISOString();
      try {
        await supabaseAdmin
          .from('borrowing_transactions')
          .update({ status: 'Overdue' })
          .eq('ticket_id', ticketId)
          .not('expected_return_date', 'is', null)
          .lt('expected_return_date', nowIso)
          .neq('status', 'Returned')
          .neq('status', 'Rejected')
          .neq('status', 'Overdue');
      } catch (err) {
        console.warn('Auto overdue check single error:', err);
      }

      const { data, error } = await supabaseAdmin
        .from('borrowing_transactions')
        .select(`
          *,
          users:user_id(name, email),
          transaction_items(
            id, ticket_id, item_id, qty_borrowed, borrowing_type,
            inventory:item_id(item_name, brand, location)
          )
        `)
        .eq('ticket_id', ticketId)
        .maybeSingle();

      if (!error && data) {
        const retMeta = parseReturnMetadata(data.rejection_reason);
        return {
          ticket_id: data.ticket_id,
          user_id: data.user_id,
          transaction_type: data.transaction_type,
          purpose: data.purpose,
          borrow_date: data.borrow_date,
          duration: data.duration,
          expected_return_date: data.expected_return_date,
          status: data.status,
          approved_by: data.approved_by,
          rejection_reason: data.rejection_reason,
          ...retMeta,
          user_name: data.users?.name,
          user_email: data.users?.email,
          items: data.transaction_items?.map((ti: any) => ({
            id: ti.id,
            ticket_id: ti.ticket_id,
            item_id: ti.item_id,
            qty_borrowed: ti.qty_borrowed,
            borrowing_type: ti.borrowing_type,
            item_name: ti.inventory?.item_name,
            brand: ti.inventory?.brand,
            location: ti.inventory?.location,
          })),
        } as BorrowingTransaction;
      }
    }
    return sqliteTransactionRepo.getByTicketId(ticketId);
  },

  async create(tx: BorrowingTransaction, items: { item_id: string; qty_borrowed: number; borrowing_type: string }[]): Promise<string> {
    const ticketId = tx.ticket_id || (await this.getNextTicketId());

    if (isSupabaseConfigured() && supabaseAdmin) {
      await supabaseAdmin.from('borrowing_transactions').insert({
        ticket_id: ticketId,
        user_id: tx.user_id,
        transaction_type: tx.transaction_type,
        purpose: tx.purpose,
        borrow_date: tx.borrow_date,
        duration: tx.duration,
        expected_return_date: tx.expected_return_date,
        status: tx.status,
        approved_by: tx.approved_by,
        rejection_reason: tx.rejection_reason,
      });

      const txItems = items.map((it) => ({
        id: `TI-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        ticket_id: ticketId,
        item_id: it.item_id,
        qty_borrowed: it.qty_borrowed,
        borrowing_type: it.borrowing_type,
      }));
      await supabaseAdmin.from('transaction_items').insert(txItems);
    }

    try {
      sqliteTransactionRepo.create({ ...tx, ticket_id: ticketId }, items);
    } catch (e) {}

    return ticketId;
  },

  async updateStatus(ticketId: string, status: string, approvedBy?: string, rejectionReason?: string | null): Promise<void> {
    if (isSupabaseConfigured() && supabaseAdmin) {
      const updateData: any = { status };
      if (approvedBy !== undefined) updateData.approved_by = approvedBy;
      if (rejectionReason !== undefined) updateData.rejection_reason = rejectionReason;
      await supabaseAdmin.from('borrowing_transactions').update(updateData).eq('ticket_id', ticketId);
    }
    sqliteTransactionRepo.updateStatus(ticketId, status, approvedBy, rejectionReason || undefined);
  },

  async delete(ticketId: string): Promise<void> {
    if (isSupabaseConfigured() && supabaseAdmin) {
      // Check if ticket status is Picked_Up
      const { data: tx } = await supabaseAdmin
        .from('borrowing_transactions')
        .select('status')
        .eq('ticket_id', ticketId)
        .maybeSingle();

      if (tx?.status === 'Picked_Up') {
        throw new Error('Tiket tidak dapat dihapus karena barang fisik sudah diambil (Picked_Up). Silakan selesaikan proses pengembalian.');
      }

      await supabaseAdmin.from('returns_and_penalties').delete().eq('ticket_id', ticketId);
      await supabaseAdmin.from('transaction_items').delete().eq('ticket_id', ticketId);
      const { error } = await supabaseAdmin.from('borrowing_transactions').delete().eq('ticket_id', ticketId);
      if (error) {
        throw new Error(`Gagal menghapus tiket dari database: ${error.message}`);
      }
    }
    sqliteTransactionRepo.delete(ticketId);
  },
};

export const hybridReturnRepo = {
  async create(record: ReturnPenaltyRecord): Promise<void> {
    if (isSupabaseConfigured() && supabaseAdmin) {
      const { error } = await supabaseAdmin.from('returns_and_penalties').insert(record);
      if (error) {
        console.warn('Supabase returns_and_penalties insert warning:', error.message);
      }
    }
    sqliteReturnRepo.create(record);
  },
};

export const hybridHistoryRepo = {
  async log(record: TransactionHistoryRecord): Promise<void> {
    if (isSupabaseConfigured() && supabaseAdmin) {
      await supabaseAdmin.from('transaction_history').insert(record);
    }
    sqliteHistoryRepo.log(record);
  },

  async getAll(limit = 100): Promise<TransactionHistoryRecord[]> {
    if (isSupabaseConfigured() && supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('transaction_history')
        .select(`*, inventory(item_name), users(name)`)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (!error && data) {
        return data.map((d: any) => ({
          log_id: d.log_id,
          item_id: d.item_id,
          action_type: d.action_type,
          qty_changed: d.qty_changed,
          timestamp: d.timestamp,
          performed_by: d.performed_by,
          item_name: d.inventory?.item_name,
          performer_name: d.users?.name,
        })) as TransactionHistoryRecord[];
      }
    }
    return sqliteHistoryRepo.getAll(limit);
  },
};
