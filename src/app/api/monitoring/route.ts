import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase';
import { supabaseAdmin } from '@/lib/supabase';
import { historyRepo } from '@/lib/data-provider';
import { db } from '@/lib/db';

export async function GET() {
  try {
    if (isSupabaseConfigured() && supabaseAdmin) {
      // 1. Fetch Inventory from Supabase
      const { data: invItems, error: invErr } = await supabaseAdmin
        .from('inventory')
        .select('*');

      const allItems = invItems || [];

      // Compute labStats in memory from Supabase items
      const labs = ['ICT Lab 1', 'ICT Lab 2'];
      const labStats = labs.map((loc) => {
        const labItems = allItems.filter((i: any) => i.location === loc);
        const total_qty = labItems.reduce((sum: number, i: any) => sum + (Number(i.qty) || 0), 0);
        const damaged_items = labItems.filter(
          (i: any) => i.condition === 'Damaged' || i.status === 'Damaged'
        ).length;
        const low_stock_items = labItems.filter(
          (i: any) => Number(i.qty) <= Number(i.min_qty_alert)
        ).length;

        return {
          location: loc,
          total_items: labItems.length,
          total_qty,
          damaged_items,
          low_stock_items,
        };
      });

      // 2. Low Stock Alerts
      const lowStockAlerts = allItems
        .filter((i: any) => Number(i.qty) <= Number(i.min_qty_alert))
        .sort((a: any, b: any) => a.qty - b.qty);

      // 3. Damaged or Maintenance Items
      const damagedItems = allItems.filter(
        (i: any) => i.condition === 'Damaged' || i.status === 'Damaged' || i.status === 'Maintenance'
      );

      // 4. Overdue Transactions from Supabase
      const nowIso = new Date().toISOString();
      const { data: overdueTx } = await supabaseAdmin
        .from('borrowing_transactions')
        .select('*, users(name, email)')
        .eq('status', 'Picked_Up')
        .not('expected_return_date', 'is', null)
        .lt('expected_return_date', nowIso);

      const overdueTransactions = (overdueTx || []).map((t: any) => ({
        ...t,
        user_name: t.users?.name,
        user_email: t.users?.email,
      }));

      // 5. Total pending approvals
      const { count: pendingCount } = await supabaseAdmin
        .from('borrowing_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Pending_Approval');

      // 6. Recent Audit History
      const recentHistory = await historyRepo.getAll(25);

      return NextResponse.json({
        success: true,
        stats: {
          labStats,
          lowStockAlerts,
          overdueTransactions,
          damagedItems,
          pendingApprovalsCount: pendingCount || 0,
        },
        recentHistory,
      });
    }

    // SQLite Fallback (Local Development)
    if (!db) {
      return NextResponse.json({
        success: true,
        stats: {
          labStats: [],
          lowStockAlerts: [],
          overdueTransactions: [],
          damagedItems: [],
          pendingApprovalsCount: 0,
        },
        recentHistory: [],
      });
    }

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
    const recentHistory = await historyRepo.getAll(25);

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
