'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import { getManagedUsers } from '@/lib/actions/users';
import type { UserPermissionOverride } from '@/types/rbac';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_USER_OVERRIDES__: UserPermissionOverride[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_SESSION_INVALIDATIONS__: Record<string, string> | undefined;
}

function getInvalidationsStore(): Record<string, string> {
  if (!globalThis.__ICON_SESSION_INVALIDATIONS__) {
    globalThis.__ICON_SESSION_INVALIDATIONS__ = {};
  }
  return globalThis.__ICON_SESSION_INVALIDATIONS__;
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

    // Record session invalidation timestamp
    const nowIso = new Date().toISOString();
    const store = getInvalidationsStore();
    store[targetUserId] = nowIso;

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('user_profiles')
          .update({
            last_login_at: null,
            notes: `[Session Force Invalidated at ${nowIso} by ${actor.name}: ${cleanReason}] ${targetUser.notes || ''}`.trim(),
          })
          .eq('id', targetUserId);
      } catch (err) {
        console.warn('Supabase forceInvalidateUserSession fallback to memory:', err);
      }
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'SECURITY_FORCE_SESSION_INVALIDATION',
      module: 'SECURITY_CONTROLS',
      details: `Force invalidated active sessions for ${targetUser.name} (${targetUser.email}). Reason: "${cleanReason}"`,
    });

    revalidatePath('/dashboard/settings/security');
    revalidatePath('/dashboard/settings/users');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to invalidate session' };
  }
}

/**
 * Lock user account to immediately prevent login.
 * Requires minimum 5-character business justification and executive role.
 */
export async function lockUserAccount(
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

    if (targetUser.role === 'Managing Director' && actor.role !== 'Managing Director') {
      return { success: false, error: 'Managing Director accounts can only be modified by the Managing Director.' };
    }

    // In memory store update
    if (globalThis.__ICON_MANAGED_USERS__) {
      const idx = globalThis.__ICON_MANAGED_USERS__.findIndex((u) => u.id === targetUserId);
      if (idx !== -1) {
        globalThis.__ICON_MANAGED_USERS__[idx].can_login = false;
        globalThis.__ICON_MANAGED_USERS__[idx].status = 'SUSPENDED';
      }
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('user_profiles')
          .update({
            can_login: false,
            status: 'SUSPENDED',
            is_active: false,
          })
          .eq('id', targetUserId);
      } catch (err) {
        console.warn('Supabase lockUserAccount fallback to memory:', err);
      }
    }

    // Also invalidate any live sessions
    const store = getInvalidationsStore();
    store[targetUserId] = new Date().toISOString();

    await logAuditEvent({
      userName: actor.name,
      action: 'SECURITY_ACCOUNT_LOCKED',
      module: 'SECURITY_CONTROLS',
      details: `Account locked for ${targetUser.name} (${targetUser.email}). Target status changed from ${targetUser.status} to SUSPENDED. Reason: "${cleanReason}"`,
    });

    revalidatePath('/dashboard/settings/security');
    revalidatePath('/dashboard/settings/users');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to lock user account' };
  }
}

/**
 * Unlock a suspended/locked user account.
 * Requires minimum 5-character business justification and executive role.
 */
export async function unlockUserAccount(
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

    // In memory store update
    if (globalThis.__ICON_MANAGED_USERS__) {
      const idx = globalThis.__ICON_MANAGED_USERS__.findIndex((u) => u.id === targetUserId);
      if (idx !== -1) {
        globalThis.__ICON_MANAGED_USERS__[idx].can_login = true;
        globalThis.__ICON_MANAGED_USERS__[idx].status = 'ACTIVE';
      }
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('user_profiles')
          .update({
            can_login: true,
            status: 'ACTIVE',
            is_active: true,
          })
          .eq('id', targetUserId);
      } catch (err) {
        console.warn('Supabase unlockUserAccount fallback to memory:', err);
      }
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'SECURITY_ACCOUNT_UNLOCKED',
      module: 'SECURITY_CONTROLS',
      details: `Account unlocked for ${targetUser.name} (${targetUser.email}). Target status restored to ACTIVE with login enabled. Reason: "${cleanReason}"`,
    });

    revalidatePath('/dashboard/settings/security');
    revalidatePath('/dashboard/settings/users');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to unlock user account' };
  }
}

/**
 * Bulk revoke all active temporary permission overrides.
 * Requires minimum 5-character business justification and executive role.
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

    const beforeCount = globalThis.__ICON_USER_OVERRIDES__.length;
    // Keep non-temporary overrides, remove temporary ones
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

    await logAuditEvent({
      userName: actor.name,
      action: 'SECURITY_BULK_REVOKE_TEMPORARY_ACCESS',
      module: 'SECURITY_CONTROLS',
      details: `Bulk revoked ${revokedCount} active temporary access overrides across the organization. Reason: "${cleanReason}"`,
    });

    revalidatePath('/dashboard/settings/security');
    revalidatePath('/dashboard/settings/permissions');
    revalidatePath('/dashboard/settings');
    return { success: true, revokedCount };
  } catch (err: any) {
    return { success: false, revokedCount: 0, error: err.message || 'Failed to bulk revoke temporary access' };
  }
}
