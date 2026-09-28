'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptToken, generateOAuthState } from '@/lib/integrations/zoho-crypto';
import { getZohoOAuthCredentials } from '@/lib/integrations/zoho-env';
import { getStoredZohoCredentials } from '@/lib/integrations/zoho/token-manager';
import { getZohoCrmClient } from '@/lib/integrations/zoho/client';
import { executeZohoSync, getRecentZohoSyncLogs } from '@/lib/integrations/zoho/sync';
import type {
  ZohoConnectionInfo,
  StoredZohoCredentials,
  ZohoConnectivityTestResult,
  ZohoSyncOptions,
  ZohoSyncResult,
  ZohoSyncHistoryItem,
} from '@/types/zoho';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_ZOHO_INTEGRATION__: StoredZohoCredentials | null | undefined;
}

const ZOHO_INTEGRATION_ID = 'zoho_crm_icontechpro';
const ZOHO_STAGE1_SCOPES = ['ZohoCRM.users.READ', 'ZohoCRM.org.READ'];
const ZOHO_FULL_MODULE_SCOPES = [
  'ZohoCRM.users.READ',
  'ZohoCRM.org.READ',
  'ZohoCRM.modules.leads.READ',
  'ZohoCRM.modules.contacts.READ',
  'ZohoCRM.modules.accounts.READ',
  'ZohoCRM.modules.deals.READ',
];

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
 * Fetch Zoho account and organization profile using an active access token.
 */
export async function fetchZohoAccountDetails(
  accessToken: string,
  apiDomain: string
): Promise<{ orgId?: string; orgName?: string; userEmail?: string } | null> {
  const normalizedDomain = apiDomain.replace(/\/+$/, '');
  try {
    const orgRes = await fetch(`${normalizedDomain}/crm/v3/org`, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
    });

    if (orgRes.ok) {
      const orgData = await orgRes.json();
      const firstOrg = orgData.org?.[0];
      if (firstOrg) {
        return {
          orgId: String(firstOrg.id || firstOrg.zgid || ''),
          orgName: firstOrg.company_name || firstOrg.org_name || 'ICON TECH PRO',
          userEmail: firstOrg.primary_email || firstOrg.email || undefined,
        };
      }
    }

    const userRes = await fetch(`${normalizedDomain}/crm/v3/users?type=CurrentUser`, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
      },
    });

    if (userRes.ok) {
      const userData = await userRes.json();
      const firstUser = userData.users?.[0];
      if (firstUser) {
        return {
          userEmail: firstUser.email,
          orgName: firstUser.company_name || 'ICON TECH PRO',
        };
      }
    }
  } catch (err) {
    console.warn('Could not fetch Zoho account details (non-blocking):', err);
  }

  return null;
}

/**
 * Retrieve public connection status without exposing tokens or client secret.
 * Single persistent source of truth: integration_credentials in Supabase.
 */
export async function getZohoConnectionStatus(): Promise<ZohoConnectionInfo> {
  const envInfo = getZohoOAuthCredentials();
  const creds = await getStoredZohoCredentials();

  const isConnected = Boolean(creds && creds.status === 'ACTIVE' && creds.encrypted_refresh_token);

  return {
    configured: envInfo.hasClientId && envInfo.hasClientSecret && !envInfo.isPlaceholder,
    connected: isConnected,
    status: isConnected ? 'CONNECTED' : 'NOT_CONNECTED',
    account_identifier: creds?.account_identifier,
    org_name: creds?.metadata?.org_name,
    org_id: creds?.metadata?.org_id,
    user_email: creds?.metadata?.user_email || creds?.account_identifier,
    api_domain: creds?.metadata?.api_domain || envInfo.apiUrl,
    accounts_url: creds?.metadata?.accounts_server || envInfo.accountsUrl,
    scopes: creds?.scopes || ZOHO_STAGE1_SCOPES,
    connected_at: creds?.connected_at,
    connected_by: creds?.connected_by_name,
    expires_at: creds?.token_expires_at,
    last_checked: new Date().toISOString(),
    last_verified_at: creds?.metadata?.last_verified_at,
    api_status: creds?.metadata?.last_verified_at ? 'OPERATIONAL' : undefined,
    sync_summary: {
      last_sync_at: creds?.metadata?.last_sync_at,
      last_sync_status: creds?.metadata?.last_sync_status as any,
      records_synced_total: creds?.metadata?.records_synced_total,
    },
    configured_env: {
      has_client_id: envInfo.hasClientId,
      has_client_secret: envInfo.hasClientSecret,
      redirect_uri: envInfo.redirectUri,
      accounts_url: envInfo.accountsUrl,
      api_url: envInfo.apiUrl,
      is_placeholder: envInfo.isPlaceholder,
    },
  };
}

/**
 * Generate the Zoho CRM OAuth 2.0 authorization URL.
 * Restricted strictly to Managing Director and Admin / BDM.
 */
export async function initiateZohoAuthorization(options?: {
  promptConsent?: boolean;
  includeModuleScopes?: boolean;
}): Promise<{
  success: boolean;
  authorizationUrl?: string;
  error?: string;
}> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const { clientId, clientSecret, redirectUri, accountsUrl, hasClientId, hasClientSecret, isPlaceholder } =
      getZohoOAuthCredentials();

    if (isPlaceholder) {
      return {
        success: false,
        error:
          'Zoho OAuth credentials in .env.local contain a placeholder. Please configure valid Zoho credentials.',
      };
    }

    if (!hasClientId || !clientId) {
      return {
        success: false,
        error: 'ZOHO_CLIENT_ID is missing from .env.local.',
      };
    }

    if (!hasClientSecret || !clientSecret) {
      return {
        success: false,
        error: 'ZOHO_CLIENT_SECRET is missing from .env.local.',
      };
    }

    const state = generateOAuthState(actor.id);
    const scopesToRequest = options?.includeModuleScopes ? ZOHO_FULL_MODULE_SCOPES : ZOHO_STAGE1_SCOPES;

    const params = new URLSearchParams({
      client_id: clientId.trim(),
      redirect_uri: redirectUri.trim(),
      response_type: 'code',
      access_type: 'offline',
      scope: scopesToRequest.join(','),
      state,
    });

    if (options?.promptConsent) {
      params.set('prompt', 'consent');
    }

    const authUrl = `${accountsUrl}/oauth/v2/auth?${params.toString()}`;

    await logAuditEvent({
      userName: actor.name,
      action: 'ZOHO_OAUTH_INITIATED',
      module: 'INTEGRATIONS',
      details: `Initiated Zoho CRM OAuth authorization flow for accounts URL: ${accountsUrl}`,
    });

    return {
      success: true,
      authorizationUrl: authUrl,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to initiate Zoho CRM authorization',
    };
  }
}

/**
 * Save newly exchanged Zoho OAuth tokens into integration_credentials table.
 */
export async function saveZohoOAuthTokens(params: {
  refreshToken: string;
  accessToken?: string;
  expiresIn?: number;
  apiDomain?: string;
  tokenType?: string;
  scopes?: string[];
  userId: string;
  userName: string;
  accountsUrl?: string;
}): Promise<boolean> {
  const encRefresh = encryptToken(params.refreshToken);
  let encAccessCipher: string | undefined;

  if (params.accessToken) {
    const encAccess = encryptToken(params.accessToken);
    encAccessCipher = encAccess.ciphertext;
  }

  const assignedScopes =
    params.scopes && params.scopes.length > 0 ? params.scopes : ZOHO_STAGE1_SCOPES;

  const accountsServer = params.accountsUrl || 'https://accounts.zoho.in';
  const apiDomain = params.apiDomain || 'https://www.zohoapis.in';

  let orgDetails: { orgId?: string; orgName?: string; userEmail?: string } | null = null;
  if (params.accessToken) {
    orgDetails = await fetchZohoAccountDetails(params.accessToken, apiDomain);
  }

  const accountIdentifier =
    orgDetails?.userEmail || orgDetails?.orgId || 'icontechpro-zoho-org';

  const metadata = {
    api_domain: apiDomain,
    accounts_server: accountsServer,
    location: accountsServer.endsWith('.in') ? 'IN' : 'GLOBAL',
    org_id: orgDetails?.orgId,
    org_name: orgDetails?.orgName || 'ICON TECH PRO',
    user_email: orgDetails?.userEmail,
    granted_scopes: assignedScopes,
    token_type: params.tokenType || 'Bearer',
    last_verified_at: new Date().toISOString(),
  };

  const expiresAtMs = params.expiresIn ? Date.now() + params.expiresIn * 1000 : undefined;
  const expiresAtDate = expiresAtMs ? new Date(expiresAtMs).toISOString() : undefined;

  const stored: StoredZohoCredentials = {
    id: ZOHO_INTEGRATION_ID,
    provider: 'zoho_crm',
    account_identifier: accountIdentifier,
    encrypted_refresh_token: encRefresh.ciphertext,
    encrypted_access_token: encAccessCipher,
    token_expires_at: expiresAtMs,
    scopes: assignedScopes,
    iv: encRefresh.iv,
    tag: encRefresh.tag,
    status: 'ACTIVE',
    connected_at: new Date().toISOString(),
    connected_by_id: params.userId,
    connected_by_name: params.userName,
    metadata,
  };

  setZohoMemoryStore(stored);

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const { error } = await admin.from('integration_credentials').upsert(
        {
          id: ZOHO_INTEGRATION_ID,
          provider: 'zoho_crm',
          account_identifier: accountIdentifier,
          encrypted_refresh_token: encRefresh.ciphertext,
          encrypted_access_token: encAccessCipher,
          token_expires_at: expiresAtDate,
          scopes: assignedScopes,
          iv: encRefresh.iv,
          tag: encRefresh.tag,
          status: 'ACTIVE',
          connected_by_id: params.userId,
          connected_by_name: params.userName,
          metadata,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (error) {
        console.error('Failed to persist Zoho credentials to integration_credentials:', error);
      }
    } catch (err) {
      console.warn('Failed to upsert to integration_credentials table:', err);
    }
  }

  await logAuditEvent({
    userName: params.userName,
    action: 'ZOHO_OAUTH_COMPLETED',
    module: 'INTEGRATIONS',
    details: `Successfully connected Zoho CRM OAuth for ${accountIdentifier} (Org: ${metadata.org_name}) with scopes: ${assignedScopes.join(', ')}`,
  });

  return true;
}

/**
 * Disconnect Zoho CRM integration.
 */
export async function disconnectZoho(): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);

    setZohoMemoryStore(null);

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('integration_credentials')
          .update({
            status: 'REVOKED',
            encrypted_refresh_token: '',
            encrypted_access_token: null,
            token_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', ZOHO_INTEGRATION_ID);
      } catch (err) {
        console.warn('Failed to revoke Zoho credentials in database:', err);
      }
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'ZOHO_DISCONNECTED',
      module: 'INTEGRATIONS',
      details: 'Zoho CRM integration was disconnected. Refresh token was revoked and purged.',
    });

    revalidatePath('/dashboard/settings/integrations');
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to disconnect Zoho CRM',
    };
  }
}

/**
 * Real Read-Only API Connectivity Probe against Zoho CRM v3 (/crm/v3/org).
 * Verifies live connection, token freshness, and organization identity.
 * Restricted to Managing Director and Admin / BDM.
 */
export async function testZohoApiConnectivityAction(): Promise<ZohoConnectivityTestResult> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const client = getZohoCrmClient();

    const probeResult = await client.testConnectivity();

    if (probeResult.success) {
      // Update last_verified_at in metadata
      const creds = await getStoredZohoCredentials();
      if (creds) {
        const updatedMetadata = {
          ...creds.metadata,
          last_verified_at: probeResult.timestamp,
          org_id: probeResult.orgId || creds.metadata?.org_id,
          org_name: probeResult.orgName || creds.metadata?.org_name,
        };
        creds.metadata = updatedMetadata;
        setZohoMemoryStore(creds);

        if (await isSupabaseAvailable()) {
          try {
            const admin = createAdminClient();
            await admin
              .from('integration_credentials')
              .update({ metadata: updatedMetadata, updated_at: new Date().toISOString() })
              .eq('id', ZOHO_INTEGRATION_ID);
          } catch {
            // Ignore
          }
        }
      }

      await logAuditEvent({
        userName: actor.name,
        action: 'ZOHO_TEST_SUCCESS',
        module: 'INTEGRATIONS',
        details: `Zoho CRM read-only probe successful: Org ${probeResult.orgName} (${probeResult.latencyMs}ms)`,
      });
    }

    return probeResult;
  } catch (err: any) {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      error: err.message || 'Zoho CRM connectivity test failed',
    };
  }
}

/**
 * Initiates controlled synchronization of Zoho CRM entities into ERP.
 * Restricted to Managing Director and Admin / BDM.
 */
export async function syncZohoCrmAction(options: ZohoSyncOptions = {}): Promise<ZohoSyncResult> {
  const actor = await requireRole(['Managing Director', 'Admin / BDM']);
  const result = await executeZohoSync(options, { id: actor.id, name: actor.name });

  // Update last_sync metadata
  const creds = await getStoredZohoCredentials();
  if (creds) {
    const updatedMetadata = {
      ...creds.metadata,
      last_sync_at: result.completedAt,
      last_sync_status: result.success ? 'SUCCESS' : 'FAILED',
      records_synced_total: (creds.metadata?.records_synced_total || 0) + result.totalCreated + result.totalUpdated,
    };
    creds.metadata = updatedMetadata;
    setZohoMemoryStore(creds);

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('integration_credentials')
          .update({ metadata: updatedMetadata, updated_at: new Date().toISOString() })
          .eq('id', ZOHO_INTEGRATION_ID);
      } catch {
        // Ignore
      }
    }
  }

  revalidatePath('/dashboard/settings/integrations');
  revalidatePath('/dashboard/customers');
  revalidatePath('/dashboard/enquiries');

  return result;
}

/**
 * Retrieve recent Zoho CRM synchronization history.
 */
export async function getZohoSyncHistoryAction(limit = 10): Promise<ZohoSyncHistoryItem[]> {
  await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);
  return getRecentZohoSyncLogs(limit);
}
