'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { getNextApprovalRequestNumber } from '@/lib/utils/sequence';
import type {
  ApprovalRequest,
  ApprovalType,
  ApprovalRequestStatus,
  ApprovalRuleConfig,
  UserRole,
} from '@/types/erp';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_APPROVAL_REQUESTS__: ApprovalRequest[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_APPROVAL_RULES__: ApprovalRuleConfig[] | undefined;
}

const DEFAULT_APPROVAL_RULES: ApprovalRuleConfig[] = [
  {
    id: 'RULE-DISC-01',
    approval_type: 'DISCOUNT',
    rule_name: 'Sales Executive Discount Cap',
    threshold_metric: 'discount_pct',
    threshold_operator: '>',
    threshold_value: 5,
    min_role_required: 'BDM',
    prevent_self_approval: true,
    is_active: true,
  },
  {
    id: 'RULE-DISC-02',
    approval_type: 'DISCOUNT',
    rule_name: 'BDM Commercial Discount Cap',
    threshold_metric: 'discount_pct',
    threshold_operator: '>',
    threshold_value: 12,
    min_role_required: 'Managing Director',
    prevent_self_approval: true,
    is_active: true,
  },
  {
    id: 'RULE-MARG-01',
    approval_type: 'MARGIN',
    rule_name: 'Low Margin Safety Trigger',
    threshold_metric: 'margin_pct',
    threshold_operator: '<',
    threshold_value: 15,
    min_role_required: 'Managing Director',
    prevent_self_approval: true,
    is_active: true,
  },
  {
    id: 'RULE-PO-01',
    approval_type: 'PURCHASE_ORDER',
    rule_name: 'High-Value Purchase Authorization',
    threshold_metric: 'po_value',
    threshold_operator: '>',
    threshold_value: 200000,
    min_role_required: 'Managing Director',
    prevent_self_approval: true,
    is_active: true,
  },
  {
    id: 'RULE-CRED-01',
    approval_type: 'CREDIT_LIMIT',
    rule_name: 'Extended Credit Period Approval',
    threshold_metric: 'credit_days',
    threshold_operator: '>',
    threshold_value: 30,
    min_role_required: 'Accounts',
    prevent_self_approval: true,
    is_active: true,
  },
];

const INITIAL_REQUESTS: ApprovalRequest[] = [
  {
    id: 'APR-001',
    request_number: 'ICON/26-27/APR-0001',
    approval_type: 'DISCOUNT',
    entity_type: 'quotations',
    entity_id: 'QT-1099',
    entity_number: 'ICON-EST-1099',
    requested_by_name: 'Vamshi Krishna',
    requested_by_role: 'Sales Executive',
    required_approver_role: 'BDM',
    requested_value: 8.5,
    threshold_limit: 5.0,
    status: 'PENDING',
    approval_notes: 'Client requested institutional education pricing for 5 classrooms.',
    prevent_self_approval: true,
    created_at: '2026-04-05T11:00:00.000Z',
  },
];

function getInternalRequestsStore(): ApprovalRequest[] {
  if (!globalThis.__ICON_APPROVAL_REQUESTS__) {
    globalThis.__ICON_APPROVAL_REQUESTS__ = [...INITIAL_REQUESTS];
  }
  return globalThis.__ICON_APPROVAL_REQUESTS__;
}

function getInternalRulesStore(): ApprovalRuleConfig[] {
  if (!globalThis.__ICON_APPROVAL_RULES__) {
    globalThis.__ICON_APPROVAL_RULES__ = [...DEFAULT_APPROVAL_RULES];
  }
  return globalThis.__ICON_APPROVAL_RULES__;
}

export async function getApprovalRules(): Promise<ApprovalRuleConfig[]> {
  return getInternalRulesStore();
}

export async function getApprovalRequests(filters?: {
  status?: ApprovalRequestStatus;
  type?: ApprovalType;
  scope?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MY_REQUESTS' | 'ALL';
}): Promise<{ requests: ApprovalRequest[]; total: number }> {
  const store = getInternalRequestsStore();
  const { getAuthenticatedUser } = await import('@/lib/auth/session');
  const authUser = await getAuthenticatedUser();

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const supabase = await createClient();
      let query = supabase.from('approval_requests').select('*', { count: 'exact' });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.type) {
        query = query.eq('approval_type', filters.type);
      }

      query = query.order('created_at', { ascending: false });
      const { data, error, count } = await query;
      if (!error && data && data.length > 0) {
        return { requests: data as ApprovalRequest[], total: count ?? data.length };
      }
    } catch (err) {
      console.warn('Supabase approval_requests query fallback to memory:', err);
    }
  }

  let filtered = [...store];

  if (filters?.scope === 'PENDING') {
    filtered = filtered.filter((r) => r.status === 'PENDING');
  } else if (filters?.scope === 'APPROVED') {
    filtered = filtered.filter((r) => r.status === 'APPROVED');
  } else if (filters?.scope === 'REJECTED') {
    filtered = filtered.filter((r) => r.status === 'REJECTED');
  } else if (filters?.scope === 'MY_REQUESTS' && authUser) {
    filtered = filtered.filter(
      (r) => r.requested_by_id === authUser.id || r.requested_by_name.toLowerCase() === authUser.name.toLowerCase()
    );
  }

  if (filters?.status) {
    filtered = filtered.filter((r) => r.status === filters.status);
  }
  if (filters?.type) {
    filtered = filtered.filter((r) => r.approval_type === filters.type);
  }

  return { requests: filtered, total: filtered.length };
}

/**
 * Submit an Approval Request for any commercial transaction.
 */
export async function createApprovalRequest(payload: {
  approval_type: ApprovalType;
  entity_type: string;
  entity_id: string;
  entity_number: string;
  requested_value: number;
  old_value?: any;
  proposed_value?: any;
  rule_id?: string;
  notes?: string;
  reason?: string;
}): Promise<{ success: boolean; data?: ApprovalRequest; error?: string }> {
  try {
    const authUser = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
      'Accounts',
      'Office Assistant',
    ]);
    const store = getInternalRequestsStore();
    const rules = getInternalRulesStore();

    // Locate applicable rule
    const matchingRule = rules.find(
      (r) => r.is_active && r.approval_type === payload.approval_type
    ) || {
      id: payload.rule_id || 'RULE-DEFAULT',
      min_role_required: 'Managing Director' as UserRole,
      threshold_value: 0,
      prevent_self_approval: true,
    };

    const reqNumber = await getNextApprovalRequestNumber();

    const request: ApprovalRequest = {
      id: `APR-${Date.now()}`,
      request_number: reqNumber,
      approval_type: payload.approval_type,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id,
      entity_number: payload.entity_number,
      requested_by_id: authUser.id,
      requested_by_name: authUser.name,
      requested_by_role: authUser.role as UserRole,
      required_approver_role: matchingRule.min_role_required,
      requested_value: payload.requested_value,
      threshold_limit: matchingRule.threshold_value,
      old_value: payload.old_value,
      proposed_value: payload.proposed_value,
      rule_id: payload.rule_id || matchingRule.id,
      status: 'PENDING',
      approval_notes: payload.notes || payload.reason,
      prevent_self_approval: matchingRule.prevent_self_approval,
      created_at: new Date().toISOString(),
    };

    store.unshift(request);

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('approval_requests').insert({
          request_number: request.request_number,
          approval_type: request.approval_type,
          entity_type: request.entity_type,
          entity_id: request.entity_id,
          entity_number: request.entity_number,
          requested_by_name: request.requested_by_name,
          requested_by_role: request.requested_by_role,
          required_approver_role: request.required_approver_role,
          requested_value: request.requested_value,
          threshold_limit: request.threshold_limit,
          status: request.status,
          approval_notes: request.approval_notes || null,
          prevent_self_approval: request.prevent_self_approval,
        });
      } catch (err) {
        console.warn('Supabase createApprovalRequest insert fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'SUBMIT_APPROVAL_REQUEST',
      module: 'APPROVALS',
      details: `Submitted ${payload.approval_type} approval request ${reqNumber} for ${payload.entity_number} (Value: ${payload.requested_value})`,
    });

    revalidatePath('/dashboard/quotations');
    revalidatePath('/dashboard');
    return { success: true, data: request };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to submit approval request' };
  }
}

/**
 * Process an Approval Request (Approve or Reject).
 * Strictly prevents self-approval when prohibited by rule.
 */
export async function processApprovalRequest(
  requestId: string,
  decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES',
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Accounts']);
    const store = getInternalRequestsStore();

    const found = store.find((r) => r.id === requestId || r.request_number === requestId);
    if (!found) {
      return { success: false, error: 'Approval request not found in active records.' };
    }

    if (found.status !== 'PENDING') {
      return { success: false, error: `Approval request is already ${found.status}.` };
    }

    // Role Hierarchy Validation
    const roleHierarchy: Record<UserRole, number> = {
      'Office Assistant': 1,
      'Sales Executive': 2,
      'Accounts': 3,
      'BDM': 4,
      'Admin / BDM': 5,
      'Managing Director': 6,
    };

    const userLevel = roleHierarchy[authUser.role as UserRole] || 0;
    const requiredLevel = roleHierarchy[found.required_approver_role] || 0;

    if (userLevel < requiredLevel) {
      return {
        success: false,
        error: `Unauthorized: Approval requires minimum role of ${found.required_approver_role}. Your role is ${authUser.role}.`,
      };
    }

    // STRICT SELF-APPROVAL GUARD
    if (found.prevent_self_approval && authUser.name === found.requested_by_name) {
      // Allow only Managing Director override if no higher role exists
      if (authUser.role !== 'Managing Director') {
        return {
          success: false,
          error: 'Strict Policy Violation: Self-approval is prohibited. An independent approver must review this request.',
        };
      }
    }

    found.status = decision === 'APPROVE' ? 'APPROVED' : decision === 'REJECT' ? 'REJECTED' : 'PENDING';
    found.decision = decision;
    found.decision_date = new Date().toISOString();
    found.approver_id = authUser.id;
    found.approver_name = authUser.name;
    if (decision === 'APPROVE') {
      found.approval_notes = notes || 'Approved per commercial guidelines';
    } else if (decision === 'REJECT') {
      found.rejection_reason = notes || 'Declined';
    } else {
      found.approval_notes = `Changes Requested: ${notes || 'Please revise terms'}`;
    }
    found.updated_at = new Date().toISOString();

    // Synchronize parent entity status
    if (found.entity_type === 'quotations') {
      const quotationsStore = globalThis.__ICON_QUOTATIONS__;
      const quote = quotationsStore?.find((q) => q.id === found.entity_id || q.quotation_number === found.entity_number);
      if (quote) {
        quote.status = decision === 'APPROVE' ? 'Approved' : 'Rejected';
        if (decision === 'APPROVE') {
          quote.approved_margin_pct = quote.margin_pct;
        }
      }
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('approval_requests')
          .update({
            status: found.status,
            approver_name: authUser.name,
            approval_notes: found.approval_notes || null,
            rejection_reason: found.rejection_reason || null,
            updated_at: found.updated_at,
          })
          .or(`id.eq.${requestId},request_number.eq.${requestId}`);

        if (found.entity_type === 'quotations') {
          await admin
            .from('quotations')
            .update({ status: decision === 'APPROVE' ? 'Approved' : 'Rejected' })
            .or(`id.eq.${found.entity_id},quotation_number.eq.${found.entity_number}`);
        }
      } catch (err) {
        console.warn('Supabase processApprovalRequest update fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: decision === 'APPROVE' ? 'APPROVE_REQUEST' : 'REJECT_REQUEST',
      module: 'APPROVALS',
      details: `${decision} request ${found.request_number} for ${found.entity_number} (${found.approval_type})`,
    });

    revalidatePath('/dashboard/quotations');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to process approval request' };
  }
}
