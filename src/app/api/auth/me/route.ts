import { NextRequest, NextResponse } from 'next/server';
import { userRepo } from '@/lib/data-provider';

export async function GET(request: NextRequest) {
  const userId = request.cookies.get('pigeon_user_id')?.value;
  if (!userId) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  const user = await userRepo.getById(userId);
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  // Auto-lift expired 1-week restriction
  if (user.penalty_status === 'Restricted_1_Week' && user.restriction_end_date) {
    if (new Date(user.restriction_end_date).getTime() <= Date.now()) {
      user.penalty_status = 'None';
      user.restriction_end_date = null;
      await userRepo.update(user);
    }
  }

  return NextResponse.json({ authenticated: true, user });
}
