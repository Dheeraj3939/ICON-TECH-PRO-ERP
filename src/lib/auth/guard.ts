import { redirect } from 'next/navigation';
import { getAuthenticatedUser, requireAuth, type AuthenticatedUser } from '@/lib/auth/session';
import { hasEffectivePermission } from '@/lib/actions/permissions';
import type { ERPModule, PermissionAction } from '@/types/rbac';

/**
 * Server-side authorization guard for Server Actions and API mutations.
 * Validates authenticated session and effective permissions (Role + Overrides + Temporary Access).
 * Throws a structured Error if unauthorized.
 */
export async function requireModulePermission(
  module: ERPModule,
  action: PermissionAction
): Promise<AuthenticatedUser> {
  const user = await requireAuth();

  const isAllowed = await hasEffectivePermission(
    { id: user.id, role: user.role },
    module,
    action
  );

  if (!isAllowed) {
    throw new Error(
      `FORBIDDEN: User "${user.name}" (${user.role}) is not authorized to ${action} ${module}.`
    );
  }

  return user;
}

/**
 * Non-throwing permission checker for conditional server-side logic.
 */
export async function checkModulePermission(
  module: ERPModule,
  action: PermissionAction
): Promise<{ authorized: boolean; user: AuthenticatedUser | null }> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { authorized: false, user: null };
  }

  const authorized = await hasEffectivePermission(
    { id: user.id, role: user.role },
    module,
    action
  );

  return { authorized, user };
}

/**
 * Direct URL protection guard for Server Component pages.
 * If user is unauthenticated, redirects to /login.
 * If user lacks effective permission, redirects to /dashboard with an access error.
 */
export async function guardPagePermission(
  module: ERPModule,
  action: PermissionAction = 'view',
  redirectTo: string = '/dashboard?denied=1'
): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/login');
  }

  const isAllowed = await hasEffectivePermission(
    { id: user.id, role: user.role },
    module,
    action
  );

  if (!isAllowed) {
    redirect(redirectTo);
  }

  return user;
}
