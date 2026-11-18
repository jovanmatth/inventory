import { NextResponse } from 'next/server';
import { db, historyRepo } from '@/lib/db';

export async function GET() {
  try {
    // 1. Stock Overview per Lab
    const labStats = db.prepare(`
      SELECT 
        location,
        COUNT(*) as total_items,
        SUM(qty) as total_qty,
        SUM(CASE WHEN condition = 'Damaged' OR status = 'Damaged' THEN 1 ELSE 0 END) as damaged_items,
        SUM(CASE WHEN qty <= min_qty_alert THEN 1 ELSE 0 END) as low_stock_items
      FROM Inventory
      GROUP BY location
    `).all();

    // 2. Low Stock Alerts
    const lowStockAlerts = db.prepare(`
      SELECT * FROM Inventory
      WHERE qty <= min_qty_alert
      ORDER BY qty ASC
    `).all();

    // 3. Overdue Transactions
    const nowIso = new Date().toISOString();
    const overdueTransactions = db.prepare(`
      SELECT t.*, u.name as user_name, u.email as user_email
      FROM Borrowing_Transactions t
      LEFT JOIN Users u ON t.user_id = u.user_id
      WHERE t.status = 'Picked_Up' 
        AND t.expected_return_date IS NOT NULL 
        AND t.expected_return_date < ?
      ORDER BY t.expected_return_date ASC
    `).all(nowIso);

    // 4. Damaged or Maintenance Items
    const damagedItems = db.prepare(`
      SELECT * FROM Inventory
      WHERE condition = 'Damaged' OR status IN ('Damaged', 'Maintenance')
      ORDER BY location ASC, item_name ASC
    `).all();

    // 5. Total pending approvals
    const pendingCount = (db.prepare(`
      SELECT COUNT(*) as count FROM Borrowing_Transactions WHERE status = 'Pending_Approval'
    `).get() as { count: number }).count;

    // 6. Recent Audit History
    const recentHistory = historyRepo.getAll(25);

    return NextResponse.json({
      success: true,
      stats: {
        labStats,
        lowStockAlerts,
        overdueTransactions,
        damagedItems,
        pendingApprovalsCount: pendingCount,
      },
      recentHistory,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
