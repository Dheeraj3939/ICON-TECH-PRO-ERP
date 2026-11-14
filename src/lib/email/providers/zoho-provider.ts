import type { IEmailProvider, EmailMessage, EmailSendResult } from '@/types/email-provider';
import { ZohoMailClient } from '@/lib/integrations/zoho/mail-client';
import { getStoredZohoCredentials } from '@/lib/integrations/zoho/token-manager';

/**
 * Enterprise Zoho Mail Provider for ICON TECH PRO ERP V9.2.
 * Primary transactional outbound dispatch provider conforming to IEmailProvider interface.
 */
export class ZohoProvider implements IEmailProvider {
  readonly name = 'zoho';
  private client: ZohoMailClient;

  constructor(client?: ZohoMailClient) {
    this.client = client || new ZohoMailClient();
  }

  async isConfigured(): Promise<boolean> {
    try {
      const creds = await getStoredZohoCredentials();
      return Boolean(creds && creds.status === 'ACTIVE' && creds.encrypted_refresh_token);
    } catch {
      return false;
    }
  }

  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    const to = Array.isArray(message.to) ? message.to : [message.to];

    // Validate recipient syntax before attempting transport
    for (const addr of to) {
      if (!addr || !addr.includes('@') || !addr.includes('.')) {
        return {
          success: false,
          provider: this.name,
          error: `INVALID_RECIPIENT: Malformed email address "${addr}".`,
        };
      }
    }

    const creds = await getStoredZohoCredentials().catch(() => null);
    if (!creds || creds.status !== 'ACTIVE' || !creds.encrypted_refresh_token) {
      return {
        success: false,
        provider: this.name,
        error: 'AUTH_UNAVAILABLE: Zoho Mail OAuth not connected yet; failing over to Gmail.',
      };
    }

    const primaryAccount = await this.client.fetchPrimaryMailAccount();
    if (!primaryAccount) {
      return {
        success: false,
        provider: this.name,
        error: 'AUTH_UNAVAILABLE: Unable to resolve active Zoho Mail account; failing over to Gmail.',
      };
    }

    const from = primaryAccount.primaryEmailAddress || 'sales@icontechpro.in';
    const accountId = primaryAccount.accountId;

    const htmlContent = message.html || `<p>${(message.text || '').replace(/\n/g, '<br/>')}</p>`;

    const attachments = (message.attachments || []).map((att) => ({
      filename: att.filename,
      content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : String(att.content),
      contentType: att.contentType || 'application/octet-stream',
    }));

    try {
      const result = await this.client.sendMailMessage({
        accountId,
        fromAddress: from,
        toAddress: to,
        ccAddress: message.cc,
        bccAddress: message.bcc,
        subject: message.subject,
        content: htmlContent,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      if (result.success) {
        return {
          success: true,
          messageId: result.messageId || `zm_${Date.now()}`,
          provider: this.name,
          sentAt: new Date().toISOString(),
        };
      }

      return {
        success: false,
        provider: this.name,
        error: result.error || 'Zoho Mail dispatch failed',
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        error: err.message || 'Unexpected transport error in Zoho Mail provider',
      };
    }
  }
}

export const defaultZohoProvider = new ZohoProvider();
