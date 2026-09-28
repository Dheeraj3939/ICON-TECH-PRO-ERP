import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptToken, decryptToken } from '@/lib/integrations/zoho-crypto';
import { getZohoOAuthCredentials } from '@/lib/integrations/zoho-env';
import { logAuditEvent } from '@/lib/audit/logger';
import type { StoredZohoCredentials } from '@/types/zoho';

/**
 * Server-only Zoho CRM Token Lifecycle Manager.
 * Handles authenticated decryption, automatic background token refresh,
 * in-flight mutex deduplication, and persistence to integration_credentials.
 */

const ZOHO_INTEGRATION_ID = 'zoho_crm_icontechpro';
const EXPIRY_BUFFER_MS = 60 * 1000; // 60 seconds safety buffer

declare global {
  // eslint-disable-next-line no-var
  var __ICON_ZOHO_INTEGRATION__: StoredZohoCredentials | null | undefined;
}

// In-flight refresh promise mutex to prevent concurrent refresh stampedes
let activeRefreshPromise: Promise<{ accessToken: string; apiDomain: string }> | null = null;

function getZohoMemoryStore(): StoredZohoCredentials | null {
  if (globalThis.__ICON_ZOHO_INTEGRATION__ === undefined) {
    globalThis.__ICON_ZOHO_INTEGRATION__ = null;
  }
  return globalThis.__ICON_ZOHO_INTEGRATION__;
}

function setZohoMemoryStore(creds: StoredZohoCredentials | null): void {
  globalThis.__ICON_ZOHO_INTEGRATION__ = creds;
}

/**
 * Loads current stored Zoho credentials from database (fallback to memory store).
 */
export async function getStoredZohoCredentials(): Promise<StoredZohoCredentials | null> {
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('integration_credentials')
        .select('*')
        .eq('id', ZOHO_INTEGRATION_ID)
        .eq('provider', 'zoho_crm')
        .maybeSingle();

      if (!error && data) {
        const stored: StoredZohoCredentials = {
          id: data.id,
          provider: 'zoho_crm',
          account_identifier: data.account_identifier,
          encrypted_refresh_token: data.encrypted_refresh_token,
          encrypted_access_token: data.encrypted_access_token,
          token_expires_at: data.token_expires_at ? new Date(data.token_expires_at).getTime() : undefined,
          scopes: Array.isArray(data.scopes) ? data.scopes : [],
          iv: data.iv,
          tag: data.tag,
          status: data.status,
          connected_at: data.created_at || data.updated_at,
          connected_by_id: data.connected_by_id,
          connected_by_name: data.connected_by_name,
          metadata: data.metadata || {},
        };
        setZohoMemoryStore(stored);
        return stored;
      } else if (!error && !data) {
        setZohoMemoryStore(null);
        return null;
      }
    } catch (err: any) {
      console.warn('Database lookup error in getStoredZohoCredentials (using memory store):', err?.message);
    }
  }

  return getZohoMemoryStore();
}

/**
 * Persists updated tokens and metadata back to integration_credentials and memory.
 */
export async function updateStoredZohoTokens(params: {
  accessToken: string;
  expiresIn: number;
  newRefreshToken?: string;
  apiDomain?: string;
}): Promise<void> {
  const current = await getStoredZohoCredentials();
  if (!current) return;

  const encAccess = encryptToken(params.accessToken);
  const expiresAtMs = Date.now() + params.expiresIn * 1000;
  const expiresAtIso = new Date(expiresAtMs).toISOString();

  let encryptedRefresh = current.encrypted_refresh_token;
  let iv = current.iv;
  let tag = current.tag;

  if (params.newRefreshToken) {
    const encRefresh = encryptToken(params.newRefreshToken);
    encryptedRefresh = encRefresh.ciphertext;
    iv = encRefresh.iv;
    tag = encRefresh.tag;
  }

  const updatedMetadata = {
    ...current.metadata,
    api_domain: params.apiDomain || current.metadata?.api_domain,
    last_verified_at: new Date().toISOString(),
  };

  const updated: StoredZohoCredentials = {
    ...current,
    encrypted_access_token: encAccess.ciphertext,
    token_expires_at: expiresAtMs,
    encrypted_refresh_token: encryptedRefresh,
    iv,
    tag,
    metadata: updatedMetadata,
  };

  setZohoMemoryStore(updated);

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      await admin
        .from('integration_credentials')
        .update({
          encrypted_access_token: encAccess.ciphertext,
          token_expires_at: expiresAtIso,
          encrypted_refresh_token: encryptedRefresh,
          iv,
          tag,
          metadata: updatedMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ZOHO_INTEGRATION_ID);
    } catch (err: any) {
      console.warn('Could not persist updated token to database:', err?.message);
    }
  }
}

/**
 * Retrieves a guaranteed valid Zoho CRM access token.
 * If expired or nearing expiry (< 60s), automatically performs OAuth token refresh.
 */
export async function getValidZohoAccessToken(): Promise<{
  accessToken: string;
  apiDomain: string;
}> {
  // If a refresh is already in-flight, await the ongoing promise to avoid duplicate refreshes
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  const creds = await getStoredZohoCredentials();
  if (!creds || creds.status !== 'ACTIVE' || !creds.encrypted_refresh_token) {
    throw new Error('Zoho CRM is not connected or authorization has been revoked.');
  }

  const now = Date.now();
  const apiDomain = creds.metadata?.api_domain || process.env.ZOHO_API_URL || 'https://www.zohoapis.in';

  // 1. Check if existing access token is present and still valid
  if (
    creds.encrypted_access_token &&
    creds.token_expires_at &&
    creds.token_expires_at - now > EXPIRY_BUFFER_MS
  ) {
    try {
      const decryptedAccess = decryptToken(creds.encrypted_access_token, creds.iv, creds.tag);
      if (decryptedAccess) {
        return {
          accessToken: decryptedAccess,
          apiDomain,
        };
      }
    } catch {
      // If access token decryption fails, fall through to refresh
    }
  }

  // 2. Perform refresh under concurrency-safe mutex
  activeRefreshPromise = (async () => {
    try {
      const decryptedRefresh = decryptToken(creds.encrypted_refresh_token, creds.iv, creds.tag);
      if (!decryptedRefresh) {
        throw new Error('Failed to decrypt stored Zoho refresh token.');
      }

      const envCreds = getZohoOAuthCredentials();
      if (!envCreds.clientId || !envCreds.clientSecret) {
        throw new Error('ZOHO_CLIENT_ID or ZOHO_CLIENT_SECRET is missing from environment.');
      }

      const tokenEndpoint = `${envCreds.accountsUrl}/oauth/v2/token`;
      const refreshParams = new URLSearchParams({
        refresh_token: decryptedRefresh.trim(),
        client_id: envCreds.clientId.trim(),
        client_secret: envCreds.clientSecret.trim(),
        grant_type: 'refresh_token',
      });

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: refreshParams.toString(),
      });

      const tokenData = await response.json();

      if (!response.ok || tokenData.error) {
        const errorDetail = tokenData.error || `HTTP ${response.status}`;
        console.error('Zoho CRM token refresh failed:', errorDetail);

        if (tokenData.error === 'invalid_code' || tokenData.error === 'invalid_grant') {
          // Token is permanently invalid or revoked
          if (await isSupabaseAvailable()) {
            const admin = createAdminClient();
            await admin
              .from('integration_credentials')
              .update({ status: 'EXPIRED', updated_at: new Date().toISOString() })
              .eq('id', ZOHO_INTEGRATION_ID);
          }
        }

        await logAuditEvent({
          userName: 'SYSTEM',
          action: 'ZOHO_REFRESH_FAILED',
          module: 'INTEGRATIONS',
          details: `Zoho CRM token refresh failed: ${errorDetail}`,
        });

        throw new Error(`Zoho token refresh failed: ${errorDetail}`);
      }

      const freshAccessToken = tokenData.access_token;
      const expiresIn = tokenData.expires_in || 3600;
      const resolvedApiDomain = tokenData.api_domain || apiDomain;

      await updateStoredZohoTokens({
        accessToken: freshAccessToken,
        expiresIn,
        newRefreshToken: tokenData.refresh_token,
        apiDomain: resolvedApiDomain,
      });

      return {
        accessToken: freshAccessToken,
        apiDomain: resolvedApiDomain,
      };
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}
