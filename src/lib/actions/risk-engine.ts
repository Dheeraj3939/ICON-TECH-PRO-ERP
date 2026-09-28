'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { getCustomerReceivablesLedger } from '@/lib/actions/finance';
import { getQuotations } from '@/lib/actions/quotations';
import { getSupplierInvoices } from '@/lib/actions/supplier-invoices';
import { getTallyReconciliationItems } from '@/lib/actions/tally-reconciliation';
import type { BusinessRiskAlert } from '@/types/erp';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_BUSINESS_RISKS__: BusinessRiskAlert[] | undefined;
}

const INITIAL_RISKS: BusinessRiskAlert[] = [
  {
    id: 'RISK-001',
    risk_type: 'OVERDUE_PAYMENT',
    severity: 'HIGH',
    title: 'Customer T-Hub Foundation has payment overdue > 30 days',
    description: 'Outstanding balance ₹1,45,000 against invoice ICON/26-27/INV-0001 has passed the 30-day payment term.',
    related_entity_type: 'CUSTOMER',
    related_entity_id: 'CUST0001',
    metric_value: 145000,
    threshold_value: 100000,
    recommendation: 'Initiate formal payment reminder via WhatsApp and record Promise-to-Pay in Finance module.',
    status: 'OPEN',
    created_at: '2026-04-09T09:00:00.000Z',
  },
  {
    id: 'RISK-002',
    risk_type: 'TALLY_MISMATCH',
    severity: 'MEDIUM',
    title: 'Tally Reconciliation Rounding Difference Detected',
    description: 'Invoice ICON/26-27/INV-0002 has a ₹400 discrepancy compared to Tally voucher SL-2026-0042.',
    related_entity_type: 'INVOICE',
    related_entity_id: 'INV-260002',
    metric_value: 400,
    threshold_value: 10,
    recommendation: 'Review Tally round-off ledger or update voucher tax breakup.',
    status: 'OPEN',
    created_at: '2026-04-09T10:30:00.000Z',
  },
];

function getRiskStore(): BusinessRiskAlert[] {
  if (!globalThis.__ICON_BUSINESS_RISKS__) {
    globalThis.__ICON_BUSINESS_RISKS__ = [...INITIAL_RISKS];
  }
  return globalThis.__ICON_BUSINESS_RISKS__;
}

/**
 * Scans ERP data across Finance, Sales, Procurement, and Tally for business risks.
 */
export async function scanBusinessRisks(): Promise<{
  success: boolean;
  data?: {
    alerts: BusinessRiskAlert[];
    summary: { total: number; critical: number; high: number; open: number };
  };
  error?: string;
}> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts', 'BDM']);
    const store = getRiskStore();

    // 1. Scan Receivables for Overdue Payments
    const recRes = await getCustomerReceivablesLedger();
    const receivables = recRes.data || [];

    for (const r of receivables) {
      const totalOverdue = r.ageing.overdue_31_60 + r.ageing.overdue_61_90 + r.ageing.overdue_90_plus;
      if (totalOverdue > 50000) {
        const existing = store.find(
          (k) => k.risk_type === 'OVERDUE_PAYMENT' && k.related_entity_id === r.customer_id && k.status !== 'RESOLVED'
        );
        if (!existing) {
          store.push({
            id: `RISK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            risk_type: 'OVERDUE_PAYMENT',
            severity: totalOverdue > 100000 ? 'HIGH' : 'MEDIUM',
            title: `Customer ${r.customer_name} has overdue payments totaling ₹${totalOverdue.toLocaleString('en-IN')}`,
            description: `Balance due ₹${r.balance_due.toLocaleString('en-IN')} with credit utilization at ${r.credit_utilization_pct}%.`,
            related_entity_type: 'CUSTOMER',
            related_entity_id: r.customer_id,
            metric_value: totalOverdue,
            threshold_value: 50000,
            recommendation: 'Request immediate wire transfer receipt or schedule collection call.',
            status: 'OPEN',
            created_at: new Date().toISOString(),
          });
        }
      }

      // Check credit limit exceeded
      if (r.is_credit_limit_exceeded) {
        const existing = store.find(
          (k) => k.risk_type === 'OVERDUE_PAYMENT' && k.title.includes('Credit Limit Exceeded') && k.related_entity_id === r.customer_id
        );
        if (!existing) {
          store.push({
            id: `RISK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            risk_type: 'OVERDUE_PAYMENT',
            severity: 'CRITICAL',
            title: `Credit Limit Exceeded for ${r.customer_name}`,
            description: `Outstanding ₹${r.balance_due.toLocaleString('en-IN')} exceeds approved credit limit ₹${r.credit_limit.toLocaleString('en-IN')}.`,
            related_entity_type: 'CUSTOMER',
            related_entity_id: r.customer_id,
            metric_value: r.balance_due,
            threshold_value: r.credit_limit,
            recommendation: 'Place hold on new sales dispatches until receivables are reduced below limit.',
            status: 'OPEN',
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    // 2. Scan Quotations for Stalled / Low Margin Deals
    const { quotations } = await getQuotations();
    for (const q of quotations) {
      if (q.status === 'Sent') {
        const quoteDate = new Date(q.quotation_date).getTime();
        const daysOld = Math.floor((Date.now() - quoteDate) / (1000 * 60 * 60 * 24));
        if (daysOld > 7) {
          const existing = store.find(
            (k) => k.risk_type === 'UNFOLLOWED_QUOTATION' && k.related_entity_id === q.id && k.status !== 'RESOLVED'
          );
          if (!existing) {
            store.push({
              id: `RISK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              risk_type: 'UNFOLLOWED_QUOTATION',
              severity: 'MEDIUM',
              title: `Quotation ${q.quotation_number} sent ${daysOld} days ago without follow-up task`,
              description: `Deal value ₹${q.grand_total.toLocaleString('en-IN')} for ${q.customer_name}.`,
              related_entity_type: 'QUOTATION',
              related_entity_id: q.id,
              metric_value: daysOld,
              threshold_value: 7,
              recommendation: 'Assign follow-up call to assigned salesperson.',
              status: 'OPEN',
              created_at: new Date().toISOString(),
            });
          }
        }
      }
    }

    // 3. Scan Tally Reconciliation Discrepancies
    const tallyRes = await getTallyReconciliationItems({ status: 'VALUE_MISMATCH' });
    const mismatches = tallyRes.data || [];
    for (const m of mismatches) {
      const existing = store.find((k) => k.risk_type === 'TALLY_MISMATCH' && k.related_entity_id === m.erp_id);
      if (!existing) {
        store.push({
          id: `RISK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          risk_type: 'TALLY_MISMATCH',
          severity: 'MEDIUM',
          title: `Tally Reconciliation Discrepancy on ${m.erp_number}`,
          description: `ERP amount ₹${m.erp_amount} vs Tally amount ₹${m.tally_amount || 0} (Diff: ₹${m.difference_amount}).`,
          related_entity_type: m.entity_type,
          related_entity_id: m.erp_id,
          metric_value: m.difference_amount,
          threshold_value: 0,
          recommendation: 'Review voucher in TallyPrime and adjust rounding difference.',
          status: 'OPEN',
          created_at: new Date().toISOString(),
        });
      }
    }

    const summary = {
      total: store.length,
      critical: store.filter((k) => k.severity === 'CRITICAL' && k.status === 'OPEN').length,
      high: store.filter((k) => k.severity === 'HIGH' && k.status === 'OPEN').length,
      open: store.filter((k) => k.status === 'OPEN').length,
    };

    await logAuditEvent({
      userName: authUser.name,
      action: 'SCAN_BUSINESS_RISKS',
      module: 'RISK_ENGINE',
      details: `Business risk radar scanned: ${summary.open} open alerts (${summary.critical} critical, ${summary.high} high)`,
    });

    return { success: true, data: { alerts: store, summary } };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to scan business risks' };
  }
}

/**
 * Fetch business risks.
 */
export async function getBusinessRisks(filters?: {
  severity?: string;
  status?: string;
}): Promise<{ success: boolean; data?: BusinessRiskAlert[]; error?: string }> {
  try {
    const store = getRiskStore();
    let filtered = [...store];

    if (filters?.severity) {
      filtered = filtered.filter((r) => r.severity === filters.severity);
    }
    if (filters?.status) {
      filtered = filtered.filter((r) => r.status === filters.status);
    }

    return { success: true, data: filtered };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to get business risks' };
  }
}

/**
 * Acknowledge an alert.
 */
export async function acknowledgeRisk(id: string): Promise<{
  success: boolean;
  data?: BusinessRiskAlert;
  error?: string;
}> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts', 'BDM']);
    const store = getRiskStore();
    const alert = store.find((r) => r.id === id);

    if (!alert) {
      return { success: false, error: 'Risk alert not found.' };
    }

    alert.status = 'ACKNOWLEDGED';

    await logAuditEvent({
      userName: authUser.name,
      action: 'ACKNOWLEDGE_RISK_ALERT',
      module: 'RISK_ENGINE',
      details: `Acknowledged risk ${alert.title}`,
    });

    return { success: true, data: alert };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to acknowledge risk' };
  }
}

/**
 * Resolve an alert with explanation notes.
 */
export async function resolveRisk(
  id: string,
  notes: string
): Promise<{ success: boolean; data?: BusinessRiskAlert; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts', 'BDM']);
    const store = getRiskStore();
    const alert = store.find((r) => r.id === id);

    if (!alert) {
      return { success: false, error: 'Risk alert not found.' };
    }

    alert.status = 'RESOLVED';
    alert.recommendation = (alert.recommendation ? alert.recommendation + ' | ' : '') + `Resolved by ${authUser.name}: ${notes}`;

    await logAuditEvent({
      userName: authUser.name,
      action: 'RESOLVE_RISK_ALERT',
      module: 'RISK_ENGINE',
      details: `Resolved risk ${alert.title} (${notes})`,
    });

    return { success: true, data: alert };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to resolve risk' };
  }
}
