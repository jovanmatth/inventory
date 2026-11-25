import { NextRequest, NextResponse } from 'next/server';
import { userRepo } from '@/lib/data-provider';
import { verifyPin, hashPin } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, pin } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, code: 'INVALID_INPUT', message: 'Email wajib diisi' },
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
          message: `Access Denied: Domain Tidak Valid. Email harus menggunakan domain resmi ${requiredDomain}.`,
        },
        { status: 403 }
      );
    }

    // 2. Gate Check 2: Whitelist Validation
    const user = await userRepo.getByEmail(trimmedEmail);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          code: 'NOT_WHITELISTED',
          message: 'Access Denied: Email tidak ada di Whitelist pengguna terdaftar. Silakan hubungi Admin ICT.',
        },
        { status: 403 }
      );
    }

    // 3. Gate Check 3: PIN Validation (Only for manual credentials login)
    // Otomatisasi: jika belum memiliki PIN, set default 1234
    const defaultPinHash = hashPin('1234');
    if (!user.pin) {
      user.pin = defaultPinHash;
      user.pin_changed = 0;
      await userRepo.update(user);
    }

    if (!pin) {
      return NextResponse.json(
        {
          success: false,
          code: 'PIN_REQUIRED',
          message: 'PIN 4-angka wajib diisi untuk masuk (Gunakan 1234 jika login awal).',
        },
        { status: 400 }
      );
    }

    if (!verifyPin(pin, user.pin)) {
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_PIN',
          message: 'PIN 4-angka salah. Harap periksa kembali PIN Anda.',
        },
        { status: 401 }
      );
    }

    const isDefaultPin = !user.pin_changed;

    // Determine dashboard routing
    let redirectUrl = '/user';
    if (user.role === 'Admin') {
      redirectUrl = '/admin';
    } else if (user.role === 'Supervisor') {
      redirectUrl = '/supervisor';
    }

    if (isDefaultPin) {
      redirectUrl += (redirectUrl.includes('?') ? '&' : '?') + 'require_pin=true';
    }

    const safeUser = {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      penalty_status: user.penalty_status,
      restriction_end_date: user.restriction_end_date,
      has_pin: true,
      is_default_pin: isDefaultPin,
    };

    // Create session cookie
    const response = NextResponse.json({
      success: true,
      code: 'SUCCESS',
      message: `Authentication Success. Selamat datang, ${user.name}!`,
      user: safeUser,
      redirectUrl,
    });

    response.cookies.set('pigeon_user_id', user.user_id, {
      httpOnly: false, // accessible to client for easy role state if needed
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('Gate check error:', error);
    return NextResponse.json(
      { success: false, code: 'SERVER_ERROR', message: error.message || 'Terjadi kesalahan sistem' },
      { status: 500 }
    );
  }
}
