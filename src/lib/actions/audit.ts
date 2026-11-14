'use server';

import { requireAuth, requireRole, getAuthenticatedUser } from '@/lib/auth/session';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  queryEnterpriseAuditLedger,
  verifyAuditChainIntegrity,
  createAuditCheckpoint,
  setAuditLegalHold,
  getAuditCheckpointsStore,
} from '@/lib/audit/enterprise-logger';
import type {
  EnterpriseAuditRecord,
  AuditFilterParams,
  AuditCheckpointRecord,
} from '@/types/security';

/**
 * Fetch filtered audit records for Central Audit Centre.
 * Role-based visibility:
 * - Managing Director and Admin / BDM can view all 13 views and company-wide logs.
 * - Other employees can only view their own employee-specific activity.
 */
export async function fetchEnterpriseAuditLogs(
  params?: AuditFilterParams
): Promise<{
  records: EnterpriseAuditRecord[];
  total: number;
  page: number;
  limit: number;
  userRole: string;
  isExecutive: boolean;
}> {
  const user = await requireAuth();
  const isExecutive = user.role === 'Managing Director' || user.role === 'Admin / BDM';

  const finalParams: AuditFilterParams = { ...(params || {}) };

  // If not executive, enforce strict filter to own employee_id
  if (!isExecutive) {
    finalParams.employee_id = user.id;
  }

  const result = await queryEnterpriseAuditLedger(finalParams);
  return {
    ...result,
    userRole: user.role,
    isExecutive,
  };
}

/**
 * Execute cryptographic audit chain verification on the fly.
 */
export async function verifyAuditIntegrityAction(): Promise<{
  isValid: boolean;
  checkedCount: number;
  errors: string[];
  headHash: string;
  genesisHash: string;
}> {
  await requireRole(['Managing Director', 'Admin / BDM']);
  return verifyAuditChainIntegrity();
}

/**
 * Create a signed integrity checkpoint.
 */
export async function createAuditCheckpointAction(): Promise<AuditCheckpointRecord> {
  await requireRole(['Managing Director', 'Admin / BDM']);
  return await createAuditCheckpoint();
}

/**
 * Retrieve recent integrity checkpoints.
 */
export async function getAuditCheckpointsAction(): Promise<AuditCheckpointRecord[]> {
  await requireRole(['Managing Director', 'Admin / BDM']);
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('audit_integrity_checkpoints')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && data) {
        return data as AuditCheckpointRecord[];
      }
    } catch {}
  }
  return getAuditCheckpointsStore();
}

/**
 * Toggle Legal Hold flag on a record to prevent any retention purge.
 */
export async function toggleLegalHoldAction(
  eventId: string,
  hold: boolean,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireRole(['Managing Director', 'Admin / BDM']);
  return await setAuditLegalHold(eventId, hold, reason, actor);
}
