import { NextRequest, NextResponse } from 'next/server';
import { userRepo } from '@/lib/data-provider';
import { hashPin, isValidPin } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
  try {
    const userId = request.cookies.get('pigeon_user_id')?.value;
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Tidak terotentikasi' }, { status: 401 });
    }

    const body = await request.json();
    const { pin, confirm_pin } = body;

    if (!pin || !isValidPin(pin)) {
      return NextResponse.json(
        { success: false, message: 'PIN harus terdiri dari tepat 4 angka (0-9).' },
        { status: 400 }
      );
    }

    if (confirm_pin !== undefined && pin !== confirm_pin) {
      return NextResponse.json(
        { success: false, message: 'Konfirmasi PIN tidak cocok dengan PIN yang dimasukkan.' },
        { status: 400 }
      );
    }

    const user = await userRepo.getById(userId);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    const hashedPin = hashPin(pin);
    const updatedUser = {
      ...user,
      pin: hashedPin,
      pin_changed: 1,
    };
    await userRepo.update(updatedUser);

    return NextResponse.json({
      success: true,
      message: 'PIN 4-angka Anda berhasil disimpan!',
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        penalty_status: user.penalty_status,
        has_pin: true,
        is_default_pin: false,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Terjadi kesalahan sistem' },
      { status: 500 }
    );
  }
}
