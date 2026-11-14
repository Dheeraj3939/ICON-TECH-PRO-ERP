export type DeliveryChallanStatus =
  | 'Draft'
  | 'Issued'
  | 'Sent'
  | 'Delivered/Acknowledged'
  | 'Cancelled';

export type DeliveryChallanPurpose =
  | 'Supply against Order'
  | 'Demo / Testing'
  | 'Job Work / Repair'
  | 'Exhibition / Display'
  | 'Site Installation'
  | 'Replacement / Warranty'
  | 'Other';

export interface DeliveryChallanItem {
  id?: string;
  product_id?: string;
  description: string;
  model_name?: string;
  brand_name?: string;
  hsn_sac?: string;
  quantity: number;
  unit: string;
  serial_numbers?: string[];
  remarks?: string;
}

export interface DeliveryChallan {
  id: string;
  challan_number: string; // e.g. ITP/DC/2026-27/0001
  challan_date: string;
  customer_id: string;
  customer_name: string;
  company_name?: string;
  gstin?: string;
  customer_address: string;
  delivery_address: string;
  purpose: DeliveryChallanPurpose;
  reference_type?: 'QUOTATION' | 'SALES_ORDER' | 'TAX_INVOICE' | 'DIRECT';
  reference_id?: string;
  reference_number?: string;
  items: DeliveryChallanItem[];
  transporter_name?: string;
  vehicle_number?: string;
  lr_number?: string;
  eway_bill_number?: string;
  prepared_by_name: string;
  authorized_by_name: string;
  receiver_name?: string;
  receiver_phone?: string;
  receiver_signature_date?: string;
  receiver_acknowledgement?: string;
  status: DeliveryChallanStatus;
  cancellation_reason?: string;
  cancelled_at?: string;
  cancelled_by_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateDeliveryChallanPayload {
  customer_id: string;
  customer_name: string;
  company_name?: string;
  gstin?: string;
  customer_address: string;
  delivery_address: string;
  purpose: DeliveryChallanPurpose;
  reference_type?: 'QUOTATION' | 'SALES_ORDER' | 'TAX_INVOICE' | 'DIRECT';
  reference_id?: string;
  reference_number?: string;
  items: Array<{
    product_id?: string;
    description: string;
    model_name?: string;
    brand_name?: string;
    hsn_sac?: string;
    quantity: number;
    unit?: string;
    serial_numbers?: string[];
    remarks?: string;
  }>;
  transporter_name?: string;
  vehicle_number?: string;
  lr_number?: string;
  eway_bill_number?: string;
  notes?: string;
}
