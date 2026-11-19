import { NextRequest, NextResponse } from 'next/server';
import { transactionRepo } from '@/lib/data-provider';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await params;
    const body = await request.json();
    const { action, approved_by, rejection_reason } = body; // action: 'approve' | 'reject' | 'ready'

    const tx = await transactionRepo.getByTicketId(ticketId);
    if (!tx) {
      return NextResponse.json({ success: false, message: 'Tiket tidak ditemukan' }, { status: 404 });
    }

    if (action === 'reject') {
      if (!rejection_reason) {
        return NextResponse.json({ success: false, message: 'Alasan penolakan wajib disertakan' }, { status: 400 });
      }
      await transactionRepo.updateStatus(ticketId, 'Rejected', approved_by, rejection_reason);
      return NextResponse.json({
        success: true,
        message: `Tiket ${ticketId} telah DITOLAK. Peminjam akan menerima notifikasi status penolakan.`,
      });
    }

    if (action === 'approve') {
      if (tx.status === 'Approved' || tx.status === 'Ready_for_Pickup') {
        return NextResponse.json({ success: false, message: `Tiket ${ticketId} sudah disetujui sebelumnya.` }, { status: 400 });
      }
      if (tx.status === 'Picked_Up' || tx.status === 'Returned') {
        return NextResponse.json({ success: false, message: `Tiket ${ticketId} sudah diproses lebih lanjut (${tx.status}).` }, { status: 400 });
      }
      // Transition to Approved or Ready_for_Pickup
      const newStatus = tx.transaction_type === 'Reservation' ? 'Ready_for_Pickup' : 'Approved';
      await transactionRepo.updateStatus(ticketId, newStatus, approved_by);
      return NextResponse.json({
        success: true,
        message: `Tiket ${ticketId} telah DISETUJUI. Peminjam siap mengambil barang (Ready for Pickup).`,
      });
    }

    if (action === 'ready') {
      await transactionRepo.updateStatus(ticketId, 'Ready_for_Pickup', approved_by);
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
