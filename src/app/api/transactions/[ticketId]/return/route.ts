import { NextRequest, NextResponse } from 'next/server';
import { transactionRepo, returnRepo, historyRepo, userRepo, inventoryRepo } from '@/lib/data-provider';
import { ReturnedCondition, ResolutionStatus } from '@/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await params;
    const body = await request.json();
    const {
      returned_condition, // 'Good' | 'Damaged_Light' | 'Damaged_Medium' | 'Damaged_Heavy' | 'Lost'
      return_date,
      resolution_status, // 'Resolved' | 'Not_Resolved'
      received_by,
      custom_penalty_note,
    } = body;

    const tx = await transactionRepo.getByTicketId(ticketId);
    if (!tx) {
      return NextResponse.json({ success: false, message: 'Tiket tidak ditemukan' }, { status: 404 });
    }

    if (tx.status === 'Returned') {
      return NextResponse.json({ success: false, message: `Tiket ${ticketId} sudah diselesaikan / dikembalikan sebelumnya.` }, { status: 400 });
    }

    // Ensure received_by points to an existing user to satisfy DB foreign key
    let validReceivedBy = received_by;
    if (validReceivedBy) {
      const u = await userRepo.getById(validReceivedBy);
      if (!u) {
        const allUsers = await userRepo.getAll();
        const fallback = allUsers.find((x) => x.role === 'Admin' || x.role === 'Supervisor');
        validReceivedBy = fallback?.user_id || 'USR-001';
      }
    } else {
      const allUsers = await userRepo.getAll();
      const fallback = allUsers.find((x) => x.role === 'Admin' || x.role === 'Supervisor');
      validReceivedBy = fallback?.user_id || 'USR-001';
    }

    const actualReturnDate = new Date(tx.return_requested_at || return_date || new Date().toISOString());
    let isLate = false;
    let lateDays = 0;

    if (tx.expected_return_date) {
      const expected = new Date(tx.expected_return_date);
      const diffTime = actualReturnDate.getTime() - expected.getTime();
      if (diffTime > 0) {
        isLate = true;
        lateDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    // Determine penalties
    const penalties: string[] = [];

    // 1. Lateness rules
    if (isLate) {
      if (lateDays <= 1) {
        penalties.push('Terlambat 1 hari: Peringatan (Warning)');
      } else if (lateDays <= 3) {
        penalties.push(`Terlambat ${lateDays} hari: Peringatan + Pembatasan Peminjaman Sementara`);
      } else {
        penalties.push(`Terlambat ${lateDays} hari: Pembatasan Peminjaman Selama 1 Minggu`);
      }
    }

    // 2. Damage / Loss rules
    if (returned_condition === 'Damaged_Light') {
      penalties.push('Kerusakan Ringan: Diberikan Peringatan');
    } else if (returned_condition === 'Damaged_Medium') {
      penalties.push('Kerusakan Sedang: Wajib menanggung biaya perbaikan unit');
    } else if (returned_condition === 'Damaged_Heavy') {
      penalties.push('Kerusakan Berat: Wajib mengganti barang baru atau membayar ganti rugi');
    } else if (returned_condition === 'Lost') {
      penalties.push('Kehilangan: Wajib mengganti barang baru sesuai spesifikasi');
    }

    if (custom_penalty_note) {
      penalties.push(custom_penalty_note);
    }

    const penaltySummary = penalties.length ? penalties.join(' | ') : 'Tidak ada sanksi (Kondisi Baik & Tepat Waktu)';
    const finalResolution: ResolutionStatus = resolution_status || (penalties.length === 0 ? 'Resolved' : 'Not_Resolved');

    // Create return record
    const returnId = `RET-${Date.now()}`;
    await returnRepo.create({
      return_id: returnId,
      ticket_id: ticketId,
      return_date: actualReturnDate.toISOString(),
      returned_condition: returned_condition as ReturnedCondition,
      is_late: isLate ? 1 : 0,
      late_days: lateDays,
      penalty_type: penaltySummary,
      resolution_status: finalResolution,
      received_by: validReceivedBy,
    });

    // Update user penalty status if needed
    const borrower = await userRepo.getById(tx.user_id);
    if (borrower) {
      if (isLate && lateDays > 3) {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        await userRepo.update({
          ...borrower,
          penalty_status: 'Restricted_1_Week',
          restriction_end_date: nextWeek.toISOString(),
        });
      } else if ((isLate && lateDays >= 2) || finalResolution === 'Not_Resolved') {
        await userRepo.update({
          ...borrower,
          penalty_status: 'Restricted_Temp',
          restriction_end_date: null,
        });
      } else if (isLate || returned_condition === 'Damaged_Light') {
        if (borrower.penalty_status === 'None') {
          await userRepo.update({
            ...borrower,
            penalty_status: 'Warning',
          });
        }
      }
    }

    // Determine final transaction status
    const finalTxStatus = finalResolution === 'Resolved' ? 'Returned' : 'Issue_Reported';
    const completedPayload = JSON.stringify({
      type: 'RETURNED',
      proof_url: tx.return_proof_url || null,
      notes: tx.return_notes || null,
      returned_at: actualReturnDate.toISOString(),
      received_by: validReceivedBy,
      returned_condition,
      resolution_status: finalResolution,
      penalty: penaltySummary,
    });
    await transactionRepo.updateStatus(ticketId, finalTxStatus, validReceivedBy, completedPayload);

    // Restore stock for Loan items if condition is Good or Resolved
    if (finalResolution === 'Resolved' && returned_condition !== 'Lost' && returned_condition !== 'Damaged_Heavy') {
      if (tx.items) {
        for (const it of tx.items) {
          if (it.borrowing_type === 'Loan') {
            const currentItem = await inventoryRepo.getById(it.item_id);
            if (currentItem) {
              await inventoryRepo.update({
                ...currentItem,
                qty: currentItem.qty + it.qty_borrowed,
                status: 'Available',
              });
            }

            await historyRepo.log({
              log_id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              item_id: it.item_id,
              action_type: 'Returned',
              qty_changed: it.qty_borrowed,
              timestamp: new Date().toISOString(),
              performed_by: validReceivedBy,
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message:
        finalResolution === 'Resolved'
          ? `Pengembalian tiket ${ticketId} berhasil diselesaikan. Stok telah dikembalikan ke inventaris.`
          : `Pengembalian tiket ${ticketId} dicatat dengan isu (${penaltySummary}). Status: Issue Reported.`,
      penalty: penaltySummary,
      resolution: finalResolution,
      is_late: isLate,
      late_days: lateDays,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
