'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { INITIAL_ENQUIRIES } from '@/lib/constants/erp-data';
import { getNextEnquiryNumber } from '@/lib/utils/sequence';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { createCustomer } from '@/lib/actions/customers';
import type { Enquiry, EnquiryStatus } from '@/types/erp';
import type { EnquiryFormValues } from '@/lib/validations/erp';

// Shared in-memory store across requests in this Node process
declare global {
  // eslint-disable-next-line no-var
  var __ICON_ENQUIRIES__: Enquiry[] | undefined;
}

function getEnquiriesStore(): Enquiry[] {
  if (!globalThis.__ICON_ENQUIRIES__) {
    globalThis.__ICON_ENQUIRIES__ = [...INITIAL_ENQUIRIES];
  }
  return globalThis.__ICON_ENQUIRIES__;
}

export async function getEnquiries(filters?: {
  status?: string;
  search?: string;
  salesperson?: string;
}): Promise<{ enquiries: Enquiry[]; total: number }> {
  const store = getEnquiriesStore();

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const supabase = await createClient();
      let query = supabase.from('enquiries').select('*', { count: 'exact' });

      if (filters?.status && filters.status !== 'ALL') {
        query = query.eq('status', filters.status);
      }
      if (filters?.salesperson && filters.salesperson !== 'ALL') {
        query = query.eq('salesperson_name', filters.salesperson);
      }
      if (filters?.search) {
        const s = filters.search.trim();
        query = query.or(
          `enquiry_number.ilike.%${s}%,customer_name.ilike.%${s}%,company_name.ilike.%${s}%,phone.ilike.%${s}%,product_category.ilike.%${s}%`
        );
      }

      query = query.order('created_at', { ascending: false });
      const { data, error, count } = await query;

      if (!error && data) {
        return { enquiries: data as Enquiry[], total: count ?? data.length };
      }
    } catch (err) {
      console.warn('Supabase enquiry query failed, falling back to store:', err);
    }
  }

  // Filter in-memory store
  let filtered = [...store];
  if (filters?.status && filters.status !== 'ALL') {
    filtered = filtered.filter((e) => e.status === filters.status);
  }
  if (filters?.salesperson && filters.salesperson !== 'ALL') {
    filtered = filtered.filter((e) => e.salesperson_name === filters.salesperson);
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase().trim();
    filtered = filtered.filter(
      (e) =>
        e.enquiry_number.toLowerCase().includes(s) ||
        e.customer_name.toLowerCase().includes(s) ||
        (e.company_name && e.company_name.toLowerCase().includes(s)) ||
        e.product_category.toLowerCase().includes(s) ||
        e.phone.toLowerCase().includes(s)
    );
  }

  return { enquiries: filtered, total: filtered.length };
}

export async function createEnquiry(
  payload: EnquiryFormValues
): Promise<{
  success: boolean;
  data?: Enquiry;
  customer_id?: string;
  customer_code?: string;
  is_new_customer?: boolean;
  error?: string;
}> {
  try {
    const authUser = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
      'Office Assistant',
    ]);

    const store = getEnquiriesStore();
    const generatedNumber = await getNextEnquiryNumber();

    const newEnquiry: Enquiry = {
      id: `ENQ-${Date.now()}`,
      enquiry_number: generatedNumber,
      customer_id: payload.customer_id,
      customer_name: payload.customer_name,
      company_name: payload.company_name || undefined,
      customer_type: payload.customer_type,
      phone: payload.phone,
      email: payload.email || undefined,
      source: payload.source as any,
      salesperson_name: payload.salesperson_name || authUser.name,
      product_category: payload.product_category,
      requirement_summary: payload.requirement_summary,
      estimated_budget: payload.estimated_budget,
      status: (payload.status as EnquiryStatus) || 'Enquiry',
      follow_up_date: payload.follow_up_date || undefined,
      site_visit_required: payload.site_visit_required,
      prospect_dossier_id: payload.prospect_dossier_id || undefined,
      created_at: new Date().toISOString(),
      notes: [
        {
          text: `Enquiry created by ${authUser.name}. Requirement: ${payload.requirement_summary}`,
          author: authUser.name,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        },
      ],
    };

    let validCustomerId = payload.customer_id;
    let customerCode = '';
    let isNewCustomer = false;

    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      try {
        const admin = createAdminClient();
        const isUUID = (val?: string | null) =>
          Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

        // 1. Search for existing customer to reuse by phone or name/company
        if (!isUUID(validCustomerId) || validCustomerId === 'CUST-NEW') {
          const cleanPhone = (payload.phone || '').replace(/\D/g, '').slice(-10);
          
          let matchedCust: any = null;
          if (cleanPhone.length >= 10) {
            const { data: phoneMatch } = await admin
              .from('customers')
              .select('id, customer_code, customer_name, company_name')
              .ilike('phone', `%${cleanPhone}%`)
              .limit(1)
              .maybeSingle();
            matchedCust = phoneMatch;
          }

          if (!matchedCust && payload.customer_name) {
            const { data: nameMatch } = await admin
              .from('customers')
              .select('id, customer_code, customer_name, company_name')
              .ilike('customer_name', payload.customer_name.trim())
              .limit(1)
              .maybeSingle();
            matchedCust = nameMatch;
          }

          if (matchedCust?.id) {
            validCustomerId = matchedCust.id;
            customerCode = matchedCust.customer_code;
            isNewCustomer = false;
          } else {
            // Customer does not exist -> Create new customer record
            const newCustData: any = payload.customer_type === 'COMPANY'
              ? {
                  customer_type: 'COMPANY',
                  company_name: payload.company_name || payload.customer_name,
                  contact_person: payload.customer_name,
                  phone: (payload.phone || '').replace(/\D/g, '').slice(-10) || '9849012345',
                  email: payload.email || undefined,
                  billing_address: 'Hyderabad, Telangana',
                  city: 'Hyderabad',
                  state: 'Telangana',
                  state_code: '36',
                  status: 'ACTIVE',
                }
              : {
                  customer_type: 'INDIVIDUAL',
                  customer_name: payload.customer_name,
                  phone: (payload.phone || '').replace(/\D/g, '').slice(-10) || '9849012345',
                  email: payload.email || undefined,
                  billing_address: 'Hyderabad, Telangana',
                  city: 'Hyderabad',
                  state: 'Telangana',
                  state_code: '36',
                  status: 'ACTIVE',
                };
            const custRes = await createCustomer(newCustData);
            if (custRes.success && custRes.customer) {
              validCustomerId = custRes.customer.id;
              customerCode = custRes.customer.customer_code;
              isNewCustomer = true;
            }
          }
        }

        const insertPayload = {
          enquiry_number: generatedNumber,
          customer_id: isUUID(validCustomerId) ? validCustomerId : null,
          customer_name: payload.customer_name,
          company_name: payload.company_name || null,
          customer_type: payload.customer_type,
          phone: payload.phone,
          email: payload.email || null,
          source: payload.source,
          salesperson_name: newEnquiry.salesperson_name,
          product_category: payload.product_category,
          requirement_summary: payload.requirement_summary,
          estimated_budget: payload.estimated_budget,
          status: payload.status || 'Enquiry',
          follow_up_date: payload.follow_up_date || null,
          site_visit_required: payload.site_visit_required,
          prospect_dossier_id: payload.prospect_dossier_id || null,
        };

        const { data, error } = await admin.from('enquiries').insert([insertPayload]).select().single();
        if (!error && data) {
          store.unshift(data as Enquiry);
          await logAuditEvent({
            userName: authUser.name,
            action: 'CREATE_ENQUIRY',
            module: 'ENQUIRIES',
            details: `Created enquiry ${generatedNumber} for ${payload.customer_name} (Cust: ${customerCode || 'Auto'})`,
          });
          revalidatePath('/dashboard/enquiries');
          revalidatePath('/dashboard/customers');
          revalidatePath('/dashboard');
          return {
            success: true,
            data: data as Enquiry,
            customer_id: validCustomerId,
            customer_code: customerCode,
            is_new_customer: isNewCustomer,
          };
        }
      } catch (err: any) {
        console.warn('Error inserting enquiry into DB:', err);
      }
    }

    // Update memory store
    store.unshift(newEnquiry);

    await logAuditEvent({
      userName: authUser.name,
      action: 'CREATE_ENQUIRY',
      module: 'ENQUIRIES',
      details: `Created enquiry ${generatedNumber} for ${payload.customer_name}`,
    });

    revalidatePath('/dashboard/enquiries');
    return {
      success: true,
      data: newEnquiry,
      customer_id: validCustomerId,
      customer_code: customerCode,
      is_new_customer: isNewCustomer,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to create enquiry' };
  }
}

export async function updateEnquiryStatus(
  id: string,
  status: EnquiryStatus,
  lossReason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
    ]);

    const store = getEnquiriesStore();

    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      try {
        const admin = createAdminClient();
        await admin
          .from('enquiries')
          .update({ status, loss_reason: lossReason || null, updated_at: new Date().toISOString() })
          .or(`id.eq.${id},enquiry_number.eq.${id}`);
      } catch (err) {
        console.warn('Supabase updateEnquiryStatus failed:', err);
      }
    }

    const found = store.find((e) => e.id === id || e.enquiry_number === id);
    if (found) {
      found.status = status;
      if (lossReason) found.loss_reason = lossReason;
      if (!found.notes) found.notes = [];
      found.notes.push({
        text: `Status updated to "${status}"${lossReason ? ` (Reason: ${lossReason})` : ''}`,
        author: authUser.name,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      });
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_ENQUIRY_STATUS',
      module: 'ENQUIRIES',
      details: `Updated enquiry ${id} status to ${status}`,
    });

    revalidatePath('/dashboard/enquiries');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update enquiry status' };
  }
}

/**
 * Update an existing Enquiry record.
 * Enquiry Number is strictly immutable and preserved.
 */
export async function updateEnquiry(
  id: string,
  values: Partial<{
    customer_name: string;
    company_name: string;
    customer_type: 'COMPANY' | 'INDIVIDUAL' | 'GOVERNMENT';
    phone: string;
    email: string;
    source: string;
    salesperson_name: string;
    product_category: string;
    requirement_summary: string;
    estimated_budget: number;
    follow_up_date: string;
    site_visit_required: boolean;
    status: EnquiryStatus;
    notes: string;
  }>
): Promise<{ success: boolean; data?: Enquiry; error?: string }> {
  try {
    const authUser = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
    ]);

    const store = getEnquiriesStore();
    const found = store.find((e) => e.id === id || e.enquiry_number === id);
    if (!found) {
      return { success: false, error: 'Enquiry record not found' };
    }

    if (values.customer_name !== undefined) found.customer_name = values.customer_name;
    if (values.company_name !== undefined) found.company_name = values.company_name;
    if (values.customer_type !== undefined) found.customer_type = values.customer_type;
    if (values.phone !== undefined) found.phone = values.phone;
    if (values.email !== undefined) found.email = values.email;
    if (values.source !== undefined) found.source = values.source as any;
    if (values.salesperson_name !== undefined) found.salesperson_name = values.salesperson_name;
    if (values.product_category !== undefined) found.product_category = values.product_category;
    if (values.requirement_summary !== undefined) found.requirement_summary = values.requirement_summary;
    if (values.estimated_budget !== undefined) found.estimated_budget = Number(values.estimated_budget) || 0;
    if (values.follow_up_date !== undefined) found.follow_up_date = values.follow_up_date;
    if (values.site_visit_required !== undefined) found.site_visit_required = values.site_visit_required;
    if (values.status !== undefined) found.status = values.status;

    if (values.notes) {
      if (!found.notes) found.notes = [];
      found.notes.push({
        text: `[Correction by ${authUser.name}]: ${values.notes}`,
        author: authUser.name,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      });
    }

    const isOnline = await isSupabaseAvailable();
    if (isOnline) {
      try {
        const admin = createAdminClient();
        await admin
          .from('enquiries')
          .update({
            customer_name: found.customer_name,
            company_name: found.company_name || null,
            customer_type: found.customer_type,
            phone: found.phone,
            email: found.email || null,
            source: found.source,
            salesperson_name: found.salesperson_name,
            product_category: found.product_category,
            requirement_summary: found.requirement_summary,
            estimated_budget: found.estimated_budget,
            follow_up_date: found.follow_up_date || null,
            site_visit_required: found.site_visit_required,
            status: found.status,
            updated_at: new Date().toISOString(),
          })
          .or(`id.eq.${id},enquiry_number.eq.${id}`);
      } catch (err) {
        console.warn('Supabase updateEnquiry failed, using store:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'UPDATE_ENQUIRY',
      module: 'ENQUIRIES',
      details: `Updated enquiry ${found.enquiry_number} for ${found.customer_name} (Category: ${found.product_category}, Budget: ₹${found.estimated_budget})`,
    });

    revalidatePath('/dashboard/enquiries');
    revalidatePath('/dashboard/follow-ups');
    revalidatePath('/dashboard');

    return { success: true, data: found };
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Failed to update enquiry' };
  }
}

