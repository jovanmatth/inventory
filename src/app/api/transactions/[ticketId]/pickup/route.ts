import { NextRequest, NextResponse } from 'next/server';
import { transactionRepo, historyRepo, inventoryRepo } from '@/lib/data-provider';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await params;
    const body = await request.json();
    const { performed_by } = body;

    const tx = await transactionRepo.getByTicketId(ticketId);
    if (!tx) {
      return NextResponse.json({ success: false, message: 'Tiket tidak ditemukan' }, { status: 404 });
    }

    if (tx.status === 'Picked_Up') {
      return NextResponse.json(
        { success: false, message: `Barang untuk tiket ${ticketId} sudah diambil sebelumnya (status sudah Picked_Up).` },
        { status: 400 }
      );
    }

    if (tx.status !== 'Approved' && tx.status !== 'Ready_for_Pickup') {
      return NextResponse.json(
        { success: false, message: `Barang belum dapat diambil atau sudah diproses. Status saat ini: ${tx.status}` },
        { status: 400 }
      );
    }

    // Deduct stock for all items
    if (tx.items && tx.items.length) {
      for (const it of tx.items) {
        const currentItem = await inventoryRepo.getById(it.item_id);
        if (currentItem) {
          const newQty = Math.max(0, currentItem.qty - it.qty_borrowed);
          await inventoryRepo.update({
            ...currentItem,
            qty: newQty,
            status: newQty === 0 ? 'Borrowed' : currentItem.status,
          });
        }

        await historyRepo.log({
          log_id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          item_id: it.item_id,
          action_type: 'Stock_Out',
          qty_changed: -it.qty_borrowed,
          timestamp: new Date().toISOString(),
          performed_by: performed_by || tx.user_id,
        });
      }
    }

    await transactionRepo.updateStatus(ticketId, 'Picked_Up');

    return NextResponse.json({
      success: true,
      message: `Pengambilan barang untuk Tiket ${ticketId} berhasil dikonfirmasi. Stok barang telah dikurangi.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
