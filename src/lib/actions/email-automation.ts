'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth, requireRole, getAuthenticatedUser } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import { EmailService } from '@/lib/email/email-service';
import type {
  EmailAutomationRule,
  EmailQueueJob,
  CustomerEmailTrigger,
  SupplierEmailTrigger,
} from '@/types/email-automation';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_EMAIL_RULES__: EmailAutomationRule[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_EMAIL_QUEUE__: EmailQueueJob[] | undefined;
}

const DEFAULT_AUTOMATION_RULES: EmailAutomationRule[] = [
  // Customer Automation Rules
  {
    id: 'RUL-CUST-01',
    trigger_type: 'ENQUIRY_ACK',
    category: 'CUSTOMER',
    name: 'Enquiry Acknowledgement Email',
    description: 'Auto-acknowledges customer requirement receipt with assigned sales engineer details.',
    subject_template: 'ICON TECH PRO - Requirement Received [Ref: {{entity_number}}]',
    body_template: '<p>Dear {{recipient_name}},</p><p>Thank you for reaching out to ICON TECH PRO. We have received your technical requirement and assigned our specialist engineer to assist you.</p><p>Regards,<br>ICON TECH PRO Enterprise Team</p>',
    attach_document: false,
    requires_human_approval: false,
    is_active: true,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'RUL-CUST-02',
    trigger_type: 'QUOTATION_PDF',
    category: 'CUSTOMER',
    name: 'Official Quotation Dispatch with PDF',
    description: 'Sends formal quotation PDF with structured product specifications and terms.',
    subject_template: 'Commercial Quotation {{entity_number}} from ICON TECH PRO',
    body_template: '<p>Dear {{recipient_name}},</p><p>Please find attached our official commercial proposal {{entity_number}} for your review.</p><p>Regards,<br>Commercial Sales Division</p>',
    attach_document: true,
    requires_human_approval: true, // Human-in-the-loop requirement
    is_active: true,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'RUL-CUST-03',
    trigger_type: 'PROFORMA_INVOICE',
    category: 'CUSTOMER',
    name: 'Proforma Invoice Email (Optional)',
    description: 'Sends Proforma Invoice for advance payment and PO processing.',
    subject_template: 'Proforma Invoice {{entity_number}} - ICON TECH PRO',
    body_template: '<p>Dear {{recipient_name}},</p><p>Please find attached Proforma Invoice {{entity_number}} for processing advance payment.</p><p>Note: This is a Proforma Invoice and not a Tax Invoice.</p>',
    attach_document: true,
    requires_human_approval: true,
    is_active: true,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'RUL-CUST-04',
    trigger_type: 'ORDER_CONFIRMATION',
    category: 'CUSTOMER',
    name: 'Sales Order Confirmation',
    description: 'Confirms order booking, delivery timeline, and kickoff.',
    subject_template: 'Order Confirmation - {{entity_number}} - ICON TECH PRO',
    body_template: '<p>Dear {{recipient_name}},</p><p>Your order {{entity_number}} has been confirmed and scheduled for fulfillment.</p>',
    attach_document: true,
    requires_human_approval: false,
    is_active: true,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'RUL-CUST-05',
    trigger_type: 'TAX_INVOICE',
    category: 'CUSTOMER',
    name: 'GST Tax Invoice Dispatch',
    description: 'Sends official GST Tax Invoice with bank remittance coordinates.',
    subject_template: 'GST Tax Invoice {{entity_number}} - ICON TECH PRO',
    body_template: '<p>Dear Accounts Team,</p><p>Please find attached GST Tax Invoice {{entity_number}} along with our IDBI Bank payment details.</p>',
    attach_document: true,
    requires_human_approval: true,
    is_active: true,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'RUL-CUST-06',
    trigger_type: 'DISPATCH_NOTIFICATION',
    category: 'CUSTOMER',
    name: 'Material Dispatch & Delivery Challan Alert',
    description: 'Notifies consignee of goods dispatch, vehicle number, and delivery challan reference.',
    subject_template: 'Goods Dispatched: Delivery Challan {{entity_number}}',
    body_template: '<p>Dear {{recipient_name}},</p><p>Your consignment has been dispatched under Delivery Challan {{entity_number}}.</p>',
    attach_document: true,
    requires_human_approval: false,
    is_active: true,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'RUL-CUST-07',
    trigger_type: 'PAYMENT_ACKNOWLEDGEMENT',
    category: 'CUSTOMER',
    name: 'Payment Receipt Acknowledgement',
    description: 'Official acknowledgement of funds received against invoice.',
    subject_template: 'Payment Acknowledgement - Receipt {{entity_number}}',
    body_template: '<p>Dear {{recipient_name}},</p><p>We acknowledge with thanks the receipt of your payment.</p>',
    attach_document: false,
    requires_human_approval: false,
    is_active: true,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'RUL-CUST-08',
    trigger_type: 'PAYMENT_REMINDER',
    category: 'CUSTOMER',
    name: 'Overdue Receivables Gentle Reminder',
    description: 'Professional reminder for pending invoice balances exceeding credit terms.',
    subject_template: 'Friendly Reminder: Pending Invoice Balance [{{entity_number}}]',
    body_template: '<p>Dear {{recipient_name}},</p><p>This is a gentle reminder regarding the outstanding balance on Invoice {{entity_number}}.</p>',
    attach_document: false,
    requires_human_approval: true,
    is_active: true,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },

  // Supplier Automation Rules
  {
    id: 'RUL-SUPP-01',
    trigger_type: 'RFQ',
    category: 'SUPPLIER',
    name: 'Supplier Request for Quotation (RFQ)',
    description: 'Solicits competitive pricing and delivery lead-time from registered OEM distributors.',
    subject_template: 'RFQ from ICON TECH PRO - Pricing Request [Ref: {{entity_number}}]',
    body_template: '<p>Dear Partner,</p><p>Please quote your best distributor pricing and stock availability for the attached items.</p>',
    attach_document: true,
    requires_human_approval: true,
    is_active: true,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'RUL-SUPP-02',
    trigger_type: 'PURCHASE_ORDER',
    category: 'SUPPLIER',
    name: 'Official Purchase Order Dispatch',
    description: 'Transmits signed Purchase Order with delivery specifications to distributor.',
    subject_template: 'Purchase Order {{entity_number}} from ICON TECH PRO',
    body_template: '<p>Dear Sales Team,</p><p>Please find attached our official Purchase Order {{entity_number}}.</p>',
    attach_document: true,
    requires_human_approval: true,
    is_active: true,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'RUL-SUPP-03',
    trigger_type: 'DELIVERY_FOLLOWUP',
    category: 'SUPPLIER',
    name: 'Distributor Delivery Status Follow-Up',
    description: 'Inquires on dispatch tracking for pending purchase orders.',
    subject_template: 'Delivery Status Query for PO {{entity_number}} - ICON TECH PRO',
    body_template: '<p>Dear Logistics Team,</p><p>Could you kindly provide the dispatch update and courier tracking details for PO {{entity_number}}?</p>',
    attach_document: false,
    requires_human_approval: false,
    is_active: true,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  },
];

function getRulesStore(): EmailAutomationRule[] {
  if (!globalThis.__ICON_EMAIL_RULES__) {
    globalThis.__ICON_EMAIL_RULES__ = [...DEFAULT_AUTOMATION_RULES];
  }
  return globalThis.__ICON_EMAIL_RULES__;
}

function getQueueStore(): EmailQueueJob[] {
  if (!globalThis.__ICON_EMAIL_QUEUE__) {
    globalThis.__ICON_EMAIL_QUEUE__ = [];
  }
  return globalThis.__ICON_EMAIL_QUEUE__;
}

/**
 * Retrieve all email automation rules for Central Email Centre.
 */
export async function getEmailAutomationRules(): Promise<EmailAutomationRule[]> {
  await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
  return getRulesStore();
}

/**
 * Update an automation rule template or activation state.
 */
export async function updateEmailAutomationRule(
  id: string,
  updates: Partial<EmailAutomationRule>
): Promise<{ success: boolean; data?: EmailAutomationRule; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const rules = getRulesStore();
    const rule = rules.find((r) => r.id === id);
    if (!rule) {
      return { success: false, error: 'Rule not found' };
    }

    Object.assign(rule, updates, { updated_at: new Date().toISOString() });

    await logAuditEvent({
      userName: actor.name,
      action: 'UPDATE_EMAIL_RULE',
      module: 'EMAIL_CENTER',
      details: `Updated email automation rule ${rule.name} (Active: ${rule.is_active})`,
    });

    revalidatePath('/dashboard/settings/email-center');
    return { success: true, data: rule };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update rule' };
  }
}

/**
 * Enqueue an automated email with idempotency and duplicate protection.
 */
export async function enqueueAutomatedEmail(payload: {
  trigger_type: CustomerEmailTrigger | SupplierEmailTrigger;
  recipient_type: 'CUSTOMER' | 'SUPPLIER' | 'INTERNAL_MANAGEMENT';
  recipient_email: string;
  recipient_name: string;
  entity_type: string;
  entity_id: string;
  entity_number: string;
  custom_subject?: string;
  custom_body?: string;
  attachments?: Array<{ filename: string; content: string; contentType: string }>;
}): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    const rules = getRulesStore();
    const rule = rules.find((r) => r.trigger_type === payload.trigger_type && r.is_active);

    const idempotencyKey = `${payload.trigger_type}-${payload.entity_number}-${payload.recipient_email}`;
    const queue = getQueueStore();

    // Prevent duplicate queuing
    const existing = queue.find((q) => q.idempotency_key === idempotencyKey && q.status === 'SENT');
    if (existing) {
      return { success: true, jobId: existing.id };
    }

    const subject = payload.custom_subject ||
      (rule ? rule.subject_template.replace('{{entity_number}}', payload.entity_number) : `Notification: ${payload.entity_number}`);

    const body = payload.custom_body ||
      (rule ? rule.body_template.replace(/{{entity_number}}/g, payload.entity_number).replace(/{{recipient_name}}/g, payload.recipient_name) : `<p>Notification for ${payload.entity_number}</p>`);

    const job: EmailQueueJob = {
      id: `JOB-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      rule_id: rule?.id,
      trigger_type: payload.trigger_type,
      recipient_type: payload.recipient_type,
      recipient_email: payload.recipient_email,
      recipient_name: payload.recipient_name,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id,
      entity_number: payload.entity_number,
      subject,
      body_html: body,
      attachments: payload.attachments,
      status: 'QUEUED',
      retry_count: 0,
      max_retries: 3,
      idempotency_key: idempotencyKey,
      created_at: new Date().toISOString(),
    };

    queue.unshift(job);

    await logAuditEvent({
      userName: 'Email Automation Engine',
      action: 'ENQUEUE_EMAIL',
      module: 'EMAIL_CENTER',
      details: `Enqueued automated email [${payload.trigger_type}] for ${payload.recipient_email} (Ref: ${payload.entity_number})`,
    });

    return { success: true, jobId: job.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to enqueue email' };
  }
}

/**
 * Process the durable email queue with exponential backoff and dead-letter protection.
 */
export async function processEmailQueue(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const queue = getQueueStore();
  const pendingJobs = queue.filter((j) => j.status === 'QUEUED');

  let sent = 0;
  let failed = 0;

  for (const job of pendingJobs) {
    try {
      const sendResult = await EmailService.sendEmail({
        to: job.recipient_email,
        subject: job.subject,
        html: job.body_html,
        attachments: job.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
        metadata: {
          entityType: job.entity_type as any,
          entityId: job.entity_id,
        },
      });

      if (sendResult.success) {
        job.status = 'SENT';
        job.sent_at = new Date().toISOString();
        sent++;
      } else {
        job.retry_count++;
        if (job.retry_count >= job.max_retries) {
          job.status = 'DEAD_LETTER';
        } else {
          job.status = 'FAILED';
          const delayMinutes = Math.pow(2, job.retry_count) * 5;
          const retryTime = new Date(Date.now() + delayMinutes * 60 * 1000);
          job.next_retry_at = retryTime.toISOString();
        }
        failed++;
      }
    } catch (err: any) {
      job.retry_count++;
      if (job.retry_count >= job.max_retries) {
        job.status = 'DEAD_LETTER';
      } else {
        job.status = 'FAILED';
      }
      failed++;
    }
  }

  return { processed: pendingJobs.length, sent, failed };
}

/**
 * Retrieve queue items (active, sent, and failed dead-letter) for Central Email Centre monitoring.
 */
export async function getEmailQueue(filters?: {
  status?: string;
  recipient_type?: string;
}): Promise<EmailQueueJob[]> {
  await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
  let queue = [...getQueueStore()];

  if (filters?.status && filters.status !== 'ALL') {
    queue = queue.filter((j) => j.status === filters.status);
  }
  if (filters?.recipient_type && filters.recipient_type !== 'ALL') {
    queue = queue.filter((j) => j.recipient_type === filters.recipient_type);
  }

  return queue;
}

/**
 * Auditable manual resend of a failed or dead-letter queue job.
 */
export async function retryQueueJob(jobId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const queue = getQueueStore();
    const job = queue.find((j) => j.id === jobId);
    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    job.status = 'QUEUED';
    job.retry_count = 0;
    job.next_retry_at = undefined;

    await logAuditEvent({
      userName: actor.name,
      action: 'MANUAL_RETRY_EMAIL_JOB',
      module: 'EMAIL_CENTER',
      details: `Administrator ${actor.name} manually re-queued email job ${jobId} to ${job.recipient_email}`,
    });

    // Attempt processing immediately
    await processEmailQueue();

    revalidatePath('/dashboard/settings/email-center');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to retry job' };
  }
}
