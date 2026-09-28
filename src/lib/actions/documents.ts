'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth, requireRole, getAuthenticatedUser } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type {
  EnterpriseDocument,
  DocumentCategory,
  DocumentSensitivity,
  DocumentEntityType,
  DocumentFilter,
} from '@/types/documents';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_ENTERPRISE_DOCS__: EnterpriseDocument[] | undefined;
}

const SEED_DOCUMENTS: EnterpriseDocument[] = [
  {
    id: 'DOC-001',
    document_number: 'DOC-26-0001',
    title: 'ICON TECH PRO - GST Registration Certificate (Telangana)',
    category: 'TAX_COMPLIANCE',
    folder_path: '/Compliance/GST/',
    entity_type: 'customers',
    file_url: '/docs/icon_gstin_36_cert.pdf',
    file_name: 'icon_gstin_36_cert.pdf',
    file_size_bytes: 425600,
    mime_type: 'application/pdf',
    sensitivity: 'NORMAL',
    expiry_date: '2028-03-31',
    version: 1,
    tags: ['GST', 'Tax', 'Telangana', 'Compliance'],
    uploaded_by_name: 'Borra Narsimulu',
    created_at: '2026-01-15T09:00:00Z',
    updated_at: '2026-01-15T09:00:00Z',
  },
  {
    id: 'DOC-002',
    document_number: 'DOC-26-0002',
    title: 'Cyient Technologies - Master Turnkey AV Contract (Signed)',
    category: 'LEGAL_CONTRACT',
    folder_path: '/Customers/Cyient/',
    entity_type: 'customers',
    entity_id: 'CUST-CYIENT-001',
    entity_name: 'Cyient Technologies Hyderabad Campus',
    file_url: '/docs/cyient_master_turnkey_contract.pdf',
    file_name: 'cyient_master_turnkey_contract.pdf',
    file_size_bytes: 1845000,
    mime_type: 'application/pdf',
    sensitivity: 'CONFIDENTIAL',
    expiry_date: '2027-08-31',
    version: 1,
    tags: ['Contract', 'Cyient', 'Turnkey AV', 'Boardroom'],
    uploaded_by_name: 'Borra Narsimulu',
    created_at: '2026-02-10T14:30:00Z',
    updated_at: '2026-02-10T14:30:00Z',
  },
  {
    id: 'DOC-003',
    document_number: 'DOC-26-0003',
    title: 'BenQ Commercial Display Distribution Agreement & Price Matrix',
    category: 'COMMERCIAL',
    folder_path: '/Suppliers/BenQ/',
    entity_type: 'suppliers',
    entity_id: 'SUP002',
    entity_name: 'EduTech Displays India / BenQ Hub',
    file_url: '/docs/benq_distribution_price_matrix_2026.pdf',
    file_name: 'benq_distribution_price_matrix_2026.pdf',
    file_size_bytes: 890000,
    mime_type: 'application/pdf',
    sensitivity: 'RESTRICTED',
    expiry_date: '2026-12-31',
    version: 2,
    tags: ['Pricing', 'BenQ', 'Distributor', 'Discount Matrix'],
    uploaded_by_name: 'B V Dheeraj Reddy',
    created_at: '2026-03-01T11:00:00Z',
    updated_at: '2026-03-01T11:00:00Z',
  },
  {
    id: 'DOC-004',
    document_number: 'DOC-26-0004',
    title: 'Sri Sai Hospitals - Comprehensive AMC Agreement 2026-27',
    category: 'SERVICE_AMC',
    folder_path: '/Service/AMC/',
    entity_type: 'amc_contracts',
    entity_id: 'AMC260001',
    entity_name: 'Sri Sai Hospitals & Diagnostic Center',
    file_url: '/docs/sri_sai_amc_signed_agreement.pdf',
    file_name: 'sri_sai_amc_signed_agreement.pdf',
    file_size_bytes: 650000,
    mime_type: 'application/pdf',
    sensitivity: 'NORMAL',
    expiry_date: '2027-08-31',
    version: 1,
    tags: ['AMC', 'Healthcare', 'Annual Maintenance', 'Signed Agreement'],
    uploaded_by_name: 'B Vineet Babu',
    created_at: '2026-08-30T10:00:00Z',
    updated_at: '2026-08-30T10:00:00Z',
  },
];

function getDocsStore(): EnterpriseDocument[] {
  if (!globalThis.__ICON_ENTERPRISE_DOCS__) {
    globalThis.__ICON_ENTERPRISE_DOCS__ = [...SEED_DOCUMENTS];
  }
  return globalThis.__ICON_ENTERPRISE_DOCS__;
}

/**
 * Filter documents according to user role and sensitivity classification.
 */
function applySensitivityGate(docs: EnterpriseDocument[], role: string): EnterpriseDocument[] {
  return docs.filter((doc) => {
    if (doc.sensitivity === 'NORMAL') return true;
    if (doc.sensitivity === 'CONFIDENTIAL') {
      return ['Managing Director', 'Admin / BDM', 'Accounts'].includes(role);
    }
    if (doc.sensitivity === 'RESTRICTED') {
      return ['Managing Director', 'Admin / BDM'].includes(role);
    }
    return false;
  });
}

/**
 * Retrieve all enterprise documents with optional filters and sensitivity enforcement.
 */
export async function getDocuments(filter?: DocumentFilter): Promise<EnterpriseDocument[]> {
  const authUser = await requireAuth();
  const store = getDocsStore();
  let results: EnterpriseDocument[] = [];

  const isOnline = await isSupabaseAvailable();
  if (isOnline) {
    try {
      const supabase = await createClient();
      let query = supabase.from('enterprise_documents').select('*');

      if (filter?.category) query = query.eq('category', filter.category);
      if (filter?.entity_type) query = query.eq('entity_type', filter.entity_type);
      if (filter?.entity_id) query = query.eq('entity_id', filter.entity_id);
      if (filter?.sensitivity) query = query.eq('sensitivity', filter.sensitivity);
      if (filter?.folder_path) query = query.like('folder_path', `${filter.folder_path}%`);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        results = data as EnterpriseDocument[];
      }
    } catch {
      // In-memory fallback
    }
  }

  if (results.length === 0) {
    results = [...store];
    if (filter?.category) results = results.filter((d) => d.category === filter.category);
    if (filter?.entity_type) results = results.filter((d) => d.entity_type === filter.entity_type);
    if (filter?.entity_id) results = results.filter((d) => d.entity_id === filter.entity_id);
    if (filter?.sensitivity) results = results.filter((d) => d.sensitivity === filter.sensitivity);
    if (filter?.folder_path) results = results.filter((d) => d.folder_path.startsWith(filter.folder_path!));
  }

  if (filter?.search) {
    const q = filter.search.toLowerCase().trim();
    results = results.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.document_number.toLowerCase().includes(q) ||
        d.file_name.toLowerCase().includes(q) ||
        (d.entity_name && d.entity_name.toLowerCase().includes(q)) ||
        d.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  if (filter?.expiringWithinDays !== undefined) {
    const now = new Date();
    const limit = new Date();
    limit.setDate(now.getDate() + filter.expiringWithinDays);
    const limitStr = limit.toISOString().split('T')[0];
    const todayStr = now.toISOString().split('T')[0];

    results = results.filter((d) => d.expiry_date && d.expiry_date >= todayStr && d.expiry_date <= limitStr);
  }

  // Strict role sensitivity gate
  return applySensitivityGate(results, authUser.role);
}

/**
 * Retrieve document by ID with sensitivity check.
 */
export async function getDocumentById(id: string): Promise<EnterpriseDocument | null> {
  const authUser = await requireAuth();
  const store = getDocsStore();
  const doc = store.find((d) => d.id === id || d.document_number === id);
  if (!doc) return null;

  const gated = applySensitivityGate([doc], authUser.role);
  return gated.length > 0 ? gated[0] : null;
}

/**
 * Upload / Register a new document in the Enterprise Document Center.
 */
export async function uploadDocument(payload: {
  title: string;
  category: DocumentCategory;
  folder_path?: string;
  entity_type?: DocumentEntityType;
  entity_id?: string;
  entity_name?: string;
  file_url: string;
  file_name: string;
  file_size_bytes?: number;
  mime_type?: string;
  sensitivity?: DocumentSensitivity;
  expiry_date?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; data?: EnterpriseDocument; error?: string }> {
  try {
    const authUser = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
      'Accounts',
      'Office Assistant',
    ]);

    const sensitivity = payload.sensitivity || 'NORMAL';

    // Role-sensitivity restriction on creation
    if (sensitivity === 'RESTRICTED' && !['Managing Director', 'Admin / BDM'].includes(authUser.role)) {
      return { success: false, error: 'Unauthorized: Only Managing Director and Admin may upload RESTRICTED documents.' };
    }
    if (sensitivity === 'CONFIDENTIAL' && !['Managing Director', 'Admin / BDM', 'Accounts'].includes(authUser.role)) {
      return { success: false, error: 'Unauthorized: Only Executive Management and Accounts may upload CONFIDENTIAL documents.' };
    }

    const store = getDocsStore();
    const seq = (store.length + 1).toString().padStart(4, '0');
    const docNumber = `DOC-26-${seq}`;

    const newDoc: EnterpriseDocument = {
      id: `DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      document_number: docNumber,
      title: payload.title.trim(),
      category: payload.category,
      folder_path: payload.folder_path || '/',
      entity_type: payload.entity_type,
      entity_id: payload.entity_id,
      entity_name: payload.entity_name,
      file_url: payload.file_url,
      file_name: payload.file_name,
      file_size_bytes: payload.file_size_bytes || 0,
      mime_type: payload.mime_type || 'application/pdf',
      sensitivity,
      expiry_date: payload.expiry_date,
      version: 1,
      tags: payload.tags || [],
      metadata: payload.metadata || {},
      uploaded_by_id: authUser.id,
      uploaded_by_name: authUser.name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    store.unshift(newDoc);

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('enterprise_documents').insert({
          document_number: newDoc.document_number,
          title: newDoc.title,
          category: newDoc.category,
          folder_path: newDoc.folder_path,
          entity_type: newDoc.entity_type,
          entity_id: newDoc.entity_id,
          entity_name: newDoc.entity_name,
          file_url: newDoc.file_url,
          file_name: newDoc.file_name,
          file_size_bytes: newDoc.file_size_bytes,
          mime_type: newDoc.mime_type,
          sensitivity: newDoc.sensitivity,
          expiry_date: newDoc.expiry_date || null,
          version: newDoc.version,
          tags: newDoc.tags,
          metadata: newDoc.metadata,
          uploaded_by_id: newDoc.uploaded_by_id,
          uploaded_by_name: newDoc.uploaded_by_name,
        });
      } catch (err) {
        console.warn('Supabase document insert fallback:', err);
      }
    }

    await logAuditEvent({
      userName: authUser.name,
      action: 'DOCUMENT_UPLOADED',
      module: 'DOCUMENT_CENTER',
      details: `Uploaded document ${docNumber}: "${newDoc.title}" (${newDoc.category}, Sensitivity: ${newDoc.sensitivity})`,
    });

    revalidatePath('/dashboard/documents');
    return { success: true, data: newDoc };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to upload document' };
  }
}

/**
 * Creates a new version of an existing document while preserving the immutable original.
 */
export async function createDocumentRevision(
  existingDocId: string,
  newFile: { file_url: string; file_name: string; file_size_bytes?: number; change_notes?: string }
): Promise<{ success: boolean; data?: EnterpriseDocument; error?: string }> {
  try {
    const authUser = await requireRole(['Managing Director', 'Admin / BDM', 'BDM', 'Accounts']);
    const store = getDocsStore();
    const existing = store.find((d) => d.id === existingDocId || d.document_number === existingDocId);

    if (!existing) {
      return { success: false, error: 'Document not found' };
    }

    const newVersion = existing.version + 1;
    const newDocId = `DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const revisedDoc: EnterpriseDocument = {
      ...existing,
      id: newDocId,
      file_url: newFile.file_url,
      file_name: newFile.file_name,
      file_size_bytes: newFile.file_size_bytes || existing.file_size_bytes,
      version: newVersion,
      previous_version_id: existing.id,
      uploaded_by_name: authUser.name,
      metadata: {
        ...existing.metadata,
        change_notes: newFile.change_notes,
      },
      updated_at: new Date().toISOString(),
    };

    store.unshift(revisedDoc);

    await logAuditEvent({
      userName: authUser.name,
      action: 'DOCUMENT_REVISED',
      module: 'DOCUMENT_CENTER',
      details: `Revised document ${existing.document_number} to Version ${newVersion}`,
    });

    revalidatePath('/dashboard/documents');
    return { success: true, data: revisedDoc };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to revise document' };
  }
}

/**
 * Retrieve documents attached to a specific business record.
 */
export async function getDocumentsByEntity(
  entityType: DocumentEntityType,
  entityId: string
): Promise<EnterpriseDocument[]> {
  return getDocuments({ entity_type: entityType, entity_id: entityId });
}

/**
 * Retrieve documents expiring soon (within 30/60 days) for proactive compliance alerts.
 */
export async function getExpiringDocuments(withinDays = 60): Promise<EnterpriseDocument[]> {
  return getDocuments({ expiringWithinDays: withinDays });
}
