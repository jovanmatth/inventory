-- ==============================================================================
-- PIGEON (Practical Inventory, Goods & Equipment Organizer)
-- Supabase Database Schema & Initial Seed Data
-- Project Ref: hiezrrvpkwsegeexgwsf
-- ==============================================================================

-- 1. Create Enums / Domains
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('Admin', 'Supervisor', 'User');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE penalty_status_type AS ENUM ('None', 'Warning', 'Restricted_Temp', 'Restricted_1_Week');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE lab_location AS ENUM ('ICT Lab 1', 'ICT Lab 2');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE item_status AS ENUM ('Available', 'Borrowed', 'Damaged', 'Maintenance');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE item_condition AS ENUM ('Good', 'Damaged');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE borrowing_type AS ENUM ('Habis Pakai', 'Used', 'Loan');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('Direct_Borrow', 'Reservation');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_status AS ENUM (
      'Pending_Approval', 'Approved', 'Rejected', 'In_Queue',
      'Ready_for_Pickup', 'Picked_Up', 'Returned', 'Overdue', 'Issue_Reported'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE returned_condition AS ENUM ('Good', 'Damaged_Light', 'Damaged_Medium', 'Damaged_Heavy', 'Lost');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE resolution_status AS ENUM ('Resolved', 'Not_Resolved');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE history_action_type AS ENUM ('Stock_In', 'Stock_Out', 'Returned', 'Transferred', 'Edited', 'Damaged');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Tables
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'User',
  penalty_status penalty_status_type NOT NULL DEFAULT 'None',
  restriction_end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
  item_id TEXT PRIMARY KEY,
  item_name TEXT NOT NULL,
  brand TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0,
  min_qty_alert INTEGER NOT NULL DEFAULT 2,
  location lab_location NOT NULL,
  location_detail TEXT NOT NULL DEFAULT '',
  item_detail TEXT NOT NULL DEFAULT '',
  variant TEXT NOT NULL DEFAULT '',
  status item_status NOT NULL DEFAULT 'Available',
  condition item_condition NOT NULL DEFAULT 'Good',
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  borrowing_type borrowing_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS borrowing_transactions (
  ticket_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  transaction_type transaction_type NOT NULL,
  purpose TEXT NOT NULL,
  borrow_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration TEXT NOT NULL,
  expected_return_date TIMESTAMPTZ,
  status transaction_status NOT NULL DEFAULT 'Pending_Approval',
  approved_by TEXT REFERENCES users(user_id) ON DELETE SET NULL,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transaction_items (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES borrowing_transactions(ticket_id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES inventory(item_id) ON DELETE RESTRICT,
  qty_borrowed INTEGER NOT NULL DEFAULT 1,
  borrowing_type borrowing_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS returns_and_penalties (
  return_id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES borrowing_transactions(ticket_id) ON DELETE CASCADE,
  return_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  returned_condition returned_condition NOT NULL,
  is_late INTEGER NOT NULL DEFAULT 0,
  late_days INTEGER NOT NULL DEFAULT 0,
  penalty_type TEXT NOT NULL,
  resolution_status resolution_status NOT NULL DEFAULT 'Resolved',
  received_by TEXT NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transaction_history (
  log_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES inventory(item_id) ON DELETE CASCADE,
  action_type history_action_type NOT NULL,
  qty_changed INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  performed_by TEXT NOT NULL REFERENCES users(user_id)
);

-- 3. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory(location);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON borrowing_transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON borrowing_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_tx_items_ticket ON transaction_items(ticket_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrowing_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns_and_penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_history ENABLE ROW LEVEL SECURITY;

-- Allow public read & write via Anon Key for PIGEON internal lab application
CREATE POLICY "Allow public read users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow public write users" ON users FOR ALL USING (true);

CREATE POLICY "Allow public read inventory" ON inventory FOR SELECT USING (true);
CREATE POLICY "Allow public write inventory" ON inventory FOR ALL USING (true);

CREATE POLICY "Allow public read transactions" ON borrowing_transactions FOR SELECT USING (true);
CREATE POLICY "Allow public write transactions" ON borrowing_transactions FOR ALL USING (true);

CREATE POLICY "Allow public read tx_items" ON transaction_items FOR SELECT USING (true);
CREATE POLICY "Allow public write tx_items" ON transaction_items FOR ALL USING (true);

CREATE POLICY "Allow public read returns" ON returns_and_penalties FOR SELECT USING (true);
CREATE POLICY "Allow public write returns" ON returns_and_penalties FOR ALL USING (true);

CREATE POLICY "Allow public read history" ON transaction_history FOR SELECT USING (true);
CREATE POLICY "Allow public write history" ON transaction_history FOR ALL USING (true);

-- 5. Seed Initial Whitelisted Users
INSERT INTO users (user_id, name, email, role, penalty_status, restriction_end_date)
VALUES
  ('USR-001', 'Budi Santoso (Admin ICT)', 'admin.ict@mutiarabangsa.sch.id', 'Admin', 'None', null),
  ('USR-002', 'Dr. Hendra Gunawan (Lab Head)', 'supervisor.ict@mutiarabangsa.sch.id', 'Supervisor', 'None', null),
  ('USR-003', 'Sarah Wijaya (Teacher - CS)', 'sarah.wijaya@mutiarabangsa.sch.id', 'User', 'None', null),
  ('USR-004', 'Ahmad Fauzi (Teacher - Multimedia)', 'ahmad.fauzi@mutiarabangsa.sch.id', 'User', 'None', null),
  ('USR-005', 'Kevin Pratama (Student - RPL)', 'kevin.pratama@mutiarabangsa.sch.id', 'User', 'None', null),
  ('USR-006', 'Amanda Putri (Student - MM)', 'amanda.putri@mutiarabangsa.sch.id', 'User', 'Warning', null),
  ('USR-007', 'Deni Setiawan (Restricted)', 'deni.restricted@mutiarabangsa.sch.id', 'User', 'Restricted_1_Week', NOW() + INTERVAL '7 days')
ON CONFLICT (email) DO NOTHING;

-- 6. Seed Inventory Items
INSERT INTO inventory (
  item_id, item_name, brand, qty, min_qty_alert, location, location_detail,
  item_detail, variant, status, condition, date_added, borrowing_type
) VALUES
  ('ITM-001', 'Laptop Lenovo ThinkPad E14', 'Lenovo', 15, 3, 'ICT Lab 1', 'Lemari A - Rak 1', 'TP-E14-G4 / SN: 2026-LN-001', 'Black / Core i5 / 16GB', 'Available', 'Good', '2026-01-10', 'Loan'),
  ('ITM-002', 'Kabel HDMI to HDMI 2M', 'Vention', 20, 5, 'ICT Lab 1', 'Laci C - No 2', 'VNT-HD2M-4K', 'Black braided 2M', 'Available', 'Good', '2026-02-15', 'Loan'),
  ('ITM-003', 'Konektor RJ45 Cat6 (Pack 50)', 'Belden', 8, 2, 'ICT Lab 1', 'Rak Komponen B3', 'BLD-RJ45-C6-GOLD', 'Transparent Gold Plated', 'Available', 'Good', '2026-03-01', 'Habis Pakai'),
  ('ITM-004', 'Kabel UTP Cat6 (Meteran)', 'Belden', 60, 15, 'ICT Lab 1', 'Roll Drum B4', 'BLD-UTP-CAT6-GREY', 'Grey UTP / Per Meter', 'Available', 'Good', '2026-03-01', 'Habis Pakai'),
  ('ITM-005', 'Proyektor Epson EB-X500', 'Epson', 4, 1, 'ICT Lab 1', 'Lemari Audio-Visual', 'EB-X500-3600LM / SN: EP-9921', 'White 3600 Lumens', 'Available', 'Good', '2026-01-20', 'Loan'),
  ('ITM-006', 'Kabel Power CPU (Used)', 'Generic', 12, 3, 'ICT Lab 1', 'Kotak Kabel Sekunder', 'CAB-PWR-US-15M', 'Black 1.5 Meter', 'Available', 'Good', '2026-02-05', 'Used'),
  ('ITM-007', 'Switch Hub 16 Port Gigabit', 'TP-Link', 2, 1, 'ICT Lab 1', 'Rak Server ICT 1', 'TL-SG1016D Rackmount', 'Metal Case Black', 'Available', 'Good', '2026-01-15', 'Loan'),
  ('ITM-008', 'Drawing Tablet Wacom One', 'Wacom', 10, 2, 'ICT Lab 2', 'Lemari Multimedia M1', 'DTC-133W0C / SN: WAC-8812', '13.3 Inch Full HD', 'Available', 'Good', '2026-02-10', 'Loan'),
  ('ITM-009', 'Kamera DSLR Canon EOS 3000D', 'Canon', 3, 1, 'ICT Lab 2', 'Dry Box Lemari M2', 'EOS-3000D + Kit 18-55mm', 'Black Kit', 'Available', 'Good', '2026-01-25', 'Loan'),
  ('ITM-010', 'Baterai AA Alkaline (Pack 4)', 'Energizer', 14, 4, 'ICT Lab 2', 'Laci Alat Media L1', 'ENERG-AA-MAX', 'AA 1.5V Pack 4', 'Available', 'Good', '2026-03-10', 'Habis Pakai'),
  ('ITM-011', 'Microphone Wireless Blink 500', 'Saramonic', 2, 1, 'ICT Lab 2', 'Lemari Audio A2', 'BLINK-B2-TX+RX / Dual Kit', 'Black 2.4GHz Kit', 'Available', 'Good', '2026-02-20', 'Loan'),
  ('ITM-012', 'Tripod Kamera Takara ECO-196A', 'Takara', 5, 2, 'ICT Lab 2', 'Rak Sudut Studio', 'TAK-ECO196A + Bag', 'Black Aluminum 145cm', 'Available', 'Good', '2026-02-22', 'Loan'),
  ('ITM-013', 'SD Card Sandisk Extreme 64GB (Used)', 'SanDisk', 7, 2, 'ICT Lab 2', 'Kotak Memory Media', 'SDSQX-64G-V30', 'Class 10 U3 V30', 'Available', 'Good', '2026-02-18', 'Used')
ON CONFLICT (item_id) DO NOTHING;

-- 7. Seed Transactions
INSERT INTO borrowing_transactions (
  ticket_id, user_id, transaction_type, purpose, borrow_date,
  duration, expected_return_date, status, approved_by, rejection_reason
) VALUES
  ('PGE-0001', 'USR-003', 'Direct_Borrow', 'Praktikum Ujian Jaringan Komputer Kelas XII RPL', NOW() - INTERVAL '1 day', '3 Hari', NOW() + INTERVAL '2 days', 'Picked_Up', 'USR-001', null),
  ('PGE-0002', 'USR-004', 'Reservation', 'Workshop Sinematografi dan Podcast Sekolah', NOW() + INTERVAL '1 day', '2 Hari', NOW() + INTERVAL '3 days', 'In_Queue', 'USR-002', null),
  ('PGE-0003', 'USR-005', 'Direct_Borrow', 'Pembuatan Desain UI Portofolio Kelompok', NOW(), '1 Hari', NOW() + INTERVAL '1 day', 'Pending_Approval', null, null)
ON CONFLICT (ticket_id) DO NOTHING;

INSERT INTO transaction_items (id, ticket_id, item_id, qty_borrowed, borrowing_type)
VALUES
  ('TI-001', 'PGE-0001', 'ITM-001', 2, 'Loan'),
  ('TI-002', 'PGE-0001', 'ITM-003', 1, 'Habis Pakai'),
  ('TI-003', 'PGE-0002', 'ITM-009', 1, 'Loan'),
  ('TI-004', 'PGE-0002', 'ITM-011', 1, 'Loan'),
  ('TI-005', 'PGE-0003', 'ITM-008', 1, 'Loan')
ON CONFLICT (id) DO NOTHING;
