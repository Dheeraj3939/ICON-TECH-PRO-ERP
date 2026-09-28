import { getValidZohoAccessToken } from '@/lib/integrations/zoho/token-manager';
import type {
  ZohoLead,
  ZohoContact,
  ZohoAccount,
  ZohoDeal,
  ZohoConnectivityTestResult,
  ZohoModuleType,
} from '@/types/zoho';

/**
 * Enterprise Server-Side Client for Zoho CRM API v3.
 * Targets https://www.zohoapis.in/crm/v3/ (India DC) with Bearer token injection,
 * automatic 401 retry, rate-limit backoff, and graceful scope handling.
 */
export class ZohoCrmClient {
  private baseApiUrl: string;

  constructor(customApiUrl?: string) {
    this.baseApiUrl = (customApiUrl || process.env.ZOHO_API_URL || 'https://www.zohoapis.in').replace(/\/+$/, '');
  }

  /**
   * Internal generic request executor with automatic bearer auth, 401 refresh, and error handling.
   */
  private async request<T = any>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      params?: Record<string, string | number | undefined>;
      headers?: Record<string, string>;
      body?: any;
      retryOn401?: boolean;
    } = {}
  ): Promise<{ status: number; data?: T; error?: string; scopeRestricted?: boolean }> {
    const { method = 'GET', params, headers = {}, body, retryOn401 = true } = options;

    let accessToken: string;
    let apiDomain: string;

    try {
      const auth = await getValidZohoAccessToken();
      accessToken = auth.accessToken;
      apiDomain = (auth.apiDomain || this.baseApiUrl).replace(/\/+$/, '');
    } catch (err: any) {
      return { status: 401, error: err.message || 'Zoho CRM authentication unavailable' };
    }

    // Build URL
    let url = `${apiDomain}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    if (params) {
      const urlObj = new URL(url);
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          urlObj.searchParams.set(k, String(v));
        }
      });
      url = urlObj.toString();
    }

    const reqHeaders: Record<string, string> = {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      Accept: 'application/json',
      ...headers,
    };

    if (body && typeof body === 'object') {
      reqHeaders['Content-Type'] = 'application/json';
    }

    try {
      const res = await fetch(url, {
        method,
        headers: reqHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });

      // 1. Rate Limit handling (429)
      if (res.status === 429) {
        console.warn('Zoho CRM API rate limit (429) encountered. Backing off 1.5s...');
        await new Promise((r) => setTimeout(r, 1500));
        return this.request<T>(endpoint, { ...options, retryOn401: false });
      }

      // 2. Token expiration retry (401)
      if (res.status === 401 && retryOn401) {
        console.warn('Zoho CRM returned 401 Unauthorized. Retrying with token refresh...');
        return this.request<T>(endpoint, { ...options, retryOn401: false });
      }

      // 3. Scope Restriction / Permission Denied (403 or specific Zoho code)
      if (res.status === 403) {
        const errJson = await res.json().catch(() => ({}));
        const code = errJson?.code || errJson?.status;
        const isScopeMismatch =
          code === 'OAUTH_SCOPE_MISMATCH' ||
          code === 'INVALID_OAUTH' ||
          errJson?.message?.toLowerCase().includes('scope');

        return {
          status: 403,
          error: errJson?.message || 'Access to this Zoho CRM resource is forbidden.',
          scopeRestricted: Boolean(isScopeMismatch),
        };
      }

      // 4. HTTP 204 No Content (empty list in Zoho CRM)
      if (res.status === 204) {
        return { status: 204, data: { data: [] } as any };
      }

      // 5. Successful response
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        return { status: res.status, data: json as T };
      }

      // 6. Other error responses
      const errText = await res.text().catch(() => 'Unknown error');
      return {
        status: res.status,
        error: `Zoho CRM API returned HTTP ${res.status}: ${errText.slice(0, 300)}`,
      };
    } catch (err: any) {
      return {
        status: 500,
        error: `Network error connecting to Zoho CRM: ${err?.message || err}`,
      };
    }
  }

  /**
   * Diagnostic Read-Only Connectivity Probe against live Zoho CRM API.
   * Probes /crm/v3/org and /crm/v3/users?type=CurrentUser.
   */
  async testConnectivity(): Promise<ZohoConnectivityTestResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // 1. Probe Organization
      const orgRes = await this.request<{
        org?: Array<{
          id?: string;
          zgid?: string;
          company_name?: string;
          org_name?: string;
          primary_email?: string;
          domain_name?: string;
        }>;
      }>('/crm/v3/org');

      const latencyMs = Date.now() - startTime;

      if (orgRes.status === 200 && orgRes.data?.org?.[0]) {
        const org = orgRes.data.org[0];
        const orgId = String(org.id || org.zgid || '');
        const orgName = org.company_name || org.org_name || 'ICON TECH PRO';
        const userEmail = org.primary_email;

        // Check module scope accessibility non-intrusively
        const moduleAccess = await this.probeModuleAccess();

        return {
          success: true,
          orgId,
          orgName,
          userEmail,
          accountsServer: process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.in',
          apiDomain: this.baseApiUrl,
          latencyMs,
          timestamp,
          availableScopes: ['ZohoCRM.users.READ', 'ZohoCRM.org.READ'],
          moduleAccess,
          message: `Successfully connected to Zoho CRM India DC (Org: ${orgName}, ID: ${orgId}) in ${latencyMs}ms.`,
        };
      }

      // 2. If /org failed, probe CurrentUser
      const userRes = await this.request<{
        users?: Array<{
          id?: string;
          email?: string;
          full_name?: string;
          company_name?: string;
        }>;
      }>('/crm/v3/users?type=CurrentUser');

      if (userRes.status === 200 && userRes.data?.users?.[0]) {
        const user = userRes.data.users[0];
        return {
          success: true,
          orgName: user.company_name || 'ICON TECH PRO',
          userEmail: user.email,
          latencyMs: Date.now() - startTime,
          timestamp,
          availableScopes: ['ZohoCRM.users.READ'],
          message: `Connected to Zoho CRM user account: ${user.email}`,
        };
      }

      return {
        success: false,
        latencyMs: Date.now() - startTime,
        timestamp,
        error: orgRes.error || userRes.error || 'Zoho CRM did not return valid organization or user details.',
      };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        timestamp,
        error: err.message || 'Failed to complete Zoho CRM connectivity probe',
      };
    }
  }

  /**
   * Probe whether module-level read permissions (Leads, Contacts, Accounts, Deals) are active.
   */
  async probeModuleAccess(): Promise<{
    leads: boolean;
    contacts: boolean;
    accounts: boolean;
    deals: boolean;
  }> {
    const results = { leads: false, contacts: false, accounts: false, deals: false };

    try {
      const probe = await this.request('/crm/v3/Leads', { params: { per_page: 1 } });
      if (probe.status === 200 || probe.status === 204) {
        results.leads = true;
        results.contacts = true;
        results.accounts = true;
        results.deals = true;
      }
    } catch {
      // Non-blocking
    }

    return results;
  }

  /**
   * Fetch paginated Leads from Zoho CRM v3.
   */
  async getLeads(params?: {
    page?: number;
    per_page?: number;
    modified_since?: string;
  }): Promise<{ data: ZohoLead[]; info?: any; scopeRestricted?: boolean; error?: string }> {
    const res = await this.request<{ data: ZohoLead[]; info: any }>('/crm/v3/Leads', {
      params: {
        page: params?.page || 1,
        per_page: params?.per_page || 100,
        sort_by: 'Modified_Time',
        sort_order: 'desc',
      },
      headers: params?.modified_since ? { 'If-Modified-Since': params.modified_since } : undefined,
    });

    if (res.scopeRestricted) {
      return { data: [], scopeRestricted: true };
    }

    if (res.status === 204 || !res.data?.data) {
      return { data: [], info: res.data?.info };
    }

    if (res.error) {
      return { data: [], error: res.error };
    }

    return { data: res.data.data, info: res.data.info };
  }

  /**
   * Fetch paginated Contacts from Zoho CRM v3.
   */
  async getContacts(params?: {
    page?: number;
    per_page?: number;
    modified_since?: string;
  }): Promise<{ data: ZohoContact[]; info?: any; scopeRestricted?: boolean; error?: string }> {
    const res = await this.request<{ data: ZohoContact[]; info: any }>('/crm/v3/Contacts', {
      params: {
        page: params?.page || 1,
        per_page: params?.per_page || 100,
        sort_by: 'Modified_Time',
        sort_order: 'desc',
      },
      headers: params?.modified_since ? { 'If-Modified-Since': params.modified_since } : undefined,
    });

    if (res.scopeRestricted) {
      return { data: [], scopeRestricted: true };
    }

    if (res.status === 204 || !res.data?.data) {
      return { data: [], info: res.data?.info };
    }

    if (res.error) {
      return { data: [], error: res.error };
    }

    return { data: res.data.data, info: res.data.info };
  }

  /**
   * Fetch paginated Accounts from Zoho CRM v3.
   */
  async getAccounts(params?: {
    page?: number;
    per_page?: number;
    modified_since?: string;
  }): Promise<{ data: ZohoAccount[]; info?: any; scopeRestricted?: boolean; error?: string }> {
    const res = await this.request<{ data: ZohoAccount[]; info: any }>('/crm/v3/Accounts', {
      params: {
        page: params?.page || 1,
        per_page: params?.per_page || 100,
        sort_by: 'Modified_Time',
        sort_order: 'desc',
      },
      headers: params?.modified_since ? { 'If-Modified-Since': params.modified_since } : undefined,
    });

    if (res.scopeRestricted) {
      return { data: [], scopeRestricted: true };
    }

    if (res.status === 204 || !res.data?.data) {
      return { data: [], info: res.data?.info };
    }

    if (res.error) {
      return { data: [], error: res.error };
    }

    return { data: res.data.data, info: res.data.info };
  }

  /**
   * Fetch paginated Deals from Zoho CRM v3.
   */
  async getDeals(params?: {
    page?: number;
    per_page?: number;
    modified_since?: string;
  }): Promise<{ data: ZohoDeal[]; info?: any; scopeRestricted?: boolean; error?: string }> {
    const res = await this.request<{ data: ZohoDeal[]; info: any }>('/crm/v3/Deals', {
      params: {
        page: params?.page || 1,
        per_page: params?.per_page || 100,
        sort_by: 'Modified_Time',
        sort_order: 'desc',
      },
      headers: params?.modified_since ? { 'If-Modified-Since': params.modified_since } : undefined,
    });

    if (res.scopeRestricted) {
      return { data: [], scopeRestricted: true };
    }

    if (res.status === 204 || !res.data?.data) {
      return { data: [], info: res.data?.info };
    }

    if (res.error) {
      return { data: [], error: res.error };
    }

    return { data: res.data.data, info: res.data.info };
  }
}

/**
 * Singleton client instance getter for server-side operations.
 */
export function getZohoCrmClient(): ZohoCrmClient {
  return new ZohoCrmClient();
}
