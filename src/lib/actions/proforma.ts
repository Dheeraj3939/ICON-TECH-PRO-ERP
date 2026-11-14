'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth, requireRole, getAuthenticatedUser } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import { sanitizeSearchTerm } from '@/lib/supabase/db-helpers';
import { getNextProformaNumber } from '@/lib/utils/sequence';
import { numberToWordsINR } from '@/lib/utils/inr-words';
import { getQuotationById } from '@/lib/actions/quotations';
import { getSalesOrderById } from '@/lib/actions/orders';
import { getCompanySettings } from '@/lib/actions/company-settings';
import type {
  ProformaInvoice,
  ProformaInvoiceItem,
  CreateProformaPayload,
  ProformaStatus,
  ProformaBankDetails,
} from '@/types/proforma';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_PROFORMA_INVOICES__: ProformaInvoice[] | undefined;
}

const DEFAULT_BANK_DETAILS: ProformaBankDetails = {
  bank_name: 'IDBI Bank',
  account_holder: 'ICON TECH PRO',
  account_number: '0426653800000161',
  ifsc_code: 'IBKL0000426',
  branch: 'Bandri Complex, SR Nagar, Hyderabad',
  upi_id: 'icontechpro@idbi',
};

const SEED_PROFORMA_INVOICES: ProformaInvoice[] = [
  {
    id: 'PI-2026-0001',
    proforma_number: 'ITP/PI/2026-27/0001',
    proforma_date: '2026-08-25',
    validity_days: 15,
    due_date: '2026-09-09',
    customer_id: 'CUST-CYIENT-001',
    customer_name: 'Cyient Technologies Hyderabad Campus',
    company_name: 'Cyient Limited',
    gstin: '36AAACC1206M1ZV',
    billing_address: 'Plot No. 11, Software Units Layout, Infocity, Madhapur, Hyderabad, Telangana 500081',
    shipping_address: 'Plot No. 11, Software Units Layout, Infocity, Madhapur, Hyderabad, Telangana 500081',
    place_of_supply: '36 - Telangana',
    quotation_number: 'ICON/26-27/QT-0001',
    is_gst_inclusive: false,
    pricing_mode: 'EXCLUSIVE',
    items: [
      {
        description: 'BenQ RM7503 75-inch 4K UHD Education Interactive Flat Panel Display',
        model_name: 'RM7503',
        brand_name: 'BenQ',
        hsn_sac: '85285200',
        quantity: 2,
        unit: 'Nos.',
        rate: 145000,
        discount_pct: 5,
        discount_amount: 14500,
        taxable_amount: 275500,
        gst_rate: 18,
        cgst_amount: 24795,
        sgst_amount: 24795,
        igst_amount: 0,
        total_amount: 325090,
      },
    ],
    subtotal: 290000,
    total_discount: 14500,
    taxable_amount: 275500,
    cgst_amount: 24795,
    sgst_amount: 24795,
    igst_amount: 0,
    gst_amount: 49590,
    grand_total: 325090,
    advance_amount: 162545,
    balance_amount: 162545,
    amount_in_words: 'INR Three Lakh, Twenty-Five Thousand, Ninety Rupees Only.',
    payment_terms: '50% Advance with Purchase Order, 50% against Delivery',
    delivery_terms: 'Immediate dispatch from Hyderabad central hub within 3-5 days',
    terms_conditions: [
      'This is a Proforma Invoice and NOT a Tax Invoice. No input tax credit can be claimed against this document.',
      'Prices quoted are valid for 15 days from the date of issuance.',
      'Material dispatch is strictly subject to receipt of the agreed advance payment.',
      'Standard manufacturer warranty applies as per product data sheet.',
    ],
    bank_details: DEFAULT_BANK_DETAILS,
    status: 'Issued',
    version: 1,
    created_by_name: 'B V Dheeraj Reddy',
    created_at: '2026-08-25T10:30:00Z',
    updated_at: '2026-08-25T10:30:00Z',
  },
];

function getProformaStore(): ProformaInvoice[] {
  if (!globalThis.__ICON_PROFORMA_INVOICES__) {
    globalThis.__ICON_PROFORMA_INVOICES__ = [...SEED_PROFORMA_INVOICES];
  }
  return globalThis.__ICON_PROFORMA_INVOICES__;
}

function hydrateProformaRow(row: any): ProformaInvoice {
  const rawItems = Array.isArray(row.items) ? row.items : [];
  const items: ProformaInvoiceItem[] = rawItems.map((it: any) => {
    const qty = Number(it.quantity) || 0;
    const rate = Number(it.rate) || 0;
    const discPct = Number(it.discount_pct) || 0;
    const discountAmount =
      it.discount_amount !== undefined
        ? Number(it.discount_amount)
        : Number((((rate * qty) * discPct) / 100).toFixed(2));
    return {
      ...it,
      quantity: qty,
      rate,
      discount_pct: discPct,
      discount_amount: discountAmount,
      taxable_amount: Number(it.taxable_amount) || 0,
      gst_rate: Number(it.gst_rate) || 0,
      cgst_amount: Number(it.cgst_amount) || 0,
      sgst_amount: Number(it.sgst_amount) || 0,
      igst_amount: Number(it.igst_amount) || 0,
      total_amount: Number(it.line_total ?? it.total_amount ?? 0),
    };
  });

  return {
    ...row,
    due_date: row.expiry_date || row.due_date || '',
    terms_conditions: Array.isArray(row.terms_conditions) ? row.terms_conditions : [],
    bank_details: row.bank_details || {
      bank_name: row.bank_name || DEFAULT_BANK_DETAILS.bank_name,
      account_holder: DEFAULT_BANK_DETAILS.account_holder,
      account_number: row.bank_account_number || DEFAULT_BANK_DETAILS.account_number,
      ifsc_code: row.bank_ifsc || DEFAULT_BANK_DETAILS.ifsc_code,
      branch: row.bank_branch || DEFAULT_BANK_DETAILS.branch,
      upi_id: DEFAULT_BANK_DETAILS.upi_id,
    },
    items,
  } as ProformaInvoice;
}

async function findProformaRecord(idOrNumber: string): Promise<ProformaInvoice | null> {
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const { data: byId, error: byIdErr } = await admin
        .from('proforma_invoices')
        .select('*, items:proforma_invoice_items(*)')
        .eq('id', idOrNumber)
        .maybeSingle();
      if (!byIdErr && byId) {
        return hydrateProformaRow(byId);
      }

      const { data: byNum, error: byNumErr } = await admin
        .from('proforma_invoices')
        .select('*, items:proforma_invoice_items(*)')
        .eq('proforma_number', idOrNumber)
        .maybeSingle();
      if (!byNumErr && byNum) {
        return hydrateProformaRow(byNum);
      }
      return null;
    } catch {
      // Fallback to in-memory cache when DB query fails
    }
  }

  const store = getProformaStore();
  return store.find((p) => p.id === idOrNumber || p.proforma_number === idOrNumber) || null;
}

/**
 * Retrieve all Proforma Invoices with optional search and status filtering.
 */
export async function getProformaInvoices(filters?: {
  status?: string;
  search?: string;
  customer_id?: string;
}): Promise<{ proformas: ProformaInvoice[]; total: number }> {
  await requireAuth();
  const store = getProformaStore();

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const admin = createAdminClient();
      let query = admin.from('proforma_invoices').select('*, items:proforma_invoice_items(*)');

      if (filters?.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status);
      }
      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }
      if (filters?.search) {
        const s = sanitizeSearchTerm(filters.search);
        if (s) {
          query = query.or(
            `proforma_number.ilike.%${s}%,customer_name.ilike.%${s}%,company_name.ilike.%${s}%,quotation_number.ilike.%${s}%`
          );
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data) {
        return { proformas: data.map(hydrateProformaRow), total: data.length };
      }
    } catch {
      // In-memory fallback when Supabase fails
    }
  }

  let list = [...store];
  if (filters?.status && filters.status !== 'ALL') {
    list = list.filter((p) => p.status === filters.status);
  }
  if (filters?.customer_id) {
    list = list.filter((p) => p.customer_id === filters.customer_id);
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    list = list.filter(
      (p) =>
        p.proforma_number.toLowerCase().includes(s) ||
        p.customer_name.toLowerCase().includes(s) ||
        (p.company_name && p.company_name.toLowerCase().includes(s)) ||
        (p.quotation_number && p.quotation_number.toLowerCase().includes(s)) ||
        (p.order_number && p.order_number.toLowerCase().includes(s))
    );
  }

  return { proformas: list, total: list.length };
}

/**
 * Retrieve a single Proforma Invoice by ID or Number.
 */
export async function getProformaInvoiceById(idOrNumber: string): Promise<ProformaInvoice | null> {
  await requireAuth();
  return findProformaRecord(idOrNumber);
}

/**
 * Create a new Proforma Invoice (Manual, from Quotation, or from Sales Order).
 * STRICT BUSINESS RULES:
 * - Must NOT create accounting voucher
 * - Must NOT create GST liability
 * - Must NOT generate IRN
 * - Must NOT create inventory movement
 * - Must NOT automatically become a tax invoice
 */
export async function createProformaInvoice(
  payload: CreateProformaPayload
): Promise<{ success: boolean; data?: ProformaInvoice; error?: string }> {
  try {
    const actor = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
      'Accounts',
    ]);

    if (!payload.customer_name || !payload.customer_name.trim()) {
      return { success: false, error: 'Customer name is required' };
    }
    if (!payload.items || payload.items.length === 0) {
      return { success: false, error: 'At least one line item is required' };
    }

    const isInclusive = payload.pricing_mode === 'INCLUSIVE' || Boolean(payload.is_gst_inclusive);
    const pos = (payload.place_of_supply || '36 - Telangana').trim();
    const isInterstate = !pos.startsWith('36') && !pos.toLowerCase().includes('telangana');

    let subtotal = 0;
    let totalDiscount = 0;
    let gstTotal = 0;
    let taxableAmountSum = 0;

    const items: ProformaInvoiceItem[] = payload.items.map((item, index) => {
      const qty = Math.max(0.001, Number(item.quantity) || 1);
      const rate = Math.max(0, Number(item.rate) || 0);
      const discPct = Math.min(100, Math.max(0, Number(item.discount_pct) || 0));
      const lineGross = rate * qty;
      const discountAmount = Number(((lineGross * discPct) / 100).toFixed(2));
      const netLine = Number((lineGross - discountAmount).toFixed(2));
      const gstRate = item.gst_rate ?? 18;

      let taxable: number;
      let gstAmt: number;
      let total: number;

      if (isInclusive) {
        total = netLine;
        taxable = gstRate > 0 ? Number((netLine / (1 + gstRate / 100)).toFixed(2)) : netLine;
        gstAmt = Number((total - taxable).toFixed(2));
      } else {
        taxable = netLine;
        gstAmt = Number(((taxable * gstRate) / 100).toFixed(2));
        total = Number((taxable + gstAmt).toFixed(2));
      }

      const cgst = isInterstate ? 0 : Number((gstAmt / 2).toFixed(2));
      const sgst = isInterstate ? 0 : Number((gstAmt / 2).toFixed(2));
      const igst = isInterstate ? gstAmt : 0;

      subtotal += lineGross;
      totalDiscount += discountAmount;
      gstTotal += gstAmt;
      taxableAmountSum += taxable;

      return {
        id: `PI-ITEM-${index + 1}`,
        product_id: item.product_id,
        description: item.description,
        model_name: item.model_name,
        brand_name: item.brand_name,
        hsn_sac: item.hsn_sac || '85285200',
        quantity: qty,
        unit: item.unit || 'Nos.',
        rate,
        discount_pct: discPct,
        discount_amount: discountAmount,
        taxable_amount: taxable,
        gst_rate: gstRate,
        cgst_amount: cgst,
        sgst_amount: sgst,
        igst_amount: igst,
        total_amount: total,
      };
    });

    const taxableAmount = isInclusive
      ? Number(taxableAmountSum.toFixed(2))
      : Math.max(0, Number((subtotal - totalDiscount).toFixed(2)));

    const cgstAmount = isInterstate ? 0 : Number((gstTotal / 2).toFixed(2));
    const sgstAmount = isInterstate ? 0 : Number((gstTotal / 2).toFixed(2));
    const igstAmount = isInterstate ? Number(gstTotal.toFixed(2)) : 0;

    const grandTotal = isInclusive
      ? Number((subtotal - totalDiscount).toFixed(2))
      : Number((taxableAmount + cgstAmount + sgstAmount + igstAmount).toFixed(2));

    const advanceAmount = Math.max(0, Number(payload.advance_amount) || 0);
    const balanceAmount = Math.max(0, Number((grandTotal - advanceAmount).toFixed(2)));

    // Fetch dynamic company settings for bank details and terms
    let companyBank = DEFAULT_BANK_DETAILS;
    try {
      const companySettings = await getCompanySettings();
      if (companySettings?.bank_details) {
        companyBank = {
          bank_name: companySettings.bank_details.bank_name || DEFAULT_BANK_DETAILS.bank_name,
          account_holder: companySettings.bank_details.account_name || DEFAULT_BANK_DETAILS.account_holder,
          account_number: companySettings.bank_details.account_number || DEFAULT_BANK_DETAILS.account_number,
          ifsc_code: companySettings.bank_details.ifsc_code || DEFAULT_BANK_DETAILS.ifsc_code,
          branch: companySettings.bank_details.branch || DEFAULT_BANK_DETAILS.branch,
          upi_id: DEFAULT_BANK_DETAILS.upi_id,
        };
      }
    } catch {
      // Fallback
    }

    const proformaNumber = await getNextProformaNumber();
    const proformaDate = payload.proforma_date || new Date().toISOString().split('T')[0];
    const validityDays = payload.validity_days || 15;
    const dueDateObj = new Date(proformaDate);
    dueDateObj.setDate(dueDateObj.getDate() + validityDays);
    const dueDate = dueDateObj.toISOString().split('T')[0];

    const termsConditions = payload.terms_conditions && payload.terms_conditions.length > 0
      ? payload.terms_conditions
      : [
          'This is a PROFORMA INVOICE and NOT a Tax Invoice. It creates no GST liability or input tax credit claim.',
          'Prices and specifications are valid for 15 days from the date of issue.',
          'Delivery: Dispatched within 3-5 business days upon receipt of advance payment.',
          'Warranty: Standard official manufacturer warranty applies.',
          'Payments must be remitted strictly to ICON TECH PRO bank details listed above.',
        ];

    const newProforma: ProformaInvoice = {
      id: `PI-${Date.now()}`,
      proforma_number: proformaNumber,
      proforma_date: proformaDate,
      validity_days: validityDays,
      due_date: dueDate,
      customer_id: payload.customer_id,
      customer_name: payload.customer_name.trim(),
      company_name: payload.company_name?.trim(),
      gstin: payload.gstin?.trim(),
      billing_address: payload.billing_address?.trim(),
      shipping_address: payload.shipping_address?.trim() || payload.billing_address?.trim(),
      place_of_supply: pos,
      quotation_id: payload.quotation_id,
      quotation_number: payload.quotation_number,
      order_id: payload.order_id,
      order_number: payload.order_number,
      is_gst_inclusive: isInclusive,
      pricing_mode: isInclusive ? 'INCLUSIVE' : 'EXCLUSIVE',
      items,
      subtotal: Number(subtotal.toFixed(2)),
      total_discount: Number(totalDiscount.toFixed(2)),
      taxable_amount: taxableAmount,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      gst_amount: Number(gstTotal.toFixed(2)),
      grand_total: grandTotal,
      advance_amount: advanceAmount,
      balance_amount: balanceAmount,
      amount_in_words: numberToWordsINR(grandTotal),
      payment_terms: payload.payment_terms || (advanceAmount > 0 ? `Advance: ₹${advanceAmount.toLocaleString('en-IN')}, Balance on Delivery` : '100% Advance Payment'),
      delivery_terms: payload.delivery_terms || 'Immediate dispatch from Hyderabad central hub',
      terms_conditions: termsConditions,
      bank_details: companyBank,
      notes: payload.notes,
      status: 'Issued',
      version: 1,
      created_by_name: actor.name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const store = getProformaStore();
    store.unshift(newProforma);

    // Persist to Supabase if available
    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        const { data: dbRow, error: piErr } = await admin
          .from('proforma_invoices')
          .insert({
            id: newProforma.id,
            proforma_number: newProforma.proforma_number,
            proforma_date: newProforma.proforma_date,
            validity_days: newProforma.validity_days,
            expiry_date: newProforma.due_date || null,
            customer_id: newProforma.customer_id,
            customer_name: newProforma.customer_name,
            company_name: newProforma.company_name || null,
            gstin: newProforma.gstin || null,
            billing_address: newProforma.billing_address || null,
            shipping_address: newProforma.shipping_address || null,
            place_of_supply: newProforma.place_of_supply,
            quotation_id: newProforma.quotation_id || null,
            quotation_number: newProforma.quotation_number || null,
            order_id: newProforma.order_id || null,
            order_number: newProforma.order_number || null,
            is_gst_inclusive: newProforma.is_gst_inclusive,
            pricing_mode: newProforma.pricing_mode,
            subtotal: newProforma.subtotal,
            total_discount: newProforma.total_discount,
            taxable_amount: newProforma.taxable_amount,
            cgst_amount: newProforma.cgst_amount,
            sgst_amount: newProforma.sgst_amount,
            igst_amount: newProforma.igst_amount,
            gst_amount: newProforma.gst_amount,
            round_off: 0,
            grand_total: newProforma.grand_total,
            advance_amount: newProforma.advance_amount,
            balance_amount: newProforma.balance_amount,
            amount_in_words: newProforma.amount_in_words,
            payment_terms: newProforma.payment_terms,
            delivery_terms: newProforma.delivery_terms,
            terms_conditions: newProforma.terms_conditions,
            bank_name: newProforma.bank_details.bank_name,
            bank_account_number: newProforma.bank_details.account_number,
            bank_ifsc: newProforma.bank_details.ifsc_code,
            bank_branch: newProforma.bank_details.branch || '',
            notes: newProforma.notes || null,
            status: newProforma.status,
            version: newProforma.version,
            created_by_name: newProforma.created_by_name,
          })
          .select('id')
          .single();

        if (!piErr && dbRow?.id) {
          newProforma.id = dbRow.id;
          const itemsPayload = items.map((it, idx) => ({
            id: `${dbRow.id}-IT-${idx + 1}`,
            proforma_id: dbRow.id,
            product_id: it.product_id || null,
            description: it.description,
            model_name: it.model_name || null,
            brand_name: it.brand_name || null,
            hsn_sac: it.hsn_sac,
            quantity: it.quantity,
            unit: it.unit,
            rate: it.rate,
            discount_pct: it.discount_pct,
            taxable_amount: it.taxable_amount,
            gst_rate: it.gst_rate,
            cgst_rate: isInterstate ? 0 : Number(((it.gst_rate || 0) / 2).toFixed(2)),
            cgst_amount: it.cgst_amount,
            sgst_rate: isInterstate ? 0 : Number(((it.gst_rate || 0) / 2).toFixed(2)),
            sgst_amount: it.sgst_amount,
            igst_rate: isInterstate ? Number(it.gst_rate || 0) : 0,
            igst_amount: it.igst_amount,
            line_total: it.total_amount,
            sort_order: idx,
          }));
          const { error: itemErr } = await admin.from('proforma_invoice_items').insert(itemsPayload);
          if (itemErr) {
            console.warn('Supabase proforma items insert error:', itemErr.message);
          }
        } else if (piErr) {
          console.warn('Supabase proforma header insert error:', piErr.message);
        }
      } catch (dbErr) {
        console.warn('Supabase proforma insert fallback to memory:', dbErr);
      }
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'CREATE_PROFORMA_INVOICE',
      module: 'PROFORMA',
      details: `Created Proforma Invoice ${proformaNumber} for ${newProforma.customer_name} (Grand Total: ₹${grandTotal.toLocaleString('en-IN')})`,
    });

    revalidatePath('/dashboard/proforma-invoices');
    revalidatePath('/dashboard/customers');
    revalidatePath('/dashboard');
    return { success: true, data: newProforma };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create proforma invoice' };
  }
}

/**
 * Generate a Proforma Invoice directly from an existing Quotation.
 */
export async function createProformaFromQuotation(
  quotationId: string
): Promise<{ success: boolean; data?: ProformaInvoice; error?: string }> {
  try {
    const quote = await getQuotationById(quotationId);
    if (!quote) {
      return { success: false, error: `Quotation ${quotationId} not found` };
    }

    return await createProformaInvoice({
      customer_id: quote.customer_id,
      customer_name: quote.customer_name,
      company_name: quote.company_name,
      gstin: (quote as any).gstin || undefined,
      billing_address: quote.address,
      shipping_address: quote.address,
      place_of_supply: quote.place_of_supply,
      quotation_id: quote.id,
      quotation_number: quote.quotation_number,
      is_gst_inclusive: quote.is_gst_inclusive,
      pricing_mode: quote.pricing_mode || (quote.is_gst_inclusive ? 'INCLUSIVE' : 'EXCLUSIVE'),
      proforma_date: new Date().toISOString().split('T')[0],
      validity_days: quote.validity_days || 15,
      items: quote.items.map((it) => ({
        product_id: it.product_id || undefined,
        description: it.product_name,
        model_name: it.model,
        brand_name: it.brand,
        hsn_sac: it.hsn_sac || '85285200',
        quantity: it.quantity,
        unit: it.unit || 'Nos.',
        rate: it.selling_price,
        discount_pct: it.discount_pct || 0,
        gst_rate: it.gst_rate ?? 18,
      })),
      advance_amount: Math.round(quote.grand_total * 0.5),
      payment_terms: quote.payment_terms || '50% Advance with Order Confirmation, Balance on Delivery',
      delivery_terms: quote.delivery_terms || 'Immediate dispatch from Hyderabad central hub',
      terms_conditions: quote.terms_conditions,
      notes: `Generated from Quotation ${quote.quotation_number}`,
    });
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to generate proforma from quotation' };
  }
}

/**
 * Generate a Proforma Invoice directly from a confirmed Sales Order.
 */
export async function createProformaFromSalesOrder(
  orderId: string
): Promise<{ success: boolean; data?: ProformaInvoice; error?: string }> {
  try {
    const order = await getSalesOrderById(orderId);
    if (!order) {
      return { success: false, error: `Sales Order ${orderId} not found` };
    }

    return await createProformaInvoice({
      customer_id: order.customer_id,
      customer_name: order.customer_name,
      company_name: order.company_name,
      gstin: (order as any).gstin || undefined,
      billing_address: order.shipping_address,
      shipping_address: order.shipping_address,
      place_of_supply: order.place_of_supply,
      order_id: order.id,
      order_number: order.order_number,
      quotation_id: order.quotation_id,
      quotation_number: order.quotation_number,
      is_gst_inclusive: false,
      pricing_mode: 'EXCLUSIVE',
      proforma_date: new Date().toISOString().split('T')[0],
      validity_days: 15,
      items: (order.items || []).map((it) => ({
        product_id: it.product_id || undefined,
        description: it.product_name,
        hsn_sac: '85285200',
        quantity: it.quantity,
        unit: 'Nos.',
        rate: it.selling_price,
        discount_pct: 0,
        gst_rate: it.gst_rate || 18,
      })),
      advance_amount: Math.round(((order as any).grand_total || (order as any).total_amount || 0) * 0.5),
      payment_terms: '50% Advance, Balance on Delivery',
      delivery_terms: 'Immediate dispatch',
      notes: `Generated from Sales Order ${order.order_number}`,
    });
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to generate proforma from sales order' };
  }
}

/**
 * Cancel a Proforma Invoice with mandatory recorded reason.
 */
export async function cancelProformaInvoice(
  id: string,
  reason: string
): Promise<{ success: boolean; data?: ProformaInvoice; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
    if (!reason || !reason.trim()) {
      return { success: false, error: 'A valid cancellation reason is mandatory' };
    }

    const p = await findProformaRecord(id);
    if (!p) {
      return { success: false, error: 'Proforma Invoice not found' };
    }

    const nowIso = new Date().toISOString();
    p.status = 'Cancelled';
    p.notes = p.notes ? `${p.notes}\n[CANCELLED: ${reason.trim()} by ${actor.name}]` : `[CANCELLED: ${reason.trim()} by ${actor.name}]`;
    p.updated_at = nowIso;

    const store = getProformaStore();
    const cached = store.find((item) => item.id === p.id || item.proforma_number === p.proforma_number);
    if (cached) {
      cached.status = 'Cancelled';
      cached.notes = p.notes;
      cached.updated_at = nowIso;
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('proforma_invoices')
          .update({
            status: 'Cancelled',
            cancellation_reason: reason.trim(),
            cancelled_at: nowIso,
            cancelled_by: actor.name,
            notes: p.notes,
            updated_at: nowIso,
          })
          .eq('id', p.id);
      } catch (err) {
        console.warn('Supabase proforma cancellation update fallback:', err);
      }
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'CANCEL_PROFORMA_INVOICE',
      module: 'PROFORMA',
      details: `Cancelled Proforma Invoice ${p.proforma_number}. Reason: ${reason.trim()}`,
    });

    revalidatePath('/dashboard/proforma-invoices');
    return { success: true, data: p };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to cancel proforma invoice' };
  }
}
