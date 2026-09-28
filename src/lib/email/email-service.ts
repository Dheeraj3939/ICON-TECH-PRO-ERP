import type {
  EmailMessage,
  EmailSendResult,
  EmailLogRecord,
  IEmailProvider,
  EmailEntityType,
} from '@/types/email-provider';
import { defaultGmailProvider } from './providers/gmail-provider';
import { logAuditEvent } from '@/lib/audit/logger';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_EMAIL_LOGS__: EmailLogRecord[] | undefined;
}

function getEmailLogsStore(): EmailLogRecord[] {
  if (!globalThis.__ICON_EMAIL_LOGS__) {
    globalThis.__ICON_EMAIL_LOGS__ = [];
  }
  return globalThis.__ICON_EMAIL_LOGS__;
}

export class EmailService {
  private static provider: IEmailProvider = defaultGmailProvider;

  /**
   * Set or override the active email provider (e.g. for testing or alternate gateways)
   */
  public static setProvider(provider: IEmailProvider): void {
    EmailService.provider = provider;
  }

  /**
   * Get the active email provider
   */
  public static getProvider(): IEmailProvider {
    return EmailService.provider;
  }

  /**
   * Send an email with full ERP audit logging and activity tracking.
   */
  public static async sendEmail(
    message: EmailMessage,
    actor?: { id?: string; name?: string }
  ): Promise<EmailSendResult & { logId: string }> {
    const provider = EmailService.provider;
    const sentAt = new Date().toISOString();
    const logId = `EML-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

    // Normalize recipients for logging
    const toStr = Array.isArray(message.to) ? message.to.join(', ') : message.to;
    const ccStr = message.cc ? (Array.isArray(message.cc) ? message.cc.join(', ') : message.cc) : undefined;
    const bccStr = message.bcc ? (Array.isArray(message.bcc) ? message.bcc.join(', ') : message.bcc) : undefined;

    const attachmentNames = (message.attachments || []).map((a) => a.filename);
    const attachmentCount = attachmentNames.length;
    const hasAttachments = attachmentCount > 0;

    const userName = actor?.name || message.metadata?.userName || 'System';
    const userId = actor?.id || message.metadata?.userId;

    let result: EmailSendResult;

    try {
      result = await provider.sendEmail(message);
    } catch (err: any) {
      result = {
        success: false,
        error: err.message || 'Unknown email dispatch error',
        provider: provider.name,
      };
    }

    // Build complete activity log record
    const logRecord: EmailLogRecord = {
      id: logId,
      provider: provider.name,
      from_email: 'icontechpro@gmail.com',
      to_email: toStr,
      cc_email: ccStr,
      bcc_email: bccStr,
      subject: message.subject,
      has_attachments: hasAttachments,
      attachment_count: attachmentCount,
      attachment_names: attachmentNames,
      status: result.success ? 'SENT' : 'FAILED',
      provider_message_id: result.messageId,
      provider_thread_id: result.threadId,
      error_message: result.error,
      sent_by_user_id: userId,
      sent_by_user_name: userName,
      customer_id: message.metadata?.customerId,
      customer_name: message.metadata?.customerName,
      enquiry_id: message.metadata?.enquiryId,
      quotation_id: message.metadata?.quotationId,
      invoice_id: message.metadata?.invoiceId,
      entity_type: message.metadata?.entityType || 'general',
      entity_id: message.metadata?.entityId,
      created_at: sentAt,
    };

    // 1. Store in memory buffer for immediate availability
    const memoryStore = getEmailLogsStore();
    memoryStore.unshift(logRecord);

    // 2. Persist to Supabase email_logs table if online
    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin.from('email_logs').insert([logRecord]);
      } catch (dbErr) {
        console.warn('Supabase email_logs insert failed, log preserved in memory:', dbErr);
      }
    }

    // 3. Emit immutable ERP Audit Log entry
    await logAuditEvent({
      userName,
      action: result.success ? 'EMAIL_SENT' : 'EMAIL_FAILED',
      module: 'COMMUNICATIONS',
      details: result.success
        ? `Sent email to ${toStr} via ${provider.name} (Subject: "${message.subject}", MsgID: ${result.messageId || 'N/A'}${hasAttachments ? `, ${attachmentCount} attachment(s)` : ''})`
        : `Failed to send email to ${toStr} via ${provider.name}: ${result.error}`,
    });

    return {
      ...result,
      logId,
    };
  }

  /**
   * Retrieve email logs with optional filtering.
   */
  public static async getEmailLogs(filter?: {
    entityType?: EmailEntityType;
    entityId?: string;
    customerId?: string;
    quotationId?: string;
    invoiceId?: string;
    limit?: number;
  }): Promise<EmailLogRecord[]> {
    const limit = filter?.limit || 50;

    // Check Supabase if available
    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        let query = admin.from('email_logs').select('*').order('created_at', { ascending: false }).limit(limit);

        if (filter?.entityType) query = query.eq('entity_type', filter.entityType);
        if (filter?.entityId) query = query.eq('entity_id', filter.entityId);
        if (filter?.customerId) query = query.eq('customer_id', filter.customerId);
        if (filter?.quotationId) query = query.eq('quotation_id', filter.quotationId);
        if (filter?.invoiceId) query = query.eq('invoice_id', filter.invoiceId);

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data as EmailLogRecord[];
        }
      } catch (err) {
        console.warn('Supabase email_logs query failed, using in-memory store:', err);
      }
    }

    // Fall back to in-memory store
    let records = [...getEmailLogsStore()];

    if (filter?.entityType) {
      records = records.filter((r) => r.entity_type === filter.entityType);
    }
    if (filter?.entityId) {
      records = records.filter((r) => r.entity_id === filter.entityId);
    }
    if (filter?.customerId) {
      records = records.filter((r) => r.customer_id === filter.customerId);
    }
    if (filter?.quotationId) {
      records = records.filter((r) => r.quotation_id === filter.quotationId);
    }
    if (filter?.invoiceId) {
      records = records.filter((r) => r.invoice_id === filter.invoiceId);
    }

    return records.slice(0, limit);
  }

  /**
   * Retrieve recent email activity logs for settings and administration screens.
   */
  public static async getRecentEmailLogs(limit: number = 20): Promise<EmailLogRecord[]> {
    return EmailService.getEmailLogs({ limit });
  }
}
