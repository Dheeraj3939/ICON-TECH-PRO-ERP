'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import { INITIAL_ROLES, DEFAULT_ROLE_PERMISSIONS, INITIAL_MANAGED_USERS } from '@/lib/constants/rbac-data';
import { getControlledModules, getControlledModuleByKey, registerControlledModule, unregisterControlledModule } from '@/lib/permissions/registry';
import type { AppRole, ERPModule, PermissionAction, RolePermissionMatrix, UserPermissionOverride, EffectivePermissionInfo, AccessLevel } from '@/types/rbac';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_ROLES__: AppRole[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_PERMISSIONS_MATRIX__: RolePermissionMatrix | undefined;
  // eslint-disable-next-line no-var
  var __ICON_USER_OVERRIDES__: UserPermissionOverride[] | undefined;
}

function getUserOverridesStore(): UserPermissionOverride[] {
  if (!globalThis.__ICON_USER_OVERRIDES__) {
    globalThis.__ICON_USER_OVERRIDES__ = [];
  }
  return globalThis.__ICON_USER_OVERRIDES__;
}

function getRolesStore(): AppRole[] {
  if (!globalThis.__ICON_ROLES__) {
    globalThis.__ICON_ROLES__ = [...INITIAL_ROLES];
  }
  return globalThis.__ICON_ROLES__;
}

function getMatrixStore(): RolePermissionMatrix {
  if (!globalThis.__ICON_PERMISSIONS_MATRIX__) {
    // Deep clone default permissions matrix
    globalThis.__ICON_PERMISSIONS_MATRIX__ = JSON.parse(
      JSON.stringify(DEFAULT_ROLE_PERMISSIONS)
    );
  }

  // Ensure all registered controlled modules exist in matrix for every role
  const matrix = globalThis.__ICON_PERMISSIONS_MATRIX__!;
  const roles = getRolesStore();
  const controlledModules = getControlledModules();

  for (const r of roles) {
    if (!matrix[r.role_name]) {
      matrix[r.role_name] = {} as any;
    }
    for (const mod of controlledModules) {
      if (!matrix[r.role_name][mod.name]) {
        const isExecutive = r.role_name === 'Managing Director' || r.role_name === 'Admin / BDM';
        matrix[r.role_name][mod.name] = {
          view: isExecutive,
          create: isExecutive,
          edit: isExecutive,
          delete: isExecutive,
          approve: isExecutive,
          export: isExecutive,
        };
      }
    }
  }

  return matrix;
}

/**
 * Retrieve all configured roles with active user counts.
 * Restricted to Managing Director and Admin / BDM.
 */
export async function getRoles(): Promise<{ roles: AppRole[]; total: number }> {
  await requireRole(['Managing Director', 'Admin / BDM']);

  const store = getRolesStore();

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('roles')
        .select('*, user_profiles(count)')
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped: AppRole[] = data.map((r: any) => ({
          id: r.id,
          role_name: r.role_name,
          description: r.description || '',
          is_system: r.is_system ?? true,
          user_count: r.user_profiles?.[0]?.count || 0,
          created_at: r.created_at,
        }));
        return { roles: mapped, total: mapped.length };
      }
    } catch (err) {
      console.warn('Supabase getRoles fallback:', err);
    }
  }

  return { roles: store, total: store.length };
}

/**
 * Create a new custom role.
 * Restricted to Managing Director and Admin / BDM.
 */
export async function createCustomRole(payload: {
  role_name: string;
  description: string;
  cloneFromRole?: string;
}): Promise<{ success: boolean; data?: AppRole; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const store = getRolesStore();
    const matrix = getMatrixStore();

    const normalizedName = payload.role_name.trim();
    if (!normalizedName) {
      return { success: false, error: 'Role name cannot be empty.' };
    }

    if (store.some((r) => r.role_name.toLowerCase() === normalizedName.toLowerCase())) {
      return {
        success: false,
        error: `A role named "${normalizedName}" already exists in the system.`,
      };
    }

    const newRole: AppRole = {
      id: `ROLE-${Date.now()}`,
      role_name: normalizedName,
      description: payload.description.trim(),
      is_system: false,
      user_count: 0,
      created_at: new Date().toISOString(),
    };

    store.push(newRole);

    // Initialize permissions: clone from selected base role or start blank
    if (payload.cloneFromRole && matrix[payload.cloneFromRole]) {
      matrix[normalizedName] = JSON.parse(JSON.stringify(matrix[payload.cloneFromRole]));
    } else {
      const defaultRolePerms: any = {};
      const modules = getControlledModules();

      for (const mod of modules) {
        defaultRolePerms[mod.name] = {
          view: false,
          create: false,
          edit: false,
          delete: false,
          approve: false,
          export: false,
        };
      }
      if (defaultRolePerms['Dashboard']) {
        defaultRolePerms['Dashboard'].view = true;
      }
      matrix[normalizedName] = defaultRolePerms;
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('roles').insert([
          {
            id: newRole.id,
            role_name: newRole.role_name,
            description: newRole.description,
            is_system: false,
          },
        ]);
      } catch (dbErr) {
        console.warn('Supabase createCustomRole failed:', dbErr);
      }
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'ROLE_CREATED',
      module: 'ROLE_MANAGEMENT',
      details: `Created new custom role "${newRole.role_name}" (${newRole.description})`,
    });

    revalidatePath('/dashboard/settings/roles');
    revalidatePath('/dashboard/settings/permissions');
    revalidatePath('/dashboard');
    return { success: true, data: newRole };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to create role' };
  }
}

/**
 * Delete a custom role.
 * RULE: Core system roles cannot be deleted. Custom roles cannot be deleted if users are currently assigned.
 */
export async function deleteRole(roleId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const store = getRolesStore();
    const matrix = getMatrixStore();

    const roleIdx = store.findIndex((r) => r.id === roleId);
    if (roleIdx === -1) {
      return { success: false, error: 'Target role not found.' };
    }

    const role = store[roleIdx];

    // Core System Role Guard
    if (role.is_system) {
      return {
        success: false,
        error: `Security Guard: "${role.role_name}" is a core system role required by the ERP architecture. System roles cannot be deleted.`,
      };
    }

    // User Assignment Check
    if ((role.user_count || 0) > 0) {
      return {
        success: false,
        error: `Cannot delete role "${role.role_name}" because ${role.user_count} user(s) are currently assigned to it. Reassign these users to another role before deleting.`,
      };
    }

    store.splice(roleIdx, 1);
    delete matrix[role.role_name];

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('roles').delete().eq('id', roleId);
      } catch (dbErr) {
        console.warn('Supabase deleteRole failed:', dbErr);
      }
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'ROLE_DELETED',
      module: 'ROLE_MANAGEMENT',
      details: `Deleted custom role "${role.role_name}"`,
    });

    revalidatePath('/dashboard/settings/roles');
    revalidatePath('/dashboard/settings/permissions');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to delete role' };
  }
}

/**
 * Retrieve the complete granular permission matrix across all roles, modules, and actions.
 * Restricted to Managing Director and Admin / BDM.
 */
export async function getRolePermissionMatrix(): Promise<RolePermissionMatrix> {
  await requireRole(['Managing Director', 'Admin / BDM']);
  return getMatrixStore();
}

/**
 * Update a specific permission toggle for a role dynamically.
 * Changes take effect immediately across sessions without code redeployment.
 */
export async function updateRolePermission(
  roleName: string,
  module: ERPModule,
  action: PermissionAction,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const matrix = getMatrixStore();

    if (!matrix[roleName]) {
      return { success: false, error: `Role "${roleName}" not found in permission matrix.` };
    }

    // Safety Guard: Do not allow revoking essential Admin / MD permissions from themselves
    if (
      (roleName === 'Managing Director' || roleName === 'Admin / BDM') &&
      (module === 'User Management' || module === 'Role & Permission Management' || module === 'System Settings') &&
      (action === 'edit' || action === 'view') &&
      !enabled
    ) {
      return {
        success: false,
        error: 'Safety Guard: Administrative roles cannot revoke their own User Management and Permission Management rights.',
      };
    }

    if (!matrix[roleName][module]) {
      matrix[roleName][module] = {
        view: false,
        create: false,
        edit: false,
        delete: false,
        approve: false,
        export: false,
      };
    }

    const previousValue = matrix[roleName][module][action];
    matrix[roleName][module][action] = enabled;

    await logAuditEvent({
      userName: actor.name,
      action: enabled ? 'PERMISSION_GRANTED' : 'PERMISSION_REVOKED',
      module: 'ROLE_MANAGEMENT',
      details: `Updated [${roleName}]: Set ${module} -> ${action} = ${enabled} (was ${previousValue})`,
    });

    revalidatePath('/dashboard/settings/permissions');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update permission' };
  }
}

/**
 * Save full permission matrix changes for a role.
 */
export async function updateFullRoleMatrix(
  roleName: string,
  permissions: Record<string, Record<PermissionAction, boolean>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const matrix = getMatrixStore();

    if (!matrix[roleName]) {
      return { success: false, error: `Role "${roleName}" not found in permission matrix.` };
    }

    // Protect administrative access
    if (roleName === 'Managing Director' || roleName === 'Admin / BDM') {
      if (permissions['User Management']) {
        permissions['User Management'].edit = true;
        permissions['User Management'].view = true;
      }
      if (permissions['Role & Permission Management']) {
        permissions['Role & Permission Management'].edit = true;
        permissions['Role & Permission Management'].view = true;
      }
      if (permissions['System Settings']) {
        permissions['System Settings'].edit = true;
        permissions['System Settings'].view = true;
      }
    }

    matrix[roleName] = permissions;

    await logAuditEvent({
      userName: actor.name,
      action: 'PERMISSION_MATRIX_UPDATED',
      module: 'ROLE_MANAGEMENT',
      details: `Saved full granular permission matrix for role "${roleName}"`,
    });

    revalidatePath('/dashboard/settings/permissions');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to save permission matrix' };
  }
}

/**
 * Check if a role has permission for a specific module and action.
 */
export async function hasRolePermission(
  roleName: string,
  module: ERPModule,
  action: PermissionAction
): Promise<boolean> {
  const matrix = getMatrixStore();
  const rolePerms = matrix[roleName];
  if (!rolePerms) return false;
  const modPerms = rolePerms[module];
  if (!modPerms) return false;
  return Boolean(modPerms[action]);
}

/**
 * Retrieve individual user permission overrides.
 */
export async function getUserOverrides(userId?: string): Promise<UserPermissionOverride[]> {
  const store = getUserOverridesStore();
  if (userId) {
    return store.filter((o) => o.userId === userId);
  }
  return [...store];
}

/**
 * Assign or update an individual user permission override with mandatory change reason.
 * Effective Permission = Role Default + Individual Addition (-) Individual Restriction + Temporary Access
 */
export async function setUserPermissionOverride(payload: {
  userId: string;
  userName?: string;
  module: ERPModule;
  action: PermissionAction;
  granted: boolean;
  reason: string;
  startDate?: string;
  endDate?: string;
  isTemporary?: boolean;
}): Promise<{ success: boolean; data?: UserPermissionOverride; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const store = getUserOverridesStore();

    const cleanReason = payload.reason?.trim();
    if (!cleanReason || cleanReason.length < 5) {
      return {
        success: false,
        error: 'A valid business justification/reason (minimum 5 characters) is required for individual permission changes.',
      };
    }

    if (payload.isTemporary && payload.endDate) {
      const endTimestamp = new Date(payload.endDate).getTime();
      if (isNaN(endTimestamp) || endTimestamp < Date.now()) {
        return {
          success: false,
          error: 'Temporary access end date must be a valid future date and time.',
        };
      }
    }

    // Check if override already exists for this user, module, and action
    const existingIdx = store.findIndex(
      (o) => o.userId === payload.userId && o.module === payload.module && o.action === payload.action
    );

    const overrideItem: UserPermissionOverride = {
      id: existingIdx !== -1 ? store[existingIdx].id : `ovr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: payload.userId,
      module: payload.module,
      action: payload.action,
      granted: payload.granted,
      reason: cleanReason,
      grantedBy: actor.name,
      grantedAt: new Date().toISOString(),
      startDate: payload.startDate,
      endDate: payload.endDate,
      isTemporary: Boolean(payload.isTemporary),
    };

    if (existingIdx !== -1) {
      store[existingIdx] = overrideItem;
    } else {
      store.push(overrideItem);
    }

    await logAuditEvent({
      userName: actor.name,
      action: payload.isTemporary
        ? 'TEMPORARY_ACCESS_GRANTED'
        : payload.granted
        ? 'USER_OVERRIDE_GRANTED'
        : 'USER_OVERRIDE_RESTRICTED',
      module: 'USER_MANAGEMENT',
      details: `${
        payload.isTemporary
          ? `Granted temporary access until ${payload.endDate}`
          : payload.granted
          ? 'Added individual permission'
          : 'Restricted permission'
      } [${payload.module} -> ${payload.action}] for user ${payload.userName || payload.userId}. Reason: "${cleanReason}"`,
    });

    revalidatePath('/dashboard/settings/permissions');
    revalidatePath('/dashboard/settings/users');
    revalidatePath('/dashboard/employees');
    return { success: true, data: overrideItem };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update user permission override' };
  }
}

/**
 * Remove an individual override, restoring default role inheritance.
 */
export async function removeUserPermissionOverride(
  overrideIdOrUserId: string,
  module?: ERPModule,
  action?: PermissionAction
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const store = getUserOverridesStore();
    let idx = -1;
    if (module && action) {
      idx = store.findIndex((o) => o.userId === overrideIdOrUserId && o.module === module && o.action === action);
    } else {
      idx = store.findIndex((o) => o.id === overrideIdOrUserId);
    }
    if (idx === -1) {
      return { success: false, error: 'Override record not found.' };
    }

    const removed = store[idx];
    store.splice(idx, 1);

    await logAuditEvent({
      userName: actor.name,
      action: 'USER_OVERRIDE_REMOVED',
      module: 'USER_MANAGEMENT',
      details: `Removed individual permission override [${removed.module} -> ${removed.action}] for user ${removed.userId}, restoring role inheritance.`,
    });

    revalidatePath('/dashboard/settings/permissions');
    revalidatePath('/dashboard/settings/users');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to remove override' };
  }
}

/**
 * Resolve effective permissions for a user across all modules.
 * Distinguishes inherited role permissions from individual additions, restrictions, and temporary access.
 */
export async function getUserEffectivePermissions(
  userId: string,
  roleName: string
): Promise<Record<string, Record<PermissionAction, EffectivePermissionInfo>>> {
  const matrix = getMatrixStore();
  const overrides = getUserOverridesStore().filter((o) => o.userId === userId);
  const rolePerms = matrix[roleName] || ({} as any);

  const controlledModules = getControlledModules();
  const actions: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'approve', 'export'];
  const result: Record<string, Record<PermissionAction, EffectivePermissionInfo>> = {};
  const now = Date.now();

  for (const mod of controlledModules) {
    result[mod.name] = {} as Record<PermissionAction, EffectivePermissionInfo>;
    for (const act of actions) {
      const roleAllowed = Boolean(rolePerms[mod.name]?.[act]);
      const override = overrides.find((o) => o.module === mod.name && o.action === act);

      if (override) {
        // Check temporary expiry
        if (override.isTemporary && override.endDate) {
          const endTimestamp = new Date(override.endDate).getTime();
          if (now > endTimestamp) {
            // Temporary access has expired -> fallback to role default
            result[mod.name][act] = {
              allowed: roleAllowed,
              source: 'TEMPORARY_EXPIRED',
              reason: `Temporary permission expired on ${override.endDate}`,
              overrideId: override.id,
              expiresAt: override.endDate,
            };
            continue;
          } else {
            // Temporary access active
            result[mod.name][act] = {
              allowed: override.granted,
              source: 'TEMPORARY_ADD',
              reason: override.reason,
              overrideId: override.id,
              expiresAt: override.endDate,
            };
            continue;
          }
        }

        // Permanent override
        result[mod.name][act] = {
          allowed: override.granted,
          source: override.granted ? 'INDIVIDUAL_ADD' : 'INDIVIDUAL_RESTRICT',
          reason: override.reason,
          overrideId: override.id,
        };
      } else {
        result[mod.name][act] = {
          allowed: roleAllowed,
          source: 'ROLE',
        };
      }
    }
  }

  return result;
}

/**
 * Universal authorization check evaluating role default + individual overrides + temporary access.
 */
export async function hasEffectivePermission(
  userContext: string | { role?: string; id?: string },
  module: ERPModule,
  action: PermissionAction
): Promise<boolean> {
  const roleName = typeof userContext === 'string' ? userContext : userContext.role || 'Sales Executive';
  const userId = typeof userContext === 'object' ? userContext.id : undefined;

  // If Managing Director, full access unless system critical safety guard
  if (roleName === 'Managing Director') return true;

  // Check individual override first if userId is available
  if (userId) {
    const store = getUserOverridesStore();
    const override = store.find((o) => o.userId === userId && o.module === module && o.action === action);
    if (override) {
      // Check if temporary and expired
      if (override.isTemporary && override.endDate) {
        const endTimestamp = new Date(override.endDate).getTime();
        if (Date.now() > endTimestamp) {
          // Expired -> fallback to role default
          return await hasRolePermission(roleName, module, action);
        }
      }
      return override.granted;
    }
  }

  // Fallback to role permission
  return await hasRolePermission(roleName, module, action);
}

/**
 * Reverse Permission Lookup: "Who Has Access to Module X?"
 */
export async function getModuleAccessSummary(module: ERPModule): Promise<{
  roles: { role_name: string; actions: PermissionAction[] }[];
  overrides: { userId: string; action: PermissionAction; granted: boolean; reason: string; isTemporary?: boolean; expiresAt?: string }[];
}> {
  await requireRole(['Managing Director', 'Admin / BDM']);
  const matrix = getMatrixStore();
  const overridesStore = getUserOverridesStore();

  const rolesSummary: { role_name: string; actions: PermissionAction[] }[] = [];
  const actions: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'approve', 'export'];

  for (const [roleName, modMap] of Object.entries(matrix)) {
    const activeActions: PermissionAction[] = [];
    for (const act of actions) {
      if (modMap[module]?.[act]) {
        activeActions.push(act);
      }
    }
    if (activeActions.length > 0) {
      rolesSummary.push({ role_name: roleName, actions: activeActions });
    }
  }

  const now = Date.now();
  const moduleOverrides = overridesStore
    .filter((o) => o.module === module)
    .filter((o) => {
      if (o.isTemporary && o.endDate) {
        return now <= new Date(o.endDate).getTime();
      }
      return true;
    })
    .map((o) => ({
      userId: o.userId,
      action: o.action,
      granted: o.granted,
      reason: o.reason,
      isTemporary: o.isTemporary,
      expiresAt: o.endDate,
    }));

  return { roles: rolesSummary, overrides: moduleOverrides };
}

/**
 * Employee-First Access Lookup: "What Access Does Employee Y Have?"
 */
export async function getEmployeeAccessSummary(
  userId: string,
  roleName: string
): Promise<{
  userId: string;
  roleName: string;
  modules: Array<{
    module: ERPModule;
    level: AccessLevel;
    allowedActions: PermissionAction[];
    overrides: Array<{
      action: PermissionAction;
      source: 'ROLE' | 'INDIVIDUAL_ADD' | 'INDIVIDUAL_RESTRICT' | 'TEMPORARY_ADD' | 'TEMPORARY_EXPIRED';
      reason?: string;
    }>;
  }>;
}> {
  await requireRole(['Managing Director', 'Admin / BDM']);
  const effective = await getUserEffectivePermissions(userId, roleName);
  const actions: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'approve', 'export'];

  const summary = Object.entries(effective).map(([modName, actMap]) => {
    const allowed = actions.filter((act) => actMap[act]?.allowed);
    let level: AccessLevel = 'NONE';
    if (allowed.length === actions.length) {
      level = 'FULL';
    } else if (allowed.length > 0) {
      level = 'LIMITED';
    }

    const actionOverrides = actions
      .filter((act) => actMap[act]?.source !== 'ROLE')
      .map((act) => ({
        action: act,
        source: actMap[act].source,
        reason: actMap[act].reason,
      }));

    return {
      module: modName as ERPModule,
      level,
      allowedActions: allowed,
      overrides: actionOverrides,
    };
  });

  return {
    userId,
    roleName,
    modules: summary,
  };
}

/**
 * Admin Server Action to register a controlled future module.
 */
export async function registerControlledModuleAction(payload: {
  key: string;
  name: ERPModule;
  label: string;
  category: any;
  route: string;
  iconName: string;
  description: string;
  defaultActions?: PermissionAction[];
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const res = registerControlledModule({
      ...payload,
      defaultActions: payload.defaultActions || ['view', 'create', 'edit', 'delete', 'approve', 'export'],
    });
    if (!res.success || !res.data) {
      return res;
    }

    // Initialize matrix for new module across existing roles
    const matrix = getMatrixStore();
    for (const role of getRolesStore()) {
      if (!matrix[role.role_name]) matrix[role.role_name] = {} as any;
      const isExecutive = role.role_name === 'Managing Director' || role.role_name === 'Admin / BDM';
      matrix[role.role_name][res.data.name] = {
        view: isExecutive,
        create: isExecutive,
        edit: isExecutive,
        delete: isExecutive,
        approve: isExecutive,
        export: isExecutive,
      };
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'CONTROLLED_MODULE_REGISTERED',
      module: 'SYSTEM_SETTINGS',
      details: `Registered new controlled module "${res.data.label}" (${res.data.name}) on route "${res.data.route}"`,
    });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/settings/permissions');
    return { success: true, data: res.data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to register module' };
  }
}

/**
 * Admin Server Action to unregister a controlled custom module.
 */
export async function unregisterControlledModuleAction(key: string): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const mod = getControlledModuleByKey(key);
    if (!mod) {
      return { success: false, error: `Module "${key}" not found.` };
    }

    const res = unregisterControlledModule(key);
    if (!res.success) {
      return res;
    }

    // Clean up from matrix
    const matrix = getMatrixStore();
    for (const roleName of Object.keys(matrix)) {
      delete matrix[roleName][mod.name];
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'CONTROLLED_MODULE_UNREGISTERED',
      module: 'SYSTEM_SETTINGS',
      details: `Unregistered controlled module "${mod.label}" (${mod.name})`,
    });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/settings/permissions');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to unregister module' };
  }
}

/**
 * Retrieve temporary permissions approaching expiry within specified days (default 7 days).
 * Proactive Administrative Security Warning — does not alter or extend permissions automatically.
 */
export async function getExpiringTemporaryAccess(days: number = 7): Promise<{
  expiring: Array<{
    id: string;
    userId: string;
    userName: string;
    role: string;
    module: ERPModule;
    action: PermissionAction;
    reason: string;
    startDate?: string;
    endDate: string;
    daysRemaining: number;
    isExpired: boolean;
  }>;
  totalExpiringSoon: number;
  totalExpired: number;
}> {
  await requireRole(['Managing Director', 'Admin / BDM']);
  const store = getUserOverridesStore();
  const now = Date.now();
  const thresholdMs = days * 24 * 60 * 60 * 1000;

  const temporaryOverrides = store.filter((o) => o.isTemporary && o.endDate);

  const results: Array<{
    id: string;
    userId: string;
    userName: string;
    role: string;
    module: ERPModule;
    action: PermissionAction;
    reason: string;
    startDate?: string;
    endDate: string;
    daysRemaining: number;
    isExpired: boolean;
  }> = [];

  let expiredCount = 0;
  let expiringSoonCount = 0;

  for (const o of temporaryOverrides) {
    const endTimestamp = new Date(o.endDate!).getTime();
    const diffMs = endTimestamp - now;
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const isExpired = diffMs <= 0;

    if (isExpired) {
      expiredCount++;
    } else if (diffMs <= thresholdMs) {
      expiringSoonCount++;
    }

    // Include if expired or expiring within threshold
    if (diffMs <= thresholdMs) {
      const userList = (globalThis as any).__ICON_MANAGED_USERS__ || INITIAL_MANAGED_USERS;
      const targetUser = userList.find((u: any) => u.id === o.userId);

      results.push({
        id: o.id,
        userId: o.userId,
        userName: targetUser ? targetUser.name : o.userId,
        role: targetUser ? targetUser.role : 'Assigned User',
        module: o.module,
        action: o.action,
        reason: o.reason,
        startDate: o.startDate,
        endDate: o.endDate!,
        daysRemaining: Math.max(0, daysRemaining),
        isExpired,
      });
    }
  }

  // Sort: Expired first, then soonest to expire
  results.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return {
    expiring: results,
    totalExpiringSoon: expiringSoonCount,
    totalExpired: expiredCount,
  };
}



