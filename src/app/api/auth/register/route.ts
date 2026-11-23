import { NextRequest, NextResponse } from 'next/server';
import { userRepo } from '@/lib/data-provider';
import { hashPin, isValidPin } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, pin, confirm_pin } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', message: 'Email institusi wajib diisi.' },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    // 1. Gate Check 1: Domain Validation
    const requiredDomain = '@mutiarabangsa.sch.id';
    if (!trimmedEmail.endsWith(requiredDomain)) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_DOMAIN',
          message: `Pendaftaran Ditolak: Domain Tidak Valid. Email harus menggunakan domain resmi ${requiredDomain}.`,
        },
        { status: 403 }
      );
    }

    // 2. Validate PIN format (must be 4 numeric digits)
    if (!pin || !isValidPin(pin)) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_PIN_FORMAT',
          message: 'PIN harus terdiri dari tepat 4 angka (contoh: 1234).',
        },
        { status: 400 }
      );
    }

    if (confirm_pin !== undefined && pin !== confirm_pin) {
      return NextResponse.json(
        {
          success: false,
          code: 'PIN_MISMATCH',
          message: 'Konfirmasi PIN tidak cocok dengan PIN yang dimasukkan.',
        },
        { status: 400 }
      );
    }

    // 3. Gate Check 2: Whitelist Validation (MUST be in Whitelist first)
    const user = await userRepo.getByEmail(trimmedEmail);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          code: 'NOT_WHITELISTED',
          message:
            'Pendaftaran Ditolak: Email Anda belum terdaftar di Whitelist pengguna PIGEON. Harap hubungi Admin ICT Lab untuk mendaftarkan akun Anda terlebih dahulu.',
        },
        { status: 403 }
      );
    }

    // 4. Hash and save the 4-digit PIN
    const hashed = hashPin(pin);
    const updatedUser = {
      ...user,
      pin: hashed,
      pin_changed: 1,
    };
    await userRepo.update(updatedUser);

    // 5. Determine role routing
    let redirectUrl = '/user';
    if (user.role === 'Admin') {
      redirectUrl = '/admin';
    } else if (user.role === 'Supervisor') {
      redirectUrl = '/supervisor';
    }

    // Create session cookie for immediate login
    const response = NextResponse.json({
      success: true,
      code: 'SUCCESS',
      message: `Akun berhasil diaktifkan dengan PIN 4-angka! Selamat datang, ${user.name}!`,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        penalty_status: user.penalty_status,
        restriction_end_date: user.restriction_end_date,
        has_pin: true,
      },
      redirectUrl,
    });

    response.cookies.set('pigeon_user_id', user.user_id, {
      httpOnly: false,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('Account creation error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error.message || 'Terjadi kesalahan sistem' },
      { status: 500 }
    );
  }
}
