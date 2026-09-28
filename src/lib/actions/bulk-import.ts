'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { getNextCustomerCode } from '@/lib/utils/sequence';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { INITIAL_PRODUCTS, INITIAL_SUPPLIERS } from '@/lib/constants/erp-data';
import type { Customer } from '@/types/customer';
import type { Product, Supplier } from '@/types/erp';

// Shared global customer store access
declare global {
  // eslint-disable-next-line no-var
  var __ICON_CUSTOMERS__: Customer[] | undefined;
}

export interface BulkImportResult {
  total: number;
  successCount: number;
  errorCount: number;
  errors: { row: number; reason: string }[];
}

/**
 * Bulk Import Customer Master Records from Parsed CSV
 * Auto-generates atomic sequential ICONYYXXXX sequences.
 */
export async function bulkImportCustomers(
  rows: Record<string, string>[]
): Promise<BulkImportResult> {
  const authUser = await requireRole(['Managing Director', 'Admin / BDM']);

  const result: BulkImportResult = {
    total: rows.length,
    successCount: 0,
    errorCount: 0,
    errors: [],
  };

  if (!rows || rows.length === 0) return result;

  const validRecords = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const customerName = (r.customer_name || r.name || '').trim();
    const phone = (r.phone || r.mobile || '').trim();
    const city = (r.city || 'Hyderabad').trim();
    const state = (r.state || 'Telangana').trim();
    const isCompany =
      (r.customer_type || '').toUpperCase() === 'COMPANY' ||
      Boolean(r.company_name?.trim());

    if (!customerName) {
      result.errorCount++;
      result.errors.push({ row: i + 1, reason: 'Missing required customer_name' });
      continue;
    }
    if (!phone) {
      result.errorCount++;
      result.errors.push({ row: i + 1, reason: 'Missing required phone number' });
      continue;
    }

    validRecords.push({
      customer_type: (isCompany ? 'COMPANY' : 'INDIVIDUAL') as any,
      customer_name: customerName,
      company_name: isCompany ? (r.company_name || customerName).trim() : null,
      contact_person: (r.contact_person || customerName).trim(),
      phone: phone,
      email: (r.email || '').trim() || null,
      billing_address: (r.address_line1 || r.billing_address || `${city}, ${state}`).trim(),
      city: city,
      state: state,
      state_code: '36',
      pincode: (r.pincode || '500001').trim(),
      gstin: (r.gstin || '').trim() || null,
      pan: (r.pan || '').trim() || null,
      credit_limit: Number(r.credit_limit || 0) || 0,
      enquiry_source: (r.enquiry_source || 'DIRECT').trim(),
      status: 'ACTIVE' as any,
    });
  }

  if (validRecords.length > 0) {
    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      try {
        const supabase = await createClient();
        let { error } = await supabase.from('customers').insert(validRecords);

        if (error) {
          const admin = createAdminClient();
          const adminRes = await admin.from('customers').insert(validRecords);
          if (adminRes.error) {
            console.warn('Supabase bulk customer insert error:', adminRes.error);
          }
        }
      } catch (err: any) {
        console.warn('Supabase bulk import failed, falling back to memory store:', err);
      }
    }

    // Insert into global memory store with generated customer_code
    if (!globalThis.__ICON_CUSTOMERS__) {
      globalThis.__ICON_CUSTOMERS__ = [];
    }

    for (const rec of validRecords) {
      const code = await getNextCustomerCode(globalThis.__ICON_CUSTOMERS__);
      const newCust: Customer = {
        id: `CUST-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        customer_code: code,
        customer_type: rec.customer_type,
        customer_name: rec.customer_name,
        company_name: rec.company_name,
        contact_person: rec.contact_person,
        designation: null,
        phone: rec.phone,
        alternate_phone: null,
        email: rec.email,
        billing_address: rec.billing_address,
        shipping_address: rec.billing_address,
        city: rec.city,
        state: rec.state,
        state_code: rec.state_code,
        pincode: rec.pincode,
        gstin: rec.gstin,
        pan: rec.pan,
        credit_limit: rec.credit_limit,
        enquiry_source: rec.enquiry_source,
        salesperson_id: null,
        status: rec.status,
        notes: 'Imported via Bulk CSV',
        created_by: authUser.id,
        updated_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      globalThis.__ICON_CUSTOMERS__.unshift(newCust);
    }

    result.successCount = validRecords.length;

    await logAuditEvent({
      userName: authUser.name,
      action: 'BULK_IMPORT_CUSTOMERS',
      module: 'CUSTOMERS',
      details: `Bulk imported ${validRecords.length} customers from CSV`,
    });

    revalidatePath('/customers');
    revalidatePath('/dashboard/customers');
    revalidatePath('/dashboard');
  }

  return result;
}

/**
 * Bulk Import Inventory Products Master from Parsed CSV
 */
export async function bulkImportProducts(
  rows: Record<string, string>[]
): Promise<BulkImportResult> {
  const authUser = await requireRole(['Managing Director', 'Admin / BDM']);

  const result: BulkImportResult = {
    total: rows.length,
    successCount: 0,
    errorCount: 0,
    errors: [],
  };

  if (!rows || rows.length === 0) return result;

  const validProducts: Product[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = (r.name || r.product_name || '').trim();
    const sku = (r.sku || r.item_code || '').trim().toUpperCase();

    if (!name) {
      result.errorCount++;
      result.errors.push({ row: i + 1, reason: 'Missing required product name' });
      continue;
    }
    if (!sku) {
      result.errorCount++;
      result.errors.push({ row: i + 1, reason: 'Missing required SKU/Product Code' });
      continue;
    }

    const costPrice = Number(r.purchase_price || r.cost_price || 0) || 0;
    const sellPrice = Number(r.selling_price || r.unit_price || costPrice * 1.2) || costPrice * 1.2;
    const mrp = Number(r.mrp || sellPrice * 1.15) || sellPrice;
    const margin = costPrice > 0 ? ((sellPrice - costPrice) / sellPrice) * 100 : 20;

    validProducts.push({
      id: `PRD-${Date.now()}-${i}`,
      sku: sku,
      name: name,
      category_name: (r.category || r.category_name || 'General Equipment').trim(),
      brand_name: (r.brand || r.brand_name || 'Generic').trim(),
      model_name: (r.model || r.model_name || '').trim(),
      unit: (r.unit || 'Nos.').trim(),
      hsn_sac: (r.hsn || r.hsn_sac || '84713010').trim(),
      gst_rate: Number(r.gst_rate || 18) || 18,
      purchase_price: costPrice,
      selling_price: sellPrice,
      mrp: mrp,
      target_margin_pct: Number(margin.toFixed(1)),
      current_stock: Math.max(0, Number(r.current_stock || r.opening_stock || 0) || 0),
      reorder_level: Number(r.reorder_level || 5) || 5,
      is_serialized: (r.is_serialized || '').toLowerCase() === 'true',
      is_service: false,
      supplier_name: (r.supplier_name || 'Primary Vendor').trim(),
      purchase_depot: (r.purchase_depot || 'Hyderabad Central').trim(),
      is_active: true,
    });
  }

  if (validProducts.length > 0) {
    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      try {
        const supabase = await createClient();
        await supabase.from('products').upsert(validProducts, { onConflict: 'sku' });
      } catch (err: any) {
        console.warn('Supabase products bulk import failed, updating store:', err);
      }
    }

    if (!globalThis.__ICON_PRODUCTS__) {
      globalThis.__ICON_PRODUCTS__ = [...INITIAL_PRODUCTS];
    }
    const store: Product[] = globalThis.__ICON_PRODUCTS__;
    for (const prod of validProducts) {
      const idx = store.findIndex((p: Product) => p.sku === prod.sku);
      if (idx !== -1) {
        store[idx] = prod;
      } else {
        store.unshift(prod);
      }
    }

    result.successCount = validProducts.length;

    await logAuditEvent({
      userName: authUser.name,
      action: 'BULK_IMPORT_PRODUCTS',
      module: 'INVENTORY',
      details: `Bulk imported ${validProducts.length} products from CSV`,
    });

    revalidatePath('/dashboard/products');
    revalidatePath('/dashboard/inventory');
    revalidatePath('/dashboard');
  }

  return result;
}

/**
 * Bulk Import Suppliers / Vendors
 */
export async function bulkImportSuppliers(
  rows: Record<string, string>[]
): Promise<BulkImportResult> {
  const authUser = await requireRole(['Managing Director', 'Admin / BDM']);

  const result: BulkImportResult = {
    total: rows.length,
    successCount: 0,
    errorCount: 0,
    errors: [],
  };

  if (!rows || rows.length === 0) return result;

  const validSuppliers: Supplier[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = (r.supplier_name || r.name || '').trim();
    const phone = (r.phone || '').trim();

    if (!name) {
      result.errorCount++;
      result.errors.push({ row: i + 1, reason: 'Missing required supplier_name' });
      continue;
    }

    validSuppliers.push({
      id: `SUP-${Date.now()}-${i}`,
      supplier_code: `SUP${Date.now().toString().slice(-4)}${i}`,
      supplier_name: name,
      contact_person: (r.contact_person || name).trim(),
      phone: phone || '+91 98490 00000',
      email: (r.email || '').trim() || 'vendor@example.com',
      gstin: (r.gstin || '').trim() || undefined,
      city: (r.city || 'Hyderabad').trim(),
      billing_address: (r.billing_address || 'Hyderabad, Telangana').trim(),
      payment_terms_days: Number(r.payment_terms_days || 30) || 30,
      is_active: true,
      created_at: new Date().toISOString(),
    });
  }

  if (validSuppliers.length > 0) {
    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      try {
        const supabase = await createClient();
        await supabase.from('suppliers').insert(validSuppliers);
      } catch (err: any) {
        console.warn('Supabase suppliers bulk import failed, updating store:', err);
      }
    }

    if (!globalThis.__ICON_SUPPLIERS__) {
      globalThis.__ICON_SUPPLIERS__ = [...INITIAL_SUPPLIERS];
    }
    const store: Supplier[] = globalThis.__ICON_SUPPLIERS__;
    for (const sup of validSuppliers) {
      store.unshift(sup);
    }

    result.successCount = validSuppliers.length;

    await logAuditEvent({
      userName: authUser.name,
      action: 'BULK_IMPORT_SUPPLIERS',
      module: 'PROCUREMENT',
      details: `Bulk imported ${validSuppliers.length} suppliers from CSV`,
    });

    revalidatePath('/dashboard/purchases');
  }

  return result;
}
