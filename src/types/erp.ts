// Master ERP Type Definitions for ICON TECH PRO ERP Suite

export type BusinessEntity = 'ICON_TECH_PRO';

export type UserRole =
  | 'Managing Director'
  | 'Admin / BDM'
  | 'BDM'
  | 'Sales Executive'
  | 'Accounts'
  | 'Office Assistant';

export interface UserStaff {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  canViewCosts: boolean;
  canApprove: boolean;
  canManageUsers: boolean;
  canManageAccounts: boolean;
}

export type CustomerType = 'COMPANY' | 'INDIVIDUAL' | 'GOVERNMENT';
export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type EnquiryStatus =
  | 'Enquiry'
  | 'Site Visit'
  | 'Site Visit Scheduled'
  | 'Quotation Sent'
  | 'Quotation sent'
  | 'Follow-up'
  | 'Follow up'
  | 'Order Confirm'
  | 'Order done'
  | 'Lost'
  | 'Not Responding'
  | 'Not Required Anymore'
  | 'Invoice Sent'
  | 'Cancelled'
  | 'On Hold'
  | 'NA'
  | 'Closed';

export type EnquirySource =
  | 'Direct'
  | 'New Enquiry'
  | 'Website'
  | 'Reference'
  | 'Phone'
  | 'Walk-in'
  | 'Existing Customer';

export interface SiteVisitDetails {
  id?: string;
  visitNumber?: string;
  required: boolean;
  siteAddress?: string;
  roomType?: string;
  measurements?: string;
  scheduledDate?: string;
  completedDate?: string;
  assignedTechnician?: string;
  status?: 'SCHEDULED' | 'COMPLETED' | 'RESCHEDULED' | 'CANCELLED';
  notes?: string;
  photos?: string[];
  drawings?: string[];
  voice_note_url?: string;
  customer_expectations?: string;
  recommended_solution?: string;
  follow_up_actions?: string;
}

export interface EnquiryNote {
  text: string;
  author: string;
  timestamp: string;
}

export interface Enquiry {
  id: string; // UUID or ENQ code
  enquiry_number: string; // e.g. ENQ260001
  customer_id: string;
  customer_name: string;
  company_name?: string;
  customer_type: CustomerType;
  phone: string;
  email?: string;
  source: EnquirySource;
  salesperson_id?: string;
  salesperson_name: string;
  product_category: string;
  requirement_summary: string;
  estimated_budget: number;
  status: EnquiryStatus;
  loss_reason?: string;
  follow_up_date?: string;
  site_visit_required: boolean;
  site_visit?: SiteVisitDetails;
  notes?: EnquiryNote[];
  follow_up_history?: Array<{
    date: string;
    salesperson: string;
    method: string;
    notes: string;
    outcome?: string;
    next_follow_up?: string;
  }>;
  prospect_dossier_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

export interface ProductBrand {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category_id?: string;
  category_name: string;
  brand_id?: string;
  brand_name?: string;
  model_name?: string;
  description?: string;
  unit: string; // 'Nos.', 'Set', 'Meter', 'Service'
  hsn_sac: string;
  gst_rate: number; // 18, 28, etc.
  purchase_price: number; // Restricted to Admin/MD/Accounts
  selling_price: number;
  mrp: number;
  target_margin_pct: number;
  current_stock: number;
  reorder_level: number;
  is_serialized: boolean;
  is_service: boolean;
  supplier_name?: string;
  purchase_depot?: string;
  is_active: boolean;
  specifications?: Record<string, any>;
  spec_source_url?: string;
  spec_source_name?: string;
  spec_retrieved_at?: string;
  spec_approved_by?: string;
  spec_approved_at?: string;
  spec_status?: 'PENDING_SPEC' | 'APPROVED' | 'REJECTED';
  created_at?: string;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address: string;
  is_active: boolean;
}

export interface InventoryStock {
  id: string;
  product_id: string;
  warehouse_id: string;
  current_stock: number;
  reserved_stock: number;
  available_stock: number;
}

export interface InventorySerial {
  id: string;
  product_id: string;
  warehouse_id?: string;
  serial_number: string;
  status: 'AVAILABLE' | 'RESERVED' | 'DISPATCHED' | 'INSTALLED' | 'RENTED_OUT' | 'DEFECTIVE';
  allocated_order_number?: string;
  created_at: string;
}

export interface StockMovement {
  id: string;
  movement_type:
    | 'PURCHASE_RECEIPT'
    | 'SALES_DISPATCH'
    | 'STOCK_ADJUSTMENT'
    | 'RENTAL_OUT'
    | 'RENTAL_RETURN';
  product_id: string;
  product_name: string;
  quantity: number;
  reference_module: string;
  reference_number: string;
  notes?: string;
  created_by_name: string;
  created_at: string;
}

export type OrganizationEntity = 'ICON_TECH_PRO';
export type OrganizationId = 'ORG-ICON-01';

export interface QuotationItem {
  id?: string;
  product_id?: string | null;
  sku?: string | null;
  product_name: string;
  category?: string;
  unit: string;
  quantity: number;
  purchase_price: number;
  selling_price: number;
  discount_pct: number;
  discount_amount: number;
  gst_rate: number;
  hsn_sac: string;
  total_amount: number;
  is_custom?: boolean;
  supplier_reference?: string;
  internal_remarks?: string;
  target_margin_pct?: number;
  target_markup_pct?: number;
}

export type QuotationStatus =
  | 'Draft'
  | 'Preview'
  | 'Confirmed'
  | 'Sent'
  | 'Viewed'
  | 'Follow-up'
  | 'Revised'
  | 'Accepted'
  | 'Rejected'
  | 'Expired'
  | 'Approved'
  | 'Approval Pending';


export interface QuotationVersion {
  version_number: number; // 1, 2, 3...
  version_tag: string; // e.g. "v1", "v2", "v3"
  display_number: string; // e.g. "QTN-26-0001 v1"
  items: QuotationItem[];
  subtotal: number;
  total_discount: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  grand_total: number;
  total_cost: number;
  margin_pct: number;
  created_by_name: string;
  created_at: string;
  status: QuotationStatus;
  notes?: string;
}

export interface Quotation {
  id: string;
  quotation_number: string; // e.g. ICON-EST-1099 or QT/2026-27/0001
  revision_number: number;
  version?: number;
  version_tag?: string;
  versions?: QuotationVersion[];
  quoted_margin_pct?: number;
  approved_margin_pct?: number;
  order_margin_pct?: number;
  actual_margin_pct?: number;
  entity_code: BusinessEntity;
  enquiry_id?: string;
  customer_id: string;
  customer_name: string;
  company_name?: string;
  customer_type: CustomerType;
  phone: string;
  email?: string;
  address?: string;
  salesperson_name: string;
  quotation_date: string;
  validity_days: number;
  valid_until?: string;
  place_of_supply?: string;
  dispatch_from?: string;
  items: QuotationItem[];
  quotation_format?: 'STANDARD' | 'DETAILED_PROJECT';
  project_sections?: ProjectSection[];
  is_detailed_project?: boolean;
  subtotal: number;
  total_discount: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  grand_total: number;
  total_cost: number;
  margin_pct: number;
  payment_terms?: string;
  delivery_terms?: string;
  terms_conditions?: string[];
  bank_details?: {
    bank_name: string;
    account_holder: string;
    account_number: string;
    ifsc_code: string;
    branch: string;
  };
  include_signature?: boolean;
  status: QuotationStatus;
  notes?: string;
  order_id?: string;
  previewed_by?: string;
  previewed_at?: string;
  approved_by?: string;
  approved_at?: string;
  sent_by?: string;
  sent_at?: string;
  send_channel?: 'EMAIL' | 'WHATSAPP' | 'PDF';
  created_at: string;
}

export interface DiscountApprovalRequest {
  id: string;
  quotation_id: string;
  quotation_number: string;
  requested_by_name: string;
  role_name: string;
  discount_percent: number;
  required_approver_role: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approved_by_name?: string;
  remarks?: string;
  created_at: string;
}

export type OrderStatus =
  | 'Confirmed'
  | 'Pending Material'
  | 'Pending Invoice'
  | 'Pending Dispatch'
  | 'Completed'
  | 'Cancelled';

export type MaterialStatus =
  | 'In Stock'
  | 'Stock Reserved'
  | 'PO Required'
  | 'Partially Received';

export type DispatchStatus =
  | 'Not Dispatched'
  | 'Partial'
  | 'Dispatched'
  | 'Installed & Handed Over';

export type FulfillmentStatus =
  | 'Pending Procurement'
  | 'Stock Reserved'
  | 'Ready for Packing'
  | 'Packed';

export type ProcurementStatus =
  | 'PENDING_EVALUATION'
  | 'IN_OFFICE_STOCK'
  | 'PARTIALLY_RESERVED'
  | 'PO_REQUIRED'
  | 'PO_ISSUED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'DROPSHIPPED'
  | 'FULFILLED';

export type DeliveryType = 'OFFICE_RECEIPT' | 'DIRECT_CUSTOMER_DROPSHIP';


export interface ResellerSplitAllocation {
  id?: string;
  source_type: 'OFFICE_STOCK' | 'DISTRIBUTOR';
  supplier_id?: string;
  supplier_name?: string;
  quantity: number;
  status: ProcurementStatus;
  purchase_order_id?: string;
  po_number?: string;
  delivery_type?: DeliveryType;
  estimated_cost?: number;
}

export interface SalesOrderItem {
  id?: string;
  order_id?: string;
  product_id?: string | null;
  sku?: string | null;
  product_name: string;
  quantity: number;
  selling_price: number;
  discount_amount: number;
  gst_rate: number;
  total_amount: number;
  reserved_quantity?: number;
  dispatched_quantity?: number;
  // Reseller procurement tracking
  procurement_status?: ProcurementStatus;
  office_stock_available?: number;
  procurement_required_qty?: number;
  supplier_id?: string | null;
  supplier_name?: string | null;
  purchase_order_id?: string | null;
  po_number?: string | null;
  incoming_quantity?: number;
  fulfilled_quantity?: number;
  allocations?: ResellerSplitAllocation[];
}

export interface SalesOrder {
  id: string;
  order_number: string; // e.g. ORD260001
  entity_code: BusinessEntity;
  quotation_id?: string;
  quotation_number?: string;
  customer_id: string;
  customer_name: string;
  company_name?: string;
  salesperson_name: string;
  order_date: string;
  expected_delivery?: string;
  items: SalesOrderItem[];
  total_amount: number;
  place_of_supply?: string;
  customer_billing_state?: string;
  shipping_address?: string;
  gstin?: string;
  procurement_summary?: {
    total_items: number;
    in_stock: number;
    po_required: number;
    fulfilled: number;
  };
  status: OrderStatus;
  material_status: MaterialStatus;
  fulfillment_status?: FulfillmentStatus;
  dispatch_status: DispatchStatus;
  delivery_challan_id?: string;
  delivery_challan_number?: string;
  invoice_id?: string;
  courier_tracking?: string;
  customer_po_reference?: string;
  confirmation_type?: 'Purchase Order' | 'Email' | 'WhatsApp' | 'Manual' | 'PO' | 'EMAIL' | 'WHATSAPP' | 'SIGNED_ESTIMATE';
  confirmation_ref?: string;
  confirmation_reference?: string;
  confirmed_by_person?: string;
  confirmed_by_name?: string;
  confirmed_at?: string;
  confirmation_date?: string;
  confirmation_notes?: string;
  confirmation_attachment_url?: string;
  created_at: string;
}


export interface ProductSupplier {
  id: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  supplier_id: string;
  supplier_name: string;
  distributor_part_number?: string;
  purchase_cost: number;
  lead_time_days: number;
  payment_terms_days: number;
  is_preferred: boolean;
  is_backup: boolean;
  price_valid_until?: string;
  minimum_order_qty: number;
  availability_status: 'IN_STOCK' | '2_3_DAYS' | 'BACKORDER' | 'DISCONTINUED';
  last_quote_reference?: string;
  last_quote_date?: string;
  created_at: string;
  updated_at?: string;
}

export interface Supplier {
  id: string;
  supplier_code: string;
  supplier_name: string;
  contact_person: string;
  phone: string;
  email: string;
  gstin?: string;
  pan?: string;
  billing_address: string;
  city: string;
  payment_terms_days: number;
  is_active: boolean;
  created_at?: string;
}

export interface PurchaseOrderItem {
  id?: string;
  po_id?: string;
  product_id?: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  gst_rate: number;
  total_cost: number;
  received_quantity?: number;
  // Source Sales Order item traceability
  sales_order_id?: string;
  sales_order_item_id?: string;
  customer_name?: string;
  order_number?: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string; // e.g. PO260001
  entity_code: BusinessEntity;
  supplier_id?: string;
  supplier_name: string;
  supplier_contact?: string;
  order_date: string;
  expected_delivery?: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  status: 'Draft' | 'Issued' | 'Partially Received' | 'Received' | 'Closed' | 'Cancelled';
  created_by_name: string;
  // Reseller consolidated & drop-ship fields
  sales_order_id?: string;
  sales_order_number?: string;
  delivery_type?: DeliveryType;
  consignee_customer_id?: string;
  consignee_name?: string;
  consignee_address?: string;
  consignee_contact?: string;
  consignee_phone?: string;
  distributor_invoice_number?: string;
  distributor_invoice_date?: string;
  courier_transporter?: string;
  tracking_number?: string;
  proof_of_delivery_ref?: string;
  delivery_date?: string;
  notes?: string;
  closed_at?: string;
  closed_by_name?: string;
  on_time_status?: 'ON_TIME' | 'DELAYED' | 'PENDING';
  created_at: string;
}

export interface SupplierEvaluation {
  id: string;
  supplier_id: string;
  supplier_name: string;
  evaluation_period: string;
  on_time_delivery_score: number;
  quality_score: number;
  pricing_score: number;
  support_score: number;
  overall_score: number;
  status: 'PREFERRED' | 'ACTIVE' | 'PROBATION' | 'SUSPENDED';
  total_orders_evaluated: number;
  total_spend_evaluated: number;
  notes?: string;
  evaluated_by_name: string;
  created_at: string;
  updated_at?: string;
}

export interface SupplierQuoteComparisonItem {
  supplier_id: string;
  supplier_name: string;
  product_id?: string;
  product_sku?: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  gst_rate: number;
  taxable_amount: number;
  gst_amount: number;
  total_cost: number;
  lead_time_days: number;
  payment_terms_days: number;
  availability_status: 'IN_STOCK' | '2_3_DAYS' | 'BACKORDER' | 'DISCONTINUED';
  is_preferred: boolean;
  score: number;
  is_best_price: boolean;
  is_fastest: boolean;
  is_recommended: boolean;
}

export interface SupplierPerformanceSummary {
  supplier_id: string;
  supplier_name: string;
  total_pos: number;
  total_spend: number;
  fulfilled_pos: number;
  pending_pos: number;
  cancelled_pos: number;
  on_time_delivery_rate: number; // percentage (0 - 100)
  quality_acceptance_rate: number; // percentage (0 - 100)
  average_lead_time_days: number;
  overall_rating: number; // 0 - 100
  tier: 'TIER_1_PREFERRED' | 'TIER_2_STANDARD' | 'TIER_3_WATCHLIST' | 'TIER_4_RESTRICTED';
  recommendation: string;
}

export interface GoodsReceiptNote {
  id: string;
  grn_number: string;
  po_id?: string;
  po_number?: string;
  supplier_name: string;
  vendor_challan_no?: string;
  received_date: string;
  received_by_name: string;
  notes?: string;
  created_at: string;
}

export interface InvoiceItem {
  description: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  rate: number;
  gst_rate: number;
  gst_amount: number;
  total_amount: number;
}

export type InvoiceStatus = 'Unpaid' | 'Partially Paid' | 'Paid' | 'Overdue';

export interface Invoice {
  id: string;
  invoice_number: string; // e.g. INV260001
  invoice_type: 'TAX_INVOICE' | 'PROFORMA_INVOICE';
  entity_code: BusinessEntity;
  order_id?: string;
  order_number?: string;
  customer_id: string;
  customer_name: string;
  company_name?: string;
  gstin?: string;
  address?: string;
  place_of_supply?: string;
  invoice_date: string;
  due_date: string;
  items: InvoiceItem[];
  subtotal: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  gst_amount: number;
  grand_total: number;
  paid_amount: number;
  balance_amount: number;
  status: InvoiceStatus;
  financial_lock_status?: 'DRAFT' | 'APPROVED' | 'POSTED' | 'LOCKED';
  is_locked?: boolean;
  approval_status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  approved_by?: string;
  approved_at?: string;
  is_posted?: boolean;
  posted_at?: string;
  posted_by?: string;
  locked_at?: string;
  locked_by?: string;
  project_id?: string;
  milestone_id?: string;
  created_by_name: string;
  created_at: string;
}

export type PaymentMode =
  | 'Bank Transfer'
  | 'UPI'
  | 'Cheque'
  | 'Cash'
  | 'NEFT_RTGS'
  | 'IMPS'
  | 'Card'
  | 'Other'
  | 'BANK_TRANSFER'
  | 'CASH'
  | 'CHEQUE'
  | 'CARD'
  | 'OTHER';

export interface Payment {
  id: string;
  payment_number: string; // e.g. PAY260001
  invoice_id?: string;
  invoice_number?: string;
  customer_id?: string;
  customer_name: string;
  company_name?: string;
  payment_date: string;
  amount: number;
  mode: PaymentMode;
  reference_number: string; // UTR or Cheque
  bank_name?: string;
  recorded_by_name: string;
  notes?: string;
  created_at: string;
}

export interface AccountsAgingBucket {
  bucket: '0-30' | '31-60' | '61-90' | '90+';
  amount: number;
  invoiceCount: number;
  invoices: Invoice[];
}

export interface CustomerOutstandingSummary {
  customerId?: string;
  customerName: string;
  companyName?: string;
  totalInvoiced: number;
  totalPaid: number;
  totalBalance: number;
  overdueBalance: number;
  invoiceCount: number;
}

export interface Dispatch {
  id: string;
  dispatch_number: string; // e.g. DSP260001
  delivery_challan_number: string; // e.g. DC260001
  order_id?: string;
  order_number?: string;
  invoice_id?: string;
  invoice_number?: string;
  customer_name: string;
  shipping_address: string;
  transporter_name?: string;
  vehicle_number?: string;
  eway_bill_number?: string;
  status: 'Draft DC' | 'Ready to Ship' | 'Packed' | 'Dispatched' | 'In Transit' | 'Delivered' | 'POD Confirmed' | 'Returned';
  pod_confirmed_at?: string;
  pod_reference?: string;
  carrier_tracking_url?: string;
  notes?: string;
  dispatched_by_name: string;
  dispatch_date: string;
  created_at: string;
}

export type InstallationStatus =
  | 'SCHEDULED'
  | 'SITE_NOT_READY'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'HANDOVER_PENDING'
  | 'HANDED_OVER'
  | 'CANCELLED'
  | 'Assigned'
  | 'In Progress'
  | 'Completed'
  | 'On Hold';

export interface Installation {
  id: string;
  installation_number: string; // e.g. INS260001
  order_id?: string;
  order_number?: string;
  customer_id: string;
  customer_name: string;
  lead_technician_name: string;
  scheduled_date: string;
  completed_date?: string;
  status: InstallationStatus;
  handover_notes?: string;
  site_address?: string;
  site_contact_person?: string;
  site_contact_phone?: string;
  installed_products?: Array<{
    product_name: string;
    sku?: string;
    serial_number?: string;
    quantity: number;
  }>;
  checklist?: Array<{
    id: string;
    label: string;
    completed: boolean;
    checked_by?: string;
    checked_at?: string;
  }>;
  customer_signoff_by?: string;
  customer_signoff_date?: string;
  handover_status?: 'PENDING_HANDOVER' | 'HANDED_OVER' | 'REJECTED';
  remarks?: string;
  created_at: string;
}

export type WarrantyClaimType = 'REPAIR' | 'REPLACEMENT' | 'ON_SITE_SERVICE';
export type WarrantyClaimStatus = 'PENDING' | 'APPROVED' | 'IN_REPAIR' | 'RESOLVED' | 'REJECTED';

export interface WarrantyClaim {
  id: string;
  claim_number: string; // e.g. CLM260001
  serial_number: string;
  customer_id?: string;
  customer_name: string;
  product_name?: string;
  claim_date: string;
  issue_description: string;
  claim_type: WarrantyClaimType;
  status: WarrantyClaimStatus;
  resolution_notes?: string;
  resolved_at?: string;
  created_at: string;
}

export interface ServiceTicket {
  id: string;
  ticket_number: string; // e.g. SRV260001
  entity_code: BusinessEntity;
  customer_id: string;
  customer_name: string;
  product_name?: string;
  serial_number?: string;
  complaint_description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  assigned_technician_name?: string;
  status: 'Open' | 'Assigned' | 'In Progress' | 'Resolved' | 'Closed';
  resolution_details?: string;
  service_charge: number;
  warranty_claim_id?: string;
  amc_contract_id?: string;
  created_at: string;
}

export interface AMCContract {
  id: string;
  contract_number: string; // e.g. AMC260001
  entity_code: BusinessEntity;
  customer_id: string;
  customer_name: string;
  start_date: string;
  end_date: string;
  annual_visits_count: number;
  contract_value: number;
  is_active: boolean;
  amc_type?: 'COMPREHENSIVE' | 'NON_COMPREHENSIVE';
  sla_hours?: number;
  scheduled_visits_count?: number;
  completed_visits_count?: number;
  renewal_status?: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'RENEWED';
  created_at: string;
}

export interface EquipmentRental {
  id: string;
  rental_number: string; // e.g. RNT260001
  entity_code: BusinessEntity;
  customer_id: string;
  customer_name: string;
  product_name: string;
  serial_number?: string;
  start_date: string;
  end_date: string;
  security_deposit: number;
  rental_fee: number;
  status: 'Active' | 'Returned' | 'Overdue';
  created_at: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user_name: string;
  action: string;
  module: string;
  details: string;
  ip_address?: string;
}

export interface DashboardMetrics {
  totalCustomers: number;
  activeEnquiries: number;
  pendingQuotes: number;
  confirmedOrders: number;
  totalQuotedValue: number;
  totalOrdersValue: number;
  totalReceivables: number;
  totalCollected: number;
  lowStockCount: number;
  followUpsDueToday: number;
  activeInvoicesCount: number;
  clearedPaymentsCount: number;
  isOnline: boolean;
  dbStatus: 'CONNECTED' | 'DATABASE_UNAVAILABLE';
  statusText: 'LIVE / CONNECTED' | 'OFFLINE / DATABASE UNAVAILABLE';
}

// ---------------------------------------------------------------------------
// BI & ADVANCED ANALYTICS INTERFACES (Phase M)
// ---------------------------------------------------------------------------
export interface SalesPipelineKPIs {
  total_enquiries: number;
  converted_to_quotations: number;
  converted_to_orders: number;
  conversion_rate_percent: number;
  total_pipeline_value: number;
  average_deal_size: number;
  by_stage: Record<string, number>;
}

export interface RevenueByCategory {
  category: string;
  total_revenue: number;
  total_orders: number;
  gross_margin_percent: number;
  average_order_value: number;
}

export interface CustomerLTVMetric {
  customer_id: string;
  customer_name: string;
  customer_type: string;
  lifetime_value: number;
  total_orders: number;
  total_invoiced: number;
  total_collected: number;
  outstanding_balance: number;
  last_order_date?: string;
}

export interface CollectionEfficiencyMetric {
  total_billed: number;
  total_collected: number;
  efficiency_rate_percent: number;
  current_outstanding: number;
  overdue_by_buckets: {
    '0-30': number;
    '31-60': number;
    '61-90': number;
    '90+': number;
  };
}

export interface BusinessKPIsSummary {
  pipeline: SalesPipelineKPIs;
  revenue_by_category: RevenueByCategory[];
  top_customers_by_ltv: CustomerLTVMetric[];
  collection_efficiency: CollectionEfficiencyMetric;
  generated_at: string;
}

// ---------------------------------------------------------------------------
// EXECUTIVE REPORTING & BRIEFINGS (Phase N)
// ---------------------------------------------------------------------------
export type ExecutiveReportSchedule = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

export type ExecutiveReportType = 
  | 'SALES_PIPELINE' 
  | 'FINANCIAL_SUMMARY' 
  | 'OPERATIONS_DISPATCH' 
  | 'COLLECTIONS_AGING' 
  | 'EXECUTIVE_STRATEGY';

export interface ExecutiveBriefing {
  id: string;
  schedule: ExecutiveReportSchedule;
  report_type: ExecutiveReportType;
  title: string;
  period_start: string;
  period_end: string;
  summary_headline: string;
  key_metrics: Record<string, any>;
  highlights: string[];
  risks_and_alerts: string[];
  recommended_actions: string[];
  generated_by: string;
  created_at: string;
}

export interface ExecutiveScheduleConfig {
  id: string;
  schedule: ExecutiveReportSchedule;
  cron_expression?: string;
  recipients: string[];
  channels: ('EMAIL' | 'WHATSAPP' | 'IN_APP')[];
  is_active: boolean;
  last_run_at?: string;
  next_run_at?: string;
  created_at: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// SERIAL & WARRANTY TRACKING FOUNDATION
// ---------------------------------------------------------------------------
export type WarrantyProvider = 'OEM' | 'DISTRIBUTOR' | 'RESELLER_PRO' | 'EXTENDED_AMC';
export type WarrantySource =
  | 'PRODUCT'
  | 'BRAND'
  | 'DISTRIBUTOR'
  | 'QUOTATION'
  | 'SALES_ORDER'
  | 'CUSTOMER_CONTRACT'
  | 'PROJECT';
export type SerialStatus =
  | 'IN_OFFICE'
  | 'ALLOCATED'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'INSTALLED'
  | 'RETURNED'
  | 'UNDER_SERVICE'
  | 'SCRAPPED';

export interface SerialRecord {
  id: string;
  serial_number: string;
  product_id?: string;
  product_name: string;
  sku?: string;
  supplier_id?: string;
  supplier_name?: string;
  purchase_order_id?: string;
  po_number?: string;
  grn_number?: string;
  customer_id?: string;
  customer_name?: string;
  sales_order_id?: string;
  order_number?: string;
  invoice_id?: string;
  invoice_number?: string;
  installation_id?: string;
  installation_number?: string;
  warranty_duration_months: number;
  warranty_start_date?: string;
  warranty_end_date?: string;
  warranty_provider: WarrantyProvider;
  warranty_source: WarrantySource;
  status: SerialStatus;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface StockMovementRecord {
  id: string;
  movement_type: 'PURCHASE_RECEIPT' | 'SALES_DISPATCH' | 'STOCK_ADJUSTMENT' | 'RENTAL_OUT' | 'RENTAL_RETURN';
  product_id: string;
  product_name: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reference_module: string;
  reference_number: string;
  warehouse_code?: string;
  unit_cost?: number;
  batch_number?: string;
  notes?: string;
  created_by_name: string;
  created_at: string;
}

export interface SerialLedgerEntry {
  id: string;
  serial_number: string;
  product_id?: string;
  product_name: string;
  action: 'INWARD_GRN' | 'RESERVE' | 'DISPATCH' | 'INSTALL' | 'RETURN' | 'DEFECTIVE';
  previous_status?: string;
  new_status: SerialStatus | 'AVAILABLE' | 'RESERVED' | 'DISPATCHED' | 'INSTALLED' | 'DEFECTIVE' | 'RETURNED';
  reference_module?: string;
  reference_number?: string;
  customer_name?: string;
  warehouse_code?: string;
  notes?: string;
  actor_name: string;
  created_at: string;
}

export interface SerialLifecycleTrace {
  serial_number: string;
  product_name: string;
  current_status: string;
  history: SerialLedgerEntry[];
  installed_customer?: string;
  warranty_valid_until?: string;
}

// ---------------------------------------------------------------------------
// GENERIC APPROVAL ENGINE FOUNDATION
// ---------------------------------------------------------------------------
export type ApprovalType =
  | 'QUOTATION'
  | 'DISCOUNT'
  | 'MARGIN'
  | 'PURCHASE_ORDER'
  | 'CREDIT_LIMIT'
  | 'CANCELLATION'
  | 'RETURN'
  | 'SPECIAL_PRICING'
  | 'SALES_ORDER_EXCEPTION'
  | 'CREDIT_COLLECTION_EXCEPTION'
  | 'VOID_APPROVAL'
  | 'CONFIGURABLE_CUSTOM';

export type ApprovalRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface ApprovalRequest {
  id: string;
  request_number: string; // e.g. APR260001
  approval_type: ApprovalType;
  entity_type: string; // 'quotations', 'sales_orders', 'purchase_orders', 'customers'
  entity_id: string;
  entity_number: string;
  requested_by_id?: string;
  requested_by_name: string;
  requested_by_role: UserRole;
  required_approver_role: UserRole;
  approver_id?: string;
  approver_name?: string;
  threshold_metric?: string;
  requested_value: number;
  threshold_limit: number;
  old_value?: any;
  proposed_value?: any;
  rule_id?: string;
  status: ApprovalRequestStatus;
  approval_notes?: string;
  rejection_reason?: string;
  prevent_self_approval: boolean;
  decision?: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';
  decision_date?: string;
  created_at: string;
  updated_at?: string;
}

export interface ApprovalRuleConfig {
  id: string;
  approval_type: ApprovalType;
  rule_name: string;
  threshold_metric: string;
  threshold_operator: '>' | '<' | '>=' | '<=' | '==';
  threshold_value: number;
  min_role_required: UserRole;
  prevent_self_approval: boolean;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// COMMUNICATION OUTBOX & USER IDENTITY FOUNDATION
// ---------------------------------------------------------------------------
export type CommunicationChannel = 'EMAIL' | 'WHATSAPP' | 'SMS' | 'SYSTEM_NOTIFICATION';
export type CommunicationStatus = 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'DELIVERED';

export interface CommunicationOutboxItem {
  id: string;
  organization_id?: string;
  customer_id?: string;
  contact_id?: string;
  enquiry_id?: string;
  quotation_id?: string;
  sales_order_id?: string;
  invoice_id?: string;
  service_ticket_id?: string;
  entity_type?: string;
  entity_id?: string;
  sender_user_id?: string;
  sender_name: string;
  send_as_identity?: string;
  recipient: string; // email, phone number, or user id
  recipient_name?: string;
  channel: CommunicationChannel;
  language?: string;
  subject?: string;
  message_body: string;
  template_id?: string;
  template_data?: Record<string, any>;
  attachment_url?: string;
  attachment_type?: 'BROCHURE' | 'CATALOGUE' | 'QUOTATION' | 'INVOICE' | 'DOCUMENT';
  handoff_requested?: boolean;
  assigned_salesperson_phone?: string;
  assigned_salesperson_name?: string;
  status: CommunicationStatus;
  error_message?: string;
  failure_reason?: string;
  retry_count: number;
  max_retries: number;
  provider_name?: string;
  provider_message_id?: string;
  correlation_id?: string;
  scheduled_at?: string;
  sent_at?: string;
  created_at: string;
}

export interface UserCommunicationIdentity {
  id: string;
  user_id: string;
  user_name: string;
  phone_number?: string;
  phone_identity_id?: string;
  preferred_language: string; // 'en', 'te', 'hi', etc.
  secondary_language?: string;
  voice_enabled: boolean;
  ai_enabled: boolean;
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  send_as_allowed_users: string[]; // List of user IDs permitted to send on their behalf
  created_at: string;
}

export interface CommunicationInboxItem {
  id: string;
  channel: CommunicationChannel;
  sender: string; // phone or email
  sender_name?: string;
  recipient: string; // incoming phone number or email desk
  subject?: string;
  message_body: string;
  customer_id?: string;
  customer_name?: string;
  provider_name: string;
  provider_message_id?: string;
  raw_payload?: Record<string, any>;
  handoff_requested?: boolean;
  handoff_status?: 'NONE' | 'PENDING' | 'ACCEPTED' | 'RESOLVED';
  assigned_salesperson_id?: string;
  assigned_salesperson_name?: string;
  assigned_salesperson_phone?: string;
  received_at: string;
  created_at: string;
}

export interface CommunicationTemplate {
  id: string;
  template_code: string;
  template_name: string;
  channel: CommunicationChannel;
  language: string;
  subject_template?: string;
  body_template: string;
  variables: string[]; // e.g. ['customer_name', 'quote_number', 'amount']
  is_active: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// AI SALES AGENT & PRODUCT ADVISORY
// ---------------------------------------------------------------------------
export type QualificationStatus = 'HOT' | 'WARM' | 'COLD' | 'UNQUALIFIED';

export interface LeadQualificationCriteria {
  space_type: string;
  seating_capacity?: number;
  budget_inr?: number;
  timeline?: 'IMMEDIATE' | 'WITHIN_1_MONTH' | 'WITHIN_1_QUARTER' | 'EXPLORING';
  decision_maker_role?: string;
  key_requirements?: string[];
}

export interface LeadQualificationResult {
  score: number;
  status: QualificationStatus;
  budget_adequacy: 'SUFFICIENT' | 'TIGHT' | 'INSUFFICIENT' | 'UNKNOWN';
  timeline_urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  recommended_next_action: string;
  summary: string;
}

export interface SolutionPackageRecommendation {
  package_name: string;
  space_type: string;
  items: Array<{
    product_name: string;
    sku?: string;
    quantity: number;
    estimated_price: number;
  }>;
  estimated_subtotal: number;
  estimated_gst: number;
  estimated_grand_total: number;
  rationale: string;
}

export interface AISalesSession {
  id: string;
  session_number: string;
  customer_id?: string;
  customer_name: string;
  contact_phone?: string;
  contact_email?: string;
  space_type?: string;
  seating_capacity?: number;
  estimated_budget?: number;
  qualification_score: number;
  qualification_status: QualificationStatus;
  recommended_package?: SolutionPackageRecommendation;
  status: 'ACTIVE' | 'QUALIFIED' | 'CONVERTED' | 'DISMISSED';
  enquiry_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AISalesMessage {
  id: string;
  session_id: string;
  sender: 'BUYER' | 'AI_AGENT';
  content: string;
  intent_detected?: string;
  created_at: string;
}


// ---------------------------------------------------------------------------
// MULTILINGUAL AI GATEWAY & VOICE ARCHITECTURE
// ---------------------------------------------------------------------------
export type SupportedLanguage = 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'ml';

export type CallDirection = 'INBOUND' | 'OUTBOUND';
export type CallStatus = 'INITIATED' | 'RINGING' | 'IN_PROGRESS' | 'COMPLETED' | 'MISSED' | 'FAILED';
export type CallIntent =
  | 'SALES_ENQUIRY'
  | 'SERVICE_COMPLAINT'
  | 'PAYMENT_BILLING'
  | 'AMC_RENEWAL'
  | 'OPERATOR_DESK'
  | 'GENERAL';

export interface CallTranscriptTurn {
  speaker: 'CALLER' | 'AI_AGENT' | 'EXECUTIVE';
  text: string;
  language?: SupportedLanguage;
  confidence?: number;
  timestamp: string;
}

export interface TelephonyCallRecord {
  id: string;
  call_sid: string;
  direction: CallDirection;
  caller_number: string;
  recipient_number: string;
  customer_id?: string;
  customer_name?: string;
  status: CallStatus;
  intent_detected?: CallIntent;
  language: SupportedLanguage;
  duration_seconds: number;
  recording_url?: string;
  sentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  transcript_turns: CallTranscriptTurn[];
  extracted_summary?: string;
  action_items?: string[];
  provider_name: string;
  transferred_to?: string; // Salesperson's Airtel phone
  transferred_salesperson_name?: string;
  transfer_status?: 'NONE' | 'INITIATED' | 'CONNECTED' | 'FAILED';
  transfer_reason?: string;
  transfer_summary?: string;
  is_salesperson_direct?: boolean;
  created_at: string;
  ended_at?: string;
}

export interface AIGatewayRequest {
  id: string;
  user_id: string;
  user_name: string;
  user_role: UserRole;
  session_type: 'TEXT' | 'VOICE';
  channel: 'WEB' | 'WHATSAPP' | 'PHONE_VOICE';
  detected_language: SupportedLanguage;
  input_text: string;
  requested_tool?: string;
  created_at: string;
}

export interface AIGatewayResponse {
  success: boolean;
  authorized: boolean;
  detected_language: SupportedLanguage;
  original_language_response: string;
  english_business_summary: string;
  tool_executed?: string;
  tool_result?: Record<string, any>;
  audit_log_id?: string;
}

// ---------------------------------------------------------------------------
// ADMIN SYSTEM HEALTH FOUNDATION
// ---------------------------------------------------------------------------
export type HealthComponentStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'ERROR';

export interface HealthComponentDetail {
  status: HealthComponentStatus;
  latency_ms?: number;
  details: string;
  last_error?: string;
  is_live: boolean;
  metadata?: Record<string, any>;
}

export interface SystemHealthReport {
  overall_status: HealthComponentStatus;
  checked_at: string;
  release_version: string;
  components: {
    database: HealthComponentDetail;
    authentication: HealthComponentDetail;
    rls: HealthComponentDetail;
    storage: HealthComponentDetail;
    application: HealthComponentDetail;
    email_outbox: HealthComponentDetail;
    whatsapp_outbox: HealthComponentDetail;
    background_jobs: HealthComponentDetail;
    integrations: HealthComponentDetail;
    recent_errors: HealthComponentDetail;
    version: HealthComponentDetail;
  };
}

// ---------------------------------------------------------------------------
// DAY 3: TASK & FOLLOW-UP ENGINE FOUNDATION
// ---------------------------------------------------------------------------
export type TaskType =
  | 'CUSTOMER_FOLLOWUP'
  | 'ENQUIRY_FOLLOWUP'
  | 'QUOTATION_FOLLOWUP'
  | 'PAYMENT_COLLECTION'
  | 'PROCUREMENT_FOLLOWUP'
  | 'INSTALLATION_FOLLOWUP'
  | 'SERVICE_FOLLOWUP'
  | 'AMC_RENEWAL';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'Pending' | 'In Progress' | 'Completed' | 'Cancelled' | 'Overdue';

export interface ERPTask {
  id: string;
  task_number: string;
  task_type: TaskType;
  related_entity_type?: string;
  related_entity_id?: string;
  related_entity_number?: string;
  title: string;
  notes?: string;
  assigned_user_id?: string;
  assigned_user_name: string;
  priority: TaskPriority;
  due_date: string;
  reminder_date?: string;
  status: TaskStatus;
  created_by_name: string;
  completed_by_name?: string;
  completed_at?: string;
  outcome?: string;
  created_at: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// DAY 3: TALLY INTEGRATION FOUNDATION
// ---------------------------------------------------------------------------
export type TallyEntityType =
  | 'CUSTOMER'
  | 'SUPPLIER'
  | 'PRODUCT'
  | 'SALES_INVOICE'
  | 'PURCHASE_INVOICE'
  | 'PAYMENT'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE';

export type TallySyncStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'RETRY'
  | 'RECONCILED';

export interface TallySyncItem {
  id: string;
  entity_type: TallyEntityType;
  entity_id: string;
  entity_number: string;
  tally_voucher_type: string;
  payload_summary: string;
  status: TallySyncStatus;
  retry_count: number;
  max_retries: number;
  error_message?: string;
  tally_guid?: string;
  tally_alter_id?: number;
  synced_at?: string;
  reconciled_at?: string;
  created_at: string;
}

export interface TallyLedgerMapping {
  erp_id: string;
  erp_name: string;
  entity_type: 'CUSTOMER' | 'SUPPLIER' | 'TAX' | 'BANK';
  tally_ledger_name: string;
  tally_group: string;
  is_verified: boolean;
}

// ---------------------------------------------------------------------------
// DAY 3: SUPPLIER INVOICE & 3-WAY MATCH FOUNDATION
// ---------------------------------------------------------------------------
export type MatchStatus =
  | 'MATCHED'
  | 'QUANTITY_MISMATCH'
  | 'PRICE_MISMATCH'
  | 'GRN_PENDING'
  | 'PO_NOT_FOUND'
  | 'EXCEPTION_FLAGGED';

export interface SupplierInvoiceItem {
  id: string;
  product_name: string;
  sku?: string;
  hsn_sac: string;
  quantity: number;
  purchase_price: number;
  discount: number;
  taxable_amount: number;
  gst_rate: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_cost: number;
}

export interface SupplierInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  supplier_id: string;
  supplier_name: string;
  po_id?: string;
  po_number?: string;
  grn_number?: string;
  items: SupplierInvoiceItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  freight_other_charges: number;
  total_amount: number;
  due_date: string;
  payment_terms: string;
  document_url?: string;
  tally_voucher_ref?: string;
  tally_sync_status: 'PENDING' | 'SYNCED' | 'FAILED';
  payment_status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  outstanding_amount: number;
  match_status: MatchStatus;
  match_notes?: string;
  created_at: string;
}

export interface ThreeWayMatchResult {
  invoice_number: string;
  po_number: string;
  match_status: MatchStatus;
  is_perfect_match: boolean;
  discrepancies: Array<{
    item_name: string;
    issue: 'QTY_MISMATCH' | 'PRICE_MISMATCH' | 'UNRECEIVED_GRN' | 'ITEM_NOT_IN_PO';
    po_value: number;
    invoice_value: number;
    grn_value?: number;
    difference: number;
    description: string;
  }>;
}

// ---------------------------------------------------------------------------
// DAY 3: OPERATIONAL NOTIFICATION ENGINE
// ---------------------------------------------------------------------------
export type NotificationTrigger =
  | 'NEW_ENQUIRY'
  | 'NEW_QUOTATION'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_COMPLETED'
  | 'QUOTATION_EXPIRING'
  | 'SALES_ORDER_CONFIRMED'
  | 'PROCUREMENT_PENDING'
  | 'PO_DELAYED'
  | 'MATERIAL_RECEIVED'
  | 'DISPATCH_READY'
  | 'INSTALLATION_SCHEDULED'
  | 'INSTALLATION_DELAYED'
  | 'HANDOVER_COMPLETED'
  | 'INVOICE_CREATED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_OVERDUE'
  | 'WARRANTY_EXPIRING'
  | 'AMC_EXPIRING'
  | 'SERVICE_TICKET_SLA_RISK'
  | 'LOW_MARGIN'
  | 'UNUSUAL_DISCOUNT'
  | 'ENQUIRY_ASSIGNED'
  | 'SITE_SURVEY_SCHEDULED'
  | 'SITE_SURVEY_COMPLETED'
  | 'PROJECT_MILESTONE_UPDATED';

export type NotificationPriority = 'RED' | 'ORANGE' | 'BLUE';

export interface ERPNotification {
  id: string;
  trigger_type: NotificationTrigger;
  title: string;
  message: string;
  priority?: NotificationPriority;
  entity_type?: string;
  entity_id?: string;
  entity_number?: string;
  target_user_id?: string;
  target_role?: UserRole;
  is_read: boolean;
  channel: 'IN_APP' | 'EMAIL' | 'WHATSAPP' | 'ALL';
  created_at: string;
}

// ---------------------------------------------------------------------------
// DAY 3: DISTRIBUTOR PROCUREMENT RECOMMENDATION
// ---------------------------------------------------------------------------
export interface DistributorRecommendation {
  product_id: string;
  product_name: string;
  required_qty: number;
  required_date?: string;
  recommended_supplier_id: string;
  recommended_supplier_name: string;
  purchase_cost: number;
  lead_time_days: number;
  is_preferred: boolean;
  score: number;
  reason: string;
  alternate_options: Array<{
    supplier_id: string;
    supplier_name: string;
    purchase_cost: number;
    lead_time_days: number;
    availability_status: string;
    score: number;
  }>;
}

// ---------------------------------------------------------------------------
// DAY 3: AI SAFE ACTION AUDIT RECORD
// ---------------------------------------------------------------------------
export type AIActionClassification =
  | 'Human Entered'
  | 'AI Generated'
  | 'AI Recommended'
  | 'Human Approved'
  | 'AI Executed';

export interface AIAuditRecord {
  id: string;
  user_id: string;
  user_name: string;
  user_role: UserRole;
  intent: string;
  tool_name: string;
  arguments: Record<string, any>;
  data_accessed?: string[];
  recommendation?: string;
  requires_human_confirmation: boolean;
  confirmed_by?: string;
  status: 'EXECUTED' | 'BLOCKED_BY_POLICY' | 'PENDING_CONFIRMATION';
  classification?: AIActionClassification;
  result_summary: string;
  created_at: string;
}


// ===========================================================================
// DAY 4 & DAY 5: ENTERPRISE FINANCE, GST, TALLY, AI & AUTOMATION TYPES
// ===========================================================================

// ---------------------------------------------------------------------------
// 1. PAYMENT ENGINE & CUSTOMER RECEIVABLES
// ---------------------------------------------------------------------------


export interface PaymentAllocation {
  id: string;
  payment_id: string;
  payment_number: string;
  invoice_id: string;
  invoice_number: string;
  allocated_amount: number;
  created_at: string;
}

export interface CreditNote {
  id: string;
  credit_note_number: string; // e.g. ITP/CN/26-27/0001
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  total_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  reason: string;
  status: 'DRAFT' | 'APPROVED' | 'ISSUED' | 'CANCELLED';
  created_by_name: string;
  created_at: string;
}

export interface DebitNote {
  id: string;
  debit_note_number: string; // e.g. ITP/DN/26-27/0001
  supplier_invoice_id: string;
  supplier_invoice_number: string;
  supplier_id: string;
  supplier_name: string;
  total_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  reason: string;
  status: 'DRAFT' | 'APPROVED' | 'ISSUED' | 'CANCELLED';
  created_by_name: string;
  created_at: string;
}

export interface AgeingBuckets {
  current_0_30: number;
  overdue_31_60: number;
  overdue_61_90: number;
  overdue_90_plus: number;
  total_outstanding: number;
}

export interface CustomerReceivableSummary {
  customer_id: string;
  customer_code: string;
  customer_name: string;
  company_name?: string;
  total_invoiced: number;
  total_collected: number;
  balance_due: number;
  unallocated_advance: number;
  credit_limit: number;
  credit_utilization_pct: number;
  is_credit_limit_exceeded: boolean;
  ageing: AgeingBuckets;
  promise_to_pay?: {
    promised_amount: number;
    promised_date: string;
    status: 'PENDING' | 'HONOURED' | 'BROKEN';
    notes?: string;
  };
}

export interface SupplierPayableSummary {
  supplier_id: string;
  supplier_name: string;
  total_billed: number;
  total_paid: number;
  balance_due: number;
  ageing: AgeingBuckets;
  pending_invoices_count: number;
}

// ---------------------------------------------------------------------------
// 2. CENTRALIZED DOCUMENT GENERATION & LIFECYCLE
// ---------------------------------------------------------------------------
export type DocumentType =
  | 'QUOTATION'
  | 'SALES_ORDER'
  | 'PURCHASE_ORDER'
  | 'DELIVERY_CHALLAN'
  | 'INSTALLATION_JOB_CARD'
  | 'HANDOVER_CERTIFICATE'
  | 'TAX_INVOICE'
  | 'PURCHASE_INVOICE'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE'
  | 'PAYMENT_RECEIPT'
  | 'AMC_AGREEMENT'
  | 'SERVICE_REPORT';

export type DocumentLifecycleStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'ISSUED' | 'CANCELLED' | 'VOID';

export interface CompanyProfile {
  company_name: string;
  legal_name: string;
  gstin: string;
  pan: string;
  state_code: string;
  state_name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  pincode: string;
  phone: string;
  email: string;
  website?: string;
  bank_name: string;
  bank_account_no: string;
  ifsc_code: string;
  branch: string;
}

// ---------------------------------------------------------------------------
// 3. E-INVOICE & E-WAY BILL FOUNDATION
// ---------------------------------------------------------------------------
export type EInvoiceStatus = 'NOT_CONFIGURED' | 'READY' | 'SUBMITTED' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface EInvoiceRecord {
  id: string;
  invoice_id: string;
  invoice_number: string;
  irn?: string;
  ack_number?: string;
  ack_date?: string;
  signed_invoice?: string;
  signed_qr_data?: string;
  status: EInvoiceStatus;
  error_message?: string;
  created_at: string;
}

export type EWayBillStatus = 'NOT_CONFIGURED' | 'READY' | 'GENERATED' | 'REJECTED' | 'CANCELLED';

export interface EWayBillRecord {
  id: string;
  invoice_id: string;
  invoice_number: string;
  ewb_number?: string;
  valid_until?: string;
  transporter_id?: string;
  transporter_name?: string;
  vehicle_number?: string;
  distance_km?: number;
  status: EWayBillStatus;
  error_message?: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 4. TALLY RECONCILIATION
// ---------------------------------------------------------------------------
export type TallyReconStatus =
  | 'MATCHED'
  | 'ERP_ONLY'
  | 'TALLY_ONLY'
  | 'VALUE_MISMATCH'
  | 'DATE_MISMATCH'
  | 'PARTIAL'
  | 'PENDING';

export interface TallyReconciliationItem {
  id: string;
  entity_type: 'INVOICE' | 'PAYMENT' | 'PURCHASE_INVOICE' | 'CUSTOMER';
  erp_id: string;
  erp_number: string;
  erp_amount: number;
  erp_date: string;
  tally_guid?: string;
  tally_voucher_number?: string;
  tally_amount?: number;
  tally_date?: string;
  recon_status: TallyReconStatus;
  difference_amount: number;
  notes?: string;
  is_reviewed: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  last_checked_at: string;
}

// ---------------------------------------------------------------------------
// 5. 15-AGENT MULTI-AGENT ARCHITECTURE & SESSIONS
// ---------------------------------------------------------------------------
export type AIAgentType =
  | 'ICON_COPILOT'
  | 'SALES_AGENT'
  | 'PROCUREMENT_AGENT'
  | 'ACCOUNTS_AGENT'
  | 'SERVICE_AGENT'
  | 'WARRANTY_AMC_AGENT'
  | 'ANALYTICS_AGENT'
  | 'MANAGEMENT_MD_AGENT'
  | 'CUSTOMER_INTELLIGENCE_AGENT'
  | 'COMMUNICATION_AGENT'
  | 'MARGIN_AGENT'
  | 'DISTRIBUTOR_INTELLIGENCE_AGENT'
  | 'DATA_QUALITY_AGENT'
  | 'WORKFLOW_RISK_AGENT'
  | 'KNOWLEDGE_AGENT'
  | 'PROSPECT_INTELLIGENCE_AGENT';

export interface AIAgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  timestamp: string;
}

export interface AIAgentSession {
  id: string;
  user_id: string;
  user_name: string;
  user_role: UserRole;
  agent_type: AIAgentType;
  preferred_language: string;
  messages: AIAgentMessage[];
  last_active_at: string;
  created_at: string;
}

export interface AIDailyBriefing {
  date: string;
  sales: {
    today: number;
    month: number;
    deals_count: number;
  };
  collections: {
    received_today: number;
    received_month: number;
    total_outstanding: number;
    overdue_amount: number;
  };
  pipeline: {
    active_quotations_count: number;
    expected_value: number;
  };
  procurement: {
    pending_orders_count: number;
    delayed_orders_count: number;
  };
  operations: {
    pending_installations_count: number;
    overdue_installations_count: number;
  };
  service: {
    open_tickets_count: number;
    critical_tickets_count: number;
  };
  attention_items: Array<{
    id: string;
    type: string;
    title: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    statement_type: 'FACT' | 'CALCULATION' | 'RECOMMENDATION';
    link_url?: string;
  }>;
  generated_at: string;
}

// ---------------------------------------------------------------------------
// 6. AI VOICE FOUNDATION
// ---------------------------------------------------------------------------
export type VoiceSessionStatus =
  | 'INITIATED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'TRANSFERRED_TO_HUMAN'
  | 'FAILED';

export interface VoiceCallSession {
  id: string;
  caller_phone: string;
  direction: 'INBOUND' | 'OUTBOUND';
  language: string;
  status: VoiceSessionStatus;
  identified_customer_id?: string;
  identified_customer_name?: string;
  transcript: Array<{
    speaker: 'caller' | 'agent' | 'system';
    text: string;
    timestamp: string;
  }>;
  human_handoff_requested: boolean;
  recording_consented: boolean;
  notes?: string;
  created_at: string;
  ended_at?: string;
}

// ---------------------------------------------------------------------------
// 7. DATA QUALITY, BUSINESS RISK & CUSTOMER OPPORTUNITIES
// ---------------------------------------------------------------------------
export interface DataQualityIssue {
  id: string;
  category: 'DUPLICATE_CUSTOMER' | 'DUPLICATE_PHONE' | 'DUPLICATE_GSTIN' | 'MISSING_HSN' | 'MISSING_PURCHASE_COST' | 'INVALID_MARGIN' | 'ORPHAN_PAYMENT' | 'UNMATCHED_TALLY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  entity_type: string;
  entity_id: string;
  entity_name: string;
  issue_description: string;
  resolution_action: string;
  is_resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
}

export interface BusinessRiskAlert {
  id: string;
  risk_type: 'LOW_MARGIN' | 'EXCESSIVE_DISCOUNT' | 'UNFOLLOWED_QUOTATION' | 'OVERDUE_PAYMENT' | 'DELAYED_PO' | 'DELAYED_INSTALLATION' | 'WARRANTY_EXPIRING' | 'AMC_EXPIRING' | 'TALLY_MISMATCH';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  related_entity_type?: string;
  related_entity_id?: string;
  metric_value?: number;
  threshold_value?: number;
  recommendation: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  created_at: string;
}

export interface CustomerOpportunity {
  id: string;
  customer_id: string;
  customer_name: string;
  opportunity_type: 'AMC_RENEWAL' | 'WARRANTY_EXT' | 'CROSS_SELL' | 'HARDWARE_UPGRADE' | 'REPLACEMENT' | 'DORMANT_REENGAGEMENT';
  title: string;
  pitch_summary: string;
  estimated_value: number;
  confidence_score: number;
  supporting_records: Array<{ type: string; id: string; name: string }>;
  status: 'NEW' | 'CONTACTED' | 'CONVERTED' | 'DISMISSED';
  created_at: string;
}

export interface WorkflowRule {
  id: string;
  name: string;
  trigger_event: string;
  conditions: Record<string, any>;
  action_type: 'CREATE_TASK' | 'SEND_NOTIFICATION' | 'SEND_EMAIL' | 'SEND_WHATSAPP' | 'CREATE_APPROVAL' | 'GENERATE_REPORT';
  action_payload: Record<string, any>;
  is_active: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 8. VERSION 8 CORE ENTERPRISE MODELS
// ---------------------------------------------------------------------------

export type ProjectType =
  | 'Home Theater'
  | 'Conference Room'
  | 'CCTV'
  | 'Networking'
  | 'AV Solutions'
  | 'Projectors'
  | 'Interactive Displays'
  | 'Integrated Technology'
  | 'Other';

export type ProjectStatus =
  | 'Planning'
  | 'Site Survey'
  | 'Costing & Quote'
  | 'Client Approval'
  | 'Advance Received'
  | 'Procurement'
  | 'In Execution'
  | 'Commissioning'
  | 'Handover'
  | 'Completed'
  | 'AMC Active'
  | 'On Hold'
  | 'Cancelled';

export type MilestoneStatus =
  | 'Pending'
  | 'In Progress'
  | 'Completed'
  | 'Invoiced'
  | 'Paid';

export interface ProjectMilestone {
  id: string;
  project_id: string;
  milestone_number: number;
  title: string;
  description?: string;
  percentage: number;
  amount: number;
  due_date?: string;
  status: MilestoneStatus;
  invoice_id?: string;
  invoice_number?: string;
  completed_at?: string;
  created_at: string;
}

export interface Project {
  id: string;
  project_number: string; // e.g. PRJ/2026-27/0001
  project_name: string;
  project_type: ProjectType;
  customer_id: string;
  customer_name: string;
  enquiry_id?: string;
  site_visit_id?: string;
  quotation_id?: string;
  sales_order_id?: string;
  lead_engineer_name?: string;
  status: ProjectStatus;
  total_project_value: number;
  total_cost: number;
  margin_pct: number;
  start_date?: string;
  target_completion_date?: string;
  actual_completion_date?: string;
  milestones?: ProjectMilestone[];
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface SupplierPriceOffer {
  id: string;
  offer_number: string; // e.g. SPO/2026-27/0001
  enquiry_id?: string;
  quotation_id?: string;
  product_id?: string;
  product_name: string;
  supplier_id?: string;
  supplier_name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  quoted_price: number;
  gst_rate: number;
  lead_time_days: number;
  warranty_terms?: string;
  communication_method: 'Phone' | 'Email' | 'WhatsApp' | 'In-Person' | 'Portal' | 'Other';
  is_selected: boolean;
  decision_notes?: string;
  attachment_url?: string;
  recorded_by: string;
  created_at: string;
}

export interface QuotationRevision {
  id: string;
  quotation_id: string;
  quotation_number?: string;
  revision_number: number;
  revision_tag?: string; // 'Rev 0', 'Rev 1', 'Rev 2'
  customer_visible_items?: QuotationItem[];
  internal_cost?: number;
  selling_price?: number;
  margin_pct?: number;
  subtotal?: number;
  taxable_amount?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  grand_total?: number;
  change_reason?: string;
  changed_by_name?: string;
  snapshot_data?: any;
  change_summary?: string;
  created_by?: string;
  created_at: string;
}

export interface ProjectSection {
  section_id: string;
  section_title: string; // e.g. 'A — Klipsch Home Theater Room 7.1.2'
  items: QuotationItem[];
  section_subtotal: number;
  section_installation?: number;
  section_discount?: number;
  section_total: number;
}

export interface RecordAttachment {
  id: string;
  parent_entity_type?:
    | 'Quotation'
    | 'SalesOrder'
    | 'SupplierOffer'
    | 'CustomerConfirmation'
    | 'Invoice'
    | 'SiteVisit'
    | 'Project'
    | 'ServiceTicket'
    | 'AMCContract'
    | 'Customer';
  parent_entity_id?: string;
  entity_type?: string;
  entity_id?: string;
  file_name: string;
  file_type: string;
  file_size_bytes?: number;
  file_size?: number;
  file_url: string;
  uploaded_by: string;
  uploaded_by_role?: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// 8. AI PROSPECT INTELLIGENCE & MARKET DISCOVERY (V8 PHASE B)
// ---------------------------------------------------------------------------
export type ProspectClassification = 'VERIFIED' | 'LIKELY' | 'HISTORICAL' | 'UNKNOWN';
export type ProspectConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type DecisionMakerDepartment =
  | 'PROJECTS'
  | 'PURCHASE'
  | 'MAINTENANCE'
  | 'SECURITY'
  | 'EXECUTIVE'
  | 'OTHER';
export type ProspectStatus =
  | 'DISCOVERED'
  | 'RESEARCHING'
  | 'DOSSIER_READY'
  | 'CONVERTED'
  | 'ARCHIVED';

export interface ProspectEvidenceSource {
  id?: string;
  company_id?: string;
  run_id?: string;
  source_name: string;
  source_url: string;
  retrieval_date: string;
  snippet_content: string;
  reliability: 'HIGH' | 'MEDIUM' | 'LOW';
  created_at?: string;
}

export interface ProspectCampaign {
  id: string;
  name: string;
  target_industry?: string;
  target_geography?: string;
  target_criteria?: Record<string, any>;
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED';
  created_at: string;
  updated_at: string;
}

export interface ProspectCompany {
  id: string;
  campaign_id?: string;
  company_name: string;
  normalized_name: string;
  domain?: string;
  industry?: string;
  headquarters_location?: string;
  target_geography?: string;
  estimated_revenue?: string;
  employee_count_range?: string;
  relevance_summary?: string;
  status: ProspectStatus;
  crm_customer_id?: string;
  latest_run_number: number;
  created_at: string;
  updated_at: string;
}

export interface ProspectResearchRun {
  id: string;
  company_id: string;
  run_number: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  summary?: string;
  key_findings?: Array<{
    title: string;
    description: string;
    classification: ProspectClassification;
    confidence: ProspectConfidence;
  }>;
  change_summary?: string;
  executed_by: string;
  created_at: string;
}

export interface ProspectDecisionMaker {
  id: string;
  company_id: string;
  run_id: string;
  full_name: string;
  title: string;
  department: DecisionMakerDepartment;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  classification: ProspectClassification;
  confidence: ProspectConfidence;
  evidence_sources?: ProspectEvidenceSource[];
  human_verified: boolean;
  verified_by?: string;
  verification_notes?: string;
  created_at: string;
}

export interface ProspectProject {
  id: string;
  company_id: string;
  run_id: string;
  project_name: string;
  location?: string;
  estimated_value?: string;
  timeline?: string;
  description?: string;
  technology_requirements?: string[];
  classification: ProspectClassification;
  confidence: ProspectConfidence;
  evidence_sources?: ProspectEvidenceSource[];
  created_at: string;
}

export interface ProspectVendorIntelligence {
  id: string;
  company_id: string;
  run_id: string;
  incumbent_vendor?: string;
  category: string;
  contract_status?: string;
  pain_points?: string;
  satisfaction_score?: string;
  classification: ProspectClassification;
  confidence: ProspectConfidence;
  evidence_sources?: ProspectEvidenceSource[];
  created_at: string;
}

export interface ProspectTechnologySignal {
  id: string;
  company_id: string;
  run_id: string;
  category: string;
  technologies_identified: string[];
  solution_fit_score: number; // 0 - 100
  notes?: string;
  classification: ProspectClassification;
  confidence: ProspectConfidence;
  evidence_sources?: ProspectEvidenceSource[];
  created_at: string;
}

export interface ProspectOpportunitySignal {
  id: string;
  company_id: string;
  run_id: string;
  signal_type: string;
  headline: string;
  detail?: string;
  recommended_entry_angle?: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  classification: ProspectClassification;
  confidence: ProspectConfidence;
  evidence_sources?: ProspectEvidenceSource[];
  created_at: string;
}

export interface ProspectDossier {
  company: ProspectCompany;
  current_run?: ProspectResearchRun;
  run_history: ProspectResearchRun[];
  decision_makers: ProspectDecisionMaker[];
  projects: ProspectProject[];
  vendor_intelligence: ProspectVendorIntelligence[];
  technology_signals: ProspectTechnologySignal[];
  opportunity_signals: ProspectOpportunitySignal[];
  evidence_sources: ProspectEvidenceSource[];
  relevance_analysis: {
    why_relevant: string;
    fit_score: number;
    recommended_entry_angle: string;
    key_decision_makers_count: number;
    verified_contacts_count: number;
  };
}

// ---------------------------------------------------------------------------
// 9. PROSPECT -> ENQUIRY / OPPORTUNITY BRIDGE (V8 PHASE C.1)
// ---------------------------------------------------------------------------
export interface ProspectEnquiryPreparation {
  prospectCompanyId: string;
  prospectDossierId: string; // Equivalent to prospectCompanyId
  companyName: string;
  domain?: string;
  industry?: string;
  headquartersLocation?: string;
  primaryContact: {
    fullName: string;
    title: string;
    department: string;
    email?: string;
    phone?: string;
    linkedinUrl?: string;
  };
  proposedSalesperson: string;
  proposedProductCategory: string;
  proposedRequirementSummary: string;
  proposedEstimatedBudget?: number;
  proposedSiteVisitRequired: boolean;
  recommendedEntryAngle: string;
  evidenceCitations: Array<{
    sourceName: string;
    sourceUrl: string;
    snippetContent: string;
    reliability: string;
  }>;
  duplicateCheck: {
    hasMatchingCustomer: boolean;
    matchingCustomer?: { id: string; name: string; code?: string; phone?: string; domain?: string };
    openEnquiriesCount: number;
    existingEnquiries: Array<{ id: string; number: string; status: string; requirement: string }>;
    alreadyConvertedToEnquiry: boolean;
  };
}

export interface ProspectConversionPayload {
  prospectCompanyId: string;
  prospectDossierId: string;
  idempotencyKey: string;
  linkExistingCustomer: boolean;
  crmCustomerId?: string;
  customerData?: {
    customerType: 'COMPANY' | 'INDIVIDUAL' | 'GOVERNMENT';
    customerName: string;
    companyName?: string;
    phone: string;
    email?: string;
    billingAddress?: string;
  };
  enquiryData: {
    salespersonName: string;
    productCategory: string;
    requirementSummary: string;
    estimatedBudget: number;
    siteVisitRequired: boolean;
    followUpDate?: string;
    priority?: string;
    initialNotes?: string;
  };
  convertedBy: string;
}

export interface EnquirySalesBrief {
  id: string;
  enquiry_id: string;
  customer_id?: string;
  prospect_dossier_id?: string;
  health_score: number; // 0-100
  health_status: 'STRONG' | 'MODERATE' | 'AT_RISK' | 'CRITICAL';
  requirement_analysis: {
    core_need: string;
    scope_complexity: 'LOW' | 'MEDIUM' | 'HIGH' | 'ENTERPRISE';
    key_specifications: string[];
    inferred_technology_stack: string[];
    budget_realism: 'REALISTIC' | 'UNDER_BUDGETED' | 'PREMIUM' | 'UNSPECIFIED';
  };
  customer_context: {
    company_or_individual: string;
    relationship_type: 'NEW' | 'EXISTING' | 'REPEAT' | 'HIGH_VALUE';
    historical_revenue: number;
    active_installations_count: number;
    credit_standing: string;
  };
  buying_signals: Array<{
    signal: string;
    strength: 'HIGH' | 'MEDIUM' | 'LOW';
    evidence: string;
  }>;
  decision_maker_context: {
    primary_contact_name: string;
    role_or_designation?: string;
    department?: string;
    influence_level: 'HIGH' | 'MEDIUM' | 'LOW';
    recommended_engagement: string;
  };
  project_signals: Array<{
    project_type: string;
    timeline: string;
    estimated_scale?: string;
    site_readiness: string;
  }>;
  vendor_intelligence: {
    incumbent_vendor?: string;
    competitors?: string[];
    displacement_angle?: string;
    pricing_pressure: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  opportunity_risks: Array<{
    risk: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    mitigation: string;
  }>;
  missing_information: Array<{
    item: string;
    impact: 'BLOCKING' | 'IMPORTANT' | 'NICE_TO_HAVE';
    suggested_question: string;
  }>;
  recommended_next_actions: Array<{
    action: string;
    priority: 'IMMEDIATE' | 'HIGH' | 'MEDIUM';
    due_in_days: number;
    target_outcome: string;
  }>;
  follow_up_intelligence: {
    recommended_follow_up_date: string;
    recommended_channel: 'CALL' | 'WHATSAPP' | 'EMAIL' | 'SITE_VISIT';
    suggested_opening_script: string;
    key_value_hook: string;
  };
  generated_by: string;
  created_at: string;
  updated_at?: string;
}

export interface SiteVisitIntelligence {
  id: string;
  site_visit_id: string;
  visit_number: string;
  enquiry_id?: string;
  customer_id?: string;
  pre_visit_brief: {
    customer_overview: string;
    site_context: string;
    proposed_solution_overview: string;
    key_stakeholder: string;
    critical_measurement_focus: string[];
  };
  requirement_checklist: Array<{
    item: string;
    category: 'DIMENSIONS' | 'ELECTRICAL' | 'ACOUSTICS' | 'LIGHTING' | 'NETWORK' | 'CIVIL';
    mandatory: boolean;
    verified: boolean;
    notes?: string;
  }>;
  technical_questions: Array<{
    question: string;
    context: string;
    suggested_answer_type: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'CHOICE';
    answer?: string;
  }>;
  equipment_checklist: Array<{
    tool_name: string;
    purpose: string;
    mandatory: boolean;
    packed: boolean;
  }>;
  post_visit_summary?: {
    room_dimensions: string;
    ambient_lux_level?: string;
    reverberation_notes?: string;
    conduit_and_cabling_readiness: string;
    power_and_grounding_readiness: string;
    mounting_surface_strength: string;
    technician_observations: string;
  };
  extracted_requirements?: Array<{
    component: string;
    specification: string;
    quantity_estimate: number;
    readiness_prerequisite?: string;
  }>;
  status: 'PLANNED' | 'BRIEF_READY' | 'IN_PROGRESS' | 'SURVEYED' | 'SYNTHESIZED' | 'CONVERTED';
  converted_to_enquiry_at?: string;
  created_at: string;
  updated_at?: string;
}

