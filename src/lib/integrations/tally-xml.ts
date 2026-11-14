import type { TallySyncItem, TallyLedgerMapping } from '@/types/erp';

export interface TallyInvoiceXmlSource {
  invoice_number: string;
  invoice_date?: string | null;
  customer_name: string;
  company_name?: string | null;
  gstin?: string | null;
  subtotal?: number | null;
  cgst_amount?: number | null;
  sgst_amount?: number | null;
  igst_amount?: number | null;
  gst_amount?: number | null;
  grand_total?: number | null;
  order_number?: string | null;
}

export interface TallyPaymentXmlSource {
  payment_number: string;
  payment_date?: string | null;
  customer_name: string;
  company_name?: string | null;
  invoice_number?: string | null;
  amount: number;
  mode?: string | null;
  reference_number?: string | null;
  bank_name?: string | null;
}

export interface TallyPurchaseXmlSource {
  po_number: string;
  order_date?: string | null;
  supplier_name: string;
  subtotal?: number | null;
  gst_amount?: number | null;
  total_amount?: number | null;
}

export function escapeTallyXml(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function formatTallyDate(dateInput?: string | null): string {
  if (!dateInput) {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '');
  }
  const parsed = new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '');
  }
  return parsed.toISOString().slice(0, 10).replace(/-/g, '');
}

function fmtAmount(num: number): string {
  return Number(num || 0).toFixed(2);
}

/**
 * Builds a TallyPrime 7.2 compatible Import XML Envelope for a queued voucher.
 */
export function buildTallyVoucherXml(params: {
  item: TallySyncItem;
  companyName?: string;
  invoice?: TallyInvoiceXmlSource | null;
  payment?: TallyPaymentXmlSource | null;
  purchase?: TallyPurchaseXmlSource | null;
  mappings?: TallyLedgerMapping[];
}): string {
  const { item, invoice, payment, purchase, mappings = [] } = params;
  const companyName = params.companyName || 'ICON TECH PRO';
  const vchType = item.tally_voucher_type || 'Sales';

  const findMappedLedger = (erpNameOrId: string, fallback: string): string => {
    const match = mappings.find(
      (m) =>
        m.erp_id === erpNameOrId ||
        m.erp_name.toLowerCase() === erpNameOrId.toLowerCase()
    );
    return match?.tally_ledger_name || fallback;
  };

  let dateStr = formatTallyDate(item.created_at);
  let voucherNumber = item.entity_number;
  let partyLedger = '';
  let narration = `ICON TECH PRO ERP (${item.id}) - ${item.payload_summary}`;
  let ledgerEntriesXml = '';

  if (item.entity_type === 'SALES_INVOICE' && invoice) {
    dateStr = formatTallyDate(invoice.invoice_date || item.created_at);
    voucherNumber = invoice.invoice_number;
    const rawParty = invoice.company_name || invoice.customer_name;
    partyLedger = findMappedLedger(rawParty, rawParty);
    const subtotal = Number(invoice.subtotal || 0);
    const cgst = Number(invoice.cgst_amount || 0);
    const sgst = Number(invoice.sgst_amount || 0);
    const igst = Number(invoice.igst_amount || 0);
    const totalGst = cgst + sgst + igst > 0 ? cgst + sgst + igst : Number(invoice.gst_amount || 0);
    const grandTotal = Number(invoice.grand_total || subtotal + totalGst);

    const effCgst = cgst > 0 ? cgst : igst === 0 ? totalGst / 2 : 0;
    const effSgst = sgst > 0 ? sgst : igst === 0 ? totalGst / 2 : 0;
    const effIgst = igst;

    narration = `Sales Invoice ${voucherNumber}${invoice.order_number ? ` (Order ${invoice.order_number})` : ''} - ERP Sync ${item.id}`;

    const taxEntries: string[] = [];
    if (effCgst > 0) {
      taxEntries.push(`
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeTallyXml(findMappedLedger('TAX-CGST-9', 'Output CGST 9%'))}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${fmtAmount(effCgst)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`);
    }
    if (effSgst > 0) {
      taxEntries.push(`
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeTallyXml(findMappedLedger('TAX-SGST-9', 'Output SGST 9%'))}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${fmtAmount(effSgst)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`);
    }
    if (effIgst > 0) {
      taxEntries.push(`
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeTallyXml(findMappedLedger('TAX-IGST-18', 'Output IGST 18%'))}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${fmtAmount(effIgst)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`);
    }

    ledgerEntriesXml = `
            <PARTYLEDGERNAME>${escapeTallyXml(partyLedger)}</PARTYLEDGERNAME>
            <PARTYGSTIN>${escapeTallyXml(invoice.gstin || '')}</PARTYGSTIN>
            <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeTallyXml(partyLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
              <AMOUNT>-${fmtAmount(grandTotal)}</AMOUNT>
              <BILLALLOCATIONS.LIST>
                <NAME>${escapeTallyXml(voucherNumber)}</NAME>
                <BILLTYPE>New Ref</BILLTYPE>
                <AMOUNT>-${fmtAmount(grandTotal)}</AMOUNT>
              </BILLALLOCATIONS.LIST>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales - Audio Visual &amp; IT Solutions</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${fmtAmount(subtotal)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>${taxEntries.join('')}`;
  } else if (item.entity_type === 'PAYMENT' && payment) {
    dateStr = formatTallyDate(payment.payment_date || item.created_at);
    voucherNumber = payment.payment_number;
    const rawParty = payment.company_name || payment.customer_name;
    partyLedger = findMappedLedger(rawParty, rawParty);
    const amount = Number(payment.amount || 0);
    const bankLedger =
      payment.mode === 'Cash'
        ? 'Cash-in-Hand'
        : payment.bank_name || findMappedLedger('BANK-PRIMARY', 'HDFC Bank Current A/c');
    narration = `Receipt ${voucherNumber} via ${payment.mode || 'Bank Transfer'} Ref: ${payment.reference_number || 'N/A'} - ERP Sync ${item.id}`;

    ledgerEntriesXml = `
            <PARTYLEDGERNAME>${escapeTallyXml(partyLedger)}</PARTYLEDGERNAME>
            <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeTallyXml(partyLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
              <AMOUNT>${fmtAmount(amount)}</AMOUNT>${
                payment.invoice_number
                  ? `
              <BILLALLOCATIONS.LIST>
                <NAME>${escapeTallyXml(payment.invoice_number)}</NAME>
                <BILLTYPE>Agst Ref</BILLTYPE>
                <AMOUNT>${fmtAmount(amount)}</AMOUNT>
              </BILLALLOCATIONS.LIST>`
                  : ''
              }
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeTallyXml(bankLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${fmtAmount(amount)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
  } else if (item.entity_type === 'PURCHASE_INVOICE' && purchase) {
    dateStr = formatTallyDate(purchase.order_date || item.created_at);
    voucherNumber = purchase.po_number;
    partyLedger = findMappedLedger(purchase.supplier_name, purchase.supplier_name);
    const subtotal = Number(purchase.subtotal || 0);
    const gst = Number(purchase.gst_amount || 0);
    const total = Number(purchase.total_amount || subtotal + gst);
    const halfGst = gst / 2;
    narration = `Purchase ${voucherNumber} from ${purchase.supplier_name} - ERP Sync ${item.id}`;

    ledgerEntriesXml = `
            <PARTYLEDGERNAME>${escapeTallyXml(partyLedger)}</PARTYLEDGERNAME>
            <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeTallyXml(partyLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
              <AMOUNT>${fmtAmount(total)}</AMOUNT>
              <BILLALLOCATIONS.LIST>
                <NAME>${escapeTallyXml(voucherNumber)}</NAME>
                <BILLTYPE>New Ref</BILLTYPE>
                <AMOUNT>${fmtAmount(total)}</AMOUNT>
              </BILLALLOCATIONS.LIST>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Purchase - AV &amp; IT Hardware</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${fmtAmount(subtotal)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>${
              halfGst > 0
                ? `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Input CGST 9%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${fmtAmount(halfGst)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Input SGST 9%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${fmtAmount(halfGst)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`
                : ''
            }`;
  }

  return `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeTallyXml(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${escapeTallyXml(vchType)}" ACTION="Create">
            <DATE>${dateStr}</DATE>
            <VOUCHERTYPENAME>${escapeTallyXml(vchType)}</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${escapeTallyXml(voucherNumber)}</VOUCHERNUMBER>
            <NARRATION>${escapeTallyXml(narration)}</NARRATION>${ledgerEntriesXml}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

/**
 * XML request sent by the Office PC bridge agent to TallyPrime 7.2 HTTP XML Server (port 9000)
 * to discover currently open companies.
 */
export function buildTallyCompanyListRequestXml(): string {
  return `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>ICONListofCompanies</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="ICONListofCompanies" ISMODIFY="No">
            <TYPE>Company</TYPE>
            <FETCH>NAME, STARTINGFROM, BOOKSFROM, GUID</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}
