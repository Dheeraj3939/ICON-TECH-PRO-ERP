import type { IEmailProvider, EmailMessage, EmailSendResult } from '@/types/email-provider';
import { sendGmailMessage, getGmailConnectionStatus } from '@/lib/actions/gmail';

/**
 * Gmail OAuth 2.0 Provider Implementation.
 * Conforms to IEmailProvider interface.
 * Dispatches emails directly via official Google Gmail REST API v1.
 */
export class GmailProvider implements IEmailProvider {
  readonly name = 'gmail';

  async isConfigured(): Promise<boolean> {
    try {
      const status = await getGmailConnectionStatus();
      return status.connected;
    } catch {
      return false;
    }
  }

  async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    const result = await sendGmailMessage({
      to: message.to,
      cc: message.cc,
      bcc: message.bcc,
      replyTo: message.replyTo,
      subject: message.subject,
      text: message.text,
      html: message.html,
      isHtml: Boolean(message.html),
      attachments: message.attachments,
    });

    return {
      success: result.success,
      messageId: result.messageId,
      threadId: result.threadId,
      provider: 'gmail',
      error: result.error,
      sentAt: result.success ? new Date().toISOString() : undefined,
    };
  }
}

export const defaultGmailProvider = new GmailProvider();
