'use server';

import { createSession } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { LEGITIMATE_UAT_USERS, type LegitimateUATUser } from '@/lib/uat/uat-users';

export async function switchUATUserSession(targetEmail: string): Promise<{ success: boolean; user?: LegitimateUATUser; error?: string }> {
  // Security Gate 1: Passwordless switching requires explicit ALLOW_PASSWORDLESS_UAT_SWITCH=true (disabled on cloud UAT)
  const isUat = process.env.NEXT_PUBLIC_ERP_ENV?.trim().toUpperCase() === 'UAT';
  const allowSwitch = process.env.ALLOW_PASSWORDLESS_UAT_SWITCH === 'true';
  if (!isUat || !allowSwitch) {
    return {
      success: false,
      error: 'Passwordless UAT switching is disabled. Please sign in with your email and password at /login.',
    };
  }

  // Security Gate 2: Strictly whitelist-only. Rejects arbitrary emails or roles
  const normalizedEmail = (targetEmail || '').toLowerCase().trim();
  const matchedUser = LEGITIMATE_UAT_USERS.find(
    (u) => u.email.toLowerCase() === normalizedEmail
  );

  if (!matchedUser) {
    return {
      success: false,
      error: `Access Denied: Email "${targetEmail}" is not one of the six predefined legitimate UAT test users.`,
    };
  }

  // Security Gate 3: Establish official session token with legitimate identity and RBAC role
  await createSession({
    id: matchedUser.id,
    email: matchedUser.email,
    name: matchedUser.name,
    role: matchedUser.role,
  });

  // Audit Gate: Record the controlled UAT session establishment
  await logAuditEvent({
    userName: `UAT-Reviewer (${matchedUser.name})`,
    action: 'UAT_USER_SWITCH',
    module: 'SECURITY',
    details: `UAT TEST USER SESSION — PORT 3001 established for ${matchedUser.name} <${matchedUser.email}> (${matchedUser.role}).`,
  });

  return { success: true, user: matchedUser };
}
