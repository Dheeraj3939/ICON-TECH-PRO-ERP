/**
 * Document Generation & Lifecycle Engine for ICON TECH PRO ERP
 * Supports all 13 standard technology reseller document types,
 * lifecycle validation, company branding, and printable A4 layouts.
 */

import type { DocumentType, DocumentLifecycleStatus, CompanyProfile } from '@/types/erp';
import { calculateDocumentTaxes, TELANGANA_STATE_CODE } from '@/lib/utils/tax';

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  company_name: 'ICON TECH PRO',
  legal_name: 'ICON TECH PRO SOLUTIONS PVT LTD',
  gstin: '36AAACI1234F1Z8',
  pan: 'AAACI1234F',
  state_code: '36',
  state_name: 'Telangana',
  address_line1: 'Plot #42, Madhapur Tech Zone, Hitec City',
  address_line2: 'Phase 2, Cyberabad',
  city: 'Hyderabad',
  pincode: '500081',
  phone: '+91 40 4850 1200',
  email: 'accounts@icontechpro.com',
  website: 'https://icontechpro.com',
  bank_name: 'HDFC Bank',
  bank_account_no: '50200081234567',
  ifsc_code: 'HDFC0001627',
  branch: 'Madhapur Branch, Hyderabad',
};

declare global {
  // eslint-disable-next-line no-var
  var __ICON_COMPANY_PROFILE__: CompanyProfile | undefined;
}

export function getCompanyProfile(): CompanyProfile {
  if (!globalThis.__ICON_COMPANY_PROFILE__) {
    globalThis.__ICON_COMPANY_PROFILE__ = { ...DEFAULT_COMPANY_PROFILE };
  }
  return globalThis.__ICON_COMPANY_PROFILE__;
}

export function updateCompanyProfile(profile: Partial<CompanyProfile>): CompanyProfile {
  const current = getCompanyProfile();
  globalThis.__ICON_COMPANY_PROFILE__ = { ...current, ...profile };
  return globalThis.__ICON_COMPANY_PROFILE__;
}

/**
 * Validates document lifecycle transitions.
 * Enforces business control rules so unapproved documents cannot be issued.
 */
export function validateLifecycleTransition(
  current: DocumentLifecycleStatus,
  target: DocumentLifecycleStatus
): { valid: boolean; reason?: string } {
  if (current === target) {
    return { valid: true };
  }

  // Terminal states cannot transition to anything
  if (current === 'CANCELLED' || current === 'VOID') {
    return {
      valid: false,
      reason: `Document is ${current} and cannot be transitioned to ${target}.`,
    };
  }

  const allowedTransitions: Record<DocumentLifecycleStatus, DocumentLifecycleStatus[]> = {
    DRAFT: ['REVIEW', 'CANCELLED', 'VOID'],
    REVIEW: ['APPROVED', 'DRAFT', 'CANCELLED'],
    APPROVED: ['ISSUED', 'REVIEW', 'CANCELLED'],
    ISSUED: ['CANCELLED', 'VOID'],
    CANCELLED: [],
    VOID: [],
  };

  const allowed = allowedTransitions[current] || [];
  if (allowed.includes(target)) {
    return { valid: true };
  }

  return {
    valid: false,
    reason: `Invalid transition from ${current} to ${target}. Allowed next states: ${allowed.join(', ') || 'None'}.`,
  };
}

export interface PrintableDocumentParty {
  name: string;
  legal_name?: string;
  gstin?: string;
  pan?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  state_code?: string;
  pincode?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
}

export interface PrintableDocumentItem {
  name: string;
  description?: string;
  sku?: string;
  hsn_sac?: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  discount?: number;
  gst_rate?: number;
  serial_numbers?: string[];
}

export interface PrintableDocumentData {
  docType: DocumentType;
  docNumber: string;
  date: string;
  dueDate?: string;
  referenceNumber?: string;
  company?: Partial<CompanyProfile>;
  party: PrintableDocumentParty;
  shippingParty?: PrintableDocumentParty;
  items: PrintableDocumentItem[];
  notes?: string;
  terms?: string[];
  bankDetailsOverride?: {
    bank_name: string;
    account_no: string;
    ifsc: string;
    branch: string;
  };
}

function formatCurrency(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Generates high-fidelity, responsive, printable HTML document layout
 * with complete GST compliance, HSN breakup, and company bank details.
 */
export function generatePrintableHtml(data: PrintableDocumentData): string {
  const comp = { ...getCompanyProfile(), ...(data.company || {}) };
  const party = data.party;
  const shipParty = data.shippingParty || party;

  // Calculate tax breakdown
  const taxItems = data.items.map((it) => ({
    hsn_sac: it.hsn_sac,
    quantity: it.quantity,
    unit_price: it.unit_price,
    discount_amount: it.discount || 0,
    gst_rate: it.gst_rate ?? 18,
  }));

  const taxSummary = calculateDocumentTaxes(taxItems, {
    company_state_code: comp.state_code,
    customer_gstin: party.gstin,
    shipping_state_code: shipParty.state_code || party.state_code,
    shipping_state_name: shipParty.state || party.state,
  });

  const docTitleMap: Record<DocumentType, string> = {
    QUOTATION: 'QUOTATION',
    SALES_ORDER: 'SALES ORDER',
    PURCHASE_ORDER: 'PURCHASE ORDER',
    DELIVERY_CHALLAN: 'DELIVERY CHALLAN',
    INSTALLATION_JOB_CARD: 'INSTALLATION JOB CARD',
    HANDOVER_CERTIFICATE: 'HANDOVER & SIGN-OFF CERTIFICATE',
    TAX_INVOICE: 'TAX INVOICE',
    PURCHASE_INVOICE: 'SUPPLIER PURCHASE INVOICE',
    CREDIT_NOTE: 'CREDIT NOTE',
    DEBIT_NOTE: 'DEBIT NOTE',
    PAYMENT_RECEIPT: 'PAYMENT RECEIPT',
    AMC_AGREEMENT: 'ANNUAL MAINTENANCE CONTRACT (AMC) AGREEMENT',
    SERVICE_REPORT: 'SERVICE CALL REPORT',
  };

  const title = docTitleMap[data.docType] || data.docType;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title} - ${data.docNumber}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    body { background-color: #f8fafc; color: #0f172a; padding: 20px; font-size: 12px; }
    .page { background: #ffffff; max-width: 800px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 6px; padding: 24px; }
    .header-table { width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 14px; }
    .company-title { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
    .company-subtitle { font-size: 11px; color: #475569; margin-top: 3px; }
    .doc-badge { background: #0f172a; color: #ffffff; padding: 6px 14px; border-radius: 4px; font-size: 15px; font-weight: 700; text-align: right; display: inline-block; }
    .meta-table { width: 100%; margin-top: 8px; font-size: 11px; }
    .meta-table td { padding: 2px 4px; }
    .two-col { width: 100%; display: flex; gap: 16px; margin-bottom: 14px; }
    .col-box { flex: 1; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px; background: #f8fafc; }
    .box-title { font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 6px; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11px; }
    .items-table th { background: #0f172a; color: #ffffff; font-weight: 600; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; }
    .items-table td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; vertical-align: top; }
    .items-table tr:nth-child(even) td { background: #f8fafc; }
    .serial-badge { display: inline-block; background: #e0f2fe; color: #0369a1; font-family: monospace; font-size: 9px; padding: 1px 4px; border-radius: 3px; margin: 2px 2px 0 0; }
    .summary-grid { width: 100%; display: flex; gap: 16px; margin-bottom: 14px; }
    .hsn-table { width: 100%; border-collapse: collapse; font-size: 10px; }
    .hsn-table th { background: #f1f5f9; padding: 4px 6px; border: 1px solid #cbd5e1; text-align: right; }
    .hsn-table th:first-child { text-align: left; }
    .hsn-table td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: right; }
    .hsn-table td:first-child { text-align: left; }
    .totals-box { width: 280px; margin-left: auto; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; font-size: 11px; }
    .totals-row { display: flex; justify-content: space-between; padding: 4px 10px; border-bottom: 1px solid #f1f5f9; }
    .totals-row.grand { background: #0f172a; color: #ffffff; font-size: 13px; font-weight: 700; border-bottom: none; }
    .footer-grid { width: 100%; display: flex; gap: 16px; margin-top: 14px; padding-top: 14px; border-top: 1px solid #cbd5e1; }
    .terms-box { flex: 2; font-size: 10px; color: #64748b; line-height: 1.4; }
    .terms-box ol { padding-left: 14px; }
    .sign-box { flex: 1; text-align: center; border: 1px solid #cbd5e1; border-radius: 4px; padding: 10px; }
    .sign-box .space { height: 48px; }
    @media print {
      body { background: #ffffff; padding: 0; }
      .page { border: none; padding: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="page">
    <table class="header-table">
      <tr>
        <td style="vertical-align: top; width: 60%;">
          <div class="company-title">${comp.company_name}</div>
          <div class="company-subtitle">${comp.legal_name}</div>
          <div style="font-size: 10px; color: #475569; margin-top: 4px;">
            ${comp.address_line1}, ${comp.address_line2 ? comp.address_line2 + ', ' : ''}${comp.city} - ${comp.pincode}<br>
            <strong>GSTIN:</strong> ${comp.gstin} | <strong>PAN:</strong> ${comp.pan} | <strong>State:</strong> ${comp.state_name} (Code: ${comp.state_code})<br>
            <strong>Email:</strong> ${comp.email} | <strong>Phone:</strong> ${comp.phone}
          </div>
        </td>
        <td style="vertical-align: top; text-align: right; width: 40%;">
          <div class="doc-badge">${title}</div>
          <table class="meta-table" style="margin-left: auto;">
            <tr><td><strong>Doc #:</strong></td><td style="text-align: right; font-weight: 700;">${data.docNumber}</td></tr>
            <tr><td><strong>Date:</strong></td><td style="text-align: right;">${data.date}</td></tr>
            ${data.dueDate ? `<tr><td><strong>Due Date:</strong></td><td style="text-align: right;">${data.dueDate}</td></tr>` : ''}
            ${data.referenceNumber ? `<tr><td><strong>Ref #:</strong></td><td style="text-align: right;">${data.referenceNumber}</td></tr>` : ''}
            <tr><td><strong>Place of Supply:</strong></td><td style="text-align: right;">${taxSummary.place_of_supply}</td></tr>
          </table>
        </td>
      </tr>
    </table>

    <div class="two-col">
      <div class="col-box">
        <div class="box-title">Billed To (Customer Details)</div>
        <div style="font-weight: 700; font-size: 12px;">${party.legal_name || party.name}</div>
        <div style="color: #475569; font-size: 11px; margin-top: 2px;">
          ${party.address_line1 || 'Address on file'}<br>
          ${party.city ? party.city + ', ' : ''}${party.state || ''} ${party.pincode ? '- ' + party.pincode : ''}<br>
          <strong>GSTIN:</strong> ${party.gstin || 'Unregistered / Consumer'}<br>
          ${party.phone ? `<strong>Phone:</strong> ${party.phone}<br>` : ''}
          ${party.email ? `<strong>Email:</strong> ${party.email}` : ''}
        </div>
      </div>
      <div class="col-box">
        <div class="box-title">Shipped / Dispatched To</div>
        <div style="font-weight: 700; font-size: 12px;">${shipParty.legal_name || shipParty.name}</div>
        <div style="color: #475569; font-size: 11px; margin-top: 2px;">
          ${shipParty.address_line1 || party.address_line1 || 'Same as billing address'}<br>
          ${shipParty.city || party.city || ''} ${shipParty.state || party.state || ''}<br>
          <strong>State Code:</strong> ${shipParty.state_code || party.state_code || comp.state_code}
        </div>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 4%;">#</th>
          <th style="width: 44%;">Item & Description</th>
          <th style="width: 12%;">HSN/SAC</th>
          <th style="width: 8%; text-align: right;">Qty</th>
          <th style="width: 14%; text-align: right;">Unit Rate</th>
          <th style="width: 8%; text-align: right;">GST</th>
          <th style="width: 14%; text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map((item, idx) => {
          const itemTotal = item.quantity * item.unit_price - (item.discount || 0);
          return `<tr>
            <td>${idx + 1}</td>
            <td>
              <div style="font-weight: 600;">${item.name}</div>
              ${item.description ? `<div style="font-size: 10px; color: #64748b;">${item.description}</div>` : ''}
              ${item.serial_numbers && item.serial_numbers.length > 0 ? `
                <div style="margin-top: 3px;">
                  <strong style="font-size: 9px; color: #0284c7;">S/N:</strong>
                  ${item.serial_numbers.map((s) => `<span class="serial-badge">${s}</span>`).join('')}
                </div>` : ''}
            </td>
            <td>${item.hsn_sac || '85286900'}</td>
            <td style="text-align: right;">${item.quantity} ${item.unit || 'Nos'}</td>
            <td style="text-align: right;">${formatCurrency(item.unit_price)}</td>
            <td style="text-align: right;">${item.gst_rate ?? 18}%</td>
            <td style="text-align: right; font-weight: 600;">${formatCurrency(itemTotal)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>

    <div class="summary-grid">
      <div style="flex: 1;">
        <div style="font-weight: 700; font-size: 10px; margin-bottom: 4px; text-transform: uppercase; color: #475569;">HSN / SAC Tax Breakup</div>
        <table class="hsn-table">
          <thead>
            <tr>
              <th>HSN/SAC</th>
              <th>Taxable</th>
              ${taxSummary.is_interstate ? `<th>IGST</th>` : `<th>CGST</th><th>SGST/UTGST</th>`}
              <th>Total Tax</th>
            </tr>
          </thead>
          <tbody>
            ${taxSummary.hsn_summary.map((h) => `<tr>
              <td>${h.hsn_sac} (${h.gst_rate}%)</td>
              <td>${formatCurrency(h.taxable_amount)}</td>
              ${taxSummary.is_interstate ? `
                <td>${formatCurrency(h.igst_amount)}</td>
              ` : `
                <td>${formatCurrency(h.cgst_amount)}</td>
                <td>${formatCurrency(h.sgst_amount + h.utgst_amount)}</td>
              `}
              <td>${formatCurrency(h.total_tax)}</td>
            </tr>`).join('')}
          </tbody>
        </table>

        <div style="margin-top: 10px; padding: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 10px;">
          <strong>Bank Transfer Details (NEFT / RTGS / IMPS):</strong><br>
          Account Name: <strong>${comp.legal_name}</strong><br>
          Bank: <strong>${comp.bank_name}</strong> | A/C No: <strong>${comp.bank_account_no}</strong> | IFSC: <strong>${comp.ifsc_code}</strong>
        </div>
      </div>

      <div class="totals-box">
        <div class="totals-row">
          <span>Subtotal</span>
          <span>${formatCurrency(taxSummary.subtotal)}</span>
        </div>
        ${taxSummary.total_discount > 0 ? `
          <div class="totals-row">
            <span>Discount</span>
            <span>-${formatCurrency(taxSummary.total_discount)}</span>
          </div>
        ` : ''}
        <div class="totals-row">
          <span>Taxable Amount</span>
          <span>${formatCurrency(taxSummary.taxable_amount)}</span>
        </div>
        ${taxSummary.is_interstate ? `
          <div class="totals-row">
            <span>IGST</span>
            <span>${formatCurrency(taxSummary.igst_amount)}</span>
          </div>
        ` : `
          <div class="totals-row">
            <span>CGST</span>
            <span>${formatCurrency(taxSummary.cgst_amount)}</span>
          </div>
          <div class="totals-row">
            <span>${taxSummary.is_sez ? 'SGST' : 'SGST / UTGST'}</span>
            <span>${formatCurrency(taxSummary.sgst_amount + taxSummary.utgst_amount)}</span>
          </div>
        `}
        ${taxSummary.round_off !== 0 ? `
          <div class="totals-row">
            <span>Round Off</span>
            <span>${taxSummary.round_off > 0 ? '+' : ''}${taxSummary.round_off.toFixed(2)}</span>
          </div>
        ` : ''}
        <div class="totals-row grand">
          <span>Total Amount</span>
          <span>${formatCurrency(taxSummary.grand_total)}</span>
        </div>
      </div>
    </div>

    <div class="footer-grid">
      <div class="terms-box">
        <strong>Terms & Conditions:</strong>
        <ol>
          ${(data.terms && data.terms.length > 0 ? data.terms : [
            'Goods once sold will not be taken back or exchanged.',
            'Warranty is provided directly by the respective OEM manufacturer as per their standard policy.',
            'Payment is strictly due within agreed credit terms from the date of invoice.',
            'Interest @ 18% p.a. will be levied on overdue bills.',
            'Subject to Hyderabad jurisdiction only.',
          ]).map((t) => `<li>${t}</li>`).join('')}
        </ol>
      </div>
      <div class="sign-box">
        <div style="font-size: 10px; color: #475569;">For <strong>${comp.legal_name}</strong></div>
        <div class="space"></div>
        <div style="font-size: 11px; font-weight: 700; border-top: 1px dashed #94a3b8; padding-top: 4px;">Authorized Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
