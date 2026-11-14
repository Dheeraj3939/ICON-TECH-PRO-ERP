import { NextResponse, type NextRequest } from 'next/server';
import { createSignedToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { STAFF_MEMBERS } from '@/lib/constants/erp-data';
import type { UserRoleName } from '@/types/database';

export async function GET(request: NextRequest) {
  // P0 Security Guard: Strictly disable synthetic auth cookie creation in UAT and production
  const isUat = process.env.NEXT_PUBLIC_ERP_ENV?.trim().toUpperCase() === 'UAT';
  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.NEXT_PUBLIC_ERP_ENV?.trim().toUpperCase() === 'PRODUCTION';

  if (isUat || isProd) {
    return NextResponse.json(
      {
        success: false,
        error: isUat
          ? 'Synthetic auth endpoint is strictly disabled in UAT. Real Supabase Auth credentials are required.'
          : 'Synthetic auth endpoint is strictly disabled in production environments.',
      },
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
