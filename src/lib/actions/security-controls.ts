'use server';

import { revalidatePath } from 'next/cache';
import { requireRole, requireAuth, invalidateUserSessions, getAuthenticatedUser } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { logEnterpriseAudit } from '@/lib/audit/enterprise-logger';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import { getManagedUsers } from '@/lib/actions/users';
import {
  getEmployeesSecurityOverview,
  adminUnlockAccount,
  adminSuspendAccount,
  adminReactivateAccount,
  adminForcePasswordReset,
  getAccountSecurity,
} from '@/lib/security/lockout-service';
import {
  startMfaEnrollment,
  confirmMfaEnrollment,
  adminResetMfa,
} from '@/lib/security/mfa-service';
import { queryEnterpriseAuditLedger } from '@/lib/audit/enterprise-logger';
import type { UserPermissionOverride } from '@/types/rbac';
import type { UserSecurityOverviewItem, EnterpriseAuditRecord } from '@/types/security';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_USER_OVERRIDES__: UserPermissionOverride[] | undefined;
}

/**
 * Fetch employee security overview for Admin Centre.
 * Requires Managing Director or Admin / BDM role.
 */
export async function getAccountSecurityOverviewAction(): Promise<{
  success: boolean;
  users: UserSecurityOverviewItem[];
  currentUserId?: string;
  error?: string;
}> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    if (await isSupabaseAvailable()) {
      try {
        const [{ users }, { data: secRows }] = await Promise.all([
          getManagedUsers(),
          createAdminClient().from('account_security_records').select('*'),
        ]);
        const secMap = new Map<string, any>();
        for (const r of secRows || []) {
          if (r.email) secMap.set(String(r.email).toLowerCase().trim(), r);
          if (r.user_id) secMap.set(String(r.user_id), r);
        }
        const now = Date.now();
        const mfaRequiredRoles = ['Managing Director', 'Admin / BDM', 'Accounts'];
        const mapped: UserSecurityOverviewItem[] = users.map((u) => {
          const sec = secMap.get(u.email.toLowerCase().trim()) || secMap.get(u.id) || getAccountSecurity(u.email);
          let remainingLockout = 0;
          if (sec?.is_locked && sec?.locked_until) {
            const diff = Date.parse(sec.locked_until) - now;
            if (diff > 0) remainingLockout = Math.ceil(diff / 1000);
          }
          return {
            user_id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            status: (u.status as any) || 'ACTIVE',
            is_locked: Boolean(sec?.is_locked && remainingLockout > 0),
            locked_until: sec?.locked_until || null,
            remaining_lockout_seconds: remainingLockout,
            failed_attempts: Number(sec?.failed_password_attempts) || 0,
            is_suspended: Boolean(sec?.is_suspended || u.status === 'SUSPENDED'),
            suspension_reason: sec?.suspension_reason || null,
            mfa_enabled: Boolean(sec?.mfa_enabled),
            mfa_required: mfaRequiredRoles.includes(u.role),
            last_login_at: u.last_login || null,
          };
        });
        return { success: true, users: mapped, currentUserId: actor.id };
      } catch (dbErr) {
        console.warn('Supabase getAccountSecurityOverviewAction fallback:', dbErr);
      }
    }
    const overview = getEmployeesSecurityOverview();
    return { success: true, users: overview, currentUserId: actor.id };
  } catch (err: any) {
    return { success: false, users: [], error: err.message || 'Unauthorized' };
  }
}

/**
 * Unlock a temporarily locked employee account.
 * Requires minimum 5-character reason. Self-unlock is strictly forbidden.
 */
export async function adminUnlockAccountAction(
  targetUserId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const res = await adminUnlockAccount(targetUserId, reason, actor);
    if (res.success) {
      revalidatePath('/dashboard/settings/security');
      revalidatePath('/dashboard/settings/users');
    }
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to unlock account' };
  }
}

/**
 * Administratively suspend an employee account.
 * Distinct from temporary lockout: persists indefinitely until admin reactivates.
 */
export async function adminSuspendAccountAction(
  targetUserId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const res = await adminSuspendAccount(targetUserId, reason, actor);
    if (res.success) {
      revalidatePath('/dashboard/settings/security');
      revalidatePath('/dashboard/settings/users');
    }
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to suspend account' };
  }
}

/**
 * Administratively reactivate a suspended employee account.
 */
export async function adminReactivateAccountAction(
  targetUserId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const res = await adminReactivateAccount(targetUserId, reason, actor);
    if (res.success) {
      revalidatePath('/dashboard/settings/security');
      revalidatePath('/dashboard/settings/users');
    }
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to reactivate account' };
  }
}

/**
 * Force password reset for an employee account.
 */
export async function adminForcePasswordResetAction(
  targetUserId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const res = await adminForcePasswordReset(targetUserId, reason, actor);
    if (res.success) {
      revalidatePath('/dashboard/settings/security');
      revalidatePath('/dashboard/settings/users');
    }
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to force password reset' };
  }
}

/**
 * Reset MFA for an employee account after identity verification.
 */
export async function adminResetMfaAction(
  targetUserId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const res = await adminResetMfa(targetUserId, reason, actor);
    if (res.success) {
      revalidatePath('/dashboard/settings/security');
      revalidatePath('/dashboard/settings/users');
    }
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to reset MFA' };
  }
}

/**
 * Force invalidate all active sessions for a target user.
 * Requires minimum 5-character business justification and executive role.
 */
export async function forceInvalidateUserSession(
  targetUserId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const cleanReason = reason?.trim();

    if (!cleanReason || cleanReason.length < 5) {
      return { success: false, error: 'A valid business reason (minimum 5 characters) is mandatory.' };
    }

    const { users } = await getManagedUsers();
    const targetUser = users.find((u) => u.id === targetUserId);
    if (!targetUser) {
      return { success: false, error: 'Target user account not found.' };
    }

    // Invalidate sessions via shared authority
    invalidateUserSessions(targetUserId);

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('user_profiles')
          .update({
            last_login_at: null,
            notes: `[Session Force Invalidated at ${new Date().toISOString()} by ${actor.name}: ${cleanReason}] ${targetUser.notes || ''}`.trim(),
          })
          .eq('id', targetUserId);
      } catch (err) {
        console.warn('Supabase forceInvalidateUserSession fallback to memory:', err);
      }
    }

    await logEnterpriseAudit({
      employeeId: actor.id,
      userName: actor.name,
      role: actor.role,
      category: 'SECURITY_EVENT',
      severity: 'SECURITY',
      module: 'SECURITY_CONTROLS',
      action: 'SECURITY_FORCE_SESSION_INVALIDATION',
      recordType: 'USER_SESSION',
      recordId: targetUserId,
      relatedContext: `Target account: ${targetUser.email}`,
      reason: cleanReason,
      outcome: 'SUCCESS',
    });

    revalidatePath('/dashboard/settings/security');
    revalidatePath('/dashboard/settings/users');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to invalidate session' };
  }
}

/**
 * Lock user account (alias for suspension).
 */
export async function lockUserAccount(
  targetUserId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  return adminSuspendAccountAction(targetUserId, reason);
}

/**
 * Unlock user account (alias for reactivation or lockout unlock).
 */
export async function unlockUserAccount(
  targetUserId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const sec = getAccountSecurity(targetUserId);
  if (sec.is_suspended) {
    return adminReactivateAccountAction(targetUserId, reason);
  }
  return adminUnlockAccountAction(targetUserId, reason);
}

/**
 * Bulk revoke all active temporary permission overrides.
 */
export async function bulkRevokeTemporaryAccess(
  reason: string
): Promise<{ success: boolean; revokedCount: number; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const cleanReason = reason?.trim();

    if (!cleanReason || cleanReason.length < 5) {
      return { success: false, revokedCount: 0, error: 'A valid business reason (minimum 5 characters) is mandatory.' };
    }

    if (!globalThis.__ICON_USER_OVERRIDES__) {
      globalThis.__ICON_USER_OVERRIDES__ = [];
    }

    const temporaryItems = globalThis.__ICON_USER_OVERRIDES__.filter((o) => o.isTemporary);
    globalThis.__ICON_USER_OVERRIDES__ = globalThis.__ICON_USER_OVERRIDES__.filter((o) => !o.isTemporary);
    const revokedCount = temporaryItems.length;

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('user_permission_overrides').delete().eq('is_temporary', true);
      } catch (err) {
        console.warn('Supabase bulkRevokeTemporaryAccess fallback to memory:', err);
      }
    }

    await logEnterpriseAudit({
      employeeId: actor.id,
      userName: actor.name,
      role: actor.role,
      category: 'SECURITY_EVENT',
      severity: 'SECURITY',
      module: 'SECURITY_CONTROLS',
      action: 'SECURITY_BULK_REVOKE_TEMPORARY_ACCESS',
      recordType: 'PERMISSION_OVERRIDES',
      recordId: 'BULK',
      reason: cleanReason,
      outcome: 'SUCCESS',
    });

    revalidatePath('/dashboard/settings/security');
    revalidatePath('/dashboard/settings/permissions');
    revalidatePath('/dashboard/settings');
    return { success: true, revokedCount };
  } catch (err: any) {
    return { success: false, revokedCount: 0, error: err.message || 'Failed to bulk revoke temporary access' };
  }
}

/**
 * Self-service MFA enrollment initialization for the currently logged-in user.
 */
export async function startOwnMfaEnrollmentAction(): Promise<{
  success: boolean;
  formattedSecret?: string;
  otpauthUri?: string;
  qrDataUrl?: string;
  backupCodes?: string[];
  error?: string;
}> {
  try {
    const user = await requireAuth();
    const data = startMfaEnrollment(user.id, user.email);
    return {
      success: true,
      formattedSecret: data.formattedSecret,
      otpauthUri: data.otpauthUri,
      qrDataUrl: data.qrDataUrl,
      backupCodes: data.backupCodes,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to start MFA enrollment' };
  }
}

/**
 * Self-service MFA enrollment confirmation.
 */
export async function confirmOwnMfaEnrollmentAction(
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    return await confirmMfaEnrollment(user.id, user.email, code, user);
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to confirm MFA enrollment' };
  }
}

/**
 * Fetch recent security events for the security overview feed.
 */
export async function getRecentSecurityIncidentsAction(limit = 10): Promise<EnterpriseAuditRecord[]> {
  try {
    await requireRole(['Managing Director', 'Admin / BDM']);
    const { records } = await queryEnterpriseAuditLedger({
      category: 'SECURITY_EVENT',
      limit,
    });
    return records;
  } catch {
    return [];
  }
}
