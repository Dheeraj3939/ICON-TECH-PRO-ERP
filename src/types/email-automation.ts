export type AutomatedReportFrequency =
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'HALF_YEARLY'
  | 'ANNUAL';

export type ReportFormat = 'PDF' | 'EXCEL' | 'BOTH';

export type RecipientRole =
  | 'Managing Director'
  | 'Accounts'
  | 'Admin / BDM'
  | 'Sales Executive'
  | 'All Salespeople';

export interface AutomatedReportConfig {
  id: string;
  report_code: string;
  name: string;
  description: string;
  frequency: AutomatedReportFrequency;
  schedule_time: string; // e.g. "00:00" (Midnight Asia/Kolkata)
  timezone: string; // "Asia/Kolkata"
  formats: ReportFormat;
  allowed_roles: RecipientRole[];
  is_active: boolean;
  sections: string[];
  last_executed_at?: string;
  last_status?: 'SUCCESS' | 'FAILED' | 'RETRYING';
  created_at: string;
  updated_at: string;
}

export interface ScheduledReportPeriod {
  frequency: AutomatedReportFrequency;
  period_label: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  fiscal_year: string; // e.g. "2026-27"
  quarter?: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  half_year?: 'H1' | 'H2';
  is_provisional?: boolean;
}

export interface ScheduledReportRunRecord {
  id: string;
  config_id: string;
  report_code: string;
  report_name: string;
  frequency: AutomatedReportFrequency;
  period_label: string;
  start_date: string;
  end_date: string;
  generated_at: string;
  recipient_email: string;
  recipient_role: string;
  recipient_user_id?: string;
  salesperson_id?: string;
  pdf_url?: string;
  excel_url?: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'RETRYING';
  attempts: number;
  error_message?: string;
  idempotency_key: string;
}

export type CustomerEmailTrigger =
  | 'ENQUIRY_ACK'
  | 'QUOTATION_PDF'
  | 'PROFORMA_INVOICE'
  | 'ORDER_CONFIRMATION'
  | 'TAX_INVOICE'
  | 'DISPATCH_NOTIFICATION'
  | 'PAYMENT_ACKNOWLEDGEMENT'
  | 'PAYMENT_REMINDER'
  | 'WARRANTY_REMINDER'
  | 'AMC_REMINDER';

export type SupplierEmailTrigger =
  | 'RFQ'
  | 'PURCHASE_ORDER'
  | 'PO_REVISION'
  | 'DELIVERY_FOLLOWUP'
  | 'SUPPLIER_INVOICE_ACK'
  | 'SUPPLIER_PAYMENT_COMM';

export interface EmailAutomationRule {
  id: string;
  trigger_type: CustomerEmailTrigger | SupplierEmailTrigger;
  category: 'CUSTOMER' | 'SUPPLIER';
  name: string;
  description: string;
  subject_template: string;
  body_template: string;
  attach_document: boolean;
  requires_human_approval: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailQueueJob {
  id: string;
  rule_id?: string;
  trigger_type: string;
  recipient_type: 'CUSTOMER' | 'SUPPLIER' | 'INTERNAL_MANAGEMENT';
  recipient_email: string;
  recipient_name: string;
  entity_type: string; // 'quotations', 'invoices', 'proforma_invoices', 'orders', etc.
  entity_id: string;
  entity_number: string;
  subject: string;
  body_html: string;
  body_text?: string;
  attachments?: Array<{
    filename: string;
    content: string; // base64 or url
    contentType: string;
  }>;
  status: 'QUEUED' | 'SENT' | 'FAILED' | 'DEAD_LETTER';
  retry_count: number;
  max_retries: number;
  next_retry_at?: string;
  error_history?: string[];
  idempotency_key: string;
  created_at: string;
  sent_at?: string;
}
