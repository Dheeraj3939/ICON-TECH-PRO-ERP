import { INITIAL_AUDIT_LOGS } from '@/lib/constants/erp-data';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AuditLog } from '@/types/erp';
import { logEnterpriseAudit, type AuditCategory } from './enterprise-logger';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_AUDIT_LOGS__: AuditLog[] | undefined;
}

export function getAuditLogsStore(): AuditLog[] {
  if (!globalThis.__ICON_AUDIT_LOGS__) {
    globalThis.__ICON_AUDIT_LOGS__ = [...INITIAL_AUDIT_LOGS];
  }
  return globalThis.__ICON_AUDIT_LOGS__;
}

function resolveAuditTableName(module: string, action: string): string {
  const mod = (module || '').toLowerCase();
  if (mod === 'integrations' || action.startsWith('ZOHO_') || action.startsWith('GMAIL_')) {
    return 'integration_credentials';
  }
  if (mod === 'users' || mod === 'employees') return 'user_profiles';
  if (mod === 'roles' || mod === 'permissions') return 'role_permissions';
  if (mod === 'settings' || mod === 'company') return 'system_settings';
  if (mod === 'customers') return 'customers';
  if (mod === 'quotations') return 'quotations';
  if (mod === 'orders' || mod === 'sales') return 'sales_orders';
  if (mod === 'invoices') return 'invoices';
  return mod || 'system';
}

function mapToCategory(module: string, action: string): AuditCategory {
  const act = action.toUpperCase();
  const mod = module.toUpperCase();

  if (act.startsWith('SECURITY_') || act.includes('AUTH') || act.includes('LOGIN') || act.includes('LOCK') || act.includes('MFA') || act.includes('PASSWORD')) {
    return 'SECURITY_EVENT';
  }
  if (mod.includes('AUTOMATION') || mod.includes('REPORT') || mod.includes('SYSTEM') || mod.includes('INTEGRATION') || act.includes('CRON') || act.includes('SCHEDULED')) {
    return 'SYSTEM_EVENT';
  }
  if (mod.includes('QUOTATION') || mod.includes('ORDER') || mod.includes('INVOICE') || mod.includes('CHALLAN') || mod.includes('PROFORMA') || mod.includes('CUSTOMER') || mod.includes('ENQUIRY') || mod.includes('BILLING')) {
    return 'BUSINESS_AUDIT';
  }
  return 'EMPLOYEE_ACTIVITY';
}

export async function logAuditEvent(params: {
  userName: string;
  action: string;
  module: string;
  details: string;
  ipAddress?: string;
  previousValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  reason?: string;
}): Promise<AuditLog> {
  const store = getAuditLogsStore();
  const newLog: AuditLog = {
    id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    user_name: params.userName,
    action: params.action,
    module: params.module,
    details: params.details,
    ip_address: params.ipAddress || '127.0.0.1',
  };

  store.unshift(newLog);

  // Synchronously record in the Enterprise Central Audit Ledger with SHA-256 chaining
  try {
    const category = mapToCategory(params.module, params.action);
    await logEnterpriseAudit({
      userName: params.userName,
      category,
      module: params.module,
      action: params.action,
      relatedContext: params.details,
      previousValues: params.previousValues,
      newValues: params.newValues,
      reason: params.reason,
      sourceIp: params.ipAddress || '127.0.0.1',
    });
  } catch (err) {
    console.warn('logEnterpriseAudit bridging error:', err);
  }

  // If Supabase is online, log to legacy audit_logs table as well
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const tableName = resolveAuditTableName(params.module, params.action);
      const safeAction = params.action.length > 20 ? params.action.slice(0, 20) : params.action;
      await admin.from('audit_logs').insert([
        {
          table_name: tableName,
          action: safeAction,
          module: params.module,
          entity_name: params.module,
          record_id: newLog.id,
          performed_by_name: params.userName,
          details: { summary: params.details, full_action: params.action },
          ip_address: params.ipAddress || '127.0.0.1',
        },
      ]);
    } catch (err) {
      console.warn('Supabase audit log insert failed:', err);
    }
  }

  return newLog;
}
