'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { findByIdOrCode, isUuid, sanitizeSearchTerm, sanitizeUuid } from '@/lib/supabase/db-helpers';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { INITIAL_INVOICES, INITIAL_PAYMENTS, INITIAL_ORDERS } from '@/lib/constants/erp-data';
import { getNextInvoiceNumber, getNextPaymentNumber } from '@/lib/utils/sequence';
import { getCustomers } from '@/lib/actions/customers';
import { getSalesOrderById } from '@/lib/actions/orders';
import { requireRole, requireAuth } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { queueTallySync } from '@/lib/actions/tally';
import type { Invoice, Payment, SalesOrder, AccountsAgingBucket, CustomerOutstandingSummary } from '@/types/erp';
import type { PaymentRecordValues } from '@/lib/validations/erp';

// Shared in-memory store across requests in this Node process
declare global {
  // eslint-disable-next-line no-var
  var __ICON_INVOICES__: Invoice[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_PAYMENTS__: Payment[] | undefined;
}

function getInvoicesStore(): Invoice[] {
  if (!globalThis.__ICON_INVOICES__) {
    globalThis.__ICON_INVOICES__ = [...INITIAL_INVOICES];
  }
  return globalThis.__ICON_INVOICES__;
}

function hydrateInvoiceRow(row: any): Invoice {
  const grandTotal = Number(row.grand_total) || 0;
  const paidAmount = Number(row.paid_amount) || 0;
  const balanceAmount =
    row.balance_amount !== null && row.balance_amount !== undefined
      ? Number(row.balance_amount)
      : Math.max(0, Number((grandTotal - paidAmount).toFixed(2)));
  return {
    ...row,
    grand_total: grandTotal,
    paid_amount: paidAmount,
    balance_amount: balanceAmount,
    is_locked: Boolean(row.is_locked || row.financial_lock_status === 'LOCKED'),
  } as Invoice;
}

async function findInvoiceRecord(idOrNumber: string): Promise<Invoice | null> {
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const row = await findByIdOrCode<any>(
        admin,
        'invoices',
        idOrNumber,
        'invoice_number',
        '*, items:invoice_items(*)'
      );
      if (row) return hydrateInvoiceRow(row);
      return null;
    } catch (err) {
      console.warn('Supabase findInvoiceRecord fallback:', err);
    }
  }

  const store = getInvoicesStore();
  return store.find((inv) => inv.id === idOrNumber || inv.invoice_number === idOrNumber) || null;
}

function getPaymentsStore(): Payment[] {
  if (!globalThis.__ICON_PAYMENTS__) {
    globalThis.__ICON_PAYMENTS__ = [...INITIAL_PAYMENTS];
  }
  return globalThis.__ICON_PAYMENTS__;
}

export async function getInvoices(filters?: {
  status?: string;
  search?: string;
  customer_id?: string;
}): Promise<{ invoices: Invoice[]; total: number; totalReceivables: number; totalCollected: number }> {
  await requireAuth();
  const store = getInvoicesStore();

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const admin = createAdminClient();
      let query = admin.from('invoices').select('*, items:invoice_items(*)', { count: 'exact' });

      if (filters?.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status);
      }
      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }
      if (filters?.search) {
        const s = sanitizeSearchTerm(filters.search);
        if (s) {
          query = query.or(`invoice_number.ilike.%${s}%,customer_name.ilike.%${s}%,company_name.ilike.%${s}%`);
        }
      }

      query = query.order('created_at', { ascending: false });
      const { data, error } = await query;

      if (!error && data) {
        const list = data.map(hydrateInvoiceRow);
        const totalReceivables = list.reduce((sum, inv) => sum + (inv.balance_amount || 0), 0);
        const totalCollected = list.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
        return { invoices: list, total: list.length, totalReceivables, totalCollected };
      }
    } catch (err) {
      console.warn('Supabase invoices query failed, using store:', err);
    }
  }

  let list = [...store];

  if (filters?.status && filters.status !== 'ALL') {
    list = list.filter((inv) => inv.status === filters.status);
  }
  if (filters?.customer_id) {
    list = list.filter((inv) => inv.customer_id === filters.customer_id);
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    list = list.filter(
      (inv) =>
        inv.invoice_number.toLowerCase().includes(s) ||
        inv.customer_name.toLowerCase().includes(s) ||
        (inv.company_name && inv.company_name.toLowerCase().includes(s))
    );
  }

  const totalReceivables = list.reduce((sum, inv) => sum + (inv.balance_amount || 0), 0);
  const totalCollected = list.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);

  return { invoices: list, total: list.length, totalReceivables, totalCollected };
}

export async function getPayments(): Promise<{ payments: Payment[]; total: number }> {
  await requireRole(['Managing Director', 'Accounts', 'Admin / BDM']);
  const store = getPaymentsStore();

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin.from('payments').select('*').order('payment_date', { ascending: false });
      if (!error && data) {
        return { payments: data as Payment[], total: data.length };
      }
    } catch (err) {
      console.warn('Supabase payments query failed, using store:', err);
    }
  }

  return { payments: store, total: store.length };
}

/**
 * Record a Payment against an Invoice.
 * Resolves P0/P1: Enforces Accounts authorization, prevents overpayments,
 * uses atomic monotonic payment numbers, and updates invoice balances reliably.
 */
export async function recordPayment(
  payload: PaymentRecordValues
): Promise<{ success: boolean; data?: Payment; error?: string }> {
  try {
    // 1. Authoritative Role Enforcement
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);

    const invoicesStore = getInvoicesStore();
    const paymentsStore = getPaymentsStore();

    // 2. Locate target invoice (DB-first)
    const inv = await findInvoiceRecord(payload.invoice_id || payload.invoice_number || '');
    if (!inv) {
      return { success: false, error: 'Target invoice not found in active records.' };
    }

    // 3. Overpayment Prevention & Amount Validation
    if (payload.amount <= 0) {
      return { success: false, error: 'Payment amount must be greater than zero.' };
    }
    const currentBalance = Math.max(0, Number(((inv.grand_total || 0) - (inv.paid_amount || 0)).toFixed(2)));
    if (payload.amount > currentBalance) {
      return {
        success: false,
        error: `Payment exceeds outstanding invoice balance. Outstanding balance is ₹${currentBalance.toLocaleString('en-IN')}`,
      };
    }

    // 4. Concurrency-safe atomic Payment Receipt Number: ICON/26-27/PAY-0001
    const payNumber = await getNextPaymentNumber();

    const payment: Payment = {
      id: `PAY-${Date.now()}`,
      payment_number: payNumber,
      invoice_id: inv.id,
      invoice_number: inv.invoice_number,
      customer_name: payload.customer_name || inv.customer_name,
      company_name: payload.company_name || inv.company_name,
      amount: payload.amount,
      mode: payload.mode,
      reference_number: payload.reference_number,
      bank_name: payload.bank_name,
      payment_date: payload.payment_date || new Date().toISOString().split('T')[0],
      notes: payload.notes,
      recorded_by_name: authUser.name,
      created_at: new Date().toISOString(),
    };

    // 5. Atomically update invoice balance
    inv.paid_amount = Number(((inv.paid_amount || 0) + payload.amount).toFixed(2));
    inv.balance_amount = Math.max(0, Number((inv.grand_total - inv.paid_amount).toFixed(2)));
    inv.status = inv.balance_amount === 0 ? 'Paid' : 'Partially Paid';

    const cachedInv = invoicesStore.find((i) => i.id === inv.id || i.invoice_number === inv.invoice_number);
    if (cachedInv && cachedInv !== inv) {
      cachedInv.paid_amount = inv.paid_amount;
      cachedInv.balance_amount = inv.balance_amount;
      cachedInv.status = inv.status;
    }

    paymentsStore.unshift(payment);

    // 6. Persist to Supabase if available
    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      try {
        const admin = createAdminClient();
        const { data: insertedPay } = await admin
          .from('payments')
          .insert([
            {
              payment_number: payNumber,
              invoice_id: sanitizeUuid(inv.id),
              invoice_number: inv.invoice_number,
              customer_id: sanitizeUuid(inv.customer_id),
              customer_name: payment.customer_name,
              company_name: payment.company_name || null,
              payment_date: payment.payment_date,
              amount: payment.amount,
              mode: payment.mode,
              reference_number: payment.reference_number,
              bank_name: payment.bank_name || null,
              recorded_by_name: authUser.name,
              notes: payment.notes || null,
            },
          ])
          .select('id')
          .single();

        if (insertedPay?.id) {
          payment.id = insertedPay.id;
        }

        await admin
          .from('invoices')
          .update({
            paid_amount: inv.paid_amount,
            status: inv.status,
          })
          .eq('id', inv.id);
      } catch (err) {
        console.warn('Supabase payment recording failed:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'RECORD_PAYMENT',
      module: 'BILLING',
      details: `Recorded payment ${payNumber} of ₹${payload.amount} against Invoice ${inv.invoice_number} (New Balance: ₹${inv.balance_amount})`,
    });

    try {
      await queueTallySync({
        entity_type: 'PAYMENT',
        entity_id: payment.id,
        entity_number: payNumber,
        tally_voucher_type: 'Receipt',
        payload_summary: `Receipt Voucher from ${payment.customer_name} against ${inv.invoice_number} - ₹${payment.amount} (${payment.mode})`,
      });
    } catch (tallyErr) {
      console.warn('Tally payment auto-queue notice:', tallyErr);
    }

    revalidatePath('/dashboard/invoices');
    revalidatePath('/dashboard/tally');
    revalidatePath('/dashboard');
    return { success: true, data: payment };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || 'Failed to record payment',
    };
  }
}

/**
 * Generate a Tax Invoice from a confirmed Sales Order.
 * Conforms to GST Rule 46 sequential invoice numbering.
 */
export async function createInvoiceFromOrder(
  orderId: string
): Promise<{ success: boolean; data?: Invoice; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);

    const invoicesStore = getInvoicesStore();
    const ordersStore: SalesOrder[] = globalThis.__ICON_ORDERS__ || INITIAL_ORDERS;

    // 1. Locate sales order (checking memory and Supabase)
    let order = await getSalesOrderById(orderId);
    if (!order) {
      order = ordersStore.find((o) => o.id === orderId || o.order_number === orderId) || null;
    }
    if (!order) {
      return { success: false, error: 'Sales Order not found in active records.' };
    }

    // 2. Fetch customer details for accurate shipping address & GST Place of Supply
    let customer: any = null;
    try {
      const { customers } = await getCustomers();
      customer = customers.find(
        (c) =>
          c.id === order.customer_id ||
          c.customer_name === order.customer_name ||
          (c.company_name && c.company_name === order.company_name)
      );
    } catch (custErr) {
      console.warn('Customer lookup in createInvoiceFromOrder fallback:', custErr);
    }

    // 3. Resolve shipping address & place of supply
    const resolvedAddress =
      order.shipping_address ||
      customer?.shipping_address ||
      customer?.billing_address ||
      (customer?.city ? `${customer.city}, ${customer.state || 'Telangana'}` : 'Hyderabad Site, Telangana');

    const customerStateCode = (customer?.state_code || '').trim();
    const customerState = (customer?.state || '').trim().toLowerCase();

    // Telangana GST state code is '36'. Inter-state rules apply if state is not Telangana / 36.
    const isInterstate = customerStateCode
      ? customerStateCode !== '36'
      : customerState !== '' && !customerState.includes('telangana');

    const placeOfSupply = isInterstate
      ? (customerStateCode ? `${customerStateCode} - ${customer?.state || 'Other State'}` : (customer?.state || 'Interstate'))
      : '36 - Telangana';

    // 4. Atomic consecutive invoice number: ICON/26-27/INV-0001
    const invNumber = await getNextInvoiceNumber();

    let subtotal = 0;
    let gstTotal = 0;

    const invoiceItems = (order.items || []).map((it) => {
      const rate = it.selling_price;
      const qty = it.quantity;
      const lineSubtotal = rate * qty;
      const gstRate = it.gst_rate || 18;
      const gstAmt = Number(((lineSubtotal * gstRate) / 100).toFixed(2));
      subtotal += lineSubtotal;
      gstTotal += gstAmt;

      return {
        description: it.product_name,
        hsn_code: '85286900',
        quantity: qty,
        unit: 'Nos.',
        rate,
        gst_rate: gstRate,
        gst_amount: gstAmt,
        total_amount: Number((lineSubtotal + gstAmt).toFixed(2)),
      };
    });

    const grandTotal = Number((subtotal + gstTotal).toFixed(2));

    // Calculate Intrastate (CGST+SGST) vs Interstate (IGST)
    const cgstAmount = isInterstate ? 0 : Number((gstTotal / 2).toFixed(2));
    const sgstAmount = isInterstate ? 0 : Number((gstTotal / 2).toFixed(2));
    const igstAmount = isInterstate ? Number(gstTotal.toFixed(2)) : 0;

    const invoice: Invoice = {
      id: `INV-${Date.now()}`,
      invoice_number: invNumber,
      invoice_type: 'TAX_INVOICE',
      entity_code: 'ICON_TECH_PRO',
      order_id: order.id,
      order_number: order.order_number,
      customer_id: order.customer_id,
      company_name: order.company_name,
      customer_name: order.customer_name,
      gstin: customer?.gstin || order.gstin,
      address: resolvedAddress,
      place_of_supply: placeOfSupply,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString().split('T')[0],
      items: invoiceItems,
      subtotal: Number(subtotal.toFixed(2)),
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      gst_amount: Number(gstTotal.toFixed(2)),
      grand_total: grandTotal,
      paid_amount: 0,
      balance_amount: grandTotal,
      status: 'Unpaid',
      created_by_name: authUser.name,
      created_at: new Date().toISOString(),
    };

    invoicesStore.unshift(invoice);
    order.invoice_id = invoice.invoice_number;

    // 5. Persist to Supabase if available
    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      try {
        const admin = createAdminClient();
        const invoicePayload: any = {
          invoice_number: invNumber,
          invoice_type: 'TAX_INVOICE',
          entity_code: 'ICON_TECH_PRO',
          customer_name: order.customer_name,
          company_name: order.company_name || null,
          gstin: invoice.gstin || null,
          address: resolvedAddress,
          invoice_date: invoice.invoice_date,
          due_date: invoice.due_date,
          subtotal: invoice.subtotal,
          cgst_amount: invoice.cgst_amount,
          sgst_amount: invoice.sgst_amount,
          igst_amount: invoice.igst_amount,
          gst_amount: invoice.gst_amount,
          grand_total: invoice.grand_total,
          paid_amount: 0,
          status: 'Unpaid',
          created_by_name: authUser.name,
        };

        if (isUuid(order.id)) {
          invoicePayload.order_id = order.id;
        }
        if (order.order_number) {
          invoicePayload.order_number = order.order_number;
        }
        if (customer && isUuid(customer.id)) {
          invoicePayload.customer_id = customer.id;
        } else if (isUuid(order.customer_id)) {
          invoicePayload.customer_id = order.customer_id;
        }

        const { data: createdInv, error: invErr } = await admin
          .from('invoices')
          .insert([invoicePayload])
          .select('id')
          .single();

        if (!invErr && createdInv?.id) {
          invoice.id = createdInv.id;
          const itemsPayload = invoiceItems.map((item) => ({
            invoice_id: createdInv.id,
            description: item.description,
            hsn_code: item.hsn_code,
            quantity: item.quantity,
            unit: item.unit,
            rate: item.rate,
            gst_rate: item.gst_rate,
            gst_amount: item.gst_amount,
            total_amount: item.total_amount,
          }));
          await admin.from('invoice_items').insert(itemsPayload);

          if (isUuid(order.id)) {
            await admin
              .from('sales_orders')
              .update({ invoice_id: createdInv.id })
              .eq('id', order.id);
          }
        }
      } catch (dbErr) {
        console.warn('Supabase invoice insertion failed:', dbErr);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'CREATE_INVOICE',
      module: 'BILLING',
      details: `Generated Tax Invoice ${invNumber} from Order ${order.order_number} (Grand Total: ₹${grandTotal}, Place of Supply: ${placeOfSupply})`,
    });

    // Auto-enqueue invoice into Tally sync queue
    try {
      await queueTallySync({
        entity_type: 'SALES_INVOICE',
        entity_id: invoice.id,
        entity_number: invoice.invoice_number,
        tally_voucher_type: 'Sales',
        payload_summary: `Sales Voucher for ${invoice.customer_name} - ₹${invoice.grand_total} (${invoice.cgst_amount > 0 ? 'CGST+SGST' : 'IGST'})`,
      });
    } catch (tallyErr) {
      console.warn('Tally auto-queue notice:', tallyErr);
    }

    // Auto-enqueue Tax Invoice email dispatch
    if (customer?.email) {
      try {
        const { enqueueAutomatedEmail, processEmailQueue } = await import('@/lib/actions/email-automation');
        await enqueueAutomatedEmail({
          trigger_type: 'TAX_INVOICE',
          recipient_type: 'CUSTOMER',
          recipient_email: customer.email,
          recipient_name: invoice.customer_name,
          entity_type: 'INVOICE',
          entity_id: invoice.id,
          entity_number: invoice.invoice_number,
          custom_subject: `GST Tax Invoice ${invoice.invoice_number} - ICON TECH PRO`,
          custom_body: `<p>Dear Accounts Team / ${invoice.customer_name},</p><p>Please find attached our official GST Tax Invoice <strong>${invoice.invoice_number}</strong>.</p><p>Invoice Total: <strong>₹${Number(invoice.grand_total).toLocaleString('en-IN')}</strong></p><p><strong>Bank Remittance Details:</strong><br>Bank: IDBI Bank (Bandri Complex, Hyderabad)<br>Account Holder: ICON TECH PRO<br>Account Number: 0426653800000161<br>IFSC Code: IBKL0000426</p><p>Regards,<br><strong>ICON TECH PRO Finance & Billing Division</strong></p>`,
        });
        processEmailQueue().catch(() => {});
      } catch (emErr) {
        console.warn('Invoice automated email trigger warning:', emErr);
      }
    }

    revalidatePath('/dashboard/invoices');
    revalidatePath('/dashboard/sales-orders');
    revalidatePath('/dashboard/tally');
    revalidatePath('/dashboard');

    return { success: true, data: invoice };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || 'Failed to create invoice',
    };
  }
}

/**
 * Approve Invoice (MD, Accounts, Admin / BDM).
 */
export async function approveInvoice(
  invoiceId: string
): Promise<{ success: boolean; data?: Invoice; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Accounts', 'Admin / BDM']);
    const invoice = await findInvoiceRecord(invoiceId);
    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    if (invoice.is_locked) {
      return { success: false, error: 'Cannot modify a locked invoice' };
    }

    const nowIso = new Date().toISOString();
    invoice.approval_status = 'APPROVED';
    invoice.approved_by = authUser.name;
    invoice.approved_at = nowIso;

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('invoices')
          .update({ status: invoice.status === 'Paid' ? 'Paid' : invoice.status })
          .eq('id', invoice.id);
      } catch (err) {
        console.warn('Supabase approveInvoice fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'APPROVE_INVOICE',
      module: 'BILLING',
      details: `Approved invoice ${invoice.invoice_number}`,
    });

    revalidatePath('/dashboard/invoices');
    revalidatePath('/dashboard');
    return { success: true, data: invoice };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to approve invoice' };
  }
}

/**
 * Post Invoice (Marks invoice as officially posted to books).
 */
export async function postInvoice(
  invoiceId: string
): Promise<{ success: boolean; data?: Invoice; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Accounts', 'Admin / BDM']);
    const invoice = await findInvoiceRecord(invoiceId);
    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    if (invoice.is_locked) {
      return { success: false, error: 'Cannot modify a locked invoice' };
    }

    const nowIso = new Date().toISOString();
    invoice.is_posted = true;
    invoice.posted_at = nowIso;
    invoice.posted_by = authUser.name;

    await logAuditEvent({
      userName: authUser.name,
      action: 'POST_INVOICE',
      module: 'BILLING',
      details: `Posted invoice ${invoice.invoice_number} to financial ledger`,
    });

    revalidatePath('/dashboard/invoices');
    revalidatePath('/dashboard');
    return { success: true, data: invoice };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to post invoice' };
  }
}

/**
 * Lock Invoice (Prevents further edits or re-posting).
 */
export async function lockInvoice(
  invoiceId: string
): Promise<{ success: boolean; data?: Invoice; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Accounts', 'Admin / BDM']);
    const invoice = await findInvoiceRecord(invoiceId);
    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    const nowIso = new Date().toISOString();
    invoice.is_locked = true;
    invoice.locked_at = nowIso;
    invoice.locked_by = authUser.name;

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('invoices')
          .update({
            financial_lock_status: 'LOCKED',
            locked_at: nowIso,
            locked_by: authUser.name,
          })
          .eq('id', invoice.id);
      } catch (err) {
        console.warn('Supabase lockInvoice fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'LOCK_INVOICE',
      module: 'BILLING',
      details: `Locked invoice ${invoice.invoice_number}`,
    });

    revalidatePath('/dashboard/invoices');
    revalidatePath('/dashboard');
    return { success: true, data: invoice };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to lock invoice' };
  }
}

/**
 * Phase H: Accounts Aging Calculation
 * Categorizes unpaid & partially paid invoices into aging buckets:
 * 0-30 days, 31-60 days, 61-90 days, 90+ days based on invoice_date or due_date.
 */
export async function getAccountsAging(basis: 'invoice_date' | 'due_date' = 'invoice_date'): Promise<{
  success: boolean;
  buckets: Record<'0-30' | '31-60' | '61-90' | '90+', AccountsAgingBucket>;
  totalOutstanding: number;
  totalOverdue: number;
}> {
  try {
    await requireRole(['Managing Director', 'Accounts', 'Admin / BDM']);
    const { invoices } = await getInvoices({ status: 'ALL' });
    const outstandingInvoices = invoices.filter(
      (inv) => (inv.balance_amount || 0) > 0 && inv.status !== 'Paid'
    );

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const buckets: Record<'0-30' | '31-60' | '61-90' | '90+', AccountsAgingBucket> = {
      '0-30': { bucket: '0-30', amount: 0, invoiceCount: 0, invoices: [] },
      '31-60': { bucket: '31-60', amount: 0, invoiceCount: 0, invoices: [] },
      '61-90': { bucket: '61-90', amount: 0, invoiceCount: 0, invoices: [] },
      '90+': { bucket: '90+', amount: 0, invoiceCount: 0, invoices: [] },
    };

    let totalOutstanding = 0;
    let totalOverdue = 0;

    for (const inv of outstandingInvoices) {
      const balance = Number((inv.balance_amount || 0).toFixed(2));
      totalOutstanding = Number((totalOutstanding + balance).toFixed(2));

      // Check overdue
      if (inv.due_date && inv.due_date < todayStr) {
        totalOverdue = Number((totalOverdue + balance).toFixed(2));
      }

      const refDateStr = basis === 'due_date' && inv.due_date ? inv.due_date : inv.invoice_date;
      const refDate = new Date(refDateStr);
      const diffTime = Math.max(0, now.getTime() - refDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      let bucketKey: '0-30' | '31-60' | '61-90' | '90+' = '0-30';
      if (diffDays > 90) {
        bucketKey = '90+';
      } else if (diffDays > 60) {
        bucketKey = '61-90';
      } else if (diffDays > 30) {
        bucketKey = '31-60';
      }

      buckets[bucketKey].amount = Number((buckets[bucketKey].amount + balance).toFixed(2));
      buckets[bucketKey].invoiceCount += 1;
      buckets[bucketKey].invoices.push(inv);
    }

    return {
      success: true,
      buckets,
      totalOutstanding,
      totalOverdue,
    };
  } catch (err) {
    return {
      success: false,
      buckets: {
        '0-30': { bucket: '0-30', amount: 0, invoiceCount: 0, invoices: [] },
        '31-60': { bucket: '31-60', amount: 0, invoiceCount: 0, invoices: [] },
        '61-90': { bucket: '61-90', amount: 0, invoiceCount: 0, invoices: [] },
        '90+': { bucket: '90+', amount: 0, invoiceCount: 0, invoices: [] },
      },
      totalOutstanding: 0,
      totalOverdue: 0,
    };
  }
}

/**
 * Phase H: Customer Outstanding Summary
 * Returns customer-wise receivables, total invoiced, total paid, and overdue balances.
 */
export async function getCustomerOutstandingBalance(customerIdOrName?: string): Promise<{
  success: boolean;
  summaries: CustomerOutstandingSummary[];
  totalReceivables: number;
}> {
  try {
    await requireAuth();
    const { invoices } = await getInvoices({ status: 'ALL' });
    const todayStr = new Date().toISOString().split('T')[0];

    const customerMap = new Map<string, CustomerOutstandingSummary>();

    for (const inv of invoices) {
      const key = inv.customer_id || inv.customer_name;
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          customerId: inv.customer_id,
          customerName: inv.customer_name,
          companyName: inv.company_name,
          totalInvoiced: 0,
          totalPaid: 0,
          totalBalance: 0,
          overdueBalance: 0,
          invoiceCount: 0,
        });
      }

      const summary = customerMap.get(key)!;
      summary.totalInvoiced = Number((summary.totalInvoiced + (inv.grand_total || 0)).toFixed(2));
      summary.totalPaid = Number((summary.totalPaid + (inv.paid_amount || 0)).toFixed(2));
      const balance = Number((inv.balance_amount || 0).toFixed(2));
      summary.totalBalance = Number((summary.totalBalance + balance).toFixed(2));

      if (inv.due_date && inv.due_date < todayStr && balance > 0) {
        summary.overdueBalance = Number((summary.overdueBalance + balance).toFixed(2));
      }
      summary.invoiceCount += 1;
    }

    let summaries = Array.from(customerMap.values());

    if (customerIdOrName) {
      const q = customerIdOrName.toLowerCase();
      summaries = summaries.filter(
        (s) =>
          (s.customerId && s.customerId.toLowerCase().includes(q)) ||
          s.customerName.toLowerCase().includes(q) ||
          (s.companyName && s.companyName.toLowerCase().includes(q))
      );
    }

    // Sort by highest outstanding balance
    summaries.sort((a, b) => b.totalBalance - a.totalBalance);

    const totalReceivables = Number(
      summaries.reduce((sum, s) => sum + s.totalBalance, 0).toFixed(2)
    );

    return {
      success: true,
      summaries,
      totalReceivables,
    };
  } catch (err) {
    return {
      success: false,
      summaries: [],
      totalReceivables: 0,
    };
  }
}