import { INITIAL_AUDIT_LOGS } from '@/lib/constants/erp-data';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AuditLog } from '@/types/erp';

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

export async function logAuditEvent(params: {
  userName: string;
  action: string;
  module: string;
  details: string;
  ipAddress?: string;
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

  // If Supabase is online, log to audit_logs table
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
