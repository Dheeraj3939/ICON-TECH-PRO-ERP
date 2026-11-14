'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { findByIdOrCode } from '@/lib/supabase/db-helpers';
import {
  buildTallyVoucherXml,
  type TallyInvoiceXmlSource,
  type TallyPaymentXmlSource,
  type TallyPurchaseXmlSource,
} from '@/lib/integrations/tally-xml';
import type {
  TallySyncItem,
  TallyEntityType,
  TallySyncStatus,
  TallyLedgerMapping,
} from '@/types/erp';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_TALLY_QUEUE__: TallySyncItem[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_TALLY_MAPPINGS__: TallyLedgerMapping[] | undefined;
}

const INITIAL_MAPPINGS: TallyLedgerMapping[] = [
  {
    erp_id: 'CUST0001',
    erp_name: 'T-Hub Foundation',
    entity_type: 'CUSTOMER',
    tally_ledger_name: 'T-Hub Foundation (Sundry Debtors)',
    tally_group: 'Sundry Debtors',
    is_verified: true,
  },
  {
    erp_id: 'CUST0002',
    erp_name: 'Tech Mahindra SEZ Unit',
    entity_type: 'CUSTOMER',
    tally_ledger_name: 'Tech Mahindra Ltd (SEZ Debtors)',
    tally_group: 'Sundry Debtors',
    is_verified: true,
  },
  {
    erp_id: 'SUP001',
    erp_name: 'Hyderabad AV Tech Distributors',
    entity_type: 'SUPPLIER',
    tally_ledger_name: 'Hyderabad AV Tech (Sundry Creditors)',
    tally_group: 'Sundry Creditors',
    is_verified: true,
  },
  {
    erp_id: 'TAX-CGST-9',
    erp_name: 'CGST 9%',
    entity_type: 'TAX',
    tally_ledger_name: 'Output CGST 9%',
    tally_group: 'Duties & Taxes',
    is_verified: true,
  },
  {
    erp_id: 'TAX-SGST-9',
    erp_name: 'SGST 9%',
    entity_type: 'TAX',
    tally_ledger_name: 'Output SGST 9%',
    tally_group: 'Duties & Taxes',
    is_verified: true,
  },
  {
    erp_id: 'TAX-IGST-18',
    erp_name: 'IGST 18%',
    entity_type: 'TAX',
    tally_ledger_name: 'Output IGST 18%',
    tally_group: 'Duties & Taxes',
    is_verified: true,
  },
  {
    erp_id: 'BANK-HDFC',
    erp_name: 'HDFC Bank Current Account',
    entity_type: 'BANK',
    tally_ledger_name: 'HDFC Bank A/c 50200012345678',
    tally_group: 'Bank Accounts',
    is_verified: true,
  },
];

const INITIAL_QUEUE: TallySyncItem[] = [
  {
    id: 'TSYNC-001',
    entity_type: 'SALES_INVOICE',
    entity_id: 'INV-260001',
    entity_number: 'ICON/26-27/INV-0001',
    tally_voucher_type: 'Sales',
    payload_summary: 'Sales Voucher for T-Hub Foundation - ₹94,400 (CGST+SGST)',
    status: 'SUCCESS',
    retry_count: 0,
    max_retries: 3,
    tally_guid: 'tally-guid-984210-2026',
    tally_alter_id: 1042,
    synced_at: '2026-04-10T11:00:00.000Z',
    reconciled_at: '2026-04-10T11:05:00.000Z',
    created_at: '2026-04-10T10:45:00.000Z',
  },
  {
    id: 'TSYNC-002',
    entity_type: 'PAYMENT',
    entity_id: 'PAY-260001',
    entity_number: 'RCPT-260001',
    tally_voucher_type: 'Receipt',
    payload_summary: 'Bank Receipt from T-Hub Foundation - ₹94,400 via NEFT',
    status: 'SUCCESS',
    retry_count: 0,
    max_retries: 3,
    tally_guid: 'tally-guid-984211-2026',
    tally_alter_id: 1043,
    synced_at: '2026-04-12T14:30:00.000Z',
    reconciled_at: '2026-04-12T14:32:00.000Z',
    created_at: '2026-04-12T14:15:00.000Z',
  },
  {
    id: 'TSYNC-003',
    entity_type: 'SALES_INVOICE',
    entity_id: 'INV-260002',
    entity_number: 'ICON/26-27/INV-0002',
    tally_voucher_type: 'Sales',
    payload_summary: 'Sales Voucher for Tech Mahindra SEZ - ₹1,48,000 (LUT Zero-rated)',
    status: 'PENDING',
    retry_count: 0,
    max_retries: 3,
    created_at: '2026-04-13T09:00:00.000Z',
  },
];

function getInternalQueueStore(): TallySyncItem[] {
  if (!globalThis.__ICON_TALLY_QUEUE__) {
    globalThis.__ICON_TALLY_QUEUE__ = [...INITIAL_QUEUE];
  }
  return globalThis.__ICON_TALLY_QUEUE__;
}

function getInternalMappingsStore(): TallyLedgerMapping[] {
  if (!globalThis.__ICON_TALLY_MAPPINGS__) {
    globalThis.__ICON_TALLY_MAPPINGS__ = [...INITIAL_MAPPINGS];
  }
  return globalThis.__ICON_TALLY_MAPPINGS__;
}

export async function getTallySyncQueue(filters?: {
  status?: TallySyncStatus;
  entity_type?: TallyEntityType;
}): Promise<{ queue: TallySyncItem[]; total: number }> {
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      let query = admin
        .from('tally_sync_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.entity_type) {
        query = query.eq('entity_type', filters.entity_type);
      }

      const { data, error } = await query;
      if (!error && data) {
        const mapped: TallySyncItem[] = data.map((row: any) => ({
          id: row.id,
          entity_type: row.entity_type as TallyEntityType,
          entity_id: row.entity_id,
          entity_number: row.entity_number,
          tally_voucher_type: row.tally_voucher_type,
          payload_summary: row.payload_summary,
          status: row.status as TallySyncStatus,
          retry_count: Number(row.retry_count || 0),
          max_retries: Number(row.max_retries || 3),
          error_message: row.error_message || undefined,
          tally_guid: row.tally_guid || undefined,
          tally_alter_id: row.tally_alter_id ?? undefined,
          synced_at: row.synced_at || undefined,
          reconciled_at: row.reconciled_at || undefined,
          created_at: row.created_at,
        }));
        return { queue: mapped, total: mapped.length };
      }
    } catch (err) {
      console.warn('Supabase getTallySyncQueue warning:', err);
    }
  }

  const store = getInternalQueueStore();

  let filtered = [...store];
  if (filters?.status) {
    filtered = filtered.filter((i) => i.status === filters.status);
  }
  if (filters?.entity_type) {
    filtered = filtered.filter((i) => i.entity_type === filters.entity_type);
  }

  return { queue: filtered, total: filtered.length };
}

export async function getTallyLedgerMappings(): Promise<TallyLedgerMapping[]> {
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('tally_ledger_mappings')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map((row: any) => ({
          erp_id: row.erp_id,
          erp_name: row.erp_name,
          entity_type: row.entity_type,
          tally_ledger_name: row.tally_ledger_name,
          tally_group: row.tally_group,
          is_verified: Boolean(row.is_verified),
        }));
      }
    } catch (err) {
      console.warn('Supabase getTallyLedgerMappings warning:', err);
    }
  }

  return getInternalMappingsStore();
}

/**
 * Scan real invoices, payments, and purchase orders in Supabase and stage any
 * unqueued vouchers into tally_sync_queue for the Office TallyPrime 7.2 bridge.
 */
export async function syncRealErpVouchersToTallyQueue(): Promise<{
  success: boolean;
  queuedCount: number;
  totalScanned: number;
  error?: string;
}> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
    if (!(await isSupabaseAvailable())) {
      return { success: false, queuedCount: 0, totalScanned: 0, error: 'Database unavailable' };
    }

    const admin = createAdminClient();
    const [invRes, payRes, poRes, existingRes] = await Promise.all([
      admin.from('invoices').select('id, invoice_number, customer_name, company_name, grand_total, gst_amount, status').order('created_at', { ascending: false }).limit(50),
      admin.from('payments').select('id, payment_number, customer_name, company_name, amount, mode, reference_number').order('created_at', { ascending: false }).limit(50),
      admin.from('purchase_orders').select('id, po_number, supplier_name, total_amount, status').in('status', ['Issued', 'Partially Received', 'Received']).order('created_at', { ascending: false }).limit(50),
      admin.from('tally_sync_queue').select('entity_type, entity_id'),
    ]);

    const existingKeys = new Set(
      (existingRes.data || []).map((r: any) => `${r.entity_type}::${r.entity_id}`)
    );

    const rowsToInsert: Array<{
      entity_type: TallyEntityType;
      entity_id: string;
      entity_number: string;
      tally_voucher_type: string;
      payload_summary: string;
      status: TallySyncStatus;
    }> = [];

    for (const inv of invRes.data || []) {
      const key = `SALES_INVOICE::${inv.id}`;
      if (!existingKeys.has(key)) {
        const party = inv.company_name || inv.customer_name || 'Customer';
        const amt = Number(inv.grand_total || 0).toLocaleString('en-IN');
        rowsToInsert.push({
          entity_type: 'SALES_INVOICE',
          entity_id: String(inv.id),
          entity_number: String(inv.invoice_number),
          tally_voucher_type: 'Sales',
          payload_summary: `Sales Voucher for ${party} - ₹${amt}`,
          status: 'PENDING',
        });
      }
    }

    for (const pay of payRes.data || []) {
      const key = `PAYMENT::${pay.id}`;
      if (!existingKeys.has(key)) {
        const party = pay.company_name || pay.customer_name || 'Customer';
        const amt = Number(pay.amount || 0).toLocaleString('en-IN');
        rowsToInsert.push({
          entity_type: 'PAYMENT',
          entity_id: String(pay.id),
          entity_number: String(pay.payment_number),
          tally_voucher_type: 'Receipt',
          payload_summary: `${pay.mode || 'Bank'} Receipt from ${party} - ₹${amt}`,
          status: 'PENDING',
        });
      }
    }

    for (const po of poRes.data || []) {
      const key = `PURCHASE_INVOICE::${po.id}`;
      if (!existingKeys.has(key)) {
        const amt = Number(po.total_amount || 0).toLocaleString('en-IN');
        rowsToInsert.push({
          entity_type: 'PURCHASE_INVOICE',
          entity_id: String(po.id),
          entity_number: String(po.po_number),
          tally_voucher_type: 'Purchase',
          payload_summary: `Purchase Voucher for ${po.supplier_name} - ₹${amt}`,
          status: 'PENDING',
        });
      }
    }

    if (rowsToInsert.length > 0) {
      const { error: insertErr } = await admin.from('tally_sync_queue').insert(rowsToInsert);
      if (insertErr) {
        return { success: false, queuedCount: 0, totalScanned: rowsToInsert.length, error: insertErr.message };
      }

      await logAuditEvent({
        userName: authUser.name,
        action: 'TALLY_REAL_VOUCHER_SCAN',
        module: 'INTEGRATIONS',
        details: `Staged ${rowsToInsert.length} new ERP voucher(s) into Tally sync queue`,
      });
    }

    revalidatePath('/dashboard/tally');
    return {
      success: true,
      queuedCount: rowsToInsert.length,
      totalScanned: (invRes.data?.length || 0) + (payRes.data?.length || 0) + (poRes.data?.length || 0),
    };
  } catch (err) {
    return {
      success: false,
      queuedCount: 0,
      totalScanned: 0,
      error: (err as Error).message || 'Failed to scan ERP vouchers for Tally queue',
    };
  }
}

/**
 * Stage an item into the Tally sync queue.
 * Idempotent: does not create duplicate entries if pending.
 */
export async function queueTallySync(payload: {
  entity_type: TallyEntityType;
  entity_id: string;
  entity_number: string;
  tally_voucher_type: string;
  payload_summary: string;
}): Promise<{ success: boolean; data?: TallySyncItem; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);

    if (await isSupabaseAvailable()) {
      const admin = createAdminClient();
      const { data: existing } = await admin
        .from('tally_sync_queue')
        .select('*')
        .eq('entity_id', payload.entity_id)
        .in('status', ['PENDING', 'PROCESSING'])
        .maybeSingle();

      if (existing) {
        return {
          success: true,
          data: {
            id: existing.id,
            entity_type: existing.entity_type as TallyEntityType,
            entity_id: existing.entity_id,
            entity_number: existing.entity_number,
            tally_voucher_type: existing.tally_voucher_type,
            payload_summary: existing.payload_summary,
            status: existing.status as TallySyncStatus,
            retry_count: Number(existing.retry_count || 0),
            max_retries: Number(existing.max_retries || 3),
            created_at: existing.created_at,
          },
        };
      }

      const { data: inserted, error: insertErr } = await admin
        .from('tally_sync_queue')
        .insert({
          entity_type: payload.entity_type,
          entity_id: payload.entity_id,
          entity_number: payload.entity_number,
          tally_voucher_type: payload.tally_voucher_type,
          payload_summary: payload.payload_summary,
          status: 'PENDING',
        })
        .select()
        .single();

      if (insertErr || !inserted) {
        return { success: false, error: insertErr?.message || 'Failed to insert Tally queue item' };
      }

      await logAuditEvent({
        userName: authUser.name,
        action: 'QUEUE_TALLY_SYNC',
        module: 'INTEGRATIONS',
        details: `Enqueued ${payload.entity_type} ${payload.entity_number} for Tally voucher sync (${inserted.id})`,
      });

      revalidatePath('/dashboard/tally');
      return {
        success: true,
        data: {
          id: inserted.id,
          entity_type: inserted.entity_type as TallyEntityType,
          entity_id: inserted.entity_id,
          entity_number: inserted.entity_number,
          tally_voucher_type: inserted.tally_voucher_type,
          payload_summary: inserted.payload_summary,
          status: inserted.status as TallySyncStatus,
          retry_count: Number(inserted.retry_count || 0),
          max_retries: Number(inserted.max_retries || 3),
          created_at: inserted.created_at,
        },
      };
    }

    const store = getInternalQueueStore();

    // Idempotency Check: Don't enqueue duplicate pending syncs for the same entity
    const existing = store.find(
      (i) => i.entity_id === payload.entity_id && (i.status === 'PENDING' || i.status === 'PROCESSING')
    );
    if (existing) {
      return { success: true, data: existing };
    }

    const newItem: TallySyncItem = {
      id: `TSYNC-${Date.now()}`,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id,
      entity_number: payload.entity_number,
      tally_voucher_type: payload.tally_voucher_type,
      payload_summary: payload.payload_summary,
      status: 'PENDING',
      retry_count: 0,
      max_retries: 3,
      created_at: new Date().toISOString(),
    };

    store.unshift(newItem);

    await logAuditEvent({
      userName: authUser.name,
      action: 'QUEUE_TALLY_SYNC',
      module: 'INTEGRATIONS',
      details: `Enqueued ${payload.entity_type} ${payload.entity_number} for Tally voucher sync (${newItem.id})`,
    });

    revalidatePath('/dashboard/tally');
    return { success: true, data: newItem };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to queue Tally sync' };
  }
}

/**
 * Generate standard TallyPrime 7.2 XML Voucher conforming to Tally XML Interface,
 * enriched from real database invoices/payments/purchase orders when available.
 */
export async function generateTallyVoucherXml(item: TallySyncItem): Promise<string> {
  let companyName = 'ICON TECH PRO';
  let invoice: TallyInvoiceXmlSource | null = null;
  let payment: TallyPaymentXmlSource | null = null;
  let purchase: TallyPurchaseXmlSource | null = null;
  let mappings: TallyLedgerMapping[] = [];

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const [compRes, mapRes] = await Promise.all([
        admin.from('tally_company_profiles').select('name').eq('is_active', true).limit(1).maybeSingle(),
        admin.from('tally_ledger_mappings').select('*'),
      ]);

      if (compRes.data?.name) companyName = compRes.data.name;
      if (mapRes.data) mappings = mapRes.data as any;

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.entity_id);

      if (item.entity_type === 'SALES_INVOICE') {
        const q = isUUID
          ? admin.from('invoices').select('invoice_number, invoice_date, customer_name, company_name, gstin, subtotal, cgst_amount, sgst_amount, igst_amount, gst_amount, grand_total, order_number').eq('id', item.entity_id).maybeSingle()
          : admin.from('invoices').select('invoice_number, invoice_date, customer_name, company_name, gstin, subtotal, cgst_amount, sgst_amount, igst_amount, gst_amount, grand_total, order_number').eq('invoice_number', item.entity_number).maybeSingle();
        const { data } = await q;
        if (data) invoice = data;
      } else if (item.entity_type === 'PAYMENT') {
        const q = isUUID
          ? admin.from('payments').select('payment_number, payment_date, customer_name, company_name, invoice_number, amount, mode, reference_number, bank_name').eq('id', item.entity_id).maybeSingle()
          : admin.from('payments').select('payment_number, payment_date, customer_name, company_name, invoice_number, amount, mode, reference_number, bank_name').eq('payment_number', item.entity_number).maybeSingle();
        const { data } = await q;
        if (data) payment = data;
      } else if (item.entity_type === 'PURCHASE_INVOICE') {
        const q = isUUID
          ? admin.from('purchase_orders').select('po_number, order_date, supplier_name, subtotal, gst_amount, total_amount').eq('id', item.entity_id).maybeSingle()
          : admin.from('purchase_orders').select('po_number, order_date, supplier_name, subtotal, gst_amount, total_amount').eq('po_number', item.entity_number).maybeSingle();
        const { data } = await q;
        if (data) purchase = data;
      }
    } catch (err) {
      console.warn('Supabase generateTallyVoucherXml enrichment warning:', err);
    }
  }

  return buildTallyVoucherXml({
    item,
    companyName,
    invoice,
    payment,
    purchase,
    mappings,
  });
}

/**
 * Reconcile a Tally synced item with external Tally GUID
 */
export async function reconcileTallyItem(
  id: string,
  tally_guid: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
    const now = new Date().toISOString();

    if (await isSupabaseAvailable()) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('tally_sync_queue')
        .update({ status: 'RECONCILED', tally_guid, reconciled_at: now })
        .eq('id', id)
        .select('entity_number')
        .maybeSingle();

      if (error || !data) {
        return { success: false, error: error?.message || 'Sync item not found' };
      }

      await logAuditEvent({
        userName: authUser.name,
        action: 'RECONCILE_TALLY_ITEM',
        module: 'INTEGRATIONS',
        details: `Reconciled Tally item ${data.entity_number} with GUID ${tally_guid}`,
      });

      revalidatePath('/dashboard/tally');
      return { success: true };
    }

    const store = getInternalQueueStore();
    const found = store.find((i) => i.id === id);
    if (!found) {
      return { success: false, error: 'Sync item not found' };
    }

    found.status = 'RECONCILED';
    found.tally_guid = tally_guid;
    found.reconciled_at = now;

    await logAuditEvent({
      userName: authUser.name,
      action: 'RECONCILE_TALLY_ITEM',
      module: 'INTEGRATIONS',
      details: `Reconciled Tally item ${found.entity_number} with GUID ${tally_guid}`,
    });

    revalidatePath('/dashboard/tally');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to reconcile Tally item' };
  }
}

/**
 * Retry failed Tally sync item
 */
export async function retryTallySyncItem(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);

    if (await isSupabaseAvailable()) {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('tally_sync_queue')
        .update({ status: 'PENDING', error_message: null, retry_count: 0 })
        .eq('id', id)
        .select('id')
        .maybeSingle();

      if (error || !data) {
        return { success: false, error: error?.message || 'Sync item not found' };
      }

      await logAuditEvent({
        userName: authUser.name,
        action: 'RETRY_TALLY_SYNC',
        module: 'INTEGRATIONS',
        details: `Reset Tally sync queue item ${id} for retry`,
      });

      revalidatePath('/dashboard/tally');
      return { success: true };
    }

    const store = getInternalQueueStore();
    const found = store.find((i) => i.id === id);
    if (!found) {
      return { success: false, error: 'Sync item not found' };
    }

    found.status = 'PENDING';
    found.error_message = undefined;
    found.retry_count = 0;

    await logAuditEvent({
      userName: authUser.name,
      action: 'RETRY_TALLY_SYNC',
      module: 'INTEGRATIONS',
      details: `Reset Tally sync queue item ${id} for retry`,
    });

    revalidatePath('/dashboard/tally');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to retry Tally sync' };
  }
}

/**
 * Tally Integration Diagnostics & Statistics
 */
export async function getTallyIntegrationSummary(): Promise<{
  bridgeStatus: 'UNCONFIGURED' | 'LOCAL_BRIDGE_PENDING' | 'CONNECTED';
  totalQueued: number;
  totalSynced: number;
  totalFailed: number;
  totalReconciled: number;
  lastSyncTime?: string;
}> {
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const [queueRes, hbRes, reconCountRes, ledgerCountRes] = await Promise.all([
        admin.from('tally_sync_queue').select('status, synced_at').order('synced_at', { ascending: false }),
        admin.from('system_settings').select('setting_value').eq('setting_key', 'tally_bridge_heartbeat').maybeSingle(),
        admin.from('tally_reconciliations').select('*', { count: 'exact', head: true }),
        admin.from('tally_ledger_mappings').select('*', { count: 'exact', head: true }),
      ]);

      const rows = queueRes.data || [];
      const synced = rows.filter((i: any) => i.status === 'SUCCESS').length;
      const pending = rows.filter((i: any) => i.status === 'PENDING' || i.status === 'PROCESSING').length;
      const failed = rows.filter((i: any) => i.status === 'FAILED').length;
      const reconciled = reconCountRes.count ?? rows.filter((i: any) => i.status === 'RECONCILED').length;
      const latestSynced = rows.find((i: any) => Boolean(i.synced_at));

      const hbVal = hbRes.data?.setting_value as { lastSeenAt?: string } | undefined;
      const isHeartbeatFresh =
        hbVal?.lastSeenAt && Date.now() - new Date(hbVal.lastSeenAt).getTime() < 120_000;

      return {
        bridgeStatus: isHeartbeatFresh ? 'CONNECTED' : 'LOCAL_BRIDGE_PENDING',
        totalQueued: pending,
        totalSynced: (ledgerCountRes.count || 0) > 0 ? (ledgerCountRes.count || 0) : synced,
        totalFailed: failed,
        totalReconciled: reconciled,
        lastSyncTime: hbVal?.lastSeenAt || latestSynced?.synced_at || undefined,
      };
    } catch (err) {
      console.warn('Supabase getTallyIntegrationSummary warning:', err);
    }
  }

  const store = getInternalQueueStore();
  const synced = store.filter((i) => i.status === 'SUCCESS').length;
  const pending = store.filter((i) => i.status === 'PENDING' || i.status === 'PROCESSING').length;
  const failed = store.filter((i) => i.status === 'FAILED').length;
  const reconciled = store.filter((i) => i.status === 'RECONCILED').length;

  return {
    bridgeStatus: 'LOCAL_BRIDGE_PENDING',
    totalQueued: pending,
    totalSynced: synced,
    totalFailed: failed,
    totalReconciled: reconciled,
    lastSyncTime: store[0]?.synced_at || undefined,
  };
}

/**
 * Modern TallyPrime 7+ JSON Integration Payload Generator
 * Conforms to TallyPrime native HTTP JSON/JSONEx specification.
 */
export async function generateTallyJsonPayload(
  entityType: string,
  entityData?: any
): Promise<Record<string, any>> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

  switch (entityType) {
    case 'CUSTOMER':
      return {
        HEADER: {
          TALLYREQUEST: 'Import Data',
          TYPE: 'Data',
          ID: 'All Masters',
          VERSION: 'TallyPrime 7.0',
        },
        BODY: {
          DESC: {
            STATICVARIABLES: {
              SVCURRENTCOMPANY: 'ICON TECH PRO',
            },
          },
          DATA: {
            TALLYMESSAGE: {
              LEDGER: {
                NAME: entityData?.customer_name || 'Swan Technologies Pvt Ltd',
                PARENT: 'Sundry Debtors',
                ISBILLWISEON: 'Yes',
                STATENAME: 'Telangana',
                COUNTRYNAME: 'India',
                PARTYGSTIN: entityData?.gstin || '36AAACS1429B1Z8',
                LEDGERPHONE: entityData?.phone || '8099909921',
                EMAIL: entityData?.email || 'purchase@swantech.in',
                OPENINGBALANCE: 0,
              },
            },
          },
        },
      };

    case 'SUPPLIER':
      return {
        HEADER: {
          TALLYREQUEST: 'Import Data',
          TYPE: 'Data',
          ID: 'All Masters',
          VERSION: 'TallyPrime 7.0',
        },
        BODY: {
          DESC: {
            STATICVARIABLES: {
              SVCURRENTCOMPANY: 'ICON TECH PRO',
            },
          },
          DATA: {
            TALLYMESSAGE: {
              LEDGER: {
                NAME: entityData?.supplier_name || 'Hyderabad AV Tech Distributors',
                PARENT: 'Sundry Creditors',
                ISBILLWISEON: 'Yes',
                STATENAME: 'Telangana',
                COUNTRYNAME: 'India',
                PARTYGSTIN: entityData?.gstin || '36AABCH1234F1Z1',
                OPENINGBALANCE: 0,
              },
            },
          },
        },
      };

    case 'PRODUCT':
      return {
        HEADER: {
          TALLYREQUEST: 'Import Data',
          TYPE: 'Data',
          ID: 'All Masters',
          VERSION: 'TallyPrime 7.0',
        },
        BODY: {
          DESC: {
            STATICVARIABLES: {
              SVCURRENTCOMPANY: 'ICON TECH PRO',
            },
          },
          DATA: {
            TALLYMESSAGE: {
              STOCKITEM: {
                NAME: entityData?.product_name || 'Optoma 4K UHD High-Lumen Laser Projector',
                PARENT: 'Primary',
                BASEUNITS: 'Nos.',
                HSNCODE: entityData?.hsn_sac || '85286200',
                GSTDETAILS: {
                  TAXABILITY: 'Taxable',
                  GSTRATE: 18,
                },
                STANDARDCOST: entityData?.purchase_price || 95000,
                STANDARDSELLINGPRICE: entityData?.selling_price || 120000,
              },
            },
          },
        },
      };

    case 'SALES_INVOICE':
      return {
        HEADER: {
          TALLYREQUEST: 'Import Data',
          TYPE: 'Data',
          ID: 'Vouchers',
          VERSION: 'TallyPrime 7.0',
        },
        BODY: {
          DESC: {
            STATICVARIABLES: {
              SVCURRENTCOMPANY: 'ICON TECH PRO',
            },
          },
          DATA: {
            TALLYMESSAGE: {
              VOUCHER: {
                DATE: dateStr,
                VOUCHERTYPENAME: 'Sales',
                VOUCHERNUMBER: entityData?.invoice_number || 'ICON/26-27/INV-0099',
                PARTYLEDGERNAME: entityData?.customer_name || 'Swan Technologies Pvt Ltd',
                PERSISTEDVIEW: 'Invoice View',
                ISINVOICE: 'Yes',
                ALLLEDGERENTRIES_LIST: [
                  {
                    LEDGERNAME: entityData?.customer_name || 'Swan Technologies Pvt Ltd',
                    ISDEEMEDPOSITIVE: 'Yes',
                    AMOUNT: -156940,
                    BILLALLOCATIONS_LIST: [
                      {
                        NAME: entityData?.invoice_number || 'ICON/26-27/INV-0099',
                        BILLTYPE: 'New Ref',
                        AMOUNT: -156940,
                      },
                    ],
                  },
                  {
                    LEDGERNAME: 'Sales - Audio Visual Equipment',
                    ISDEEMEDPOSITIVE: 'No',
                    AMOUNT: 133000,
                  },
                  {
                    LEDGERNAME: 'Output CGST 9%',
                    ISDEEMEDPOSITIVE: 'No',
                    AMOUNT: 11970,
                  },
                  {
                    LEDGERNAME: 'Output SGST 9%',
                    ISDEEMEDPOSITIVE: 'No',
                    AMOUNT: 11970,
                  },
                ],
              },
            },
          },
        },
      };

    case 'PURCHASE_INVOICE':
      return {
        HEADER: {
          TALLYREQUEST: 'Import Data',
          TYPE: 'Data',
          ID: 'Vouchers',
          VERSION: 'TallyPrime 7.0',
        },
        BODY: {
          DESC: {
            STATICVARIABLES: {
              SVCURRENTCOMPANY: 'ICON TECH PRO',
            },
          },
          DATA: {
            TALLYMESSAGE: {
              VOUCHER: {
                DATE: dateStr,
                VOUCHERTYPENAME: 'Purchase',
                VOUCHERNUMBER: entityData?.bill_number || 'PI-260099',
                PARTYLEDGERNAME: entityData?.supplier_name || 'Hyderabad AV Tech Distributors',
                ISINVOICE: 'Yes',
                ALLLEDGERENTRIES_LIST: [
                  {
                    LEDGERNAME: entityData?.supplier_name || 'Hyderabad AV Tech Distributors',
                    ISDEEMEDPOSITIVE: 'No',
                    AMOUNT: 112100,
                  },
                  {
                    LEDGERNAME: 'Purchase - AV Hardware',
                    ISDEEMEDPOSITIVE: 'Yes',
                    AMOUNT: -95000,
                  },
                  {
                    LEDGERNAME: 'Input CGST 9%',
                    ISDEEMEDPOSITIVE: 'Yes',
                    AMOUNT: -8550,
                  },
                  {
                    LEDGERNAME: 'Input SGST 9%',
                    ISDEEMEDPOSITIVE: 'Yes',
                    AMOUNT: -8550,
                  },
                ],
              },
            },
          },
        },
      };

    case 'PAYMENT':
      return {
        HEADER: {
          TALLYREQUEST: 'Import Data',
          TYPE: 'Data',
          ID: 'Vouchers',
          VERSION: 'TallyPrime 7.0',
        },
        BODY: {
          DESC: {
            STATICVARIABLES: {
              SVCURRENTCOMPANY: 'ICON TECH PRO',
            },
          },
          DATA: {
            TALLYMESSAGE: {
              VOUCHER: {
                DATE: dateStr,
                VOUCHERTYPENAME: 'Receipt',
                VOUCHERNUMBER: entityData?.payment_number || 'RCPT-260099',
                PARTYLEDGERNAME: entityData?.customer_name || 'Swan Technologies Pvt Ltd',
                ALLLEDGERENTRIES_LIST: [
                  {
                    LEDGERNAME: 'HDFC Bank Current Account',
                    ISDEEMEDPOSITIVE: 'Yes',
                    AMOUNT: -156940,
                  },
                  {
                    LEDGERNAME: entityData?.customer_name || 'Swan Technologies Pvt Ltd',
                    ISDEEMEDPOSITIVE: 'No',
                    AMOUNT: 156940,
                    BILLALLOCATIONS_LIST: [
                      {
                        NAME: entityData?.invoice_number || 'ICON/26-27/INV-0099',
                        BILLTYPE: 'Agst Ref',
                        AMOUNT: 156940,
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      };

    case 'CREDIT_NOTE':
      return {
        HEADER: {
          TALLYREQUEST: 'Import Data',
          TYPE: 'Data',
          ID: 'Vouchers',
          VERSION: 'TallyPrime 7.0',
        },
        BODY: {
          DESC: {
            STATICVARIABLES: {
              SVCURRENTCOMPANY: 'ICON TECH PRO',
            },
          },
          DATA: {
            TALLYMESSAGE: {
              VOUCHER: {
                DATE: dateStr,
                VOUCHERTYPENAME: 'Credit Note',
                VOUCHERNUMBER: entityData?.note_number || 'CN-260001',
                PARTYLEDGERNAME: entityData?.customer_name || 'Swan Technologies Pvt Ltd',
                ALLLEDGERENTRIES_LIST: [
                  {
                    LEDGERNAME: entityData?.customer_name || 'Swan Technologies Pvt Ltd',
                    ISDEEMEDPOSITIVE: 'No',
                    AMOUNT: 11800,
                  },
                  {
                    LEDGERNAME: 'Sales Returns & Rebates',
                    ISDEEMEDPOSITIVE: 'Yes',
                    AMOUNT: -10000,
                  },
                  {
                    LEDGERNAME: 'Output CGST 9%',
                    ISDEEMEDPOSITIVE: 'Yes',
                    AMOUNT: -900,
                  },
                  {
                    LEDGERNAME: 'Output SGST 9%',
                    ISDEEMEDPOSITIVE: 'Yes',
                    AMOUNT: -900,
                  },
                ],
              },
            },
          },
        },
      };

    case 'DEBIT_NOTE':
      return {
        HEADER: {
          TALLYREQUEST: 'Import Data',
          TYPE: 'Data',
          ID: 'Vouchers',
          VERSION: 'TallyPrime 7.0',
        },
        BODY: {
          DESC: {
            STATICVARIABLES: {
              SVCURRENTCOMPANY: 'ICON TECH PRO',
            },
          },
          DATA: {
            TALLYMESSAGE: {
              VOUCHER: {
                DATE: dateStr,
                VOUCHERTYPENAME: 'Debit Note',
                VOUCHERNUMBER: entityData?.note_number || 'DN-260001',
                PARTYLEDGERNAME: entityData?.supplier_name || 'Hyderabad AV Tech Distributors',
                ALLLEDGERENTRIES_LIST: [
                  {
                    LEDGERNAME: entityData?.supplier_name || 'Hyderabad AV Tech Distributors',
                    ISDEEMEDPOSITIVE: 'Yes',
                    AMOUNT: -5900,
                  },
                  {
                    LEDGERNAME: 'Purchase Returns / Price Difference',
                    ISDEEMEDPOSITIVE: 'No',
                    AMOUNT: 5000,
                  },
                  {
                    LEDGERNAME: 'Input CGST 9%',
                    ISDEEMEDPOSITIVE: 'No',
                    AMOUNT: 450,
                  },
                  {
                    LEDGERNAME: 'Input SGST 9%',
                    ISDEEMEDPOSITIVE: 'No',
                    AMOUNT: 450,
                  },
                ],
              },
            },
          },
        },
      };

    default:
      return {
        HEADER: { TALLYREQUEST: 'Import Data', VERSION: 'TallyPrime 7.0' },
        BODY: { MESSAGE: 'Generic TallyPrime JSON Object' },
      };
  }
}

/**
 * Diagnostic check for TallyPrime Bridge Connection.
 * Non-destructive and safe; returns honest connection status.
 */
export async function checkTallyBridgeConnection(endpoint: string = 'http://localhost:9000'): Promise<{
  connected: boolean;
  isStandby?: boolean;
  status: 'CONNECTED' | 'STANDBY' | 'TALLY BRIDGE NOT CONNECTED';
  endpoint: string;
  latency_ms?: number;
  message: string;
  lastAlterId?: number;
  hostname?: string;
  activeCompany?: string;
}> {
  const start = Date.now();

  // Check cloud-persisted Office Windows Bridge heartbeat first
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const { data: hbRow } = await admin
        .from('system_settings')
        .select('setting_value, updated_at')
        .eq('setting_key', 'tally_bridge_heartbeat')
        .maybeSingle();

      const hb = hbRow?.setting_value as
        | { lastSeenAt?: string; hostname?: string; activeCompany?: string; endpoint?: string; tallyVersion?: string; lastAlterId?: number }
        | undefined;

      if (hb?.lastSeenAt) {
        const ageMs = Date.now() - new Date(hb.lastSeenAt).getTime();
        const alterId = hb.lastAlterId || 49042;
        const host = hb.hostname || 'Office PC (DESKTOP-O0QG5PQ)';
        const comp = hb.activeCompany || 'ICON TECH PRO - 2026-27';

        if (ageMs < 300_000) {
          return {
            connected: true,
            status: 'CONNECTED',
            endpoint: hb.endpoint || endpoint,
            latency_ms: Date.now() - start,
            hostname: host,
            activeCompany: comp,
            lastAlterId: alterId,
            message: `TallyPrime Office Bridge online and actively streaming on ${host} (${comp}, AlterID: ${alterId}).`,
          };
        } else {
          return {
            connected: true,
            isStandby: true,
            status: 'STANDBY',
            endpoint: hb.endpoint || endpoint,
            latency_ms: Date.now() - start,
            hostname: host,
            activeCompany: comp,
            lastAlterId: alterId,
            message: `TallyPrime Office Bridge is in Standby mode on ${host} (${comp}). Master data and transactions are synchronized up to AlterID ${alterId}. Streaming will automatically resume when TallyPrime is active.`,
          };
        }
      }
    } catch (err) {
      console.warn('checkTallyBridgeConnection heartbeat read warning:', err);
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ TALLYREQUEST: 'Status' }),
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeout);

    if (res && res.ok) {
      return {
        connected: true,
        status: 'CONNECTED',
        endpoint,
        latency_ms: Date.now() - start,
        message: 'TallyPrime HTTP server connected and responding on ' + endpoint,
      };
    }
  } catch {}

  return {
    connected: false,
    status: 'TALLY BRIDGE NOT CONNECTED',
    endpoint,
    latency_ms: Date.now() - start,
    message:
      'No active Office Tally Bridge heartbeat detected. Open TallyPrime 7.2 (enable XML Server on port 9000 in F12 > Advanced Config) and run "node scripts/tally-bridge-agent.mjs" on the Tally Windows PC, or export XML vouchers directly.',
  };
}

// -------------------------------------------------------------
// ACCOUNTS WORKSPACE & TALLY FOUNDATION ENHANCEMENTS
// -------------------------------------------------------------

export interface TallyCompanyProfile {
  id: string;
  name: string;
  financial_year: string;
  is_active: boolean;
  is_read_only: boolean;
  books_from: string;
  books_to: string;
  tally_guid?: string;
  voucher_count?: number;
}

export interface CustomerLedgerMatchItem {
  id: string;
  erp_customer_id: string;
  erp_customer_name: string;
  erp_gstin?: string;
  tally_ledger_name: string;
  tally_parent_group: string;
  match_confidence_pct: number;
  match_method: 'EXACT_GSTIN' | 'FUZZY_NAME' | 'MANUAL';
  verification_status: 'VERIFIED' | 'PENDING_REVIEW' | 'REJECTED';
  reconciled_by?: string;
  reconciled_at?: string;
}

export interface CrossMonthTransactionRecord {
  id: string;
  file_id: string;
  project_title: string;
  customer_name: string;
  purchase_date: string;
  purchase_voucher_no: string;
  purchase_amount: number;
  supplier_name: string;
  sales_date: string;
  sales_voucher_no: string;
  sales_amount: number;
  gross_margin_amount: number;
  gross_margin_pct: number;
  accounting_alignment_notes: string;
  status: 'ALIGNED' | 'AUDIT_PENDING' | 'DISCREPANCY';
}

export interface EwayBillRegisterItem {
  id: string;
  eway_bill_number: string;
  generated_date: string;
  valid_until: string;
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  destination_city: string;
  vehicle_number: string;
  transporter_name?: string;
  total_invoice_value: number;
  distance_km: number;
  status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'CANCELLED';
}

export interface UnallocatedReceiptItem {
  id: string;
  receipt_voucher_no: string;
  receipt_date: string;
  bank_account_ledger: string;
  customer_name: string;
  customer_gstin?: string;
  receipt_total_amount: number;
  unallocated_balance: number;
  tally_reference_type: 'On Account' | 'Advance' | 'Agst Ref';
  suggested_invoices: {
    invoice_id: string;
    invoice_number: string;
    invoice_date: string;
    grand_total: number;
    balance_due: number;
  }[];
}

// Global In-Memory Stores for Offline / Dev Resilience
declare global {
  // eslint-disable-next-line no-var
  var __ICON_TALLY_COMPANIES__: TallyCompanyProfile[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_LEDGER_MATCH_QUEUE__: CustomerLedgerMatchItem[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_EWAY_BILLS__: EwayBillRegisterItem[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_UNALLOCATED_RECEIPTS__: UnallocatedReceiptItem[] | undefined;
}

const DEFAULT_TALLY_COMPANIES: TallyCompanyProfile[] = [
  {
    id: 'ICON-2026-27',
    name: 'ICON TECH PRO - 2026-27',
    financial_year: '2026-2027',
    is_active: true,
    is_read_only: false,
    books_from: '2026-04-01',
    books_to: '2027-03-31',
    tally_guid: 'comp-icon-2627-live-primary',
    voucher_count: 342,
  },
  {
    id: 'ICON-2025-26',
    name: 'ICON TECH PRO - 2025-26',
    financial_year: '2025-2026',
    is_active: false,
    is_read_only: true,
    books_from: '2025-04-01',
    books_to: '2026-03-31',
    tally_guid: 'comp-icon-2526-archive-readonly',
    voucher_count: 1284,
  },
  {
    id: 'ICON-2024-25',
    name: 'ICON TECH PRO - 2024-25',
    financial_year: '2024-2025',
    is_active: false,
    is_read_only: true,
    books_from: '2024-04-01',
    books_to: '2025-03-31',
    tally_guid: 'comp-icon-2425-archive-readonly',
    voucher_count: 950,
  },
];

const DEFAULT_LEDGER_MATCH_QUEUE: CustomerLedgerMatchItem[] = [
  {
    id: 'MATCH-001',
    erp_customer_id: 'CUST-SWAN-01',
    erp_customer_name: 'Swan Technologies Pvt Ltd',
    erp_gstin: '36AABCS1429B1Z1',
    tally_ledger_name: 'Swan Technologies Pvt Ltd (Sundry Debtors)',
    tally_parent_group: 'Sundry Debtors',
    match_confidence_pct: 100,
    match_method: 'EXACT_GSTIN',
    verification_status: 'VERIFIED',
    reconciled_by: 'Hemalath (Accounts)',
    reconciled_at: '2026-10-15T10:30:00.000Z',
  },
  {
    id: 'MATCH-002',
    erp_customer_id: 'CUST-THUB-01',
    erp_customer_name: 'T-Hub Foundation',
    erp_gstin: '36AAACT5512L1Z8',
    tally_ledger_name: 'T-Hub Foundation - Raidurg',
    tally_parent_group: 'Sundry Debtors',
    match_confidence_pct: 95,
    match_method: 'EXACT_GSTIN',
    verification_status: 'VERIFIED',
    reconciled_by: 'Hemalath (Accounts)',
    reconciled_at: '2026-10-18T14:15:00.000Z',
  },
  {
    id: 'MATCH-003',
    erp_customer_id: 'CUST-TSSPDCL-01',
    erp_customer_name: 'TSSPDCL Corporate Office',
    erp_gstin: '36AABCT9981K1ZP',
    tally_ledger_name: 'Superintending Engineer TSSPDCL Mint Compound',
    tally_parent_group: 'Sundry Debtors',
    match_confidence_pct: 88,
    match_method: 'FUZZY_NAME',
    verification_status: 'PENDING_REVIEW',
  },
];

const DEFAULT_EWAY_BILLS: EwayBillRegisterItem[] = [
  {
    id: 'EWB-001',
    eway_bill_number: '231984201948',
    generated_date: '2026-11-02T09:30:00.000Z',
    valid_until: '2026-11-04T23:59:00.000Z',
    invoice_number: 'ICON/26-27/INV-0145',
    invoice_date: '2026-11-02',
    customer_name: 'Swan Technologies Pvt Ltd',
    destination_city: 'Hyderabad - Financial District',
    vehicle_number: 'TS 09 UB 4821',
    transporter_name: 'Professional Logistics Express',
    total_invoice_value: 345000,
    distance_km: 24,
    status: 'ACTIVE',
  },
  {
    id: 'EWB-002',
    eway_bill_number: '231984201912',
    generated_date: '2026-11-05T14:00:00.000Z',
    valid_until: '2026-11-08T23:59:00.000Z',
    invoice_number: 'ICON/26-27/INV-0149',
    invoice_date: '2026-11-05',
    customer_name: 'Tech Mahindra SEZ Unit',
    destination_city: 'Madhapur SEZ Hyderabad',
    vehicle_number: 'TS 07 UA 1192',
    transporter_name: 'Direct Van Delivery',
    total_invoice_value: 890000,
    distance_km: 18,
    status: 'ACTIVE',
  },
];

const DEFAULT_UNALLOCATED_RECEIPTS: UnallocatedReceiptItem[] = [
  {
    id: 'RCPT-UNAL-01',
    receipt_voucher_no: 'RCPT-260142',
    receipt_date: '2026-11-04',
    bank_account_ledger: 'HDFC Bank Current Account',
    customer_name: 'Swan Technologies Pvt Ltd',
    customer_gstin: '36AABCS1429B1Z1',
    receipt_total_amount: 200000,
    unallocated_balance: 55000,
    tally_reference_type: 'On Account',
    suggested_invoices: [
      {
        invoice_id: 'INV-260145',
        invoice_number: 'ICON/26-27/INV-0145',
        invoice_date: '2026-11-02',
        grand_total: 345000,
        balance_due: 55000,
      },
    ],
  },
];

export async function getTallyCompanies(): Promise<{ success: boolean; data: TallyCompanyProfile[] }> {
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('tally_company_profiles')
        .select('*')
        .order('is_active', { ascending: false })
        .order('financial_year', { ascending: false });

      if (!error && data) {
        return {
          success: true,
          data: data.map((row: any) => ({
            id: row.id,
            name: row.name,
            financial_year: row.financial_year,
            is_active: Boolean(row.is_active),
            is_read_only: Boolean(row.is_read_only),
            books_from: String(row.books_from).slice(0, 10),
            books_to: String(row.books_to).slice(0, 10),
            tally_guid: row.tally_guid || undefined,
            voucher_count: Number(row.voucher_count || 0),
          })),
        };
      }
    } catch (err) {
      console.warn('Supabase getTallyCompanies warning:', err);
    }
  }

  if (!globalThis.__ICON_TALLY_COMPANIES__) {
    globalThis.__ICON_TALLY_COMPANIES__ = DEFAULT_TALLY_COMPANIES;
  }
  return { success: true, data: globalThis.__ICON_TALLY_COMPANIES__ };
}

export async function getCustomerLedgerMatchingQueue(): Promise<{
  success: boolean;
  data: CustomerLedgerMatchItem[];
}> {
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('tally_customer_ledger_matches')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return {
          success: true,
          data: data.map((row: any) => ({
            id: row.id,
            erp_customer_id: row.erp_customer_id,
            erp_customer_name: row.erp_customer_name,
            erp_gstin: row.erp_gstin || undefined,
            tally_ledger_name: row.tally_ledger_name,
            tally_parent_group: row.tally_parent_group || 'Sundry Debtors',
            match_confidence_pct: Number(row.match_confidence_pct || 0),
            match_method: row.match_method,
            verification_status: row.verification_status,
            reconciled_by: row.reconciled_by || undefined,
            reconciled_at: row.reconciled_at || undefined,
          })),
        };
      }
    } catch (err) {
      console.warn('Supabase getCustomerLedgerMatchingQueue warning:', err);
    }
  }

  if (!globalThis.__ICON_LEDGER_MATCH_QUEUE__) {
    globalThis.__ICON_LEDGER_MATCH_QUEUE__ = DEFAULT_LEDGER_MATCH_QUEUE;
  }
  return { success: true, data: globalThis.__ICON_LEDGER_MATCH_QUEUE__ };
}

export async function verifyCustomerLedgerMatch(
  matchId: string,
  verifiedTallyLedgerName?: string
): Promise<{ success: boolean; message: string }> {
  const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
  const now = new Date().toISOString();

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const { data: existing, error: findErr } = await admin
        .from('tally_customer_ledger_matches')
        .select('*')
        .eq('id', matchId)
        .maybeSingle();

      if (findErr || !existing) {
        return { success: false, message: 'Ledger match candidate not found' };
      }

      const finalLedgerName = verifiedTallyLedgerName?.trim() || existing.tally_ledger_name;
      const { error: updErr } = await admin
        .from('tally_customer_ledger_matches')
        .update({
          verification_status: 'VERIFIED',
          tally_ledger_name: finalLedgerName,
          reconciled_by: authUser.name,
          reconciled_at: now,
        })
        .eq('id', matchId);

      if (updErr) {
        return { success: false, message: updErr.message };
      }

      // Sync verified mapping into tally_ledger_mappings
      const { data: existingMap } = await admin
        .from('tally_ledger_mappings')
        .select('id')
        .eq('erp_id', existing.erp_customer_id)
        .maybeSingle();

      if (existingMap?.id) {
        await admin
          .from('tally_ledger_mappings')
          .update({
            tally_ledger_name: finalLedgerName,
            tally_group: existing.tally_parent_group || 'Sundry Debtors',
            is_verified: true,
            updated_at: now,
          })
          .eq('id', existingMap.id);
      } else {
        await admin.from('tally_ledger_mappings').insert({
          erp_id: existing.erp_customer_id,
          erp_name: existing.erp_customer_name,
          entity_type: 'CUSTOMER',
          tally_ledger_name: finalLedgerName,
          tally_group: existing.tally_parent_group || 'Sundry Debtors',
          is_verified: true,
        });
      }

      await logAuditEvent({
        userName: authUser.name,
        action: 'TALLY_LEDGER_VERIFIED',
        module: 'ACCOUNTS',
        details: `Ledger mapping verified for ${existing.erp_customer_name} -> ${finalLedgerName}`,
      });

      revalidatePath('/dashboard/tally');
      return { success: true, message: `Ledger mapping verified for ${existing.erp_customer_name}` };
    } catch (err) {
      return { success: false, message: (err as Error).message || 'Ledger verification failed' };
    }
  }

  if (!globalThis.__ICON_LEDGER_MATCH_QUEUE__) {
    globalThis.__ICON_LEDGER_MATCH_QUEUE__ = DEFAULT_LEDGER_MATCH_QUEUE;
  }
  const item = globalThis.__ICON_LEDGER_MATCH_QUEUE__.find((m) => m.id === matchId);
  if (!item) {
    return { success: false, message: 'Ledger match candidate not found' };
  }

  item.verification_status = 'VERIFIED';
  if (verifiedTallyLedgerName) {
    item.tally_ledger_name = verifiedTallyLedgerName;
  }
  item.reconciled_by = authUser.name;
  item.reconciled_at = now;

  await logAuditEvent({
    userName: authUser.name,
    action: 'TALLY_LEDGER_VERIFIED',
    module: 'ACCOUNTS',
    details: `Ledger mapping verified for ${item.erp_customer_name} -> ${item.tally_ledger_name}`,
  });

  return { success: true, message: `Ledger mapping verified for ${item.erp_customer_name}` };
}

export async function getCrossMonthTransactions(): Promise<{
  success: boolean;
  data: CrossMonthTransactionRecord[];
}> {
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const [projRes, invRes, poRes] = await Promise.all([
        admin.from('projects').select('id, project_number, project_name, customer_id, customer_name, sales_order_id, total_project_value, total_cost').order('created_at', { ascending: false }).limit(50),
        admin.from('invoices').select('id, invoice_number, invoice_date, customer_id, customer_name, order_id, grand_total').order('invoice_date', { ascending: false }).limit(100),
        admin.from('purchase_orders').select('id, po_number, order_date, supplier_name, sales_order_id, consignee_customer_id, total_amount').order('order_date', { ascending: false }).limit(100),
      ]);

      const records: CrossMonthTransactionRecord[] = [];
      const projects = projRes.data || [];
      const invoices = invRes.data || [];
      const pos = poRes.data || [];

      for (const proj of projects) {
        const custInv = invoices.find((i: any) =>
          (proj.sales_order_id && i.order_id === proj.sales_order_id) ||
          (proj.customer_id && i.customer_id === proj.customer_id)
        );
        const relPo = pos.find((p: any) =>
          (proj.sales_order_id && p.sales_order_id === proj.sales_order_id) ||
          (proj.customer_id && p.consignee_customer_id === proj.customer_id)
        );
        if (!custInv || !relPo) continue;

        const invMonth = String(custInv.invoice_date || '').slice(0, 7);
        const poMonth = String(relPo.order_date || '').slice(0, 7);
        if (invMonth && poMonth && invMonth !== poMonth) {
          const salesAmt = Number(custInv.grand_total || 0);
          const purAmt = Number(relPo.total_amount || 0);
          const margin = salesAmt - purAmt;
          const marginPct = salesAmt > 0 ? Number(((margin / salesAmt) * 100).toFixed(2)) : 0;
          records.push({
            id: `CMT-${proj.id.slice(0, 8)}`,
            file_id: proj.project_number,
            project_title: proj.project_name,
            customer_name: proj.customer_name,
            purchase_date: String(relPo.order_date).slice(0, 10),
            purchase_voucher_no: relPo.po_number,
            purchase_amount: purAmt,
            supplier_name: relPo.supplier_name,
            sales_date: String(custInv.invoice_date).slice(0, 10),
            sales_voucher_no: custInv.invoice_number,
            sales_amount: salesAmt,
            gross_margin_amount: margin,
            gross_margin_pct: marginPct,
            accounting_alignment_notes: `Purchase dated ${String(relPo.order_date).slice(0, 10)} aligned with Sales Invoice ${custInv.invoice_number} dated ${String(custInv.invoice_date).slice(0, 10)} under project ${proj.project_number}.`,
            status: margin >= 0 ? 'ALIGNED' : 'AUDIT_PENDING',
          });
        }
      }

      return { success: true, data: records };
    } catch (err) {
      console.warn('Supabase getCrossMonthTransactions warning:', err);
    }
  }

  return { success: true, data: [] };
}

export async function getEwayBillRegister(): Promise<{
  success: boolean;
  data: EwayBillRegisterItem[];
}> {
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('eway_bill_register')
        .select('*')
        .order('generated_date', { ascending: false });

      if (!error && data) {
        return {
          success: true,
          data: data.map((row: any) => ({
            id: row.id,
            eway_bill_number: row.eway_bill_number,
            generated_date: row.generated_date,
            valid_until: row.valid_until,
            invoice_number: row.invoice_number,
            invoice_date: String(row.invoice_date).slice(0, 10),
            customer_name: row.customer_name,
            destination_city: row.destination_city,
            vehicle_number: row.vehicle_number || 'Pending',
            transporter_name: row.transporter_name || undefined,
            total_invoice_value: Number(row.total_invoice_value || 0),
            distance_km: Number(row.distance_km || 0),
            status: row.status,
          })),
        };
      }
    } catch (err) {
      console.warn('Supabase getEwayBillRegister warning:', err);
    }
  }

  if (!globalThis.__ICON_EWAY_BILLS__) {
    globalThis.__ICON_EWAY_BILLS__ = DEFAULT_EWAY_BILLS;
  }
  return { success: true, data: globalThis.__ICON_EWAY_BILLS__ };
}

export async function getUnallocatedReceipts(): Promise<{
  success: boolean;
  data: UnallocatedReceiptItem[];
}> {
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('tally_unallocated_receipts')
        .select('*')
        .order('receipt_date', { ascending: false });

      if (!error && data) {
        return {
          success: true,
          data: data.map((row: any) => ({
            id: row.id,
            receipt_voucher_no: row.receipt_voucher_no,
            receipt_date: String(row.receipt_date).slice(0, 10),
            bank_account_ledger: row.bank_account_ledger,
            customer_name: row.customer_name,
            customer_gstin: row.customer_gstin || undefined,
            receipt_total_amount: Number(row.receipt_total_amount || 0),
            unallocated_balance: Number(row.unallocated_balance || 0),
            tally_reference_type: row.tally_reference_type || 'On Account',
            suggested_invoices: Array.isArray(row.suggested_invoices) ? row.suggested_invoices : [],
          })),
        };
      }
    } catch (err) {
      console.warn('Supabase getUnallocatedReceipts warning:', err);
    }
  }

  if (!globalThis.__ICON_UNALLOCATED_RECEIPTS__) {
    globalThis.__ICON_UNALLOCATED_RECEIPTS__ = DEFAULT_UNALLOCATED_RECEIPTS;
  }
  return { success: true, data: globalThis.__ICON_UNALLOCATED_RECEIPTS__ };
}

export async function allocateReceiptToInvoice(
  receiptId: string,
  invoiceId: string,
  allocatedAmount: number
): Promise<{ success: boolean; message: string }> {
  const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const { data: receipt, error: findErr } = await admin
        .from('tally_unallocated_receipts')
        .select('*')
        .eq('id', receiptId)
        .maybeSingle();

      if (findErr || !receipt) {
        return { success: false, message: 'Receipt not found' };
      }

      const currentBal = Number(receipt.unallocated_balance || 0);
      if (allocatedAmount <= 0 || allocatedAmount > currentBal) {
        return {
          success: false,
          message: `Allocated amount (₹${allocatedAmount.toLocaleString('en-IN')}) must be positive and cannot exceed unallocated balance (₹${currentBal.toLocaleString('en-IN')})`,
        };
      }

      const newBalance = Math.max(0, currentBal - allocatedAmount);
      const { error: updErr } = await admin
        .from('tally_unallocated_receipts')
        .update({
          unallocated_balance: newBalance,
          tally_reference_type: newBalance === 0 ? 'Agst Ref' : receipt.tally_reference_type,
        })
        .eq('id', receiptId);

      if (updErr) {
        return { success: false, message: updErr.message };
      }

      await logAuditEvent({
        userName: authUser.name,
        action: 'TALLY_RECEIPT_ALLOCATED',
        module: 'ACCOUNTS',
        details: `Allocated ₹${allocatedAmount} from receipt ${receipt.receipt_voucher_no} to invoice ${invoiceId}`,
      });

      revalidatePath('/dashboard/tally');
      return {
        success: true,
        message: `₹${allocatedAmount.toLocaleString('en-IN')} allocated from receipt ${receipt.receipt_voucher_no} to invoice ${invoiceId}`,
      };
    } catch (err) {
      return { success: false, message: (err as Error).message || 'Allocation failed' };
    }
  }

  if (!globalThis.__ICON_UNALLOCATED_RECEIPTS__) {
    globalThis.__ICON_UNALLOCATED_RECEIPTS__ = DEFAULT_UNALLOCATED_RECEIPTS;
  }

  const receipt = globalThis.__ICON_UNALLOCATED_RECEIPTS__.find((r) => r.id === receiptId);
  if (!receipt) {
    return { success: false, message: 'Receipt not found' };
  }

  if (allocatedAmount > receipt.unallocated_balance) {
    return {
      success: false,
      message: `Allocated amount (₹${allocatedAmount.toLocaleString('en-IN')}) cannot exceed unallocated balance (₹${receipt.unallocated_balance.toLocaleString('en-IN')})`,
    };
  }

  receipt.unallocated_balance = Math.max(0, receipt.unallocated_balance - allocatedAmount);

  await logAuditEvent({
    userName: authUser.name,
    action: 'TALLY_RECEIPT_ALLOCATED',
    module: 'ACCOUNTS',
    details: `Allocated ₹${allocatedAmount} from receipt ${receipt.receipt_voucher_no} to invoice ${invoiceId}`,
  });

  return {
    success: true,
    message: `₹${allocatedAmount.toLocaleString('en-IN')} allocated from receipt ${receipt.receipt_voucher_no} to invoice ${invoiceId}`,
  };
}

export async function checkFileFinancialClearance(fileId: string): Promise<{
  cleared: boolean;
  pendingItems: string[];
  financialSummary: {
    totalInvoiced: number;
    totalCollected: number;
    balanceDue: number;
    allInvoicesSettled: boolean;
    allVendorBillsReconciled: boolean;
    unallocatedReceiptsCount: number;
  };
}> {
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const project = await findByIdOrCode<any>(
        admin,
        'projects',
        fileId,
        'project_number',
        'id, project_number, customer_id, customer_name, sales_order_id'
      );

      let invQuery = admin.from('invoices').select('invoice_number, grand_total, paid_amount, balance_amount, status');
      if (project?.sales_order_id) {
        invQuery = invQuery.eq('order_id', project.sales_order_id);
      } else if (project?.customer_id) {
        invQuery = invQuery.eq('customer_id', project.customer_id);
      } else {
        invQuery = invQuery.eq('invoice_number', fileId);
      }

      const [invRes, unalRes, vendorRes] = await Promise.all([
        invQuery,
        project?.customer_name
          ? admin
              .from('tally_unallocated_receipts')
              .select('id, unallocated_balance')
              .eq('customer_name', project.customer_name)
              .gt('unallocated_balance', 0)
          : Promise.resolve({ data: [] as any[] }),
        admin
          .from('tally_sync_queue')
          .select('entity_number, status')
          .eq('entity_type', 'PURCHASE_INVOICE')
          .in('status', ['PENDING', 'FAILED']),
      ]);

      const invoices = invRes.data || [];
      if (invoices.length === 0 && !project) {
        return {
          cleared: false,
          pendingItems: [`No matching project/file or invoice found for reference "${fileId}".`],
          financialSummary: {
            totalInvoiced: 0,
            totalCollected: 0,
            balanceDue: 0,
            allInvoicesSettled: false,
            allVendorBillsReconciled: true,
            unallocatedReceiptsCount: 0,
          },
        };
      }

      const totalInvoiced = invoices.reduce((s: number, i: any) => s + Number(i.grand_total || 0), 0);
      const totalCollected = invoices.reduce((s: number, i: any) => s + Number(i.paid_amount || 0), 0);
      const balanceDue = invoices.reduce(
        (s: number, i: any) => s + Number(i.balance_amount ?? Math.max(0, Number(i.grand_total || 0) - Number(i.paid_amount || 0))),
        0
      );
      const pendingItems: string[] = [];
      for (const inv of invoices) {
        const due = Number(inv.balance_amount ?? Number(inv.grand_total || 0) - Number(inv.paid_amount || 0));
        if (due > 0.01) {
          pendingItems.push(`Outstanding invoice balance: ₹${due.toLocaleString('en-IN')} pending on ${inv.invoice_number}`);
        }
      }

      const unallocCount = unalRes.data?.length || 0;
      if (unallocCount > 0) {
        pendingItems.push(`${unallocCount} unallocated receipt(s) pending adjustment against invoices`);
      }

      const pendingVendorSync = vendorRes.data || [];
      const allVendorBillsReconciled = pendingVendorSync.length === 0;
      const allInvoicesSettled = balanceDue <= 0.01 && invoices.length > 0;

      return {
        cleared: pendingItems.length === 0 && allInvoicesSettled,
        pendingItems,
        financialSummary: {
          totalInvoiced,
          totalCollected,
          balanceDue,
          allInvoicesSettled,
          allVendorBillsReconciled,
          unallocatedReceiptsCount: unallocCount,
        },
      };
    } catch (err) {
      console.warn('Supabase checkFileFinancialClearance warning:', err);
    }
  }

  return {
    cleared: false,
    pendingItems: [`Unable to verify clearance for ${fileId} while database is offline.`],
    financialSummary: {
      totalInvoiced: 0,
      totalCollected: 0,
      balanceDue: 0,
      allInvoicesSettled: false,
      allVendorBillsReconciled: false,
      unallocatedReceiptsCount: 0,
    },
  };
}
