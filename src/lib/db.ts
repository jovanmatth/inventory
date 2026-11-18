import { DatabaseSync } from 'node:sqlite';
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

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'pigeon.sqlite');

// Global singleton for Next.js dev server persistence
const globalForDb = global as unknown as { dbSyncInstance?: DatabaseSync };

export const db: DatabaseSync =
  globalForDb.dbSyncInstance || new DatabaseSync(dbPath);

if (process.env.NODE_ENV !== 'production') {
  globalForDb.dbSyncInstance = db;
}

// Initialize tables if they don't exist
export function initDatabase() {
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
}

// Auto-run initialization
initDatabase();

// Helper Functions
export const userRepo = {
  getByEmail(email: string): User | undefined {
    const stmt = db.prepare(`SELECT * FROM Users WHERE LOWER(email) = LOWER(?)`);
    return stmt.get(email) as User | undefined;
  },
  getById(id: string): User | undefined {
    const stmt = db.prepare(`SELECT * FROM Users WHERE user_id = ?`);
    return stmt.get(id) as User | undefined;
  },
  getAll(): User[] {
    const stmt = db.prepare(`SELECT * FROM Users ORDER BY name ASC`);
    return stmt.all() as unknown as User[];
  },
  create(user: User): void {
    const stmt = db.prepare(`
      INSERT INTO Users (user_id, name, email, role, penalty_status, restriction_end_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(user.user_id, user.name, user.email, user.role, user.penalty_status, user.restriction_end_date);
  },
  update(user: User): void {
    const stmt = db.prepare(`
      UPDATE Users
      SET name = ?, email = ?, role = ?, penalty_status = ?, restriction_end_date = ?
      WHERE user_id = ?
    `);
    stmt.run(user.name, user.email, user.role, user.penalty_status, user.restriction_end_date, user.user_id);
  },
  delete(id: string): void {
    const stmt = db.prepare(`DELETE FROM Users WHERE user_id = ?`);
    stmt.run(id);
  }
};

export const inventoryRepo = {
  getAll(filter?: { location?: string; status?: string; search?: string }): InventoryItem[] {
    let sql = `SELECT * FROM Inventory WHERE 1=1`;
    const params: unknown[] = [];

    if (filter?.location) {
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
  },
  getById(id: string): InventoryItem | undefined {
    const stmt = db.prepare(`SELECT * FROM Inventory WHERE item_id = ?`);
    return stmt.get(id) as InventoryItem | undefined;
  },
  create(item: InventoryItem): void {
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
  },
  update(item: InventoryItem): void {
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
  },
  delete(id: string): void {
    const stmt = db.prepare(`DELETE FROM Inventory WHERE item_id = ?`);
    stmt.run(id);
  },
  transfer(itemId: string, targetLocation: 'ICT Lab 1' | 'ICT Lab 2', targetDetail: string, transferQty: number, performedBy: string): void {
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
  }
};

export const transactionRepo = {
  getNextTicketId(): string {
    const row = db.prepare(`SELECT ticket_id FROM Borrowing_Transactions ORDER BY ticket_id DESC LIMIT 1`).get() as { ticket_id: string } | undefined;
    if (!row) return 'PGE-0001';
    const match = row.ticket_id.match(/PGE-(\d+)/);
    if (!match) return 'PGE-0001';
    const nextNum = parseInt(match[1], 10) + 1;
    return `PGE-${String(nextNum).padStart(4, '0')}`;
  },
  getAll(filter?: { status?: string; user_id?: string }): BorrowingTransaction[] {
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

    // Attach items
    for (const row of rows) {
      row.items = db.prepare(`
        SELECT ti.*, i.item_name, i.brand, i.location
        FROM Transaction_Items ti
        LEFT JOIN Inventory i ON ti.item_id = i.item_id
        WHERE ti.ticket_id = ?
      `).all(row.ticket_id) as unknown as TransactionItemDetail[];
    }
    return rows;
  },
  getByTicketId(ticketId: string): BorrowingTransaction | undefined {
    const row = db.prepare(`
      SELECT t.*, u.name as user_name, u.email as user_email
      FROM Borrowing_Transactions t
      LEFT JOIN Users u ON t.user_id = u.user_id
      WHERE t.ticket_id = ?
    `).get(ticketId) as BorrowingTransaction | undefined;

    if (row) {
      row.items = db.prepare(`
        SELECT ti.*, i.item_name, i.brand, i.location
        FROM Transaction_Items ti
        LEFT JOIN Inventory i ON ti.item_id = i.item_id
        WHERE ti.ticket_id = ?
      `).all(ticketId) as unknown as TransactionItemDetail[];
    }
    return row;
  },
  create(tx: BorrowingTransaction, items: { item_id: string; qty_borrowed: number; borrowing_type: string }[]): string {
    const ticketId = tx.ticket_id || this.getNextTicketId();
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
    return ticketId;
  },
  updateStatus(ticketId: string, status: string, approvedBy?: string, rejectionReason?: string): void {
    db.prepare(`
      UPDATE Borrowing_Transactions
      SET status = ?, approved_by = COALESCE(?, approved_by), rejection_reason = COALESCE(?, rejection_reason)
      WHERE ticket_id = ?
    `).run(status, approvedBy || null, rejectionReason || null, ticketId);
  }
};

export const returnRepo = {
  create(record: ReturnPenaltyRecord): void {
    db.prepare(`
      INSERT INTO Returns_And_Penalties (
        return_id, ticket_id, return_date, returned_condition,
        is_late, late_days, penalty_type, resolution_status, received_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.return_id, record.ticket_id, record.return_date, record.returned_condition,
      record.is_late, record.late_days, record.penalty_type, record.resolution_status, record.received_by
    );
  },
  getByTicketId(ticketId: string): ReturnPenaltyRecord | undefined {
    return db.prepare(`SELECT * FROM Returns_And_Penalties WHERE ticket_id = ?`).get(ticketId) as ReturnPenaltyRecord | undefined;
  },
  getAll(): ReturnPenaltyRecord[] {
    return db.prepare(`SELECT * FROM Returns_And_Penalties ORDER BY return_date DESC`).all() as unknown as ReturnPenaltyRecord[];
  }
};

export const historyRepo = {
  log(record: TransactionHistoryRecord): void {
    db.prepare(`
      INSERT INTO Transaction_History (log_id, item_id, action_type, qty_changed, timestamp, performed_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      record.log_id, record.item_id, record.action_type,
      record.qty_changed, record.timestamp, record.performed_by
    );
  },
  getAll(limit = 100): TransactionHistoryRecord[] {
    return db.prepare(`
      SELECT th.*, i.item_name, u.name as performer_name
      FROM Transaction_History th
      LEFT JOIN Inventory i ON th.item_id = i.item_id
      LEFT JOIN Users u ON th.performed_by = u.user_id
      ORDER BY th.timestamp DESC
      LIMIT ?
    `).all(limit) as unknown as TransactionHistoryRecord[];
  }
};
