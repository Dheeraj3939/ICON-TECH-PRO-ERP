'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { requireRole, getAuthenticatedUser } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { canViewPurchaseCosts } from '@/lib/utils/margin';
import type { SupplierPriceOffer } from '@/types/erp';

// Initial Demo Supplier Price Sourcing History
const INITIAL_SUPPLIER_OFFERS: SupplierPriceOffer[] = [
  {
    id: 'SPO-001',
    offer_number: 'SPO/2026-27/0001',
    enquiry_id: 'ENQ260001',
    quotation_id: 'QT-1099',
    product_id: 'prod_ifp_1',
    product_name: '86" Commercial Interactive Flat Panel 4K with Android 13 & Stylus',
    supplier_id: 'SUP002',
    supplier_name: 'EduTech Displays India',
    contact_person: 'Anil Kumar',
    phone: '+91 99800 77889',
    email: 'anil@edutechdisplays.in',
    quoted_price: 215000,
    gst_rate: 18,
    lead_time_days: 2,
    warranty_terms: '3 Years Comprehensive On-Site Warranty',
    communication_method: 'WhatsApp',
    is_selected: true,
    decision_notes: 'Lowest price with immediate 2-day delivery commitment from Hyderabad warehouse.',
    attachment_url: '/docs/edutech_ifp86_quote.pdf',
    recorded_by: 'Vineet Babu',
    created_at: '2026-09-03T11:30:00Z',
  },
  {
    id: 'SPO-002',
    offer_number: 'SPO/2026-27/0002',
    enquiry_id: 'ENQ260001',
    quotation_id: 'QT-1099',
    product_id: 'prod_ifp_1',
    product_name: '86" Commercial Interactive Flat Panel 4K with Android 13 & Stylus',
    supplier_id: 'SUP001',
    supplier_name: 'Hyderabad AV Tech Distributors',
    contact_person: 'Suresh Rao',
    phone: '+91 98490 11223',
    email: 'sales@hyderabadav.com',
    quoted_price: 220000,
    gst_rate: 18,
    lead_time_days: 4,
    warranty_terms: '3 Years Standard Warranty',
    communication_method: 'Email',
    is_selected: false,
    decision_notes: 'Higher unit rate by ₹5,000 compared to EduTech.',
    attachment_url: '/docs/hav_quote_sept.pdf',
    recorded_by: 'Vineet Babu',
    created_at: '2026-09-03T10:15:00Z',
  },
  {
    id: 'SPO-003',
    offer_number: 'SPO/2026-27/0003',
    enquiry_id: 'ENQ260001',
    quotation_id: 'QT-1099',
    product_id: 'prod_ifp_1',
    product_name: '86" Commercial Interactive Flat Panel 4K with Android 13 & Stylus',
    supplier_id: 'SUP003',
    supplier_name: 'Shree Prime Distributors',
    contact_person: 'Mitesh Patel',
    phone: '+91 98200 44556',
    email: 'mitesh@shreeprime.com',
    quoted_price: 224000,
    gst_rate: 18,
    lead_time_days: 7,
    warranty_terms: '2 Years Manufacturer Warranty',
    communication_method: 'Phone',
    is_selected: false,
    decision_notes: 'Stock transit requires 7 days from Mumbai hub.',
    recorded_by: 'Vineet Babu',
    created_at: '2026-09-03T14:00:00Z',
  },
];

declare global {
  // eslint-disable-next-line no-var
  var __ICON_SUPPLIER_OFFERS__: SupplierPriceOffer[] | undefined;
}

function getSupplierOffersStore(): SupplierPriceOffer[] {
  if (!globalThis.__ICON_SUPPLIER_OFFERS__) {
    globalThis.__ICON_SUPPLIER_OFFERS__ = [...INITIAL_SUPPLIER_OFFERS];
  }
  return globalThis.__ICON_SUPPLIER_OFFERS__;
}

export async function getSupplierOffers(filters?: {
  enquiry_id?: string;
  quotation_id?: string;
  product_id?: string;
  search?: string;
}): Promise<{ offers: SupplierPriceOffer[]; total: number }> {
  const store = getSupplierOffersStore();
  const user = await getAuthenticatedUser();
  const canSeeCost = canViewPurchaseCosts(user?.role || '');

  const sanitizeOffer = (o: SupplierPriceOffer): SupplierPriceOffer => {
    if (canSeeCost) return o;
    return {
      ...o,
      quoted_price: 0,
      decision_notes: o.decision_notes ? '[Protected Commercial Rationale]' : undefined,
    };
  };

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const supabase = await createClient();
      let query = supabase.from('supplier_price_offers').select('*', { count: 'exact' });

      if (filters?.enquiry_id) {
        query = query.eq('enquiry_id', filters.enquiry_id);
      }
      if (filters?.quotation_id) {
        query = query.eq('quotation_id', filters.quotation_id);
      }
      if (filters?.product_id) {
        query = query.eq('product_id', filters.product_id);
      }
      if (filters?.search) {
        const s = filters.search.trim();
        query = query.or(`supplier_name.ilike.%${s}%,product_name.ilike.%${s}%,offer_number.ilike.%${s}%`);
      }

      query = query.order('created_at', { ascending: false });
      const { data, error, count } = await query;

      if (!error && data && data.length > 0) {
        return {
          offers: (data as SupplierPriceOffer[]).map(sanitizeOffer),
          total: count ?? data.length,
        };
      }
    } catch (err) {
      console.warn('Supabase supplier offers query failed, using in-memory store:', err);
    }
  }

  let list = store.map(sanitizeOffer);
  if (filters?.enquiry_id) {
    list = list.filter((o) => o.enquiry_id === filters.enquiry_id);
  }
  if (filters?.quotation_id) {
    list = list.filter((o) => o.quotation_id === filters.quotation_id);
  }
  if (filters?.product_id) {
    list = list.filter((o) => o.product_id === filters.product_id);
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase().trim();
    list = list.filter(
      (o) =>
        o.supplier_name.toLowerCase().includes(s) ||
        o.product_name.toLowerCase().includes(s) ||
        o.offer_number.toLowerCase().includes(s)
    );
  }

  return { offers: list, total: list.length };
}

export async function recordSupplierOffer(payload: {
  enquiry_id?: string;
  quotation_id?: string;
  product_id?: string;
  product_name: string;
  supplier_id?: string;
  supplier_name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  quoted_price: number;
  gst_rate?: number;
  lead_time_days?: number;
  warranty_terms?: string;
  communication_method: 'Phone' | 'Email' | 'WhatsApp' | 'In-Person' | 'Portal' | 'Other';
  decision_notes?: string;
  attachment_url?: string;
}): Promise<{ success: boolean; data?: SupplierPriceOffer; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive']);
    const store = getSupplierOffersStore();

    const seq = (store.length + 1).toString().padStart(4, '0');
    const offerNumber = `SPO/2026-27/${seq}`;
    const offerId = `SPO-${Date.now()}`;

    const newOffer: SupplierPriceOffer = {
      id: offerId,
      offer_number: offerNumber,
      enquiry_id: payload.enquiry_id,
      quotation_id: payload.quotation_id,
      product_id: payload.product_id,
      product_name: payload.product_name,
      supplier_id: payload.supplier_id,
      supplier_name: payload.supplier_name,
      contact_person: payload.contact_person,
      phone: payload.phone,
      email: payload.email,
      quoted_price: Number(payload.quoted_price) || 0,
      gst_rate: payload.gst_rate ?? 18,
      lead_time_days: payload.lead_time_days ?? 3,
      warranty_terms: payload.warranty_terms || 'Standard OEM Warranty',
      communication_method: payload.communication_method,
      is_selected: false,
      decision_notes: payload.decision_notes,
      attachment_url: payload.attachment_url,
      recorded_by: authUser.name,
      created_at: new Date().toISOString(),
    };

    store.unshift(newOffer);

    await logAuditEvent({
      userName: authUser.name,
      action: 'SUPPLIER_OFFER_RECORDED',
      module: 'PROCUREMENT',
      details: `Recorded supplier price quote ${offerNumber} from ${payload.supplier_name} for "${payload.product_name}" @ ₹${payload.quoted_price.toLocaleString('en-IN')} via ${payload.communication_method}`,
    });

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('supplier_price_offers').insert([
          {
            id: newOffer.id,
            offer_number: newOffer.offer_number,
            enquiry_id: newOffer.enquiry_id,
            quotation_id: newOffer.quotation_id,
            product_id: newOffer.product_id,
            product_name: newOffer.product_name,
            supplier_id: newOffer.supplier_id,
            supplier_name: newOffer.supplier_name,
            contact_person: newOffer.contact_person,
            phone: newOffer.phone,
            email: newOffer.email,
            quoted_price: newOffer.quoted_price,
            gst_rate: newOffer.gst_rate,
            lead_time_days: newOffer.lead_time_days,
            warranty_terms: newOffer.warranty_terms,
            communication_method: newOffer.communication_method,
            is_selected: newOffer.is_selected,
            decision_notes: newOffer.decision_notes,
            attachment_url: newOffer.attachment_url,
            recorded_by: newOffer.recorded_by,
          },
        ]);
      } catch (err) {
        console.warn('Failed to insert supplier offer into Supabase:', err);
      }
    }

    revalidatePath('/dashboard/purchases');
    revalidatePath('/dashboard/quotations');
    return { success: true, data: newOffer };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to record supplier offer' };
  }
}

export async function selectSupplierOffer(
  offerId: string,
  decisionNotes: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM']);
    const store = getSupplierOffersStore();

    const targetOffer = store.find((o) => o.id === offerId || o.offer_number === offerId);
    if (!targetOffer) {
      return { success: false, error: 'Supplier offer not found.' };
    }

    // Unselect other offers for the same enquiry/product to maintain clean selected state
    store.forEach((o) => {
      if (
        (targetOffer.enquiry_id && o.enquiry_id === targetOffer.enquiry_id && o.product_name === targetOffer.product_name) ||
        (targetOffer.quotation_id && o.quotation_id === targetOffer.quotation_id && o.product_name === targetOffer.product_name)
      ) {
        o.is_selected = false;
      }
    });

    targetOffer.is_selected = true;
    targetOffer.decision_notes = decisionNotes.trim();

    await logAuditEvent({
      userName: authUser.name,
      action: 'SUPPLIER_OFFER_SELECTED',
      module: 'PROCUREMENT',
      details: `Human Selection: Chose ${targetOffer.supplier_name} @ ₹${targetOffer.quoted_price.toLocaleString('en-IN')} for "${targetOffer.product_name}". Rationale: "${decisionNotes}"`,
    });

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        if (targetOffer.enquiry_id) {
          await admin
            .from('supplier_price_offers')
            .update({ is_selected: false })
            .eq('enquiry_id', targetOffer.enquiry_id)
            .eq('product_name', targetOffer.product_name);
        }
        await admin
          .from('supplier_price_offers')
          .update({ is_selected: true, decision_notes: targetOffer.decision_notes })
          .eq('id', targetOffer.id);
      } catch (dbErr) {
        console.warn('Failed to update supplier offer selection in Supabase:', dbErr);
      }
    }

    revalidatePath('/dashboard/purchases');
    revalidatePath('/dashboard/quotations');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to select supplier offer' };
  }
}

/**
 * Safely update supplier quote details (contact, lead time, warranty, quoted rate, notes).
 */
export async function updateSupplierOffer(
  offerId: string,
  values: Partial<{
    quoted_price: number;
    gst_rate: number;
    lead_time_days: number;
    warranty_terms: string;
    contact_person: string;
    phone: string;
    email: string;
    communication_method: 'Phone' | 'Email' | 'WhatsApp' | 'In-Person' | 'Portal' | 'Other';
    decision_notes: string;
  }>
): Promise<{ success: boolean; data?: SupplierPriceOffer; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM']);
    const store = getSupplierOffersStore();
    const found = store.find((o) => o.id === offerId || o.offer_number === offerId);

    if (!found) {
      return { success: false, error: 'Supplier offer not found' };
    }

    if (values.quoted_price !== undefined) found.quoted_price = Number(values.quoted_price) || 0;
    if (values.gst_rate !== undefined) found.gst_rate = Number(values.gst_rate) || 0;
    if (values.lead_time_days !== undefined) found.lead_time_days = Number(values.lead_time_days) || 0;
    if (values.warranty_terms !== undefined) found.warranty_terms = values.warranty_terms;
    if (values.contact_person !== undefined) found.contact_person = values.contact_person;
    if (values.phone !== undefined) found.phone = values.phone;
    if (values.email !== undefined) found.email = values.email;
    if (values.communication_method !== undefined) found.communication_method = values.communication_method;
    if (values.decision_notes !== undefined) found.decision_notes = values.decision_notes;

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('supplier_price_offers')
          .update({
            quoted_price: found.quoted_price,
            gst_rate: found.gst_rate,
            lead_time_days: found.lead_time_days,
            warranty_terms: found.warranty_terms,
            contact_person: found.contact_person,
            phone: found.phone,
            email: found.email,
            communication_method: found.communication_method,
            decision_notes: found.decision_notes,
          })
          .or(`id.eq.${found.id},offer_number.eq.${found.offer_number}`);
      } catch (err) {
        console.warn('Supabase updateSupplierOffer fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_SUPPLIER_OFFER',
      module: 'PROCUREMENT',
      details: `Updated supplier price offer ${found.offer_number} from ${found.supplier_name} for "${found.product_name}" (Rate: ₹${found.quoted_price})`,
    });

    revalidatePath('/dashboard/purchases');
    revalidatePath('/dashboard/quotations');
    return { success: true, data: found };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update supplier offer' };
  }
}

