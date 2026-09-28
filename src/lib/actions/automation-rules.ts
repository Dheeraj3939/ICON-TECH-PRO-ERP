'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { queueOutboxMessage } from '@/lib/actions/communication';
import type { WorkflowRule } from '@/types/erp';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_WORKFLOW_RULES__: WorkflowRule[] | undefined;
}

const INITIAL_RULES: WorkflowRule[] = [
  {
    id: 'WFR-001',
    name: 'Auto-Send WhatsApp Receipt on Customer Payment',
    trigger_event: 'PAYMENT_RECORDED',
    conditions: { min_amount: 1000 },
    action_type: 'SEND_WHATSAPP',
    action_payload: {
      template: 'PAYMENT_RECEIPT',
      message: 'Dear Customer, we gratefully acknowledge receipt of ₹{{amount}} for Invoice {{invoice_number}}. Official receipt attached.',
    },
    is_active: true,
    created_at: '2026-04-01T10:00:00.000Z',
  },
  {
    id: 'WFR-002',
    name: 'Overdue Invoice Escalation to Accounts Officer',
    trigger_event: 'INVOICE_OVERDUE',
    conditions: { days_overdue: 15 },
    action_type: 'CREATE_TASK',
    action_payload: {
      task_title: 'Payment Recovery Follow-Up: {{customer_name}}',
      priority: 'HIGH',
      due_hours: 24,
    },
    is_active: true,
    created_at: '2026-04-01T10:00:00.000Z',
  },
  {
    id: 'WFR-003',
    name: 'Auto-Trigger Tally Sync on Approved Sales Invoice',
    trigger_event: 'INVOICE_ISSUED',
    conditions: { auto_sync_tally: true },
    action_type: 'GENERATE_REPORT',
    action_payload: {
      action: 'QUEUE_TALLY_SALES_VOUCHER',
    },
    is_active: true,
    created_at: '2026-04-01T10:00:00.000Z',
  },
];

function getRulesStore(): WorkflowRule[] {
  if (!globalThis.__ICON_WORKFLOW_RULES__) {
    globalThis.__ICON_WORKFLOW_RULES__ = [...INITIAL_RULES];
  }
  return globalThis.__ICON_WORKFLOW_RULES__;
}

/**
 * Fetch all configured automated workflow rules.
 */
export async function getWorkflowRules(): Promise<{ success: boolean; data: WorkflowRule[] }> {
  const store = getRulesStore();
  return { success: true, data: store };
}

/**
 * Create a new automated workflow trigger rule.
 */
export async function createWorkflowRule(
  ruleData: Omit<WorkflowRule, 'id' | 'created_at'>
): Promise<{ success: boolean; data?: WorkflowRule; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM']);
    const store = getRulesStore();

    const rule: WorkflowRule = {
      id: `WFR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ...ruleData,
      created_at: new Date().toISOString(),
    };

    store.unshift(rule);

    await logAuditEvent({
      userName: authUser.name,
      action: 'CREATE_WORKFLOW_RULE',
      module: 'AUTOMATION',
      details: `Created workflow automation rule: ${rule.name} (Trigger: ${rule.trigger_event})`,
    });

    return { success: true, data: rule };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to create workflow rule' };
  }
}

/**
 * Toggle active status of a workflow rule.
 */
export async function toggleWorkflowRule(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; data?: WorkflowRule; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM']);
    const store = getRulesStore();
    const rule = store.find((r) => r.id === id);

    if (!rule) {
      return { success: false, error: 'Workflow rule not found.' };
    }

    rule.is_active = isActive;

    await logAuditEvent({
      userName: authUser.name,
      action: 'TOGGLE_WORKFLOW_RULE',
      module: 'AUTOMATION',
      details: `Set workflow rule ${rule.name} active state to ${isActive}`,
    });

    return { success: true, data: rule };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to toggle workflow rule' };
  }
}

/**
 * Event bus dispatcher that executes active workflow rules matching an ERP trigger.
 */
export async function triggerWorkflowEvent(
  eventName: string,
  payload: Record<string, any>
): Promise<{ success: boolean; executedRulesCount: number; error?: string }> {
  try {
    const store = getRulesStore();
    const matchingRules = store.filter((r) => r.is_active && r.trigger_event === eventName);

    let executedCount = 0;

    for (const rule of matchingRules) {
      // Execute rule actions
      if (rule.action_type === 'SEND_WHATSAPP' && payload.customer_phone) {
        let msg = rule.action_payload.message || 'Notification from ICON TECH PRO';
        for (const [k, v] of Object.entries(payload)) {
          msg = msg.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
        }

        await queueOutboxMessage({
          channel: 'WHATSAPP',
          recipient_name: payload.customer_name || 'Customer',
          recipient: payload.customer_phone,
          subject: 'Payment Confirmation',
          message_body: msg,
          entity_type: 'CUSTOMER',
          entity_id: payload.customer_id,
        });
        executedCount++;
      } else if (rule.action_type === 'SEND_EMAIL' && payload.customer_email) {
        let msg = rule.action_payload.message || 'Notification from ICON TECH PRO';
        for (const [k, v] of Object.entries(payload)) {
          msg = msg.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
        }

        await queueOutboxMessage({
          channel: 'EMAIL',
          recipient_name: payload.customer_name || 'Customer',
          recipient: payload.customer_email,
          subject: rule.action_payload.subject || 'Important Notification from ICON TECH PRO',
          message_body: msg,
          entity_type: 'CUSTOMER',
          entity_id: payload.customer_id,
        });
        executedCount++;
      } else {
        executedCount++;
      }
    }

    return { success: true, executedRulesCount: executedCount };
  } catch (err) {
    return { success: false, executedRulesCount: 0, error: (err as Error).message || 'Failed to execute workflow events' };
  }
}
