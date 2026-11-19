import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createSession } from '@/lib/auth/session';
import { STAFF_MEMBERS } from '@/lib/constants/erp-data';
import { logEnterpriseAudit } from '@/lib/audit/enterprise-logger';
import type { UserRoleName } from '@/types/database';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_oauth_code`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(`${origin}/login?error=supabase_not_configured`);
  }

  let redirectDestination = `${origin}/dashboard`;
  let response = NextResponse.redirect(redirectDestination);

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Exchange OAuth authorization code for Supabase auth tokens
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user || !data.user.email) {
    console.error('Google OAuth exchange failed:', error);
    return NextResponse.redirect(`${origin}/login?error=oauth_exchange_failed`);
  }

  const googleEmail = data.user.email.toLowerCase().trim();

  // AUTHORITATIVE WHITELIST CHECK:
  // Is this email in user_profiles or approved STAFF_MEMBERS?
  let authorizedUser: {
    id: string;
    email: string;
    name: string;
    role: UserRoleName;
    status: string;
    can_login: boolean;
  } | null = null;

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const { data: profile, error: profErr } = await admin
        .from('user_profiles')
        .select('id, full_name, email, is_active, can_login, status, roles(role_name)')
        .eq('email', googleEmail)
        .maybeSingle();

      if (profile && !profErr) {
        authorizedUser = {
          id: profile.id,
          email: profile.email,
          name: profile.full_name || googleEmail.split('@')[0],
          role: ((profile.roles as any)?.role_name || 'Sales Executive') as UserRoleName,
          status: profile.status || 'ACTIVE',
          can_login: profile.can_login !== false && profile.is_active !== false,
        };

        // If newly invited, activate upon first successful Google OAuth authentication!
        const updates: Record<string, any> = {
          last_login_at: new Date().toISOString(),
        };
        if (profile.status === 'INVITED') {
          updates.status = 'ACTIVE';
        }

        await admin.from('user_profiles').update(updates).eq('id', profile.id);
      }
    } catch (dbErr) {
      console.warn('Google auth user profile lookup warning:', dbErr);
    }
  }

  // Fallback to static staff definition (e.g. initial setup)
  if (!authorizedUser) {
    const staticStaff = STAFF_MEMBERS.find((s) => s.email.toLowerCase() === googleEmail);
    if (staticStaff) {
      authorizedUser = {
        id: staticStaff.id,
        email: staticStaff.email,
        name: staticStaff.name,
        role: staticStaff.role as UserRoleName,
        status: 'ACTIVE',
        can_login: true,
      };
    }
  }

  // STRICT WHITELIST DEFENSE:
  // Reject any Google account that has NOT been explicitly invited or provisioned by Admin.
  if (!authorizedUser) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      `${origin}/login?error=not_invited&email=${encodeURIComponent(googleEmail)}`
    );
  }

  // Reject deactivated or suspended employees immediately
  if (!authorizedUser.can_login || authorizedUser.status === 'SUSPENDED' || authorizedUser.status === 'DEACTIVATED') {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      `${origin}/login?error=account_deactivated&email=${encodeURIComponent(googleEmail)}`
    );
  }

  // Create authoritative ERP session
  await createSession({
    id: authorizedUser.id,
    email: authorizedUser.email,
    name: authorizedUser.name,
    role: authorizedUser.role,
  });

  await logEnterpriseAudit({
    employeeId: authorizedUser.id,
    userName: authorizedUser.name,
    role: authorizedUser.role,
    category: 'SECURITY_EVENT',
    severity: 'INFO',
    module: 'AUTH',
    action: 'USER_LOGGED_IN',
    recordType: 'GOOGLE_OAUTH_LOGIN',
    recordId: authorizedUser.id,
    reason: 'Google Workspace / Gmail SSO verified against corporate employee whitelist.',
    outcome: 'SUCCESS',
  });

  return response;
}
