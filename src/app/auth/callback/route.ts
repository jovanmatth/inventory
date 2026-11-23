import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { userRepo } from '@/lib/data-provider';
import { hashPin } from '@/lib/auth-utils';

const DEFAULT_SUPABASE_URL = 'https://hiezrrvpkwsegeexgwsf.supabase.co';
const DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpZXpycnZwa3dzZWdlZXhnd3NmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5NzM3NjcsImV4cCI6MjExMDU0OTc2N30.1sJcxsL7hkg_gIfIqJpnNlWoAMdYNRJTW1RkruxFOvY';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=NO_CODE`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Handled in server components
          }
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error('Supabase Auth exchange error:', error);
    return NextResponse.redirect(
      `${origin}/?error=AUTH_ERROR&message=${encodeURIComponent(error?.message || 'Gagal verifikasi session')}`
    );
  }

  const googleEmail = data.user.email?.toLowerCase().trim();
  const googleName = data.user.user_metadata?.full_name || data.user.user_metadata?.name || 'User';

  if (!googleEmail) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/?error=NO_EMAIL`);
  }

  // ==========================================
  // GATE CHECK 1: Domain Validation
  // ==========================================
  const requiredDomain = '@mutiarabangsa.sch.id';
  if (!googleEmail.endsWith(requiredDomain)) {
    // Access Denied: Domain Tidak Valid
    await supabase.auth.signOut();
    return NextResponse.redirect(
      `${origin}/?error=INVALID_DOMAIN&email=${encodeURIComponent(googleEmail)}`
    );
  }

  // ==========================================
  // GATE CHECK 2: Whitelist Validation
  // ==========================================
  const dbUser = await userRepo.getByEmail(googleEmail);
  if (!dbUser) {
    // Access Denied: Email tidak ada di Whitelist
    await supabase.auth.signOut();
    return NextResponse.redirect(
      `${origin}/?error=NOT_WHITELISTED&email=${encodeURIComponent(googleEmail)}`
    );
  }

  // ==========================================
  // AUTO-SET DEFAULT PIN 1234 IF NO PIN
  // Sesuai aturan: jika awalnya gunakan google auth maka buat pin nya otomatis 1234
  // ==========================================
  const defaultPinHash = hashPin('1234');
  let isDefaultPin = false;

  if (!dbUser.pin) {
    const updatedUser = {
      ...dbUser,
      pin: defaultPinHash,
      pin_changed: 0,
    };
    await userRepo.update(updatedUser);
    isDefaultPin = true;
  } else if (!dbUser.pin_changed || dbUser.pin === defaultPinHash) {
    isDefaultPin = true;
  }

  // ==========================================
  // AUTHENTICATION SUCCESS: Role Routing
  // ==========================================
  let redirectPath = '/user';
  if (dbUser.role === 'Admin') {
    redirectPath = '/admin';
  } else if (dbUser.role === 'Supervisor') {
    redirectPath = '/supervisor';
  }

  if (isDefaultPin) {
    redirectPath += (redirectPath.includes('?') ? '&' : '?') + 'require_pin=true';
  }

  const response = NextResponse.redirect(`${origin}${redirectPath}`);

  // Set persistent session cookie for PIGEON app shell
  response.cookies.set('pigeon_user_id', dbUser.user_id, {
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    httpOnly: false,
  });

  return response;
}
