import path from 'node:path';
import fs from 'node:fs';
import {
  User,
  InventoryItem,
  BorrowingTransaction,
  TransactionItemDetail,
  ReturnPenaltyRecord,
  TransactionHistoryRecord,
} from '@/types';

// Global singleton for Next.js dev server persistence
const globalForDb = global as unknown as { dbSyncInstance?: any };

let db: any = globalForDb.dbSyncInstance || null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require('node:sqlite');

  let dbPath = path.join(process.cwd(), 'data', 'pigeon.sqlite');
  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  } catch {
    // Read-only filesystem (e.g. Vercel Serverless) -> fallback to in-memory
    dbPath = ':memory:';
  }

  if (!db) {
    db = new DatabaseSync(dbPath);
    if (process.env.NODE_ENV !== 'production') {
      globalForDb.dbSyncInstance = db;
    }
  }
} catch (err: any) {
  console.warn('SQLite is unavailable or running on cloud environment:', err?.message);
}

export { db };

// Initialize tables if they don't exist
export function initDatabase() {
  if (!db) return;
  try {
    db.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS Users (
        user_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT CHECK(role IN ('Admin', 'Supervisor', 'User')) NOT NULL,
        penalty_status TEXT CHECK(penalty_status IN ('None', 'Warning', 'Restricted_Temp', 'Restricted_1_Week')) DEFAULT 'None',
        restriction_end_date TEXT
      );

      CREATE TABLE IF NOT EXISTS Inventory (
        item_id TEXT PRIMARY KEY,
        item_name TEXT NOT NULL,
        brand TEXT NOT NULL,
        qty INTEGER NOT NULL DEFAULT 0,
        min_qty_alert INTEGER NOT NULL DEFAULT 2,
        location TEXT CHECK(location IN ('ICT Lab 1', 'ICT Lab 2')) NOT NULL,
        location_detail TEXT NOT NULL,
        item_detail TEXT NOT NULL,
        variant TEXT NOT NULL,
        status TEXT CHECK(status IN ('Available', 'Borrowed', 'Damaged', 'Maintenance')) NOT NULL DEFAULT 'Available',
        condition TEXT CHECK(condition IN ('Good', 'Damaged')) NOT NULL DEFAULT 'Good',
        date_added TEXT NOT NULL,
        borrowing_type TEXT CHECK(borrowing_type IN ('Habis Pakai', 'Used', 'Loan')) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS Borrowing_Transactions (
        ticket_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES Users(user_id),
        transaction_type TEXT CHECK(transaction_type IN ('Direct_Borrow', 'Reservation')) NOT NULL,
        purpose TEXT NOT NULL,
        borrow_date TEXT NOT NULL,
        duration TEXT NOT NULL,
        expected_return_date TEXT,
        status TEXT CHECK(status IN (
          'Pending_Approval', 'Approved', 'Rejected', 'In_Queue',
          'Ready_for_Pickup', 'Picked_Up', 'Returned', 'Overdue', 'Issue_Reported'
        )) NOT NULL DEFAULT 'Pending_Approval',
        approved_by TEXT REFERENCES Users(user_id),
        rejection_reason TEXT
      );

      CREATE TABLE IF NOT EXISTS Transaction_Items (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL REFERENCES Borrowing_Transactions(ticket_id) ON DELETE CASCADE,
        item_id TEXT NOT NULL REFERENCES Inventory(item_id),
        qty_borrowed INTEGER NOT NULL DEFAULT 1,
        borrowing_type TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS Returns_And_Penalties (
        return_id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL REFERENCES Borrowing_Transactions(ticket_id),
        return_date TEXT NOT NULL,
        returned_condition TEXT CHECK(returned_condition IN ('Good', 'Damaged_Light', 'Damaged_Medium', 'Damaged_Heavy', 'Lost')) NOT NULL,
        is_late INTEGER NOT NULL DEFAULT 0,
        late_days INTEGER NOT NULL DEFAULT 0,
        penalty_type TEXT NOT NULL,
        resolution_status TEXT CHECK(resolution_status IN ('Resolved', 'Not_Resolved')) NOT NULL DEFAULT 'Resolved',
        received_by TEXT NOT NULL REFERENCES Users(user_id)
      );

      CREATE TABLE IF NOT EXISTS Transaction_History (
        log_id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL REFERENCES Inventory(item_id),
        action_type TEXT CHECK(action_type IN ('Stock_In', 'Stock_Out', 'Returned', 'Transferred', 'Edited', 'Damaged')) NOT NULL,
        qty_changed INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        performed_by TEXT NOT NULL REFERENCES Users(user_id)
      );
    `);
  } catch (e: any) {
    console.warn('initDatabase skipped:', e?.message);
  }
}

// Auto-run initialization
initDatabase();

// Helper Functions with safety checks
export const userRepo = {
  getByEmail(email: string): User | undefined {
    if (!db) return undefined;
    try {
      const stmt = db.prepare(`SELECT * FROM Users WHERE LOWER(email) = LOWER(?)`);
      return stmt.get(email) as User | undefined;
    } catch {
      return undefined;
    }
  },
  getById(id: string): User | undefined {
    if (!db) return undefined;
    try {
      const stmt = db.prepare(`SELECT * FROM Users WHERE user_id = ?`);
      return stmt.get(id) as User | undefined;
    } catch {
      return undefined;
    }
  },
  getAll(): User[] {
    if (!db) return [];
    try {
      const stmt = db.prepare(`SELECT * FROM Users ORDER BY name ASC`);
      return stmt.all() as unknown as User[];
    } catch {
      return [];
    }
  },
  create(user: User): void {
    if (!db) return;
    try {
      const stmt = db.prepare(`
        INSERT INTO Users (user_id, name, email, role, penalty_status, restriction_end_date)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(user.user_id, user.name, user.email, user.role, user.penalty_status, user.restriction_end_date);
    } catch (e) {
      console.warn('SQLite userRepo.create failed:', e);
    }
  },
  update(user: User): void {
    if (!db) return;
    try {
      const stmt = db.prepare(`
        UPDATE Users
        SET name = ?, email = ?, role = ?, penalty_status = ?, restriction_end_date = ?
        WHERE user_id = ?
      `);
      stmt.run(user.name, user.email, user.role, user.penalty_status, user.restriction_end_date, user.user_id);
    } catch (e) {
      console.warn('SQLite userRepo.update failed:', e);
    }
  },
  delete(id: string): void {
    if (!db) return;
    try {
      const stmt = db.prepare(`DELETE FROM Users WHERE user_id = ?`);
      stmt.run(id);
    } catch (e) {
      console.warn('SQLite userRepo.delete failed:', e);
    }
  }
};

export const inventoryRepo = {
  getAll(filter?: { location?: string; status?: string; search?: string }): InventoryItem[] {
    if (!db) return [];
    try {
      let sql = `SELECT * FROM Inventory WHERE 1=1`;
      const params: unknown[] = [];

      if (filter?.location && filter.location !== 'All') {
        sql += ` AND location = ?`;
        params.push(filter.location);
      }
      if (filter?.status) {
        sql += ` AND status = ?`;
        params.push(filter.status);
      }
      if (filter?.search) {
        sql += ` AND (LOWER(item_name) LIKE ? OR LOWER(brand) LIKE ? OR LOWER(item_detail) LIKE ?)`;
        const term = `%${filter.search.toLowerCase()}%`;
        params.push(term, term, term);
      }
      sql += ` ORDER BY location ASC, item_name ASC`;
      const stmt = db.prepare(sql);
      return stmt.all(...(params as [any])) as unknown as InventoryItem[];
    } catch {
      return [];
    }
  },
  getById(id: string): InventoryItem | undefined {
    if (!db) return undefined;
    try {
      const stmt = db.prepare(`SELECT * FROM Inventory WHERE item_id = ?`);
      return stmt.get(id) as InventoryItem | undefined;
    } catch {
      return undefined;
    }
  },
  create(item: InventoryItem): void {
    if (!db) return;
    try {
      const stmt = db.prepare(`
        INSERT INTO Inventory (
          item_id, item_name, brand, qty, min_qty_alert, location, location_detail,
          item_detail, variant, status, condition, date_added, borrowing_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        item.item_id, item.item_name, item.brand, item.qty, item.min_qty_alert,
        item.location, item.location_detail, item.item_detail, item.variant,
        item.status, item.condition, item.date_added, item.borrowing_type
      );
    } catch (e) {
      console.warn('SQLite inventoryRepo.create failed:', e);
    }
  },
  update(item: InventoryItem): void {
    if (!db) return;
    try {
      const stmt = db.prepare(`
        UPDATE Inventory
        SET item_name = ?, brand = ?, qty = ?, min_qty_alert = ?, location = ?,
            location_detail = ?, item_detail = ?, variant = ?, status = ?,
            condition = ?, date_added = ?, borrowing_type = ?
        WHERE item_id = ?
      `);
      stmt.run(
        item.item_name, item.brand, item.qty, item.min_qty_alert, item.location,
        item.location_detail, item.item_detail, item.variant, item.status,
        item.condition, item.date_added, item.borrowing_type, item.item_id
      );
    } catch (e) {
      console.warn('SQLite inventoryRepo.update failed:', e);
    }
  },
  delete(id: string): void {
    if (!db) return;
    try {
      db.prepare(`DELETE FROM Transaction_Items WHERE item_id = ?`).run(id);
      db.prepare(`DELETE FROM Transaction_History WHERE item_id = ?`).run(id);
      const stmt = db.prepare(`DELETE FROM Inventory WHERE item_id = ?`);
      stmt.run(id);
    } catch (e) {
      console.warn('SQLite inventoryRepo.delete failed:', e);
    }
  },
  transfer(itemId: string, targetLocation: 'ICT Lab 1' | 'ICT Lab 2', targetDetail: string, transferQty: number, performedBy: string): void {
    if (!db) return;
    try {
      const source = this.getById(itemId);
      if (!source || source.qty < transferQty) {
        throw new Error('Stok barang asal tidak mencukupi');
      }

      // Decrease source
      db.prepare(`UPDATE Inventory SET qty = qty - ? WHERE item_id = ?`).run(transferQty, itemId);

      // Check if item with same name, brand, variant exists in target lab
      const targetExisting = db.prepare(`
        SELECT * FROM Inventory
        WHERE item_name = ? AND brand = ? AND variant = ? AND location = ?
      `).get(source.item_name, source.brand, source.variant, targetLocation) as InventoryItem | undefined;

      let targetItemId = targetExisting?.item_id;

      if (targetExisting) {
        db.prepare(`UPDATE Inventory SET qty = qty + ? WHERE item_id = ?`).run(transferQty, targetExisting.item_id);
      } else {
        targetItemId = `ITM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        this.create({
          ...source,
          item_id: targetItemId,
          location: targetLocation,
          location_detail: targetDetail || source.location_detail,
          qty: transferQty,
          date_added: new Date().toISOString().split('T')[0],
        });
      }

      // Record History Log
      historyRepo.log({
        log_id: `LOG-${Date.now()}-1`,
        item_id: itemId,
        action_type: 'Transferred',
        qty_changed: -transferQty,
        timestamp: new Date().toISOString(),
        performed_by: performedBy,
      });
      if (targetItemId) {
        historyRepo.log({
          log_id: `LOG-${Date.now()}-2`,
          item_id: targetItemId,
          action_type: 'Transferred',
          qty_changed: transferQty,
          timestamp: new Date().toISOString(),
          performed_by: performedBy,
        });
      }
    } catch (e) {
      console.warn('SQLite inventory transfer error:', e);
    }
  }
};

function parseReturnMetadata(rejectionReason: string | null | undefined) {
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

function syncStatusesSqlite() {
  if (!db) return;
  const nowIso = new Date().toISOString();

  // 1. Auto-transition to Overdue when expected_return_date has passed
  try {
    db.prepare(`
      UPDATE Borrowing_Transactions
      SET status = 'Overdue'
      WHERE expected_return_date IS NOT NULL
        AND expected_return_date <= ?
        AND status IN ('Picked_Up', 'Approved', 'Ready_for_Pickup')
    `).run(nowIso);
  } catch {}

  // 2. Auto-transition to Picked_Up when borrow_date (waktu ambil) has arrived
  try {
    const rows = db.prepare(`
      SELECT ticket_id, user_id
      FROM Borrowing_Transactions
      WHERE status IN ('Approved', 'Ready_for_Pickup')
        AND borrow_date <= ?
        AND expected_return_date > ?
    `).all(nowIso, nowIso) as { ticket_id: string; user_id: string }[];

    for (const row of rows) {
      const items = db.prepare(`
        SELECT item_id, qty_borrowed
        FROM Transaction_Items
        WHERE ticket_id = ?
      `).all(row.ticket_id) as { item_id: string; qty_borrowed: number }[];

      for (const it of items) {
        const item = db.prepare(`SELECT * FROM Inventory WHERE item_id = ?`).get(it.item_id) as any;
        if (item) {
          const newQty = Math.max(0, item.qty - it.qty_borrowed);
          db.prepare(`
            UPDATE Inventory
            SET qty = ?, status = ?
            WHERE item_id = ?
          `).run(newQty, newQty === 0 ? 'Borrowed' : item.status, it.item_id);

          db.prepare(`
            INSERT INTO Inventory_History (log_id, item_id, action_type, qty_changed, timestamp, performed_by)
            VALUES (?, ?, 'Stock_Out', ?, ?, ?)
          `).run(`LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`, it.item_id, -it.qty_borrowed, nowIso, row.user_id);
        }
      }

      db.prepare(`UPDATE Borrowing_Transactions SET status = 'Picked_Up' WHERE ticket_id = ?`).run(row.ticket_id);
    }
  } catch {}
}

export const transactionRepo = {
  getNextTicketId(): string {
    if (!db) return 'PGE-0001';
    try {
      const row = db.prepare(`SELECT ticket_id FROM Borrowing_Transactions ORDER BY ticket_id DESC LIMIT 1`).get() as { ticket_id: string } | undefined;
      if (!row) return 'PGE-0001';
      const match = row.ticket_id.match(/PGE-(\d+)/);
      if (!match) return 'PGE-0001';
      const nextNum = parseInt(match[1], 10) + 1;
      return `PGE-${String(nextNum).padStart(4, '0')}`;
    } catch {
      return 'PGE-0001';
    }
  },
  getAll(filter?: { status?: string; user_id?: string }): BorrowingTransaction[] {
    if (!db) return [];
    try {
      syncStatusesSqlite();

      let sql = `
        SELECT t.*, u.name as user_name, u.email as user_email
        FROM Borrowing_Transactions t
        LEFT JOIN Users u ON t.user_id = u.user_id
        WHERE 1=1
      `;
      const params: unknown[] = [];
      if (filter?.status) {
        sql += ` AND t.status = ?`;
        params.push(filter.status);
      }
      if (filter?.user_id) {
        sql += ` AND t.user_id = ?`;
        params.push(filter.user_id);
      }
      sql += ` ORDER BY t.borrow_date DESC`;
      const rows = db.prepare(sql).all(...(params as [any])) as unknown as BorrowingTransaction[];

      for (const row of rows) {
        Object.assign(row, parseReturnMetadata(row.rejection_reason));
        row.items = db.prepare(`
          SELECT ti.*, i.item_name, i.brand, i.location
          FROM Transaction_Items ti
          LEFT JOIN Inventory i ON ti.item_id = i.item_id
          WHERE ti.ticket_id = ?
        `).all(row.ticket_id) as unknown as TransactionItemDetail[];
      }
      return rows;
    } catch {
      return [];
    }
  },
  getByTicketId(ticketId: string): BorrowingTransaction | undefined {
    if (!db) return undefined;
    try {
      syncStatusesSqlite();

      const row = db.prepare(`
        SELECT t.*, u.name as user_name, u.email as user_email
        FROM Borrowing_Transactions t
        LEFT JOIN Users u ON t.user_id = u.user_id
        WHERE t.ticket_id = ?
      `).get(ticketId) as BorrowingTransaction | undefined;

      if (row) {
        Object.assign(row, parseReturnMetadata(row.rejection_reason));
        row.items = db.prepare(`
          SELECT ti.*, i.item_name, i.brand, i.location
          FROM Transaction_Items ti
          LEFT JOIN Inventory i ON ti.item_id = i.item_id
          WHERE ti.ticket_id = ?
        `).all(ticketId) as unknown as TransactionItemDetail[];
      }
      return row;
    } catch {
      return undefined;
    }
  },
  create(tx: BorrowingTransaction, items: { item_id: string; qty_borrowed: number; borrowing_type: string }[]): string {
    const ticketId = tx.ticket_id || this.getNextTicketId();
    if (!db) return ticketId;
    try {
      db.prepare(`
        INSERT INTO Borrowing_Transactions (
          ticket_id, user_id, transaction_type, purpose, borrow_date,
          duration, expected_return_date, status, approved_by, rejection_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ticketId, tx.user_id, tx.transaction_type, tx.purpose, tx.borrow_date,
        tx.duration, tx.expected_return_date, tx.status, tx.approved_by, tx.rejection_reason
      );

      const itemStmt = db.prepare(`
        INSERT INTO Transaction_Items (id, ticket_id, item_id, qty_borrowed, borrowing_type)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const item of items) {
        const id = `TI-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        itemStmt.run(id, ticketId, item.item_id, item.qty_borrowed, item.borrowing_type);
      }
    } catch (e) {
      console.warn('SQLite transactionRepo.create failed:', e);
    }
    return ticketId;
  },
  updateStatus(ticketId: string, status: string, approvedBy?: string, rejectionReason?: string): void {
    if (!db) return;
    try {
      db.prepare(`
        UPDATE Borrowing_Transactions
        SET status = ?, approved_by = COALESCE(?, approved_by), rejection_reason = COALESCE(?, rejection_reason)
        WHERE ticket_id = ?
      `).run(status, approvedBy || null, rejectionReason || null, ticketId);
    } catch (e) {
      console.warn('SQLite transactionRepo.updateStatus failed:', e);
    }
  },
  delete(ticketId: string): void {
    if (!db) return;
    try {
      db.prepare(`DELETE FROM Transaction_Items WHERE ticket_id = ?`).run(ticketId);
      db.prepare(`DELETE FROM Returns_And_Penalties WHERE ticket_id = ?`).run(ticketId);
      db.prepare(`DELETE FROM Borrowing_Transactions WHERE ticket_id = ?`).run(ticketId);
    } catch (e) {
      console.warn('SQLite transactionRepo.delete failed:', e);
    }
  }
};

export const returnRepo = {
  create(record: ReturnPenaltyRecord): void {
    if (!db) return;
    try {
      db.prepare(`
        INSERT INTO Returns_And_Penalties (
          return_id, ticket_id, return_date, returned_condition,
          is_late, late_days, penalty_type, resolution_status, received_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        record.return_id, record.ticket_id, record.return_date, record.returned_condition,
        record.is_late, record.late_days, record.penalty_type, record.resolution_status, record.received_by
      );
    } catch (e) {
      console.warn('SQLite returnRepo.create failed:', e);
    }
  },
  getByTicketId(ticketId: string): ReturnPenaltyRecord | undefined {
    if (!db) return undefined;
    try {
      return db.prepare(`SELECT * FROM Returns_And_Penalties WHERE ticket_id = ?`).get(ticketId) as ReturnPenaltyRecord | undefined;
    } catch {
      return undefined;
    }
  },
  getAll(): ReturnPenaltyRecord[] {
    if (!db) return [];
    try {
      return db.prepare(`SELECT * FROM Returns_And_Penalties ORDER BY return_date DESC`).all() as unknown as ReturnPenaltyRecord[];
    } catch {
      return [];
    }
  }
};

export const historyRepo = {
  log(record: TransactionHistoryRecord): void {
    if (!db) return;
    try {
      db.prepare(`
        INSERT INTO Transaction_History (log_id, item_id, action_type, qty_changed, timestamp, performed_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        record.log_id, record.item_id, record.action_type,
        record.qty_changed, record.timestamp, record.performed_by
      );
    } catch (e) {
      console.warn('SQLite historyRepo.log failed:', e);
    }
  },
  getAll(limit = 100): TransactionHistoryRecord[] {
    if (!db) return [];
    try {
      return db.prepare(`
        SELECT th.*, i.item_name, u.name as performer_name
        FROM Transaction_History th
        LEFT JOIN Inventory i ON th.item_id = i.item_id
        LEFT JOIN Users u ON th.performed_by = u.user_id
        ORDER BY th.timestamp DESC
        LIMIT ?
      `).all(limit) as unknown as TransactionHistoryRecord[];
    } catch {
      return [];
    }
  }
};
