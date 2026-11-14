/**
 * ICON TECH PRO ERP V9.2 — Account Lockout & Security Engine
 * Enforces 3-attempt lockout policy:
 * - 1st attempt: Failure recorded, warning returned
 * - 2nd attempt: Failure recorded, warning returned ("1 attempt remaining")
 * - 3rd attempt: 15-minute temporary lockout
 * - Progressive lockouts for repeated failures (15m -> 30m -> 60m)
 * - Administrative unlock & suspension controls
 * - IP rate limiting and anti-enumeration generic messaging
 */

import type { AccountSecurityRecord, UserSecurityOverviewItem } from '@/types/security';
import { logEnterpriseAudit } from '@/lib/audit/enterprise-logger';
import { invalidateUserSessions } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { STAFF_MEMBERS } from '@/lib/constants/erp-data';
import { INITIAL_MANAGED_USERS } from '@/lib/constants/rbac-data';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_ACCOUNT_SECURITY__: Record<string, AccountSecurityRecord> | undefined;
  // eslint-disable-next-line no-var
  var __ICON_IP_RATE_LIMITS__: Record<string, { count: number; firstAttemptAt: number }> | undefined;
}

function initializeAccountSecurity(): Record<string, AccountSecurityRecord> {
  const store: Record<string, AccountSecurityRecord> = {};
  const now = new Date().toISOString();

  // Seed default official accounts
  for (const user of INITIAL_MANAGED_USERS) {
    const emailKey = user.email.toLowerCase().trim();
    store[emailKey] = {
      user_id: user.id,
      email: user.email,
      failed_password_attempts: 0,
      last_failed_attempt_at: null,
      is_locked: false,
      locked_until: null,
      lockout_count_24h: 0,
      last_lockout_at: null,
      mfa_enabled: false,
      mfa_secret: null,
      mfa_enrolled_at: null,
      backup_codes: [],
      is_suspended: user.status === 'SUSPENDED' || user.can_login === false,
      suspension_reason: user.status === 'SUSPENDED' ? 'Initial administrative suspension' : null,
      suspended_at: null,
      suspended_by: null,
      force_password_reset: false,
      created_at: now,
      updated_at: now,
    };
  }

  return store;
}

export function getAccountSecurityStore(): Record<string, AccountSecurityRecord> {
  if (!globalThis.__ICON_ACCOUNT_SECURITY__) {
    globalThis.__ICON_ACCOUNT_SECURITY__ = initializeAccountSecurity();
  }
  return globalThis.__ICON_ACCOUNT_SECURITY__;
}

export async function persistAccountSecurityToDb(record: AccountSecurityRecord): Promise<void> {
  if (!(await isSupabaseAvailable())) return;
  try {
    const admin = createAdminClient();
    await admin.from('account_security_records').upsert(
      {
        user_id: record.user_id,
        email: record.email.toLowerCase().trim(),
        failed_password_attempts: record.failed_password_attempts,
        last_failed_attempt_at: record.last_failed_attempt_at,
        is_locked: record.is_locked,
        locked_until: record.locked_until,
        lockout_count_24h: record.lockout_count_24h,
        last_lockout_at: record.last_lockout_at,
        mfa_enabled: record.mfa_enabled,
        mfa_secret: record.mfa_secret,
        mfa_enrolled_at: record.mfa_enrolled_at,
        backup_codes: record.backup_codes || [],
        is_suspended: record.is_suspended,
        suspension_reason: record.suspension_reason,
        suspended_at: record.suspended_at,
        suspended_by: record.suspended_by,
        force_password_reset: record.force_password_reset,
        updated_at: record.updated_at || new Date().toISOString(),
      },
      { onConflict: 'email' }
    );
  } catch (err) {
    console.warn('Supabase persistAccountSecurityToDb fallback:', err);
  }
}

export async function syncAccountSecurityFromDb(emailOrId: string): Promise<AccountSecurityRecord> {
  const store = getAccountSecurityStore();
  const searchKey = (emailOrId || '').toLowerCase().trim();

  if (searchKey && (await isSupabaseAvailable())) {
    try {
      const admin = createAdminClient();
      const { data: row } = await admin
        .from('account_security_records')
        .select('*')
        .or(`email.eq.${searchKey},user_id.eq.${emailOrId}`)
        .maybeSingle();

      if (row) {
        const synced = row as AccountSecurityRecord;
        store[synced.email.toLowerCase().trim()] = synced;
        return synced;
      }
    } catch {
      // Fallback to in-memory
    }
  }

  return getAccountSecurity(emailOrId);
}

export function getAccountSecurity(emailOrId: string): AccountSecurityRecord {
  const store = getAccountSecurityStore();
  const searchKey = (emailOrId || '').toLowerCase().trim();

  // Search by email directly
  if (store[searchKey]) {
    return store[searchKey];
  }

  // Search by user_id
  for (const key of Object.keys(store)) {
    if (store[key].user_id === emailOrId) {
      return store[key];
    }
  }

  // If not found, provision dynamically
  const now = new Date().toISOString();
  const newRecord: AccountSecurityRecord = {
    user_id: `USR-${searchKey.replace(/[^a-z0-9]/g, '-')}`,
    email: searchKey,
    failed_password_attempts: 0,
    last_failed_attempt_at: null,
    is_locked: false,
    locked_until: null,
    lockout_count_24h: 0,
    last_lockout_at: null,
    mfa_enabled: false,
    mfa_secret: null,
    mfa_enrolled_at: null,
    backup_codes: [],
    is_suspended: false,
    suspension_reason: null,
    suspended_at: null,
    suspended_by: null,
    force_password_reset: false,
    created_at: now,
    updated_at: now,
  };
  store[searchKey] = newRecord;
  return newRecord;
}

/**
 * Check if the client IP has exceeded the threshold of failed attempts (anti-distributed brute force).
 */
export function checkIpRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  if (!ip || ip === '127.0.0.1' || ip === '::1') return { allowed: true };

  if (!globalThis.__ICON_IP_RATE_LIMITS__) {
    globalThis.__ICON_IP_RATE_LIMITS__ = {};
  }

  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttemptsPerIp = 20;

  const record = globalThis.__ICON_IP_RATE_LIMITS__[ip];
  if (!record || now - record.firstAttemptAt > windowMs) {
    globalThis.__ICON_IP_RATE_LIMITS__[ip] = { count: 1, firstAttemptAt: now };
    return { allowed: true };
  }

  if (record.count >= maxAttemptsPerIp) {
    const retryAfterMs = windowMs - (now - record.firstAttemptAt);
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  record.count += 1;
  return { allowed: true };
}

/**
 * Checks whether an account is currently locked or suspended.
 * If temporary lockout has expired, automatically clears the lockout.
 */
export function checkAccountLockout(email: string): {
  locked: boolean;
  isSuspended: boolean;
  reason?: string;
  retryAfterSeconds?: number;
} {
  const record = getAccountSecurity(email);

  if (record.is_suspended) {
    return {
      locked: true,
      isSuspended: true,
      reason: 'Your account access has been administratively suspended. Please contact your system administrator.',
    };
  }

  if (record.is_locked) {
    if (record.locked_until) {
      const now = Date.now();
      const expiresAt = Date.parse(record.locked_until);
      const remainingMs = expiresAt - now;

      if (remainingMs > 0) {
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        return {
          locked: true,
          isSuspended: false,
          retryAfterSeconds: remainingSeconds,
          reason: `Account temporarily locked due to 3 consecutive failed login attempts. Please wait ${Math.ceil(
            remainingSeconds / 60
          )} minute(s) before retrying or contact an administrator.`,
        };
      }
    }

    // Temporary lockout has expired -> auto-unlock
    record.is_locked = false;
    record.locked_until = null;
    record.failed_password_attempts = 0;
    record.updated_at = new Date().toISOString();
  }

  return { locked: false, isSuspended: false };
}

/**
 * Record a failed password attempt and enforce the 3-attempt lockout rule.
 */
export async function recordFailedLogin(
  email: string,
  ip: string = '127.0.0.1',
  userAgent: string = 'Browser'
): Promise<{
  locked: boolean;
  attempts: number;
  remainingAttempts: number;
  retryAfterSeconds?: number;
  message: string;
}> {
  const record = await syncAccountSecurityFromDb(email);
  const now = new Date();
  const nowIso = now.toISOString();

  // If already locked, return current state
  const currentCheck = checkAccountLockout(email);
  if (currentCheck.locked) {
    return {
      locked: true,
      attempts: record.failed_password_attempts,
      remainingAttempts: 0,
      retryAfterSeconds: currentCheck.retryAfterSeconds,
      message: currentCheck.reason || 'Account is currently locked.',
    };
  }

  record.failed_password_attempts += 1;
  record.last_failed_attempt_at = nowIso;
  record.updated_at = nowIso;

  // 1st failed attempt
  if (record.failed_password_attempts === 1) {
    await persistAccountSecurityToDb(record);
    await logEnterpriseAudit({
      employeeId: record.user_id,
      userName: record.email,
      role: 'Unknown',
      category: 'SECURITY_EVENT',
      severity: 'WARNING',
      module: 'AUTH',
      action: 'SECURITY_LOGIN_FAILURE',
      recordType: 'USER_LOGIN',
      recordId: record.user_id,
      reason: 'Password authentication failed (Attempt 1 of 3)',
      outcome: 'FAILURE',
      sourceIp: ip,
      deviceBrowser: userAgent,
    });

    return {
      locked: false,
      attempts: 1,
      remainingAttempts: 2,
      message: 'Invalid email or password. Attempt 1 of 3 failed. Account will be locked after 3 failed attempts.',
    };
  }

  // 2nd failed attempt
  if (record.failed_password_attempts === 2) {
    await persistAccountSecurityToDb(record);
    await logEnterpriseAudit({
      employeeId: record.user_id,
      userName: record.email,
      role: 'Unknown',
      category: 'SECURITY_EVENT',
      severity: 'WARNING',
      module: 'AUTH',
      action: 'SECURITY_LOGIN_FAILURE',
      recordType: 'USER_LOGIN',
      recordId: record.user_id,
      reason: 'Password authentication failed (Attempt 2 of 3)',
      outcome: 'FAILURE',
      sourceIp: ip,
      deviceBrowser: userAgent,
    });

    return {
      locked: false,
      attempts: 2,
      remainingAttempts: 1,
      message: 'Invalid email or password. Attempt 2 of 3 failed. Warning: 1 attempt remaining before temporary account lockout.',
    };
  }

  // 3rd or greater consecutive failed attempt -> TRIGGER LOCKOUT
  const isWithin24h =
    record.last_lockout_at &&
    Date.now() - Date.parse(record.last_lockout_at) < 24 * 60 * 60 * 1000;

  if (isWithin24h) {
    record.lockout_count_24h += 1;
  } else {
    record.lockout_count_24h = 1;
  }

  // Progressive duration: policy updated to 30 minutes (formerly lockoutDurationMinutes = 15; now 1st lockoutDurationMinutes = 30; progressive ladder: 2nd lockoutDurationMinutes = 60; 3rd+ = 120)
  let lockoutDurationMinutes = 30;
  if (record.lockout_count_24h === 2) {
    lockoutDurationMinutes = 60;
  } else if (record.lockout_count_24h >= 3) {
    lockoutDurationMinutes = 120;
  }

  const durationMs = lockoutDurationMinutes * 60 * 1000;
  record.is_locked = true;
  record.locked_until = new Date(Date.now() + durationMs).toISOString();
  record.last_lockout_at = nowIso;
  record.updated_at = nowIso;
  await persistAccountSecurityToDb(record);

  // Log critical security lockout event
  await logEnterpriseAudit({
    employeeId: record.user_id,
    userName: record.email,
    role: 'Unknown',
    category: 'SECURITY_EVENT',
    severity: 'CRITICAL',
    module: 'AUTH',
    action: 'SECURITY_ACCOUNT_LOCKOUT',
    recordType: 'USER_SECURITY',
    recordId: record.user_id,
    reason: `Account locked for ${lockoutDurationMinutes} minutes due to 3 consecutive failed password attempts (24h lockout count: ${record.lockout_count_24h}).`,
    outcome: 'BLOCKED',
    sourceIp: ip,
    deviceBrowser: userAgent,
  });

  return {
    locked: true,
    attempts: record.failed_password_attempts,
    remainingAttempts: 0,
    retryAfterSeconds: lockoutDurationMinutes * 60,
    message: `Account temporarily locked due to 3 consecutive failed login attempts. Please wait ${lockoutDurationMinutes} minutes before retrying or contact your system administrator.`,
  };
}

/**
 * Resets failed attempts counter upon successful authentication (password + MFA if enabled).
 */
export function resetFailedAttempts(email: string): void {
  const record = getAccountSecurity(email);
  record.failed_password_attempts = 0;
  record.is_locked = false;
  record.locked_until = null;
  record.updated_at = new Date().toISOString();
  void persistAccountSecurityToDb(record);
}

/**
 * Administrator unlocks a temporarily locked account.
 * Requires minimum 5-character reason. Self-unlock is strictly forbidden.
 */
export async function adminUnlockAccount(
  targetUserId: string,
  reason: string,
  actor: { id: string; name: string; role: string }
): Promise<{ success: boolean; error?: string }> {
  const cleanReason = (reason || '').trim();
  if (cleanReason.length < 5) {
    return { success: false, error: 'A valid business justification (minimum 5 characters) is mandatory.' };
  }

  const record = await syncAccountSecurityFromDb(targetUserId);
  if (!record) {
    return { success: false, error: 'Target account security record not found.' };
  }

  // Prevent self-unlock
  if (actor.id === record.user_id || actor.name.toLowerCase() === record.email.toLowerCase()) {
    return {
      success: false,
      error: 'Self-unlock is prohibited by enterprise security policy. Another administrator must review and unlock this account.',
    };
  }

  record.is_locked = false;
  record.locked_until = null;
  record.failed_password_attempts = 0;
  record.updated_at = new Date().toISOString();
  await persistAccountSecurityToDb(record);

  await logEnterpriseAudit({
    employeeId: actor.id,
    userName: actor.name,
    role: actor.role,
    category: 'SECURITY_EVENT',
    severity: 'SECURITY',
    module: 'SECURITY_CONTROLS',
    action: 'SECURITY_ACCOUNT_UNLOCKED',
    recordType: 'USER_SECURITY',
    recordId: record.user_id,
    relatedContext: `Target account: ${record.email}`,
    reason: cleanReason,
    outcome: 'SUCCESS',
  });

  return { success: true };
}

/**
 * Administrator suspends an employee account.
 * Distinct from temporary lockout: suspension persists indefinitely until admin reactivates.
 */
export async function adminSuspendAccount(
  targetUserId: string,
  reason: string,
  actor: { id: string; name: string; role: string }
): Promise<{ success: boolean; error?: string }> {
  const cleanReason = (reason || '').trim();
  if (cleanReason.length < 5) {
    return { success: false, error: 'A valid business justification (minimum 5 characters) is mandatory.' };
  }

  const record = await syncAccountSecurityFromDb(targetUserId);
  if (!record) {
    return { success: false, error: 'Target account security record not found.' };
  }

  // MD accounts can only be suspended by MD
  if (record.email === 'borra@icontechpro.in' && actor.role !== 'Managing Director') {
    return { success: false, error: 'Managing Director accounts can only be modified by the Managing Director.' };
  }

  record.is_suspended = true;
  record.suspension_reason = cleanReason;
  record.suspended_at = new Date().toISOString();
  record.suspended_by = actor.name;
  record.updated_at = new Date().toISOString();
  await persistAccountSecurityToDb(record);
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      await admin
        .from('user_profiles')
        .update({ is_active: false, updated_at: record.updated_at })
        .eq('email', record.email);
    } catch {
      // Optional sync
    }
  }

  // Invalidate any active sessions
  invalidateUserSessions(record.user_id);

  // Sync with managed users store
  if (globalThis.__ICON_MANAGED_USERS__) {
    const u = globalThis.__ICON_MANAGED_USERS__.find(
      (m) => m.id === record.user_id || m.email.toLowerCase() === record.email.toLowerCase()
    );
    if (u) {
      u.can_login = false;
      u.status = 'SUSPENDED';
    }
  }

  await logEnterpriseAudit({
    employeeId: actor.id,
    userName: actor.name,
    role: actor.role,
    category: 'SECURITY_EVENT',
    severity: 'CRITICAL',
    module: 'SECURITY_CONTROLS',
    action: 'SECURITY_ACCOUNT_SUSPENDED',
    recordType: 'USER_SECURITY',
    recordId: record.user_id,
    relatedContext: `Target account: ${record.email}`,
    reason: cleanReason,
    outcome: 'SUCCESS',
  });

  return { success: true };
}

/**
 * Administrator reactivates a suspended employee account.
 */
export async function adminReactivateAccount(
  targetUserId: string,
  reason: string,
  actor: { id: string; name: string; role: string }
): Promise<{ success: boolean; error?: string }> {
  const cleanReason = (reason || '').trim();
  if (cleanReason.length < 5) {
    return { success: false, error: 'A valid business justification (minimum 5 characters) is mandatory.' };
  }

  const record = await syncAccountSecurityFromDb(targetUserId);
  if (!record) {
    return { success: false, error: 'Target account security record not found.' };
  }

  // Prevent self-reactivation
  if (actor.id === record.user_id || actor.name.toLowerCase() === record.email.toLowerCase()) {
    return {
      success: false,
      error: 'Self-reactivation is prohibited by enterprise security policy. Another administrator must reactivate this account.',
    };
  }

  record.is_suspended = false;
  record.suspension_reason = null;
  record.suspended_at = null;
  record.suspended_by = null;
  record.updated_at = new Date().toISOString();
  await persistAccountSecurityToDb(record);
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      await admin
        .from('user_profiles')
        .update({ is_active: true, updated_at: record.updated_at })
        .eq('email', record.email);
    } catch {
      // Optional sync
    }
  }

  // Sync with managed users store
  if (globalThis.__ICON_MANAGED_USERS__) {
    const u = globalThis.__ICON_MANAGED_USERS__.find(
      (m) => m.id === record.user_id || m.email.toLowerCase() === record.email.toLowerCase()
    );
    if (u) {
      u.can_login = true;
      u.status = 'ACTIVE';
    }
  }

  await logEnterpriseAudit({
    employeeId: actor.id,
    userName: actor.name,
    role: actor.role,
    category: 'SECURITY_EVENT',
    severity: 'SECURITY',
    module: 'SECURITY_CONTROLS',
    action: 'SECURITY_ACCOUNT_REACTIVATED',
    recordType: 'USER_SECURITY',
    recordId: record.user_id,
    relatedContext: `Target account: ${record.email}`,
    reason: cleanReason,
    outcome: 'SUCCESS',
  });

  return { success: true };
}

/**
 * Administrator forces password reset for an account.
 */
export async function adminForcePasswordReset(
  targetUserId: string,
  reason: string,
  actor: { id: string; name: string; role: string }
): Promise<{ success: boolean; error?: string }> {
  const cleanReason = (reason || '').trim();
  if (cleanReason.length < 5) {
    return { success: false, error: 'A valid business justification (minimum 5 characters) is mandatory.' };
  }

  const record = await syncAccountSecurityFromDb(targetUserId);
  if (!record) {
    return { success: false, error: 'Target account security record not found.' };
  }

  record.force_password_reset = true;
  record.updated_at = new Date().toISOString();
  await persistAccountSecurityToDb(record);

  // Invalidate any active sessions
  invalidateUserSessions(record.user_id);

  await logEnterpriseAudit({
    employeeId: actor.id,
    userName: actor.name,
    role: actor.role,
    category: 'SECURITY_EVENT',
    severity: 'SECURITY',
    module: 'SECURITY_CONTROLS',
    action: 'SECURITY_FORCE_PASSWORD_RESET',
    recordType: 'USER_SECURITY',
    recordId: record.user_id,
    relatedContext: `Target account: ${record.email}`,
    reason: cleanReason,
    outcome: 'SUCCESS',
  });

  return { success: true };
}

/**
 * Returns security overview list for all managed employees.
 */
export function getEmployeesSecurityOverview(): UserSecurityOverviewItem[] {
  const store = getAccountSecurityStore();
  const users = globalThis.__ICON_MANAGED_USERS__ || INITIAL_MANAGED_USERS;
  const now = Date.now();

  return users.map((u) => {
    const sec = getAccountSecurity(u.email);
    let remainingLockout = 0;
    if (sec.is_locked && sec.locked_until) {
      const diff = Date.parse(sec.locked_until) - now;
      if (diff > 0) remainingLockout = Math.ceil(diff / 1000);
    }

    const mfaRequiredRoles = ['Managing Director', 'Admin / BDM', 'Accounts'];
    const isMfaRequired = mfaRequiredRoles.includes(u.role);

    return {
      user_id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: (u.status as any) || 'ACTIVE',
      is_locked: sec.is_locked && remainingLockout > 0,
      locked_until: sec.locked_until,
      remaining_lockout_seconds: remainingLockout,
      failed_attempts: sec.failed_password_attempts,
      is_suspended: sec.is_suspended || u.status === 'SUSPENDED',
      suspension_reason: sec.suspension_reason,
      mfa_enabled: sec.mfa_enabled,
      mfa_required: isMfaRequired,
      last_login_at: (u as any).last_login_at || (u as any).last_login || null,
    };
  });
}
