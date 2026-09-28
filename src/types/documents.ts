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
