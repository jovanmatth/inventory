import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'pigeon.sqlite');
console.log(`Connecting to SQLite at: ${dbPath}`);
const db = new DatabaseSync(dbPath);

// Execute schema creation
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

console.log('Tables initialized. Seeding initial data...');

// Clean existing data for clean seed
db.exec(`
  DELETE FROM Transaction_History;
  DELETE FROM Returns_And_Penalties;
  DELETE FROM Transaction_Items;
  DELETE FROM Borrowing_Transactions;
  DELETE FROM Inventory;
  DELETE FROM Users;
`);

// 1. Seed Whitelisted Users
const insertUser = db.prepare(`
  INSERT INTO Users (user_id, name, email, role, penalty_status, restriction_end_date)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const users = [
  ['USR-001', 'Budi Santoso (Admin ICT)', 'admin.ict@mutiarabangsa.sch.id', 'Admin', 'None', null],
  ['USR-002', 'Dr. Hendra Gunawan (Lab Head)', 'supervisor.ict@mutiarabangsa.sch.id', 'Supervisor', 'None', null],
  ['USR-003', 'Sarah Wijaya (Teacher - CS)', 'sarah.wijaya@mutiarabangsa.sch.id', 'User', 'None', null],
  ['USR-004', 'Ahmad Fauzi (Teacher - Multimedia)', 'ahmad.fauzi@mutiarabangsa.sch.id', 'User', 'None', null],
  ['USR-005', 'Kevin Pratama (Student - RPL)', 'kevin.pratama@mutiarabangsa.sch.id', 'User', 'None', null],
  ['USR-006', 'Amanda Putri (Student - MM)', 'amanda.putri@mutiarabangsa.sch.id', 'User', 'Warning', null],
  ['USR-007', 'Deni Setiawan (Restricted)', 'deni.restricted@mutiarabangsa.sch.id', 'User', 'Restricted_1_Week', '2026-11-25T23:59:59Z'],
];

for (const u of users) {
  insertUser.run(...u);
}
console.log(`Seeded ${users.length} whitelisted users.`);

// 2. Seed Inventory (ICT Lab 1 & ICT Lab 2)
const insertItem = db.prepare(`
  INSERT INTO Inventory (
    item_id, item_name, brand, qty, min_qty_alert, location, location_detail,
    item_detail, variant, status, condition, date_added, borrowing_type
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const items = [
  // ICT Lab 1
  ['ITM-001', 'Laptop Lenovo ThinkPad E14', 'Lenovo', 15, 3, 'ICT Lab 1', 'Lemari A - Rak 1', 'TP-E14-G4 / SN: 2026-LN-001', 'Black / Core i5 / 16GB', 'Available', 'Good', '2026-01-10', 'Loan'],
  ['ITM-002', 'Kabel HDMI to HDMI 2M', 'Vention', 20, 5, 'ICT Lab 1', 'Laci C - No 2', 'VNT-HD2M-4K', 'Black braided 2M', 'Available', 'Good', '2026-02-15', 'Loan'],
  ['ITM-003', 'Konektor RJ45 Cat6 (Pack 50)', 'Belden', 8, 2, 'ICT Lab 1', 'Rak Komponen B3', 'BLD-RJ45-C6-GOLD', 'Transparent Gold Plated', 'Available', 'Good', '2026-03-01', 'Habis Pakai'],
  ['ITM-004', 'Kabel UTP Cat6 (Meteran)', 'Belden', 60, 15, 'ICT Lab 1', 'Roll Drum B4', 'BLD-UTP-CAT6-GREY', 'Grey UTP / Per Meter', 'Available', 'Good', '2026-03-01', 'Habis Pakai'],
  ['ITM-005', 'Proyektor Epson EB-X500', 'Epson', 4, 1, 'ICT Lab 1', 'Lemari Audio-Visual', 'EB-X500-3600LM / SN: EP-9921', 'White 3600 Lumens', 'Available', 'Good', '2026-01-20', 'Loan'],
  ['ITM-006', 'Kabel Power CPU (Used)', 'Generic', 12, 3, 'ICT Lab 1', 'Kotak Kabel Sekunder', 'CAB-PWR-US-15M', 'Black 1.5 Meter', 'Available', 'Good', '2026-02-05', 'Used'],
  ['ITM-007', 'Switch Hub 16 Port Gigabit', 'TP-Link', 2, 1, 'ICT Lab 1', 'Rak Server ICT 1', 'TL-SG1016D Rackmount', 'Metal Case Black', 'Available', 'Good', '2026-01-15', 'Loan'],

  // ICT Lab 2
  ['ITM-008', 'Drawing Tablet Wacom One', 'Wacom', 10, 2, 'ICT Lab 2', 'Lemari Multimedia M1', 'DTC-133W0C / SN: WAC-8812', '13.3 Inch Full HD', 'Available', 'Good', '2026-02-10', 'Loan'],
  ['ITM-009', 'Kamera DSLR Canon EOS 3000D', 'Canon', 3, 1, 'ICT Lab 2', 'Dry Box Lemari M2', 'EOS-3000D + Kit 18-55mm', 'Black Kit', 'Available', 'Good', '2026-01-25', 'Loan'],
  ['ITM-010', 'Baterai AA Alkaline (Pack 4)', 'Energizer', 14, 4, 'ICT Lab 2', 'Laci Alat Media L1', 'ENERG-AA-MAX', 'AA 1.5V Pack 4', 'Available', 'Good', '2026-03-10', 'Habis Pakai'],
  ['ITM-011', 'Microphone Wireless Blink 500', 'Saramonic', 2, 1, 'ICT Lab 2', 'Lemari Audio A2', 'BLINK-B2-TX+RX / Dual Kit', 'Black 2.4GHz Kit', 'Available', 'Good', '2026-02-20', 'Loan'],
  ['ITM-012', 'Tripod Kamera Takara ECO-196A', 'Takara', 5, 2, 'ICT Lab 2', 'Rak Sudut Studio', 'TAK-ECO196A + Bag', 'Black Aluminum 145cm', 'Available', 'Good', '2026-02-22', 'Loan'],
  ['ITM-013', 'SD Card Sandisk Extreme 64GB (Used)', 'SanDisk', 7, 2, 'ICT Lab 2', 'Kotak Memory Media', 'SDSQX-64G-V30', 'Class 10 U3 V30', 'Available', 'Good', '2026-02-18', 'Used'],
];

for (const it of items) {
  insertItem.run(...it);
}
console.log(`Seeded ${items.length} inventory items across ICT Lab 1 & 2.`);

// 3. Seed Sample Borrowing Transactions & Tickets
const insertTx = db.prepare(`
  INSERT INTO Borrowing_Transactions (
    ticket_id, user_id, transaction_type, purpose, borrow_date,
    duration, expected_return_date, status, approved_by, rejection_reason
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertTxItem = db.prepare(`
  INSERT INTO Transaction_Items (id, ticket_id, item_id, qty_borrowed, borrowing_type)
  VALUES (?, ?, ?, ?, ?)
`);

// PGE-0001: Direct Borrow (Picked Up) by Sarah Wijaya
insertTx.run(
  'PGE-0001',
  'USR-003',
  'Direct_Borrow',
  'Praktikum Ujian Jaringan Komputer Kelas XII RPL',
  '2026-11-17T08:00:00Z',
  '3 Hari',
  '2026-11-20T16:00:00Z',
  'Picked_Up',
  'USR-001',
  null
);
insertTxItem.run('TI-001', 'PGE-0001', 'ITM-001', 2, 'Loan');
insertTxItem.run('TI-002', 'PGE-0001', 'ITM-003', 1, 'Habis Pakai');

// PGE-0002: Scheduled Reservation by Ahmad Fauzi (In Queue / Ready for pickup)
insertTx.run(
  'PGE-0002',
  'USR-004',
  'Reservation',
  'Workshop Sinematografi dan Podcast Sekolah',
  '2026-11-19T09:00:00Z',
  '2 Hari',
  '2026-11-21T15:00:00Z',
  'In_Queue',
  'USR-002',
  null
);
insertTxItem.run('TI-003', 'PGE-0002', 'ITM-009', 1, 'Loan');
insertTxItem.run('TI-004', 'PGE-0002', 'ITM-011', 1, 'Loan');

// PGE-0003: Pending Approval Direct Borrow by Kevin Pratama
insertTx.run(
  'PGE-0003',
  'USR-005',
  'Direct_Borrow',
  'Pembuatan Desain UI Portofolio Kelompok',
  '2026-11-18T10:00:00Z',
  '1 Hari',
  '2026-11-19T17:00:00Z',
  'Pending_Approval',
  null,
  null
);
insertTxItem.run('TI-005', 'PGE-0003', 'ITM-008', 1, 'Loan');

console.log('Seeded sample transactions PGE-0001, PGE-0002, PGE-0003.');

// 4. Initial Audit Log
const insertLog = db.prepare(`
  INSERT INTO Transaction_History (log_id, item_id, action_type, qty_changed, timestamp, performed_by)
  VALUES (?, ?, ?, ?, ?, ?)
`);

insertLog.run('LOG-001', 'ITM-001', 'Stock_In', 15, '2026-01-10T09:00:00Z', 'USR-001');
insertLog.run('LOG-002', 'ITM-008', 'Stock_In', 10, '2026-02-10T10:00:00Z', 'USR-001');
insertLog.run('LOG-003', 'ITM-001', 'Stock_Out', -2, '2026-11-17T08:30:00Z', 'USR-003');

console.log('Initial audit logs seeded.');
console.log('Database seed complete!');
