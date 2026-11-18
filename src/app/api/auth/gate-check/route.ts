import { NextRequest, NextResponse } from 'next/server';
import { userRepo } from '@/lib/data-provider';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name } = body;

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

    // Determine dashboard routing
    let redirectUrl = '/user';
    if (user.role === 'Admin') {
      redirectUrl = '/admin';
    } else if (user.role === 'Supervisor') {
      redirectUrl = '/supervisor';
    }

    // Create session cookie
    const response = NextResponse.json({
      success: true,
      code: 'SUCCESS',
      message: `Authentication Success. Selamat datang, ${user.name}!`,
      user,
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
