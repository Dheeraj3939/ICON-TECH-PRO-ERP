import type { UserProfile } from './database';

export type CustomerType = 'COMPANY' | 'INDIVIDUAL' | 'GOVERNMENT';
export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface Customer {
  id: string;
  customer_code: string; // ICONYYXXXX (e.g. ICON260001) - Read-only, database generated
  customer_type: CustomerType;
  tender_reference?: string | null;
  gem_order_number?: string | null;
  department_name?: string | null;
  gem_seller_id?: string | null;
  emd_amount?: number | null;
  nodal_officer?: string | null;
  payment_terms_days?: number | null;
  room_measurements?: string | null;
  
  // Primary Names
  customer_name: string;
  company_name: string | null;
  contact_person: string | null;
  designation: string | null;
  
  // Contact info
  phone: string;
  alternate_phone: string | null;
  email: string | null;
  
  // Addresses
  billing_address: string | null;
  shipping_address: string | null;
  city: string;
  state: string;
  state_code: string;
  pincode: string | null;
  
  // Tax compliance
  gstin: string | null;
  pan: string | null;
  credit_limit: number;
  
  // ERP operations
  enquiry_source: string;
  salesperson_id: string | null;
  status: CustomerStatus;
  notes: string | null;
  
  // Audit
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  
  // Joined relation
  salesperson?: UserProfile | null;
}

export interface CustomerFormData {
  customer_type: CustomerType;
  customer_name: string;
  company_name?: string;
  department_name?: string;
  gem_seller_id?: string;
  gem_order_number?: string;
  tender_reference?: string;
  emd_amount?: number;
  nodal_officer?: string;
  contact_person?: string;
  designation?: string;
  phone: string;
  alternate_phone?: string;
  email?: string;
  billing_address?: string;
  shipping_address?: string;
  city: string;
  state: string;
  state_code: string;
  pincode?: string;
  gstin?: string;
  pan?: string;
  credit_limit?: number;
  payment_terms_days?: number;
  room_measurements?: string;
  enquiry_source: string;
  salesperson_id?: string;
  status: CustomerStatus;
  notes?: string;
}

export interface CustomerFilters {
  search?: string;
  customer_type?: CustomerType | 'ALL';
  status?: CustomerStatus | 'ALL';
  salesperson_id?: string | 'ALL';
  page?: number;
  limit?: number;
}
