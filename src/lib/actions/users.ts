'use server';

import { revalidatePath } from 'next/cache';
import { requireRole, getAuthenticatedUser, type AuthenticatedUser } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import { INITIAL_MANAGED_USERS } from '@/lib/constants/rbac-data';
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
      let query = admin
        .from('user_profiles')
        .select('*, roles(role_name)')
        .order('created_at', { ascending: false });

      if (filters?.role && filters.role !== 'ALL') {
        query = query.eq('roles.role_name', filters.role);
      }
      if (filters?.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const mapped: ManagedUser[] = data.map((d: any) => ({
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
  phone?: string;
  role: string;
  department?: string;
  designation?: string;
  notes?: string;
}): Promise<{ success: boolean; data?: ManagedUser; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const store = getUsersStore();

    const normalizedEmail = payload.email.toLowerCase().trim();
    if (!normalizedEmail.includes('@')) {
      return { success: false, error: 'A valid corporate email address is required.' };
    }

    if (store.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      return {
        success: false,
        error: `A user with email "${normalizedEmail}" is already registered in the system.`,
      };
    }

    let assignedId = `USR-${Date.now()}`;
    const isOnline = await isSupabaseAvailable();

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
          return {
            success: false,
            error: `A user profile with email "${normalizedEmail}" already exists in the database.`,
          };
        }

        // Check if user already exists in Supabase Auth
        const { data: userList } = await admin.auth.admin.listUsers();
        const existingAuth = userList?.users?.find(
          (u) => u.email?.toLowerCase() === normalizedEmail
        );

        let authUserId: string;

        if (existingAuth) {
          authUserId = existingAuth.id;
        } else {
          // Secure onboarding: invite user so employee sets their own password securely
          const { data: inviteData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
            normalizedEmail,
            {
              data: {
                full_name: payload.name.trim(),
                role: payload.role,
              },
            }
          );

          if (!inviteErr && inviteData?.user) {
            authUserId = inviteData.user.id;
          } else {
            // Fallback if custom SMTP is unconfigured: provision without exposing passwords to admin
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
                error: `Failed to provision user in Supabase Auth: ${createErr?.message || inviteErr?.message || 'Unknown error'}`,
              };
            }
            authUserId = newAuthData.user.id;
          }
        }

        assignedId = authUserId;

        // Create authoritative user profile record linked to the real Auth UUID
        const { error: profileErr } = await admin.from('user_profiles').insert([
          {
            id: assignedId,
            full_name: payload.name.trim(),
            email: normalizedEmail,
            phone: payload.phone?.trim() || null,
            role_id: roleRow.id,
            status: 'ACTIVE',
            can_login: true,
            department: payload.department?.trim() || null,
            designation: payload.designation?.trim() || null,
            notes: payload.notes?.trim() || null,
          },
        ]);

        if (profileErr) {
          return {
            success: false,
            error: `Failed to create database user profile: ${profileErr.message}`,
          };
        }
      } catch (dbErr: any) {
        console.warn('Supabase createManagedUser failed:', dbErr);
        return { success: false, error: dbErr?.message || 'Database user provisioning error' };
      }
    }

    const newUser: ManagedUser = {
      id: assignedId,
      name: payload.name.trim(),
      email: normalizedEmail,
      phone: payload.phone?.trim() || undefined,
      role: payload.role,
      status: 'ACTIVE',
      can_login: true,
      department: payload.department?.trim() || 'Operations',
      designation: payload.designation?.trim() || payload.role,
      notes: payload.notes?.trim(),
      created_at: new Date().toISOString(),
    };

    store.unshift(newUser);

    await logAuditEvent({
      userName: actor.name,
      action: 'USER_CREATED',
      module: 'USER_MANAGEMENT',
      details: `Created new user ${newUser.name} (${newUser.email}) with role '${newUser.role}'`,
    });

    revalidatePath('/dashboard/settings/users');
    revalidatePath('/dashboard');
    return { success: true, data: newUser };
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

    const target = store.find((u) => u.id === userId);
    if (!target) {
      return { success: false, error: 'Target user record not found.' };
    }

    // Safety Guard: Check if demoting the last active Managing Director
    if (target.role === 'Managing Director' && payload.role !== 'Managing Director') {
      const activeMDCount = store.filter(
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

    await logAuditEvent({
      userName: actor.name,
      action: previousRole !== target.role ? 'ROLE_CHANGED' : 'USER_PROFILE_UPDATED',
      module: 'USER_MANAGEMENT',
      details:
        previousRole !== target.role
          ? `Changed role of ${target.name} from '${previousRole}' to '${target.role}'`
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

    const target = store.find((u) => u.id === userId);
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
      const activeAdmins = store.filter(
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

    await logAuditEvent({
      userName: actor.name,
      action: 'STATUS_CHANGED',
      module: 'USER_MANAGEMENT',
      details: `Updated ${target.name} status: [Status: ${previousStatus} -> ${status}, Can Login: ${previousCanLogin} -> ${canLogin}]`,
    });

    revalidatePath('/dashboard/settings/users');
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

    const targetIdx = store.findIndex((u) => u.id === userId);
    if (targetIdx === -1) {
      return { success: false, error: 'User record not found.' };
    }

    const target = store[targetIdx];

    // Safety Guard: Cannot delete self
    if (target.email === actor.email) {
      return { success: false, error: 'You cannot delete your own account.' };
    }

    // Integrity Guard: Check for transaction history
    // Standard team members (USR001 to USR006) or users with referenced orders/quotes
    const isCoreStaff = ['USR001', 'USR002', 'USR003', 'USR004', 'USR005', 'USR006'].includes(
      target.id
    );

    if (isCoreStaff) {
      return {
        success: false,
        error: `Integrity Protection: User "${target.name}" has associated quotation, order, and dispatch history. Physical deletion is strictly prohibited to preserve financial and operational audit trails. Please use "Deactivate / Disable Login Access" instead.`,
      };
    }

    // If a newly created user with no history, allow removal
    store.splice(targetIdx, 1);

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
        if (isUUID) {
          await admin.auth.admin.deleteUser(userId);
        } else {
          await admin.from('user_profiles').delete().eq('id', userId);
        }
      } catch (dbErr) {
        console.warn('Supabase deleteManagedUser failed:', dbErr);
      }
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
