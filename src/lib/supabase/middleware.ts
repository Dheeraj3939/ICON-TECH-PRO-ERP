import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { verifySignedToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import type { UserRoleName } from '@/types/database';

// Server-side route authorization rules (mirrors organizational access matrix)
const ROUTE_ROLE_PERMISSIONS: Array<{
  pattern: RegExp;
  roles: UserRoleName[];
}> = [
  {
    pattern: /^\/(dashboard\/settings|settings)(\/.*)?$/,
    roles: ['Managing Director', 'Admin / BDM'],
  },
  {
    pattern: /^\/dashboard\/audit(\/.*)?$/,
    roles: ['Managing Director', 'Admin / BDM', 'Accounts'],
  },
  {
    pattern: /^\/dashboard\/purchases(\/.*)?$/,
    roles: ['Managing Director', 'Admin / BDM', 'Accounts', 'BDM'],
  },
  {
    pattern: /^\/dashboard\/reports(\/.*)?$/,
    roles: ['Managing Director', 'Admin / BDM', 'Accounts', 'BDM'],
  },
  {
    pattern: /^\/dashboard\/sales-orders(\/.*)?$/,
    roles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts'],
  },
  {
    pattern: /^\/dashboard\/invoices(\/.*)?$/,
    roles: ['Managing Director', 'Admin / BDM', 'Accounts', 'BDM', 'Sales Executive'],
  },
  {
    pattern: /^\/dashboard\/rental(\/.*)?$/,
    roles: ['Managing Director', 'Admin / BDM', 'BDM', 'Accounts', 'Office Assistant'],
  },
  {
    pattern: /^\/dashboard\/(installations|site-visits|follow-ups|enquiries)(\/.*)?$/,
    roles: ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Office Assistant'],
  },
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  let user = null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createServerClient(supabaseUrl, supabaseKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      });

      const { data } = await supabase.auth.getUser();
      user = data?.user || null;
    } catch {
      // Supabase unavailable or offline
    }
  }

  // Authoritative server-verified session token check
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const verifiedUser = sessionToken ? await verifySignedToken(sessionToken) : null;

  const isAuth = !!user || !!verifiedUser;

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login');
  const isDashboardRoute =
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/customers') ||
    request.nextUrl.pathname.startsWith('/settings');

  // If unauthenticated user tries to access protected dashboard route, redirect to /login
  if (!isAuth && isDashboardRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const redirectRes = NextResponse.redirect(url);
    redirectRes.headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    );
    return redirectRes;
  }

  // If already authenticated user visits /login, redirect to /dashboard
  if (isAuth && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    const redirectRes = NextResponse.redirect(url);
    redirectRes.headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate'
    );
    return redirectRes;
  }

  // Enforce server-side role-based route authorization for authenticated sessions
  if (verifiedUser && isDashboardRoute) {
    const userRole = verifiedUser.role;
    const pathname = request.nextUrl.pathname;

    for (const rule of ROUTE_ROLE_PERMISSIONS) {
      if (rule.pattern.test(pathname) && !rule.roles.includes(userRole)) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        const forbiddenRedirect = NextResponse.redirect(url);
        forbiddenRedirect.headers.set(
          'Cache-Control',
          'no-store, no-cache, must-revalidate, proxy-revalidate'
        );
        return forbiddenRedirect;
      }
    }
  }

  supabaseResponse.headers.set(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  );
  return supabaseResponse;
}
