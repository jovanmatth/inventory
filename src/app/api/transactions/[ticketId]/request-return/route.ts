import { NextRequest, NextResponse } from 'next/server';
import { transactionRepo } from '@/lib/data-provider';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const { ticketId } = await params;
    const tx = await transactionRepo.getByTicketId(ticketId);

    if (!tx) {
      return NextResponse.json({ success: false, message: 'Tiket tidak ditemukan' }, { status: 404 });
    }

    if (tx.status !== 'Picked_Up' && tx.status !== 'Approved' && tx.status !== 'Overdue') {
      return NextResponse.json(
        {
          success: false,
          message: `Tiket ${ticketId} dengan status '${tx.status}' tidak dapat diajukan pengembalian. Hanya tiket yang sedang dipinjam yang dapat dikembalikan.`,
        },
        { status: 400 }
      );
    }

    let publicUrl = '';
    let notes = '';

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('proof') as File | null;
      notes = (formData.get('notes') as string) || '';

      if (!file || file.size === 0) {
        return NextResponse.json(
          { success: false, message: 'Foto bukti pengembalian fisik wajib diunggah.' },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${ticketId}_proof_${Date.now()}.${ext}`;

      if (isSupabaseConfigured() && supabaseAdmin) {
        const { data, error } = await supabaseAdmin.storage
          .from('return-proofs')
          .upload(fileName, buffer, {
            contentType: file.type || 'image/jpeg',
            upsert: true,
          });

        if (error) {
          console.warn('Supabase storage upload failed:', error);
          // Fallback to data URI if storage fails
          publicUrl = `data:${file.type || 'image/jpeg'};base64,${buffer.toString('base64')}`;
        } else if (data) {
          const { data: pubData } = supabaseAdmin.storage.from('return-proofs').getPublicUrl(fileName);
          publicUrl = pubData.publicUrl;
        }
      } else {
        publicUrl = `data:${file.type || 'image/jpeg'};base64,${buffer.toString('base64')}`;
      }
    } else {
      const body = await request.json();
      const { proof_base64, proof_mime = 'image/jpeg' } = body;
      notes = body.notes || '';

      if (!proof_base64) {
        return NextResponse.json(
          { success: false, message: 'Foto bukti pengembalian fisik wajib diunggah.' },
          { status: 400 }
        );
      }

      const cleanBase64 = proof_base64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      const fileName = `${ticketId}_proof_${Date.now()}.jpg`;

      if (isSupabaseConfigured() && supabaseAdmin) {
        const { data, error } = await supabaseAdmin.storage
          .from('return-proofs')
          .upload(fileName, buffer, {
            contentType: proof_mime,
            upsert: true,
          });

        if (!error && data) {
          const { data: pubData } = supabaseAdmin.storage.from('return-proofs').getPublicUrl(fileName);
          publicUrl = pubData.publicUrl;
        } else {
          publicUrl = proof_base64;
        }
      } else {
        publicUrl = proof_base64;
      }
    }

    if (!publicUrl) {
      return NextResponse.json(
        { success: false, message: 'Gagal memproses foto bukti pengembalian.' },
        { status: 400 }
      );
    }

    // Save return request metadata in rejection_reason JSON
    const returnPayload = {
      type: 'RETURN_PENDING',
      proof_url: publicUrl,
      notes: notes.trim(),
      requested_at: new Date().toISOString(),
    };

    await transactionRepo.updateStatus(
      ticketId,
      tx.status,
      tx.approved_by || undefined,
      JSON.stringify(returnPayload)
    );

    return NextResponse.json({
      success: true,
      message: `Permohonan pengembalian tiket ${ticketId} berhasil diajukan dengan foto bukti. Menunggu verifikasi staf / supervisor ICT Lab.`,
      proof_url: publicUrl,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
