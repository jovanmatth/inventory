import { NextRequest, NextResponse } from 'next/server';
import { userRepo } from '@/lib/data-provider';
import { hashPin, isValidPin } from '@/lib/auth-utils';
import { User } from '@/types';

export async function GET() {
  try {
    const rawUsers = await userRepo.getAll();
    const users = rawUsers.map((u) => ({
      ...u,
      has_pin: Boolean(u.pin),
      pin: undefined,
    }));
    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, role, penalty_status, restriction_end_date, pin } = body;

    if (!name || !email || !role) {
      return NextResponse.json({ success: false, message: 'Nama, Email, dan Role wajib diisi' }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail.endsWith('@mutiarabangsa.sch.id')) {
      return NextResponse.json(
        { success: false, message: 'Email harus berakhiran @mutiarabangsa.sch.id' },
        { status: 400 }
      );
    }

    const existing = await userRepo.getByEmail(trimmedEmail);
    if (existing) {
      return NextResponse.json(
        { success: false, message: 'User dengan email ini sudah terdaftar di whitelist' },
        { status: 400 }
      );
    }

    let hashedPin: string | null = null;
    if (pin) {
      if (!isValidPin(pin)) {
        return NextResponse.json(
          { success: false, message: 'PIN harus berupa 4 digit angka' },
          { status: 400 }
        );
      }
      hashedPin = hashPin(pin);
    }

    const newUser: User = {
      user_id: `USR-${Date.now()}`,
      name: name.trim(),
      email: trimmedEmail,
      role: role as any,
      penalty_status: penalty_status || 'None',
      restriction_end_date: restriction_end_date || null,
      pin: hashedPin,
    };

    await userRepo.create(newUser);
    return NextResponse.json({
      success: true,
      message: 'User Berhasil Ditambahkan ke Whitelist',
      user: { ...newUser, has_pin: Boolean(hashedPin), pin: undefined },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, name, email, role, penalty_status, restriction_end_date, new_pin, reset_pin } = body;

    if (!user_id || !name || !email || !role) {
      return NextResponse.json({ success: false, message: 'Data tidak lengkap' }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail.endsWith('@mutiarabangsa.sch.id')) {
      return NextResponse.json(
        { success: false, message: 'Email harus berakhiran @mutiarabangsa.sch.id' },
        { status: 400 }
      );
    }

    const existing = await userRepo.getById(user_id);
    let updatedPin = existing?.pin || null;

    if (reset_pin) {
      updatedPin = null;
    } else if (new_pin) {
      if (!isValidPin(new_pin)) {
        return NextResponse.json(
          { success: false, message: 'PIN baru harus berupa 4 digit angka' },
          { status: 400 }
        );
      }
      updatedPin = hashPin(new_pin);
    }

    const updatedUser: User = {
      user_id,
      name: name.trim(),
      email: trimmedEmail,
      role: role as any,
      penalty_status: penalty_status || 'None',
      restriction_end_date: restriction_end_date || null,
      pin: updatedPin,
      pin_changed: reset_pin ? 0 : new_pin ? 1 : (existing?.pin_changed ?? 0),
    };

    await userRepo.update(updatedUser);
    return NextResponse.json({
      success: true,
      message: reset_pin ? 'PIN Berhasil Direset (User perlu membuat PIN baru)' : 'Data User Berhasil Diperbarui',
      user: { ...updatedUser, has_pin: Boolean(updatedPin), pin: undefined },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, message: 'User ID diperlukan' }, { status: 400 });
    }

    await userRepo.delete(id);
    return NextResponse.json({ success: true, message: 'User Deleted Successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
