import { NextResponse, type NextRequest } from 'next/server';
import { createSignedToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { STAFF_MEMBERS } from '@/lib/constants/erp-data';
import type { UserRoleName } from '@/types/database';

export async function GET(request: NextRequest) {
  // P0 Security Guard: Disable synthetic auth cookie creation in production
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_AUTH_BYPASS) {
    return NextResponse.json(
      { success: false, error: 'Synthetic auth endpoint is disabled in production environments.' },
      { status: 403 }
    );
  }

  const role = request.nextUrl.searchParams.get('role') as UserRoleName;
  const staff = STAFF_MEMBERS.find((s) => s.role === role) || STAFF_MEMBERS[0];

  const token = await createSignedToken({
    id: staff.id,
    email: staff.email,
    name: staff.name,
    role: staff.role as UserRoleName,
  });

  const res = NextResponse.json({
    success: true,
    authenticatedUser: {
      id: staff.id,
      name: staff.name,
      role: staff.role,
      email: staff.email,
    },
  });

  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 3600,
  });

  return res;
}
