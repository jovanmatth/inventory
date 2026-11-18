import { NextRequest, NextResponse } from 'next/server';
import { inventoryRepo } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_id, target_location, target_detail, transfer_qty, performed_by } = body;

    if (!item_id || !target_location || !transfer_qty || !performed_by) {
      return NextResponse.json(
        { success: false, message: 'Item ID, lokasi tujuan, jumlah transfer, dan pelaksana wajib diisi' },
        { status: 400 }
      );
    }

    if (transfer_qty <= 0) {
      return NextResponse.json({ success: false, message: 'Jumlah transfer harus lebih dari 0' }, { status: 400 });
    }

    inventoryRepo.transfer(item_id, target_location, target_detail, Number(transfer_qty), performed_by);

    return NextResponse.json({
      success: true,
      message: `Berhasil mentransfer ${transfer_qty} unit ke ${target_location}. Data stok & audit log telah diperbarui.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
