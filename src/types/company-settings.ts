export interface CompanySettings {
  id: string;
  legal_name: string;
  trade_name: string;
  gstin: string;
  pan: string;
  msme_number?: string;
  cin_number?: string;
  gst_state: string;
  registered_address: string;
  office_address: string;
  phone: string;
  email: string;
  website: string;
  authorized_signatory: string;
  commercial_defaults: {
    default_gst_rate: number;
    payment_terms: string;
    quotation_validity_days: number;
    warranty_terms: string;
    delivery_terms: string;
    freight_terms: string;
    installation_terms: string;
  };
  bank_details: {
    bank_name: string;
    account_name: string;
    account_number: string;
    ifsc_code: string;
    branch: string;
    account_type: string;
    upi_id?: string;
  };
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
}

export interface DocumentSettings {
  id: string;
  prefixes: {
    enquiry: string;
    quotation: string;
    sales_order: string;
    invoice: string;
    purchase_order: string;
    delivery_challan: string;
    service: string;
    customer: string;
  };
  standard_terms: {
    quotation_terms: string;
    invoice_terms: string;
    payment_instructions: string;
  };
  print_settings: {
    show_header_logo: boolean;
    show_bank_details: boolean;
    show_authorized_stamp: boolean;
    footer_disclaimer: string;
  };
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
}

export interface ExpiringTemporaryAccess {
  id: string;
  userId: string;
  userName: string;
  role: string;
  module: string;
  action: string;
  reason: string;
  startDate?: string;
  endDate: string;
  daysRemaining: number;
  isExpired: boolean;
}
