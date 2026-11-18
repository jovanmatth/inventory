import { NextRequest, NextResponse } from 'next/server';
import { transactionRepo } from '@/lib/data-provider';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await params;
    const body = await request.json();
    const { reason, rejected_by = 'Staf ICT' } = body;

    const tx = await transactionRepo.getByTicketId(ticketId);
    if (!tx) {
      return NextResponse.json({ success: false, message: 'Tiket tidak ditemukan' }, { status: 404 });
    }

    const rejectPayload = {
      type: 'RETURN_REJECTED',
      reason: reason || 'Foto bukti pengembalian tidak jelas atau barang fisik belum ditemukan di lab. Silakan unggah foto ulang.',
      rejected_by,
      rejected_at: new Date().toISOString(),
    };

    await transactionRepo.updateStatus(
      ticketId,
      tx.status,
      tx.approved_by || undefined,
      JSON.stringify(rejectPayload)
    );

    return NextResponse.json({
      success: true,
      message: `Bukti pengembalian tiket ${ticketId} telah ditolak. Peminjam telah diminta untuk mengunggah ulang bukti.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
