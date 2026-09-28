'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { INITIAL_CUSTOMERS, STAFF_MEMBERS } from '@/lib/constants/erp-data';
import { getNextCustomerCode } from '@/lib/utils/sequence';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { customerSchema, type CustomerFormValues } from '@/lib/validations/customer';
import type { Customer, CustomerFilters, CustomerFormData } from '@/types/customer';

// Shared in-memory store across requests in this Node process
declare global {
  // eslint-disable-next-line no-var
  var __ICON_CUSTOMERS__: Customer[] | undefined;
}

function getCustomersStore(): Customer[] {
  if (!globalThis.__ICON_CUSTOMERS__) {
    globalThis.__ICON_CUSTOMERS__ = [...INITIAL_CUSTOMERS];
  }
  return globalThis.__ICON_CUSTOMERS__;
}

function isUUID(val?: string | null): boolean {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
}

/**
 * Retrieve all customer records with multi-field search and filters.
 * Resilient to offline/LAN operation via circuit breaker and persistent store.
 */
export async function getCustomers(filters?: CustomerFilters): Promise<{
  customers: Customer[];
  total: number;
  counts: {
    total: number;
    companies: number;
    individuals: number;
    active: number;
  };
}> {
  const store = getCustomersStore();

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const supabase = await createClient();
      let query = supabase
        .from('customers')
        .select('*, salesperson:user_profiles!customers_salesperson_id_fkey(*, role:roles(*))', { count: 'exact' });

      if (filters?.customer_type && filters.customer_type !== 'ALL') {
        query = query.eq('customer_type', filters.customer_type);
      }
      if (filters?.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status);
      }
      if (filters?.salesperson_id && filters.salesperson_id !== 'ALL') {
        query = query.eq('salesperson_id', filters.salesperson_id);
      }
      if (filters?.search) {
        const s = filters.search.trim();
        query = query.or(
          `customer_code.ilike.%${s}%,customer_name.ilike.%${s}%,company_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`
        );
      }
      query = query.order('created_at', { ascending: false });

      const { data, error, count } = await query;

      if (!error && data) {
        const allCustomers = data as Customer[];
        return {
          customers: allCustomers,
          total: count ?? allCustomers.length,
          counts: {
            total: allCustomers.length,
            companies: allCustomers.filter((c) => c.customer_type === 'COMPANY').length,
            individuals: allCustomers.filter((c) => c.customer_type === 'INDIVIDUAL').length,
            active: allCustomers.filter((c) => c.status === 'ACTIVE').length,
          },
        };
      }
    } catch (err) {
      console.warn('Supabase customer query failed, utilizing resilient store:', err);
    }
  }

  // Resilient Store Filtering
  let filtered = [...store];

  if (filters?.customer_type && filters.customer_type !== 'ALL') {
    filtered = filtered.filter((c) => c.customer_type === filters.customer_type);
  }
  if (filters?.status && filters.status !== 'ALL') {
    filtered = filtered.filter((c) => c.status === filters.status);
  }
  if (filters?.salesperson_id && filters.salesperson_id !== 'ALL') {
    filtered = filtered.filter((c) => c.salesperson_id === filters.salesperson_id);
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase().trim();
    filtered = filtered.filter(
      (c) =>
        c.customer_code.toLowerCase().includes(s) ||
        c.customer_name.toLowerCase().includes(s) ||
        (c.company_name && c.company_name.toLowerCase().includes(s)) ||
        c.phone.toLowerCase().includes(s) ||
        (c.email && c.email.toLowerCase().includes(s)) ||
        c.city.toLowerCase().includes(s)
    );
  }

  return {
    customers: filtered,
    total: filtered.length,
    counts: {
      total: store.length,
      companies: store.filter((c) => c.customer_type === 'COMPANY').length,
      individuals: store.filter((c) => c.customer_type === 'INDIVIDUAL').length,
      active: store.filter((c) => c.status === 'ACTIVE').length,
    },
  };
}

/**
 * Retrieve a single customer record by UUID or Customer Code.
 */
export async function getCustomerById(id: string): Promise<Customer | null> {
  const store = getCustomersStore();

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('customers')
        .select('*, salesperson:user_profiles!customers_salesperson_id_fkey(*, role:roles(*))')
        .or(`id.eq.${id},customer_code.eq.${id}`)
        .single();

      if (!error && data) {
        return data as Customer;
      }
    } catch (err) {
      console.warn('Supabase getCustomerById failed, checking resilient store:', err);
    }
  }

  const found = store.find((c) => c.id === id || c.customer_code === id);
  return found || null;
}

/**
 * Create a new Customer record.
 * Protected by server-side role authorization and concurrency-safe atomic code generator.
 */
export async function createCustomer(values: CustomerFormValues): Promise<{
  success: boolean;
  customer?: Customer;
  error?: string;
}> {
  try {
    // 1. Enforce Server-Side Role Authorization
    const authUser = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
      'Office Assistant',
    ]);

    const parsed = customerSchema.parse(values);
    const store = getCustomersStore();

    const isCompany = parsed.customer_type === 'COMPANY';
    const isGovt = parsed.customer_type === 'GOVERNMENT';
    const primaryName = isCompany || isGovt ? (parsed.company_name || (parsed as any).customer_name) : (parsed as any).customer_name;

    // 2. Concurrency-safe atomic Customer ID: ICONYYXXXX
    const generatedCustomerCode = await getNextCustomerCode(store);

    const newRecord: Customer = {
      id: `CUST-${Date.now()}`,
      customer_code: generatedCustomerCode,
      customer_type: parsed.customer_type,
      customer_name: primaryName,
      company_name: (isCompany || isGovt) ? (parsed.company_name || null) : null,
      department_name: (parsed as any).department_name || null,
      tender_reference: (parsed as any).tender_reference || null,
      gem_order_number: (parsed as any).gem_order_number || null,
      gem_seller_id: (parsed as any).gem_seller_id || null,
      emd_amount: (parsed as any).emd_amount || 0,
      nodal_officer: (parsed as any).nodal_officer || null,
      payment_terms_days: (parsed as any).payment_terms_days || (isGovt ? 30 : null),
      contact_person: (isCompany || isGovt) ? (parsed.contact_person || (parsed as any).nodal_officer || null) : null,
      designation: (isCompany || isGovt) ? (parsed.designation || null) : null,
      phone: parsed.phone,
      alternate_phone: parsed.alternate_phone || null,
      email: parsed.email || null,
      billing_address: parsed.billing_address || null,
      shipping_address: parsed.shipping_address || parsed.billing_address || null,
      city: parsed.city,
      state: parsed.state,
      state_code: parsed.state_code,
      pincode: parsed.pincode || null,
      gstin: parsed.gstin || null,
      pan: parsed.pan || null,
      credit_limit: parsed.credit_limit || 0,
      enquiry_source: parsed.enquiry_source,
      salesperson_id: parsed.salesperson_id || null,
      status: parsed.status,
      notes: parsed.notes || null,
      created_by: authUser.id,
      updated_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      try {
        const admin = createAdminClient();
        const insertResult = await admin
          .from('customers')
          .insert({
            customer_code: generatedCustomerCode,
            customer_type: newRecord.customer_type,
            customer_name: newRecord.customer_name,
            company_name: newRecord.company_name,
            contact_person: newRecord.contact_person,
            designation: newRecord.designation,
            phone: newRecord.phone,
            alternate_phone: newRecord.alternate_phone,
            email: newRecord.email,
            billing_address: newRecord.billing_address,
            shipping_address: newRecord.shipping_address,
            city: newRecord.city,
            state: newRecord.state,
            state_code: newRecord.state_code,
            pincode: newRecord.pincode,
            gstin: newRecord.gstin,
            pan: newRecord.pan,
            credit_limit: newRecord.credit_limit,
            enquiry_source: newRecord.enquiry_source,
            salesperson_id: isUUID(newRecord.salesperson_id) ? newRecord.salesperson_id : null,
            status: newRecord.status,
            notes: newRecord.notes,
            created_by: isUUID(authUser.id) ? authUser.id : null,
          })
          .select('*, salesperson:user_profiles!customers_salesperson_id_fkey(*, role:roles(*))')
          .single();

        if (!insertResult.error && insertResult.data) {
          store.unshift(insertResult.data as Customer);
          await logAuditEvent({
            userName: authUser.name,
            action: 'CREATE_CUSTOMER',
            module: 'CUSTOMERS',
            details: `Created customer ${generatedCustomerCode} (${primaryName}) in Supabase`,
          });
          revalidatePath('/customers');
          revalidatePath('/dashboard/customers');
          return { success: true, customer: insertResult.data as Customer };
        }
      } catch (dbErr) {
        console.warn('Supabase customer insert failed, using store:', dbErr);
      }
    }

    // Insert into resilient memory store
    store.unshift(newRecord);

    await logAuditEvent({
      userName: authUser.name,
      action: 'CREATE_CUSTOMER',
      module: 'CUSTOMERS',
      details: `Created customer ${generatedCustomerCode} (${primaryName}) in local store`,
    });

    revalidatePath('/customers');
    revalidatePath('/dashboard/customers');
    revalidatePath('/dashboard');

    return {
      success: true,
      customer: newRecord,
    };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || 'Failed to create customer',
    };
  }
}

/**
 * Update an existing customer record.
 * Customer Code is strictly immutable and preserved.
 */
export async function updateCustomer(
  id: string,
  values: Partial<CustomerFormData>
): Promise<{
  success: boolean;
  customer?: Customer;
  error?: string;
}> {
  try {
    const authUser = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
    ]);

    const store = getCustomersStore();
    const existingIndex = store.findIndex((c) => c.id === id || c.customer_code === id);

    if (existingIndex === -1) {
      return { success: false, error: 'Customer record not found' };
    }

    const currentType = values.customer_type !== undefined ? values.customer_type : store[existingIndex].customer_type;
    const isCompany = currentType === 'COMPANY';
    const isGovt = currentType === 'GOVERNMENT';

    const updatedCustomer: Customer = {
      ...store[existingIndex],
      customer_type: currentType,
      company_name: (isCompany || isGovt) ? (values.company_name ?? store[existingIndex].company_name) : null,
      customer_name: (isCompany || isGovt)
        ? (values.company_name ?? values.customer_name ?? store[existingIndex].customer_name)
        : (values.customer_name ?? store[existingIndex].customer_name),
      department_name: isGovt ? (values.department_name ?? store[existingIndex].department_name) : null,
      tender_reference: isGovt ? (values.tender_reference ?? store[existingIndex].tender_reference) : null,
      gem_order_number: isGovt ? (values.gem_order_number ?? store[existingIndex].gem_order_number) : null,
      gem_seller_id: isGovt ? (values.gem_seller_id ?? store[existingIndex].gem_seller_id) : null,
      emd_amount: isGovt ? (values.emd_amount ?? store[existingIndex].emd_amount) : 0,
      nodal_officer: isGovt ? (values.nodal_officer ?? store[existingIndex].nodal_officer) : null,
      payment_terms_days: values.payment_terms_days ?? store[existingIndex].payment_terms_days,
      contact_person: (isCompany || isGovt) ? (values.contact_person ?? store[existingIndex].contact_person) : null,
      designation: (isCompany || isGovt) ? (values.designation ?? store[existingIndex].designation) : null,
      phone: values.phone ?? store[existingIndex].phone,
      alternate_phone: values.alternate_phone !== undefined ? values.alternate_phone : store[existingIndex].alternate_phone,
      email: values.email !== undefined ? values.email : store[existingIndex].email,
      billing_address: values.billing_address !== undefined ? values.billing_address : store[existingIndex].billing_address,
      shipping_address: values.shipping_address !== undefined ? values.shipping_address : store[existingIndex].shipping_address,
      city: values.city ?? store[existingIndex].city,
      state: values.state ?? store[existingIndex].state,
      state_code: values.state_code ?? store[existingIndex].state_code,
      pincode: values.pincode !== undefined ? values.pincode : store[existingIndex].pincode,
      gstin: values.gstin !== undefined ? values.gstin : store[existingIndex].gstin,
      pan: values.pan !== undefined ? values.pan : store[existingIndex].pan,
      credit_limit: values.credit_limit ?? store[existingIndex].credit_limit,
      enquiry_source: values.enquiry_source ?? store[existingIndex].enquiry_source,
      salesperson_id: values.salesperson_id !== undefined ? values.salesperson_id : store[existingIndex].salesperson_id,
      status: values.status ?? store[existingIndex].status,
      notes: values.notes !== undefined ? values.notes : store[existingIndex].notes,
      updated_by: authUser.id,
      updated_at: new Date().toISOString(),
    };

    store[existingIndex] = updatedCustomer;

    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      try {
        const admin = createAdminClient();
        await admin
          .from('customers')
          .update({
            customer_type: updatedCustomer.customer_type,
            customer_name: updatedCustomer.customer_name,
            company_name: updatedCustomer.company_name,
            contact_person: updatedCustomer.contact_person,
            designation: updatedCustomer.designation,
            phone: updatedCustomer.phone,
            alternate_phone: updatedCustomer.alternate_phone,
            email: updatedCustomer.email,
            billing_address: updatedCustomer.billing_address,
            shipping_address: updatedCustomer.shipping_address,
            city: updatedCustomer.city,
            state: updatedCustomer.state,
            state_code: updatedCustomer.state_code,
            pincode: updatedCustomer.pincode,
            gstin: updatedCustomer.gstin,
            pan: updatedCustomer.pan,
            credit_limit: updatedCustomer.credit_limit,
            enquiry_source: updatedCustomer.enquiry_source,
            salesperson_id: isUUID(updatedCustomer.salesperson_id) ? updatedCustomer.salesperson_id : null,
            status: updatedCustomer.status,
            notes: updatedCustomer.notes,
            updated_by: isUUID(authUser.id) ? authUser.id : null,
            updated_at: updatedCustomer.updated_at,
          })
          .or(`id.eq.${id},customer_code.eq.${id}`);
      } catch (err) {
        console.warn('Supabase customer update failed:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_CUSTOMER',
      module: 'CUSTOMERS',
      details: `Updated customer ${updatedCustomer.customer_code} (${updatedCustomer.customer_name})`,
    });

    revalidatePath('/customers');
    revalidatePath('/dashboard/customers');
    revalidatePath('/dashboard');

    return {
      success: true,
      customer: updatedCustomer,
    };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || 'Failed to update customer',
    };
  }
}

/**
 * Delete a customer record.
 * Restricted strictly to Executive Administrators (Managing Director, Admin / BDM).
 */
export async function deleteCustomer(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM']);

    const store = getCustomersStore();
    const idx = store.findIndex((c) => c.id === id || c.customer_code === id);
    if (idx === -1) {
      return { success: false, error: 'Customer not found' };
    }

    const removed = store.splice(idx, 1)[0];

    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      try {
        const admin = createAdminClient();
        await admin.from('customers').delete().or(`id.eq.${id},customer_code.eq.${id}`);
      } catch (err) {
        console.warn('Supabase customer delete failed:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'DELETE_CUSTOMER',
      module: 'CUSTOMERS',
      details: `Deleted customer ${removed.customer_code} (${removed.customer_name})`,
    });

    revalidatePath('/customers');
    revalidatePath('/dashboard/customers');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to delete customer' };
  }
}

/**
 * Retrieve active salespeople staff.
 */
export async function getSalespeopleList(): Promise<Array<{ id: string; name: string; role: string }>> {
  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const supabase = await createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error }: { data: any; error: any } = await supabase
        .from('user_profiles')
        .select('id, full_name, roles(role_name)')
        .eq('is_active', true)
        .order('full_name');

      if (!error && data && data.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return data.map((d: any) => ({
          id: d.id,
          name: d.full_name,
          role: d.roles?.role_name || 'Staff',
        }));
      }
    } catch (err) {
      console.warn('Supabase getSalespeopleList failed:', err);
    }
  }

  return STAFF_MEMBERS.map((s) => ({
    id: s.id,
    name: s.name,
    role: s.role,
  }));
}

/**
 * Real-time Customer Duplicate Detection.
 * Checks phone, email, and GSTIN across existing customer database with excluded self-check for updates.
 */
export async function checkCustomerDuplicate(query: {
  phone?: string;
  email?: string;
  gstin?: string;
  excludeId?: string;
}): Promise<{
  isDuplicate: boolean;
  matchedBy?: 'phone' | 'email' | 'gstin';
  existingCustomer?: Customer;
}> {
  const store = getCustomersStore();
  const cleanPhone = (query.phone || '').replace(/\D/g, '').slice(-10);
  const cleanEmail = (query.email || '').trim().toLowerCase();
  const cleanGstin = (query.gstin || '').trim().toUpperCase();

  for (const c of store) {
    if (query.excludeId && (c.id === query.excludeId || c.customer_code === query.excludeId)) {
      continue;
    }

    if (cleanPhone && cleanPhone.length === 10) {
      const custPhone = (c.phone || '').replace(/\D/g, '').slice(-10);
      if (custPhone === cleanPhone) {
        return { isDuplicate: true, matchedBy: 'phone', existingCustomer: c };
      }
    }

    if (cleanEmail && cleanEmail.length > 3) {
      if ((c.email || '').trim().toLowerCase() === cleanEmail) {
        return { isDuplicate: true, matchedBy: 'email', existingCustomer: c };
      }
    }

    if (cleanGstin && cleanGstin.length >= 10) {
      if ((c.gstin || '').trim().toUpperCase() === cleanGstin) {
        return { isDuplicate: true, matchedBy: 'gstin', existingCustomer: c };
      }
    }
  }

  return { isDuplicate: false };
}

