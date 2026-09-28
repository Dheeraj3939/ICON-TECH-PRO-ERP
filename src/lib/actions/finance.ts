'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { requireRole, getAuthenticatedUser } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { getNextPaymentNumber } from '@/lib/utils/sequence';
import { getInvoices, getPayments } from '@/lib/actions/billing';
import { getCustomers } from '@/lib/actions/customers';
import { getSupplierInvoices } from '@/lib/actions/supplier-invoices';
import type {
  Invoice,
  Payment,
  PaymentMode,
  PaymentAllocation,
  CreditNote,
  DebitNote,
  AgeingBuckets,
  CustomerReceivableSummary,
  SupplierPayableSummary,
  SupplierInvoice,
} from '@/types/erp';

// Shared In-Memory Stores
declare global {
  // eslint-disable-next-line no-var
  var __ICON_PAYMENT_ALLOCATIONS__: PaymentAllocation[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_CREDIT_NOTES__: CreditNote[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_DEBIT_NOTES__: DebitNote[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_PROMISES_TO_PAY__: Array<{
    id: string;
    customer_id: string;
    invoice_id?: string;
    promised_amount: number;
    promised_date: string;
    status: 'PENDING' | 'HONOURED' | 'BROKEN';
    notes?: string;
    recorded_by: string;
    created_at: string;
  }> | undefined;
}

function getAllocationsStore(): PaymentAllocation[] {
  if (!globalThis.__ICON_PAYMENT_ALLOCATIONS__) {
    globalThis.__ICON_PAYMENT_ALLOCATIONS__ = [
      {
        id: 'ALC-001',
        payment_id: 'PAY-1001',
        payment_number: 'ICON/26-27/PAY-0001',
        invoice_id: 'INV-260001',
        invoice_number: 'ICON/26-27/INV-0001',
        allocated_amount: 145000,
        created_at: '2026-04-06T10:00:00.000Z',
      },
    ];
  }
  return globalThis.__ICON_PAYMENT_ALLOCATIONS__;
}

function getCreditNotesStore(): CreditNote[] {
  if (!globalThis.__ICON_CREDIT_NOTES__) {
    globalThis.__ICON_CREDIT_NOTES__ = [
      {
        id: 'CN-001',
        credit_note_number: 'ITP/CN/26-27/0001',
        invoice_id: 'INV-260002',
        invoice_number: 'ICON/26-27/INV-0002',
        customer_id: 'CUST0001',
        customer_name: 'T-Hub Foundation',
        total_amount: 5000,
        cgst_amount: 450,
        sgst_amount: 450,
        igst_amount: 0,
        reason: 'Commercial price adjustment on accessory mount',
        status: 'ISSUED',
        created_by_name: 'Accounts Officer',
        created_at: '2026-04-08T11:00:00.000Z',
      },
    ];
  }
  return globalThis.__ICON_CREDIT_NOTES__;
}

function getDebitNotesStore(): DebitNote[] {
  if (!globalThis.__ICON_DEBIT_NOTES__) {
    globalThis.__ICON_DEBIT_NOTES__ = [];
  }
  return globalThis.__ICON_DEBIT_NOTES__;
}

function getPromisesToPayStore(): Array<{
  id: string;
  customer_id: string;
  invoice_id?: string;
  promised_amount: number;
  promised_date: string;
  status: 'PENDING' | 'HONOURED' | 'BROKEN';
  notes?: string;
  recorded_by: string;
  created_at: string;
}> {
  if (!globalThis.__ICON_PROMISES_TO_PAY__) {
    globalThis.__ICON_PROMISES_TO_PAY__ = [
      {
        id: 'PTP-001',
        customer_id: 'CUST0001',
        invoice_id: 'INV-260002',
        promised_amount: 148000,
        promised_date: '2026-04-18',
        status: 'PENDING',
        notes: 'Director agreed to release RTGS payment post audit clearance',
        recorded_by: 'Vamshi Krishna',
        created_at: '2026-04-09T14:30:00.000Z',
      },
    ];
  }
  return globalThis.__ICON_PROMISES_TO_PAY__;
}

/**
 * Calculates Ageing Buckets (0-30, 31-60, 61-90, 90+) based on invoice due dates.
 */
export async function calculateAgeingBuckets(
  items: Array<{ balance_amount: number; due_date?: string }>,
  asOfDate: Date = new Date()
): Promise<AgeingBuckets> {
  const buckets: AgeingBuckets = {
    current_0_30: 0,
    overdue_31_60: 0,
    overdue_61_90: 0,
    overdue_90_plus: 0,
    total_outstanding: 0,
  };

  const asOfTime = asOfDate.getTime();

  for (const item of items) {
    const bal = item.balance_amount || 0;
    if (bal <= 0) continue;

    buckets.total_outstanding = Number((buckets.total_outstanding + bal).toFixed(2));

    if (!item.due_date) {
      buckets.current_0_30 = Number((buckets.current_0_30 + bal).toFixed(2));
      continue;
    }

    const dueTime = new Date(item.due_date).getTime();
    const daysOverdue = Math.floor((asOfTime - dueTime) / (1000 * 60 * 60 * 24));

    if (daysOverdue <= 30) {
      buckets.current_0_30 = Number((buckets.current_0_30 + bal).toFixed(2));
    } else if (daysOverdue <= 60) {
      buckets.overdue_31_60 = Number((buckets.overdue_31_60 + bal).toFixed(2));
    } else if (daysOverdue <= 90) {
      buckets.overdue_61_90 = Number((buckets.overdue_61_90 + bal).toFixed(2));
    } else {
      buckets.overdue_90_plus = Number((buckets.overdue_90_plus + bal).toFixed(2));
    }
  }

  return buckets;
}

/**
 * Comprehensive Customer Receivables Ledger & Aging.
 */
export async function getCustomerReceivablesLedger(
  customerId?: string
): Promise<{ success: boolean; data?: CustomerReceivableSummary[]; error?: string }> {
  try {
    const { customers } = await getCustomers();
    const { invoices } = await getInvoices();
    const ptpStore = getPromisesToPayStore();
    const paymentsRes = await getPayments();
    const allPayments = paymentsRes.payments || [];
    const allocStore = getAllocationsStore();

    const targetCustomers = customerId
      ? customers.filter((c) => c.id === customerId || c.customer_code === customerId)
      : customers;

    const summaries: CustomerReceivableSummary[] = [];

    for (const cust of targetCustomers) {
      const custInvoices = invoices.filter(
        (inv) =>
          inv.customer_id === cust.id ||
          inv.customer_name.toLowerCase() === cust.customer_name.toLowerCase() ||
          (cust.company_name && inv.company_name?.toLowerCase() === cust.company_name.toLowerCase())
      );

      let totalInvoiced = 0;
      let totalCollected = 0;
      let balanceDue = 0;

      for (const inv of custInvoices) {
        totalInvoiced += inv.grand_total || 0;
        totalCollected += inv.paid_amount || 0;
        balanceDue += inv.balance_amount || 0;
      }

      // Compute unallocated advances for this customer
      const custPayments = allPayments.filter(
        (p) =>
          p.customer_name.toLowerCase() === cust.customer_name.toLowerCase() ||
          (cust.company_name && p.company_name?.toLowerCase() === cust.company_name.toLowerCase())
      );

      let totalPaidByCustomer = custPayments.reduce((s, p) => s + p.amount, 0);
      let totalAllocated = allocStore
        .filter((a) => custPayments.some((p) => p.id === a.payment_id || p.payment_number === a.payment_number))
        .reduce((s, a) => s + a.allocated_amount, 0);

      const unallocatedAdvance = Math.max(0, Number((totalPaidByCustomer - totalAllocated).toFixed(2)));

      const ageing = await calculateAgeingBuckets(custInvoices);
      const creditLimit = cust.credit_limit || 0;
      const creditUtilizationPct = creditLimit > 0 ? Math.min(100, Math.round((balanceDue / creditLimit) * 100)) : 0;
      const isCreditExceeded = creditLimit > 0 && balanceDue > creditLimit;

      const ptp = ptpStore.find((p) => p.customer_id === cust.id || p.customer_id === cust.customer_code);

      summaries.push({
        customer_id: cust.id,
        customer_code: cust.customer_code,
        customer_name: cust.customer_name,
        company_name: cust.company_name || undefined,
        total_invoiced: Number(totalInvoiced.toFixed(2)),
        total_collected: Number(totalCollected.toFixed(2)),
        balance_due: Number(balanceDue.toFixed(2)),
        unallocated_advance: unallocatedAdvance,
        credit_limit: creditLimit,
        credit_utilization_pct: creditUtilizationPct,
        is_credit_limit_exceeded: isCreditExceeded,
        ageing,
        promise_to_pay: ptp
          ? {
              promised_amount: ptp.promised_amount,
              promised_date: ptp.promised_date,
              status: ptp.status,
              notes: ptp.notes,
            }
          : undefined,
      });
    }

    return { success: true, data: summaries };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to get receivables ledger' };
  }
}

/**
 * Supplier Payables Ledger & Aging.
 */
export async function getSupplierPayablesLedger(): Promise<{
  success: boolean;
  data?: SupplierPayableSummary[];
  error?: string;
}> {
  try {
    const supRes = await getSupplierInvoices();
    const supInvoices = supRes.invoices || [];
    const grouped: Record<string, { name: string; items: SupplierInvoice[] }> = {};

    for (const inv of supInvoices) {
      const supId = inv.supplier_id || inv.supplier_name;
      if (!grouped[supId]) {
        grouped[supId] = { name: inv.supplier_name, items: [] };
      }
      grouped[supId].items.push(inv);
    }

    const summaries: SupplierPayableSummary[] = [];

    for (const [supId, group] of Object.entries(grouped)) {
      let totalBilled = 0;
      let balanceDue = 0;

      for (const it of group.items) {
        totalBilled += it.total_amount || 0;
        balanceDue += it.outstanding_amount ?? it.total_amount ?? 0;
      }

      const ageing = await calculateAgeingBuckets(
        group.items.map((i) => ({
          balance_amount: i.outstanding_amount ?? i.total_amount ?? 0,
          due_date: i.due_date || i.invoice_date,
        }))
      );

      summaries.push({
        supplier_id: supId,
        supplier_name: group.name,
        total_billed: Number(totalBilled.toFixed(2)),
        total_paid: Number((totalBilled - balanceDue).toFixed(2)),
        balance_due: Number(balanceDue.toFixed(2)),
        ageing,
        pending_invoices_count: group.items.length,
      });
    }

    return { success: true, data: summaries };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to get supplier payables ledger' };
  }
}

/**
 * Multi-Invoice Payment Allocation with Overpayment & Balance Guards.
 */
export async function allocatePaymentAcrossInvoices(payload: {
  payment_number: string;
  allocations: Array<{ invoice_id: string; amount: number }>;
  notes?: string;
}): Promise<{ success: boolean; data?: PaymentAllocation[]; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
    const paymentsRes = await getPayments();
    const payment = paymentsRes.payments.find(
      (p) => p.payment_number === payload.payment_number || p.id === payload.payment_number
    );

    if (!payment) {
      return { success: false, error: `Payment receipt ${payload.payment_number} not found.` };
    }

    const invoicesRes = await getInvoices();
    const invoicesStore = invoicesRes.invoices;
    const allocStore = getAllocationsStore();

    // 1. Validate total allocation does not exceed payment receipt amount
    const totalAllocatedSoFar = allocStore
      .filter((a) => a.payment_id === payment.id || a.payment_number === payment.payment_number)
      .reduce((s, a) => s + a.allocated_amount, 0);

    const availableToAllocate = Number((payment.amount - totalAllocatedSoFar).toFixed(2));
    const requestedTotal = payload.allocations.reduce((s, a) => s + a.amount, 0);

    if (requestedTotal <= 0) {
      return { success: false, error: 'Allocation amount must be greater than zero.' };
    }

    if (requestedTotal > availableToAllocate) {
      return {
        success: false,
        error: `Allocation total (₹${requestedTotal}) exceeds unallocated payment balance (₹${availableToAllocate}).`,
      };
    }

    // 2. Validate each invoice balance
    const createdAllocations: PaymentAllocation[] = [];

    for (const alloc of payload.allocations) {
      const inv = invoicesStore.find((i) => i.id === alloc.invoice_id || i.invoice_number === alloc.invoice_id);
      if (!inv) {
        return { success: false, error: `Invoice ${alloc.invoice_id} not found.` };
      }

      if (alloc.amount > inv.balance_amount) {
        return {
          success: false,
          error: `Allocation amount ₹${alloc.amount} exceeds invoice ${inv.invoice_number} balance ₹${inv.balance_amount}.`,
        };
      }

      // Update invoice
      inv.paid_amount = Number(((inv.paid_amount || 0) + alloc.amount).toFixed(2));
      inv.balance_amount = Math.max(0, Number((inv.grand_total - inv.paid_amount).toFixed(2)));
      inv.status = inv.balance_amount === 0 ? 'Paid' : 'Partially Paid';

      const allocationRecord: PaymentAllocation = {
        id: `ALC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        payment_id: payment.id,
        payment_number: payment.payment_number,
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        allocated_amount: alloc.amount,
        created_at: new Date().toISOString(),
      };

      allocStore.push(allocationRecord);
      createdAllocations.push(allocationRecord);
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'ALLOCATE_PAYMENT',
      module: 'FINANCE',
      details: `Allocated payment ${payment.payment_number} across ${payload.allocations.length} invoices (Total: ₹${requestedTotal})`,
    });

    revalidatePath('/dashboard/invoices');
    revalidatePath('/dashboard/customers');

    return { success: true, data: createdAllocations };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to allocate payment' };
  }
}

/**
 * Record Advance Payment (Unallocated Customer Payment).
 */
export async function recordAdvancePayment(payload: {
  customer_id: string;
  customer_name: string;
  company_name?: string;
  amount: number;
  mode: PaymentMode;
  reference_number: string;
  bank_name?: string;
  notes?: string;
}): Promise<{ success: boolean; data?: Payment; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);

    if (payload.amount <= 0) {
      return { success: false, error: 'Advance payment amount must be greater than zero.' };
    }

    const payNumber = await getNextPaymentNumber();
    const paymentsStore: Payment[] = globalThis.__ICON_PAYMENTS__ || [];

    // Duplicate reference check
    const duplicate = paymentsStore.find(
      (p) => p.reference_number.toLowerCase() === payload.reference_number.trim().toLowerCase()
    );
    if (duplicate) {
      return {
        success: false,
        error: `Payment with reference number "${payload.reference_number}" already exists (${duplicate.payment_number}).`,
      };
    }

    const payment: Payment = {
      id: `PAY-${Date.now()}`,
      payment_number: payNumber,
      customer_name: payload.customer_name,
      company_name: payload.company_name,
      amount: payload.amount,
      mode: payload.mode,
      reference_number: payload.reference_number,
      bank_name: payload.bank_name,
      payment_date: new Date().toISOString().split('T')[0],
      notes: payload.notes ? `[ADVANCE] ${payload.notes}` : '[ADVANCE] Unallocated Customer Deposit',
      recorded_by_name: authUser.name,
      created_at: new Date().toISOString(),
    };

    paymentsStore.unshift(payment);

    await logAuditEvent({
      userName: authUser.name,
      action: 'RECORD_ADVANCE_PAYMENT',
      module: 'FINANCE',
      details: `Recorded advance deposit ${payNumber} of ₹${payload.amount} from ${payload.customer_name} (Ref: ${payload.reference_number})`,
    });

    revalidatePath('/dashboard/invoices');
    revalidatePath('/dashboard/customers');

    return { success: true, data: payment };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to record advance payment' };
  }
}

/**
 * Record Promise-to-Pay for Receivables Follow-Up.
 */
export async function recordPromiseToPay(payload: {
  customer_id: string;
  invoice_id?: string;
  promised_amount: number;
  promised_date: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await getAuthenticatedUser();
    const userName = authUser?.name || 'Authorized Staff';

    const ptpStore = getPromisesToPayStore();
    const record = {
      id: `PTP-${Date.now()}`,
      customer_id: payload.customer_id,
      invoice_id: payload.invoice_id,
      promised_amount: payload.promised_amount,
      promised_date: payload.promised_date,
      status: 'PENDING' as const,
      notes: payload.notes,
      recorded_by: userName,
      created_at: new Date().toISOString(),
    };

    ptpStore.unshift(record);

    await logAuditEvent({
      userName,
      action: 'RECORD_PROMISE_TO_PAY',
      module: 'FINANCE',
      details: `Recorded Promise-to-Pay ₹${payload.promised_amount} due on ${payload.promised_date} for customer ${payload.customer_id}`,
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to record promise-to-pay' };
  }
}

/**
 * Issue Credit Note against an Invoice.
 */
export async function createCreditNote(payload: {
  invoice_id: string;
  amount: number;
  reason: string;
}): Promise<{ success: boolean; data?: CreditNote; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
    const invoicesRes = await getInvoices();
    const inv = invoicesRes.invoices.find((i) => i.id === payload.invoice_id || i.invoice_number === payload.invoice_id);

    if (!inv) {
      return { success: false, error: 'Target invoice not found.' };
    }

    if (payload.amount <= 0) {
      return { success: false, error: 'Credit Note amount must be greater than zero.' };
    }

    if (payload.amount > inv.grand_total) {
      return { success: false, error: `Credit Note cannot exceed invoice total of ₹${inv.grand_total}.` };
    }

    const cnStore = getCreditNotesStore();
    const cnNumber = `ITP/CN/26-27/${(cnStore.length + 1).toString().padStart(4, '0')}`;

    // 18% standard GST tax breakup
    const cgst = inv.cgst_amount > 0 ? Number(((payload.amount * 0.09) / 1.18).toFixed(2)) : 0;
    const sgst = inv.sgst_amount > 0 ? Number(((payload.amount * 0.09) / 1.18).toFixed(2)) : 0;
    const igst = inv.igst_amount > 0 ? Number(((payload.amount * 0.18) / 1.18).toFixed(2)) : 0;

    const creditNote: CreditNote = {
      id: `CN-${Date.now()}`,
      credit_note_number: cnNumber,
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      customer_id: inv.customer_id || 'CUST0001',
      customer_name: inv.customer_name,
      total_amount: payload.amount,
      cgst_amount: cgst,
      sgst_amount: sgst,
      igst_amount: igst,
      reason: payload.reason,
      status: 'ISSUED',
      created_by_name: authUser.name,
      created_at: new Date().toISOString(),
    };

    // Reduce balance on invoice
    inv.balance_amount = Math.max(0, Number((inv.balance_amount - payload.amount).toFixed(2)));
    if (inv.balance_amount === 0) inv.status = 'Paid';

    cnStore.unshift(creditNote);

    await logAuditEvent({
      userName: authUser.name,
      action: 'ISSUE_CREDIT_NOTE',
      module: 'FINANCE',
      details: `Issued Credit Note ${cnNumber} for ₹${payload.amount} against Invoice ${inv.invoice_number} (${payload.reason})`,
    });

    revalidatePath('/dashboard/invoices');
    return { success: true, data: creditNote };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to create credit note' };
  }
}

/**
 * Issue Debit Note against a Supplier Invoice.
 */
export async function createDebitNote(payload: {
  supplier_invoice_id: string;
  amount: number;
  reason: string;
}): Promise<{ success: boolean; data?: DebitNote; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
    const supRes = await getSupplierInvoices();
    const supInvoices = supRes.invoices || [];
    const sinv = supInvoices.find(
      (s) => s.id === payload.supplier_invoice_id || s.invoice_number === payload.supplier_invoice_id
    );

    if (!sinv) {
      return { success: false, error: 'Supplier Invoice not found.' };
    }

    if (payload.amount <= 0) {
      return { success: false, error: 'Debit note amount must be greater than zero.' };
    }

    const currentOutstanding = sinv.outstanding_amount ?? sinv.total_amount;
    if (payload.amount > currentOutstanding) {
      return {
        success: false,
        error: `Debit Note amount (₹${payload.amount}) cannot exceed supplier invoice balance of ₹${currentOutstanding}.`,
      };
    }

    const dnStore = getDebitNotesStore();
    const dnNumber = `ITP/DN/26-27/${(dnStore.length + 1).toString().padStart(4, '0')}`;

    const debitNote: DebitNote = {
      id: `DN-${Date.now()}`,
      debit_note_number: dnNumber,
      supplier_invoice_id: sinv.id,
      supplier_invoice_number: sinv.invoice_number,
      supplier_id: sinv.supplier_id || 'SUP001',
      supplier_name: sinv.supplier_name,
      total_amount: payload.amount,
      cgst_amount: Number(((payload.amount * 0.09) / 1.18).toFixed(2)),
      sgst_amount: Number(((payload.amount * 0.09) / 1.18).toFixed(2)),
      igst_amount: 0,
      reason: payload.reason,
      status: 'ISSUED',
      created_by_name: authUser.name,
      created_at: new Date().toISOString(),
    };

    // Deduct outstanding payable balance
    sinv.outstanding_amount = Math.max(0, Number((currentOutstanding - payload.amount).toFixed(2)));

    dnStore.unshift(debitNote);

    await logAuditEvent({
      userName: authUser.name,
      action: 'ISSUE_DEBIT_NOTE',
      module: 'FINANCE',
      details: `Issued Debit Note ${dnNumber} for ₹${payload.amount} against Supplier Invoice ${sinv.invoice_number}`,
    });

    return { success: true, data: debitNote };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to create debit note' };
  }
}

export async function getCreditNotes(): Promise<CreditNote[]> {
  return getCreditNotesStore();
}

export async function getDebitNotes(): Promise<DebitNote[]> {
  return getDebitNotesStore();
}

export async function getPaymentAllocations(paymentId?: string): Promise<PaymentAllocation[]> {
  const store = getAllocationsStore();
  if (paymentId) {
    return store.filter((a) => a.payment_id === paymentId || a.payment_number === paymentId);
  }
  return store;
}
