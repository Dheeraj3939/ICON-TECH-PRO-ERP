export type EmailEntityType =
  | 'customer'
  | 'enquiry'
  | 'quotation'
  | 'invoice'
  | 'sales_order'
  | 'purchase_order'
  | 'follow_up'
  | 'service'
  | 'test'
  | 'general';

export interface EmailAttachment {
  filename: string;
  content: string | Buffer; // utf-8 string, base64 string, or Buffer
  contentType?: string;
  encoding?: 'base64' | 'utf-8';
}

export interface EmailContextMetadata {
  userId?: string;
  userName?: string;
  customerId?: string;
  customerName?: string;
  enquiryId?: string;
  quotationId?: string;
  invoiceId?: string;
  salesOrderId?: string;
  entityType?: EmailEntityType;
  entityId?: string;
}

export interface EmailMessage {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  metadata?: EmailContextMetadata;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  provider: string;
  error?: string;
  sentAt?: string;
}

export interface IEmailProvider {
  readonly name: string;
  isConfigured(): Promise<boolean>;
  sendEmail(message: EmailMessage): Promise<EmailSendResult>;
}

export interface EmailLogRecord {
  id: string;
  provider: string;
  from_email: string;
  to_email: string;
  cc_email?: string;
  bcc_email?: string;
  subject: string;
  has_attachments: boolean;
  attachment_count: number;
  attachment_names?: string[];
  status: 'SENT' | 'FAILED' | 'QUEUED';
  provider_message_id?: string;
  provider_thread_id?: string;
  error_message?: string;
  sent_by_user_id?: string;
  sent_by_user_name?: string;
  customer_id?: string;
  customer_name?: string;
  enquiry_id?: string;
  quotation_id?: string;
  invoice_id?: string;
  entity_type?: EmailEntityType;
  entity_id?: string;
  created_at: string;
}
