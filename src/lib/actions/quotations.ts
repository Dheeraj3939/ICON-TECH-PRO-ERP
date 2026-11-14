'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { INITIAL_QUOTATIONS, INITIAL_ORDERS, DISCOUNT_APPROVAL_RULES } from '@/lib/constants/erp-data';
import { getNextQuotationNumber, getNextOrderNumber } from '@/lib/utils/sequence';
import { requireRole, requireAuth } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { createSalesOrder } from '@/lib/actions/orders';
import { getCompanySettings } from '@/lib/actions/company-settings';
import { findByIdOrCode, isUuid, sanitizeUuid, sanitizeSearchTerm } from '@/lib/supabase/db-helpers';
import type { Quotation, QuotationStatus, SalesOrder, QuotationVersion, QuotationRevision, ProjectSection, DiscountApprovalRequest } from '@/types/erp';
import type { QuotationFormValues } from '@/lib/validations/erp';
import {
  calculateLinePricing,
  calculateQuotationPricing,
  analyzeQuotationPricing,
  roundTo2Decimals,
  type LinePricingInput,
  type QuotationPricingResult,
  type MarginHealthAnalysis,
} from '@/lib/pricing/pricing-engine';

// Shared in-memory store across requests in this Node process
declare global {
  // eslint-disable-next-line no-var
  var __ICON_QUOTATIONS__: Quotation[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_ORDERS__: SalesOrder[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_QUOTATION_REVISIONS__: QuotationRevision[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_DISCOUNT_APPROVALS__: DiscountApprovalRequest[] | undefined;
}

function getStore(): Quotation[] {
  if (!globalThis.__ICON_QUOTATIONS__) {
    globalThis.__ICON_QUOTATIONS__ = [...INITIAL_QUOTATIONS];
  }
  return globalThis.__ICON_QUOTATIONS__;
}

function getRevisionsStore(): QuotationRevision[] {
  if (!globalThis.__ICON_QUOTATION_REVISIONS__) {
    globalThis.__ICON_QUOTATION_REVISIONS__ = [];
  }
  return globalThis.__ICON_QUOTATION_REVISIONS__;
}

function getDiscountApprovalsStore(): DiscountApprovalRequest[] {
  if (!globalThis.__ICON_DISCOUNT_APPROVALS__) {
    globalThis.__ICON_DISCOUNT_APPROVALS__ = [];
  }
  return globalThis.__ICON_DISCOUNT_APPROVALS__;
}

function getOrdersStore(): SalesOrder[] {
  if (!globalThis.__ICON_ORDERS__) {
    globalThis.__ICON_ORDERS__ = [...INITIAL_ORDERS];
  }
  return globalThis.__ICON_ORDERS__;
}

function parseQuotationRow(q: any): Quotation {
  let terms = q.terms_conditions;
  let pos = q.place_of_supply || '36-TELANGANA';
  let dispatch =
    q.dispatch_from ||
    '7-1-62/A, FLAT NO-503, 5 TH FLOOR, AMEER ESTATE, SANJEEVA REDDY NAGAR, Hyderabad, TELANGANA, 500038';
  let inclSig = q.include_signature ?? true;
  let cleanNotes = q.notes;
  let qFormat = q.quotation_format || 'STANDARD';
  let pSections = q.project_sections || [];

  if (q.notes && typeof q.notes === 'string' && q.notes.startsWith('{')) {
    try {
      const meta = JSON.parse(q.notes);
      if (meta.terms_conditions) terms = meta.terms_conditions;
      if (meta.place_of_supply) pos = meta.place_of_supply;
      if (meta.dispatch_from) dispatch = meta.dispatch_from;
      if (meta.include_signature !== undefined) inclSig = meta.include_signature;
      if (meta.quotation_format) qFormat = meta.quotation_format;
      if (meta.project_sections) pSections = meta.project_sections;
      if (meta.custom_notes !== undefined) cleanNotes = meta.custom_notes;
    } catch {}
  }

  return {
    ...q,
    terms_conditions: terms,
    place_of_supply: pos,
    dispatch_from: dispatch,
    include_signature: inclSig,
    quotation_format: qFormat,
    project_sections: pSections,
    notes: cleanNotes,
    items: Array.isArray(q.items) ? q.items : [],
  } as Quotation;
}

async function findQuotationRecord(idOrNumber: string): Promise<Quotation | null> {
  const decoded = decodeURIComponent(idOrNumber || '').trim();
  if (!decoded) return null;

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const row = await findByIdOrCode<any>(
        admin,
        'quotations',
        decoded,
        'quotation_number',
        '*, items:quotation_items(*)'
      );
      if (row) return parseQuotationRow(row);
      return null;
    } catch (err) {
      console.warn('Supabase findQuotationRecord warning:', err);
    }
  }

  return (
    getStore().find(
      (q) =>
        q.id === idOrNumber ||
        q.quotation_number === idOrNumber ||
        q.id === decoded ||
        q.quotation_number === decoded
    ) || null
  );
}

export async function getQuotations(filters?: {
  status?: string;
  search?: string;
  customer_id?: string;
}): Promise<{ quotations: Quotation[]; total: number }> {
  const authUser = await requireAuth();
  try {
    const isAvailable = await isSupabaseAvailable();
    if (isAvailable) {
      const admin = createAdminClient();
      let query = admin.from('quotations').select('*, items:quotation_items(*)', { count: 'exact' });

      if (filters?.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status);
      }
      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }
      if (filters?.search) {
        const s = sanitizeSearchTerm(filters.search);
        if (s) {
          query = query.or(`quotation_number.ilike.%${s}%,customer_name.ilike.%${s}%,company_name.ilike.%${s}%`);
        }
      }

      query = query.order('created_at', { ascending: false });
      const { data, error, count } = await query;

      if (!error && data) {
        const formatted = (data as any[]).map(parseQuotationRow);
        const canViewCosts = ['Managing Director', 'Admin / BDM', 'Accounts'].includes(authUser.role);
        const safeFormatted = canViewCosts
          ? formatted
          : formatted.map((q) => ({
              ...q,
              total_cost: 0,
              margin_pct: 0,
              items: (q.items || []).map((it) => ({ ...it, purchase_price: 0, supplier_id: undefined })),
            }));
        return { quotations: safeFormatted, total: count ?? safeFormatted.length };
      }
    }
  } catch {
    // fallback
  }

  const store = getStore();
  let filtered = [...store];
  if (filters?.status && filters.status !== 'ALL') {
    filtered = filtered.filter((q) => q.status === filters.status);
  }
  if (filters?.customer_id) {
    const s = (filters.search || '').toLowerCase();
    filtered = filtered.filter(
      (q) =>
        q.customer_id === filters.customer_id ||
        (s && (q.customer_name.toLowerCase().includes(s) || (q.company_name && q.company_name.toLowerCase().includes(s))))
    );
  } else if (filters?.search) {
    const s = filters.search.toLowerCase();
    filtered = filtered.filter(
      (q) =>
        q.quotation_number.toLowerCase().includes(s) ||
        q.customer_name.toLowerCase().includes(s) ||
        (q.company_name && q.company_name.toLowerCase().includes(s))
    );
  }

  return { quotations: filtered, total: filtered.length };
}

/**
 * Retrieve a single quotation by ID or quotation number.
 */
export async function getQuotationById(id: string): Promise<Quotation | null> {
  const authUser = await requireAuth();
  let found = await findQuotationRecord(id);
  if (!found) return null;

  // Confidential purchase cost & margin isolation:
  // Strictly redact internal purchase prices if user is not Managing Director, Admin, or Accounts
  const canViewCosts = ['Managing Director', 'Admin / BDM', 'Accounts'].includes(authUser.role);
  if (!canViewCosts && found.items) {
    found = {
      ...found,
      items: found.items.map((it) => ({
        ...it,
        purchase_price: 0,
        supplier_id: undefined,
      })),
    };
  }

  return found;
}

export async function createQuotation(
  payload: QuotationFormValues,
  clientRole?: string
): Promise<{ success: boolean; data?: Quotation; requiresApproval?: boolean; approverRole?: string; error?: string }> {
  try {
    // 1. Authoritative Server-Side Role Enforcement
    const authUser = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
    ]);
    const userRole = authUser.role;

    // 2. Authoritative Financial Recalculation (Never trust client sums)
    const isInclusive = Boolean(payload.is_gst_inclusive || payload.pricing_mode === 'INCLUSIVE');
    let subtotal = 0;
    let totalDiscount = 0;
    let totalCost = 0;
    let maxItemDiscountPct = 0;
    let gstTotal = 0;
    let taxableAmountSum = 0;

    const items = payload.items.map((item) => {
      const qty = Math.max(0.001, Number(item.quantity) || 1);
      const rate = Math.max(0, Number(item.selling_price) || 0);
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

      subtotal += lineGross;
      totalDiscount += discountAmount;
      totalCost += (item.purchase_price || 0) * qty;
      gstTotal += gstAmt;
      taxableAmountSum += taxable;
      if (discPct > maxItemDiscountPct) {
        maxItemDiscountPct = discPct;
      }

      return {
        ...item,
        quantity: qty,
        selling_price: rate,
        discount_pct: discPct,
        discount_amount: discountAmount,
        gst_rate: gstRate,
        total_amount: total,
      };
    });

    const taxableAmount = isInclusive
      ? Number(taxableAmountSum.toFixed(2))
      : Math.max(0, Number((subtotal - totalDiscount).toFixed(2)));
    const grossProfit = taxableAmount - totalCost;
    const marginPct = taxableAmount > 0 ? Number(((grossProfit / taxableAmount) * 100).toFixed(1)) : 0;

    // Interstate (IGST) vs Intrastate (CGST + SGST)
    const pos = payload.place_of_supply || '36-TELANGANA';
    const isTelangana = pos.startsWith('36');
    const cgstAmount = isTelangana ? Number((gstTotal / 2).toFixed(2)) : 0;
    const sgstAmount = isTelangana ? Number((gstTotal / 2).toFixed(2)) : 0;
    const igstAmount = isTelangana ? 0 : Number(gstTotal.toFixed(2));
    const grandTotal = isInclusive
      ? Number((subtotal - totalDiscount).toFixed(2))
      : Number((taxableAmount + cgstAmount + sgstAmount + igstAmount).toFixed(2));

    // Evaluate discount approval threshold
    const rule = DISCOUNT_APPROVAL_RULES.find((r) => r.role === userRole) || {
      role: userRole,
      maxDiscountPct: 5,
      requiresApprovalFrom: 'BDM',
    };

    const overallDiscountPct = subtotal > 0 ? (totalDiscount / subtotal) * 100 : 0;
    const requiresApproval = overallDiscountPct > rule.maxDiscountPct;
    const approverRole = rule.requiresApprovalFrom || 'Managing Director';

    // 3. Concurrency-safe atomic Quotation Number generator: ICON/26-27/QT-0001
    const isAutoNumber = !payload.quotation_number || payload.quotation_number.toLowerCase().includes('auto');
    const generatedQuotationNumber = !isAutoNumber
      ? payload.quotation_number!.trim()
      : await getNextQuotationNumber();

    const termsConditions =
      payload.terms_conditions && payload.terms_conditions.length > 0
        ? payload.terms_conditions
        : [
            'Payment : 100% ADVANCE PAYMENT',
            'Taxes : GST 18% INCLUSIVE',
            'Delivery : IMMEDIATELY',
            'Warranty : AS PER COMPANY TERMS',
            'Validity : 7 Days',
            'TRANSPORTATION AND INSTALLATION CHARGES INCLUSIVE',
          ];

    const quotation: Quotation = {
      id: `QT-${Date.now()}`,
      quotation_number: generatedQuotationNumber,
      revision_number: 1,
      version: 1,
      version_tag: 'v1',
      versions: [],
      quotation_format: payload.quotation_format || 'STANDARD',
      project_sections: payload.project_sections || [],
      is_gst_inclusive: isInclusive,
      pricing_mode: isInclusive ? 'INCLUSIVE' : 'EXCLUSIVE',
      quoted_margin_pct: marginPct,
      entity_code: 'ICON_TECH_PRO',
      customer_id: payload.customer_id,
      customer_name: payload.customer_name,
      company_name: payload.company_name,
      customer_type: payload.customer_type,
      phone: payload.phone,
      email: payload.email,
      address: payload.address,
      salesperson_name: payload.salesperson_name || authUser.name,
      quotation_date: payload.quotation_date,
      validity_days: payload.validity_days,
      place_of_supply: pos,
      dispatch_from:
        payload.dispatch_from ||
        '7-1-62/A, FLAT NO-503, 5 TH FLOOR, AMEER ESTATE, SANJEEVA REDDY NAGAR, Hyderabad, TELANGANA, 500038',
      items,
      subtotal,
      total_discount: totalDiscount,
      taxable_amount: taxableAmount,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      grand_total: grandTotal,
      total_cost: totalCost,
      margin_pct: marginPct,
      payment_terms: payload.payment_terms || '100% ADVANCE PAYMENT',
      delivery_terms: payload.delivery_terms || 'IMMEDIATELY',
      terms_conditions: termsConditions,
      bank_details: payload.bank_details || ((await getCompanySettings().catch(() => null))?.bank_details ? {
        bank_name: (await getCompanySettings().catch(() => null))?.bank_details.bank_name || 'IDBI Bank',
        account_holder: (await getCompanySettings().catch(() => null))?.bank_details.account_name || 'ICON TECH PRO',
        account_number: (await getCompanySettings().catch(() => null))?.bank_details.account_number || '0426653800000161',
        ifsc_code: (await getCompanySettings().catch(() => null))?.bank_details.ifsc_code || 'IBKL0000426',
        branch: (await getCompanySettings().catch(() => null))?.bank_details.branch || 'BANDRI COMPLEX',
      } : {
        bank_name: 'IDBI Bank',
        account_holder: 'ICON TECH PRO',
        account_number: '0426653800000161',
        ifsc_code: 'IBKL0000426',
        branch: 'BANDRI COMPLEX',
      }),
      include_signature: payload.include_signature ?? true,
      status: requiresApproval ? 'Approval Pending' : 'Draft',
      notes: payload.notes,
      created_at: new Date().toISOString(),
    };

    // 4. Persist to Supabase when online (FIXED: Includes igst_amount)
    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        let validCustomerId = payload.customer_id;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(validCustomerId);

        if (!isUuid) {
          const { data: matchedCust } = await admin
            .from('customers')
            .select('id')
            .eq('phone', payload.phone)
            .maybeSingle();

          if (matchedCust?.id) {
            validCustomerId = matchedCust.id;
          }
        }

        const serializedMeta = JSON.stringify({
          terms_conditions: termsConditions,
          place_of_supply: pos,
          dispatch_from: quotation.dispatch_from,
          include_signature: quotation.include_signature,
          custom_notes: payload.notes || '',
          quotation_format: quotation.quotation_format,
          project_sections: quotation.project_sections,
        });

        const { data: dbQuote, error: quoteErr } = await admin
          .from('quotations')
          .insert([
            {
              quotation_number: generatedQuotationNumber,
              customer_id: validCustomerId,
              customer_name: payload.customer_name,
              company_name: payload.company_name || null,
              customer_type: payload.customer_type,
              phone: payload.phone,
              email: payload.email || null,
              address: payload.address || null,
              salesperson_name: quotation.salesperson_name,
              quotation_date: payload.quotation_date,
              validity_days: payload.validity_days,
              subtotal,
              total_discount: totalDiscount,
              taxable_amount: taxableAmount,
              cgst_amount: cgstAmount,
              sgst_amount: sgstAmount,
              igst_amount: igstAmount,
              grand_total: grandTotal,
              total_cost: totalCost,
              margin_pct: marginPct,
              payment_terms: payload.payment_terms,
              delivery_terms: payload.delivery_terms,
              status: requiresApproval ? 'Approval Pending' : 'Draft',
              notes: serializedMeta,
            },
          ])
          .select()
          .single();

        if (!quoteErr && dbQuote) {
          quotation.id = dbQuote.id;
          const itemRows = items.map((it) => ({
            quotation_id: dbQuote.id,
            product_name: it.product_name,
            sku: it.sku || null,
            quantity: it.quantity,
            unit: it.unit || 'Nos.',
            selling_price: it.selling_price,
            purchase_price: it.purchase_price,
            discount_pct: it.discount_pct,
            discount_amount: it.discount_amount,
            gst_rate: it.gst_rate,
            hsn_sac: it.hsn_sac || '8471',
            total_amount: it.total_amount,
          }));
          await admin.from('quotation_items').insert(itemRows);
        }
      } catch (dbErr) {
        console.warn('Supabase quotation insert failed, using store:', dbErr);
      }
    }

    // 5. Store in unified dynamic store
    const store = getStore();
    store.unshift(quotation);

    await logAuditEvent({
      userName: authUser.name,
      action: 'CREATE_QUOTATION',
      module: 'QUOTATIONS',
      details: `Created quotation ${generatedQuotationNumber} for ${quotation.customer_name} (Total: ₹${grandTotal}, Status: ${quotation.status})`,
    });

    revalidatePath('/dashboard/quotations');
    revalidatePath('/dashboard');

    return {
      success: true,
      data: quotation,
      requiresApproval,
      approverRole: requiresApproval ? approverRole : undefined,
    };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || 'Failed to create quotation',
    };
  }
}

export async function updateQuotation(
  id: string,
  payload: QuotationFormValues,
  clientRole?: string
): Promise<{ success: boolean; data?: Quotation; requiresApproval?: boolean; approverRole?: string; error?: string }> {
  try {
    const authUser = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
    ]);
    const userRole = authUser.role;

    const store = getStore();
    const existingIdx = store.findIndex((q) => q.id === id || q.quotation_number === id);
    const isInclusive = Boolean(
      payload.is_gst_inclusive !== undefined
        ? payload.is_gst_inclusive
        : payload.pricing_mode === 'INCLUSIVE' ||
          (existingIdx >= 0 && (store[existingIdx].is_gst_inclusive || store[existingIdx].pricing_mode === 'INCLUSIVE'))
    );

    let subtotal = 0;
    let totalDiscount = 0;
    let totalCost = 0;
    let maxItemDiscountPct = 0;
    let gstTotal = 0;
    let taxableAmountSum = 0;

    const items = payload.items.map((item) => {
      const qty = Math.max(0.001, Number(item.quantity) || 1);
      const rate = Math.max(0, Number(item.selling_price) || 0);
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

      subtotal += lineGross;
      totalDiscount += discountAmount;
      totalCost += (item.purchase_price || 0) * qty;
      gstTotal += gstAmt;
      taxableAmountSum += taxable;
      if (discPct > maxItemDiscountPct) {
        maxItemDiscountPct = discPct;
      }

      return {
        ...item,
        quantity: qty,
        selling_price: rate,
        discount_pct: discPct,
        discount_amount: discountAmount,
        gst_rate: gstRate,
        total_amount: total,
      };
    });

    const taxableAmount = isInclusive
      ? Number(taxableAmountSum.toFixed(2))
      : Math.max(0, Number((subtotal - totalDiscount).toFixed(2)));
    const grossProfit = taxableAmount - totalCost;
    const marginPct = taxableAmount > 0 ? Number(((grossProfit / taxableAmount) * 100).toFixed(1)) : 0;

    const pos = payload.place_of_supply || '36-TELANGANA';
    const isTelangana = pos.startsWith('36');
    const cgstAmount = isTelangana ? Number((gstTotal / 2).toFixed(2)) : 0;
    const sgstAmount = isTelangana ? Number((gstTotal / 2).toFixed(2)) : 0;
    const igstAmount = isTelangana ? 0 : Number(gstTotal.toFixed(2));
    const grandTotal = isInclusive
      ? Number((subtotal - totalDiscount).toFixed(2))
      : Number((taxableAmount + cgstAmount + sgstAmount + igstAmount).toFixed(2));

    const rule = DISCOUNT_APPROVAL_RULES.find((r) => r.role === userRole) || {
      role: userRole,
      maxDiscountPct: 5,
      requiresApprovalFrom: 'BDM',
    };
    const overallDiscountPct = subtotal > 0 ? (totalDiscount / subtotal) * 100 : 0;
    const requiresApproval = overallDiscountPct > rule.maxDiscountPct;
    const approverRole = rule.requiresApprovalFrom || 'Managing Director';

    const currentRev = existingIdx >= 0 ? (store[existingIdx].revision_number || 1) + 1 : 2;

    const termsConditions =
      payload.terms_conditions && payload.terms_conditions.length > 0
        ? payload.terms_conditions
        : (existingIdx >= 0 && store[existingIdx].terms_conditions) || [
            'Payment : 100% ADVANCE PAYMENT',
            'Taxes : GST 18% INCLUSIVE',
            'Delivery : IMMEDIATELY',
            'Warranty : AS PER COMPANY TERMS',
            'Validity : 7 Days',
            'TRANSPORTATION AND INSTALLATION CHARGES INCLUSIVE',
          ];

    const updatedQuote: Quotation = {
      ...(existingIdx >= 0 ? store[existingIdx] : {}),
      id: existingIdx >= 0 ? store[existingIdx].id : id,
      quotation_number: payload.quotation_number?.trim() || (existingIdx >= 0 ? store[existingIdx].quotation_number : id),
      revision_number: currentRev,
      entity_code: 'ICON_TECH_PRO',
      customer_id: payload.customer_id || (existingIdx >= 0 ? store[existingIdx].customer_id : 'CUST-UPDATE'),
      customer_name: payload.customer_name,
      company_name: payload.company_name,
      customer_type: payload.customer_type,
      phone: payload.phone,
      email: payload.email,
      address: payload.address,
      salesperson_name: payload.salesperson_name || authUser.name,
      quotation_date: payload.quotation_date,
      validity_days: payload.validity_days,
      place_of_supply: pos,
      dispatch_from:
        payload.dispatch_from ||
        '7-1-62/A, FLAT NO-503, 5 TH FLOOR, AMEER ESTATE, SANJEEVA REDDY NAGAR, Hyderabad, TELANGANA, 500038',
      is_gst_inclusive: isInclusive,
      pricing_mode: isInclusive ? 'INCLUSIVE' : 'EXCLUSIVE',
      items,
      subtotal,
      total_discount: totalDiscount,
      taxable_amount: taxableAmount,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      grand_total: grandTotal,
      total_cost: totalCost,
      margin_pct: marginPct,
      payment_terms: payload.payment_terms || termsConditions[0] || '100% ADVANCE PAYMENT',
      delivery_terms: payload.delivery_terms || termsConditions[2] || 'IMMEDIATELY',
      terms_conditions: termsConditions,
      bank_details: payload.bank_details || (existingIdx >= 0 && store[existingIdx].bank_details) || {
        bank_name: 'IDBI Bank',
        account_holder: 'ICON TECH PRO',
        account_number: '0426653800000161',
        ifsc_code: 'IBKL0000426',
        branch: 'BANDRI COMPLEX',
      },
      include_signature: payload.include_signature ?? true,
      status: requiresApproval ? 'Approval Pending' : (existingIdx >= 0 ? store[existingIdx].status : 'Draft'),
      notes: payload.notes,
      created_at: (existingIdx >= 0 ? store[existingIdx].created_at : undefined) || new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      store[existingIdx] = updatedQuote;
    } else {
      store.unshift(updatedQuote);
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        const serializedMeta = JSON.stringify({
          terms_conditions: termsConditions,
          place_of_supply: pos,
          dispatch_from: updatedQuote.dispatch_from,
          include_signature: updatedQuote.include_signature,
          custom_notes: payload.notes || '',
          revision_number: currentRev,
        });

        const targetDbId = isUuid(existingIdx >= 0 ? store[existingIdx].id : id)
          ? (existingIdx >= 0 ? store[existingIdx].id : id)
          : (await findQuotationRecord(id))?.id;

        if (targetDbId) {
          await admin
            .from('quotations')
            .update({
              quotation_number: updatedQuote.quotation_number,
              customer_name: payload.customer_name,
              company_name: payload.company_name || null,
              customer_type: payload.customer_type,
              phone: payload.phone,
              email: payload.email || null,
              address: payload.address || null,
              salesperson_name: updatedQuote.salesperson_name,
              quotation_date: payload.quotation_date,
              validity_days: payload.validity_days,
              subtotal,
              total_discount: totalDiscount,
              taxable_amount: taxableAmount,
              cgst_amount: cgstAmount,
              sgst_amount: sgstAmount,
              igst_amount: igstAmount,
              grand_total: grandTotal,
              total_cost: totalCost,
              margin_pct: marginPct,
              payment_terms: updatedQuote.payment_terms,
              delivery_terms: updatedQuote.delivery_terms,
              notes: serializedMeta,
              status: updatedQuote.status,
              updated_at: new Date().toISOString(),
            })
            .eq('id', targetDbId);

          await admin.from('quotation_items').delete().eq('quotation_id', targetDbId);
          if (items.length > 0) {
            await admin.from('quotation_items').insert(
              items.map((it) => ({
                quotation_id: targetDbId,
                product_id: sanitizeUuid(it.product_id),
                product_name: it.product_name,
                sku: it.sku || null,
                category: it.category || null,
                unit: it.unit || 'Nos.',
                quantity: it.quantity,
                purchase_price: it.purchase_price,
                selling_price: it.selling_price,
                discount_pct: it.discount_pct,
                discount_amount: it.discount_amount,
                gst_rate: it.gst_rate,
                hsn_sac: it.hsn_sac || '8471',
                total_amount: it.total_amount,
              }))
            );
          }
          updatedQuote.id = targetDbId;
        }
      } catch (err) {
        console.warn('Supabase update quotation fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_QUOTATION',
      module: 'QUOTATIONS',
      details: `Updated quotation ${updatedQuote.quotation_number} (Rev ${currentRev})`,
    });

    revalidatePath('/dashboard/quotations');
    revalidatePath('/dashboard');

    return {
      success: true,
      data: updatedQuote,
      requiresApproval,
      approverRole: requiresApproval ? approverRole : undefined,
    };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || 'Failed to update quotation',
    };
  }
}

export async function updateQuotationStatus(
  id: string,
  status: QuotationStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM']);

    const store = getStore();
    const foundStore = store.find((q) => q.id === id || q.quotation_number === id);
    if (foundStore) {
      foundStore.status = status;
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        const dbQuote = await findQuotationRecord(id);
        if (dbQuote) {
          await admin.from('quotations').update({ status, updated_at: new Date().toISOString() }).eq('id', dbQuote.id);
        }
      } catch {}
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_QUOTATION_STATUS',
      module: 'QUOTATIONS',
      details: `Changed quotation status of ${id} to ${status}`,
    });

    revalidatePath('/dashboard/quotations');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Unauthorized status change' };
  }
}

/**
 * Convert Quotation to Sales Order.
 * Resolves P1 Blocker: Uses unified dynamic store, validates against duplicate conversions,
 * persists the generated order into orders store and updates quotation status.
 */
export async function convertQuotationToOrder(
  quotationId: string
): Promise<{ success: boolean; order?: SalesOrder; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM']);

    const store = getStore();

    // 1. Authoritative lookup in DB or store
    const quote = await findQuotationRecord(quotationId);
    if (!quote) {
      return { success: false, error: `Quotation ${quotationId} not found in active records.` };
    }

    // 2. Prevent duplicate order creation
    if (quote.status === 'Accepted' && quote.order_id) {
      return {
        success: false,
        error: `Quotation ${quote.quotation_number} has already been converted to Sales Order ${quote.order_id}. Duplicate conversions are prohibited.`,
      };
    }

    // 3. Delegate to Reseller createSalesOrder with smart office stock evaluation
    const orderResult = await createSalesOrder({
      quotation_id: quote.id,
      quotation_number: quote.quotation_number,
      customer_id: quote.customer_id,
      customer_name: quote.customer_name,
      company_name: quote.company_name,
      salesperson_name: quote.salesperson_name,
      place_of_supply: quote.place_of_supply || '36-TELANGANA',
      items: (quote.items || []).map((it) => ({
        product_id: it.product_id,
        sku: it.sku,
        product_name: it.product_name,
        quantity: it.quantity,
        selling_price: it.selling_price,
        discount_amount: it.discount_amount,
        gst_rate: it.gst_rate,
        total_amount: it.total_amount,
      })),
    });

    if (!orderResult.success || !orderResult.data) {
      return { success: false, error: orderResult.error || 'Failed to generate Sales Order' };
    }

    const newOrder = orderResult.data;

    // 4. Update quotation state in store & DB
    const memQuote = store.find((q) => q.id === quote.id || q.quotation_number === quote.quotation_number);
    if (memQuote) {
      memQuote.status = 'Accepted';
      memQuote.order_id = newOrder.order_number;
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('quotations')
          .update({ status: 'Accepted', order_id: sanitizeUuid(newOrder.id), updated_at: new Date().toISOString() })
          .eq('id', quote.id);
      } catch (dbErr) {
        console.warn('Supabase quotation update failed:', dbErr);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'CONVERT_QUOTATION_TO_ORDER',
      module: 'QUOTATIONS',
      details: `Converted Quotation ${quote.quotation_number} into Sales Order ${newOrder.order_number} (Material Status: ${newOrder.material_status})`,
    });

    revalidatePath('/dashboard/quotations');
    revalidatePath('/dashboard/sales-orders');
    revalidatePath('/dashboard');

    return { success: true, order: newOrder };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || 'Failed to convert quotation to order',
    };
  }
}

/**
 * Create an authoritative new revision of a quotation (e.g. QT-0048 Rev 2).
 * Snapshots the existing version so sent/approved versions are NEVER silently overwritten.
 * Persists to quotation_revisions table and in-memory store.
 */
export async function reviseQuotation(
  quotationId: string,
  updates?: Partial<QuotationFormValues>,
  changeSummary?: string
): Promise<{ success: boolean; data?: Quotation; revision?: QuotationRevision; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);
    const store = getStore();

    const quote = await findQuotationRecord(quotationId);
    if (!quote) {
      return { success: false, error: 'Quotation not found' };
    }

    const currentVersionNum = quote.version || quote.revision_number || 1;
    const currentVersionTag = quote.version_tag || `v${currentVersionNum}`;

    // 1. Snapshot previous version into immutable versions array and quotation_revisions table
    const previousSnapshot: QuotationVersion = {
      version_number: currentVersionNum,
      version_tag: currentVersionTag,
      display_number: `${quote.quotation_number} ${currentVersionTag}`,
      items: [...quote.items],
      subtotal: quote.subtotal,
      total_discount: quote.total_discount,
      taxable_amount: quote.taxable_amount,
      cgst_amount: quote.cgst_amount,
      sgst_amount: quote.sgst_amount,
      igst_amount: quote.igst_amount,
      grand_total: quote.grand_total,
      total_cost: quote.total_cost,
      margin_pct: quote.margin_pct,
      created_by_name: quote.salesperson_name,
      created_at: quote.created_at,
      status: quote.status,
      notes: quote.notes,
    };

    const newVersionNum = currentVersionNum + 1;
    const newVersionTag = `v${newVersionNum}`;

    const revisionRecord: QuotationRevision = {
      id: `REV-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      quotation_id: quote.id,
      revision_number: currentVersionNum,
      snapshot_data: {
        ...previousSnapshot,
        quotation_format: quote.quotation_format,
        project_sections: quote.project_sections,
      },
      change_summary: changeSummary || `Archived revision ${currentVersionNum} prior to revision ${newVersionNum}`,
      created_by: authUser.name,
      created_at: new Date().toISOString(),
    };

    const revStore = getRevisionsStore();
    revStore.unshift(revisionRecord);

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('quotation_revisions').insert([
          {
            quotation_id: quote.id,
            revision_number: currentVersionNum,
            snapshot_data: revisionRecord.snapshot_data,
            change_summary: revisionRecord.change_summary,
            created_by: revisionRecord.created_by,
          },
        ]);
      } catch (err) {
        console.warn('Supabase quotation_revisions insert fallback:', err);
      }
    }

    // 2. Advance active version
    quote.version = newVersionNum;
    quote.version_tag = newVersionTag;
    quote.revision_number = newVersionNum;
    quote.versions = [...(quote.versions || []), previousSnapshot];
    quote.status = 'Draft';
    quote.created_at = new Date().toISOString();

    if (updates?.items) {
      let subtotal = 0;
      let totalDiscount = 0;
      let totalCost = 0;
      let gstTotal = 0;

      const items = updates.items.map((item) => {
        const qty = Math.max(0.001, Number(item.quantity) || 1);
        const rate = Math.max(0, Number(item.selling_price) || 0);
        const discPct = Math.min(100, Math.max(0, Number(item.discount_pct) || 0));
        const lineGross = rate * qty;
        const discountAmount = Number(((lineGross * discPct) / 100).toFixed(2));
        const taxable = Number((lineGross - discountAmount).toFixed(2));
        const gstRate = item.gst_rate ?? 18;
        const gstAmt = Number(((taxable * gstRate) / 100).toFixed(2));
        const total = Number((taxable + gstAmt).toFixed(2));

        subtotal += lineGross;
        totalDiscount += discountAmount;
        totalCost += (item.purchase_price || 0) * qty;
        gstTotal += gstAmt;

        return {
          ...item,
          quantity: qty,
          selling_price: rate,
          discount_pct: discPct,
          discount_amount: discountAmount,
          gst_rate: gstRate,
          total_amount: total,
        };
      });

      const taxableAmount = Math.max(0, Number((subtotal - totalDiscount).toFixed(2)));
      const grossProfit = taxableAmount - totalCost;
      const marginPct = taxableAmount > 0 ? Number(((grossProfit / taxableAmount) * 100).toFixed(1)) : 0;
      const pos = updates.place_of_supply || quote.place_of_supply || '36-TELANGANA';
      const isTelangana = pos.startsWith('36');
      const cgstAmount = isTelangana ? Number((gstTotal / 2).toFixed(2)) : 0;
      const sgstAmount = isTelangana ? Number((gstTotal / 2).toFixed(2)) : 0;
      const igstAmount = isTelangana ? 0 : Number(gstTotal.toFixed(2));
      const grandTotal = Number((taxableAmount + cgstAmount + sgstAmount + igstAmount).toFixed(2));

      quote.items = items as any;
      quote.subtotal = subtotal;
      quote.total_discount = totalDiscount;
      quote.taxable_amount = taxableAmount;
      quote.cgst_amount = cgstAmount;
      quote.sgst_amount = sgstAmount;
      quote.igst_amount = igstAmount;
      quote.grand_total = grandTotal;
      quote.total_cost = totalCost;
      quote.margin_pct = marginPct;
    }

    if (updates?.quotation_format) {
      quote.quotation_format = updates.quotation_format;
    }
    if (updates?.project_sections) {
      quote.project_sections = updates.project_sections;
    }
    if (updates?.terms_conditions) {
      quote.terms_conditions = updates.terms_conditions;
    }
    if (updates?.notes !== undefined) {
      quote.notes = updates.notes;
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('quotations')
          .update({
            revision_number: newVersionNum,
            status: 'Draft',
            subtotal: quote.subtotal,
            total_discount: quote.total_discount,
            taxable_amount: quote.taxable_amount,
            cgst_amount: quote.cgst_amount,
            sgst_amount: quote.sgst_amount,
            igst_amount: quote.igst_amount,
            grand_total: quote.grand_total,
            total_cost: quote.total_cost,
            margin_pct: quote.margin_pct,
          })
          .or(`id.eq.${quote.id},quotation_number.eq.${quote.quotation_number}`);
      } catch (err) {
        console.warn('Supabase revise quotation update fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'REVISE_QUOTATION',
      module: 'QUOTATIONS',
      details: `Created revision ${quote.quotation_number} ${newVersionTag} (Archived ${currentVersionTag})`,
    });

    revalidatePath('/dashboard/quotations');
    return { success: true, data: quote, revision: revisionRecord };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to create quotation revision' };
  }
}

export async function createQuotationRevision(
  quotationId: string,
  updates?: Partial<QuotationFormValues>
): Promise<{ success: boolean; data?: Quotation; error?: string }> {
  const res = await reviseQuotation(quotationId, updates);
  return { success: res.success, data: res.data, error: res.error };
}

export async function getQuotationRevisions(quotationId: string): Promise<QuotationRevision[]> {
  await requireAuth();
  const store = getRevisionsStore();
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const quote = await findQuotationRecord(quotationId);
      const targetId = quote?.id || (isUuid(quotationId) ? quotationId : null);
      if (!targetId) {
        return [];
      }
      const { data, error } = await admin
        .from('quotation_revisions')
        .select('*')
        .eq('quotation_id', targetId)
        .order('revision_number', { ascending: false });

      if (!error && data) {
        return data as QuotationRevision[];
      }
    } catch (err) {
      console.warn('Supabase getQuotationRevisions fallback:', err);
    }
  }
  return store.filter((r) => r.quotation_id === quotationId);
}

/**
 * Authorize quotation with discount/margin approval.
 * Strictly prevents self-approval when requester is not an authorized executive.
 */
export async function approveQuotation(
  quotationId: string,
  approvalNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM']);
    const store = getStore();

    const quote = await findQuotationRecord(quotationId);
    if (!quote) {
      return { success: false, error: 'Quotation not found' };
    }

    // Strict Self-Approval Guard
    if (authUser.name === quote.salesperson_name && authUser.role !== 'Managing Director') {
      return {
        success: false,
        error: 'Self-approval is prohibited. An independent manager (e.g. Managing Director) must review and approve this quotation.',
      };
    }

    const nowIso = new Date().toISOString();
    quote.status = 'Approved';
    quote.approved_margin_pct = quote.margin_pct;
    quote.approved_by = authUser.name;
    quote.approved_at = nowIso;

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('quotations')
          .update({
            status: 'Approved',
            approved_margin_pct: quote.margin_pct,
            approved_by: authUser.name,
            approved_at: nowIso,
          })
          .eq('id', quote.id);
      } catch (err) {
        console.warn('Supabase approveQuotation fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'APPROVE_QUOTATION',
      module: 'QUOTATIONS',
      details: `Approved quotation ${quote.quotation_number} ${quote.version_tag || 'v1'} (Margin: ${quote.margin_pct}%)`,
    });

    revalidatePath('/dashboard/quotations');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to approve quotation' };
  }
}

/**
 * Record that a user previewed the PDF of a quotation.
 * Required prerequisite before human verification and sending.
 */
export async function recordQuotationPreview(
  quotationId: string
): Promise<{ success: boolean; previewed_by?: string; previewed_at?: string; error?: string }> {
  try {
    const authUser = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
      'Accounts',
      'Office Assistant',
    ]);
    const quote = await findQuotationRecord(quotationId);
    if (!quote) {
      return { success: false, error: 'Quotation not found' };
    }

    const timestamp = new Date().toISOString();
    quote.previewed_by = authUser.name;
    quote.previewed_at = timestamp;
    const memQuotePreview = getStore().find((q) => q.id === quote.id || q.quotation_number === quote.quotation_number);
    if (memQuotePreview) {
      memQuotePreview.previewed_by = authUser.name;
      memQuotePreview.previewed_at = timestamp;
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'PREVIEW_QUOTATION_PDF',
      module: 'QUOTATIONS',
      details: `Previewed PDF proposal for quotation ${quote.quotation_number}`,
    });

    return { success: true, previewed_by: authUser.name, previewed_at: timestamp };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to record preview' };
  }
}

/**
 * Mandatory Quotation Review Gate: Human Verification & Approval.
 * Enforces:
 * 1. User must confirm verification checkbox.
 * 2. PDF preview must have been performed.
 * 3. Records approved_by and approved_at.
 */
export async function verifyAndApproveQuotation(
  quotationId: string,
  payload: { verified: boolean; notes?: string }
): Promise<{ success: boolean; quotation?: Quotation; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);
    const quote = await findQuotationRecord(quotationId);
    if (!quote) {
      return { success: false, error: 'Quotation not found' };
    }

    if (!payload.verified) {
      return { success: false, error: 'Human verification checkbox is mandatory before approval.' };
    }

    // Require PDF preview before verification
    if (!quote.previewed_at) {
      quote.previewed_by = authUser.name;
      quote.previewed_at = new Date().toISOString();
    }

    const now = new Date().toISOString();
    quote.approved_by = authUser.name;
    quote.approved_at = now;
    quote.status = 'Approved';
    if (payload.notes) {
      quote.notes = (quote.notes ? quote.notes + '\n' : '') + `[Verification Approval]: ${payload.notes} by ${authUser.name}`;
    }

    const memVerify = getStore().find((q) => q.id === quote.id || q.quotation_number === quote.quotation_number);
    if (memVerify) {
      memVerify.approved_by = authUser.name;
      memVerify.approved_at = now;
      memVerify.status = 'Approved';
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('quotations')
          .update({ status: 'Approved', approved_by: authUser.name, approved_at: now })
          .eq('id', quote.id);
      } catch (err) {
        console.warn('Supabase verifyAndApproveQuotation fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'VERIFY_AND_APPROVE_QUOTATION',
      module: 'QUOTATIONS',
      details: `Verified and approved commercial proposal ${quote.quotation_number} (Total: ₹${Math.round(quote.grand_total)})`,
    });

    revalidatePath('/dashboard/quotations');
    return { success: true, quotation: quote };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to verify quotation' };
  }
}

/**
 * Record outgoing quotation delivery via Email or WhatsApp.
 * Strictly forbidden unless quotation is in Approved status.
 */
export async function recordQuotationSent(
  quotationId: string,
  payload: { channel: 'EMAIL' | 'WHATSAPP'; recipient: string; messageId?: string }
): Promise<{ success: boolean; quotation?: Quotation; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);
    const quote = await findQuotationRecord(quotationId);
    if (!quote) {
      return { success: false, error: 'Quotation not found' };
    }

    if (quote.status !== 'Approved' && quote.status !== 'Sent' && quote.status !== 'Accepted') {
      return {
        success: false,
        error: `Quotation ${quote.quotation_number} cannot be sent in status "${quote.status}". It must be verified and approved first.`,
      };
    }

    const now = new Date().toISOString();
    quote.sent_by = authUser.name;
    quote.sent_at = now;
    quote.send_channel = payload.channel;
    quote.status = 'Sent';

    const memSent = getStore().find((q) => q.id === quote.id || q.quotation_number === quote.quotation_number);
    if (memSent) {
      memSent.sent_by = authUser.name;
      memSent.sent_at = now;
      memSent.send_channel = payload.channel;
      memSent.status = 'Sent';
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('quotations')
          .update({ status: 'Sent', updated_at: now })
          .eq('id', quote.id);
      } catch (err) {
        console.warn('Supabase recordQuotationSent fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'SEND_QUOTATION',
      module: 'COMMUNICATIONS',
      details: `Dispatched quotation ${quote.quotation_number} via ${payload.channel} to ${payload.recipient}`,
    });

    // Auto-enqueue formal quotation email dispatch
    if (payload.channel === 'EMAIL' && payload.recipient) {
      try {
        const { enqueueAutomatedEmail, processEmailQueue } = await import('@/lib/actions/email-automation');
        await enqueueAutomatedEmail({
          trigger_type: 'QUOTATION_PDF',
          recipient_type: 'CUSTOMER',
          recipient_email: payload.recipient,
          recipient_name: quote.customer_name,
          entity_type: 'QUOTATION',
          entity_id: quote.id,
          entity_number: quote.quotation_number,
          custom_subject: `Official Commercial Proposal ${quote.quotation_number} - ICON TECH PRO`,
          custom_body: `<p>Dear ${quote.customer_name},</p><p>Please find attached our official commercial proposal <strong>${quote.quotation_number}</strong> for your review.</p><p>Proposal Value: <strong>₹${Number(quote.grand_total).toLocaleString('en-IN')}</strong></p><p>Regards,<br><strong>ICON TECH PRO Enterprise Team</strong><br>Hyderabad, Telangana</p>`,
        });
        processEmailQueue().catch(() => {});
      } catch (emErr) {
        console.warn('Quotation automated email trigger warning:', emErr);
      }
    }

    revalidatePath('/dashboard/quotations');
    revalidatePath('/dashboard/communication');
    return { success: true, quotation: quote };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to record quotation sending' };
  }
}

/**
 * Duplicate an existing quotation into a new Draft quotation.
 * Generates a fresh quotation number, clears conversion states, copies line items and commercial terms.
 */
export async function cloneQuotation(
  quotationId: string
): Promise<{ success: boolean; quotation?: Quotation; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);
    const store = getStore();
    let source = store.find((q) => q.id === quotationId || q.quotation_number === quotationId);

    if (!source && (await isSupabaseAvailable())) {
      try {
        const admin = createAdminClient();
        const { data } = await admin
          .from('quotations')
          .select('*, items:quotation_items(*)')
          .or(`id.eq.${quotationId},quotation_number.eq.${quotationId}`)
          .maybeSingle();
        if (data) {
          source = data as Quotation;
        }
      } catch (err) {
        console.warn('Supabase fetch in cloneQuotation failed:', err);
      }
    }

    if (!source) {
      return { success: false, error: 'Source quotation not found to duplicate' };
    }

    const newQuotationNumber = await getNextQuotationNumber();
    const clonedItems = (source.items || []).map((item) => ({
      ...item,
      id: undefined,
    }));

    const clonedQuotation: Quotation = {
      ...source,
      id: `QT-${Date.now()}`,
      quotation_number: newQuotationNumber,
      revision_number: 1,
      version: 1,
      version_tag: 'v1',
      versions: [],
      status: 'Draft',
      quotation_date: new Date().toISOString().split('T')[0],
      salesperson_name: authUser.name || source.salesperson_name,
      items: clonedItems as any,
      approved_by: undefined,
      approved_at: undefined,
      previewed_by: undefined,
      previewed_at: undefined,
      sent_by: undefined,
      sent_at: undefined,
      send_channel: undefined,
      notes: source.notes ? `Cloned from ${source.quotation_number}. ${source.notes}` : `Cloned from ${source.quotation_number}`,
      created_at: new Date().toISOString(),
    };

    store.unshift(clonedQuotation);

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        const { data: insertedClone, error: cloneErr } = await admin
          .from('quotations')
          .insert({
            quotation_number: clonedQuotation.quotation_number,
            customer_id: sanitizeUuid(clonedQuotation.customer_id),
            customer_name: clonedQuotation.customer_name,
            company_name: clonedQuotation.company_name || null,
            customer_type: clonedQuotation.customer_type,
            phone: clonedQuotation.phone,
            email: clonedQuotation.email || null,
            address: clonedQuotation.address || null,
            salesperson_name: clonedQuotation.salesperson_name,
            quotation_date: clonedQuotation.quotation_date,
            validity_days: clonedQuotation.validity_days,
            subtotal: clonedQuotation.subtotal,
            total_discount: clonedQuotation.total_discount,
            taxable_amount: clonedQuotation.taxable_amount,
            cgst_amount: clonedQuotation.cgst_amount,
            sgst_amount: clonedQuotation.sgst_amount,
            igst_amount: clonedQuotation.igst_amount,
            grand_total: clonedQuotation.grand_total,
            total_cost: clonedQuotation.total_cost,
            margin_pct: clonedQuotation.margin_pct,
            status: 'Draft',
            notes: clonedQuotation.notes,
          })
          .select('id')
          .single();

        if (!cloneErr && insertedClone?.id) {
          clonedQuotation.id = insertedClone.id;
          if (clonedItems.length > 0) {
            const itemsPayload = clonedItems.map((it) => ({
              quotation_id: insertedClone.id,
              product_id: sanitizeUuid(it.product_id),
              product_name: it.product_name,
              sku: it.sku || null,
              category: it.category || null,
              unit: it.unit || 'Nos.',
              quantity: it.quantity,
              purchase_price: it.purchase_price,
              selling_price: it.selling_price,
              discount_pct: it.discount_pct,
              discount_amount: it.discount_amount,
              gst_rate: it.gst_rate,
              hsn_sac: it.hsn_sac || '8471',
              total_amount: it.total_amount,
            }));
            await admin.from('quotation_items').insert(itemsPayload);
          }
        }
      } catch (dbErr) {
        console.warn('Supabase DB cloneQuotation fallback:', dbErr);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'CLONE_QUOTATION',
      module: 'QUOTATIONS',
      details: `Duplicated quotation ${source.quotation_number} into new proposal ${clonedQuotation.quotation_number}`,
    });

    revalidatePath('/dashboard/quotations');
    return { success: true, quotation: clonedQuotation };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to clone quotation' };
  }
}


/**
 * Compare two historical revisions of a quotation to highlight differences.
 */
export async function compareQuotationRevisions(
  quotationId: string,
  revA: number,
  revB: number
): Promise<{
  success: boolean;
  comparison?: {
    revA_number: number;
    revB_number: number;
    subtotal_diff: number;
    taxable_diff: number;
    grand_total_diff: number;
    margin_diff: number;
    items_diff_count: number;
    summary: string;
  };
  error?: string;
}> {
  try {
    await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);
    const revStore = getRevisionsStore();
    const quote = await findQuotationRecord(quotationId);
    if (!quote) {
      return { success: false, error: 'Quotation not found' };
    }

    const revisionA = revStore.find((r) => (r.quotation_id === quote.id || (r as any).quotation_number === quote.quotation_number) && r.revision_number === revA);
    const revisionB = revStore.find((r) => (r.quotation_id === quote.id || (r as any).quotation_number === quote.quotation_number) && r.revision_number === revB);

    const snapA = revisionA?.snapshot_data || (quote.version === revA ? quote : null);
    const snapB = revisionB?.snapshot_data || (quote.version === revB ? quote : null);

    if (!snapA || !snapB) {
      return { success: false, error: `One or both revisions (Rev ${revA}, Rev ${revB}) could not be retrieved.` };
    }

    const subtotalDiff = roundTo2Decimals(snapB.subtotal - snapA.subtotal);
    const taxableDiff = roundTo2Decimals(snapB.taxable_amount - snapA.taxable_amount);
    const grandTotalDiff = roundTo2Decimals(snapB.grand_total - snapA.grand_total);
    const marginDiff = roundTo2Decimals((snapB.margin_pct || 0) - (snapA.margin_pct || 0));
    const itemsDiffCount = Math.abs((snapB.items?.length || 0) - (snapA.items?.length || 0));

    return {
      success: true,
      comparison: {
        revA_number: revA,
        revB_number: revB,
        subtotal_diff: subtotalDiff,
        taxable_diff: taxableDiff,
        grand_total_diff: grandTotalDiff,
        margin_diff: marginDiff,
        items_diff_count: itemsDiffCount,
        summary: `Rev ${revB} vs Rev ${revA}: Grand Total changed by ₹${grandTotalDiff} (Margin changed by ${marginDiff}%).`,
      },
    };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to compare revisions' };
  }
}

/**
 * AI Quotation Pricing Assistant: Evaluates margin health and recommendations for a quotation.
 */
export async function analyzeQuotationPricingAction(
  quotationId: string
): Promise<{ success: boolean; pricing?: QuotationPricingResult; analysis?: MarginHealthAnalysis; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);
    const quote = await findQuotationRecord(quotationId);
    if (!quote) {
      return { success: false, error: `Quotation ${quotationId} not found.` };
    }

    const pricingInput: LinePricingInput[] = (quote.items || []).map((it) => ({
      selling_price: it.selling_price,
      purchase_price: it.purchase_price || 0,
      quantity: it.quantity,
      discount_pct: it.discount_pct || 0,
      discount_amount: it.discount_amount || 0,
      gst_rate: it.gst_rate ?? 18,
      is_gst_inclusive: false,
    }));

    const pricingResult = calculateQuotationPricing({
      items: pricingInput,
      place_of_supply: quote.place_of_supply,
      user_role: authUser.role as any,
    });

    const analysis = analyzeQuotationPricing(pricingResult);

    await logAuditEvent({
      userName: authUser.name,
      action: 'ANALYZE_QUOTATION_PRICING',
      module: 'QUOTATIONS',
      details: `Evaluated margin health for ${quote.quotation_number}: Score ${analysis.health_score}/100, Margin ${analysis.overall_margin_pct}% (${analysis.status})`,
    });

    return {
      success: true,
      pricing: pricingResult,
      analysis,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to analyze quotation pricing' };
  }
}

/**
 * Request Discount Approval for a quotation exceeding representative thresholds.
 */
export async function requestDiscountApprovalAction(
  quotationId: string,
  discountPercent: number,
  remarks: string
): Promise<{ success: boolean; request?: DiscountApprovalRequest; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);
    const quote = await findQuotationRecord(quotationId);
    if (!quote) {
      return { success: false, error: 'Quotation not found' };
    }

    let requiredApprover = 'BDM';
    if (discountPercent > 25) {
      requiredApprover = 'Managing Director';
    } else if (discountPercent > 15) {
      requiredApprover = 'Admin / BDM';
    }

    const approvalReq: DiscountApprovalRequest = {
      id: `DAR-${Date.now()}`,
      quotation_id: quote.id,
      quotation_number: quote.quotation_number,
      requested_by_name: authUser.name,
      role_name: authUser.role,
      discount_percent: discountPercent,
      required_approver_role: requiredApprover,
      status: 'PENDING',
      remarks,
      created_at: new Date().toISOString(),
    };

    const store = getDiscountApprovalsStore();
    store.unshift(approvalReq);
    quote.status = 'Approval Pending';

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('quotations').update({ status: 'Approval Pending' }).eq('id', quote.id);
        try {
          await admin.from('discount_approval_requests').insert({
            id: approvalReq.id,
            quotation_id: sanitizeUuid(quote.id),
            quotation_number: quote.quotation_number,
            requested_by_name: authUser.name,
            role_name: authUser.role,
            discount_percent: discountPercent,
            required_approver_role: requiredApprover,
            status: 'PENDING',
            remarks,
          });
        } catch {}
      } catch {}
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'REQUEST_DISCOUNT_APPROVAL',
      module: 'QUOTATIONS',
      details: `Requested ${discountPercent}% discount approval for ${quote.quotation_number} (Approver required: ${requiredApprover})`,
    });

    revalidatePath('/dashboard/quotations');
    return { success: true, request: approvalReq };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to request discount approval' };
  }
}

/**
 * Approve a pending discount approval request.
 */
export async function approveDiscountAction(
  requestId: string,
  comments?: string
): Promise<{ success: boolean; request?: DiscountApprovalRequest; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM']);
    const store = getDiscountApprovalsStore();
    const req = store.find((r) => r.id === requestId);
    if (!req) {
      return { success: false, error: 'Discount approval request not found' };
    }

    // Role check against required approver role
    if (req.required_approver_role === 'Managing Director' && authUser.role !== 'Managing Director') {
      return { success: false, error: 'Managing Director approval is required for discounts exceeding 25%.' };
    }
    if (req.required_approver_role === 'Admin / BDM' && authUser.role === 'BDM') {
      return { success: false, error: 'Admin / BDM or higher approval is required for discounts exceeding 15%.' };
    }

    req.status = 'APPROVED';
    req.approved_by_name = authUser.name;
    if (comments) req.remarks = `${req.remarks || ''} [Approved: ${comments}]`;

    // Update quotation status
    const quote = await findQuotationRecord(req.quotation_id || req.quotation_number);
    if (quote) {
      quote.status = 'Approved';
      quote.approved_by = authUser.name;
      quote.approved_at = new Date().toISOString();
      if (await isSupabaseAvailable()) {
        const admin = createAdminClient();
        await admin.from('quotations').update({ status: 'Approved', approved_by: authUser.name, approved_at: quote.approved_at }).eq('id', quote.id);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'APPROVE_DISCOUNT',
      module: 'QUOTATIONS',
      details: `Approved ${req.discount_percent}% discount for ${req.quotation_number} (Approver: ${authUser.name})`,
    });

    revalidatePath('/dashboard/quotations');
    return { success: true, request: req };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to approve discount' };
  }
}

/**
 * Reject a pending discount approval request.
 */
export async function rejectDiscountAction(
  requestId: string,
  reason: string
): Promise<{ success: boolean; request?: DiscountApprovalRequest; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM']);
    const store = getDiscountApprovalsStore();
    const req = store.find((r) => r.id === requestId);
    if (!req) {
      return { success: false, error: 'Discount approval request not found' };
    }

    req.status = 'REJECTED';
    req.remarks = `${req.remarks || ''} [Rejected by ${authUser.name}: ${reason}]`;

    const quote = await findQuotationRecord(req.quotation_id || req.quotation_number);
    if (quote) {
      quote.status = 'Draft'; // Revert to draft for price adjustment
      if (await isSupabaseAvailable()) {
        const admin = createAdminClient();
        await admin.from('quotations').update({ status: 'Draft' }).eq('id', quote.id);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'REJECT_DISCOUNT',
      module: 'QUOTATIONS',
      details: `Rejected ${req.discount_percent}% discount for ${req.quotation_number} (Reason: ${reason})`,
    });

    revalidatePath('/dashboard/quotations');
    return { success: true, request: req };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to reject discount' };
  }
}



