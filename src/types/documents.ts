export type DocumentCategory =
  | 'TECHNICAL'
  | 'COMMERCIAL'
  | 'LEGAL_CONTRACT'
  | 'TAX_COMPLIANCE'
  | 'SERVICE_AMC'
  | 'HR_EMPLOYEE'
  | 'PROJECT_DESIGN'
  | 'OTHER';

export type DocumentSensitivity = 'NORMAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export type DocumentEntityType =
  | 'customers'
  | 'prospects'
  | 'enquiries'
  | 'quotations'
  | 'orders'
  | 'invoices'
  | 'suppliers'
  | 'employees'
  | 'projects'
  | 'amc_contracts';

export interface EnterpriseDocument {
  id: string;
  document_number: string; // e.g. DOC-26-0001
  title: string;
  category: DocumentCategory;
  folder_path: string; // e.g. /Customers/Cyient/ or /Compliance/
  entity_type?: DocumentEntityType;
  entity_id?: string;
  entity_name?: string;
  file_url: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  sensitivity: DocumentSensitivity;
  expiry_date?: string; // YYYY-MM-DD
  version: number;
  previous_version_id?: string;
  tags: string[];
  metadata?: Record<string, any>;
  uploaded_by_id?: string;
  uploaded_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentFilter {
  category?: DocumentCategory;
  entity_type?: DocumentEntityType;
  entity_id?: string;
  sensitivity?: DocumentSensitivity;
  search?: string;
  expiringWithinDays?: number;
  folder_path?: string;
}

export type BusinessDocumentType =
  | 'QUOTATION'
  | 'QUOTATION_REVISION'
  | 'PROFORMA_INVOICE'
  | 'DELIVERY_CHALLAN'
  | 'TAX_INVOICE'
  | 'PURCHASE_ORDER'
  | 'PAYMENT_RECEIPT'
  | 'CONTRACT'
  | 'CORRESPONDENCE'
  | 'SIGNED_DOCUMENT'
  | 'OTHER';

export interface SignedDocumentRecord {
  id: string;
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
  file_size_bytes: number;
  mime_type: string;
  signed_date: string;
  uploaded_at: string;
  uploaded_by_id?: string;
  uploaded_by_name: string;
  signer_name?: string;
  signer_designation?: string;
  has_company_stamp: boolean;
  version: number;
  notes?: string;
  audit_history?: Array<{
    action: string;
    timestamp: string;
    actor: string;
    details: string;
  }>;
}

export interface CustomerArchiveDocument {
  id: string;
  document_type: BusinessDocumentType;
  document_number: string;
  title: string;
  date: string;
  amount?: number;
  status: string;
  customer_id: string;
  customer_name: string;
  related_transaction_number?: string;
  original_pdf_url?: string;
  signed_scan_url?: string;
  has_signed_copy: boolean;
  version: number;
  uploaded_by_name: string;
  uploaded_at: string;
  notes?: string;
}

