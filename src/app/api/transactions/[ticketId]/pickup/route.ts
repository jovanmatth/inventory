import { NextRequest, NextResponse } from 'next/server';
import { transactionRepo, db, historyRepo } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await params;
    const body = await request.json();
    const { performed_by } = body;

    const tx = transactionRepo.getByTicketId(ticketId);
    if (!tx) {
      return NextResponse.json({ success: false, message: 'Tiket tidak ditemukan' }, { status: 404 });
    }

    if (tx.status !== 'Approved' && tx.status !== 'Ready_for_Pickup') {
      return NextResponse.json(
        { success: false, message: `Barang belum dapat diambil. Status saat ini: ${tx.status}` },
        { status: 400 }
      );
    }

    // Deduct stock for all items
    if (tx.items && tx.items.length) {
      for (const it of tx.items) {
        db.prepare(`UPDATE Inventory SET qty = MAX(0, qty - ?) WHERE item_id = ?`).run(
          it.qty_borrowed,
          it.item_id
        );

        historyRepo.log({
          log_id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          item_id: it.item_id,
          action_type: 'Stock_Out',
          qty_changed: -it.qty_borrowed,
          timestamp: new Date().toISOString(),
          performed_by: performed_by || tx.user_id,
        });
      }
    }

    transactionRepo.updateStatus(ticketId, 'Picked_Up');

    return NextResponse.json({
      success: true,
      message: `Pengambilan barang untuk Tiket ${ticketId} berhasil dikonfirmasi. Stok barang telah dikurangi.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
