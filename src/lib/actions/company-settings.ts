'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import type { CompanySettings } from '@/types/company-settings';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_COMPANY_SETTINGS__: CompanySettings | undefined;
}

const INITIAL_COMPANY_SETTINGS: CompanySettings = {
  id: 'ORG-ICON-01',
  legal_name: 'ICON TECH PRO PRIVATE LIMITED',
  trade_name: 'ICON TECH PRO',
  gstin: '36AAACI1234F1Z5',
  pan: 'AAACI1234F',
  msme_number: 'UDYAM-TS-02-0012345',
  cin_number: 'U72900TG2026PTC123456',
  gst_state: 'Telangana (36)',
  registered_address: 'Ameer Estate, 503 A Block, SR Nagar, Hyderabad, Telangana - 500038',
  office_address: 'Ameer Estate, 503 A Block, SR Nagar, Hyderabad, Telangana - 500038',
  phone: '+91 80999 09997',
  email: 'info@icontechpro.in',
  website: 'www.icontechpro.in',
  authorized_signatory: 'Borra Narsimulu',
  commercial_defaults: {
    default_gst_rate: 18,
    payment_terms: '100% advance against proforma or 30 days credit for approved corporate accounts',
    quotation_validity_days: 15,
    warranty_terms: '1 Year Comprehensive Onsite Warranty standard on all AV and IT equipment',
    delivery_terms: 'Ex-stock immediate dispatch or 5-7 business days for sourced distributor products',
    freight_terms: 'Standard freight included within Hyderabad; actuals applicable for outstation dispatches',
    installation_terms: 'Standard installation and demo included by certified ICON TECH PRO field technicians',
  },
  bank_details: {
    bank_name: 'IDBI Bank',
    account_name: 'ICON TECH PRO PRIVATE LIMITED',
    account_number: '0123102000012345',
    ifsc_code: 'IBKL0000123',
    branch: 'SR Nagar, Hyderabad',
    account_type: 'Current Account',
    upi_id: 'icontechpro@idbi',
  },
};

function getSettingsStore(): CompanySettings {
  if (!globalThis.__ICON_COMPANY_SETTINGS__) {
    globalThis.__ICON_COMPANY_SETTINGS__ = JSON.parse(JSON.stringify(INITIAL_COMPANY_SETTINGS));
  }
  return globalThis.__ICON_COMPANY_SETTINGS__!;
}

/**
 * Fetch Company Identity, Commercial Defaults, and Bank Details.
 * Accessible to all authenticated users for document rendering.
 */
export async function getCompanySettings(): Promise<CompanySettings> {
  const store = getSettingsStore();

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('company_settings')
        .select('*')
        .eq('id', 'ORG-ICON-01')
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          legal_name: data.legal_name,
          trade_name: data.trade_name,
          gstin: data.gstin,
          pan: data.pan,
          msme_number: data.msme_number,
          cin_number: data.cin_number,
          gst_state: data.gst_state,
          registered_address: data.registered_address,
          office_address: data.office_address,
          phone: data.phone,
          email: data.email,
          website: data.website,
          authorized_signatory: data.authorized_signatory,
          commercial_defaults: data.commercial_defaults || store.commercial_defaults,
          bank_details: data.bank_details || store.bank_details,
          created_at: data.created_at,
          updated_at: data.updated_at,
          updated_by: data.updated_by,
        };
      }
    } catch (err) {
      console.warn('Supabase getCompanySettings fallback to memory store:', err);
    }
  }

  return store;
}

/**
 * Update Company Settings & Commercial Defaults.
 * Strictly restricted to Managing Director and Admin / BDM.
 */
export async function updateCompanySettings(
  payload: Partial<Omit<CompanySettings, 'id' | 'created_at'>>
): Promise<{ success: boolean; data?: CompanySettings; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const store = getSettingsStore();

    // Field-level sanitization & validation
    if (payload.legal_name !== undefined && !payload.legal_name.trim()) {
      return { success: false, error: 'Legal Company Name cannot be empty.' };
    }
    if (payload.gstin !== undefined) {
      const cleanGstin = payload.gstin.trim().toUpperCase();
      if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleanGstin)) {
        return { success: false, error: 'Invalid GSTIN format (must be 15 alphanumeric characters).' };
      }
    }
    if (payload.pan !== undefined) {
      const cleanPan = payload.pan.trim().toUpperCase();
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
        return { success: false, error: 'Invalid PAN format (must be 10 alphanumeric characters).' };
      }
    }

    const updated: CompanySettings = {
      ...store,
      ...payload,
      commercial_defaults: {
        ...store.commercial_defaults,
        ...(payload.commercial_defaults || {}),
      },
      bank_details: {
        ...store.bank_details,
        ...(payload.bank_details || {}),
      },
      updated_at: new Date().toISOString(),
      updated_by: actor.name,
    };

    globalThis.__ICON_COMPANY_SETTINGS__ = updated;

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('company_settings').upsert({
          id: 'ORG-ICON-01',
          legal_name: updated.legal_name,
          trade_name: updated.trade_name,
          gstin: updated.gstin,
          pan: updated.pan,
          msme_number: updated.msme_number,
          cin_number: updated.cin_number,
          gst_state: updated.gst_state,
          registered_address: updated.registered_address,
          office_address: updated.office_address,
          phone: updated.phone,
          email: updated.email,
          website: updated.website,
          authorized_signatory: updated.authorized_signatory,
          commercial_defaults: updated.commercial_defaults,
          bank_details: updated.bank_details,
          updated_at: updated.updated_at,
          updated_by: updated.updated_by,
        });
      } catch (err) {
        console.warn('Supabase updateCompanySettings fallback to memory store:', err);
      }
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'COMPANY_SETTINGS_UPDATED',
      module: 'ADMINISTRATION',
      details: `Updated company identity and commercial defaults for ${updated.trade_name} (GSTIN: ${updated.gstin})`,
    });

    revalidatePath('/dashboard/settings/company');
    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/quotations');
    revalidatePath('/dashboard/invoices');

    return { success: true, data: updated };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update company settings' };
  }
}
