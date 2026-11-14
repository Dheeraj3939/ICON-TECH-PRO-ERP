'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth, requireRole, getAuthenticatedUser } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import { getQuotations } from '@/lib/actions/quotations';
import { getOrders } from '@/lib/actions/orders';
import { getInvoices } from '@/lib/actions/billing';
import { getProformaInvoices } from '@/lib/actions/proforma';
import { getDeliveryChallans } from '@/lib/actions/delivery-challans';
import { getPurchaseOrders } from '@/lib/actions/procurement';
import { getDocuments } from '@/lib/actions/documents';
import type {
  SignedDocumentRecord,
  CustomerArchiveDocument,
  BusinessDocumentType,
} from '@/types/documents';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_SIGNED_DOCS__: SignedDocumentRecord[] | undefined;
}

const SEED_SIGNED_DOCS: SignedDocumentRecord[] = [
  {
    id: 'SGN-2026-0001',
    document_type: 'QUOTATION',
    document_number: 'ICON/26-27/QT-0001',
    customer_id: 'CUST-CYIENT-001',
    customer_name: 'Cyient Technologies Hyderabad Campus',
    company_name: 'Cyient Limited',
    related_transaction_number: 'ICON/26-27/ORD-0001',
    original_generated_pdf_url: '/docs/quotations/ICON_26-27_QT-0001.pdf',
    signed_scan_file_url: '/docs/signed/Cyient_Signed_QT0001_Stamped.pdf',
    signed_scan_file_name: 'Cyient_Signed_QT0001_Stamped.pdf',
    file_size_bytes: 1420000,
    mime_type: 'application/pdf',
    signed_date: '2026-08-26',
    uploaded_at: '2026-08-26T14:30:00Z',
    uploaded_by_name: 'B V Dheeraj Reddy',
    signer_name: 'Mr. Venkat Rao',
    signer_designation: 'Procurement Director, Cyient',
    has_company_stamp: true,
    version: 1,
    notes: 'Physical copy countersigned and stamped by Cyient procurement director.',
    audit_history: [
      {
        action: 'UPLOAD_SIGNED_DOCUMENT',
        timestamp: '2026-08-26T14:30:00Z',
        actor: 'B V Dheeraj Reddy',
        details: 'Uploaded signed and stamped quotation scan. Linked to QT-0001 and ORD-0001.',
      },
    ],
  },
  {
    id: 'SGN-2026-0002',
    document_type: 'DELIVERY_CHALLAN',
    document_number: 'ITP/DC/2026-27/0001',
    customer_id: 'CUST-CYIENT-001',
    customer_name: 'Cyient Technologies Hyderabad Campus',
    company_name: 'Cyient Limited',
    related_transaction_number: 'ICON/26-27/ORD-0001',
    original_generated_pdf_url: '/docs/challans/ITP_DC_2026-27_0001.pdf',
    signed_scan_file_url: '/docs/signed/Cyient_Delivery_Challan_Acknowledged.pdf',
    signed_scan_file_name: 'Cyient_Delivery_Challan_Acknowledged.pdf',
    file_size_bytes: 890000,
    mime_type: 'application/pdf',
    signed_date: '2026-08-28',
    uploaded_at: '2026-08-28T17:15:00Z',
    uploaded_by_name: 'B Vineet Babu',
    signer_name: 'K. Ramesh',
    signer_designation: 'AV Facility In-charge',
    has_company_stamp: true,
    version: 1,
    notes: 'Acknowledged POD challan with gate-pass entry stamp.',
    audit_history: [
      {
        action: 'UPLOAD_SIGNED_DOCUMENT',
        timestamp: '2026-08-28T17:15:00Z',
        actor: 'B Vineet Babu',
        details: 'Uploaded physical delivery acknowledgement challan scan with site security stamp.',
      },
    ],
  },
];

function getSignedDocsStore(): SignedDocumentRecord[] {
  if (!globalThis.__ICON_SIGNED_DOCS__) {
    globalThis.__ICON_SIGNED_DOCS__ = [...SEED_SIGNED_DOCS];
  }
  return globalThis.__ICON_SIGNED_DOCS__;
}

/**
 * Upload a signed physical document scan.
 * Guarantees that the original generated PDF is never overwritten.
 * Records upload date, uploaded by, signer details, stamp presence, and audit trail.
 */
export async function uploadSignedDocument(payload: {
  document_type: BusinessDocumentType;
  document_number: string;
  customer_id: string;
  customer_name: string;
  company_name?: string;
  related_transaction_id?: string;
  related_transaction_number?: string;
  original_generated_pdf_url?: string;
  signed_scan_file_url: string;
  signed_scan_file_name: string;
  file_size_bytes?: number;
  mime_type?: string;
  signed_date?: string;
  signer_name?: string;
  signer_designation?: string;
  has_company_stamp?: boolean;
  notes?: string;
}): Promise<{ success: boolean; data?: SignedDocumentRecord; error?: string }> {
  try {
    const actor = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
      'Accounts',
      'Office Assistant',
    ]);

    if (!payload.document_number || !payload.document_number.trim()) {
      return { success: false, error: 'Document number is required' };
    }
    if (!payload.signed_scan_file_url || !payload.signed_scan_file_name) {
      return { success: false, error: 'Signed document file is required' };
    }

    const store = getSignedDocsStore();
    const existing = store.filter((d) => d.document_number === payload.document_number);
    const version = existing.length + 1;

    const newRecord: SignedDocumentRecord = {
      id: `SGN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      document_type: payload.document_type,
      document_number: payload.document_number.trim(),
      customer_id: payload.customer_id,
      customer_name: payload.customer_name.trim(),
      company_name: payload.company_name?.trim(),
      related_transaction_id: payload.related_transaction_id,
      related_transaction_number: payload.related_transaction_number,
      original_generated_pdf_url: payload.original_generated_pdf_url,
      signed_scan_file_url: payload.signed_scan_file_url,
      signed_scan_file_name: payload.signed_scan_file_name,
      file_size_bytes: payload.file_size_bytes || 0,
      mime_type: payload.mime_type || 'application/pdf',
      signed_date: payload.signed_date || new Date().toISOString().split('T')[0],
      uploaded_at: new Date().toISOString(),
      uploaded_by_id: actor.id,
      uploaded_by_name: actor.name,
      signer_name: payload.signer_name?.trim(),
      signer_designation: payload.signer_designation?.trim(),
      has_company_stamp: payload.has_company_stamp ?? true,
      version,
      notes: payload.notes?.trim(),
      audit_history: [
        {
          action: 'UPLOAD_SIGNED_DOCUMENT',
          timestamp: new Date().toISOString(),
          actor: actor.name,
          details: `Uploaded signed physical copy v${version} for ${payload.document_type} ${payload.document_number}${payload.signer_name ? ` (Signer: ${payload.signer_name})` : ''}`,
        },
      ],
    };

    store.unshift(newRecord);

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('signed_documents').insert({
          document_type: newRecord.document_type,
          document_number: newRecord.document_number,
          customer_id: newRecord.customer_id,
          customer_name: newRecord.customer_name,
          company_name: newRecord.company_name,
          related_transaction_id: newRecord.related_transaction_id,
          related_transaction_number: newRecord.related_transaction_number,
          original_generated_pdf_url: newRecord.original_generated_pdf_url,
          signed_scan_file_url: newRecord.signed_scan_file_url,
          signed_scan_file_name: newRecord.signed_scan_file_name,
          file_size_bytes: newRecord.file_size_bytes,
          mime_type: newRecord.mime_type,
          signed_date: newRecord.signed_date,
          uploaded_by_id: newRecord.uploaded_by_id,
          uploaded_by_name: newRecord.uploaded_by_name,
          signer_name: newRecord.signer_name,
          signer_designation: newRecord.signer_designation,
          has_company_stamp: newRecord.has_company_stamp,
          version: newRecord.version,
          notes: newRecord.notes,
          audit_history: newRecord.audit_history,
        });
      } catch (err) {
        console.warn('Supabase signed_documents fallback to memory:', err);
      }
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'UPLOAD_SIGNED_DOCUMENT',
      module: 'DOCUMENT_ARCHIVE',
      details: `Uploaded signed document ${newRecord.signed_scan_file_name} for ${newRecord.document_number} (${newRecord.customer_name})`,
    });

    revalidatePath('/dashboard/customers');
    revalidatePath('/dashboard/documents');
    return { success: true, data: newRecord };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to upload signed document' };
  }
}

/**
 * Retrieve signed document records by document number or customer ID.
 */
export async function getSignedDocuments(filters?: {
  document_number?: string;
  customer_id?: string;
  document_type?: string;
}): Promise<SignedDocumentRecord[]> {
  await requireAuth();
  const store = getSignedDocsStore();

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      let query = admin.from('signed_documents').select('*');
      if (filters?.document_number) query = query.eq('document_number', filters.document_number);
      if (filters?.customer_id) query = query.eq('customer_id', filters.customer_id);
      if (filters?.document_type) query = query.eq('document_type', filters.document_type);

      const { data, error } = await query.order('uploaded_at', { ascending: false });
      if (!error && data) {
        return data as SignedDocumentRecord[];
      }
    } catch {
      // In-memory fallback
    }
  }

  let list = [...store];
  if (filters?.document_number) list = list.filter((d) => d.document_number === filters.document_number);
  if (filters?.customer_id) list = list.filter((d) => d.customer_id === filters.customer_id);
  if (filters?.document_type) list = list.filter((d) => d.document_type === filters.document_type);
  return list;
}

/**
 * Customer 360 Central Document Archive Aggregator:
 * Aggregates all documents related to a customer:
 * - Quotations & revisions
 * - Proforma invoices
 * - Delivery challans
 * - Tax invoices
 * - Purchase orders
 * - Signed & stamped scanned documents
 * - Enterprise documents
 */
export async function getCustomerArchiveDocuments(
  customerId: string,
  customerName?: string
): Promise<CustomerArchiveDocument[]> {
  await requireAuth();

  const [
    quoteRes,
    orderRes,
    invRes,
    proformaRes,
    challanRes,
    signedDocs,
    enterpriseDocs,
  ] = await Promise.all([
    getQuotations(),
    getOrders(),
    getInvoices(),
    getProformaInvoices(),
    getDeliveryChallans(),
    getSignedDocuments({ customer_id: customerId }),
    getDocuments({ entity_id: customerId }),
  ]);

  const archive: CustomerArchiveDocument[] = [];
  const cName = (customerName || '').toLowerCase();

  const isMatch = (cId?: string, cNm?: string) => {
    if (cId && (cId === customerId || cId.toLowerCase() === customerId.toLowerCase())) return true;
    if (cNm && cName && (cNm.toLowerCase().includes(cName) || cName.includes(cNm.toLowerCase()))) return true;
    return false;
  };

  // 1. Quotations
  for (const q of quoteRes.quotations) {
    if (isMatch(q.customer_id, q.customer_name)) {
      const signed = signedDocs.find((s) => s.document_number === q.quotation_number);
      archive.push({
        id: `ARCH-QT-${q.id}`,
        document_type: 'QUOTATION',
        document_number: q.quotation_number,
        title: `Commercial Quotation - ${q.quotation_number}`,
        date: q.quotation_date,
        amount: q.grand_total,
        status: q.status,
        customer_id: q.customer_id,
        customer_name: q.customer_name,
        original_pdf_url: `/dashboard/quotations?preview=${q.id}`,
        signed_scan_url: signed?.signed_scan_file_url,
        has_signed_copy: Boolean(signed),
        version: q.version || 1,
        uploaded_by_name: q.salesperson_name || 'System',
        uploaded_at: q.created_at,
        notes: q.notes,
      });
    }
  }

  // 2. Proforma Invoices
  for (const p of proformaRes.proformas) {
    if (isMatch(p.customer_id, p.customer_name)) {
      const signed = signedDocs.find((s) => s.document_number === p.proforma_number);
      archive.push({
        id: `ARCH-PI-${p.id}`,
        document_type: 'PROFORMA_INVOICE',
        document_number: p.proforma_number,
        title: `Proforma Invoice (Not a Tax Invoice) - ${p.proforma_number}`,
        date: p.proforma_date,
        amount: p.grand_total,
        status: p.status,
        customer_id: p.customer_id,
        customer_name: p.customer_name,
        related_transaction_number: p.quotation_number || p.order_number,
        original_pdf_url: `/dashboard/proforma-invoices?preview=${p.id}`,
        signed_scan_url: signed?.signed_scan_file_url,
        has_signed_copy: Boolean(signed),
        version: p.version || 1,
        uploaded_by_name: p.created_by_name,
        uploaded_at: p.created_at,
        notes: p.notes,
      });
    }
  }

  // 3. Delivery Challans
  for (const dc of challanRes.challans) {
    if (isMatch(dc.customer_id, dc.customer_name)) {
      const signed = signedDocs.find((s) => s.document_number === dc.challan_number);
      archive.push({
        id: `ARCH-DC-${dc.id}`,
        document_type: 'DELIVERY_CHALLAN',
        document_number: dc.challan_number,
        title: `Delivery Challan (${dc.purpose}) - ${dc.challan_number}`,
        date: dc.challan_date,
        status: dc.status,
        customer_id: dc.customer_id,
        customer_name: dc.customer_name,
        related_transaction_number: dc.reference_number,
        original_pdf_url: `/dashboard/delivery-challans?preview=${dc.id}`,
        signed_scan_url: signed?.signed_scan_file_url,
        has_signed_copy: Boolean(signed),
        version: 1,
        uploaded_by_name: dc.prepared_by_name,
        uploaded_at: dc.created_at,
        notes: dc.notes,
      });
    }
  }

  // 4. Tax Invoices
  for (const inv of invRes.invoices) {
    if (isMatch(inv.customer_id, inv.customer_name)) {
      const signed = signedDocs.find((s) => s.document_number === inv.invoice_number);
      archive.push({
        id: `ARCH-INV-${inv.id}`,
        document_type: 'TAX_INVOICE',
        document_number: inv.invoice_number,
        title: `GST Tax Invoice - ${inv.invoice_number}`,
        date: inv.invoice_date,
        amount: inv.grand_total,
        status: inv.status,
        customer_id: inv.customer_id,
        customer_name: inv.customer_name,
        related_transaction_number: inv.order_number,
        original_pdf_url: `/dashboard/invoices?preview=${inv.id}`,
        signed_scan_url: signed?.signed_scan_file_url,
        has_signed_copy: Boolean(signed),
        version: 1,
        uploaded_by_name: inv.created_by_name || 'Accounts',
        uploaded_at: inv.created_at,
      });
    }
  }

  // 5. General Enterprise Documents
  for (const ed of enterpriseDocs) {
    archive.push({
      id: `ARCH-ED-${ed.id}`,
      document_type: 'CONTRACT',
      document_number: ed.document_number,
      title: ed.title,
      date: ed.created_at.split('T')[0],
      status: 'Archived',
      customer_id: customerId,
      customer_name: customerName || ed.entity_name || 'Customer',
      original_pdf_url: ed.file_url,
      has_signed_copy: ed.tags.includes('Signed'),
      version: ed.version,
      uploaded_by_name: ed.uploaded_by_name,
      uploaded_at: ed.created_at,
    });
  }

  // Sort chronologically descending
  archive.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return archive;
}
