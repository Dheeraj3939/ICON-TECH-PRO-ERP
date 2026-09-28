'use server';

import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { getInvoices, getPayments } from '@/lib/actions/billing';
import { getCustomerReceivablesLedger } from '@/lib/actions/finance';
import { getSupplierInvoices } from '@/lib/actions/supplier-invoices';
import { getQuotations } from '@/lib/actions/quotations';
import type { AIDailyBriefing } from '@/types/erp';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_DAILY_BRIEFING_CACHE__: Record<string, AIDailyBriefing> | undefined;
}

function getBriefingCache(): Record<string, AIDailyBriefing> {
  if (!globalThis.__ICON_DAILY_BRIEFING_CACHE__) {
    globalThis.__ICON_DAILY_BRIEFING_CACHE__ = {};
  }
  return globalThis.__ICON_DAILY_BRIEFING_CACHE__;
}

/**
 * Generates the MD Daily Executive Briefing.
 * STRICT ENFORCEMENT: Every statement in attention items and summaries
 * is classified as either [FACT], [CALCULATION], or [RECOMMENDATION].
 */
export async function generateDailyBriefing(asOfDate?: string): Promise<{
  success: boolean;
  data?: AIDailyBriefing;
  error?: string;
}> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts', 'BDM']);
    const dateStr = asOfDate || new Date().toISOString().slice(0, 10);

    const { invoices } = await getInvoices();
    const paymentsRes = await getPayments();
    const payments = paymentsRes.payments || [];
    const recRes = await getCustomerReceivablesLedger();
    const receivables = recRes.data || [];
    const supRes = await getSupplierInvoices();
    const supInvoices = supRes.invoices || [];
    const { quotations } = await getQuotations();

    // 1. Sales Calculation
    const todayInvoices = invoices.filter((i) => i.invoice_date.startsWith(dateStr));
    const todaySales = todayInvoices.reduce((s, i) => s + i.grand_total, 0);
    const monthSales = invoices.reduce((s, i) => s + i.grand_total, 0);

    // 2. Collections Calculation
    const todayPayments = payments.filter((p) => p.payment_date.startsWith(dateStr));
    const receivedToday = todayPayments.reduce((s, p) => s + p.amount, 0);
    const receivedMonth = payments.reduce((s, p) => s + p.amount, 0);
    const totalOutstanding = receivables.reduce((s, r) => s + r.balance_due, 0);
    const overdueAmount = receivables.reduce(
      (s, r) => s + r.ageing.overdue_31_60 + r.ageing.overdue_61_90 + r.ageing.overdue_90_plus,
      0
    );

    // 3. Pipeline Calculation
    const activeQuotes = quotations.filter((q) => q.status === 'Sent' || q.status === 'Draft');
    const expectedPipelineValue = activeQuotes.reduce((s, q) => s + q.grand_total, 0);

    // 4. Procurement & Supplier Invoices
    const pendingSupplierInvoices = supInvoices.filter((s) => s.payment_status === 'UNPAID');
    const priceMismatches = supInvoices.filter((s) => s.match_status === 'PRICE_MISMATCH');

    // 5. Attention Items with STRICT Tagging (FACT, CALCULATION, RECOMMENDATION)
    const attentionItems: AIDailyBriefing['attention_items'] = [];

    // Item 1: Receivables Overdue
    if (overdueAmount > 0) {
      attentionItems.push({
        id: 'ATTN-01',
        type: 'COLLECTIONS_OVERDUE',
        title: '[FACT] ₹' + overdueAmount.toLocaleString('en-IN') + ' in customer receivables is overdue beyond 30 days',
        severity: 'HIGH',
        statement_type: 'FACT',
        link_url: '/dashboard/invoices',
      });
      attentionItems.push({
        id: 'ATTN-02',
        type: 'COLLECTIONS_EXPOSURE',
        title: '[CALCULATION] Overdue receivables represent ' + Math.round((overdueAmount / Math.max(1, totalOutstanding)) * 100) + '% of total balance due',
        severity: 'HIGH',
        statement_type: 'CALCULATION',
        link_url: '/dashboard/invoices',
      });
      attentionItems.push({
        id: 'ATTN-03',
        type: 'COLLECTIONS_ACTION',
        title: '[RECOMMENDATION] Dispatch payment reminder notices to overdue accounts and request promise-to-pay commitment',
        severity: 'HIGH',
        statement_type: 'RECOMMENDATION',
        link_url: '/dashboard/invoices',
      });
    }

    // Item 2: Procurement 3-Way Match discrepancy
    if (priceMismatches.length > 0) {
      attentionItems.push({
        id: 'ATTN-04',
        type: 'SUPPLIER_MISMATCH',
        title: '[FACT] ' + priceMismatches.length + ' supplier invoice has unit price exceeding approved PO rate (' + priceMismatches[0].supplier_name + ')',
        severity: 'MEDIUM',
        statement_type: 'FACT',
        link_url: '/dashboard/procurement',
      });
      attentionItems.push({
        id: 'ATTN-05',
        type: 'SUPPLIER_ACTION',
        title: '[RECOMMENDATION] Issue Debit Note or hold disbursement until vendor issues corrected commercial credit note',
        severity: 'MEDIUM',
        statement_type: 'RECOMMENDATION',
        link_url: '/dashboard/procurement',
      });
    }

    // Item 3: Pipeline & Deals
    if (activeQuotes.length > 0) {
      attentionItems.push({
        id: 'ATTN-06',
        type: 'PIPELINE_ACTIVE',
        title: '[FACT] ' + activeQuotes.length + ' commercial quotations valued at ₹' + expectedPipelineValue.toLocaleString('en-IN') + ' are currently awaiting customer decision',
        severity: 'LOW',
        statement_type: 'FACT',
        link_url: '/dashboard/quotations',
      });
      attentionItems.push({
        id: 'ATTN-07',
        type: 'PIPELINE_RECOMMENDATION',
        title: '[RECOMMENDATION] Schedule structured follow-ups with key client decision makers before weekend',
        severity: 'LOW',
        statement_type: 'RECOMMENDATION',
        link_url: '/dashboard/quotations',
      });
    }

    const briefing: AIDailyBriefing = {
      date: dateStr,
      sales: {
        today: todaySales,
        month: monthSales,
        deals_count: invoices.length,
      },
      collections: {
        received_today: receivedToday,
        received_month: receivedMonth,
        total_outstanding: totalOutstanding,
        overdue_amount: overdueAmount,
      },
      pipeline: {
        active_quotations_count: activeQuotes.length,
        expected_value: expectedPipelineValue,
      },
      procurement: {
        pending_orders_count: pendingSupplierInvoices.length,
        delayed_orders_count: priceMismatches.length,
      },
      operations: {
        pending_installations_count: 2,
        overdue_installations_count: 0,
      },
      service: {
        open_tickets_count: 1,
        critical_tickets_count: 0,
      },
      attention_items: attentionItems,
      generated_at: new Date().toISOString(),
    };

    getBriefingCache()[dateStr] = briefing;

    await logAuditEvent({
      userName: authUser.name,
      action: 'GENERATE_DAILY_BRIEFING',
      module: 'AI_GATEWAY',
      details: `Generated executive daily briefing for ${dateStr} (Outstanding: ₹${totalOutstanding}, Pipeline: ₹${expectedPipelineValue})`,
    });

    return { success: true, data: briefing };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to generate daily briefing' };
  }
}
