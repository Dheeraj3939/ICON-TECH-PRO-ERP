'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { getInvoices, getPayments } from '@/lib/actions/billing';
import { getSupplierInvoices } from '@/lib/actions/supplier-invoices';
import type { TallyReconciliationItem, TallyReconStatus } from '@/types/erp';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_TALLY_RECON_ITEMS__: TallyReconciliationItem[] | undefined;
}

const INITIAL_RECON_ITEMS: TallyReconciliationItem[] = [
  {
    id: 'RECON-001',
    entity_type: 'INVOICE',
    erp_id: 'INV-260001',
    erp_number: 'ICON/26-27/INV-0001',
    erp_amount: 145000,
    erp_date: '2026-04-05',
    tally_guid: 'tally-guid-984210-2026',
    tally_voucher_number: 'SL-2026-0041',
    tally_amount: 145000,
    tally_date: '2026-04-05',
    recon_status: 'MATCHED',
    difference_amount: 0,
    notes: 'Exact match with Tally Sales Voucher SL-2026-0041',
    is_reviewed: true,
    reviewed_by: 'Accounts Officer',
    reviewed_at: '2026-04-06T10:00:00.000Z',
    last_checked_at: new Date().toISOString(),
  },
  {
    id: 'RECON-002',
    entity_type: 'PAYMENT',
    erp_id: 'PAY-1001',
    erp_number: 'ICON/26-27/PAY-0001',
    erp_amount: 145000,
    erp_date: '2026-04-06',
    tally_guid: 'tally-guid-984212-2026',
    tally_voucher_number: 'RC-2026-0019',
    tally_amount: 145000,
    tally_date: '2026-04-06',
    recon_status: 'MATCHED',
    difference_amount: 0,
    notes: 'Bank receipt voucher reconciled with HDFC bank statement',
    is_reviewed: true,
    reviewed_by: 'Accounts Officer',
    reviewed_at: '2026-04-07T09:30:00.000Z',
    last_checked_at: new Date().toISOString(),
  },
  {
    id: 'RECON-003',
    entity_type: 'INVOICE',
    erp_id: 'INV-260002',
    erp_number: 'ICON/26-27/INV-0002',
    erp_amount: 94400,
    erp_date: '2026-04-07',
    tally_guid: 'tally-guid-984215-2026',
    tally_voucher_number: 'SL-2026-0042',
    tally_amount: 94000,
    tally_date: '2026-04-07',
    recon_status: 'VALUE_MISMATCH',
    difference_amount: 400,
    notes: 'Tally voucher has ₹400 rounding difference in tax subtotal',
    is_reviewed: false,
    last_checked_at: new Date().toISOString(),
  },
];

function getReconStore(): TallyReconciliationItem[] {
  if (!globalThis.__ICON_TALLY_RECON_ITEMS__) {
    globalThis.__ICON_TALLY_RECON_ITEMS__ = [...INITIAL_RECON_ITEMS];
  }
  return globalThis.__ICON_TALLY_RECON_ITEMS__;
}

/**
 * Executes Automated Reconciliation between ERP and TallyPrime.
 */
export async function runTallyReconciliation(): Promise<{
  success: boolean;
  data?: {
    items: TallyReconciliationItem[];
    summary: {
      total: number;
      matched: number;
      value_mismatch: number;
      erp_only: number;
      tally_only: number;
    };
  };
  error?: string;
}> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
    const store = getReconStore();
    const { invoices } = await getInvoices();
    const paymentsRes = await getPayments();
    const payments = paymentsRes.payments || [];
    const supRes = await getSupplierInvoices();
    const supInvoices = supRes.invoices || [];

    // Check each ERP invoice against recon store
    for (const inv of invoices) {
      const existing = store.find((r) => r.erp_id === inv.id || r.erp_number === inv.invoice_number);
      if (!existing) {
        // Create an ERP_ONLY item pending sync
        store.push({
          id: `RECON-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          entity_type: 'INVOICE',
          erp_id: inv.id,
          erp_number: inv.invoice_number,
          erp_amount: inv.grand_total,
          erp_date: inv.invoice_date,
          recon_status: 'ERP_ONLY',
          difference_amount: inv.grand_total,
          notes: 'Invoice in ERP has not yet been exported/imported to TallyPrime',
          is_reviewed: false,
          last_checked_at: new Date().toISOString(),
        });
      }
    }

    // Check payments
    for (const pay of payments) {
      const existing = store.find((r) => r.erp_id === pay.id || r.erp_number === pay.payment_number);
      if (!existing) {
        store.push({
          id: `RECON-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          entity_type: 'PAYMENT',
          erp_id: pay.id,
          erp_number: pay.payment_number,
          erp_amount: pay.amount,
          erp_date: pay.payment_date,
          recon_status: 'ERP_ONLY',
          difference_amount: pay.amount,
          notes: 'Payment receipt pending posting in Tally bank ledger',
          is_reviewed: false,
          last_checked_at: new Date().toISOString(),
        });
      }
    }

    // Check supplier invoices
    for (const sinv of supInvoices) {
      const existing = store.find((r) => r.erp_id === sinv.id || r.erp_number === sinv.invoice_number);
      if (!existing) {
        store.push({
          id: `RECON-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          entity_type: 'PURCHASE_INVOICE',
          erp_id: sinv.id,
          erp_number: sinv.invoice_number,
          erp_amount: sinv.total_amount,
          erp_date: sinv.invoice_date,
          recon_status: sinv.tally_sync_status === 'SYNCED' ? 'MATCHED' : 'ERP_ONLY',
          difference_amount: sinv.tally_sync_status === 'SYNCED' ? 0 : sinv.total_amount,
          notes: `Supplier Purchase Invoice from ${sinv.supplier_name}`,
          is_reviewed: false,
          last_checked_at: new Date().toISOString(),
        });
      }
    }

    const summary = {
      total: store.length,
      matched: store.filter((i) => i.recon_status === 'MATCHED').length,
      value_mismatch: store.filter((i) => i.recon_status === 'VALUE_MISMATCH').length,
      erp_only: store.filter((i) => i.recon_status === 'ERP_ONLY').length,
      tally_only: store.filter((i) => i.recon_status === 'TALLY_ONLY').length,
    };

    await logAuditEvent({
      userName: authUser.name,
      action: 'RUN_TALLY_RECONCILIATION',
      module: 'FINANCE',
      details: `Executed Tally reconciliation: ${summary.matched} matched, ${summary.value_mismatch} mismatches, ${summary.erp_only} pending export`,
    });

    revalidatePath('/dashboard/tally');
    return { success: true, data: { items: store, summary } };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to run Tally reconciliation' };
  }
}

/**
 * Fetch reconciliation items with optional status/type filter.
 */
export async function getTallyReconciliationItems(filters?: {
  status?: TallyReconStatus;
  entity_type?: string;
}): Promise<{ success: boolean; data?: TallyReconciliationItem[]; error?: string }> {
  try {
    const store = getReconStore();
    let filtered = [...store];

    if (filters?.status) {
      filtered = filtered.filter((i) => i.recon_status === filters.status);
    }
    if (filters?.entity_type) {
      filtered = filtered.filter((i) => i.entity_type === filters.entity_type);
    }

    return { success: true, data: filtered };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to get reconciliation items' };
  }
}

/**
 * Mark a reconciliation item reviewed.
 */
export async function markTallyItemReviewed(
  id: string,
  notes?: string
): Promise<{ success: boolean; data?: TallyReconciliationItem; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
    const store = getReconStore();
    const item = store.find((i) => i.id === id);

    if (!item) {
      return { success: false, error: 'Reconciliation item not found.' };
    }

    item.is_reviewed = true;
    item.reviewed_by = authUser.name;
    item.reviewed_at = new Date().toISOString();
    if (notes) {
      item.notes = (item.notes ? item.notes + ' | ' : '') + notes;
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'REVIEW_TALLY_RECON_ITEM',
      module: 'FINANCE',
      details: `Reviewed Tally reconciliation item ${item.erp_number} (${item.recon_status})`,
    });

    revalidatePath('/dashboard/tally');
    return { success: true, data: item };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to review item' };
  }
}

/**
 * Force match or resolve a discrepancy.
 */
export async function resolveTallyDiscrepancy(
  id: string,
  resolutionAction: 'FORCE_MATCH' | 'DISMISS',
  notes: string
): Promise<{ success: boolean; data?: TallyReconciliationItem; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
    const store = getReconStore();
    const item = store.find((i) => i.id === id);

    if (!item) {
      return { success: false, error: 'Reconciliation item not found.' };
    }

    if (resolutionAction === 'FORCE_MATCH') {
      item.recon_status = 'MATCHED';
      item.difference_amount = 0;
    }
    item.is_reviewed = true;
    item.reviewed_by = authUser.name;
    item.reviewed_at = new Date().toISOString();
    item.notes = (item.notes ? item.notes + ' | ' : '') + `Resolved (${resolutionAction}): ${notes}`;

    await logAuditEvent({
      userName: authUser.name,
      action: 'RESOLVE_TALLY_DISCREPANCY',
      module: 'FINANCE',
      details: `Resolved Tally discrepancy for ${item.erp_number} via ${resolutionAction} (${notes})`,
    });

    revalidatePath('/dashboard/tally');
    return { success: true, data: item };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to resolve discrepancy' };
  }
}
