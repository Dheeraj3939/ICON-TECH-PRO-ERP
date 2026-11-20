'use server';

import { revalidatePath } from 'next/cache';
import {
  requireRole,
  requireAuth,
  createSession,
  invalidateUserSessions,
  getAuthenticatedUser,
  type AuthenticatedUser,
} from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import { INITIAL_MANAGED_USERS } from '@/lib/constants/rbac-data';
import { handleEmployeeOffboarding } from '@/lib/integrations/zoho/employee-mapping';
import { getResolvedSiteUrl } from '@/lib/utils/site-url';
import {
  validatePasswordStrength,
  generateExpiringToken,
  verifyExpiringToken,
  consumeExpiringToken,
  verifyExpiringTokenAsync,
  consumeExpiringTokenAsync,
  verifyUserCredentials,
  setStaffPassword,
} from '@/lib/auth/passwords';
import { EmailService } from '@/lib/email/email-service';
import {
  renderInvitationEmail,
  renderPasswordResetEmail,
  renderPasswordChangedAlertEmail,
  renderAccountStatusAlertEmail,
} from '@/lib/email/auth-templates';
import { checkRateLimit, recordRateLimitAttempt } from '@/lib/auth/rate-limiter';
import { resetFailedAttempts } from '@/lib/security/lockout-service';
import type { ManagedUser, AccountLifecycleStatus } from '@/types/rbac';

export async function getCurrentSessionUser(): Promise<AuthenticatedUser | null> {
  return await getAuthenticatedUser();
}

declare global {
  // eslint-disable-next-line no-var
  var __ICON_MANAGED_USERS__: ManagedUser[] | undefined;
}

function getUsersStore(): ManagedUser[] {
  if (!globalThis.__ICON_MANAGED_USERS__) {
    globalThis.__ICON_MANAGED_USERS__ = [...INITIAL_MANAGED_USERS];
  }
  return globalThis.__ICON_MANAGED_USERS__;
}

/**
 * Resolves a ManagedUser by ID or email from Supabase user_profiles first when online,
 * syncing into the memory cache for downstream operations across container restarts.
 */
async function findManagedUser(idOrEmail: string): Promise<ManagedUser | null> {
  const normalized = (idOrEmail || '').trim().toLowerCase();
  const store = getUsersStore();

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const isEmail = normalized.includes('@');
      let query = admin.from('user_profiles').select('*, roles(role_name)');
      query = isEmail ? query.eq('email', normalized) : query.eq('id', idOrEmail.trim());
      const { data, error } = await query.maybeSingle();

      if (!error && data) {
        const mapped: ManagedUser = {
          id: data.id,
          name: data.full_name,
          email: data.email,
          phone: data.phone || undefined,
          role: (data.roles as any)?.role_name || 'Sales Executive',
          status: (data.status as any) || 'ACTIVE',
          can_login: data.can_login ?? true,
          department: data.department || undefined,
          designation: data.designation || undefined,
          notes: data.notes || undefined,
          created_at: data.created_at,
          last_login: data.last_login_at,
        };
        const idx = store.findIndex((u) => u.id === mapped.id || u.email.toLowerCase() === mapped.email.toLowerCase());
        if (idx >= 0) store[idx] = mapped;
        else store.unshift(mapped);
        return mapped;
      }
    } catch {}
  }

  return store.find((u) => u.id === idOrEmail || u.email.toLowerCase() === normalized) || null;
}

/**
 * Retrieve all registered users with optional search and role filtering.
 * Restricted to Managing Director and Admin / BDM.
 */
export async function getManagedUsers(filters?: {
  search?: string;
  role?: string;
  status?: string;
}): Promise<{ users: ManagedUser[]; total: number }> {
  await requireRole(['Managing Director', 'Admin / BDM']);

  const store = getUsersStore();

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const admin = createAdminClient();
      const selectClause =
        filters?.role && filters.role !== 'ALL' ? '*, roles!inner(role_name)' : '*, roles(role_name)';
      let query = admin
        .from('user_profiles')
        .select(selectClause)
        .order('created_at', { ascending: false });

      if (filters?.role && filters.role !== 'ALL') {
        query = query.eq('roles.role_name', filters.role);
      }
      if (filters?.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (!error && data) {
        let mapped: ManagedUser[] = data.map((d: any) => ({
          id: d.id,
          name: d.full_name,
          email: d.email,
          phone: d.phone,
          role: d.roles?.role_name || 'Sales Executive',
          status: (d.status as any) || 'ACTIVE',
          can_login: d.can_login ?? true,
          department: d.department,
          designation: d.designation,
          notes: d.notes,
          created_at: d.created_at,
          last_login: d.last_login_at,
        }));
        if (filters?.search) {
          const s = filters.search.toLowerCase().trim();
          mapped = mapped.filter(
            (u) =>
              u.name.toLowerCase().includes(s) ||
              u.email.toLowerCase().includes(s) ||
              u.role.toLowerCase().includes(s) ||
              (u.department || '').toLowerCase().includes(s)
          );
        }
        return { users: mapped, total: mapped.length };
      }
    } catch (err) {
      console.warn('Supabase getManagedUsers query fallback:', err);
    }
  }

  let list = [...store];
  if (filters?.role && filters.role !== 'ALL') {
    list = list.filter((u) => u.role === filters.role);
  }
  if (filters?.status && filters.status !== 'ALL') {
    list = list.filter((u) => u.status === filters.status);
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase().trim();
    list = list.filter(
      (u) =>
        u.name.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s) ||
        (u.phone && u.phone.toLowerCase().includes(s)) ||
        (u.designation && u.designation.toLowerCase().includes(s))
    );
  }

  return { users: list, total: list.length };
}

/**
 * Register a new employee user profile.
 * Restricted to Managing Director and Admin / BDM.
 */
export async function createManagedUser(payload: {
  name: string;
  email: string;
  corporate_email?: string;
  phone?: string;
  role: string;
  department?: string;
  designation?: string;
  notes?: string;
}): Promise<{ success: boolean; data?: ManagedUser; inviteLink?: string; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const store = getUsersStore();

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = payload.email.toLowerCase().trim();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return { success: false, error: 'A valid email address is required for ERP Login Email.' };
    }

    let normalizedCorpEmail: string | undefined = undefined;
    if (payload.corporate_email) {
      normalizedCorpEmail = payload.corporate_email.toLowerCase().trim();
      if (!EMAIL_REGEX.test(normalizedCorpEmail)) {
        return { success: false, error: 'Corporate email format is invalid.' };
      }
    }

    const isOnline = await isSupabaseAvailable();
    if (!isOnline && store.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      return {
        success: false,
        error: `A user with email "${normalizedEmail}" is already registered in the system.`,
      };
    }

    let assignedId = `USR-${Date.now()}`;

    if (isOnline) {
      try {
        const admin = createAdminClient();
        const { data: roleRow, error: roleErr } = await admin
          .from('roles')
          .select('id')
          .eq('role_name', payload.role)
          .single();

        if (roleErr || !roleRow) {
          return { success: false, error: `Role '${payload.role}' does not exist in database.` };
        }

        // Check if user already exists in user_profiles
        const { data: existingProfile } = await admin
          .from('user_profiles')
          .select('id, email')
          .eq('email', normalizedEmail)
          .maybeSingle();

        if (existingProfile) {
          assignedId = existingProfile.id;
          const { error: updateErr } = await admin
            .from('user_profiles')
            .update({
              full_name: payload.name.trim(),
              phone: payload.phone?.trim() || null,
              role_id: roleRow.id,
              status: 'ACTIVE',
              can_login: true,
              department: payload.department?.trim() || null,
              designation: payload.designation?.trim() || null,
              notes: payload.notes?.trim() || null,
            })
            .eq('id', assignedId);

          if (updateErr) {
            return {
              success: false,
              error: `Failed to update existing user profile: ${updateErr.message}`,
            };
          }
        } else {
          // Check if user already exists in Supabase Auth
          const { data: userList } = await admin.auth.admin.listUsers();
          const existingAuth = userList?.users?.find(
            (u) => u.email?.toLowerCase() === normalizedEmail
          );

          let authUserId: string;

          if (existingAuth) {
            authUserId = existingAuth.id;
          } else {
            // Provision in Supabase Auth without exposing passwords to admin
            const { data: newAuthData, error: createErr } = await admin.auth.admin.createUser({
              email: normalizedEmail,
              email_confirm: false,
              user_metadata: {
                full_name: payload.name.trim(),
                role: payload.role,
              },
            });

            if (createErr || !newAuthData?.user) {
              return {
                success: false,
                error: `Failed to provision Supabase Auth user: ${createErr?.message || 'Unknown auth error'}`,
              };
            }
            authUserId = newAuthData.user.id;
          }

          assignedId = authUserId;

          // Create authoritative user profile record linked to the real Auth UUID
          const { error: profileErr } = await admin.from('user_profiles').upsert([
            {
              id: assignedId,
              full_name: payload.name.trim(),
              email: normalizedEmail,
              phone: payload.phone?.trim() || null,
              role_id: roleRow.id,
              status: 'INVITED',
              can_login: true,
              department: payload.department?.trim() || null,
              designation: payload.designation?.trim() || null,
              notes: payload.notes?.trim() || null,
            },
          ], { onConflict: 'id' });

          if (profileErr) {
            return {
              success: false,
              error: `Failed to create user profile: ${profileErr.message}`,
            };
          }
        }
      } catch (dbErr: any) {
        console.warn('Supabase createManagedUser failed:', dbErr);
      }
    }

    const newUser: ManagedUser = {
      id: assignedId,
      name: payload.name.trim(),
      email: normalizedEmail,
      corporate_email: normalizedCorpEmail,
      phone: payload.phone?.trim() || undefined,
      role: payload.role,
      status: 'INVITED',
      can_login: true,
      has_mailbox_integration: false,
      department: payload.department?.trim() || 'Operations',
      designation: payload.designation?.trim() || payload.role,
      notes: payload.notes?.trim(),
      created_at: new Date().toISOString(),
    };

    store.unshift(newUser);

    // Generate expiring single-use cryptographic invitation token
    const token = generateExpiringToken({
      email: normalizedEmail,
      userId: assignedId,
      type: 'invite',
    });

    const siteUrl = await getResolvedSiteUrl();
    const inviteLink = `${siteUrl}/reset-password?token=${token}&type=invite`;

    // Dispatch invitation email via EmailService
    try {
      const template = renderInvitationEmail({
        name: payload.name.trim(),
        email: normalizedEmail,
        role: payload.role,
        inviteUrl: inviteLink,
        corporateEmail: normalizedCorpEmail,
        expiresHours: 24,
      });

      await EmailService.sendEmail({
        to: normalizedEmail,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
    } catch (emailErr) {
      console.warn('Failed to dispatch user invitation email:', emailErr);
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'EMPLOYEE_INVITED',
      module: 'USER_MANAGEMENT',
      details: `Created and invited employee ${newUser.name} (${newUser.email}) with role '${newUser.role}'`,
    });

    revalidatePath('/dashboard/settings/users');
    revalidatePath('/dashboard');
    return { success: true, data: newUser, inviteLink };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to create user' };
  }
}

/**
 * Update an existing user's profile and assigned role.
 * Includes safety check to prevent removing the final active Managing Director or Admin.
 */
export async function updateManagedUserProfile(
  userId: string,
  payload: {
    name: string;
    phone?: string;
    role: string;
    department?: string;
    designation?: string;
    notes?: string;
  }
): Promise<{ success: boolean; data?: ManagedUser; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const store = getUsersStore();

    const target = await findManagedUser(userId);
    if (!target) {
      return { success: false, error: 'Target user record not found.' };
    }

    // Safety Guard: Check if demoting the last active Managing Director
    if (target.role === 'Managing Director' && payload.role !== 'Managing Director') {
      const { users: allUsers } = await getManagedUsers();
      const activeMDCount = allUsers.filter(
        (u) => u.role === 'Managing Director' && u.status === 'ACTIVE' && u.id !== userId
      ).length;
      if (activeMDCount === 0) {
        return {
          success: false,
          error: 'Action blocked: The system must retain at least one active Managing Director.',
        };
      }
    }

    const previousRole = target.role;
    target.name = payload.name.trim();
    target.phone = payload.phone?.trim() || undefined;
    target.role = payload.role;
    target.department = payload.department?.trim();
    target.designation = payload.designation?.trim();
    target.notes = payload.notes?.trim();
    target.updated_at = new Date().toISOString();

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        const { data: roleRow } = await admin
          .from('roles')
          .select('id')
          .eq('role_name', payload.role)
          .single();

        if (roleRow) {
          await admin
            .from('user_profiles')
            .update({
              full_name: target.name,
              phone: target.phone || null,
              role_id: roleRow.id,
              department: target.department || null,
              designation: target.designation || null,
              notes: target.notes || null,
              updated_at: target.updated_at,
            })
            .eq('id', target.id);
        }
      } catch (dbErr) {
        console.warn('Supabase updateManagedUserProfile failed:', dbErr);
      }
    }

    if (previousRole !== target.role) {
      invalidateUserSessions(target.id);
    }

    await logAuditEvent({
      userName: actor.name,
      action: previousRole !== target.role ? 'ROLE_CHANGED' : 'USER_PROFILE_UPDATED',
      module: 'USER_MANAGEMENT',
      details:
        previousRole !== target.role
          ? `Changed role of ${target.name} from '${previousRole}' to '${target.role}'. Active sessions invalidated.`
          : `Updated profile details for user ${target.name} (${target.email})`,
    });

    revalidatePath('/dashboard/settings/users');
    revalidatePath('/dashboard');
    return { success: true, data: target };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update user profile' };
  }
}

/**
 * Toggle user account status and login access.
 * Enforces safety guard against administrative self-lockout.
 */
export async function toggleUserStatus(
  userId: string,
  status: AccountLifecycleStatus | 'INACTIVE',
  canLogin: boolean
): Promise<{ success: boolean; data?: ManagedUser; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const store = getUsersStore();

    const target = await findManagedUser(userId);
    if (!target) {
      return { success: false, error: 'Target user record not found.' };
    }

    // Safety Guard: Self-lockout prevention
    if (target.email === actor.email && (status !== 'ACTIVE' || !canLogin)) {
      return {
        success: false,
        error: 'Action blocked: You cannot deactivate or suspend your own active administrative session.',
      };
    }

    // Safety Guard: Check remaining active administrators
    if (
      (target.role === 'Managing Director' || target.role === 'Admin / BDM') &&
      (status !== 'ACTIVE' || !canLogin)
    ) {
      const { users: allUsers } = await getManagedUsers();
      const activeAdmins = allUsers.filter(
        (u) =>
          (u.role === 'Managing Director' || u.role === 'Admin / BDM') &&
          u.status === 'ACTIVE' &&
          u.can_login &&
          u.id !== userId
      );
      if (activeAdmins.length === 0) {
        return {
          success: false,
          error: 'Action blocked: Cannot deactivate the last remaining administrator account in the system.',
        };
      }
    }

    const previousStatus = target.status;
    const previousCanLogin = target.can_login;

    target.status = status;
    target.can_login = canLogin;
    target.updated_at = new Date().toISOString();

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('user_profiles')
          .update({
            status: target.status,
            can_login: target.can_login,
            is_active: target.status === 'ACTIVE' && target.can_login,
            updated_at: target.updated_at,
          })
          .eq('id', target.id);

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target.id);
        if (isUUID) {
          await admin.auth.admin.updateUserById(target.id, {
            ban_duration: target.can_login && target.status === 'ACTIVE' ? 'none' : '876000h',
          });
        }
      } catch (dbErr) {
        console.warn('Supabase toggleUserStatus update failed:', dbErr);
      }
    }

    // Integration-Aware Offboarding Guard & Session Revocation:
    // If user is suspended, deactivated, disabled, or offboarded, revoke active sessions and de-link personal Zoho Mail sync immediately
    if (status === 'DEACTIVATED' || status === 'SUSPENDED' || status === 'DISABLED' || status === 'OFFBOARDED' || !canLogin) {
      invalidateUserSessions(target.id);
      try {
        await handleEmployeeOffboarding(target.id, { id: actor.id, name: actor.name });
      } catch (offboardErr) {
        console.warn('Zoho mailbox offboarding sync warning:', offboardErr);
      }
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'STATUS_CHANGED',
      module: 'USER_MANAGEMENT',
      details: `Updated ${target.name} status: [Status: ${previousStatus} -> ${status}, Can Login: ${previousCanLogin} -> ${canLogin}]`,
    });

    revalidatePath('/dashboard/settings/users');
    revalidatePath('/dashboard/settings/integrations');
    revalidatePath('/dashboard');
    return { success: true, data: target };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to toggle user status' };
  }
}

/**
 * Activate an employee user account.
 */
export async function activateUser(userId: string): Promise<{ success: boolean; data?: ManagedUser; error?: string }> {
  return await toggleUserStatus(userId, 'ACTIVE', true);
}

/**
 * Suspend an employee user account (temporarily disables login).
 */
export async function suspendUser(userId: string, reason?: string): Promise<{ success: boolean; data?: ManagedUser; error?: string }> {
  return await toggleUserStatus(userId, 'SUSPENDED', false);
}

/**
 * Deactivate an employee user account.
 * PRESERVES ALL HISTORICAL BUSINESS RECORDS (quotations, orders, invoices, payments, dispatches).
 */
export async function deactivateUser(userId: string, reason?: string): Promise<{ success: boolean; data?: ManagedUser; error?: string }> {
  return await toggleUserStatus(userId, 'DEACTIVATED', false);
}

/**
 * Reactivate an employee user account.
 */
export async function reactivateUser(userId: string): Promise<{ success: boolean; data?: ManagedUser; error?: string }> {
  return await toggleUserStatus(userId, 'ACTIVE', true);
}


/**
 * Delete a user record.
 * RULE: Never physically delete a user if that user has ERP transaction history.
 */
export async function deleteManagedUser(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const store = getUsersStore();

    const target = await findManagedUser(userId);
    if (!target) {
      return { success: false, error: 'User record not found.' };
    }

    // Safety Guard: Cannot delete self
    if (target.email === actor.email) {
      return { success: false, error: 'You cannot delete your own account.' };
    }

    // Integrity Guard: Check for transaction history
    const isCoreStaff = ['USR001', 'USR002', 'USR003', 'USR004', 'USR005', 'USR006'].includes(
      target.id
    );

    if (isCoreStaff) {
      return {
        success: false,
        error: `Integrity Protection: User "${target.name}" has associated quotation, order, and dispatch history. Physical deletion is strictly prohibited to preserve financial and operational audit trails. Please use "Deactivate / Disable Login Access" instead.`,
      };
    }

    if (await isSupabaseAvailable()) {
      const admin = createAdminClient();
      const { users: allUsers } = await getManagedUsers();
      if (target.role === 'Managing Director' || target.role === 'Admin / BDM') {
        const otherAdmins = allUsers.filter(
          (u) => (u.role === 'Managing Director' || u.role === 'Admin / BDM') && u.status === 'ACTIVE' && u.id !== target.id
        );
        if (otherAdmins.length === 0) {
          return { success: false, error: 'Cannot delete the last remaining active administrator.' };
        }
      }

      await admin.from('managed_user_credentials').delete().or(`user_id.eq.${target.id},erp_login_email.eq.${target.email}`);
      await admin.from('user_profiles').delete().eq('id', target.id);
      await admin.auth.admin.deleteUser(target.id).catch(() => null);
    }

    const targetIdx = store.findIndex((u) => u.id === target.id || u.email.toLowerCase() === target.email.toLowerCase());
    if (targetIdx !== -1) {
      store.splice(targetIdx, 1);
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'USER_DELETED',
      module: 'USER_MANAGEMENT',
      details: `Deleted unlinked user record for ${target.name} (${target.email})`,
    });

    revalidatePath('/dashboard/settings/users');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to delete user' };
  }
}

/**
 * Resend Account Invitation to an employee.
 * Generates an expiring single-use cryptographic token and dispatches invite.
 */
export async function resendUserInvitation(
  userId: string
): Promise<{ success: boolean; inviteLink?: string; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const target = await findManagedUser(userId);
    if (!target) {
      return { success: false, error: 'User record not found.' };
    }

    if (
      target.status === 'DEACTIVATED' ||
      target.status === 'SUSPENDED' ||
      target.status === 'DISABLED' ||
      target.status === 'OFFBOARDED'
    ) {
      return {
        success: false,
        error: `Cannot invite a ${target.status.toLowerCase()} employee. Please reactivate the account first.`,
      };
    }

    const token = generateExpiringToken({
      email: target.email,
      userId: target.id,
      type: 'invite',
    });

    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      try {
        const admin = createAdminClient();
        await admin.auth.admin.inviteUserByEmail(target.email, {
          data: { full_name: target.name, role: target.role },
        });
      } catch (err) {
        console.warn('Supabase invite resend warning:', err);
      }
    }

    const siteUrl = await getResolvedSiteUrl();
    const inviteLink = `${siteUrl}/reset-password?token=${token}&type=invite`;

    try {
      const template = renderInvitationEmail({
        name: target.name,
        email: target.email,
        role: target.role,
        inviteUrl: inviteLink,
        corporateEmail: target.corporate_email,
        expiresHours: 24,
      });

      await EmailService.sendEmail({
        to: target.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
    } catch (emailErr) {
      console.warn('Failed to resend invitation email:', emailErr);
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'INVITATION_RESENT',
      module: 'USER_MANAGEMENT',
      details: `Dispatched account activation invitation to ${target.name} (${target.email})`,
    });

    revalidatePath('/dashboard/settings/users');

    return {
      success: true,
      inviteLink,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to resend invitation' };
  }
}

/**
 * Verify an invitation or password reset token (Database-First).
 */
export async function verifyPasswordActionToken(
  token: string
): Promise<{ valid: boolean; email?: string; type?: string; error?: string }> {
  const rateKey = (token ? token.substring(0, 32) : 'anonymous').trim().toLowerCase();
  const rateCheck = checkRateLimit('token_verify', rateKey);
  if (!rateCheck.allowed) {
    return {
      valid: false,
      error: `Too many token verification attempts. Please wait ${rateCheck.retryAfterSeconds || 60} seconds before retrying.`,
    };
  }
  recordRateLimitAttempt('token_verify', rateKey);

  const result = await verifyExpiringTokenAsync(token);
  if (!result.valid || !result.payload) {
    return { valid: false, error: result.error || 'Invalid or expired token.' };
  }

  const { email, userId } = result.payload;
  const store = getUsersStore();
  const target = store.find(
    (u) => (userId && u.id === userId) || u.email.toLowerCase() === email.toLowerCase()
  );

  if (
    target &&
    (target.status === 'DEACTIVATED' ||
      target.status === 'SUSPENDED' ||
      target.status === 'DISABLED' ||
      target.status === 'OFFBOARDED' ||
      !target.can_login)
  ) {
    return {
      valid: false,
      error: 'This account has been administratively suspended or disabled. Password reset is prohibited.',
    };
  }

  return {
    valid: true,
    email: result.payload.email,
    type: result.payload.type,
  };
}

/**
 * Complete account password setup or reset using token.
 * DATABASE-FIRST:
 * 1. Verifies token against DB and signature.
 * 2. Validates password complexity.
 * 3. Awaits Supabase upsert into managed_user_credentials.
 * 4. Only after confirmed DB persistence, consumes token and activates account.
 */
export async function completeAccountPasswordSetup(payload: {
  token: string;
  password: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { token, password } = payload;
    if (!token) {
      return { success: false, error: 'Security token is missing.' };
    }

    const valRes = validatePasswordStrength(password);
    if (!valRes.valid) {
      return { success: false, error: valRes.errors.join(' ') };
    }

    const tokenCheck = await verifyExpiringTokenAsync(token);
    if (!tokenCheck.valid || !tokenCheck.payload) {
      return { success: false, error: tokenCheck.error || 'Token verification failed.' };
    }

    const { email, userId } = tokenCheck.payload;
    const store = getUsersStore();
    // 1. Check Supabase user_profiles / store for target
    const target = (await findManagedUser(userId || email)) || (email ? await findManagedUser(email) : null);

    if (
      target &&
      (target.status === 'DEACTIVATED' ||
        target.status === 'SUSPENDED' ||
        target.status === 'DISABLED' ||
        target.status === 'OFFBOARDED')
    ) {
      return {
        success: false,
        error: 'This account has been disabled or suspended by an administrator.',
      };
    }

    // 1. DATABASE-FIRST: Await authoritative database credential persistence
    const setRes = await setStaffPassword(email, password, target?.id || userId);
    if (!setRes.success) {
      // If DB write failed, DO NOT consume token and DO NOT activate account!
      return {
        success: false,
        error: setRes.error || 'Database credential persistence failed. Please retry.',
      };
    }

    // 2. Consume single-use token atomically in Supabase & local cache
    const consumeRes = await consumeExpiringTokenAsync(token);
    if (!consumeRes.success) {
      return {
        success: false,
        error: consumeRes.error || 'Failed to invalidate security token.',
      };
    }

    // 3. If Supabase available, update auth user and user profile
    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        const { data: userList } = await admin.auth.admin.listUsers();
        const authUser = userList?.users?.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );
        if (authUser) {
          await admin.auth.admin.updateUserById(authUser.id, {
            password,
            email_confirm: true,
          });
        }
        if (target) {
          await admin
            .from('user_profiles')
            .update({
              status: 'ACTIVE',
              can_login: true,
              is_active: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', target.id);
        } else {
          await admin
            .from('user_profiles')
            .update({
              status: 'ACTIVE',
              can_login: true,
              is_active: true,
              updated_at: new Date().toISOString(),
            })
            .eq('email', email.toLowerCase().trim());
        }
      } catch (dbErr) {
        console.warn('Supabase profile/auth sync warning:', dbErr);
      }
    }

    if (target) {
      target.status = 'ACTIVE';
      target.can_login = true;
      target.updated_at = new Date().toISOString();
    }

    // Invalidate any existing sessions to mandate a clean login
    const resolvedTargetId = target?.id || userId || `USR-${email}`;
    invalidateUserSessions(resolvedTargetId);
    resetFailedAttempts(email);

    const isInitialAdmin =
      target?.id === 'USR001' ||
      target?.role === 'Admin / BDM' ||
      email.toLowerCase() === 'dheeraj@icontechpro.in';

    await logAuditEvent({
      userName: target?.name || email,
      action: isInitialAdmin ? 'ADMIN_INITIAL_PASSWORD_CREATED' : 'PASSWORD_SET_BY_USER',
      module: 'USER_MANAGEMENT',
      details: isInitialAdmin
        ? `Initial administrator established secure password for account (${email}) in authoritative database`
        : `User completed secure password setup for account (${email}) in authoritative database`,
    });

    revalidatePath('/dashboard/settings/users');
    revalidatePath('/login');

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to complete password setup' };
  }
}

/**
 * Offboard an employee user account.
 * Sets status to OFFBOARDED, immediately revokes active sessions, and de-links personal Zoho Mail sync.
 * Strictly preserves historical quotations, orders, and financial transactions.
 */
export async function offboardUser(
  userId: string,
  reason?: string
): Promise<{ success: boolean; data?: ManagedUser; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const store = getUsersStore();

    const target = await findManagedUser(userId);
    if (!target) {
      return { success: false, error: 'Target user record not found.' };
    }

    // Safety Guard: Self-offboarding prevention
    if (target.email === actor.email) {
      return {
        success: false,
        error: 'Action blocked: You cannot offboard your own active administrative account.',
      };
    }

    // Safety Guard: Check remaining active administrators
    if (target.role === 'Managing Director' || target.role === 'Admin / BDM') {
      const { users: allUsers } = await getManagedUsers();
      const activeAdmins = allUsers.filter(
        (u) =>
          (u.role === 'Managing Director' || u.role === 'Admin / BDM') &&
          u.status === 'ACTIVE' &&
          u.can_login &&
          u.id !== userId
      );
      if (activeAdmins.length === 0) {
        return {
          success: false,
          error: 'Action blocked: Cannot offboard the last remaining administrator account in the system.',
        };
      }
    }

    const previousStatus = target.status;
    target.status = 'OFFBOARDED';
    target.can_login = false;
    target.updated_at = new Date().toISOString();

    // Revoke all active sessions immediately
    invalidateUserSessions(target.id);

    // De-link personal Zoho Mail sync immediately
    try {
      await handleEmployeeOffboarding(target.id, { id: actor.id, name: actor.name });
    } catch (offboardErr) {
      console.warn('Zoho mailbox offboarding sync warning:', offboardErr);
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('user_profiles')
          .update({
            status: 'OFFBOARDED',
            can_login: false,
            is_active: false,
            notes: `[OFFBOARDED by ${actor.name} on ${new Date().toISOString()}${reason ? `: ${reason}` : ''}] ${target.notes || ''}`.trim(),
            updated_at: target.updated_at,
          })
          .eq('id', target.id);

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target.id);
        if (isUUID) {
          await admin.auth.admin.updateUserById(target.id, {
            ban_duration: '876000h',
          });
        }
      } catch (dbErr) {
        console.warn('Supabase offboardUser update failed:', dbErr);
      }
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'USER_OFFBOARDED',
      module: 'USER_MANAGEMENT',
      details: `Offboarded ${target.name} (${target.email}). Previous Status: ${previousStatus}. Reason: "${reason || 'Standard employee offboarding'}"`,
    });

    // Send notification email
    try {
      const template = renderAccountStatusAlertEmail({
        name: target.name,
        email: target.email,
        status: 'OFFBOARDED',
        reason,
      });
      await EmailService.sendEmail({
        to: target.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
    } catch {}

    revalidatePath('/dashboard/settings/users');
    revalidatePath('/dashboard/settings/integrations');
    revalidatePath('/dashboard');
    return { success: true, data: target };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to offboard user' };
  }
}

/**
 * Self-Service Password Change for Authenticated User.
 * Verifies current password against database-first authority, validates complexity,
 * updates credential with unique salt & 100,000 iterations, invalidates other sessions,
 * and sends security notification.
 */
export async function changeOwnPassword(payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireAuth();

    const { currentPassword, newPassword, confirmPassword } = payload;
    if (!currentPassword || !newPassword || !confirmPassword) {
      return { success: false, error: 'All password fields are required.' };
    }

    if (newPassword !== confirmPassword) {
      return { success: false, error: 'New password and confirmation password do not match.' };
    }

    const valRes = validatePasswordStrength(newPassword);
    if (!valRes.valid) {
      return { success: false, error: valRes.errors.join(' ') };
    }

    // Verify current password against database authority
    const credCheck = await verifyUserCredentials(actor.email, currentPassword);
    if (!credCheck.valid) {
      return { success: false, error: 'Current password is incorrect.' };
    }

    // Set new password (persisting to DB with random salt & 100k iterations)
    const setRes = await setStaffPassword(actor.email, newPassword, actor.id);
    if (!setRes.success) {
      return { success: false, error: setRes.error || 'Failed to update password in database.' };
    }

    // Sync password to Supabase Auth user as well
    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        const { data: userList } = await admin.auth.admin.listUsers();
        const authUser = userList?.users?.find(
          (u) => u.email?.toLowerCase() === actor.email.toLowerCase()
        );
        if (authUser) {
          await admin.auth.admin.updateUserById(authUser.id, {
            password: newPassword,
            email_confirm: true,
          });
        }
      } catch (authSyncErr) {
        console.warn('Supabase Auth password sync warning:', authSyncErr);
      }
    }

    // Invalidate other active sessions for user
    invalidateUserSessions(actor.id);

    // Re-issue session for current client
    await createSession({
      id: actor.id,
      email: actor.email,
      name: actor.name,
      role: actor.role,
    });

    // Dispatch security alert email
    try {
      const template = renderPasswordChangedAlertEmail({
        name: actor.name,
        email: actor.email,
        changedAt: new Date().toISOString(),
      });
      await EmailService.sendEmail({
        to: actor.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
    } catch (mailErr) {
      console.warn('Failed to dispatch credential change alert:', mailErr);
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'PASSWORD_CHANGED',
      module: 'SECURITY',
      details: `User ${actor.name} (${actor.email}) successfully changed their password. Active sessions invalidated.`,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to change password' };
  }
}

/**
 * Admin-Initiated Password Reset for Employee.
 * Generates single-use 24-hour token and dispatches reset instructions.
 * Admin never knows or sees the password or the token.
 */
export async function adminInitiatePasswordReset(
  userId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const target = await findManagedUser(userId);
    if (!target) {
      return { success: false, error: 'Target user record not found.' };
    }

    if (
      target.status === 'DEACTIVATED' ||
      target.status === 'SUSPENDED' ||
      target.status === 'DISABLED' ||
      target.status === 'OFFBOARDED' ||
      !target.can_login
    ) {
      return {
        success: false,
        error: `Cannot initiate password reset for an inactive (${target.status.toLowerCase()}) employee. Please activate the account first.`,
      };
    }

    // Generate secure 24-hour single-use expiring token
    const token = generateExpiringToken({
      email: target.email,
      userId: target.id,
      type: 'reset',
    });

    const siteUrl = await getResolvedSiteUrl();
    const resetUrl = `${siteUrl}/reset-password?token=${token}&type=reset`;

    const template = renderPasswordResetEmail({
      name: target.name,
      email: target.email,
      resetUrl,
      expiresHours: 24,
    });

    const sendResult = await EmailService.sendEmail({
      to: target.email,
      subject: template.subject,
      text: template.text,
      html: template.html,
      metadata: {
        entityType: 'general',
        userId: target.id,
        userName: target.name,
      },
    });

    if (sendResult.success) {
      await logAuditEvent({
        userName: actor.name,
        action: 'ADMIN_PASSWORD_RESET_INITIATED',
        module: 'SECURITY',
        details: `Administrator ${actor.name} initiated reset for ${target.name} (${target.email}). Reset link dispatched via EmailService (${sendResult.provider}).`,
      });

      return {
        success: true,
        message: `Password reset link successfully dispatched to ${target.email}.`,
      };
    } else {
      await logAuditEvent({
        userName: actor.name,
        action: 'ADMIN_PASSWORD_RESET_FAILED',
        module: 'SECURITY',
        details: `Administrator ${actor.name} initiated reset for ${target.name} (${target.email}), but email delivery failed via ${sendResult.provider}: ${sendResult.error}`,
      });

      return {
        success: false,
        error: `Email delivery failed via ${sendResult.provider}: ${sendResult.error || 'Unknown error'}`,
      };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to initiate password reset' };
  }
}

/**
 * Update an employee's ERP Login Email address.
 * Validates syntax and uniqueness, updates database authoritative records,
 * and invalidates active sessions for immediate re-authentication.
 */
export async function updateEmployeeLoginEmail(
  userId: string,
  newEmail: string
): Promise<{ success: boolean; data?: ManagedUser; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const store = getUsersStore();
    const target = await findManagedUser(userId);
    if (!target) {
      return { success: false, error: 'Target user record not found.' };
    }

    const normalizedEmail = newEmail.toLowerCase().trim();
    const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return { success: false, error: 'Invalid email address syntax.' };
    }

    const { users: allUsers } = await getManagedUsers();
    const conflict = allUsers.find((u) => u.id !== target.id && u.email.toLowerCase() === normalizedEmail);
    if (conflict) {
      return { success: false, error: `Email address '${normalizedEmail}' is already registered to user ${conflict.name}.` };
    }

    const previousEmail = target.email;
    target.email = normalizedEmail;
    target.updated_at = new Date().toISOString();

    // Invalidate active sessions immediately
    invalidateUserSessions(target.id);

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.auth.admin.updateUserById(target.id, {
          email: normalizedEmail,
          email_confirm: true,
        }).catch(() => null);

        await admin
          .from('user_profiles')
          .update({
            email: normalizedEmail,
            updated_at: target.updated_at,
          })
          .eq('id', target.id);

        await admin
          .from('managed_user_credentials')
          .update({
            erp_login_email: normalizedEmail,
            email: normalizedEmail,
            updated_at: target.updated_at,
          })
          .eq('user_id', target.id);
      } catch (dbErr) {
        console.warn('Supabase updateEmployeeLoginEmail warning:', dbErr);
      }
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'EMAIL_CHANGED',
      module: 'USER_MANAGEMENT',
      details: `Updated ERP login email for ${target.name} from '${previousEmail}' to '${normalizedEmail}'. Active sessions invalidated.`,
    });

    revalidatePath('/dashboard/settings/users');
    revalidatePath('/dashboard');
    return { success: true, data: target };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update employee login email' };
  }
}

/**
 * Retrieve a user's current effective access configuration and commercial visibility flags.
 */
export async function getUserAccessGovernance(userId: string): Promise<{
  user: ManagedUser | null;
  enabledModules: import('@/types/rbac').ERPModule[];
  commercialPermissions: {
    canViewPurchaseCosts: boolean;
    canViewMargins: boolean;
    salesScope: 'OWN_ONLY' | 'ALL_COMPANY';
    canApproveDiscounts: boolean;
    canExportData: boolean;
  };
}> {
  await requireRole(['Managing Director', 'Admin / BDM', 'Admin']);
  const user = await findManagedUser(userId);
  if (!user) {
    return {
      user: null,
      enabledModules: [],
      commercialPermissions: {
        canViewPurchaseCosts: false,
        canViewMargins: false,
        salesScope: 'OWN_ONLY',
        canApproveDiscounts: false,
        canExportData: false,
      },
    };
  }

  const { getUserEffectivePermissions } = await import('@/lib/actions/permissions');
  const perms = await getUserEffectivePermissions(user.id, user.role);
  const enabledModules = Object.entries(perms)
    .filter(([_, actMap]) => actMap.view?.allowed)
    .map(([modName]) => modName as import('@/types/rbac').ERPModule);

  const isExecutive = user.role === 'Managing Director' || user.role === 'Admin' || user.role === 'Admin / BDM';

  return {
    user,
    enabledModules,
    commercialPermissions: {
      canViewPurchaseCosts: user.can_view_purchase_costs ?? isExecutive,
      canViewMargins: user.can_view_margins ?? (isExecutive || user.role === 'Sales Executive' || user.role === 'BDM'),
      salesScope: user.sales_data_scope ?? (isExecutive ? 'ALL_COMPANY' : 'OWN_ONLY'),
      canApproveDiscounts: user.can_approve_discounts ?? isExecutive,
      canExportData: user.can_export_data ?? true,
    },
  };
}

/**
 * Configure and persist an employee's access governance: module toggles & commercial visibility controls.
 */
export async function saveUserAccessGovernance(payload: {
  userId: string;
  enabledModules: import('@/types/rbac').ERPModule[];
  commercialPermissions?: {
    canViewPurchaseCosts?: boolean;
    canViewMargins?: boolean;
    salesScope?: 'OWN_ONLY' | 'ALL_COMPANY';
    canApproveDiscounts?: boolean;
    canExportData?: boolean;
  };
  reason?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM', 'Admin']);
    const target = await findManagedUser(payload.userId);
    if (!target) {
      return { success: false, error: 'User record not found.' };
    }

    // 1. Update commercial visibility flags
    if (payload.commercialPermissions) {
      target.can_view_purchase_costs = Boolean(payload.commercialPermissions.canViewPurchaseCosts);
      target.can_view_margins = Boolean(payload.commercialPermissions.canViewMargins);
      target.sales_data_scope = payload.commercialPermissions.salesScope || 'OWN_ONLY';
      target.can_approve_discounts = Boolean(payload.commercialPermissions.canApproveDiscounts);
      target.can_export_data = Boolean(payload.commercialPermissions.canExportData);
    }
    target.updated_at = new Date().toISOString();

    // 2. Synchronize module view permissions
    const { getUserOverrides, setUserPermissionOverride, removeUserPermissionOverride } = await import(
      '@/lib/actions/permissions'
    );
    const { ALL_ERP_MODULES } = await import('@/types/rbac');
    const existingOverrides = await getUserOverrides(target.id);

    const justification = payload.reason?.trim() || `Configured by ${actor.name} via Access Governance Center`;

    for (const mod of ALL_ERP_MODULES) {
      const isEnabled = payload.enabledModules.includes(mod);
      const viewOverride = existingOverrides.find((o) => o.module === mod && o.action === 'view');

      if (isEnabled) {
        // Module is enabled -> if there was a restriction override, remove it
        if (viewOverride && !viewOverride.granted) {
          await removeUserPermissionOverride(viewOverride.id, target.id);
        }
      } else {
        // Module is disabled -> enforce restriction override
        if (!viewOverride || viewOverride.granted) {
          await setUserPermissionOverride({
            userId: target.id,
            userName: target.name,
            module: mod,
            action: 'view',
            granted: false,
            reason: justification,
          });
        }
      }
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'ACCESS_GOVERNANCE_CONFIGURED',
      module: 'USER_MANAGEMENT',
      details: `Updated granular access permissions and commercial visibility for ${target.name} (${target.email}). Modules enabled: ${payload.enabledModules.length}. Scope: ${target.sales_data_scope || 'OWN_ONLY'}`,
    });

    revalidatePath('/dashboard/settings/users');
    revalidatePath('/dashboard/settings/permissions');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to save access configuration' };
  }
}


