import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// =============================================================================
// ICON TECH PRO ERP V9.2 — MASTER UX, FUNCTIONALITY, SECURITY & CPQ ENGINE TEST
// Phases 1 to 5 Comprehensive Verification
// =============================================================================

test('ICON TECH PRO ERP V9.2 — Master Verification Suite (Phases 1 - 5)', async (t) => {

  // ---------------------------------------------------------------------------
  // PHASE 1: Authentication & Navigation Foundation
  // ---------------------------------------------------------------------------
  await t.test('Phase 1.1: Session Invalidation Registry in src/lib/auth/session.ts', () => {
    const sessionFile = path.join(rootDir, 'src/lib/auth/session.ts');
    assert.ok(fs.existsSync(sessionFile), 'session.ts must exist');
    const content = fs.readFileSync(sessionFile, 'utf8');

    assert.match(content, /__ICON_SESSION_INVALIDATIONS__/, 'Global invalidations registry must exist');
    assert.match(content, /invalidateUserSessions/, 'invalidateUserSessions function must exist');
    assert.match(content, /tokenIssuedAt\s*<=\s*invalidationTime/, 'Token must be rejected if issued prior to invalidation');
  });

  await t.test('Phase 1.2: Password Recovery Flow in src/app/(auth)/login', () => {
    const actionsFile = path.join(rootDir, 'src/app/(auth)/login/actions.ts');
    assert.ok(fs.existsSync(actionsFile), 'login/actions.ts must exist');
    const actionsContent = fs.readFileSync(actionsFile, 'utf8');
    assert.match(actionsContent, /requestPasswordReset/, 'requestPasswordReset server action must exist');
    assert.match(actionsContent, /resetPasswordForEmail/, 'Must trigger Supabase auth password reset');

    const pageFile = path.join(rootDir, 'src/app/(auth)/login/page.tsx');
    assert.ok(fs.existsSync(pageFile), 'login/page.tsx must exist');
    const pageContent = fs.readFileSync(pageFile, 'utf8');
    assert.match(pageContent, /isResetMode/, 'Password reset mode state must exist');
    assert.match(pageContent, /handleResetSubmit/, 'Password reset handler must be wired');
  });

  await t.test('Phase 1.3: Ergonomic Sidebar & Signout Invalidation in src/components/layout/sidebar.tsx', () => {
    const sidebarFile = path.join(rootDir, 'src/components/layout/sidebar.tsx');
    assert.ok(fs.existsSync(sidebarFile), 'sidebar.tsx must exist');
    const content = fs.readFileSync(sidebarFile, 'utf8');

    assert.match(content, /fixed/, 'Sidebar desktop shell must be fixed');
    assert.match(content, /inset-y-0\s+left-0/, 'Sidebar must span full vertical viewport');
    assert.match(content, /logout\(\)/, 'Sidebar sign out must trigger server logout');

    const sessionFile = path.join(rootDir, 'src/lib/auth/session.ts');
    const sessionContent = fs.readFileSync(sessionFile, 'utf8');
    assert.match(sessionContent, /__ICON_SESSION_INVALIDATIONS__\[user\.id\]/, 'clearSession must register invalidation timestamp');
  });

  await t.test('Phase 1.4: Dashboard Skeleton & Cockpit Guards in src/app/(dashboard)/dashboard/page.tsx', () => {
    const dashFile = path.join(rootDir, 'src/app/(dashboard)/dashboard/page.tsx');
    assert.ok(fs.existsSync(dashFile), 'dashboard/page.tsx must exist');
    const content = fs.readFileSync(dashFile, 'utf8');

    assert.match(content, /isLoadingData/, 'Dashboard must track initial data loading state');
    assert.match(content, /animate-pulse/, 'Dashboard must render skeleton UI while resolving user and metrics');
    assert.match(content, /isManagementUser/, 'Audited management view must be strictly restricted to MD and Admin');
  });

  // ---------------------------------------------------------------------------
  // PHASE 2: Customer Module & 360
  // ---------------------------------------------------------------------------
  await t.test('Phase 2.1: Customer Types and Multi-Contact Support', () => {
    const typesFile = path.join(rootDir, 'src/types/customer.ts');
    assert.ok(fs.existsSync(typesFile), 'src/types/customer.ts must exist');
    const content = fs.readFileSync(typesFile, 'utf8');

    assert.match(content, /export interface CustomerContact/, 'CustomerContact interface must exist');
    assert.match(content, /export interface CustomerShippingAddress/, 'CustomerShippingAddress interface must exist');
    assert.match(content, /export interface CustomerInternalNotes/, 'CustomerInternalNotes interface must exist');
  });

  await t.test('Phase 2.2: Customer Validation Rules in src/lib/validations/customer.ts', () => {
    const valFile = path.join(rootDir, 'src/lib/validations/customer.ts');
    assert.ok(fs.existsSync(valFile), 'customer.ts validation must exist');
    const content = fs.readFileSync(valFile, 'utf8');

    // Corporate designation and email mandatory rule via discriminatedUnion
    assert.match(content, /discriminatedUnion/, 'Validation must use discriminatedUnion for customer types');
    assert.match(content, /designation:\s*z\.string\(\)\.trim\(\)\.min\(1/, 'Designation must be required for company accounts');
    assert.match(content, /email:\s*z[\s\S]*?email\(/, 'Email must be validated for company accounts');
  });

  await t.test('Phase 2.3: Salesperson Auto-Assignment & Lock in src/lib/actions/customers.ts', () => {
    const custActionsFile = path.join(rootDir, 'src/lib/actions/customers.ts');
    assert.ok(fs.existsSync(custActionsFile), 'customers.ts action must exist');
    const content = fs.readFileSync(custActionsFile, 'utf8');

    assert.match(content, /Sales Executive/, 'Sales Executive role must be checked');
    assert.match(content, /authUser\.role\s*===\s*'Sales Executive'\s*\?\s*authUser\.id/, 'Sales Executive must be locked as assigned salesperson');
    assert.match(content, /contacts:\s*\(parsed as any\)\.contacts/, 'Must persist secondary customer contacts');
    assert.match(content, /shipping_addresses:\s*\(parsed as any\)\.shipping_addresses/, 'Must persist multiple shipping addresses');
  });

  await t.test('Phase 2.4: Permanent Code Confirmation Modal in customer-form-modal.tsx', () => {
    const modalFile = path.join(rootDir, 'src/components/customers/customer-form-modal.tsx');
    assert.ok(fs.existsSync(modalFile), 'customer-form-modal.tsx must exist');
    const content = fs.readFileSync(modalFile, 'utf8');

    assert.match(content, /createdConfirmation/, 'Creation success confirmation state must exist');
    assert.match(content, /customer_code/, 'Permanent customer code must be displayed');
    assert.match(content, /Copy/, 'Customer code copy button must exist');
    assert.match(content, /\/dashboard\/customers\//, 'Direct route to Customer 360 view must exist');
  });

  await t.test('Phase 2.5: Customer 360 Optimized Querying in customer360.ts', () => {
    const c360File = path.join(rootDir, 'src/lib/actions/customer360.ts');
    assert.ok(fs.existsSync(c360File), 'customer360.ts action must exist');
    const content = fs.readFileSync(c360File, 'utf8');

    assert.match(content, /customer_id:\s*custId/, 'Enquiries and quotations queries must be filtered by customer_id');
  });

  // ---------------------------------------------------------------------------
  // PHASE 3: Presales & Enquiries
  // ---------------------------------------------------------------------------
  await t.test('Phase 3.1: Strict Customer Master Link in NewEnquiryModal.tsx', () => {
    const enqModalFile = path.join(rootDir, 'src/components/modals/NewEnquiryModal.tsx');
    assert.ok(fs.existsSync(enqModalFile), 'NewEnquiryModal.tsx must exist');
    const content = fs.readFileSync(enqModalFile, 'utf8');

    assert.match(content, /selectedCustomer/, 'selectedCustomer master link must be present');
    assert.match(content, /setIsCustomerModalOpen\(true\)/, '+ Create Customer modal trigger must exist');
    assert.match(content, /readOnly/, 'Customer master fields must be locked read-only when customer is selected');
    assert.doesNotMatch(content, /manualCustomerName/, 'Manual unlinked customer inputs must be completely removed');
  });

  // ---------------------------------------------------------------------------
  // PHASE 4: Quotations CPQ Engine & Presentation
  // ---------------------------------------------------------------------------
  await t.test('Phase 4.1: BenQ TK710 Verified Spec Intelligence in spec-intelligence.ts', () => {
    const specFile = path.join(rootDir, 'src/lib/actions/spec-intelligence.ts');
    assert.ok(fs.existsSync(specFile), 'spec-intelligence.ts must exist');
    const content = fs.readFileSync(specFile, 'utf8');

    assert.match(content, /TK710/, 'Must include BenQ TK710 4K Laser Projector');
    assert.match(content, /3,200\s+ANSI\s+Lumens/, 'Must record authentic 3,200 ANSI Lumens');
    assert.match(content, /4\.16ms/, 'Must record ultra-low input lag 4.16ms');
    assert.match(content, /suggested_price:\s*249000/, 'Must provide benchmark suggested price');
    assert.match(content, /suggested_cost:\s*195000/, 'Must provide confidential benchmark cost');
    assert.match(content, /Redington India Ltd \/ BenQ Authorized/, 'Must provide suggested distributor');
  });

  await t.test('Phase 4.2: Human Edit Review Gate in SpecIntelligenceLookupModal.tsx', () => {
    const modalFile = path.join(rootDir, 'src/components/modals/SpecIntelligenceLookupModal.tsx');
    assert.ok(fs.existsSync(modalFile), 'SpecIntelligenceLookupModal.tsx must exist');
    const content = fs.readFileSync(modalFile, 'utf8');

    assert.match(content, /Human Edit Review Gate/, 'Human Edit Review Gate must be prominent');
    assert.match(content, /sellingPrice/, 'Selling price state must be human editable');
    assert.match(content, /purchasePrice/, 'Confidential purchase cost must be human editable');
    assert.match(content, /distributor/, 'Distributor name must be human editable');
  });

  await t.test('Phase 4.3: Sequential Quotation Numbering & Auto-Save in QuotationFormWorkspace.tsx', () => {
    const qfFile = path.join(rootDir, 'src/components/quotations/QuotationFormWorkspace.tsx');
    assert.ok(fs.existsSync(qfFile), 'QuotationFormWorkspace.tsx must exist');
    const content = fs.readFileSync(qfFile, 'utf8');

    assert.match(content, /\(Auto-generated on Save\)/, 'Quotation number must default to auto-generated');
    assert.match(content, /createQuotation/, 'Must call createQuotation on save');

    const actionsFile = path.join(rootDir, 'src/lib/actions/quotations.ts');
    assert.ok(fs.existsSync(actionsFile), 'quotations.ts must exist');
    const actionsContent = fs.readFileSync(actionsFile, 'utf8');
    assert.match(actionsContent, /getNextQuotationNumber/, 'Must call atomic sequential quotation numbering on save');
    assert.match(actionsContent, /ICON\/26-27\/QT-/, 'Must follow fiscal sequence format');
  });

  await t.test('Phase 4.4: Quantity Steppers and CPQ Bank Details in QuotationFormWorkspace.tsx', () => {
    const qfFile = path.join(rootDir, 'src/components/quotations/QuotationFormWorkspace.tsx');
    const content = fs.readFileSync(qfFile, 'utf8');

    // Steppers
    assert.match(content, /handleItemChange\(idx,\s*'quantity',\s*Math\.max\(1,\s*\(Number\(it\.quantity\)\s*\|\|\s*1\)\s*-\s*1\)\)/, 'Decrement stepper must exist');
    assert.match(content, /handleItemChange\(idx,\s*'quantity',\s*\(Number\(it\.quantity\)\s*\|\|\s*0\)\s*\+\s*1\)/, 'Increment stepper must exist');

    // Bank Details
    assert.match(content, /IDBI Bank/, 'IDBI Bank details option must exist');
    assert.match(content, /HDFC Bank/, 'HDFC Bank details option must exist');
    assert.match(content, /IBKL0000426/, 'IDBI IFSC code must be verified');
    assert.match(content, /HDFC0000045/, 'HDFC IFSC code must be verified');

    // Spec Intelligence trigger
    assert.match(content, /Spec Intelligence \(Brand → Model\)/, 'Spec Intelligence launcher button must exist');
  });

  await t.test('Phase 4.5: Confidentiality Guard in PrintQuotationModal.tsx', () => {
    const printFile = path.join(rootDir, 'src/components/modals/PrintQuotationModal.tsx');
    assert.ok(fs.existsSync(printFile), 'PrintQuotationModal.tsx must exist');
    const content = fs.readFileSync(printFile, 'utf8');

    assert.doesNotMatch(content, /item\.purchase_cost/, 'Customer printout must NEVER access item.purchase_cost');
    assert.doesNotMatch(content, /item\.margin/, 'Customer printout must NEVER access item.margin');
    assert.doesNotMatch(content, /item\.supplier_reference/, 'Customer printout must NEVER access supplier_reference');
    assert.doesNotMatch(content, /item\.distributor/, 'Customer printout must NEVER access distributor');
  });

  await t.test('Phase 4.6: Direct WhatsApp Web Launcher in SendQuotationWhatsAppModal.tsx', () => {
    const waFile = path.join(rootDir, 'src/components/modals/SendQuotationWhatsAppModal.tsx');
    assert.ok(fs.existsSync(waFile), 'SendQuotationWhatsAppModal.tsx must exist');
    const content = fs.readFileSync(waFile, 'utf8');

    assert.match(content, /wa\.me/, 'Direct WhatsApp wa.me launcher must be wired');
    assert.match(content, /window\.open/, 'Must launch WhatsApp in new tab');
    assert.match(content, /queueOutboxMessage/, 'Must simultaneously persist to audit communications log');
  });

  // ---------------------------------------------------------------------------
  // PHASE 5: CSV Permissions & Security Hardening
  // ---------------------------------------------------------------------------
  await t.test('Phase 5.1: CSV Formula Injection Prevention in src/lib/utils/export.ts', () => {
    const exportFile = path.join(rootDir, 'src/lib/utils/export.ts');
    assert.ok(fs.existsSync(exportFile), 'export.ts must exist');
    const content = fs.readFileSync(exportFile, 'utf8');

    // Must check for formula injection and escape leading characters
    assert.match(content, /Formula Injection/i, 'Must document formula injection protection');
    assert.match(content, /\[=\+\\-@\\t\\r\]/, 'Must test for unsafe formula trigger characters (=, +, -, @, \\t, \\r)');
    assert.match(content, /canExportCSV/, 'Must enforce canExportCSV check');
  });

  await t.test('Phase 5.2: CSV Formula Injection Prevention in src/lib/utils/csv-parser.ts', () => {
    const parserFile = path.join(rootDir, 'src/lib/utils/csv-parser.ts');
    assert.ok(fs.existsSync(parserFile), 'csv-parser.ts must exist');
    const content = fs.readFileSync(parserFile, 'utf8');

    assert.match(content, /formula injection/i, 'CSV parser must guard against formula injection');
    assert.match(content, /\[=\+\\-@\\t\\r\]/, 'CSV parser must sanitize imported cells against formula injection');
  });

  await t.test('Phase 5.3: Strict CSV RBAC Definitions in registry.ts', () => {
    const regFile = path.join(rootDir, 'src/lib/permissions/registry.ts');
    assert.ok(fs.existsSync(regFile), 'registry.ts must exist');
    const content = fs.readFileSync(regFile, 'utf8');

    assert.match(content, /export function canExportCSV/, 'canExportCSV function must exist');
    assert.match(content, /export function canImportCSV/, 'canImportCSV function must exist');

    // Check allowed roles
    assert.match(content, /Managing Director/, 'Managing Director must be allowed CSV export/import');
    assert.match(content, /Admin \/ BDM/, 'Admin / BDM must be allowed CSV export/import');
  });

  await t.test('Phase 5.4: UI RBAC Guards on CSV Export Across All Views', () => {
    const viewsToCheck = [
      'src/app/(dashboard)/customers/page.tsx',
      'src/app/(dashboard)/dashboard/quotations/page.tsx',
      'src/app/(dashboard)/dashboard/invoices/page.tsx',
      'src/app/(dashboard)/dashboard/sales-orders/page.tsx',
      'src/app/(dashboard)/dashboard/inventory/page.tsx',
      'src/app/(dashboard)/dashboard/purchases/page.tsx',
      'src/app/(dashboard)/dashboard/products/page.tsx',
    ];

    for (const viewRel of viewsToCheck) {
      const viewPath = path.join(rootDir, viewRel);
      assert.ok(fs.existsSync(viewPath), `${viewRel} must exist`);
      const content = fs.readFileSync(viewPath, 'utf8');
      assert.match(content, /canExportCSV/, `${viewRel} must guard export with canExportCSV`);
    }
  });

  await t.test('Phase 5.5: UI RBAC Guard on Bulk Import Page', () => {
    const importPagePath = path.join(rootDir, 'src/app/(dashboard)/dashboard/import/page.tsx');
    assert.ok(fs.existsSync(importPagePath), 'dashboard/import/page.tsx must exist');
    const content = fs.readFileSync(importPagePath, 'utf8');

    assert.match(content, /canImportCSV/, 'Import page must verify canImportCSV');
    assert.match(content, /Access Restricted/, 'Import page must show Access Restricted for unauthorized roles');
  });
});
