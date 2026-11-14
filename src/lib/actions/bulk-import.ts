'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { getNextCustomerCode } from '@/lib/utils/sequence';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { INITIAL_PRODUCTS, INITIAL_SUPPLIERS } from '@/lib/constants/erp-data';
import type { Customer } from '@/types/customer';
import type { Product, Supplier } from '@/types/erp';
import type { ClassifiedImportRow, DuplicateClassification } from '@/lib/utils/csv-parser';

// Shared global stores access
declare global {
  // eslint-disable-next-line no-var
  var __ICON_CUSTOMERS__: Customer[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_OPENING_RECEIVABLES__: Array<{
    id: string;
    customer_name: string;
    invoice_number: string;
    invoice_date: string;
    amount: number;
    received: number;
    balance: number;
    due_date: string;
    created_at: string;
  }> | undefined;
  // eslint-disable-next-line no-var
  var __ICON_OPENING_PAYABLES__: Array<{
    id: string;
    supplier_name: string;
    invoice_number: string;
    amount: number;
    paid: number;
    balance: number;
    due_date: string;
    created_at: string;
  }> | undefined;
}

export interface BulkImportResult {
  total: number;
  successCount: number;
  errorCount: number;
  errors: { row: number; reason: string }[];
}

export interface ImportClassificationSummary {
  total: number;
  newCount: number;
  exactDuplicateCount: number;
  possibleDuplicateCount: number;
  invalidCount: number;
  reviewRequiredCount: number;
}

function normalizeBusinessName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/\b(pvt|ltd|private|limited|solutions|enterprises|technologies|systems|india|corp|corporation|co|inc)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function normalizePhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * 4-Level Duplicate Detection & Data Integrity Engine
 * Levels:
 * 1. GSTIN match (exact match against registered tax entity)
 * 2. Phone match (exact contact phone number comparison)
 * 3. Email match (email address match)
 * 4. Company Name / Party Name fuzzy normalized match
 */
export async function validateAndClassifyImportRows(
  entity: string,
  rows: Record<string, string>[]
): Promise<{
  summary: ImportClassificationSummary;
  classifiedRows: ClassifiedImportRow[];
}> {
  await requireRole(['Managing Director', 'Admin / BDM']);

  const summary: ImportClassificationSummary = {
    total: rows.length,
    newCount: 0,
    exactDuplicateCount: 0,
    possibleDuplicateCount: 0,
    invalidCount: 0,
    reviewRequiredCount: 0,
  };

  const classifiedRows: ClassifiedImportRow[] = [];

  // 1. Fetch current database state for comparison
  let existingCustomers: Customer[] = globalThis.__ICON_CUSTOMERS__ || [];
  let existingSuppliers: Supplier[] = globalThis.__ICON_SUPPLIERS__ || INITIAL_SUPPLIERS;

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const admin = createAdminClient();
      if (entity === 'customers') {
        const { data } = await admin.from('customers').select('*');
        if (data && data.length > 0) existingCustomers = data;
      } else if (entity === 'suppliers') {
        const { data } = await admin.from('suppliers').select('*');
        if (data && data.length > 0) existingSuppliers = data;
      }
    } catch (err) {
      console.warn('Supabase duplicate check query fallback:', err);
    }
  }

  // Track within-batch duplicates
  const seenGstinsInBatch = new Map<string, number>();
  const seenPhonesInBatch = new Map<string, number>();
  const seenNamesInBatch = new Map<string, number>();
  const seenInvoicesInBatch = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowIndex = i + 1;

    // CUSTOMER MASTER CLASSIFICATION
    if (entity === 'customers') {
      const name = (r.customer_name || r.company_name || r.name || '').trim();
      const phone = (r.phone || r.mobile || '').trim();
      const gstin = (r.gstin || '').trim().toUpperCase();
      const email = (r.email || '').trim().toLowerCase();
      const normName = normalizeBusinessName(name);
      const normPhone = normalizePhone(phone);

      // Validation check
      if (!name) {
        summary.invalidCount++;
        classifiedRows.push({
          rowIndex,
          data: r,
          classification: 'INVALID',
          reason: 'Missing mandatory customer or company name.',
        });
        continue;
      }
      if (!phone) {
        summary.invalidCount++;
        classifiedRows.push({
          rowIndex,
          data: r,
          classification: 'INVALID',
          reason: 'Missing mandatory phone contact number.',
        });
        continue;
      }
      if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) {
        summary.invalidCount++;
        classifiedRows.push({
          rowIndex,
          data: r,
          classification: 'INVALID',
          reason: `Invalid GSTIN format: "${gstin}". Must be 15 alphanumeric characters.`,
        });
        continue;
      }

      // Within-batch collision check
      if (gstin && seenGstinsInBatch.has(gstin)) {
        summary.exactDuplicateCount++;
        classifiedRows.push({
          rowIndex,
          data: r,
          classification: 'EXACT_DUPLICATE',
          reason: `Duplicate GSTIN "${gstin}" repeated in upload batch at Row ${seenGstinsInBatch.get(gstin)}.`,
        });
        continue;
      }
      if (normPhone && seenPhonesInBatch.has(normPhone) && seenNamesInBatch.has(normName)) {
        summary.exactDuplicateCount++;
        classifiedRows.push({
          rowIndex,
          data: r,
          classification: 'EXACT_DUPLICATE',
          reason: `Duplicate contact and company name repeated in upload batch at Row ${seenPhonesInBatch.get(normPhone)}.`,
        });
        continue;
      }

      if (gstin) seenGstinsInBatch.set(gstin, rowIndex);
      if (normPhone) seenPhonesInBatch.set(normPhone, rowIndex);
      if (normName) seenNamesInBatch.set(normName, rowIndex);

      // Level 1: GSTIN Match against Existing Records
      if (gstin) {
        const gstinMatch = existingCustomers.find((c) => c.gstin?.toUpperCase() === gstin);
        if (gstinMatch) {
          const matchedNorm = normalizeBusinessName(gstinMatch.company_name || gstinMatch.customer_name);
          if (matchedNorm === normName || !normName) {
            summary.exactDuplicateCount++;
            classifiedRows.push({
              rowIndex,
              data: r,
              classification: 'EXACT_DUPLICATE',
              reason: `Exact GSTIN match with existing customer [${gstinMatch.customer_code} - ${gstinMatch.customer_name}].`,
              matchedExistingRecord: {
                id: gstinMatch.id,
                name: gstinMatch.customer_name,
                gstin: gstinMatch.gstin,
                phone: gstinMatch.phone,
              },
            });
            continue;
          } else {
            summary.reviewRequiredCount++;
            classifiedRows.push({
              rowIndex,
              data: r,
              classification: 'HUMAN_REVIEW_REQUIRED',
              reason: `GSTIN matches existing customer [${gstinMatch.customer_code} - ${gstinMatch.customer_name}] but company names differ.`,
              matchedExistingRecord: {
                id: gstinMatch.id,
                name: gstinMatch.customer_name,
                gstin: gstinMatch.gstin,
                phone: gstinMatch.phone,
              },
            });
            continue;
          }
        }
      }

      // Level 2: Phone Match
      if (normPhone) {
        const phoneMatch = existingCustomers.find((c) => normalizePhone(c.phone) === normPhone);
        if (phoneMatch) {
          const matchedNorm = normalizeBusinessName(phoneMatch.company_name || phoneMatch.customer_name);
          if (matchedNorm === normName) {
            summary.exactDuplicateCount++;
            classifiedRows.push({
              rowIndex,
              data: r,
              classification: 'EXACT_DUPLICATE',
              reason: `Identical phone and business name with existing customer [${phoneMatch.customer_code} - ${phoneMatch.customer_name}].`,
              matchedExistingRecord: {
                id: phoneMatch.id,
                name: phoneMatch.customer_name,
                gstin: phoneMatch.gstin,
                phone: phoneMatch.phone,
              },
            });
            continue;
          } else {
            summary.possibleDuplicateCount++;
            classifiedRows.push({
              rowIndex,
              data: r,
              classification: 'POSSIBLE_DUPLICATE',
              reason: `Phone number matches existing customer [${phoneMatch.customer_code} - ${phoneMatch.customer_name}].`,
              matchedExistingRecord: {
                id: phoneMatch.id,
                name: phoneMatch.customer_name,
                gstin: phoneMatch.gstin,
                phone: phoneMatch.phone,
              },
            });
            continue;
          }
        }
      }

      // Level 3: Email Match
      if (email) {
        const emailMatch = existingCustomers.find((c) => c.email?.toLowerCase() === email);
        if (emailMatch) {
          summary.possibleDuplicateCount++;
          classifiedRows.push({
            rowIndex,
            data: r,
            classification: 'POSSIBLE_DUPLICATE',
            reason: `Email address matches existing customer [${emailMatch.customer_code} - ${emailMatch.customer_name}].`,
            matchedExistingRecord: {
              id: emailMatch.id,
              name: emailMatch.customer_name,
              gstin: emailMatch.gstin,
              phone: emailMatch.phone,
            },
          });
          continue;
        }
      }

      // Level 4: Company Name Match
      if (normName && normName.length >= 4) {
        const nameMatch = existingCustomers.find(
          (c) => normalizeBusinessName(c.company_name || c.customer_name) === normName
        );
        if (nameMatch) {
          summary.possibleDuplicateCount++;
          classifiedRows.push({
            rowIndex,
            data: r,
            classification: 'POSSIBLE_DUPLICATE',
            reason: `Company name closely matches existing record [${nameMatch.customer_code} - ${nameMatch.customer_name}].`,
            matchedExistingRecord: {
              id: nameMatch.id,
              name: nameMatch.customer_name,
              gstin: nameMatch.gstin,
              phone: nameMatch.phone,
            },
          });
          continue;
        }
      }

      // Clean, verified new record
      summary.newCount++;
      classifiedRows.push({
        rowIndex,
        data: r,
        classification: 'NEW',
        reason: 'New verified customer record ready for import.',
      });
    }

    // SUPPLIER MASTER CLASSIFICATION
    else if (entity === 'suppliers') {
      const name = (r.supplier_name || r.name || '').trim();
      const phone = (r.phone || '').trim();
      const gstin = (r.gstin || '').trim().toUpperCase();
      const email = (r.email || '').trim().toLowerCase();
      const normName = normalizeBusinessName(name);
      const normPhone = normalizePhone(phone);

      if (!name) {
        summary.invalidCount++;
        classifiedRows.push({
          rowIndex,
          data: r,
          classification: 'INVALID',
          reason: 'Missing mandatory supplier name.',
        });
        continue;
      }

      // Within-batch collision check
      if (gstin && seenGstinsInBatch.has(gstin)) {
        summary.exactDuplicateCount++;
        classifiedRows.push({
          rowIndex,
          data: r,
          classification: 'EXACT_DUPLICATE',
          reason: `Duplicate GSTIN "${gstin}" repeated in upload batch at Row ${seenGstinsInBatch.get(gstin)}.`,
        });
        continue;
      }
      if (gstin) seenGstinsInBatch.set(gstin, rowIndex);

      // Level 1: GSTIN Match
      if (gstin) {
        const match = existingSuppliers.find((s) => s.gstin?.toUpperCase() === gstin);
        if (match) {
          summary.exactDuplicateCount++;
          classifiedRows.push({
            rowIndex,
            data: r,
            classification: 'EXACT_DUPLICATE',
            reason: `GSTIN matches existing registered supplier [${match.supplier_name}].`,
          });
          continue;
        }
      }

      // Level 2: Phone Match
      if (normPhone) {
        const match = existingSuppliers.find((s) => normalizePhone(s.phone) === normPhone);
        if (match) {
          summary.possibleDuplicateCount++;
          classifiedRows.push({
            rowIndex,
            data: r,
            classification: 'POSSIBLE_DUPLICATE',
            reason: `Phone matches existing supplier [${match.supplier_name}].`,
          });
          continue;
        }
      }

      // Level 3: Name Match
      if (normName) {
        const match = existingSuppliers.find((s) => normalizeBusinessName(s.supplier_name) === normName);
        if (match) {
          summary.possibleDuplicateCount++;
          classifiedRows.push({
            rowIndex,
            data: r,
            classification: 'POSSIBLE_DUPLICATE',
            reason: `Supplier name matches existing record [${match.supplier_name}].`,
          });
          continue;
        }
      }

      summary.newCount++;
      classifiedRows.push({
        rowIndex,
        data: r,
        classification: 'NEW',
        reason: 'New verified supplier ready for import.',
      });
    }

    // OPENING RECEIVABLES & PAYABLES CLASSIFICATION
    else if (entity === 'opening_receivables' || entity === 'opening_payables') {
      const party = (r.customer_name || r.supplier_name || r.party_name || '').trim();
      const invoiceNo = (r.invoice_number || r.bill_number || '').trim();
      const amount = Number(r.amount || r.balance || 0);

      if (!party || !invoiceNo || isNaN(amount) || amount <= 0) {
        summary.invalidCount++;
        classifiedRows.push({
          rowIndex,
          data: r,
          classification: 'INVALID',
          reason: 'Missing party name, invoice number, or positive outstanding amount.',
        });
        continue;
      }

      if (seenInvoicesInBatch.has(invoiceNo)) {
        summary.exactDuplicateCount++;
        classifiedRows.push({
          rowIndex,
          data: r,
          classification: 'EXACT_DUPLICATE',
          reason: `Invoice number "${invoiceNo}" repeated in upload batch at Row ${seenInvoicesInBatch.get(invoiceNo)}.`,
        });
        continue;
      }
      seenInvoicesInBatch.set(invoiceNo, rowIndex);

      summary.newCount++;
      classifiedRows.push({
        rowIndex,
        data: r,
        classification: 'NEW',
        reason: 'Valid opening ledger item ready for posting.',
      });
    }

    // PRODUCT CATALOG CLASSIFICATION
    else {
      const name = (r.name || r.product_name || '').trim();
      const sku = (r.sku || r.item_code || '').trim().toUpperCase();

      if (!name || !sku) {
        summary.invalidCount++;
        classifiedRows.push({
          rowIndex,
          data: r,
          classification: 'INVALID',
          reason: 'Missing required product name or SKU.',
        });
        continue;
      }

      summary.newCount++;
      classifiedRows.push({
        rowIndex,
        data: r,
        classification: 'NEW',
        reason: 'Valid product SKU ready for catalog upload.',
      });
    }
  }

  return { summary, classifiedRows };
}

/**
 * Bulk Import Customer Master Records from Parsed CSV
 * Auto-generates atomic sequential ICONYYXXXX sequences.
 */
export async function bulkImportCustomers(
  rows: Record<string, string>[],
  skipDuplicates = true
): Promise<BulkImportResult> {
  const authUser = await requireRole(['Managing Director', 'Admin / BDM']);

  const result: BulkImportResult = {
    total: rows.length,
    successCount: 0,
    errorCount: 0,
    errors: [],
  };

  if (!rows || rows.length === 0) return result;

  // Pre-classify rows
  const { classifiedRows } = await validateAndClassifyImportRows('customers', rows);
  const rowsToImport = classifiedRows.filter((c) => {
    if (c.classification === 'INVALID') return false;
    if (skipDuplicates && c.classification === 'EXACT_DUPLICATE') return false;
    return true;
  });

  if (rowsToImport.length === 0) {
    result.errorCount = rows.length;
    result.errors.push({
      row: 1,
      reason: 'No eligible records found after duplicate filtering. All rows were either invalid or exact duplicates.',
    });
    return result;
  }

  const validRecords = [];

  for (const item of rowsToImport) {
    const r = item.data;
    const customerName = (r.customer_name || r.name || '').trim();
    const phone = (r.phone || r.mobile || '').trim();
    const city = (r.city || 'Hyderabad').trim();
    const state = (r.state || 'Telangana').trim();
    const isCompany =
      (r.customer_type || '').toUpperCase() === 'COMPANY' ||
      Boolean(r.company_name?.trim());

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
      enquiry_source: (r.enquiry_source || 'TALLY_IMPORT').trim(),
      status: 'ACTIVE' as any,
    });
  }

  if (validRecords.length > 0) {
    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      try {
        const admin = createAdminClient();
        const adminRes = await admin.from('customers').insert(validRecords);
        if (adminRes.error) {
          console.warn('Supabase bulk customer insert error:', adminRes.error);
        }
      } catch (err: any) {
        console.warn('Supabase bulk import failed, falling back to memory store:', err);
      }
    }

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
        notes: 'Imported via Tally CSV Data Migration',
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
      details: `Bulk imported ${validRecords.length} customer records from Tally CSV (Filtered ${rows.length - validRecords.length} duplicates/invalid)`,
    });

    revalidatePath('/customers');
    revalidatePath('/dashboard/customers');
    revalidatePath('/dashboard/import');
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
        const admin = createAdminClient();
        await admin.from('products').upsert(validProducts, { onConflict: 'sku' });
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
  rows: Record<string, string>[],
  skipDuplicates = true
): Promise<BulkImportResult> {
  const authUser = await requireRole(['Managing Director', 'Admin / BDM']);

  const result: BulkImportResult = {
    total: rows.length,
    successCount: 0,
    errorCount: 0,
    errors: [],
  };

  if (!rows || rows.length === 0) return result;

  const { classifiedRows } = await validateAndClassifyImportRows('suppliers', rows);
  const rowsToImport = classifiedRows.filter((c) => {
    if (c.classification === 'INVALID') return false;
    if (skipDuplicates && c.classification === 'EXACT_DUPLICATE') return false;
    return true;
  });

  const validSuppliers: Supplier[] = [];

  for (let i = 0; i < rowsToImport.length; i++) {
    const r = rowsToImport[i].data;
    const name = (r.supplier_name || r.name || '').trim();
    const phone = (r.phone || '').trim();

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
        const admin = createAdminClient();
        await admin.from('suppliers').insert(validSuppliers);
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
      details: `Bulk imported ${validSuppliers.length} suppliers from Tally CSV`,
    });

    revalidatePath('/dashboard/purchases');
    revalidatePath('/dashboard/import');
  }

  return result;
}

/**
 * Bulk Import Opening Receivables (Customer Outstanding from Tally)
 */
export async function bulkImportOpeningReceivables(
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

  const validReceivables = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const customer = (r.customer_name || r.party_name || '').trim();
    const invNumber = (r.invoice_number || r.bill_number || '').trim();
    const balance = Number(r.balance || r.amount || 0);

    if (!customer || !invNumber || balance <= 0) {
      result.errorCount++;
      result.errors.push({ row: i + 1, reason: 'Missing customer name, invoice number, or positive balance' });
      continue;
    }

    validReceivables.push({
      id: `OP-REC-${Date.now()}-${i}`,
      customer_name: customer,
      invoice_number: invNumber,
      invoice_date: r.invoice_date || new Date().toISOString().split('T')[0],
      amount: Number(r.amount || balance) || balance,
      received: Number(r.received || 0) || 0,
      balance: balance,
      due_date: r.due_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    });
  }

  if (validReceivables.length > 0) {
    if (!globalThis.__ICON_OPENING_RECEIVABLES__) {
      globalThis.__ICON_OPENING_RECEIVABLES__ = [];
    }
    globalThis.__ICON_OPENING_RECEIVABLES__.push(...validReceivables);
    result.successCount = validReceivables.length;

    await logAuditEvent({
      userName: authUser.name,
      action: 'BULK_IMPORT_OPENING_RECEIVABLES',
      module: 'ACCOUNTS',
      details: `Bulk imported ${validReceivables.length} opening customer receivables from Tally export`,
    });

    revalidatePath('/dashboard/invoices');
    revalidatePath('/dashboard/import');
    revalidatePath('/dashboard');
  }

  return result;
}

/**
 * Bulk Import Opening Payables (Supplier Outstanding from Tally)
 */
export async function bulkImportOpeningPayables(
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

  const validPayables = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const supplier = (r.supplier_name || r.vendor_name || '').trim();
    const invNumber = (r.invoice_number || r.bill_number || '').trim();
    const balance = Number(r.balance || r.amount || 0);

    if (!supplier || !invNumber || balance <= 0) {
      result.errorCount++;
      result.errors.push({ row: i + 1, reason: 'Missing supplier name, invoice number, or positive balance' });
      continue;
    }

    validPayables.push({
      id: `OP-PAY-${Date.now()}-${i}`,
      supplier_name: supplier,
      invoice_number: invNumber,
      amount: Number(r.amount || balance) || balance,
      paid: Number(r.paid || 0) || 0,
      balance: balance,
      due_date: r.due_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    });
  }

  if (validPayables.length > 0) {
    if (!globalThis.__ICON_OPENING_PAYABLES__) {
      globalThis.__ICON_OPENING_PAYABLES__ = [];
    }
    globalThis.__ICON_OPENING_PAYABLES__.push(...validPayables);
    result.successCount = validPayables.length;

    await logAuditEvent({
      userName: authUser.name,
      action: 'BULK_IMPORT_OPENING_PAYABLES',
      module: 'ACCOUNTS',
      details: `Bulk imported ${validPayables.length} opening supplier payables from Tally export`,
    });

    revalidatePath('/dashboard/purchases');
    revalidatePath('/dashboard/import');
    revalidatePath('/dashboard');
  }

  return result;
}
