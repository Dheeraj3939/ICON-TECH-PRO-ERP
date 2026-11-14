import { syncZohoOrganizationAndMailboxes } from '@/lib/integrations/zoho/employee-mapping';
import { executeZohoSync } from '@/lib/integrations/zoho/sync';
import { logAuditEvent } from '@/lib/audit/logger';

export interface ZohoScheduledRunResult {
  runId: string;
  startedAt: string;
  completedAt: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  mailResult?: any;
  crmResult?: any;
  errors: string[];
}

let isSyncRunning = false;
let lastSyncRun: ZohoScheduledRunResult | null = null;

export function getLastZohoScheduledRun(): ZohoScheduledRunResult | null {
  return lastSyncRun;
}

/**
 * Execute unified background reconciliation across Zoho Mail Organization and Zoho CRM.
 * Fully idempotent: prevents concurrent overlapping sync stampedes.
 */
export async function runZohoReconciliation(actor = { id: 'SYSTEM_SCHEDULER', name: 'Background Sync Worker' }): Promise<ZohoScheduledRunResult> {
  if (isSyncRunning) {
    return {
      runId: `SKIPPED-${Date.now()}`,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: 'PARTIAL',
      errors: ['Sync already in progress. Concurrent execution skipped to preserve idempotency.'],
    };
  }

  isSyncRunning = true;
  const startedAt = new Date().toISOString();
  const runId = `RUN-${Date.now()}`;
  const errors: string[] = [];

  let mailResult: any = null;
  let crmResult: any = null;

  try {
    // 1. Sync Zoho Mail Organization users and mailboxes
    try {
      mailResult = await syncZohoOrganizationAndMailboxes(actor);
    } catch (err: any) {
      errors.push(`Mail sync failure: ${err.message}`);
    }

    // 2. Sync Zoho CRM entities (incremental sync)
    try {
      crmResult = await executeZohoSync(
        { modules: ['Accounts', 'Contacts', 'Leads'], syncMode: 'incremental' },
        actor
      );
    } catch (err: any) {
      errors.push(`CRM sync failure: ${err.message}`);
    }

    const completedAt = new Date().toISOString();
    const status = errors.length === 0 ? 'SUCCESS' : errors.length < 2 ? 'PARTIAL' : 'FAILED';

    lastSyncRun = {
      runId,
      startedAt,
      completedAt,
      status,
      mailResult,
      crmResult,
      errors,
    };

    await logAuditEvent({
      userName: actor.name,
      action: 'ZOHO_ORGANIZATION_SYNC',
      module: 'INTEGRATIONS',
      details: `Automated Zoho reconciliation run completed with status: ${status}`,
    });

    return lastSyncRun;
  } finally {
    isSyncRunning = false;
  }
}
