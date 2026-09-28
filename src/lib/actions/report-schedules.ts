'use server';

import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { executeReport, getReportDefinitions } from '@/lib/actions/reports';
import { queueOutboxMessage } from '@/lib/actions/communication';
import type {
  ReportSubscription,
  ReportFrequency,
  ReportDeliveryChannel,
  ReportDefinition,
} from '@/types/reports';

const INITIAL_SUBSCRIPTIONS: ReportSubscription[] = [
  {
    id: 'SUB-260001',
    report_id: 'RPT-STD-01',
    report_title: 'Daily Sales Register & Rep Performance',
    user_id: 'usr-md-01',
    user_name: 'Borra Narsimulu',
    recipient_target: 'icontechpro@gmail.com',
    frequency: 'DAILY',
    channel: 'EMAIL',
    include_ai_summary: true,
    is_active: true,
    last_run_at: '2026-09-12T08:00:00Z',
    next_run_at: '2026-09-13T08:00:00Z',
    created_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'SUB-260002',
    report_id: 'RPT-STD-02',
    report_title: 'Receivables Aging & Overdue Ledger',
    user_id: 'usr-acc-01',
    user_name: 'Hemalatha',
    recipient_target: '+919876543210',
    frequency: 'WEEKLY',
    channel: 'WHATSAPP',
    include_ai_summary: true,
    is_active: true,
    last_run_at: '2026-09-07T09:00:00Z',
    next_run_at: '2026-09-14T09:00:00Z',
    created_at: '2026-09-01T00:00:00Z',
  },
];

declare global {
  // eslint-disable-next-line no-var
  var __ICON_REPORT_SUBSCRIPTIONS__: ReportSubscription[] | undefined;
}

function getSubscriptionsStore(): ReportSubscription[] {
  if (!globalThis.__ICON_REPORT_SUBSCRIPTIONS__) {
    globalThis.__ICON_REPORT_SUBSCRIPTIONS__ = [...INITIAL_SUBSCRIPTIONS];
  }
  return globalThis.__ICON_REPORT_SUBSCRIPTIONS__;
}

export async function getReportSubscriptions(): Promise<ReportSubscription[]> {
  const authUser = await getAuthenticatedUser();
  const store = getSubscriptionsStore();
  if (authUser?.role === 'Managing Director' || authUser?.role === 'Admin / BDM') {
    return store;
  }
  return store.filter((s) => s.user_name.toLowerCase() === (authUser?.name || '').toLowerCase());
}

export async function createReportSubscription(payload: {
  report_id: string;
  frequency: ReportFrequency;
  channel: ReportDeliveryChannel;
  recipient_target: string;
  include_ai_summary?: boolean;
}): Promise<{ success: boolean; data?: ReportSubscription; error?: string }> {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return { success: false, error: 'Authentication required' };
    }

    const reports = await getReportDefinitions();
    const report = reports.find((r) => r.id === payload.report_id);
    if (!report) {
      return { success: false, error: `Report ${payload.report_id} not found` };
    }

    const store = getSubscriptionsStore();
    const nextRun = new Date();
    if (payload.frequency === 'DAILY') {
      nextRun.setDate(nextRun.getDate() + 1);
    } else if (payload.frequency === 'WEEKLY') {
      nextRun.setDate(nextRun.getDate() + 7);
    } else if (payload.frequency === 'MONTHLY') {
      nextRun.setMonth(nextRun.getMonth() + 1);
    }

    const newSub: ReportSubscription = {
      id: `SUB-${Date.now()}`,
      report_id: report.id,
      report_title: report.title,
      user_id: authUser.id || 'usr-direct',
      user_name: authUser.name,
      recipient_target: payload.recipient_target,
      frequency: payload.frequency,
      channel: payload.channel,
      include_ai_summary: payload.include_ai_summary ?? true,
      is_active: true,
      next_run_at: nextRun.toISOString(),
      created_at: new Date().toISOString(),
    };

    store.push(newSub);

    await logAuditEvent({
      userName: authUser.name,
      action: 'CREATE_REPORT_SUBSCRIPTION',
      module: 'REPORTS',
      details: `Subscribed to "${report.title}" on ${payload.frequency} via ${payload.channel}`,
    });

    revalidatePath('/dashboard/reports');
    return { success: true, data: newSub };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to create subscription' };
  }
}

export async function executeScheduledReportDelivery(
  subscriptionId: string
): Promise<{ success: boolean; messageId?: string; summary?: string; error?: string }> {
  try {
    const store = getSubscriptionsStore();
    const sub = store.find((s) => s.id === subscriptionId);
    if (!sub) {
      return { success: false, error: `Subscription ${subscriptionId} not found` };
    }

    // 1. Execute report with security checks
    const res = await executeReport(sub.report_id);
    if (!res.success || !res.data) {
      return { success: false, error: res.error || 'Report execution failed' };
    }

    const reportData = res.data;

    // 2. Format textual summary for outbox transmission
    let messageBody = `📊 ICON TECH PRO AUTOMATED BRIEFING\n`;
    messageBody += `Report: ${reportData.report.title}\n`;
    messageBody += `Generated: ${new Date().toLocaleString('en-IN')}\n\n`;
    messageBody += `KEY METRICS:\n`;
    messageBody += `• Total Records: ${reportData.summary.totalRecords}\n`;
    if (reportData.summary.aggregatedValue !== undefined) {
      messageBody += `• Aggregate Value: ₹${reportData.summary.aggregatedValue.toLocaleString('en-IN')}\n`;
    }

    messageBody += `\nBREAKDOWN (Top 5):\n`;
    reportData.rows.slice(0, 5).forEach((r) => {
      const mainKey = reportData.columns[0]?.key || 'groupKey';
      const metricKey = reportData.columns[1]?.key || 'recordCount';
      messageBody += `• ${r[mainKey]}: ${r[metricKey]}\n`;
    });

    messageBody += `\nAccess full interactive breakdown in ICON TECH PRO ERP: https://erp.icontechpro.com/dashboard/reports`;

    // 3. Queue to communication outbox
    const commRes = await queueOutboxMessage({
      channel: sub.channel === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL',
      recipient: sub.recipient_target,
      subject: `[ERP Report] ${reportData.report.title}`,
      message_body: messageBody,
      entity_type: 'REPORT',
      entity_id: sub.report_id,
    });

    if (!commRes.success) {
      return { success: false, error: commRes.error || 'Failed to queue report outbox message' };
    }

    // 4. Update subscription schedule
    sub.last_run_at = new Date().toISOString();
    const nextDate = new Date();
    if (sub.frequency === 'DAILY') {
      nextDate.setDate(nextDate.getDate() + 1);
    } else if (sub.frequency === 'WEEKLY') {
      nextDate.setDate(nextDate.getDate() + 7);
    } else {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
    sub.next_run_at = nextDate.toISOString();

    await logAuditEvent({
      userName: sub.user_name,
      action: 'DELIVER_SCHEDULED_REPORT',
      module: 'REPORTS',
      details: `Delivered "${reportData.report.title}" via ${sub.channel} to ${sub.recipient_target}`,
    });

    return {
      success: true,
      messageId: commRes.data?.id,
      summary: messageBody,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to deliver scheduled report' };
  }
}
