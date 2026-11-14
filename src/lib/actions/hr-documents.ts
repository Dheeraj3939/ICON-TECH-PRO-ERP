'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { findByIdOrCode, isUuid, sanitizeUuid } from '@/lib/supabase/db-helpers';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { getAuthenticatedUser, requireRole } from '@/lib/auth/session';
import { logHRAudit } from '@/lib/actions/employees';
import {
  INITIAL_DOCUMENTS,
  INITIAL_OFFER_LETTERS,
  INITIAL_EMPLOYEES,
} from '@/lib/constants/hr-data';
import type { EmployeeDocument, OfferLetter, DocumentSensitivity } from '@/types/hr';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_DOCUMENTS_STORE__: EmployeeDocument[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_OFFER_LETTERS_STORE__: OfferLetter[] | undefined;
  // eslint-disable-next-line no-var
  var __ICON_OFFER_LETTER_SEQ__: number | undefined;
}

function getDocumentsStore(): EmployeeDocument[] {
  if (!globalThis.__ICON_DOCUMENTS_STORE__) {
    globalThis.__ICON_DOCUMENTS_STORE__ = [...INITIAL_DOCUMENTS];
  }
  return globalThis.__ICON_DOCUMENTS_STORE__;
}

function getOfferLettersStore(): OfferLetter[] {
  if (!globalThis.__ICON_OFFER_LETTERS_STORE__) {
    globalThis.__ICON_OFFER_LETTERS_STORE__ = [...INITIAL_OFFER_LETTERS];
  }
  return globalThis.__ICON_OFFER_LETTERS_STORE__;
}

function getNextOfferLetterNumber(): string {
  if (!globalThis.__ICON_OFFER_LETTER_SEQ__) {
    globalThis.__ICON_OFFER_LETTER_SEQ__ = 2;
  }
  const seq = globalThis.__ICON_OFFER_LETTER_SEQ__++;
  return `OFF/26-27/${String(seq).padStart(4, '0')}`;
}

/**
 * Retrieve employee documents filtered by sensitivity according to the caller's role.
 */
export async function getEmployeeDocuments(
  employeeId?: string
): Promise<EmployeeDocument[]> {
  const authUser = await getAuthenticatedUser();
  if (!authUser) {
    throw new Error('UNAUTHORIZED: Valid session required.');
  }

  const role = authUser.role;
  const store = getDocumentsStore();
  let docs = store;

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      let query = admin
        .from('employee_documents')
        .select('*, employees(full_name)')
        .order('uploaded_at', { ascending: false });
      if (employeeId && isUuid(employeeId)) {
        query = query.eq('employee_id', employeeId);
      }
      const { data, error } = await query;
      if (!error && data) {
        docs = data.map((d: any) => ({
          id: d.id,
          employee_id: d.employee_id,
          employee_name: d.employees?.full_name,
          document_type: d.document_type,
          document_name: d.document_name,
          file_url: d.file_url,
          sensitivity: d.sensitivity,
          uploaded_by: d.uploaded_by,
          notes: d.notes,
          uploaded_at: d.uploaded_at,
        })) as EmployeeDocument[];
      }
    } catch {
      // Fallback
    }
  }

  if (employeeId && !isUuid(employeeId)) {
    docs = docs.filter((d) => d.employee_id === employeeId);
  }

  // Field/Record level sensitivity gate
  return docs.filter((doc) => {
    if (doc.sensitivity === 'NORMAL') return true;
    if (doc.sensitivity === 'CONFIDENTIAL') {
      return ['Managing Director', 'Admin / BDM', 'Accounts'].includes(role);
    }
    if (doc.sensitivity === 'FINANCIAL') {
      return ['Managing Director', 'Admin / BDM', 'Accounts'].includes(role);
    }
    if (doc.sensitivity === 'RESTRICTED') {
      return ['Managing Director', 'Admin / BDM'].includes(role);
    }
    return false;
  });
}

/**
 * Upload or register a new employee document.
 */
export async function uploadEmployeeDocument(data: {
  employee_id: string;
  document_type: EmployeeDocument['document_type'];
  document_name: string;
  file_url: string;
  sensitivity: DocumentSensitivity;
  notes?: string;
}): Promise<{ success: boolean; document?: EmployeeDocument; error?: string }> {
  const authUser = await requireRole([
    'Managing Director',
    'Admin / BDM',
    'Accounts',
    'Office Assistant',
  ]);

  // If uploading financial or restricted documents, verify caller role
  if (['FINANCIAL', 'RESTRICTED'].includes(data.sensitivity)) {
    if (!['Managing Director', 'Admin / BDM', 'Accounts'].includes(authUser.role)) {
      throw new Error('FORBIDDEN: Insufficient permissions to upload financial/restricted documents.');
    }
  }

  const emp = INITIAL_EMPLOYEES.find(
    (e) => e.id === data.employee_id || e.employee_id === data.employee_id
  );

  const newDoc: EmployeeDocument = {
    id: `DOC-${Date.now().toString().slice(-6)}`,
    employee_id: data.employee_id,
    employee_name: emp ? emp.full_name : undefined,
    document_type: data.document_type,
    document_name: data.document_name,
    file_url: data.file_url,
    sensitivity: data.sensitivity,
    uploaded_by: authUser.name,
    notes: data.notes,
    uploaded_at: new Date().toISOString(),
  };

  const store = getDocumentsStore();
  store.unshift(newDoc);

  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      let resolvedEmpId = sanitizeUuid(data.employee_id);
      if (!resolvedEmpId) {
        const empRow = await findByIdOrCode<{ id: string }>(admin, 'employees', data.employee_id, 'employee_id', 'id');
        resolvedEmpId = empRow?.id || null;
      }
      if (resolvedEmpId) {
        const { data: insertedDoc } = await admin
          .from('employee_documents')
          .insert({
            employee_id: resolvedEmpId,
            document_type: newDoc.document_type,
            document_name: newDoc.document_name,
            file_url: newDoc.file_url,
            sensitivity: newDoc.sensitivity,
            uploaded_by: newDoc.uploaded_by,
            notes: newDoc.notes || null,
          })
          .select('id')
          .single();
        if (insertedDoc?.id) newDoc.id = insertedDoc.id;
      }
    } catch {
      // Non-fatal fallback
    }
  }

  await logHRAudit({
    performed_by: authUser.name,
    performed_by_role: authUser.role,
    action: 'UPLOAD_DOCUMENT',
    module: 'HR Documents',
    entity: 'employee_documents',
    record_id: newDoc.id,
    previous_value: null,
    new_value: { name: data.document_name, sensitivity: data.sensitivity },
  });

  revalidatePath('/dashboard/employees/documents');
  return { success: true, document: newDoc };
}

/**
 * Retrieve Offer Letters.
 * Restricted to Managing Director, Admin / BDM, Accounts.
 */
export async function getOfferLetters(): Promise<OfferLetter[]> {
  await requireRole(['Managing Director', 'Admin / BDM', 'Accounts']);
  return getOfferLettersStore();
}

/**
 * Create a new employment Offer Letter.
 * Restricted to Managing Director and Admin / BDM.
 */
export async function createOfferLetter(data: {
  candidate_name: string;
  offer_date: string;
  joining_date: string;
  designation: string;
  department: string;
  work_location: string;
  annual_ctc: number;
}): Promise<{ success: boolean; offerLetter?: OfferLetter; error?: string }> {
  const authUser = await requireRole(['Managing Director', 'Admin / BDM']);

  const offerNum = getNextOfferLetterNumber();
  const newOffer: OfferLetter = {
    id: `OFF-${Date.now().toString().slice(-6)}`,
    offer_letter_number: offerNum,
    candidate_name: data.candidate_name,
    offer_date: data.offer_date,
    joining_date: data.joining_date,
    designation: data.designation,
    department: data.department,
    work_location: data.work_location,
    annual_ctc: data.annual_ctc,
    status: 'Draft',
    file_url: `/documents/offer-letters/${offerNum.replace(/\//g, '_')}.pdf`,
    created_by: authUser.name,
    created_at: new Date().toISOString(),
  };

  const store = getOfferLettersStore();
  store.unshift(newOffer);

  await logHRAudit({
    performed_by: authUser.name,
    performed_by_role: authUser.role,
    action: 'CREATE_OFFER_LETTER',
    module: 'Offer Letters',
    entity: 'offer_letters',
    record_id: offerNum,
    previous_value: null,
    new_value: { candidate: data.candidate_name, ctc: data.annual_ctc },
  });

  revalidatePath('/dashboard/employees/documents');
  return { success: true, offerLetter: newOffer };
}

/**
 * Update Offer Letter status (Issued, Accepted, Rejected, Withdrawn).
 */
export async function updateOfferLetterStatus(
  offerId: string,
  status: OfferLetter['status']
): Promise<{ success: boolean; error?: string }> {
  const authUser = await requireRole(['Managing Director', 'Admin / BDM']);

  const store = getOfferLettersStore();
  const offer = store.find((o) => o.id === offerId || o.offer_letter_number === offerId);
  if (!offer) {
    return { success: false, error: 'Offer letter not found.' };
  }

  const prev = offer.status;
  offer.status = status;
  if (status === 'Issued') {
    offer.approved_by = authUser.name;
  }

  await logHRAudit({
    performed_by: authUser.name,
    performed_by_role: authUser.role,
    action: `OFFER_LETTER_${status.toUpperCase()}`,
    module: 'Offer Letters',
    entity: 'offer_letters',
    record_id: offer.offer_letter_number,
    previous_value: { status: prev },
    new_value: { status },
  });

  revalidatePath('/dashboard/employees/documents');
  return { success: true };
}
