'use server';

import { revalidatePath } from 'next/cache';
import { requireRole, getAuthenticatedUser } from '@/lib/auth/session';
import { EmailService } from '@/lib/email/email-service';
import { getQuotationById } from '@/lib/actions/quotations';
import { getInvoices } from '@/lib/actions/billing';
import { getCompanySettings } from '@/lib/actions/company-settings';
import type {
  EmailMessage,
  EmailSendResult,
  EmailLogRecord,
  EmailEntityType,
  EmailAttachment,
} from '@/types/email-provider';

const TARGET_ACCOUNT_EMAIL = 'icontechpro@gmail.com';

/**
 * Send an arbitrary business email from the ERP.
 * Authorized for all staff with communications or sales roles.
 */
export async function sendBusinessEmailAction(params: {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  entityType?: EmailEntityType;
  entityId?: string;
  customerId?: string;
  customerName?: string;
  quotationId?: string;
  invoiceId?: string;
}): Promise<EmailSendResult & { logId: string }> {
  const actor = await requireRole([
    'Managing Director',
    'Admin / BDM',
    'BDM',
    'Sales Executive',
    'Accounts',
    'Office Assistant',
  ]);

  const message: EmailMessage = {
    to: params.to,
    cc: params.cc,
    bcc: params.bcc,
    replyTo: params.replyTo,
    subject: params.subject,
    text: params.text,
    html: params.html,
    attachments: params.attachments,
    metadata: {
      userId: actor.id,
      userName: actor.name,
      customerId: params.customerId,
      customerName: params.customerName,
      quotationId: params.quotationId,
      invoiceId: params.invoiceId,
      entityType: params.entityType || 'general',
      entityId: params.entityId,
    },
  };

  const result = await EmailService.sendEmail(message, { id: actor.id, name: actor.name });
  revalidatePath('/dashboard/settings/integrations');
  revalidatePath('/dashboard/communication');
  return result;
}

/**
 * Send an official quotation directly to a client with structured formatting and optional PDF attachment.
 */
export async function sendQuotationEmailAction(params: {
  quotationId: string;
  recipientEmail: string;
  ccEmail?: string;
  note?: string;
  includeAttachment?: boolean;
}): Promise<EmailSendResult & { logId?: string }> {
  try {
    const actor = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'BDM',
      'Sales Executive',
    ]);

    const quotation = await getQuotationById(params.quotationId);
    if (!quotation) {
      return {
        success: false,
        error: `Quotation #${params.quotationId} not found`,
        provider: 'gmail',
      };
    }

    const company = await getCompanySettings();

    // Format HTML email content
    const itemsHtml = (quotation.items || [])
      .map(
        (item: any, idx: number) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 12px; font-size: 13px; color: #475569;">${idx + 1}</td>
          <td style="padding: 8px 12px; font-size: 13px; font-weight: 500; color: #1e293b;">${item.item_name || item.description || 'Product'}</td>
          <td style="padding: 8px 12px; font-size: 13px; text-align: center; color: #475569;">${item.quantity || 1}</td>
          <td style="padding: 8px 12px; font-size: 13px; text-align: right; color: #475569;">₹${Number(item.unit_price || 0).toLocaleString('en-IN')}</td>
          <td style="padding: 8px 12px; font-size: 13px; text-align: right; font-weight: 600; color: #0f172a;">₹${Number(item.total_amount || 0).toLocaleString('en-IN')}</td>
        </tr>`
      )
      .join('');

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #1e3a8a; font-size: 22px; font-weight: 700;">${company.trade_name}</h2>
          <p style="margin: 4px 0 0; color: #64748b; font-size: 12px;">Audio Visual Systems & Enterprise IT Infrastructure</p>
        </div>

        <p style="font-size: 14px; line-height: 1.6; margin-bottom: 16px;">Dear Sir/Madam,</p>
        
        <p style="font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
          Please find below our formal quotation <strong>#${quotation.quotation_number}</strong> for <strong>${quotation.customer_name}</strong>.
        </p>

        ${params.note ? `<div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #334155; font-style: italic;">${params.note}</div>` : ''}

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left;">
              <th style="padding: 10px 12px; font-size: 12px; font-weight: 600; color: #475569;">#</th>
              <th style="padding: 10px 12px; font-size: 12px; font-weight: 600; color: #475569;">Item Description</th>
              <th style="padding: 10px 12px; font-size: 12px; font-weight: 600; text-align: center; color: #475569;">Qty</th>
              <th style="padding: 10px 12px; font-size: 12px; font-weight: 600; text-align: right; color: #475569;">Rate (₹)</th>
              <th style="padding: 10px 12px; font-size: 12px; font-weight: 600; text-align: right; color: #475569;">Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #f8fafc; font-weight: 700;">
              <td colspan="4" style="padding: 12px; text-align: right; font-size: 14px; color: #0f172a;">Grand Total (Inc. GST):</td>
              <td style="padding: 12px; text-align: right; font-size: 16px; color: #2563eb;">₹${Number(quotation.grand_total || 0).toLocaleString('en-IN')}</td>
            </tr>
          </tfoot>
        </table>

        <div style="background: #f8fafc; border-radius: 6px; padding: 14px; margin: 20px 0; font-size: 12px; color: #475569;">
          <h4 style="margin: 0 0 6px; color: #0f172a; font-size: 12px;">Standard Terms:</h4>
          <p style="margin: 2px 0;">• Validity: ${company.commercial_defaults?.quotation_validity_days || 15} days from quotation date</p>
          <p style="margin: 2px 0;">• Payment: ${company.commercial_defaults?.payment_terms || '100% advance against Proforma'}</p>
          <p style="margin: 2px 0;">• Warranty: ${company.commercial_defaults?.warranty_terms || '1 Year Standard Onsite'}</p>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #64748b; line-height: 1.5;">
          <strong>${company.legal_name}</strong><br/>
          ${company.registered_address}<br/>
          Phone: ${company.phone} | Email: ${company.email} | Web: ${company.website}
        </div>
      </div>
    `;

    const plainTextBody = `
Dear Sir/Madam,

Please find our formal quotation #${quotation.quotation_number} for ${quotation.customer_name}.

Grand Total: ₹${Number(quotation.grand_total || 0).toLocaleString('en-IN')}

${params.note ? `Note: ${params.note}\n\n` : ''}
Best Regards,
${company.trade_name} Sales Team
Phone: ${company.phone} | Email: ${company.email}
    `.trim();

    // Prepare attachments
    const attachments: EmailAttachment[] = [];
    if (params.includeAttachment) {
      const summaryText = `========================================================\n` +
        `QUOTATION: ${quotation.quotation_number}\n` +
        `Customer: ${quotation.customer_name}\n` +
        `Date: ${quotation.quotation_date || new Date().toISOString().split('T')[0]}\n` +
        `Grand Total: INR ${Number(quotation.grand_total || 0).toLocaleString('en-IN')}\n`
 +
        `========================================================\n\n` +
        `Issued by: ${company.legal_name}\nGSTIN: ${company.gstin}\n`;

      attachments.push({
        filename: `Quotation_${quotation.quotation_number.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`,
        content: Buffer.from(summaryText, 'utf-8'),
        contentType: 'text/plain',
      });
    }

    const message: EmailMessage = {
      to: params.recipientEmail,
      cc: params.ccEmail,
      subject: `Quotation #${quotation.quotation_number} from ${company.trade_name}`,
      text: plainTextBody,
      html: htmlBody,
      attachments: attachments.length > 0 ? attachments : undefined,
      metadata: {
        userId: actor.id,
        userName: actor.name,
        customerId: quotation.customer_id,
        customerName: quotation.customer_name,
        quotationId: quotation.id,
        entityType: 'quotation',
        entityId: quotation.id,
      },
    };

    const result = await EmailService.sendEmail(message, { id: actor.id, name: actor.name });
    revalidatePath('/dashboard/quotations');
    revalidatePath('/dashboard/settings/integrations');
    return result;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to send quotation email',
      provider: 'gmail',
    };
  }
}

/**
 * Send an official tax invoice notification directly to a customer.
 */
export async function sendInvoiceEmailAction(params: {
  invoiceId: string;
  recipientEmail: string;
  ccEmail?: string;
  note?: string;
  includeAttachment?: boolean;
}): Promise<EmailSendResult & { logId?: string }> {
  try {
    const actor = await requireRole([
      'Managing Director',
      'Admin / BDM',
      'Accounts',
    ]);

    const { invoices } = await getInvoices();
    const invoice = invoices.find((inv) => inv.id === params.invoiceId || inv.invoice_number === params.invoiceId);

    if (!invoice) {
      return {
        success: false,
        error: `Invoice #${params.invoiceId} not found`,
        provider: 'gmail',
      };
    }

    const company = await getCompanySettings();

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="border-bottom: 2px solid #059669; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #065f46; font-size: 22px; font-weight: 700;">${company.trade_name} — TAX INVOICE</h2>
          <p style="margin: 4px 0 0; color: #64748b; font-size: 12px;">Invoice No: <strong>${invoice.invoice_number}</strong></p>
        </div>

        <p style="font-size: 14px; line-height: 1.6; margin-bottom: 16px;">Dear ${invoice.customer_name || 'Valued Customer'},</p>
        
        <p style="font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
          Please find details for Tax Invoice <strong>${invoice.invoice_number}</strong> dated <strong>${invoice.invoice_date}</strong>.
        </p>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Total Amount:</td>
              <td style="padding: 6px 0; font-size: 14px; font-weight: 600; text-align: right; color: #0f172a;">₹${Number(invoice.grand_total || 0).toLocaleString('en-IN')}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Paid Amount:</td>
              <td style="padding: 6px 0; font-size: 14px; font-weight: 600; text-align: right; color: #059669;">₹${Number(invoice.paid_amount || 0).toLocaleString('en-IN')}</td>
            </tr>
            <tr style="border-top: 1px dashed #cbd5e1;">
              <td style="padding: 8px 0; font-size: 14px; font-weight: 700; color: #0f172a;">Balance Due:</td>
              <td style="padding: 8px 0; font-size: 16px; font-weight: 700; text-align: right; color: #dc2626;">₹${Number(invoice.balance_amount || 0).toLocaleString('en-IN')}</td>
            </tr>
          </table>
        </div>

        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 14px; margin: 20px 0; font-size: 12px; color: #1e3a8a;">
          <h4 style="margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #1e40af;">Direct Bank Transfer / NEFT Details:</h4>
          <p style="margin: 2px 0;">• Bank: <strong>${company.bank_details?.bank_name || 'IDBI Bank'}</strong></p>
          <p style="margin: 2px 0;">• Beneficiary: <strong>${company.bank_details?.account_name || 'ICON TECH PRO PRIVATE LIMITED'}</strong></p>
          <p style="margin: 2px 0;">• Account Number: <strong>${company.bank_details?.account_number || '0123102000012345'}</strong></p>
          <p style="margin: 2px 0;">• IFSC Code: <strong>${company.bank_details?.ifsc_code || 'IBKL0000123'}</strong></p>
          <p style="margin: 2px 0;">• UPI ID: <strong>${company.bank_details?.upi_id || 'icontechpro@idbi'}</strong></p>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #64748b; line-height: 1.5;">
          <strong>${company.legal_name}</strong><br/>
          GSTIN: ${company.gstin} | PAN: ${company.pan}<br/>
          ${company.registered_address}<br/>
          Phone: ${company.phone} | Email: ${company.email}
        </div>
      </div>
    `;

    const plainTextBody = `
Tax Invoice Notification
Invoice No: ${invoice.invoice_number}
Customer: ${invoice.customer_name}
Total Amount: ₹${Number(invoice.grand_total || 0).toLocaleString('en-IN')}
Balance Due: ₹${Number(invoice.balance_amount || 0).toLocaleString('en-IN')}

Bank Details:
Bank: ${company.bank_details?.bank_name || 'IDBI Bank'}
A/C: ${company.bank_details?.account_number || '0123102000012345'}
IFSC: ${company.bank_details?.ifsc_code || 'IBKL0000123'}

Best Regards,
Accounts Department, ${company.trade_name}
    `.trim();

    const attachments: EmailAttachment[] = [];
    if (params.includeAttachment) {
      const summaryText = `========================================================\n` +
        `TAX INVOICE: ${invoice.invoice_number}\n` +
        `Customer: ${invoice.customer_name}\n` +
        `Date: ${invoice.invoice_date}\n` +
        `Total Amount: INR ${Number(invoice.grand_total || 0).toLocaleString('en-IN')}\n`
 +
        `Paid Amount: INR ${Number(invoice.paid_amount || 0).toLocaleString('en-IN')}\n` +
        `Balance Due: INR ${Number(invoice.balance_amount || 0).toLocaleString('en-IN')}\n` +
        `========================================================\n\n` +
        `Issued by: ${company.legal_name}\nGSTIN: ${company.gstin}\n`;

      attachments.push({
        filename: `Invoice_${invoice.invoice_number.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`,
        content: Buffer.from(summaryText, 'utf-8'),
        contentType: 'text/plain',
      });
    }

    const message: EmailMessage = {
      to: params.recipientEmail,
      cc: params.ccEmail,
      subject: `Tax Invoice #${invoice.invoice_number} from ${company.trade_name}`,
      text: plainTextBody,
      html: htmlBody,
      attachments: attachments.length > 0 ? attachments : undefined,
      metadata: {
        userId: actor.id,
        userName: actor.name,
        customerId: invoice.customer_id,
        customerName: invoice.customer_name,
        invoiceId: invoice.id,
        entityType: 'invoice',
        entityId: invoice.id,
      },
    };

    const result = await EmailService.sendEmail(message, { id: actor.id, name: actor.name });
    revalidatePath('/dashboard/billing');
    revalidatePath('/dashboard/settings/integrations');
    return result;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to send invoice email',
      provider: 'gmail',
    };
  }
}

/**
 * Send an integration test email directly from Settings.
 * Supports sending standard plain text or rich email with an attachment.
 */
export async function sendIntegrationTestEmailAction(options?: {
  withAttachment?: boolean;
}): Promise<EmailSendResult & { logId?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);

    const attachments: EmailAttachment[] = [];
    if (options?.withAttachment) {
      attachments.push({
        filename: 'ICON_TECH_PRO_System_Verification.txt',
        content: `ICON TECH PRO ERP V9.2 — Gmail API Attachment Verification\nTarget Account: ${TARGET_ACCOUNT_EMAIL}\nTimestamp: ${new Date().toISOString()}\nStatus: Verified OK`,
        contentType: 'text/plain',
      });
    }

    const message: EmailMessage = {
      to: TARGET_ACCOUNT_EMAIL,
      subject: options?.withAttachment
        ? 'ICON TECH PRO ERP - Gmail Integration Test (With Attachment)'
        : 'ICON TECH PRO ERP - Gmail Integration Test',
      text: `This is a verification test email sent from ICON TECH PRO ERP V9.2 to ${TARGET_ACCOUNT_EMAIL}.${options?.withAttachment ? ' Includes verified test attachment.' : ''}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h3 style="color: #1e3a8a; margin-top: 0;">ICON TECH PRO ERP V9.2</h3>
          <p>This is a verification test email confirming active Gmail REST API connectivity for <strong>${TARGET_ACCOUNT_EMAIL}</strong>.</p>
          ${options?.withAttachment ? '<p style="color: #059669; font-weight: 600;">✓ Verification attachment included and validated.</p>' : ''}
          <hr style="border: 0; border-top: 1px solid #e2e8f0;" />
          <p style="font-size: 12px; color: #64748b;">Dispatched at: ${new Date().toLocaleString('en-IN')}</p>
        </div>
      `,
      attachments: attachments.length > 0 ? attachments : undefined,
      metadata: {
        userId: actor.id,
        userName: actor.name,
        entityType: 'test',
        entityId: 'TEST-EMAIL',
      },
    };

    const result = await EmailService.sendEmail(message, { id: actor.id, name: actor.name });
    revalidatePath('/dashboard/settings/integrations');
    return result;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to dispatch integration test email',
      provider: 'gmail',
    };
  }
}

/**
 * Retrieve recent email logs for display in Settings & Integrations screens.
 */
export async function getRecentEmailLogsAction(limit: number = 20): Promise<EmailLogRecord[]> {
  await getAuthenticatedUser();
  return EmailService.getRecentEmailLogs(limit);
}
