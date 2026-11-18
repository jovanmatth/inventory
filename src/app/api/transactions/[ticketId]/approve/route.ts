import { NextRequest, NextResponse } from 'next/server';
import { transactionRepo, db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await params;
    const body = await request.json();
    const { action, approved_by, rejection_reason } = body; // action: 'approve' | 'reject' | 'ready'

    const tx = transactionRepo.getByTicketId(ticketId);
    if (!tx) {
      return NextResponse.json({ success: false, message: 'Tiket tidak ditemukan' }, { status: 404 });
    }

    if (action === 'reject') {
      if (!rejection_reason) {
        return NextResponse.json({ success: false, message: 'Alasan penolakan wajib disertakan' }, { status: 400 });
      }
      transactionRepo.updateStatus(ticketId, 'Rejected', approved_by, rejection_reason);
      return NextResponse.json({
        success: true,
        message: `Tiket ${ticketId} telah DITOLAK. Peminjam akan menerima notifikasi status penolakan.`,
      });
    }

    if (action === 'approve') {
      // Transition to Approved or Ready_for_Pickup
      const newStatus = tx.transaction_type === 'Reservation' ? 'Ready_for_Pickup' : 'Approved';
      transactionRepo.updateStatus(ticketId, newStatus, approved_by);
      return NextResponse.json({
        success: true,
        message: `Tiket ${ticketId} telah DISETUJUI. Peminjam siap mengambil barang (Ready for Pickup).`,
      });
    }

    if (action === 'ready') {
      transactionRepo.updateStatus(ticketId, 'Ready_for_Pickup', approved_by);
      return NextResponse.json({
        success: true,
        message: `Status Tiket ${ticketId} diperbarui menjadi Ready for Pickup.`,
      });
    }

    return NextResponse.json({ success: false, message: 'Aksi tidak valid' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
