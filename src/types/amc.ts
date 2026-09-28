export type AMCOpportunityType =
  | 'RENEWAL'
  | 'NEW_FROM_WARRANTY'
  | 'NEW_FROM_SERVICE'
  | 'UPGRADE';

export type AMCOpportunityStatus =
  | 'IDENTIFIED'
  | 'OUTREACH_PENDING_APPROVAL'
  | 'OUTREACH_SENT'
  | 'IN_NEGOTIATION'
  | 'RENEWED'
  | 'DECLINED';

export type AMCOutreachChannel = 'WHATSAPP' | 'EMAIL' | 'PHONE';

export interface AMCOpportunity {
  id: string;
  opportunity_number: string; // e.g. AMC-OPP-26-0001
  customer_id: string;
  customer_name: string;
  company_name?: string;
  contact_phone?: string;
  contact_email?: string;
  source_contract_id?: string;
  source_contract_number?: string;
  source_service_ticket_id?: string;
  source_invoice_id?: string;
  opportunity_type: AMCOpportunityType;
  expiry_date?: string; // YYYY-MM-DD
  days_until_expiry: number; // 45, 30, 15, or negative if expired
  target_annual_value: number;
  recommended_package: 'COMPREHENSIVE' | 'NON_COMPREHENSIVE';
  responsible_employee_name: string;
  status: AMCOpportunityStatus;
  ai_recommendation?: string;
  draft_message?: string;
  draft_channel: AMCOutreachChannel;
  is_approved: boolean;
  approved_by_name?: string;
  approved_at?: string;
  outreach_sent_at?: string;
  last_follow_up_at?: string;
  notes?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AMCIntelligenceSummary {
  totalActiveAMCs: number;
  expiringIn45Days: number;
  alreadyExpired: number;
  totalOpportunityPipelineValue: number;
  pendingApprovalCount: number;
  outreachSentCount: number;
  renewedCount: number;
}
