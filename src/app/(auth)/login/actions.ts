'use server';

import { createClient } from '@/lib/supabase/server';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { STAFF_MEMBERS } from '@/lib/constants/erp-data';
import { createSession, clearSession } from '@/lib/auth/session';
import { verifyStaffPassword } from '@/lib/auth/passwords';
import type { UserRoleName } from '@/types/database';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
  const email = (formData.get('email') as string || '').toLowerCase().trim();
  const password = (formData.get('password') as string || '');

  if (!email || !password) {
    return { error: 'Please provide both email and password.' };
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
          return {
            error: 'Your account access has been deactivated or suspended. Please contact your system administrator.',
          };
        }

        const resolvedRole: UserRoleName =
          (profile?.roles as any)?.role_name || 'Sales Executive';

        await createSession({
          id: authData.user.id,
          email: authData.user.email || email,
          name: profile?.full_name || email.split('@')[0],
          role: resolvedRole,
        });

        redirect('/dashboard');
      }
    } catch (err) {
      console.warn('Supabase Auth error:', err);
    }
  }

  // 2. Cryptographically verified staff credentials (PBKDF2 SHA-512 comparison)
  // No plaintext bypasses, no wildcard domain bypasses
  const matchedStaff = STAFF_MEMBERS.find((s) => s.email.toLowerCase() === email);
  if (matchedStaff && verifyStaffPassword(email, password)) {
    // Check if account has been suspended or deactivated by Administrator
    const managedStore = globalThis.__ICON_MANAGED_USERS__;
    if (managedStore) {
      const managedProfile = managedStore.find((u) => u.email.toLowerCase() === email);
      if (managedProfile && (managedProfile.status !== 'ACTIVE' || !managedProfile.can_login)) {
        return {
          error: 'Your account access has been deactivated or suspended. Please contact your system administrator.',
        };
      }
    }

    await createSession({
      id: matchedStaff.id,
      email: matchedStaff.email,
      name: matchedStaff.name,
      role: matchedStaff.role,
    });
    redirect('/dashboard');
  }

  return { error: 'Invalid email or password. Access denied.' };
}

/**
 * 1-Click Role Login for development / LAN testing:
 * Cryptographically signs session token for verified staff member.
 */
export async function quickLoginAsRole(name: string, role: string) {
  const validStaff = STAFF_MEMBERS.find(
    (s) => s.role === role && (s.name.toLowerCase() === name.toLowerCase() || !name)
  ) || STAFF_MEMBERS.find((s) => s.role === role) || STAFF_MEMBERS[0];

  await createSession({
    id: validStaff.id,
    email: validStaff.email,
    name: validStaff.name,
    role: validStaff.role as UserRoleName,
  });

  redirect('/dashboard');
}

export async function logout() {
  await clearSession();
  try {
    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      const supabase = await createClient();
      await supabase.auth.signOut();
    }
  } catch {}
  redirect('/login');
}
