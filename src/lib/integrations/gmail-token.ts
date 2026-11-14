import { encryptToken, decryptToken } from '@/lib/integrations/gmail-crypto';
import { getGmailOAuthCredentials } from '@/lib/integrations/gmail-env';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAuditEvent } from '@/lib/audit/logger';
import type { StoredGmailCredentials } from '@/types/gmail';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_GMAIL_INTEGRATION__: StoredGmailCredentials | null | undefined;
}

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.modify';
export const TARGET_ACCOUNT_EMAIL = 'icontechpro@gmail.com';

export function getCredentialsStore(): StoredGmailCredentials | null {
  if (globalThis.__ICON_GMAIL_INTEGRATION__ === undefined) {
    globalThis.__ICON_GMAIL_INTEGRATION__ = null;
  }
  return globalThis.__ICON_GMAIL_INTEGRATION__;
}

export function setCredentialsStore(creds: StoredGmailCredentials | null): void {
  globalThis.__ICON_GMAIL_INTEGRATION__ = creds;
}

/**
 * Server-only internal helper to obtain a fresh access token using the stored encrypted refresh token.
 * This function is NEVER exported from a 'use server' action file to prevent unauthorized public RPC calls.
 */
export async function getFreshAccessToken(): Promise<{
  accessToken: string;
  expiresIn: number;
} | null> {
  let creds = getCredentialsStore();

  // If memory store is empty and Supabase is online, check system_settings fallback
  if (!creds && (await isSupabaseAvailable())) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'gmail_oauth_integration')
        .maybeSingle();

      if (!error && data?.setting_value) {
        creds = data.setting_value as StoredGmailCredentials;
        setCredentialsStore(creds);
      }
    } catch {
      // Supabase table or record not present
    }
  }

  if (!creds?.encrypted_refresh_token || !creds.iv || !creds.tag) {
    return null;
  }

  // Check if existing access token is still valid (with 60-second safety buffer)
  const now = Date.now();
  if (
    creds.encrypted_access_token &&
    creds.access_token_expires_at &&
    creds.access_token_expires_at > now + 60000
  ) {
    try {
      const decrypted = decryptToken(creds.encrypted_access_token, creds.iv, creds.tag);
      return { accessToken: decrypted, expiresIn: Math.floor((creds.access_token_expires_at - now) / 1000) };
    } catch {
      // If decryption fails, proceed to refresh
    }
  }

  // Decrypt refresh token
  let refreshToken: string;
  try {
    refreshToken = decryptToken(creds.encrypted_refresh_token, creds.iv, creds.tag);
  } catch {
    throw new Error(
      'Your stored Gmail authorization could not be decrypted or has expired. Please reconnect Gmail in Settings > Integrations.'
    );
  }
  const { clientId, clientSecret, hasClientId, hasClientSecret } = getGmailOAuthCredentials();

  if (!hasClientId || !hasClientSecret || !clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured on server.');
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    console.error('Google token refresh failed:', errorBody);
    if (errorBody.includes('invalid_grant')) {
      throw new Error('Your Gmail authorization has expired or been revoked. Please reconnect Gmail in Settings > Integrations.');
    }
    throw new Error(`Failed to refresh Google access token: ${tokenResponse.status} ${tokenResponse.statusText}`);
  }

  const tokenData = await tokenResponse.json();
  const newAccessToken = tokenData.access_token;
  const expiresIn = tokenData.expires_in || 3600;

  // Cache encrypted access token
  const encAccess = encryptToken(newAccessToken);
  creds.encrypted_access_token = encAccess.ciphertext;
  creds.access_token_expires_at = Date.now() + expiresIn * 1000;
  setCredentialsStore(creds);

  return { accessToken: newAccessToken, expiresIn };
}

/**
 * Save newly exchanged OAuth credentials from callback route.
 * Internal server-side helper called only by the OAuth callback route.
 */
export async function saveGmailOAuthTokens(params: {
  refreshToken: string;
  accessToken?: string;
  expiresIn?: number;
  userId: string;
  userName: string;
  scopes?: string[];
}): Promise<boolean> {
  const encRefresh = encryptToken(params.refreshToken);
  let encAccessCipher: string | undefined;

  if (params.accessToken) {
    const encAccess = encryptToken(params.accessToken);
    encAccessCipher = encAccess.ciphertext;
  }

  const assignedScopes = params.scopes && params.scopes.length > 0 ? params.scopes : [GMAIL_SCOPE];

  const stored: StoredGmailCredentials = {
    account_email: TARGET_ACCOUNT_EMAIL,
    encrypted_refresh_token: encRefresh.ciphertext,
    encrypted_access_token: encAccessCipher,
    access_token_expires_at: params.expiresIn ? Date.now() + params.expiresIn * 1000 : undefined,
    scopes: assignedScopes,
    iv: encRefresh.iv,
    tag: encRefresh.tag,
    connected_at: new Date().toISOString(),
    connected_by_id: params.userId,
    connected_by_name: params.userName,
  };

  setCredentialsStore(stored);

  // Persist to system_settings in Supabase if online
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      await admin.from('system_settings').upsert({
        setting_key: 'gmail_oauth_integration',
        setting_value: stored,
        description: 'Google OAuth 2.0 Credentials for icontechpro@gmail.com',
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Failed to upsert to system_settings:', err);
    }
  }

  await logAuditEvent({
    userName: params.userName,
    action: 'GMAIL_OAUTH_COMPLETED',
    module: 'INTEGRATIONS',
    details: `Successfully connected Google OAuth for ${TARGET_ACCOUNT_EMAIL} with scope ${assignedScopes.join(', ')}`,
  });

  return true;
}
