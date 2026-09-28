'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { getNextSupplierInvoiceRef } from '@/lib/utils/sequence';
import { getPurchaseOrdersStore } from '@/lib/actions/procurement';
import { queueTallySync } from '@/lib/actions/tally';
import type {
  SupplierInvoice,
  SupplierInvoiceItem,
  ThreeWayMatchResult,
  MatchStatus,
  PurchaseOrder,
  PurchaseOrderItem,
} from '@/types/erp';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_SUPPLIER_INVOICES__: SupplierInvoice[] | undefined;
}

const INITIAL_SUPPLIER_INVOICES: SupplierInvoice[] = [
  {
    id: 'SINV-001',
    invoice_number: 'SP-INV-9921',
    invoice_date: '2026-09-03',
    supplier_id: 'SUP002',
    supplier_name: 'Shree Prime Distributors',
    po_id: 'PO260001',
    po_number: 'ICON/26-27/PO-0001',
    grn_number: 'GRN-260001',
    items: [
      {
        id: 'si-item-1',
        product_name: '32GB Server RAM DDR4-3200MHz ECC Registered',
        sku: 'RAM-32G-ECC',
        hsn_sac: '847330',
        quantity: 4,
        purchase_price: 11200,
        discount: 0,
        taxable_amount: 44800,
        gst_rate: 18,
        cgst: 4032,
        sgst: 4032,
        igst: 0,
        total_cost: 52864,
      },
    ],
    subtotal: 44800,
    cgst: 4032,
    sgst: 4032,
    igst: 0,
    freight_other_charges: 0,
    total_amount: 52864,
    due_date: '2026-09-24',
    payment_terms: '21 Days Net',
    tally_voucher_ref: 'TALLY-PUR-901',
    tally_sync_status: 'SYNCED',
    payment_status: 'PAID',
    outstanding_amount: 0,
    match_status: 'MATCHED',
    match_notes: '3-Way Match Verified against PO-0001 and GRN-260001',
    created_at: '2026-09-03T14:00:00Z',
  },
  {
    id: 'SINV-002',
    invoice_number: 'ED-INV-4412',
    invoice_date: '2026-09-06',
    supplier_id: 'SUP003',
    supplier_name: 'EduTech Displays India',
    po_id: 'PO260002',
    po_number: 'ICON/26-27/PO-0002',
    items: [
      {
        id: 'si-item-2',
        product_name: '75" Interactive Flat Panel 4K with Android 13 & Stylus',
        sku: 'IFP-75-4K',
        hsn_sac: '852852',
        quantity: 3,
        purchase_price: 145000, // Discrepancy: PO was 142000!
        discount: 0,
        taxable_amount: 435000,
        gst_rate: 18,
        cgst: 0,
        sgst: 0,
        igst: 78300,
        total_cost: 513300,
      },
    ],
    subtotal: 435000,
    cgst: 0,
    sgst: 0,
    igst: 78300,
    freight_other_charges: 0,
    total_amount: 513300,
    due_date: '2026-10-21',
    payment_terms: '45 Days Net',
    tally_sync_status: 'PENDING',
    payment_status: 'UNPAID',
    outstanding_amount: 513300,
    match_status: 'PRICE_MISMATCH',
    match_notes: 'Unit price ₹1,45,000 exceeds approved PO cost ₹1,42,000 by ₹3,000/unit.',
    created_at: '2026-09-06T16:00:00Z',
  },
];

function getInternalInvoicesStore(): SupplierInvoice[] {
  if (!globalThis.__ICON_SUPPLIER_INVOICES__) {
    globalThis.__ICON_SUPPLIER_INVOICES__ = [...INITIAL_SUPPLIER_INVOICES];
  }
  return globalThis.__ICON_SUPPLIER_INVOICES__;
}

export async function getSupplierInvoices(filters?: {
  supplier_id?: string;
  match_status?: MatchStatus;
  payment_status?: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
}): Promise<{ invoices: SupplierInvoice[]; total: number }> {
  const store = getInternalInvoicesStore();

  let filtered = [...store];
  if (filters?.supplier_id) {
    filtered = filtered.filter((i) => i.supplier_id === filters.supplier_id);
  }
  if (filters?.match_status) {
    filtered = filtered.filter((i) => i.match_status === filters.match_status);
  }
  if (filters?.payment_status) {
    filtered = filtered.filter((i) => i.payment_status === filters.payment_status);
  }

  return { invoices: filtered, total: filtered.length };
}

/**
 * Perform Automated 3-Way Match (Invoice vs PO vs GRN).
 * Detects quantity, unit price, and receipt discrepancies.
 */
export async function performThreeWayMatch(
  invoiceData: {
    invoice_number: string;
    po_number: string;
    items: Array<{ product_name: string; quantity: number; purchase_price: number }>;
  }
): Promise<ThreeWayMatchResult> {
  const poStore = await getPurchaseOrdersStore();
  const po = poStore.find((p: PurchaseOrder) => p.po_number.toLowerCase() === invoiceData.po_number.trim().toLowerCase());

  if (!po) {
    return {
      invoice_number: invoiceData.invoice_number,
      po_number: invoiceData.po_number,
      match_status: 'PO_NOT_FOUND',
      is_perfect_match: false,
      discrepancies: [
        {
          item_name: 'ALL',
          issue: 'ITEM_NOT_IN_PO',
          po_value: 0,
          invoice_value: 0,
          difference: 0,
          description: `Purchase Order "${invoiceData.po_number}" not found in ERP records.`,
        },
      ],
    };
  }

  const discrepancies: ThreeWayMatchResult['discrepancies'] = [];

  for (const invItem of invoiceData.items) {
    const poItem = po.items.find(
      (pi: PurchaseOrderItem) => pi.product_name.toLowerCase() === invItem.product_name.toLowerCase()
    );

    if (!poItem) {
      discrepancies.push({
        item_name: invItem.product_name,
        issue: 'ITEM_NOT_IN_PO',
        po_value: 0,
        invoice_value: invItem.quantity,
        difference: invItem.quantity,
        description: `Item "${invItem.product_name}" is not listed on PO ${po.po_number}.`,
      });
      continue;
    }

    // 1. Price Mismatch Check
    if (invItem.purchase_price > poItem.unit_cost) {
      const diff = invItem.purchase_price - poItem.unit_cost;
      discrepancies.push({
        item_name: invItem.product_name,
        issue: 'PRICE_MISMATCH',
        po_value: poItem.unit_cost,
        invoice_value: invItem.purchase_price,
        difference: diff,
        description: `Invoice price ₹${invItem.purchase_price} exceeds PO cost ₹${poItem.unit_cost} by ₹${diff}/unit.`,
      });
    }

    // 2. Quantity Mismatch Check
    if (invItem.quantity > poItem.quantity) {
      const diff = invItem.quantity - poItem.quantity;
      discrepancies.push({
        item_name: invItem.product_name,
        issue: 'QTY_MISMATCH',
        po_value: poItem.quantity,
        invoice_value: invItem.quantity,
        difference: diff,
        description: `Invoiced quantity (${invItem.quantity}) exceeds ordered PO quantity (${poItem.quantity}) by ${diff} units.`,
      });
    }

    // 3. GRN Received Quantity Check (if office receipt)
    if (po.delivery_type === 'OFFICE_RECEIPT') {
      const received = poItem.received_quantity || 0;
      if (invItem.quantity > received) {
        discrepancies.push({
          item_name: invItem.product_name,
          issue: 'UNRECEIVED_GRN',
          po_value: received,
          invoice_value: invItem.quantity,
          difference: invItem.quantity - received,
          description: `Invoiced for ${invItem.quantity} units, but only ${received} units received in GRN.`,
        });
      }
    }
  }

  let match_status: MatchStatus = 'MATCHED';
  if (discrepancies.some((d) => d.issue === 'PRICE_MISMATCH')) {
    match_status = 'PRICE_MISMATCH';
  } else if (discrepancies.some((d) => d.issue === 'QTY_MISMATCH')) {
    match_status = 'QUANTITY_MISMATCH';
  } else if (discrepancies.some((d) => d.issue === 'UNRECEIVED_GRN')) {
    match_status = 'GRN_PENDING';
  }

  return {
    invoice_number: invoiceData.invoice_number,
    po_number: invoiceData.po_number,
    match_status,
    is_perfect_match: discrepancies.length === 0,
    discrepancies,
  };
}

/**
 * Record a Supplier Invoice and trigger automated 3-Way Match.
 */
export async function recordSupplierInvoice(payload: {
  invoice_number: string;
  invoice_date: string;
  supplier_id: string;
  supplier_name: string;
  po_number: string;
  items: SupplierInvoiceItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  freight_other_charges?: number;
  total_amount: number;
  due_date: string;
  payment_terms: string;
  document_url?: string;
}): Promise<{ success: boolean; data?: SupplierInvoice; matchResult?: ThreeWayMatchResult; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
    const store = getInternalInvoicesStore();

    // Perform automated 3-way match
    const match = await performThreeWayMatch({
      invoice_number: payload.invoice_number,
      po_number: payload.po_number,
      items: payload.items.map((i) => ({
        product_name: i.product_name,
        quantity: i.quantity,
        purchase_price: i.purchase_price,
      })),
    });

    const newInvoice: SupplierInvoice = {
      id: `SINV-${Date.now()}`,
      invoice_number: payload.invoice_number,
      invoice_date: payload.invoice_date,
      supplier_id: payload.supplier_id,
      supplier_name: payload.supplier_name,
      po_number: payload.po_number,
      items: payload.items,
      subtotal: payload.subtotal,
      cgst: payload.cgst,
      sgst: payload.sgst,
      igst: payload.igst,
      freight_other_charges: payload.freight_other_charges || 0,
      total_amount: payload.total_amount,
      due_date: payload.due_date,
      payment_terms: payload.payment_terms,
      document_url: payload.document_url,
      tally_sync_status: match.is_perfect_match ? 'PENDING' : 'FAILED',
      payment_status: 'UNPAID',
      outstanding_amount: payload.total_amount,
      match_status: match.match_status,
      match_notes: match.is_perfect_match
        ? '3-Way Match Succeeded with zero discrepancies'
        : match.discrepancies.map((d) => d.description).join('; '),
      created_at: new Date().toISOString(),
    };

    store.unshift(newInvoice);

    // If perfectly matched, queue to Tally sync queue automatically
    if (match.is_perfect_match) {
      await queueTallySync({
        entity_type: 'PURCHASE_INVOICE',
        entity_id: newInvoice.id,
        entity_number: newInvoice.invoice_number,
        tally_voucher_type: 'Purchase',
        payload_summary: `Purchase Invoice ${newInvoice.invoice_number} from ${newInvoice.supplier_name} - ₹${newInvoice.total_amount}`,
      });
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'RECORD_SUPPLIER_INVOICE',
      module: 'PROCUREMENT',
      details: `Recorded supplier invoice ${newInvoice.invoice_number} from ${newInvoice.supplier_name} (Match: ${newInvoice.match_status})`,
    });

    revalidatePath('/dashboard/purchases');
    revalidatePath('/dashboard/tally');
    revalidatePath('/dashboard');

    return { success: true, data: newInvoice, matchResult: match };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to record supplier invoice' };
  }
}
