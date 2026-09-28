export interface StoredZohoCredentials {
  id: string; // e.g. 'zoho_crm_icontechpro'
  provider: 'zoho_crm';
  account_identifier: string; // Org ID or User email
  encrypted_refresh_token: string;
  encrypted_access_token?: string;
  token_expires_at?: number; // Epoch timestamp in ms
  scopes: string[];
  iv: string;
  tag: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  connected_at?: string;
  connected_by_id?: string;
  connected_by_name?: string;
  metadata?: {
    api_domain?: string;
    accounts_server?: string;
    location?: string;
    org_id?: string;
    org_name?: string;
    user_email?: string;
    granted_scopes?: string[];
    token_type?: string;
    last_verified_at?: string;
    last_sync_at?: string;
    last_sync_status?: string;
    [key: string]: any;
  };
}

export interface ZohoConnectionInfo {
  configured: boolean;
  connected: boolean;
  status: 'CONNECTED' | 'NOT_CONNECTED' | 'EXPIRED';
  account_identifier?: string;
  org_name?: string;
  org_id?: string;
  user_email?: string;
  api_domain?: string;
  accounts_url?: string;
  scopes?: string[];
  connected_at?: string;
  connected_by?: string;
  expires_at?: number;
  last_checked?: string;
  last_verified_at?: string;
  api_status?: 'OPERATIONAL' | 'DEGRADED' | 'UNREACHABLE' | 'SCOPE_RESTRICTED';
  sync_summary?: {
    last_sync_at?: string;
    last_sync_status?: 'SUCCESS' | 'PARTIAL' | 'FAILED';
    records_synced_total?: number;
  };
  configured_env: {
    has_client_id: boolean;
    has_client_secret: boolean;
    redirect_uri?: string;
    accounts_url?: string;
    api_url?: string;
    is_placeholder: boolean;
  };
  error?: string;
}

export interface ZohoOAuthCredentials {
  clientId: string | null;
  clientSecret: string | null;
  redirectUri: string;
  accountsUrl: string;
  apiUrl: string;
  hasClientId: boolean;
  hasClientSecret: boolean;
  isPlaceholder: boolean;
}

export interface ZohoTokenResponse {
  access_token?: string;
  refresh_token?: string;
  api_domain?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
}

export interface ZohoConnectivityTestResult {
  success: boolean;
  orgId?: string;
  orgName?: string;
  userEmail?: string;
  accountsServer?: string;
  apiDomain?: string;
  availableScopes?: string[];
  moduleAccess?: {
    leads: boolean;
    contacts: boolean;
    accounts: boolean;
    deals: boolean;
  };
  latencyMs?: number;
  timestamp: string;
  message?: string;
  error?: string;
}

// ----------------------------------------------------------------------------
// Zoho CRM v3 Entity Schemas
// ----------------------------------------------------------------------------

export interface ZohoLookupRef {
  id: string;
  name?: string;
  [key: string]: any;
}

export interface ZohoLead {
  id: string;
  First_Name?: string | null;
  Last_Name: string;
  Company?: string | null;
  Email?: string | null;
  Phone?: string | null;
  Mobile?: string | null;
  Lead_Source?: string | null;
  Lead_Status?: string | null;
  Industry?: string | null;
  Street?: string | null;
  City?: string | null;
  State?: string | null;
  Zip_Code?: string | null;
  Country?: string | null;
  Description?: string | null;
  Designation?: string | null;
  Owner?: ZohoLookupRef;
  Created_Time?: string;
  Modified_Time?: string;
  [key: string]: any;
}

export interface ZohoContact {
  id: string;
  First_Name?: string | null;
  Last_Name: string;
  Account_Name?: ZohoLookupRef | null;
  Email?: string | null;
  Phone?: string | null;
  Mobile?: string | null;
  Title?: string | null;
  Department?: string | null;
  Mailing_Street?: string | null;
  Mailing_City?: string | null;
  Mailing_State?: string | null;
  Mailing_Zip?: string | null;
  Mailing_Country?: string | null;
  Description?: string | null;
  Owner?: ZohoLookupRef;
  Created_Time?: string;
  Modified_Time?: string;
  [key: string]: any;
}

export interface ZohoAccount {
  id: string;
  Account_Name: string;
  Phone?: string | null;
  Website?: string | null;
  Billing_Street?: string | null;
  Billing_City?: string | null;
  Billing_State?: string | null;
  Billing_Code?: string | null;
  Billing_Country?: string | null;
  Shipping_Street?: string | null;
  Shipping_City?: string | null;
  Shipping_State?: string | null;
  Shipping_Code?: string | null;
  Shipping_Country?: string | null;
  Industry?: string | null;
  Annual_Revenue?: number | null;
  Description?: string | null;
  Owner?: ZohoLookupRef;
  Created_Time?: string;
  Modified_Time?: string;
  [key: string]: any;
}

export interface ZohoDeal {
  id: string;
  Deal_Name: string;
  Stage: string;
  Amount?: number | null;
  Closing_Date?: string | null;
  Account_Name?: ZohoLookupRef | null;
  Contact_Name?: ZohoLookupRef | null;
  Lead_Source?: string | null;
  Type?: string | null;
  Probability?: number | null;
  Expected_Revenue?: number | null;
  Description?: string | null;
  Owner?: ZohoLookupRef;
  Created_Time?: string;
  Modified_Time?: string;
  [key: string]: any;
}

// ----------------------------------------------------------------------------
// Zoho Synchronization Interfaces
// ----------------------------------------------------------------------------

export type ZohoModuleType = 'Leads' | 'Contacts' | 'Accounts' | 'Deals';

export interface ZohoSyncOptions {
  modules?: ZohoModuleType[];
  dryRun?: boolean;
  maxRecordsPerModule?: number;
  syncMode?: 'all' | 'incremental';
}

export interface ZohoModuleSyncStats {
  read: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export interface ZohoSyncResult {
  success: boolean;
  syncLogId: string;
  modules: Partial<Record<ZohoModuleType, ZohoModuleSyncStats>>;
  totalRead: number;
  totalCreated: number;
  totalUpdated: number;
  totalSkipped: number;
  totalFailed: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  message?: string;
  error?: string;
}

export interface ZohoSyncHistoryItem {
  id: string;
  provider: string;
  sync_type: string;
  status: 'PENDING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
  records_read: number;
  records_created: number;
  records_updated: number;
  records_skipped: number;
  records_failed: number;
  modules_synced: string[];
  details?: any;
  error_message?: string | null;
  triggered_by_name?: string | null;
  started_at: string;
  completed_at?: string | null;
  duration_ms?: number | null;
  created_at: string;
}

export interface ZohoEntityMappingRecord {
  id: string;
  provider: 'zoho_crm';
  external_module: ZohoModuleType;
  external_id: string;
  erp_entity: 'customers' | 'enquiries' | 'opportunities';
  erp_id: string;
  sync_hash?: string;
  last_synced_at: string;
  metadata?: Record<string, any>;
}
