export type ProformaStatus =
  | 'Draft'
  | 'Issued'
  | 'Sent'
  | 'Converted to Order'
  | 'Converted to Invoice'
  | 'Cancelled';

export interface ProformaInvoiceItem {
  id?: string;
  product_id?: string;
  description: string;
  model_name?: string;
  brand_name?: string;
  hsn_sac: string;
  quantity: number;
  unit: string;
  rate: number;
  discount_pct: number;
  discount_amount: number;
  taxable_amount: number;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
}

export interface ProformaBankDetails {
  bank_name: string;
  account_holder: string;
  account_number: string;
  ifsc_code: string;
  branch: string;
  upi_id?: string;
}

export interface ProformaInvoice {
  id: string;
  proforma_number: string; // e.g. ITP/PI/2026-27/0001
  proforma_date: string;
  validity_days: number;
  due_date: string;
  customer_id: string;
  customer_name: string;
  company_name?: string;
  gstin?: string;
  billing_address?: string;
  shipping_address?: string;
  place_of_supply?: string;
  quotation_id?: string;
  quotation_number?: string;
  order_id?: string;
  order_number?: string;
  is_gst_inclusive: boolean;
  pricing_mode: 'INCLUSIVE' | 'EXCLUSIVE';
  items: ProformaInvoiceItem[];
  subtotal: number;
  total_discount: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  gst_amount: number;
  grand_total: number;
  advance_amount: number;
  balance_amount: number;
  amount_in_words: string;
  payment_terms: string;
  delivery_terms?: string;
  terms_conditions?: string[];
  bank_details: ProformaBankDetails;
  notes?: string;
  status: ProformaStatus;
  version: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProformaPayload {
  customer_id: string;
  customer_name: string;
  company_name?: string;
  gstin?: string;
  billing_address?: string;
  shipping_address?: string;
  place_of_supply?: string;
  quotation_id?: string;
  quotation_number?: string;
  order_id?: string;
  order_number?: string;
  is_gst_inclusive?: boolean;
  pricing_mode?: 'INCLUSIVE' | 'EXCLUSIVE';
  proforma_date?: string;
  validity_days?: number;
  items: Array<{
    product_id?: string;
    description: string;
    model_name?: string;
    brand_name?: string;
    hsn_sac?: string;
    quantity: number;
    unit?: string;
    rate: number;
    discount_pct?: number;
    gst_rate?: number;
  }>;
  advance_amount?: number;
  payment_terms?: string;
  delivery_terms?: string;
  terms_conditions?: string[];
  notes?: string;
}
