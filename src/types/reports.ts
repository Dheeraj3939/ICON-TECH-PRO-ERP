export type ReportDataSource =
  | 'SALES_ORDERS'
  | 'QUOTATIONS'
  | 'INVOICES'
  | 'PURCHASE_ORDERS'
  | 'INVENTORY'
  | 'SERIALS'
  | 'SERVICE'
  | 'CUSTOMERS';

export type ReportCalculation =
  | 'SUM'
  | 'COUNT'
  | 'AVERAGE'
  | 'MIN'
  | 'MAX'
  | 'PERCENTAGE'
  | 'MARGIN'
  | 'BALANCE'
  | 'OUTSTANDING';

export interface ReportFilterCondition {
  field: string;
  operator: 'EQUALS' | 'CONTAINS' | 'GTE' | 'LTE' | 'IN' | 'NOT_EQUALS';
  value: any;
}

export interface ReportDefinition {
  id: string;
  title: string;
  description: string;
  data_source: ReportDataSource;
  category: 'SALES' | 'FINANCE' | 'OPERATIONS' | 'MANAGEMENT' | 'CUSTOM';
  selected_fields: string[];
  group_by_field?: string;
  calculation?: ReportCalculation;
  calculation_field?: string;
  filters?: ReportFilterCondition[];
  is_company_report: boolean;
  is_favorite?: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'currency' | 'date' | 'badge';
}

export interface ReportResult {
  report: ReportDefinition;
  columns: ReportColumn[];
  rows: Record<string, any>[];
  summary: {
    totalRecords: number;
    aggregatedValue?: number;
    calculatedMetricLabel?: string;
  };
  generated_at: string;
  generated_by_role: string;
}

export type ReportFrequency =
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'ANNUAL'
  | 'CUSTOM'
  | 'THRESHOLD_EVENT';

export type ReportDeliveryChannel = 'ERP_NOTIFICATION' | 'EMAIL' | 'WHATSAPP';

export interface ReportSubscription {
  id: string;
  report_id: string;
  report_title: string;
  user_id: string;
  user_name: string;
  recipient_target: string; // email or whatsapp phone number
  frequency: ReportFrequency;
  channel: ReportDeliveryChannel;
  include_ai_summary: boolean;
  is_active: boolean;
  last_run_at?: string;
  next_run_at: string;
  created_at: string;
}
