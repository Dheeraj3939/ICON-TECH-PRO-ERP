'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth, requireRole, getAuthenticatedUser } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import { sanitizeSearchTerm, sanitizeUuid } from '@/lib/supabase/db-helpers';
import { getNextDeliveryChallanNumber } from '@/lib/utils/sequence';
import { getQuotationById } from '@/lib/actions/quotations';
import { getSalesOrderById } from '@/lib/actions/orders';
import { getInvoices } from '@/lib/actions/billing';
import type {
  DeliveryChallan,
  DeliveryChallanItem,
  DeliveryChallanStatus,
  DeliveryChallanPurpose,
  CreateDeliveryChallanPayload,
} from '@/types/delivery-challan';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_DELIVERY_CHALLANS__: DeliveryChallan[] | undefined;
}

const SEED_DELIVERY_CHALLANS: DeliveryChallan[] = [
  {
    id: 'DC-2026-0001',
    challan_number: 'ITP/DC/2026-27/0001',
    challan_date: '2026-08-28',
    customer_id: 'CUST-CYIENT-001',
    customer_name: 'Cyient Technologies Hyderabad Campus',
    company_name: 'Cyient Limited',
    gstin: '36AAACC1206M1ZV',
    customer_address: 'Plot No. 11, Software Units Layout, Infocity, Madhapur, Hyderabad, Telangana 500081',
    delivery_address: 'Plot No. 11, Software Units Layout, Infocity, Madhapur, Hyderabad, Telangana 500081',
    purpose: 'Supply against Order',
    reference_type: 'SALES_ORDER',
    reference_number: 'ICON/26-27/ORD-0001',
    items: [
      {
        id: 'DCI-001',
        description: 'BenQ RM7503 75-inch 4K UHD Education Interactive Flat Panel Display',
        model_name: 'RM7503',
        brand_name: 'BenQ',
        hsn_sac: '85285200',
        quantity: 2,
        unit: 'Nos.',
        serial_numbers: ['BNQ-75-99214', 'BNQ-75-99215'],
        remarks: 'Original factory packed units with wall mount brackets',
      },
      {
        id: 'DCI-002',
        description: 'Heavy Duty Mobile Floor Stand with Camera Tray for 75" Interactive Display',
        model_name: 'MFS-75HD',
        brand_name: 'InFocus',
        hsn_sac: '83024900',
        quantity: 2,
        unit: 'Sets',
        remarks: 'Includes lockable castors and hardware accessories',
      },
    ],
    transporter_name: 'Direct Dedicated Van Dispatch',
    vehicle_number: 'TS 09 UB 4521',
    prepared_by_name: 'B Vineet Babu',
    authorized_by_name: 'Borra Narsimulu',
    receiver_name: 'K. Ramesh (AV Facility In-charge)',
    receiver_phone: '+91 98480 12345',
    receiver_signature_date: '2026-08-28T16:00:00Z',
    receiver_acknowledgement: 'Received all items in sealed good condition with serial verification.',
    status: 'Delivered/Acknowledged',
    notes: 'Site contact: Mr. Ramesh. Handed over installation accessories.',
    created_at: '2026-08-28T09:00:00Z',
    updated_at: '2026-08-28T16:00:00Z',
  },
];

function getChallanStore(): DeliveryChallan[] {
  if (!globalThis.__ICON_DELIVERY_CHALLANS__) {
    globalThis.__ICON_DELIVERY_CHALLANS__ = [...SEED_DELIVERY_CHALLANS];
  }
  return globalThis.__ICON_DELIVERY_CHALLANS__;
}

function hydrateChallanRow(row: any): DeliveryChallan {
  return {
    ...row,
    receiver_signature_date: row.pod_date ?? row.receiver_signature_date,
    cancelled_by_name: row.cancelled_by ?? row.cancelled_by_name,
    items: Array.isArray(row.items) ? row.items : [],
  } as DeliveryChallan;
}

async function findChallanRecord(idOrNumber: string): Promise<DeliveryChallan | null> {
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const { data: byId, error: byIdErr } = await admin
        .from('delivery_challans')
        .select('*, items:delivery_challan_items(*)')
        .eq('id', idOrNumber)
        .maybeSingle();
      if (!byIdErr && byId) return hydrateChallanRow(byId);

      const { data: byNum, error: byNumErr } = await admin
        .from('delivery_challans')
        .select('*, items:delivery_challan_items(*)')
        .eq('challan_number', idOrNumber)
        .maybeSingle();
      if (!byNumErr && byNum) return hydrateChallanRow(byNum);
      return null;
    } catch {
      // Fallback
    }
  }

  const store = getChallanStore();
  return store.find((c) => c.id === idOrNumber || c.challan_number === idOrNumber) || null;
}

/**
 * Retrieve all Delivery Challans with optional search and status filtering.
 */
export async function getDeliveryChallans(filters?: {
  status?: string;
  search?: string;
  customer_id?: string;
  purpose?: string;
}): Promise<{ challans: DeliveryChallan[]; total: number }> {
  await requireAuth();
  const store = getChallanStore();

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const admin = createAdminClient();
      let query = admin.from('delivery_challans').select('*, items:delivery_challan_items(*)');

      if (filters?.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status);
      }
      if (filters?.purpose) {
        query = query.eq('purpose', filters.purpose);
      }
      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }
      if (filters?.search) {
        const s = sanitizeSearchTerm(filters.search);
        if (s) {
          query = query.or(
            `challan_number.ilike.%${s}%,customer_name.ilike.%${s}%,reference_number.ilike.%${s}%,vehicle_number.ilike.%${s}%`
          );
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data) {
        return { challans: data.map(hydrateChallanRow), total: data.length };
      }
    } catch {
      // In-memory fallback
    }
  }

  let list = [...store];
  if (filters?.status && filters.status !== 'ALL') {
    list = list.filter((c) => c.status === filters.status);
  }
  if (filters?.purpose) {
    list = list.filter((c) => c.purpose === filters.purpose);
  }
  if (filters?.customer_id) {
    list = list.filter((c) => c.customer_id === filters.customer_id);
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    list = list.filter(
      (c) =>
        c.challan_number.toLowerCase().includes(s) ||
        c.customer_name.toLowerCase().includes(s) ||
        (c.company_name && c.company_name.toLowerCase().includes(s)) ||
        (c.reference_number && c.reference_number.toLowerCase().includes(s)) ||
        (c.vehicle_number && c.vehicle_number.toLowerCase().includes(s)) ||
        (c.transporter_name && c.transporter_name.toLowerCase().includes(s))
    );
  }

  return { challans: list, total: list.length };
}

/**
 * Retrieve single Delivery Challan by ID or Challan Number.
 */
export async function getDeliveryChallanById(idOrNumber: string): Promise<DeliveryChallan | null> {
  await requireAuth();
  return findChallanRecord(idOrNumber);
}

/**
 * Create a new Delivery Challan (Manual, from Quotation, Sales Order, or Tax Invoice).
 * STRICT RULES:
 * - Not a tax invoice
 * - Must NOT automatically create an invoice
 * - Must NOT create an accounting voucher
 * - Must NOT create conventional inventory movement
 * - Cancellation must preserve history and record a reason
 */
export async function createDeliveryChallan(
  payload: CreateDeliveryChallanPayload
): Promise<{ success: boolean; data?: DeliveryChallan; error?: string }> {
  try {
    const actor = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
      'Office Assistant',
      'Accounts',
    ]);

    if (!payload.customer_name || !payload.customer_name.trim()) {
      return { success: false, error: 'Customer name is required' };
    }
    if (!payload.items || payload.items.length === 0) {
      return { success: false, error: 'At least one line item is required' };
    }

    const challanNumber = await getNextDeliveryChallanNumber();
    const challanDate = new Date().toISOString().split('T')[0];

    const items: DeliveryChallanItem[] = payload.items.map((it, idx) => ({
      id: `DCI-${idx + 1}`,
      product_id: it.product_id,
      description: it.description.trim(),
      model_name: it.model_name?.trim(),
      brand_name: it.brand_name?.trim(),
      hsn_sac: it.hsn_sac?.trim() || '85285200',
      quantity: Math.max(0.001, Number(it.quantity) || 1),
      unit: it.unit || 'Nos.',
      serial_numbers: it.serial_numbers || [],
      remarks: it.remarks?.trim(),
    }));

    const newChallan: DeliveryChallan = {
      id: `DC-${Date.now()}`,
      challan_number: challanNumber,
      challan_date: challanDate,
      customer_id: payload.customer_id,
      customer_name: payload.customer_name.trim(),
      company_name: payload.company_name?.trim(),
      gstin: payload.gstin?.trim(),
      customer_address: payload.customer_address.trim(),
      delivery_address: payload.delivery_address.trim(),
      purpose: payload.purpose || 'Supply against Order',
      reference_type: payload.reference_type || 'DIRECT',
      reference_id: payload.reference_id,
      reference_number: payload.reference_number,
      items,
      transporter_name: payload.transporter_name?.trim() || 'Direct Dedicated Transport',
      vehicle_number: payload.vehicle_number?.trim(),
      lr_number: payload.lr_number?.trim(),
      eway_bill_number: payload.eway_bill_number?.trim(),
      prepared_by_name: actor.name,
      authorized_by_name: 'Borra Narsimulu', // Managing Director sign-off default
      status: 'Issued',
      notes: payload.notes?.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const store = getChallanStore();
    store.unshift(newChallan);

    // Persist to Supabase if online
    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        const { data: dbRow, error: dcErr } = await admin
          .from('delivery_challans')
          .insert({
            id: newChallan.id,
            challan_number: newChallan.challan_number,
            challan_date: newChallan.challan_date,
            customer_id: newChallan.customer_id || 'WALKIN',
            customer_name: newChallan.customer_name,
            company_name: newChallan.company_name || null,
            gstin: newChallan.gstin || null,
            customer_address: newChallan.customer_address,
            delivery_address: newChallan.delivery_address,
            purpose: newChallan.purpose,
            reference_type:
              newChallan.reference_type === 'DIRECT'
                ? 'MANUAL'
                : newChallan.reference_type || 'MANUAL',
            reference_id: newChallan.reference_id || null,
            reference_number: newChallan.reference_number || null,
            transporter_name: newChallan.transporter_name || null,
            vehicle_number: newChallan.vehicle_number || null,
            eway_bill_number: newChallan.eway_bill_number || null,
            created_by_name: actor.name,
            created_by_id: sanitizeUuid(actor.id),
            status: newChallan.status,
            version: 1,
            notes: newChallan.notes || null,
          })
          .select('id')
          .single();

        if (!dcErr && dbRow?.id) {
          newChallan.id = dbRow.id;
          const itemsPayload = items.map((it, idx) => ({
            id: `${dbRow.id}-IT-${idx + 1}`,
            challan_id: dbRow.id,
            product_id: it.product_id || null,
            description: it.description,
            model_name: it.model_name || null,
            brand_name: it.brand_name || null,
            hsn_sac: it.hsn_sac,
            quantity: it.quantity,
            unit: it.unit,
            serial_numbers: it.serial_numbers || [],
            remarks: it.remarks || null,
            sort_order: idx,
          }));
          const { error: itemErr } = await admin.from('delivery_challan_items').insert(itemsPayload);
          if (itemErr) {
            console.warn('Supabase delivery challan items insert error:', itemErr.message);
          }
        } else if (dcErr) {
          console.warn('Supabase delivery challan insert error:', dcErr.message);
        }
      } catch (dbErr) {
        console.warn('Supabase delivery challan insert fallback to memory:', dbErr);
      }
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'CREATE_DELIVERY_CHALLAN',
      module: 'CHALLAN',
      details: `Generated Delivery Challan ${challanNumber} for ${newChallan.customer_name} (Purpose: ${newChallan.purpose}, Ref: ${newChallan.reference_number || 'Direct'})`,
    });

    revalidatePath('/dashboard/delivery-challans');
    revalidatePath('/dashboard/dispatch');
    revalidatePath('/dashboard/customers');
    revalidatePath('/dashboard');
    return { success: true, data: newChallan };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create delivery challan' };
  }
}

/**
 * Generate a Delivery Challan from an existing Quotation.
 */
export async function createChallanFromQuotation(
  quotationId: string,
  purpose: DeliveryChallanPurpose = 'Demo / Testing'
): Promise<{ success: boolean; data?: DeliveryChallan; error?: string }> {
  try {
    const quote = await getQuotationById(quotationId);
    if (!quote) {
      return { success: false, error: `Quotation ${quotationId} not found` };
    }

    return await createDeliveryChallan({
      customer_id: quote.customer_id,
      customer_name: quote.customer_name,
      company_name: quote.company_name,
      gstin: (quote as any).gstin || undefined,
      customer_address: (quote as any).address || 'Hyderabad Site, Telangana',
      delivery_address: (quote as any).address || 'Hyderabad Site, Telangana',
      purpose,
      reference_type: 'QUOTATION',
      reference_id: quote.id,
      reference_number: quote.quotation_number,
      items: quote.items.map((it) => ({
        product_id: it.product_id || undefined,
        description: it.product_name,
        model_name: it.model,
        brand_name: it.brand,
        hsn_sac: it.hsn_sac || '85285200',
        quantity: it.quantity,
        unit: it.unit || 'Nos.',
        serial_numbers: [],
      })),
      notes: `Generated against Quotation ${quote.quotation_number}`,
    });
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to generate challan from quotation' };
  }
}

/**
 * Generate a Delivery Challan from an existing Sales Order.
 */
export async function createChallanFromSalesOrder(
  orderId: string
): Promise<{ success: boolean; data?: DeliveryChallan; error?: string }> {
  try {
    const order = await getSalesOrderById(orderId);
    if (!order) {
      return { success: false, error: `Sales Order ${orderId} not found` };
    }

    return await createDeliveryChallan({
      customer_id: order.customer_id,
      customer_name: order.customer_name,
      company_name: order.company_name,
      gstin: (order as any).gstin || undefined,
      customer_address: order.shipping_address || 'Hyderabad Site, Telangana',
      delivery_address: order.shipping_address || 'Hyderabad Site, Telangana',
      purpose: 'Supply against Order',
      reference_type: 'SALES_ORDER',
      reference_id: order.id,
      reference_number: order.order_number,
      items: (order.items || []).map((it) => ({
        product_id: it.product_id || undefined,
        description: it.product_name,
        hsn_sac: '85285200',
        quantity: it.quantity,
        unit: 'Nos.',
        serial_numbers: [],
      })),
      notes: `Generated against Sales Order ${order.order_number}`,
    });
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to generate challan from sales order' };
  }
}

/**
 * Update Delivery Challan status progression.
 * Valid transitions:
 * Draft -> Issued -> Sent -> Delivered/Acknowledged
 * Any status -> Cancelled (with mandatory reason)
 */
export async function updateDeliveryChallanStatus(
  id: string,
  newStatus: DeliveryChallanStatus,
  payload?: {
    receiver_name?: string;
    receiver_phone?: string;
    receiver_acknowledgement?: string;
    notes?: string;
  }
): Promise<{ success: boolean; data?: DeliveryChallan; error?: string }> {
  try {
    const actor = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
      'Office Assistant',
      'Accounts',
    ]);

    const dc = await findChallanRecord(id);
    if (!dc) {
      return { success: false, error: 'Delivery Challan not found' };
    }

    const prevStatus = dc.status;
    dc.status = newStatus;
    dc.updated_at = new Date().toISOString();

    if (payload?.receiver_name) dc.receiver_name = payload.receiver_name;
    if (payload?.receiver_phone) dc.receiver_phone = payload.receiver_phone;
    if (payload?.receiver_acknowledgement) dc.receiver_acknowledgement = payload.receiver_acknowledgement;
    if (newStatus === 'Delivered/Acknowledged') {
      dc.receiver_signature_date = new Date().toISOString();
    }
    if (payload?.notes) {
      dc.notes = dc.notes ? `${dc.notes}\n${payload.notes}` : payload.notes;
    }

    const cachedDc = getChallanStore().find((c) => c.id === dc.id || c.challan_number === dc.challan_number);
    if (cachedDc && cachedDc !== dc) {
      Object.assign(cachedDc, dc);
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('delivery_challans')
          .update({
            status: dc.status,
            receiver_name: dc.receiver_name || null,
            receiver_phone: dc.receiver_phone || null,
            pod_date: dc.receiver_signature_date || null,
            notes: dc.notes || null,
            updated_at: dc.updated_at,
          })
          .eq('id', dc.id);
      } catch (err) {
        console.warn('Supabase delivery challan status update fallback:', err);
      }
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'UPDATE_DELIVERY_CHALLAN_STATUS',
      module: 'CHALLAN',
      details: `Delivery Challan ${dc.challan_number} status updated from "${prevStatus}" to "${newStatus}"`,
    });

    revalidatePath('/dashboard/delivery-challans');
    revalidatePath('/dashboard/dispatch');
    return { success: true, data: dc };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update delivery challan status' };
  }
}

/**
 * Cancel Delivery Challan with mandatory recorded reason.
 */
export async function cancelDeliveryChallan(
  id: string,
  reason: string
): Promise<{ success: boolean; data?: DeliveryChallan; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    if (!reason || !reason.trim()) {
      return { success: false, error: 'A cancellation reason is required' };
    }

    const dc = await findChallanRecord(id);
    if (!dc) {
      return { success: false, error: 'Delivery Challan not found' };
    }

    dc.status = 'Cancelled';
    dc.cancellation_reason = reason.trim();
    dc.cancelled_at = new Date().toISOString();
    dc.cancelled_by_name = actor.name;
    dc.updated_at = new Date().toISOString();

    const cachedDc = getChallanStore().find((c) => c.id === dc.id || c.challan_number === dc.challan_number);
    if (cachedDc && cachedDc !== dc) {
      Object.assign(cachedDc, dc);
    }

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('delivery_challans')
          .update({
            status: 'Cancelled',
            cancellation_reason: dc.cancellation_reason,
            cancelled_at: dc.cancelled_at,
            cancelled_by: dc.cancelled_by_name,
            updated_at: dc.updated_at,
          })
          .eq('id', dc.id);
      } catch (err) {
        console.warn('Supabase delivery challan cancellation fallback:', err);
      }
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'CANCEL_DELIVERY_CHALLAN',
      module: 'CHALLAN',
      details: `Cancelled Delivery Challan ${dc.challan_number}. Reason: ${reason.trim()}`,
    });

    revalidatePath('/dashboard/delivery-challans');
    revalidatePath('/dashboard/dispatch');
    return { success: true, data: dc };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to cancel delivery challan' };
  }
}
