'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import type { DocumentSettings } from '@/types/company-settings';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_DOCUMENT_SETTINGS__: DocumentSettings | undefined;
}

const INITIAL_DOCUMENT_SETTINGS: DocumentSettings = {
  id: 'DOC-SETTINGS-01',
  prefixes: {
    enquiry: 'ENQ-',
    quotation: 'QT-',
    sales_order: 'ORD-',
    invoice: 'INV-',
    purchase_order: 'PO-',
    delivery_challan: 'DC-',
    service: 'SRV-',
    customer: 'ICON',
  },
  standard_terms: {
    quotation_terms: `1. Prices are inclusive of 18% GST unless specified otherwise.
2. Quotation is valid for 15 days from issue date.
3. Delivery within 5-7 business days from confirmed purchase order.
4. Goods once sold will not be taken back without prior authorization.
5. All disputes subject to Hyderabad jurisdiction.`,
    invoice_terms: `1. Payment is due strictly per agreed commercial terms.
2. Interest @ 18% p.a. will be charged on overdue payments beyond due date.
3. Warranty as per manufacturer terms; standard 1 year onsite support.
4. All disputes subject to Hyderabad jurisdiction.`,
    payment_instructions: `Please transfer funds via NEFT/RTGS to our official IDBI Bank Current Account and share the UTR reference number for immediate receipt issuance.`,
  },
  print_settings: {
    show_header_logo: true,
    show_bank_details: true,
    show_authorized_stamp: true,
    footer_disclaimer: 'This is a computer-generated commercial document issued by ICON TECH PRO under GST Rule 46.',
  },
};

function getDocSettingsStore(): DocumentSettings {
  if (!globalThis.__ICON_DOCUMENT_SETTINGS__) {
    globalThis.__ICON_DOCUMENT_SETTINGS__ = JSON.parse(JSON.stringify(INITIAL_DOCUMENT_SETTINGS));
  }
  return globalThis.__ICON_DOCUMENT_SETTINGS__!;
}

/**
 * Fetch Document Prefixes and Standardized Print Terms.
 * Accessible to all authenticated users for document creation and printing.
 */
export async function getDocumentSettings(): Promise<DocumentSettings> {
  const store = getDocSettingsStore();

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('document_settings')
        .select('*')
        .eq('id', 'DOC-SETTINGS-01')
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          prefixes: data.prefixes || store.prefixes,
          standard_terms: data.standard_terms || store.standard_terms,
          print_settings: data.print_settings || store.print_settings,
          created_at: data.created_at,
          updated_at: data.updated_at,
          updated_by: data.updated_by,
        };
      }
    } catch (err) {
      console.warn('Supabase getDocumentSettings fallback to memory store:', err);
    }
  }

  return store;
}

/**
 * Update Document Prefixes and Standard Terms.
 * Restricted strictly to Managing Director and Admin / BDM.
 * Guaranteed sequence safety: Updates apply to future generations without altering historical records.
 */
export async function updateDocumentSettings(
  payload: Partial<Omit<DocumentSettings, 'id' | 'created_at'>>
): Promise<{ success: boolean; data?: DocumentSettings; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);
    const store = getDocSettingsStore();

    // Sanitize prefixes if provided
    if (payload.prefixes) {
      for (const [key, val] of Object.entries(payload.prefixes)) {
        if (!val || typeof val !== 'string' || !val.trim()) {
          return { success: false, error: `Prefix for ${key} cannot be empty.` };
        }
      }
    }

    const updated: DocumentSettings = {
      ...store,
      prefixes: {
        ...store.prefixes,
        ...(payload.prefixes || {}),
      },
      standard_terms: {
        ...store.standard_terms,
        ...(payload.standard_terms || {}),
      },
      print_settings: {
        ...store.print_settings,
        ...(payload.print_settings || {}),
      },
      updated_at: new Date().toISOString(),
      updated_by: actor.name,
    };

    globalThis.__ICON_DOCUMENT_SETTINGS__ = updated;

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('document_settings').upsert({
          id: 'DOC-SETTINGS-01',
          prefixes: updated.prefixes,
          standard_terms: updated.standard_terms,
          print_settings: updated.print_settings,
          updated_at: updated.updated_at,
          updated_by: updated.updated_by,
        });
      } catch (err) {
        console.warn('Supabase updateDocumentSettings fallback to memory store:', err);
      }
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'DOCUMENT_SETTINGS_UPDATED',
      module: 'ADMINISTRATION',
      details: `Updated document prefixes (QTN: ${updated.prefixes.quotation}, INV: ${updated.prefixes.invoice}, ORD: ${updated.prefixes.sales_order}) and standard terms`,
    });

    revalidatePath('/dashboard/settings/document-settings');
    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/quotations');
    revalidatePath('/dashboard/invoices');

    return { success: true, data: updated };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update document settings' };
  }
}
