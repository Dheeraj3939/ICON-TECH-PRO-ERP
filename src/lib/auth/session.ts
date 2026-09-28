import { cookies, headers } from 'next/headers';
import type { UserRoleName } from '@/types/database';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRoleName;
  exp: number; // Unix timestamp
}

declare global {
  // eslint-disable-next-line no-var
  var __ICON_EPHEMERAL_SESSION_SECRET__: string | undefined;
}

function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET || process.env.SUPABASE_SECRET_KEY;
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
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days

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
  const exp = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  const payload: AuthenticatedUser = { ...user, exp };
  const jsonStr = JSON.stringify(payload);
  const payloadBase64 =
    typeof Buffer !== 'undefined'
      ? Buffer.from(jsonStr).toString('base64url')
      : btoa(jsonStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const signature = await signWithWebCrypto(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

export async function verifySignedToken(token: string): Promise<AuthenticatedUser | null> {
  if (!token || !token.includes('.')) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadStr, providedSig] = parts;
  const expectedSig = await signWithWebCrypto(payloadStr);

  if (providedSig !== expectedSig) return null;

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
  const token = await createSignedToken(user);
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

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete('erp_session_role');
  cookieStore.delete('erp_session_name');
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  return await verifySignedToken(token);
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

  if (!allowedRoles.includes(user.role)) {
    throw new Error(
      `FORBIDDEN: Role '${user.role}' is not authorized to perform this operation. Permitted roles: ${allowedRoles.join(', ')}`
    );
  }

  return user;
}
