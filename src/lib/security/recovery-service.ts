/**
 * ICON TECH PRO ERP V9.2 — Self-Service Password Recovery Engine
 * Implements:
 * - Anti-enumeration request handling
 * - Single-use, 15-minute cryptographically signed recovery tokens
 * - Strict password complexity validation (length, uppercase, lowercase, number, symbol)
 * - Administrative suspension checks (suspended accounts cannot be recovered)
 * - Immediate session revocation upon password change
 * - Email confirmation dispatch and comprehensive audit logging
 */

import crypto from 'crypto';
import { getAccountSecurity, resetFailedAttempts } from './lockout-service';
import { logEnterpriseAudit } from '@/lib/audit/enterprise-logger';
import { invalidateUserSessions } from '@/lib/auth/session';
import { EmailService } from '@/lib/email/email-service';
import { renderPasswordResetEmail } from '@/lib/email/auth-templates';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { getResolvedSiteUrl } from '@/lib/utils/site-url';
import { createAdminClient } from '@/lib/supabase/admin';
import { INITIAL_MANAGED_USERS } from '@/lib/constants/rbac-data';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_USED_RECOVERY_TOKENS__: Set<string> | undefined;
}

function getUsedTokensSet(): Set<string> {
  if (!globalThis.__ICON_USED_RECOVERY_TOKENS__) {
    globalThis.__ICON_USED_RECOVERY_TOKENS__ = new Set();
  }
  return globalThis.__ICON_USED_RECOVERY_TOKENS__;
}

/**
 * Validates corporate password complexity rules:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one numeric digit
 * - At least one special symbol
 */
export function validatePasswordComplexity(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long.');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z).');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z).');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number (0-9).');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&* etc.).');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Creates a single-use 15-minute cryptographically secure recovery token.
 */
export function createRecoveryToken(userId: string, email: string): string {
  const secret = process.env.ERP_SESSION_SECRET || 'icon_tech_pro_enterprise_salt_2026';
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes
  const tokenId = crypto.randomBytes(8).toString('hex');
  const payload = `${userId}|${email}|${expiresAt}|${tokenId}|password_recovery`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}|${signature}`).toString('base64url');
}

/**
 * Validates a recovery token without consuming it.
 */
export function verifyRecoveryToken(token: string): {
  valid: boolean;
  userId?: string;
  email?: string;
  tokenId?: string;
  error?: string;
} {
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const parts = raw.split('|');
    if (parts.length !== 6) {
      return { valid: false, error: 'Malformed recovery link.' };
    }

    const [userId, email, expiresAtStr, tokenId, type, signature] = parts;
    if (type !== 'password_recovery') {
      return { valid: false, error: 'Invalid token purpose.' };
    }

    // Check expiration
    if (Date.now() > parseInt(expiresAtStr, 10)) {
      return { valid: false, error: 'This recovery link has expired (15-minute limit). Please request a new link.' };
    }

    // Check if token has already been consumed
    const used = getUsedTokensSet();
    if (used.has(tokenId)) {
      return { valid: false, error: 'This recovery link has already been used. Please request a new link.' };
    }

    // Verify cryptographic signature
    const secret = process.env.ERP_SESSION_SECRET || 'icon_tech_pro_enterprise_salt_2026';
    const payload = `${userId}|${email}|${expiresAtStr}|${tokenId}|${type}`;
    const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return { valid: false, error: 'Invalid or forged recovery token signature.' };
    }

    // Verify account is not suspended
    const sec = getAccountSecurity(email);
    if (sec.is_suspended) {
      return {
        valid: false,
        error: 'This account has been administratively suspended. Password reset cannot be completed.',
      };
    }

    return { valid: true, userId, email, tokenId };
  } catch {
    return { valid: false, error: 'Invalid recovery link format.' };
  }
}

/**
 * Request password recovery.
 * Anti-enumeration guaranteed: always returns identical success message.
 */
export async function requestSelfServicePasswordRecovery(
  email: string,
  ip: string = '127.0.0.1'
): Promise<{ success: boolean; message: string }> {
  const cleanEmail = (email || '').toLowerCase().trim();
  const genericMessage =
    'If an authorized corporate account exists for this email address, password reset instructions have been dispatched.';

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { success: true, message: genericMessage };
  }

  // Lookup managed user or staff
  const managedUsers = globalThis.__ICON_MANAGED_USERS__ || INITIAL_MANAGED_USERS;
  const targetUser = managedUsers.find((u) => u.email.toLowerCase() === cleanEmail);

  if (!targetUser) {
    // Record security log for non-existent account probe
    await logEnterpriseAudit({
      userName: cleanEmail,
      category: 'SECURITY_EVENT',
      severity: 'INFO',
      module: 'AUTH',
      action: 'SECURITY_PASSWORD_RECOVERY_PROBE',
      reason: 'Password reset requested for unregistered email address.',
      outcome: 'BLOCKED',
      sourceIp: ip,
    });
    return { success: true, message: genericMessage };
  }

  const sec = getAccountSecurity(cleanEmail);
  if (sec.is_suspended) {
    await logEnterpriseAudit({
      employeeId: targetUser.id,
      userName: targetUser.name,
      role: targetUser.role,
      category: 'SECURITY_EVENT',
      severity: 'WARNING',
      module: 'AUTH',
      action: 'SECURITY_PASSWORD_RECOVERY_BLOCKED_SUSPENDED',
      recordType: 'USER_ACCOUNT',
      recordId: targetUser.id,
      reason: 'Password reset attempted on administratively suspended account.',
      outcome: 'BLOCKED',
      sourceIp: ip,
    });
    return { success: true, message: genericMessage };
  }

  // Generate 15-minute single-use token
  const token = createRecoveryToken(targetUser.id, targetUser.email);
  const siteUrl = await getResolvedSiteUrl();
  const resetUrl = `${siteUrl}/reset-password?token=${token}`;

  const emailTemplate = renderPasswordResetEmail({
    name: targetUser.name,
    email: targetUser.email,
    resetUrl,
    expiresHours: 0.25, // 15 minutes
  });

  const sendResult = await EmailService.sendEmail({
    to: targetUser.email,
    subject: 'Action Required: Reset Your ICON TECH PRO ERP Password',
    text: emailTemplate.text,
    html: emailTemplate.html,
    metadata: {
      entityType: 'general',
      userId: targetUser.id,
      userName: targetUser.name,
    },
  });

  await logEnterpriseAudit({
    employeeId: targetUser.id,
    userName: targetUser.name,
    role: targetUser.role,
    category: 'SECURITY_EVENT',
    severity: 'INFO',
    module: 'AUTH',
    action: 'SECURITY_PASSWORD_RECOVERY_DISPATCHED',
    recordType: 'USER_ACCOUNT',
    recordId: targetUser.id,
    reason: `Password reset token dispatched to verified company email via ${sendResult.provider}.`,
    outcome: 'SUCCESS',
    sourceIp: ip,
  });

  return { success: true, message: genericMessage };
}

/**
 * Complete password reset using valid recovery token.
 */
export async function completeSelfServicePasswordReset(
  token: string,
  newPassword: string,
  confirmPassword: string,
  ip: string = '127.0.0.1'
): Promise<{ success: boolean; message: string; error?: string }> {
  const tokenCheck = verifyRecoveryToken(token);
  if (!tokenCheck.valid || !tokenCheck.email || !tokenCheck.userId || !tokenCheck.tokenId) {
    return { success: false, message: '', error: tokenCheck.error || 'Invalid or expired recovery link.' };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, message: '', error: 'Passwords do not match.' };
  }

  const complexity = validatePasswordComplexity(newPassword);
  if (!complexity.valid) {
    return { success: false, message: '', error: complexity.errors.join(' ') };
  }

  // Consume the token immediately to prevent replay attacks
  getUsedTokensSet().add(tokenCheck.tokenId);

  // Hash new password using PBKDF2 SHA-512
  const salt = 'icon_tech_pro_enterprise_salt_2026';
  const hashedPassword = crypto.pbkdf2Sync(newPassword, salt, 100000, 64, 'sha512').toString('hex');

  // Update in-memory managed store
  if (globalThis.__ICON_MANAGED_USERS__) {
    const user = globalThis.__ICON_MANAGED_USERS__.find(
      (u) => u.id === tokenCheck.userId || u.email.toLowerCase() === tokenCheck.email!.toLowerCase()
    );
    if (user) {
      user.updated_at = new Date().toISOString();
    }
  }

  // Update in-memory credentials store
  const globalAny = globalThis as any;
  if (globalAny.__ICON_MANAGED_CREDENTIALS__) {
    const cred = globalAny.__ICON_MANAGED_CREDENTIALS__.find(
      (c: any) => c.user_id === tokenCheck.userId || c.email?.toLowerCase() === tokenCheck.email!.toLowerCase()
    );
    if (cred) {
      cred.password_hash = hashedPassword;
      cred.password = newPassword;
      cred.salt = salt;
    }
  }

  // If Supabase is online, update database
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      await admin
        .from('managed_user_credentials')
        .update({
          password_hash: hashedPassword,
          salt,
          updated_at: new Date().toISOString(),
        })
        .or(`user_id.eq.${tokenCheck.userId},email.eq.${tokenCheck.email}`);
    } catch (err) {
      console.warn('Supabase credential password update failed:', err);
    }
  }

  // Reset temporary lockout and failed attempts counter
  resetFailedAttempts(tokenCheck.email);

  // Invalidate all active sessions for this employee
  invalidateUserSessions(tokenCheck.userId);

  // Send security confirmation email
  await EmailService.sendEmail({
    to: tokenCheck.email,
    subject: 'Security Alert: Your ICON TECH PRO ERP Password Was Changed',
    text: `Hello, your ICON TECH PRO ERP password was successfully reset on ${new Date().toLocaleString(
      'en-IN',
      { timeZone: 'Asia/Kolkata' }
    )} IST. If you did not make this change, please contact system administration immediately.`,
    html: `<div style="font-family:sans-serif;padding:20px;color:#0f172a;"><h3>Password Changed Successfully</h3><p>Your ICON TECH PRO ERP account password was reset on ${new Date().toLocaleString(
      'en-IN',
      { timeZone: 'Asia/Kolkata' }
    )} IST.</p><p style="color:#e11d48;font-weight:bold;">If you did not make this change, please report this to your system administrator immediately.</p></div>`,
  });

  await logEnterpriseAudit({
    employeeId: tokenCheck.userId,
    userName: tokenCheck.email,
    role: 'Employee',
    category: 'SECURITY_EVENT',
    severity: 'SECURITY',
    module: 'AUTH',
    action: 'SECURITY_PASSWORD_RESET_SUCCESS',
    recordType: 'USER_ACCOUNT',
    recordId: tokenCheck.userId,
    reason: 'Employee successfully reset password using verified single-use recovery link.',
    outcome: 'SUCCESS',
    sourceIp: ip,
  });

  return {
    success: true,
    message: 'Your password has been reset successfully. Please sign in with your new password.',
  };
}
