/**
 * ICON TECH PRO ERP V9.2 — Enterprise Security, Authentication & Audit Ledger Types
 * Standard schema for identity lifecycle, lockout management, MFA, and cryptographic audit chaining.
 */

export type AccountLifecycleStatus =
  | 'ACTIVE'
  | 'INVITED'
  | 'PENDING'
  | 'PENDING_ACTIVATION'
  | 'SUSPENDED'
  | 'DEACTIVATED'
  | 'DISABLED'
  | 'OFFBOARDED';

export interface AccountSecurityRecord {
  user_id: string;
  email: string;
  failed_password_attempts: number;
  last_failed_attempt_at: string | null;
  is_locked: boolean;
  locked_until: string | null;
  lockout_count_24h: number;
  last_lockout_at: string | null;
  mfa_enabled: boolean;
  mfa_secret: string | null; // Stored securely; never exposed in public responses or logs
  mfa_enrolled_at: string | null;
  mfa_grace_period_ends_at?: string | null;
  backup_codes: string[]; // Stored as PBKDF2 hashes; never exposed in plaintext
  is_suspended: boolean;
  suspension_reason: string | null;
  suspended_at: string | null;
  suspended_by: string | null;
  force_password_reset: boolean;
  created_at: string;
  updated_at: string;
}

export interface MfaPolicyStatus {
  userId: string;
  email: string;
  role: string;
  mfaEnabled: boolean;
  policyStatus: 'ENFORCED_MANDATORY' | 'IN_GRACE_PERIOD' | 'EXPIRED_GRACE_ACTION_REQUIRED' | 'COMPLIANT';
  gracePeriodEndsAt?: string | null;
  daysRemainingInGrace?: number;
  enforcementRequired: boolean;
  canBypassMfaSetup: boolean;
  reminderNotice?: string;
}

export type AuditCategory =
  | 'EMPLOYEE_ACTIVITY'
  | 'BUSINESS_AUDIT'
  | 'SECURITY_EVENT'
  | 'SYSTEM_EVENT';

export type AuditSeverity = 'INFO' | 'WARNING' | 'SECURITY' | 'CRITICAL';

export type AuditOutcome = 'SUCCESS' | 'FAILURE' | 'BLOCKED';

export type AuditRetentionCategory =
  | 'FINANCIAL'
  | 'COMMERCIAL'
  | 'CUSTOMER'
  | 'AUDIT'
  | 'COMMUNICATION'
  | 'SYSTEM';

export interface AuditFieldDiff {
  field: string;
  field_label?: string;
  old_value: any;
  new_value: any;
}

export interface EnterpriseAuditRecord {
  event_id: string;
  timestamp: string; // ISO-8601 string
  timezone: string; // 'Asia/Kolkata (IST)'
  employee_id: string;
  user_name: string;
  role: string;
  category: AuditCategory;
  severity: AuditSeverity;
  module: string;
  action: string;
  record_type: string;
  record_id: string;
  related_context?: string;
  previous_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  diff?: AuditFieldDiff[];
  reason?: string;
  outcome: AuditOutcome;
  correlation_id?: string;
  source_ip: string;
  device_browser: string;
  previous_hash: string;
  integrity_hash: string;
  retention_category: AuditRetentionCategory;
  legal_hold: boolean;
}

export interface AuditCheckpointRecord {
  checkpoint_id: string;
  block_height: number;
  head_hash: string;
  timestamp: string;
  event_count: number;
  signed_digest: string;
}

export interface AuditFilterParams {
  category?: AuditCategory | 'ALL';
  module?: string | 'ALL';
  action?: string;
  severity?: AuditSeverity | 'ALL';
  employee_id?: string;
  role?: string;
  record_type?: string;
  record_id?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
  legal_hold_only?: boolean;
  page?: number;
  limit?: number;
}

export interface UserSecurityOverviewItem {
  user_id: string;
  name: string;
  email: string;
  role: string;
  status: AccountLifecycleStatus;
  is_locked: boolean;
  locked_until: string | null;
  remaining_lockout_seconds: number;
  failed_attempts: number;
  is_suspended: boolean;
  suspension_reason: string | null;
  mfa_enabled: boolean;
  mfa_required: boolean;
  last_login_at: string | null;
}
