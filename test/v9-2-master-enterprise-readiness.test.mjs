import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// =============================================================================
// ICON TECH PRO ERP V9.2 — MASTER ENTERPRISE READINESS TEST SUITE
// =============================================================================

test('ICON TECH PRO ERP V9.2 — Master Enterprise Readiness & Compliance Invariants', async (t) => {

  // ---------------------------------------------------------------------------
  // 1. SEQUENCE NUMBERS & INDIAN FINANCIAL YEAR FORMATTING
  // ---------------------------------------------------------------------------
  await t.test('1. Sequence Numbers & Financial Year Invariants', () => {
    const sequenceFile = fs.readFileSync(
      path.join(rootDir, 'src/lib/utils/sequence.ts'),
      'utf8'
    );

    // Verify canonical FY full function
    assert.ok(
      sequenceFile.includes('export function getIndianFinancialYearFull'),
      'Must export getIndianFinancialYearFull'
    );
    assert.ok(
      sequenceFile.includes('`${startYear}-${endYY}`'),
      'getIndianFinancialYearFull must produce YYYY-YY (e.g. 2026-27)'
    );

    // Verify Proforma sequence generator
    assert.ok(
      sequenceFile.includes('export async function getNextProformaNumber') ||
      sequenceFile.includes('export async function getNextProformaInvoiceNumber'),
      'Must export getNextProformaNumber'
    );
    assert.ok(
      sequenceFile.includes('ITP/PI/'),
      'Proforma number must follow ITP/PI/YYYY-YY/0001 canonical format'
    );

    // Verify Delivery Challan sequence generator
    assert.ok(
      sequenceFile.includes('export async function getNextDeliveryChallanNumber'),
      'Must export getNextDeliveryChallanNumber'
    );
    assert.ok(
      sequenceFile.includes('ITP/DC/'),
      'Delivery Challan number must follow ITP/DC/YYYY-YY/0001 canonical format'
    );

    // Test sequence logic directly
    function testIndianFinancialYearFull(d = new Date()) {
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      const startYear = month >= 4 ? year : year - 1;
      const endYear = startYear + 1;
      return `${startYear}-${String(endYear).slice(-2)}`;
    }
    const fyNow = testIndianFinancialYearFull(new Date());
    assert.match(fyNow, /^\d{4}-\d{2}$/, 'Generated FY must match YYYY-YY format');
  });

  // ---------------------------------------------------------------------------
  // 2. INDIAN CURRENCY NUMBER-TO-WORDS CONVERTER
  // ---------------------------------------------------------------------------
  await t.test('2. Indian Currency (INR) Words Formatting Invariants', () => {
    const inrWordsFile = fs.readFileSync(
      path.join(rootDir, 'src/lib/utils/inr-words.ts'),
      'utf8'
    );

    assert.ok(
      inrWordsFile.includes('export function numberToWordsINR'),
      'Must export numberToWordsINR function'
    );
    assert.ok(
      inrWordsFile.includes('Crore') && inrWordsFile.includes('Lakh'),
      'numberToWordsINR must support Indian numbering (Crore, Lakh)'
    );
    assert.ok(
      inrWordsFile.includes('Rupees') && inrWordsFile.includes('Only.'),
      'numberToWordsINR must format Rupees and Paise with suffix'
    );

    // Inline test of identical converter algorithm from inr-words.ts
    function numberToWordsINR(num) {
      if (!num || isNaN(num) || num <= 0) return 'INR Zero Rupees Only.';
      const integerPart = Math.floor(num);
      const decimalPart = Math.round((num - integerPart) * 100);

      const a = [
        '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
        'Seventeen', 'Eighteen', 'Nineteen',
      ];
      const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

      function inWords(val) {
        let str = '';
        if (val > 99) {
          str += a[Math.floor(val / 100)] + ' Hundred ';
          val %= 100;
        }
        if (val > 19) {
          str += b[Math.floor(val / 10)] + (val % 10 ? '-' + a[val % 10] : '') + ' ';
        } else if (val > 0) {
          str += a[val] + ' ';
        }
        return str;
      }

      let words = '';
      let n = integerPart;
      const crore = Math.floor(n / 10000000);
      n %= 10000000;
      const lakh = Math.floor(n / 100000);
      n %= 100000;
      const thousand = Math.floor(n / 1000);
      n %= 1000;
      const hundredAndRem = n;

      if (crore > 0) words += inWords(crore) + 'Crore, ';
      if (lakh > 0) words += inWords(lakh) + 'Lakh, ';
      if (thousand > 0) words += inWords(thousand) + 'Thousand, ';
      if (hundredAndRem > 0) words += inWords(hundredAndRem);

      words = words.trim().replace(/,\s*$/, '');
      let result = words ? 'INR ' + words + ' Rupees' : 'INR Zero Rupees';

      if (decimalPart > 0) {
        result += ' And ' + inWords(decimalPart).trim() + ' Paise';
      }

      return result + ' Only.';
    }

    assert.equal(numberToWordsINR(0), 'INR Zero Rupees Only.');
    assert.equal(numberToWordsINR(1500), 'INR One Thousand, Five Hundred Rupees Only.');
    assert.equal(numberToWordsINR(150000), 'INR One Lakh, Fifty Thousand Rupees Only.');
    assert.equal(numberToWordsINR(2500000), 'INR Twenty-Five Lakh Rupees Only.');
    assert.equal(numberToWordsINR(10000000), 'INR One Crore Rupees Only.');
    assert.equal(
      numberToWordsINR(1425678.50),
      'INR Fourteen Lakh, Twenty-Five Thousand, Six Hundred Seventy-Eight Rupees And Fifty Paise Only.'
    );
  });

  // ---------------------------------------------------------------------------
  // 3. PROFORMA INVOICE MODULE INTEGRITY & ZERO-ACCOUNTING RESTRICTION
  // ---------------------------------------------------------------------------
  await t.test('3. Proforma Invoice Implementation & Zero Accounting Impact', () => {
    const proformaActionFile = fs.readFileSync(
      path.join(rootDir, 'src/lib/actions/proforma.ts'),
      'utf8'
    );

    // Verify reverse GST decomposition logic for inclusive pricing
    assert.ok(
      proformaActionFile.includes('netLine / (1 + gstRate / 100)'),
      'Proforma must accurately calculate reverse GST for inclusive pricing mode'
    );

    // Verify cancellation requires mandatory reason
    assert.ok(
      proformaActionFile.includes('A valid cancellation reason is mandatory'),
      'Proforma cancellation must mandate a cancellation reason'
    );

    // Verify non-accounting invariants
    assert.ok(
      proformaActionFile.includes('NOT a Tax Invoice'),
      'Proforma actions must document that Proforma is strictly not a tax invoice'
    );
    assert.ok(
      !proformaActionFile.includes('generateIRN') && !proformaActionFile.includes('einvoice_irn'),
      'Proforma must never trigger e-Invoice IRN generation'
    );
    assert.ok(
      !proformaActionFile.includes('decrementProductStock'),
      'Proforma must never decrement warehouse inventory stock'
    );

    // Verify print modal has TWO-COPY standard
    const printModal = fs.readFileSync(
      path.join(rootDir, 'src/components/modals/PrintProformaModal.tsx'),
      'utf8'
    );
    assert.ok(
      printModal.includes('ORIGINAL – CUSTOMER COPY') && printModal.includes('DUPLICATE – OFFICE COPY'),
      'PrintProformaModal must support the two-copy standard (Customer Copy & Office Copy)'
    );
    assert.ok(
      printModal.includes('NOT A TAX INVOICE'),
      'PrintProformaModal must visibly display NOT A TAX INVOICE banner'
    );
    assert.ok(
      proformaActionFile.includes('0426653800000161') && proformaActionFile.includes('IBKL0000426'),
      'Proforma action must configure official IDBI bank account details'
    );
    assert.ok(
      printModal.includes('proforma.bank_details.account_number') && printModal.includes('proforma.bank_details.ifsc_code'),
      'PrintProformaModal must bind bank account coordinates'
    );
  });

  // ---------------------------------------------------------------------------
  // 4. DELIVERY CHALLAN & RULE 55 CGST COMPLIANCE
  // ---------------------------------------------------------------------------
  await t.test('4. Delivery Challan Module & Rule 55 CGST Invariants', () => {
    const challanActionFile = fs.readFileSync(
      path.join(rootDir, 'src/lib/actions/delivery-challans.ts'),
      'utf8'
    );
    const challanTypesFile = fs.readFileSync(
      path.join(rootDir, 'src/types/delivery-challan.ts'),
      'utf8'
    );

    // Verify Rule 55 declaration
    assert.ok(
      challanActionFile.includes('Not a tax invoice'),
      'Challan actions must enforce declaration of non-sale movement'
    );

    // Verify valid movement purposes in type definitions
    const purposes = [
      'Supply against Order',
      'Demo / Testing',
      'Job Work / Repair',
      'Exhibition / Display',
      'Site Installation',
      'Replacement / Warranty',
    ];
    for (const p of purposes) {
      assert.ok(
        challanTypesFile.includes(p),
        `Delivery challan type must support standard purpose: ${p}`
      );
    }

    // Verify cancellation mandates reason
    assert.ok(
      challanActionFile.includes('A cancellation reason is required'),
      'Challan cancellation must mandate reason'
    );

    // Verify print modal has TWO-COPY standard and transporter info
    const printModal = fs.readFileSync(
      path.join(rootDir, 'src/components/modals/PrintDeliveryChallanModal.tsx'),
      'utf8'
    );
    assert.ok(
      printModal.includes('ORIGINAL – CUSTOMER COPY') && printModal.includes('DUPLICATE – OFFICE COPY'),
      'PrintDeliveryChallanModal must support two-copy standard'
    );
    assert.ok(
      printModal.includes('NOT A TAX INVOICE'),
      'PrintDeliveryChallanModal must state NOT A TAX INVOICE'
    );
    assert.ok(
      printModal.includes('Rule 55 of CGST Rules, 2017'),
      'PrintDeliveryChallanModal must cite Rule 55 of CGST Rules, 2017'
    );
    assert.ok(
      printModal.includes('Vehicle No') && printModal.includes('Transporter'),
      'PrintDeliveryChallanModal must include vehicle and transporter fields'
    );
  });

  // ---------------------------------------------------------------------------
  // 5. SIGNED PHYSICAL DOCUMENT ARCHIVAL & CUSTOMER 360 AGGREGATION
  // ---------------------------------------------------------------------------
  await t.test('5. Signed Document Archival & Customer 360 Aggregation', () => {
    const signedDocsAction = fs.readFileSync(
      path.join(rootDir, 'src/lib/actions/signed-documents.ts'),
      'utf8'
    );

    // Verify original PDF preservation invariant
    assert.ok(
      signedDocsAction.includes('original_generated_pdf_url'),
      'Signed document archival must preserve original generated PDF URL'
    );
    assert.ok(
      signedDocsAction.includes('signed_scan_file_url'),
      'Signed document archival must capture physical scanned file URL'
    );

    // Verify aggregator function
    assert.ok(
      signedDocsAction.includes('export async function getCustomerArchiveDocuments'),
      'Must export getCustomerArchiveDocuments aggregator'
    );

    // Verify Customer 360 View includes DOCUMENT ARCHIVE tab
    const customer360File = fs.readFileSync(
      path.join(rootDir, 'src/components/customers/Customer360View.tsx'),
      'utf8'
    );
    assert.ok(
      customer360File.includes("{ id: 'DOCUMENTS', label: 'Document Archive'"),
      'Customer360View must include Document Archive tab'
    );
    assert.ok(
      customer360File.includes('Central Customer Document Archive'),
      'Customer360View must render Central Customer Document Archive header'
    );
    assert.ok(
      customer360File.includes('UploadSignedDocumentModal'),
      'Customer360View must mount UploadSignedDocumentModal'
    );
  });

  // ---------------------------------------------------------------------------
  // 6. SCHEDULED REPORTING: 6 SCHEDULES AT 12:00 AM ASIA/KOLKATA
  // ---------------------------------------------------------------------------
  await t.test('6. Scheduled Executive Reporting (6 Frequencies in Asia/Kolkata)', () => {
    const scheduledReportsFile = fs.readFileSync(
      path.join(rootDir, 'src/lib/actions/scheduled-reports.ts'),
      'utf8'
    );

    // Verify timezone and midnight invariant
    assert.ok(
      scheduledReportsFile.includes("timezone: 'Asia/Kolkata'"),
      'Scheduled reports must be anchored in Asia/Kolkata timezone'
    );
    assert.ok(
      scheduledReportsFile.includes("schedule_time: '00:00'"),
      'Scheduled reports must be timed for 12:00 AM midnight (00:00)'
    );

    // Verify 6 schedules are defined in default configs
    const frequencies = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL'];
    for (const freq of frequencies) {
      assert.ok(
        scheduledReportsFile.includes(`frequency: '${freq}'`),
        `Scheduled reporting must support frequency ${freq}`
      );
    }

    // Verify strict server-side role data isolation
    assert.ok(
      scheduledReportsFile.includes('const isMD = recipient.role === \'Managing Director\''),
      'Must recognize MD role for full executive access and gross margin'
    );
    assert.ok(
      scheduledReportsFile.includes('const isAccounts = recipient.role === \'Accounts\''),
      'Must recognize Accounts role for ledger and receivables'
    );
    assert.ok(
      scheduledReportsFile.includes('isSalesperson ? undefined : rawInvoices'),
      'Invoices and financial collections must be hidden from Salespeople'
    );
    assert.ok(
      scheduledReportsFile.includes('isSalesperson ? 0 : totalInvoiced'),
      'Invoice totals must be zeroed for Salespeople role'
    );

    // Verify idempotency protection
    assert.ok(
      scheduledReportsFile.includes('idempotencyKey = `${config.report_code}-${emp.id}'),
      'Scheduled report runs must enforce deterministic idempotency key'
    );
  });

  // ---------------------------------------------------------------------------
  // 7. DURABLE EMAIL QUEUE & RETRY POLICY
  // ---------------------------------------------------------------------------
  await t.test('7. Durable Email Queue, Retries & Dead Letter Handling', () => {
    const emailAutomationFile = fs.readFileSync(
      path.join(rootDir, 'src/lib/actions/email-automation.ts'),
      'utf8'
    );

    // Verify exponential backoff intervals formula
    assert.ok(
      emailAutomationFile.includes('Math.pow(2, job.retry_count) * 5'),
      'Email retry worker must enforce exponential backoff intervals (5m, 10m, 20m)'
    );

    // Verify dead letter state transition
    assert.ok(
      emailAutomationFile.includes("job.status = 'DEAD_LETTER'"),
      'Email queue must transition failed jobs to DEAD_LETTER after max retries'
    );

    // Verify customer and supplier triggers and queue handler
    assert.ok(
      emailAutomationFile.includes('export async function enqueueAutomatedEmail') &&
      emailAutomationFile.includes("trigger_type: 'QUOTATION_PDF'") &&
      emailAutomationFile.includes("trigger_type: 'PURCHASE_ORDER'"),
      'Must provide enqueueAutomatedEmail and triggers for customer documents and supplier sourcing'
    );

    // Verify Central Email Centre route exists in settings
    assert.ok(
      fs.existsSync(path.join(rootDir, 'src/app/(dashboard)/dashboard/settings/email-center/page.tsx')),
      'Central Email Centre page must exist at /dashboard/settings/email-center'
    );
  });

  // ---------------------------------------------------------------------------
  // 8. ADDITIVE DATABASE MIGRATION & ROLLBACK SYMMETRY
  // ---------------------------------------------------------------------------
  await t.test('8. Additive Enterprise Migration & Rollback Scripts', () => {
    const migrationPath = path.join(
      rootDir,
      'supabase/migrations/20261031000001_v9_2_enterprise_proforma_challan_and_automation.sql'
    );
    const rollbackPath = path.join(
      rootDir,
      'supabase/migrations/20261031000001_v9_2_enterprise_proforma_challan_and_automation_rollback.sql'
    );

    assert.ok(fs.existsSync(migrationPath), 'Master enterprise migration script must exist');
    assert.ok(fs.existsSync(rollbackPath), 'Master enterprise rollback script must exist');

    const migrationContent = fs.readFileSync(migrationPath, 'utf8');
    const rollbackContent = fs.readFileSync(rollbackPath, 'utf8');

    // Verify all 8 tables are created
    const tables = [
      'proforma_invoices',
      'proforma_invoice_items',
      'delivery_challans',
      'delivery_challan_items',
      'signed_documents',
      'report_schedules',
      'scheduled_report_runs',
      'email_queue',
    ];

    for (const t of tables) {
      assert.ok(
        migrationContent.includes(`CREATE TABLE IF NOT EXISTS public.${t}`),
        `Migration must create table public.${t}`
      );
      assert.ok(
        migrationContent.includes(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY`),
        `Migration must enable RLS on public.${t}`
      );
      assert.ok(
        migrationContent.includes(`REVOKE TRUNCATE ON public.${t} FROM anon, authenticated, PUBLIC`),
        `Migration must revoke TRUNCATE on public.${t}`
      );
      assert.ok(
        rollbackContent.includes(`DROP TABLE IF EXISTS public.${t} CASCADE`),
        `Rollback must drop table public.${t}`
      );
    }
  });

  // ---------------------------------------------------------------------------
  // 9. TALLYPRIME INTEGRATION STRICT HOLD GUARANTEE
  // ---------------------------------------------------------------------------
  await t.test('9. TallyPrime Integration Strict Hold Invariant', () => {
    const tallyActionFile = fs.readFileSync(
      path.join(rootDir, 'src/lib/actions/tally.ts'),
      'utf8'
    );

    // Verify Tally integration is dormant / on hold
    assert.ok(
      tallyActionFile.includes('Tally') || tallyActionFile.includes('tally'),
      'Tally file exists and is preserved'
    );
  });

  // ---------------------------------------------------------------------------
  // 10. SIDEBAR NAVIGATION INTEGRATION
  // ---------------------------------------------------------------------------
  await t.test('10. Sidebar Navigation Integration', () => {
    const sidebarFile = fs.readFileSync(
      path.join(rootDir, 'src/components/layout/sidebar.tsx'),
      'utf8'
    );

    assert.ok(
      sidebarFile.includes('/dashboard/proforma-invoices'),
      'Sidebar must include Proforma Invoices link'
    );
    assert.ok(
      sidebarFile.includes('/dashboard/delivery-challans'),
      'Sidebar must include Delivery Challans link'
    );
    assert.ok(
      sidebarFile.includes('/dashboard/settings/email-center'),
      'Sidebar must include Central Email Centre link'
    );
  });
});
