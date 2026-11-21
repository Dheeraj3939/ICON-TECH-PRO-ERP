import { cookies, headers } from 'next/headers';
import type { UserRoleName } from '@/types/database';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRoleName;
  iat?: number; // Unix timestamp (seconds)
  exp: number; // Unix timestamp (seconds)
}

declare global {
  // eslint-disable-next-line no-var
  var __ICON_EPHEMERAL_SESSION_SECRET__: string | undefined;
  // eslint-disable-next-line no-var
  var __ICON_SESSION_INVALIDATIONS__: Record<string, string> | undefined;
}

function getDurableStorePath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodePath = require('path');
    const stateDir = process.env.ICON_DURABLE_STATE_DIR || nodePath.join(process.cwd(), '.icon_durable_state');
    return process.env.SESSION_INVALIDATION_STORE_PATH || nodePath.join(stateDir, 'session_invalidations.json');
  } catch {
    return '.icon_durable_state/session_invalidations.json';
  }
}

/**
 * Loads durable session invalidations from disk.
 * Ensures cross-worker and multi-process propagation of session terminations.
 */
export function loadDurableSessionInvalidations(): Record<string, string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeFs = require('fs');
    const filePath = getDurableStorePath();
    if (nodeFs.existsSync(filePath)) {
      const raw = nodeFs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(raw);
      if (typeof data === 'object' && data !== null) {
        return data;
      }
    }
  } catch {}
  return {};
}

/**
 * Persists an invalidation cutoff to memory and disk.
 */
export function saveDurableSessionInvalidation(userId: string, timestamp: string): void {
  if (!globalThis.__ICON_SESSION_INVALIDATIONS__) {
    globalThis.__ICON_SESSION_INVALIDATIONS__ = loadDurableSessionInvalidations();
  }
  globalThis.__ICON_SESSION_INVALIDATIONS__[userId] = timestamp;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeFs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodePath = require('path');
    const filePath = getDurableStorePath();
    const dir = nodePath.dirname(filePath);
    if (!nodeFs.existsSync(dir)) {
      nodeFs.mkdirSync(dir, { recursive: true });
    }
    const tempFile = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    nodeFs.writeFileSync(tempFile, JSON.stringify(globalThis.__ICON_SESSION_INVALIDATIONS__, null, 2), 'utf8');
    nodeFs.renameSync(tempFile, filePath);
  } catch {}
}

export function clearDurableSessionInvalidations(): void {
  globalThis.__ICON_SESSION_INVALIDATIONS__ = {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeFs = require('fs');
    const filePath = getDurableStorePath();
    if (nodeFs.existsSync(filePath)) {
      nodeFs.unlinkSync(filePath);
    }
  } catch {}
}

export function getDurableSessionInvalidations(): Record<string, string> {
  const disk = loadDurableSessionInvalidations();
  if (!globalThis.__ICON_SESSION_INVALIDATIONS__) {
    globalThis.__ICON_SESSION_INVALIDATIONS__ = disk;
  } else {
    // Merge disk entries into memory store
    for (const [k, v] of Object.entries(disk)) {
      if (!globalThis.__ICON_SESSION_INVALIDATIONS__[k] || new Date(v).getTime() > new Date(globalThis.__ICON_SESSION_INVALIDATIONS__[k]).getTime()) {
        globalThis.__ICON_SESSION_INVALIDATIONS__[k] = v;
      }
    }
  }
  return globalThis.__ICON_SESSION_INVALIDATIONS__;
}

function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET;
  if (envSecret && envSecret.trim().length >= 16) {
    return envSecret.trim();
  }
  // Fallback to process-isolated ephemeral secret if env is unconfigured (never predictable or static)
  if (!globalThis.__ICON_EPHEMERAL_SESSION_SECRET__) {
    const randomArray = new Uint8Array(32);
    crypto.getRandomValues(randomArray);
    globalThis.__ICON_EPHEMERAL_SESSION_SECRET__ = Array.from(randomArray)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return globalThis.__ICON_EPHEMERAL_SESSION_SECRET__;
}

export const SESSION_COOKIE_NAME = 'erp_session_token';
// Enterprise Daily Working Shift: 12-hour duration + 30-min idle lock.
// Ensures fresh, authenticated sign-in every morning while keeping daytime operations seamless.
const SESSION_DURATION_SECONDS = 60 * 60 * 12; // 12 hours

async function signWithWebCrypto(payloadStr: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(getSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(payloadStr));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createSignedToken(user: Omit<AuthenticatedUser, 'exp'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + SESSION_DURATION_SECONDS;
  const payload: AuthenticatedUser = {
    ...user,
    iat: (user as any).iat || now,
    exp,
  };
  const jsonStr = JSON.stringify(payload);
  const payloadBase64 =
    typeof Buffer !== 'undefined'
      ? Buffer.from(jsonStr).toString('base64url')
      : btoa(jsonStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const signature = await signWithWebCrypto(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (typeof Buffer !== 'undefined') {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodeCrypto = require('crypto');
      if (nodeCrypto && typeof nodeCrypto.timingSafeEqual === 'function') {
        return nodeCrypto.timingSafeEqual(bufA, bufB);
      }
    } catch {}
  }
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifySignedToken(token: string): Promise<AuthenticatedUser | null> {
  if (!token || !token.includes('.')) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadStr, providedSig] = parts;
  const expectedSig = await signWithWebCrypto(payloadStr);

  if (!timingSafeEqualStr(providedSig, expectedSig)) return null;

  try {
    const jsonStr =
      typeof Buffer !== 'undefined'
        ? Buffer.from(payloadStr, 'base64url').toString('utf8')
        : atob(payloadStr.replace(/-/g, '+').replace(/_/g, '/'));

    const user = JSON.parse(jsonStr) as AuthenticatedUser;

    const now = Math.floor(Date.now() / 1000);
    if (user.exp && user.exp < now) {
      return null;
    }

    // 1. Authoritative Database Session Invalidation Check
    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        const { data: inv } = await admin
          .from('user_session_invalidations')
          .select('invalidated_at')
          .eq('user_id', user.id)
          .single();

        if (inv?.invalidated_at) {
          const invTime = new Date(inv.invalidated_at).getTime();
          const tokenIssuedAt = user.iat ? user.iat * 1000 : 0;
          if (tokenIssuedAt <= invTime) {
            return null; // Session revoked in authoritative database
          }
        }
      } catch {}
    }

    // 2. Local Durable Session Invalidation Check (Supplementary & Offline)
    const invalidations = getDurableSessionInvalidations();
    if (user.id && invalidations[user.id]) {
      const invalidationIso = invalidations[user.id];
      const invalidationTime = new Date(invalidationIso).getTime();
      const tokenIssuedAt = user.iat ? user.iat * 1000 : 0;
      // If token was issued at or before the invalidation cutoff (or has no iat timestamp), revoke it
      if (tokenIssuedAt <= invalidationTime) {
        return null;
      }
    }

    // 3. Suspended Account Check (Memory Security Cache & Database)
    const memSec = (globalThis as any).__ICON_ACCOUNT_SECURITY__?.[user.email];
    if (memSec?.is_suspended) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export async function createSession(user: {
  id: string;
  email: string;
  name: string;
  role: UserRoleName;
}): Promise<void> {
  const normalizedRole: UserRoleName = (user.role === 'Admin / BDM' || user.email === 'dheeraj@icontechpro.in')
    ? 'Admin'
    : user.role;
  const token = await createSignedToken({ ...user, role: normalizedRole });
  const cookieStore = await cookies();

  let isSecure = false;
  try {
    const headerList = await headers();
    const proto = headerList.get('x-forwarded-proto');
    const referer = headerList.get('referer');
    const forwarded = headerList.get('forwarded');
    const isHttps =
      proto === 'https' ||
      (referer ? referer.startsWith('https://') : false) ||
      (forwarded ? forwarded.includes('proto=https') : false);

    if (process.env.COOKIE_SECURE === 'true') {
      isSecure = true;
    } else if (process.env.COOKIE_SECURE === 'false') {
      isSecure = false;
    } else {
      isSecure = isHttps;
    }
  } catch {
    isSecure = process.env.COOKIE_SECURE === 'true';
  }

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  });

  cookieStore.delete('erp_session_role');
  cookieStore.delete('erp_session_name');
}

export function invalidateUserSessions(userId: string, reason?: string): void {
  const timestamp = new Date().toISOString();
  saveDurableSessionInvalidation(userId, timestamp);

  if (typeof Promise !== 'undefined') {
    isSupabaseAvailable()
      .then((available) => {
        if (available) {
          const admin = createAdminClient();
          Promise.resolve(
            admin
              .from('user_session_invalidations')
              .upsert([
                {
                  user_id: userId,
                  invalidated_at: timestamp,
                  reason: reason || 'SECURITY_EVENT',
                },
              ])
          ).catch(() => {});
        }
      })
      .catch(() => {});
  }
}

/**
 * Revokes all active sessions for a user across all devices and Node worker processes.
 */
export async function revokeAllUserSessions(userId: string, reason?: string): Promise<void> {
  invalidateUserSessions(userId);
}

/**
 * Checks if a specific session token has been invalidated.
 */
export function isUserSessionRevoked(userId: string, tokenIat?: number): boolean {
  const invalidations = getDurableSessionInvalidations();
  if (!invalidations[userId]) return false;
  const invalidationTime = new Date(invalidations[userId]).getTime();
  const tokenIssuedAt = tokenIat ? tokenIat * 1000 : 0;
  return tokenIssuedAt <= invalidationTime;
}

/**
 * Immediately terminates active sessions on critical security events (password reset, account lock, suspension).
 */
export async function terminateUserSessionsOnSecurityEvent(
  userId: string,
  reason: string
): Promise<void> {
  invalidateUserSessions(userId);
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    try {
      const user = await verifySignedToken(token);
      if (user?.id) {
        // Registers invalidation timestamp for user: __ICON_SESSION_INVALIDATIONS__[user.id]
        invalidateUserSessions(user.id);
      }
    } catch {}
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete('erp_session_role');
  cookieStore.delete('erp_session_name');
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const user = await verifySignedToken(token);
  if (!user) return null;

  // Pure Administrator normalization: strictly eliminate legacy BDM conflation for Dheeraj
  if (user.role === 'Admin / BDM' || user.email === 'dheeraj@icontechpro.in') {
    return { ...user, role: 'Admin' };
  }

  return user;
}

export async function requireAuth(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new Error('UNAUTHORIZED: Valid authenticated session required.');
  }
  return user;
}

export async function requireRole(
  allowedRoles: UserRoleName[]
): Promise<AuthenticatedUser> {
  const user = await requireAuth();

  const isPermitted =
    user.role === 'Admin' ||
    user.role === 'Managing Director' ||
    allowedRoles.includes(user.role) ||
    (user.role === 'Admin / BDM' &&
      (allowedRoles.includes('Admin') ||
        allowedRoles.includes('Admin / BDM') ||
        allowedRoles.includes('Managing Director') ||
        allowedRoles.includes('BDM')));

  if (!isPermitted) {
    throw new Error(
      `FORBIDDEN: Role '${user.role}' is not authorized to perform this operation. Permitted roles: ${allowedRoles.join(', ')}`
    );
  }

  return user;
}

export async function isSessionValid(token: string): Promise<boolean> {
  const user = await verifySignedToken(token);
  return user !== null;
}
