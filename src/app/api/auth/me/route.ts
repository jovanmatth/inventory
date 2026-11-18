import { NextRequest, NextResponse } from 'next/server';
import { userRepo } from '@/lib/db';

export async function GET(request: NextRequest) {
  const userId = request.cookies.get('pigeon_user_id')?.value;
  if (!userId) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  const user = userRepo.getById(userId);
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, user });
}
