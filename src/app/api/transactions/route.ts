import { NextRequest, NextResponse } from 'next/server';
import { transactionRepo, inventoryRepo, userRepo } from '@/lib/data-provider';
import { BorrowingTransaction } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const userId = searchParams.get('user_id') || undefined;

    const transactions = await transactionRepo.getAll({ status, user_id: userId });
    return NextResponse.json({ success: true, transactions });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_id,
      transaction_type, // 'Direct_Borrow' | 'Reservation'
      purpose,
      borrow_date,
      duration,
      expected_return_date,
      items, // array of { item_id, qty_borrowed }
    } = body;

    if (!user_id || !transaction_type || !purpose || !items || !items.length) {
      return NextResponse.json({ success: false, message: 'Data permohonan tidak lengkap' }, { status: 400 });
    }

    // Check user penalty status
    const user = await userRepo.getById(user_id);
    if (!user) {
      return NextResponse.json({ success: false, message: 'User tidak ditemukan' }, { status: 404 });
    }

    if (user.penalty_status === 'Restricted_Temp' || user.penalty_status === 'Restricted_1_Week') {
      return NextResponse.json(
        {
          success: false,
          message: `Pengajuan ditolak. Akun Anda sedang dalam status sanksi (${user.penalty_status}) hingga ${user.restriction_end_date || 'penyelesaian masalah'}.`,
        },
        { status: 403 }
      );
    }

    // Validate items availability and build item details with borrowing_type
    const preparedItems: { item_id: string; qty_borrowed: number; borrowing_type: string }[] = [];
    let hasLoanItem = false;

    for (const it of items) {
      const dbItem = await inventoryRepo.getById(it.item_id);
      if (!dbItem) {
        return NextResponse.json({ success: false, message: `Barang dengan ID ${it.item_id} tidak ditemukan` }, { status: 404 });
      }

      if (dbItem.qty < it.qty_borrowed) {
        return NextResponse.json(
          {
            success: false,
            message: `Stok barang "${dbItem.item_name}" tidak mencukupi (Tersedia: ${dbItem.qty}, Diminta: ${it.qty_borrowed})`,
          },
          { status: 400 }
        );
      }

      if (dbItem.borrowing_type === 'Loan') {
        hasLoanItem = true;
      }

      preparedItems.push({
        item_id: it.item_id,
        qty_borrowed: it.qty_borrowed,
        borrowing_type: dbItem.borrowing_type,
      });
    }

    // If there is a Loan item, expected_return_date and duration are required
    if (hasLoanItem && (!expected_return_date || !duration)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Barang bertipe Pinjaman (Loan) wajib menyertakan Durasi dan Tanggal Pengembalian.',
        },
        { status: 400 }
      );
    }

    // Determine initial status based on workflow:
    // Direct_Borrow -> 'Pending_Approval'
    // Reservation -> 'In_Queue' (or 'Pending_Approval' for supervisor/admin approval)
    const initialStatus = transaction_type === 'Reservation' ? 'In_Queue' : 'Pending_Approval';

    let normalizedReturnDate: string | null = null;
    if (expected_return_date) {
      try {
        const d = new Date(expected_return_date);
        if (!isNaN(d.getTime())) {
          normalizedReturnDate = d.toISOString();
        } else {
          normalizedReturnDate = expected_return_date;
        }
      } catch {
        normalizedReturnDate = expected_return_date;
      }
    }

    const tx: BorrowingTransaction = {
      ticket_id: '',
      user_id,
      transaction_type,
      purpose,
      borrow_date: borrow_date || new Date().toISOString(),
      duration: duration || '1 Hari',
      expected_return_date: normalizedReturnDate,
      status: initialStatus,
      approved_by: null,
      rejection_reason: null,
    };

    const ticketId = await transactionRepo.create(tx, preparedItems);

    return NextResponse.json({
      success: true,
      ticket_id: ticketId,
      status: initialStatus,
      message:
        transaction_type === 'Reservation'
          ? `Reservasi berhasil dicatat dengan Tiket ${ticketId}. Tiket telah dimasukkan ke sistem antrean.`
          : `Permintaan peminjaman berhasil diajukan dengan Tiket ${ticketId}. Menunggu persetujuan Admin/Supervisor.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticket_id');

    if (!ticketId) {
      return NextResponse.json({ success: false, message: 'Ticket ID diperlukan' }, { status: 400 });
    }

    // Check transaction status before deleting
    const existingTx = await transactionRepo.getByTicketId(ticketId);
    if (!existingTx) {
      return NextResponse.json({ success: false, message: 'Tiket tidak ditemukan' }, { status: 404 });
    }

    // Protection: Disallow deletion if ticket has already been approved or in active usage
    const nonDeletableStatuses = ['Approved', 'Ready_for_Pickup', 'Picked_Up', 'Returned', 'Overdue', 'Issue_Reported'];
    if (nonDeletableStatuses.includes(existingTx.status)) {
      return NextResponse.json(
        {
          success: false,
          message: `Tiket ${ticketId} sudah disetujui (Status: ${existingTx.status}). Tiket yang sudah disetujui tidak dapat dihapus atau dibatalkan.`,
        },
        { status: 403 }
      );
    }

    await transactionRepo.delete(ticketId);
    return NextResponse.json({
      success: true,
      message: `Tiket ${ticketId} berhasil dibatalkan dan dihapus.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }
}
