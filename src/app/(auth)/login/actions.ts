'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { STAFF_MEMBERS } from '@/lib/constants/erp-data';
import { INITIAL_MANAGED_USERS } from '@/lib/constants/rbac-data';
import { createSession, clearSession, getAuthenticatedUser } from '@/lib/auth/session';
import { verifyStaffPassword, verifyUserCredentials, generateExpiringToken } from '@/lib/auth/passwords';
import { EmailService } from '@/lib/email/email-service';
import { renderPasswordResetEmail } from '@/lib/email/auth-templates';
import { getResolvedSiteUrl } from '@/lib/utils/site-url';
import { checkRateLimit, recordRateLimitAttempt, resetRateLimit } from '@/lib/auth/rate-limiter';
import { logAuditEvent } from '@/lib/audit/logger';
import {
  checkAccountLockout,
  recordFailedLogin,
  resetFailedAttempts,
  getAccountSecurity,
} from '@/lib/security/lockout-service';
import {
  createMfaChallengeToken,
  verifyMfaAndCompleteLogin,
} from '@/lib/security/mfa-service';
import { logEnterpriseAudit } from '@/lib/audit/enterprise-logger';
import { getZohoOAuthCredentials } from '@/lib/integrations/zoho-env';
import { generateOAuthState } from '@/lib/integrations/zoho-crypto';
import type { UserRoleName } from '@/types/database';
import { redirect } from 'next/navigation';

const QUICK_ROLES = [
  {
    name: 'Bijjam Venkata Dheeraj Reddy',
    role: 'Admin',
    dept: 'IT Administration & Governance',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  },
  {
    name: 'Borra Narsimulu',
    role: 'Managing Director',
    dept: 'Executive / Leadership',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  {
    name: 'B Vineet Babu',
    role: 'Sales Executive',
    dept: 'Corporate Sales',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  },
  {
    name: 'Reshma',
    role: 'Sales Executive',
    dept: 'Sales & Client Coordination',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  {
    name: 'Hemalatha',
    role: 'Accounts',
    dept: 'Billing, Invoicing & Ledger',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  },
  {
    name: 'Manisha',
    role: 'Office Assistant',
    dept: 'Operations & Service Coordination',
    badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  },
];

function getManagedUsersStore() {
  if (!globalThis.__ICON_MANAGED_USERS__) {
    globalThis.__ICON_MANAGED_USERS__ = [...INITIAL_MANAGED_USERS];
  }
  return globalThis.__ICON_MANAGED_USERS__;
}

export async function getQuickLoginOptions() {
  if (
    process.env.NEXT_PUBLIC_ERP_ENV?.trim().toUpperCase() === 'PRODUCTION'
  ) {
    return [];
  }
  return QUICK_ROLES;
}

export async function getLoginUiConfig() {
  return {
    subtitle: 'ICON TECH PRO Operations & Commercial ERP • Hyderabad',
    emailPlaceholder: 'username@icontechpro.in',
  };
}

export async function login(formData: FormData) {
  const email = (formData.get('email') as string || '').toLowerCase().trim();
  const password = (formData.get('password') as string || '');

  if (!email || !password) {
    return { error: 'Please provide both email and password.' };
  }

  // Enterprise 3-Attempt Lockout & Suspension Guard: Check before password evaluation
  const lockoutStatus = checkAccountLockout(email);
  if (lockoutStatus.locked) {
    return {
      error:
        lockoutStatus.reason ||
        'Account is temporarily locked due to excessive failed attempts or administrative suspension.',
    };
  }

  // IP / Action Rate Limiting Check
  const rateCheck = checkRateLimit('login', email);
  if (!rateCheck.allowed) {
    return {
      error: `Too many failed login attempts. Please wait ${rateCheck.retryAfterSeconds || 60} seconds before retrying.`,
    };
  }

  const managedStore = getManagedUsersStore();
  const managedUser = managedStore.find((u) => u.email.toLowerCase() === email);
  const staticStaff = STAFF_MEMBERS.find((s) => s.email.toLowerCase() === email);
  const matchedStaff = managedUser
    ? {
        id: managedUser.id,
        email: managedUser.email,
        name: managedUser.name,
        role: managedUser.role as UserRoleName,
      }
    : staticStaff;

  if (process.env.NEXT_PUBLIC_ERP_ENV?.trim().toUpperCase() === 'UAT') {
    let authenticatedUser: { id: string; email?: string | null } | null = null;
    let uatProfile: any = null;
    let profileLoadFailed = false;

    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data.user) {
        authenticatedUser = data.user;
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, full_name, is_active, can_login, status, roles(role_name)')
          .eq('id', data.user.id)
          .maybeSingle();
        uatProfile = profile;
        profileLoadFailed = Boolean(profileError);
        if (profileLoadFailed) await supabase.auth.signOut();
      }
    } catch {
      // Supabase network/auth error
    }

    const uatRole = (uatProfile?.roles as any)?.role_name;
    const allowedUatRoles = [
      'Managing Director',
      'Admin',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
      'Accounts',
      'Office Assistant',
    ];
    if (
      authenticatedUser &&
      !profileLoadFailed &&
      uatProfile &&
      uatProfile.id === authenticatedUser.id &&
      uatProfile.status === 'ACTIVE' &&
      uatProfile.can_login === true &&
      uatProfile.is_active === true &&
      allowedUatRoles.includes(uatRole)
    ) {
      const sec = getAccountSecurity(email);
      if (sec.mfa_enabled && sec.mfa_secret) {
        return {
          mfaRequired: true,
          tempToken: createMfaChallengeToken(authenticatedUser.id, email),
          user: { name: uatProfile.full_name || email.split('@')[0], role: uatRole as UserRoleName },
        };
      }

      resetFailedAttempts(email);
      resetRateLimit('login', email);
      await createSession({
        id: authenticatedUser.id,
        email: authenticatedUser.email || email,
        name: uatProfile.full_name || email.split('@')[0],
        role: uatRole as UserRoleName,
      });
      redirect('/dashboard');
    }

    // Authoritative database-first credential check (managed_user_credentials + user_profiles)
    const isOnlineUat = await isSupabaseAvailable();
    let dbProfile: any = null;
    if (isOnlineUat) {
      try {
        const admin = createAdminClient();
        const { data: prof } = await admin
          .from('user_profiles')
          .select('id, full_name, email, is_active, can_login, status, roles(role_name)')
          .eq('email', email)
          .maybeSingle();
        dbProfile = prof;
      } catch {}
    }

    const uatStaffCandidate = dbProfile
      ? {
          id: dbProfile.id,
          email: dbProfile.email,
          name: dbProfile.full_name || email.split('@')[0],
          role: ((dbProfile.roles as any)?.role_name || 'Sales Executive') as UserRoleName,
          status: dbProfile.status || 'ACTIVE',
          can_login: dbProfile.can_login !== false && dbProfile.is_active !== false,
        }
      : matchedStaff && !isOnlineUat
        ? {
            ...matchedStaff,
            status: managedUser?.status || 'ACTIVE',
            can_login: managedUser ? managedUser.can_login : true,
          }
        : null;

    const credResult = uatStaffCandidate ? await verifyUserCredentials(email, password) : { valid: false };
    if (uatStaffCandidate && credResult.valid) {
      if (uatStaffCandidate.status !== 'ACTIVE' || !uatStaffCandidate.can_login) {
        recordRateLimitAttempt('login', email);
        return {
          error: 'Your account access has been deactivated, invited only, or suspended. Please contact your system administrator.',
        };
      }

      const sec = getAccountSecurity(email);
      if (sec.mfa_enabled && sec.mfa_secret) {
        return {
          mfaRequired: true,
          tempToken: createMfaChallengeToken(uatStaffCandidate.id, email),
          user: { name: uatStaffCandidate.name, role: uatStaffCandidate.role },
        };
      }

      resetFailedAttempts(email);
      resetRateLimit('login', email);
      await createSession({
        id: uatStaffCandidate.id,
        email: uatStaffCandidate.email,
        name: uatStaffCandidate.name,
        role: uatStaffCandidate.role,
      });
      redirect('/dashboard');
    }

    recordRateLimitAttempt('login', email);
    const failRes = await recordFailedLogin(email);
    return { error: failRes.message };
  }

  // 1. If Supabase is available, attempt real database authentication
  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const supabase = await createClient();
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!authError && authData.user) {
        // Fetch authoritative profile & role from user_profiles table
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, full_name, is_active, can_login, status, roles(role_name)')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (profile && (profile.status !== 'ACTIVE' || profile.can_login === false || profile.is_active === false)) {
          recordRateLimitAttempt('login', email);
          return {
            error: 'Your account access has been deactivated or suspended. Please contact your system administrator.',
          };
        }

        const resolvedRole: UserRoleName =
          (profile?.roles as any)?.role_name || 'Sales Executive';
        const resolvedName = profile?.full_name || email.split('@')[0];

        const sec = getAccountSecurity(email);
        if (sec.mfa_enabled && sec.mfa_secret) {
          return {
            mfaRequired: true,
            tempToken: createMfaChallengeToken(authData.user.id, email),
            user: { name: resolvedName, role: resolvedRole },
          };
        }

        resetFailedAttempts(email);
        resetRateLimit('login', email);
        await createSession({
          id: authData.user.id,
          email: authData.user.email || email,
          name: resolvedName,
          role: resolvedRole,
        });

        await logEnterpriseAudit({
          employeeId: authData.user.id,
          userName: resolvedName,
          role: resolvedRole,
          category: 'SECURITY_EVENT',
          severity: 'INFO',
          module: 'AUTH',
          action: 'USER_LOGGED_IN',
          recordType: 'USER_LOGIN',
          recordId: authData.user.id,
          reason: 'Supabase Auth session created.',
          outcome: 'SUCCESS',
        });

        redirect('/dashboard');
      }
    } catch (err) {
      console.warn('Supabase Auth error:', err);
    }
  }

  // 2. DATABASE-FIRST AUTHORITATIVE AUTHENTICATION FOR MANAGED USERS:
  // Queries public.managed_user_credentials directly in Supabase.
  const credCheck = await verifyUserCredentials(email, password);

  if (credCheck.matched) {
    if (!credCheck.valid) {
      recordRateLimitAttempt('login', email);
      const failRes = await recordFailedLogin(email);
      return { error: failRes.message };
    }

    // Determine authoritative role and name from user_profiles or store
    let resolvedRole: UserRoleName = 'Sales Executive';
    let resolvedName = email.split('@')[0];
    let resolvedId = `USR-${email}`;

    if (isOnline) {
      try {
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const admin = createAdminClient();
        const { data: profile } = await admin
          .from('user_profiles')
          .select('id, full_name, is_active, can_login, status, roles(role_name)')
          .eq('email', email)
          .maybeSingle();

        if (profile) {
          if (profile.status !== 'ACTIVE' || profile.can_login === false || profile.is_active === false) {
            recordRateLimitAttempt('login', email);
            return {
              error: 'Your account access has been deactivated or suspended. Please contact your system administrator.',
            };
          }
          resolvedRole = (profile.roles as any)?.role_name || (managedUser?.role as UserRoleName) || 'Sales Executive';
          resolvedName = profile.full_name || managedUser?.name || resolvedName;
          resolvedId = profile.id;
        }
      } catch (err) {
        console.warn('Profile lookup warning:', err);
      }
    }

    if (managedUser) {
      if (managedUser.status !== 'ACTIVE' || !managedUser.can_login) {
        recordRateLimitAttempt('login', email);
        return {
          error: 'Your account access has been deactivated or suspended. Please contact your system administrator.',
        };
      }
      resolvedRole = (managedUser.role as UserRoleName) || resolvedRole;
      resolvedName = managedUser.name || resolvedName;
      resolvedId = managedUser.id || resolvedId;
    } else if (matchedStaff) {
      resolvedRole = matchedStaff.role;
      resolvedName = matchedStaff.name;
      resolvedId = matchedStaff.id;
    }

    const sec = getAccountSecurity(email);
    if (sec.mfa_enabled && sec.mfa_secret) {
      return {
        mfaRequired: true,
        tempToken: createMfaChallengeToken(resolvedId, email),
        user: { name: resolvedName, role: resolvedRole },
      };
    }

    resetFailedAttempts(email);
    resetRateLimit('login', email);
    await createSession({
      id: resolvedId,
      email,
      name: resolvedName,
      role: resolvedRole,
    });

    await logEnterpriseAudit({
      employeeId: resolvedId,
      userName: resolvedName,
      role: resolvedRole,
      category: 'SECURITY_EVENT',
      severity: 'INFO',
      module: 'AUTH',
      action: 'USER_LOGGED_IN',
      recordType: 'USER_LOGIN',
      recordId: resolvedId,
      reason: 'Verified managed credentials login.',
      outcome: 'SUCCESS',
    });

    redirect('/dashboard');
  }

  // Password incorrect or user not matched -> record failed login and enforce 3-attempt lockout
  recordRateLimitAttempt('login', email);
  const failRes = await recordFailedLogin(email);
  return { error: failRes.message };
}

/**
 * Server action to verify MFA (TOTP or backup code) and complete login.
 */
export async function verifyMfaLoginAction(
  tempToken: string,
  code: string,
  user: { name: string; role: UserRoleName }
): Promise<{ success: boolean; error?: string }> {
  const result = await verifyMfaAndCompleteLogin(tempToken, code, user);
  if (result.success) {
    redirect('/dashboard');
  }
  return result;
}

/**
 * 1-Click Role Login for development / LAN / UAT testing:
 * Strictly blocked in Production.
 */
export async function quickLoginAsRole(name: string, role: string) {
  if (
    process.env.NEXT_PUBLIC_ERP_ENV?.trim().toUpperCase() === 'PRODUCTION'
  ) {
    throw new Error('Quick role sign-in is strictly prohibited in production. Please sign in with email and password.');
  }

  const validStaff = STAFF_MEMBERS.find(
    (s) => (s.role === role || (role === 'Admin' && s.role === 'Admin / BDM')) && (s.name.toLowerCase() === name.toLowerCase() || !name)
  ) || STAFF_MEMBERS.find((s) => s.role === role) || STAFF_MEMBERS[0];

  await createSession({
    id: validStaff.id,
    email: validStaff.email,
    name: validStaff.name,
    role: (role === 'Admin' ? 'Admin' : validStaff.role) as UserRoleName,
  });

  redirect('/dashboard');
}

export async function logout() {
  const currentUser = await getAuthenticatedUser();
  await clearSession();
  try {
    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      const supabase = await createClient();
      await supabase.auth.signOut();
    }
  } catch {}

  if (currentUser) {
    await logAuditEvent({
      userName: currentUser.name,
      action: 'USER_LOGGED_OUT',
      module: 'AUTH',
      details: `User logged out: ${currentUser.email}`,
    });
  }

  redirect('/login');
}

/**
 * Universal ERP Password Reset Request.
 * Works for ANY valid email domain without requiring a Supabase auth.users record.
 * Routes strictly through ERP EmailService and maintains strict anti-enumeration defense.
 */
export async function requestPasswordReset(
  formData: FormData | { email?: string } | string
): Promise<{ success: boolean; message: string; error?: string }> {
  let email = '';
  if (typeof formData === 'string') {
    email = formData.toLowerCase().trim();
  } else if (formData && typeof (formData as any).get === 'function') {
    email = (
      ((formData as FormData).get('email') as string) ||
      ((formData as FormData).get('1_email') as string) ||
      ''
    ).toLowerCase().trim();

    if (!email && typeof (formData as any).entries === 'function') {
      for (const [, val] of (formData as any).entries()) {
        if (typeof val === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
          email = val.toLowerCase().trim();
          break;
        }
      }
    }
  } else if (formData && typeof formData === 'object' && 'email' in formData) {
    email = String((formData as any).email || '').toLowerCase().trim();
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, message: '', error: 'Please enter a valid email address.' };
  }

  const rateCheck = checkRateLimit('reset', email);
  if (!rateCheck.allowed) {
    return {
      success: false,
      message: '',
      error: `Too many password reset requests. Please wait ${rateCheck.retryAfterSeconds || 60} seconds before requesting another link.`,
    };
  }
  recordRateLimitAttempt('reset', email);

  console.log(`[AUTH_DIAGNOSTIC] RESET_EMAIL_REQUESTED: recipient=${email}, timestamp=${new Date().toISOString()}`);

  try {
    const managedStore = getManagedUsersStore();
    const managedUser = managedStore.find((u) => u.email.toLowerCase() === email);
    const staticStaff = STAFF_MEMBERS.find((s) => s.email.toLowerCase() === email);
    let target: { id?: string; email: string; name?: string } | undefined = managedUser || staticStaff;

    // Check DB user_profiles and managed_user_credentials if reachable
    let isUserBlocked = false;
    let dbTargetName: string | undefined;
    let dbTargetId: string | undefined;

    if (await isSupabaseAvailable()) {
      try {
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const admin = createAdminClient();
        const { data: profile } = await admin
          .from('user_profiles')
          .select('id, full_name, is_active, can_login, status')
          .eq('email', email)
          .maybeSingle();

        if (profile) {
          dbTargetName = profile.full_name;
          dbTargetId = profile.id;
          if (profile.status !== 'ACTIVE' || profile.can_login === false || profile.is_active === false) {
            isUserBlocked = true;
          }
          if (!target) {
            target = {
              id: profile.id,
              name: profile.full_name,
              email: email,
            };
          }
        }

        const { data: cred } = await admin
          .from('managed_user_credentials')
          .select('id, user_id, email, erp_login_email, is_active, status')
          .or(`erp_login_email.eq.${email},email.eq.${email}`)
          .maybeSingle();

        if (cred) {
          if (cred.is_active === false || cred.status === 'DEACTIVATED' || cred.status === 'SUSPENDED' || cred.status === 'DISABLED') {
            isUserBlocked = true;
          }
          if (!target) {
            target = {
              id: cred.user_id,
              name: dbTargetName || email.split('@')[0],
              email: cred.erp_login_email || cred.email,
            };
          }
        }
      } catch {}
    }

    // Note: Universal ERP EmailService handles token dispatch; Supabase auth resetPasswordForEmail is superseded by DB-authoritative managed_user_credentials
    if (target) {
      const isDeactivated =
        isUserBlocked ||
        (managedUser &&
          (managedUser.status === 'DEACTIVATED' ||
            managedUser.status === 'SUSPENDED' ||
            managedUser.status === 'DISABLED' ||
            managedUser.status === 'OFFBOARDED' ||
            !managedUser.can_login));

      if (!isDeactivated) {
        // Generate secure 15-minute single-use ERP password reset token
        const token = generateExpiringToken(
          {
            email: target.email,
            userId: target.id || dbTargetId,
            type: 'reset',
          },
          15 * 60 * 1000 // 15-minute expiration
        );

        console.log(`[AUTH_DIAGNOSTIC] RESET_TOKEN_CREATED: userId=${target.id || dbTargetId || 'N/A'}, recipient=${target.email}, timestamp=${new Date().toISOString()}`);

        const siteUrl = await getResolvedSiteUrl();
        const resetUrl = `${siteUrl}/reset-password?token=${token}&type=reset`;

        const template = renderPasswordResetEmail({
          name: target.name || dbTargetName || email.split('@')[0],
          email: target.email,
          resetUrl,
          expiresHours: 0.25, // 15 minutes
        });

        console.log(`[AUTH_DIAGNOSTIC] RESET_EMAIL_SEND_STARTED: userId=${target.id || dbTargetId || 'N/A'}, recipient=${target.email}, provider=${EmailService.getProvider().name}, timestamp=${new Date().toISOString()}`);

        const sendResult = await EmailService.sendEmail({
          to: target.email,
          subject: template.subject,
          text: template.text,
          html: template.html,
          metadata: {
            entityType: 'general',
            userId: target.id || dbTargetId,
            userName: target.name || dbTargetName,
          },
        });

        if (sendResult.success) {
          console.log(`[AUTH_DIAGNOSTIC] RESET_EMAIL_SEND_SUCCESS: userId=${target.id || dbTargetId || 'N/A'}, recipient=${target.email}, provider=${sendResult.provider}, messageId=${sendResult.messageId || 'N/A'}, timestamp=${new Date().toISOString()}`);
          await logAuditEvent({
            userName: target.name || dbTargetName || email,
            action: 'PASSWORD_RESET_DISPATCHED',
            module: 'SECURITY',
            details: `Password reset token dispatched to ${target.email} via EmailService (${sendResult.provider})`,
          });
        } else {
          console.error(`[AUTH_DIAGNOSTIC] RESET_EMAIL_SEND_FAILED: userId=${target.id || dbTargetId || 'N/A'}, recipient=${target.email}, provider=${sendResult.provider}, error=${sendResult.error || 'Unknown error'}, timestamp=${new Date().toISOString()}`);
          await logAuditEvent({
            userName: target.name || dbTargetName || email,
            action: 'PASSWORD_RESET_FAILED',
            module: 'SECURITY',
            details: `Failed to dispatch reset email to ${target.email} via ${sendResult.provider}: ${sendResult.error || 'Unknown error'}`,
          });
        }
      }
    }
  } catch (err: any) {
    console.warn('[AUTH_DIAGNOSTIC] Reset action error:', err?.message || 'Unknown error');
  }

  // Consistent message to prevent user enumeration attacks
  return {
    success: true,
    message: 'If an authorized corporate account exists for this email address, password reset instructions have been dispatched.',
  };
}

/**
 * Initiates Zoho Mail OAuth 2.0 flow for staff single sign-on.
 */
export async function initiateZohoLoginAction(origin?: string): Promise<{ url?: string; error?: string }> {
  try {
    const creds = getZohoOAuthCredentials();
    if (!creds.hasClientId || !creds.clientId) {
      return { error: 'Zoho OAuth is not configured on this server. Please sign in with your email and password.' };
    }

    const state = generateOAuthState('USER_LOGIN');
    const forwardedOrigin = (origin || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const cleanHost = forwardedOrigin.replace(/^https?:\/\//, '').split('/')[0];
    const isKnownCloudHost = /^(uat\.icontechpro\.in|erp\.icontechpro\.in|icon-erp-uat-web-production\.up\.railway\.app)$/i.test(cleanHost);
    const redirectUri = isKnownCloudHost
      ? `https://${cleanHost}/api/integrations/zoho/callback`
      : creds.redirectUri;

    const authUrl = new URL(`${creds.accountsUrl}/oauth/v2/auth`);
    authUrl.searchParams.set('client_id', creds.clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('access_type', 'online');
    authUrl.searchParams.set('scope', 'AaaServer.profile.READ,ZohoCRM.users.READ');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('prompt', 'consent');

    return { url: authUrl.toString() };
  } catch (err: any) {
    return { error: err?.message || 'Failed to initiate Zoho sign-in.' };
  }
}
