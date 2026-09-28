'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import type { SerialRecord, SerialStatus, WarrantyProvider, WarrantySource } from '@/types/erp';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_SERIAL_RECORDS__: SerialRecord[] | undefined;
}

const INITIAL_SERIAL_RECORDS: SerialRecord[] = [
  {
    id: 'SER-001',
    serial_number: 'EP-4K-980-SN4401',
    product_name: 'Epson Home Cinema 4K Laser Projector',
    sku: 'EP-4K-980',
    supplier_name: 'Hyderabad AV Tech Distributors',
    po_number: 'PO260001',
    customer_name: 'T-Hub Foundation',
    order_number: 'ORD260001',
    invoice_number: 'INV260001',
    installation_number: 'INS260001',
    warranty_duration_months: 24,
    warranty_start_date: '2026-04-10',
    warranty_end_date: '2028-04-09',
    warranty_provider: 'OEM',
    warranty_source: 'PRODUCT',
    status: 'INSTALLED',
    notes: 'Mounted in Auditorium 1. Optical engine calibrated.',
    created_at: '2026-04-10T10:00:00.000Z',
  },
  {
    id: 'SER-002',
    serial_number: 'SCR-120-MOT-SN1092',
    product_name: 'Motorized Projection Screen 120"',
    sku: 'SCR-120-MOT',
    supplier_name: 'Hyderabad AV Tech Distributors',
    po_number: 'PO260001',
    customer_name: 'T-Hub Foundation',
    order_number: 'ORD260001',
    invoice_number: 'INV260001',
    installation_number: 'INS260001',
    warranty_duration_months: 12,
    warranty_start_date: '2026-04-10',
    warranty_end_date: '2027-04-09',
    warranty_provider: 'DISTRIBUTOR',
    warranty_source: 'DISTRIBUTOR',
    status: 'INSTALLED',
    notes: 'Ceiling recessed box. RF remote controller tuned.',
    created_at: '2026-04-10T10:00:00.000Z',
  },
];

function getInternalSerialsStore(): SerialRecord[] {
  if (!globalThis.__ICON_SERIAL_RECORDS__) {
    globalThis.__ICON_SERIAL_RECORDS__ = [...INITIAL_SERIAL_RECORDS];
  }
  return globalThis.__ICON_SERIAL_RECORDS__;
}

export async function getSerialsStore(): Promise<SerialRecord[]> {
  return getInternalSerialsStore();
}

/**
 * Retrieve serial number tracking records with multi-criteria search.
 */
export async function getSerialRecords(filters?: {
  search?: string;
  productId?: string;
  status?: SerialStatus;
  customerName?: string;
}): Promise<{ records: SerialRecord[]; total: number }> {
  const store = getInternalSerialsStore();

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const supabase = await createClient();
      let query = supabase.from('serial_records').select('*', { count: 'exact' });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.productId) {
        query = query.eq('product_id', filters.productId);
      }
      if (filters?.search) {
        const s = filters.search.trim();
        query = query.or(`serial_number.ilike.%${s}%,product_name.ilike.%${s}%,customer_name.ilike.%${s}%`);
      }

      query = query.order('created_at', { ascending: false });
      const { data, error, count } = await query;
      if (!error && data && data.length > 0) {
        return { records: data as SerialRecord[], total: count ?? data.length };
      }
    } catch (err) {
      console.warn('Supabase serial_records query fallback to memory:', err);
    }
  }

  let filtered = [...store];
  if (filters?.status) {
    filtered = filtered.filter((r) => r.status === filters.status);
  }
  if (filters?.productId) {
    filtered = filtered.filter((r) => r.product_id === filters.productId);
  }
  if (filters?.customerName) {
    const cn = filters.customerName.toLowerCase();
    filtered = filtered.filter((r) => r.customer_name && r.customer_name.toLowerCase().includes(cn));
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.serial_number.toLowerCase().includes(s) ||
        r.product_name.toLowerCase().includes(s) ||
        (r.customer_name && r.customer_name.toLowerCase().includes(s)) ||
        (r.order_number && r.order_number.toLowerCase().includes(s))
    );
  }

  return { records: filtered, total: filtered.length };
}

/**
 * Register serial numbers upon GRN receipt or direct drop-shipment.
 */
export async function registerSerials(
  records: Array<Omit<SerialRecord, 'id' | 'created_at'>>
): Promise<{ success: boolean; data?: SerialRecord[]; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Office Assistant', 'Accounts']);
    const store = getInternalSerialsStore();

    const created: SerialRecord[] = records.map((r, idx) => ({
      ...r,
      id: `SER-${Date.now()}-${idx}`,
      created_at: new Date().toISOString(),
    }));

    store.unshift(...created);

    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      try {
        const admin = createAdminClient();
        await admin.from('serial_records').insert(
          created.map((c) => ({
            serial_number: c.serial_number,
            product_name: c.product_name,
            sku: c.sku || null,
            supplier_name: c.supplier_name || null,
            po_number: c.po_number || null,
            grn_number: c.grn_number || null,
            customer_name: c.customer_name || null,
            order_number: c.order_number || null,
            warranty_duration_months: c.warranty_duration_months || 12,
            warranty_start_date: c.warranty_start_date || null,
            warranty_end_date: c.warranty_end_date || null,
            warranty_provider: c.warranty_provider || 'OEM',
            warranty_source: c.warranty_source || 'PRODUCT',
            status: c.status || 'IN_OFFICE',
            notes: c.notes || null,
          }))
        );
      } catch (err) {
        console.warn('Supabase registerSerials insert fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'REGISTER_SERIALS',
      module: 'INVENTORY',
      details: `Registered ${created.length} serial record(s). Sample: ${created[0]?.serial_number}`,
    });

    revalidatePath('/dashboard/inventory');
    revalidatePath('/dashboard/installations');
    return { success: true, data: created };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to register serials' };
  }
}

/**
 * Update serial status (e.g. ALLOCATED -> DISPATCHED -> INSTALLED -> UNDER_SERVICE).
 */
export async function updateSerialStatus(
  serialNumber: string,
  status: SerialStatus,
  updates?: Partial<SerialRecord>
): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'Office Assistant', 'BDM']);
    const store = getInternalSerialsStore();

    const found = store.find((r) => r.serial_number === serialNumber);
    if (found) {
      found.status = status;
      if (updates?.customer_name) found.customer_name = updates.customer_name;
      if (updates?.order_number) found.order_number = updates.order_number;
      if (updates?.invoice_number) found.invoice_number = updates.invoice_number;
      if (updates?.installation_number) found.installation_number = updates.installation_number;
      if (updates?.warranty_start_date) found.warranty_start_date = updates.warranty_start_date;
      if (updates?.warranty_end_date) found.warranty_end_date = updates.warranty_end_date;
      if (updates?.notes) found.notes = updates.notes;
      found.updated_at = new Date().toISOString();
    }

    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      try {
        const admin = createAdminClient();
        await admin
          .from('serial_records')
          .update({
            status,
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('serial_number', serialNumber);
      } catch (err) {
        console.warn('Supabase updateSerialStatus fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_SERIAL_STATUS',
      module: 'INVENTORY',
      details: `Updated serial ${serialNumber} status to ${status}`,
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update serial status' };
  }
}

/**
 * Retrieve verified warranty details for a given serial number.
 */
export async function getWarrantyInfo(serialNumber: string): Promise<{
  isValid: boolean;
  serial?: SerialRecord;
  warrantyStatus: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'UNREGISTERED';
  daysRemaining: number;
}> {
  const store = getInternalSerialsStore();
  const serial = store.find((r) => r.serial_number.toLowerCase() === serialNumber.trim().toLowerCase());

  if (!serial || !serial.warranty_end_date) {
    return {
      isValid: Boolean(serial),
      serial,
      warrantyStatus: 'UNREGISTERED',
      daysRemaining: 0,
    };
  }

  const now = new Date();
  const endDate = new Date(serial.warranty_end_date);
  const diffTime = endDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let warrantyStatus: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' = 'ACTIVE';
  if (daysRemaining < 0) {
    warrantyStatus = 'EXPIRED';
  } else if (daysRemaining <= 60) {
    warrantyStatus = 'EXPIRING_SOON';
  }

  return {
    isValid: true,
    serial,
    warrantyStatus,
    daysRemaining: Math.max(0, daysRemaining),
  };
}

/**
 * Retrieve installed serials whose warranty is expiring within specified days (default 30/60).
 */
export async function getExpiringWarranties(withinDays: number = 30): Promise<SerialRecord[]> {
  const store = getInternalSerialsStore();
  const now = new Date();
  const futureLimit = new Date();
  futureLimit.setDate(now.getDate() + withinDays);

  return store.filter((s) => {
    if (!s.warranty_end_date || s.status !== 'INSTALLED') return false;
    const end = new Date(s.warranty_end_date);
    return end >= now && end <= futureLimit;
  });
}
