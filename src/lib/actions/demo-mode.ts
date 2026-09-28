'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { DEMO_MODE_COOKIE_NAME } from '@/lib/constants/demo-mode';

export async function getDemoModeStatus(): Promise<{ isActive: boolean }> {
  const cookieStore = await cookies();
  const isActive = cookieStore.get(DEMO_MODE_COOKIE_NAME)?.value === 'true';
  return { isActive };
}

export async function toggleDemoMode(enable: boolean): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, error: 'Unauthorized. Please sign in.' };
  }

  // Only Managing Director and Admin / BDM may toggle demo mode
  if (user.role !== 'Managing Director' && user.role !== 'Admin / BDM') {
    return { success: false, error: 'Only Managing Director or Admin may toggle Training/Demo Mode.' };
  }

  const cookieStore = await cookies();
  if (enable) {
    cookieStore.set(DEMO_MODE_COOKIE_NAME, 'true', {
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
      sameSite: 'lax',
    });
  } else {
    cookieStore.delete(DEMO_MODE_COOKIE_NAME);
  }

  try {
    await logAuditEvent({
      userName: user.name,
      action: enable ? 'DEMO_ACTIVATED' : 'DEMO_DEACTIVATED',
      module: 'settings',
      details: `User ${user.name} (${user.role}) ${enable ? 'activated' : 'deactivated'} Training/Demo Mode`,
    });
  } catch (err) {
    console.error('Audit log error on toggleDemoMode:', err);
  }

  revalidatePath('/', 'layout');
  return { success: true };
}
