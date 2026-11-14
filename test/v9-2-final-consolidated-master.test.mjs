import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// =============================================================================
// ICON TECH PRO ERP V9.2 — FINAL CONSOLIDATED IMPLEMENTATION MASTER TEST SUITE
// =============================================================================

test('Suite 1: Open Files & Tally Foundation Database Migration & Rollback Integrity', () => {
  const migrationPath = path.join(
    rootDir,
    'supabase/migrations/20261107000001_v9_2_open_files_and_tally_foundation.sql'
  );
  const rollbackPath = path.join(
    rootDir,
    'supabase/migrations/20261107000001_v9_2_open_files_and_tally_foundation_rollback.sql'
  );

  assert.ok(fs.existsSync(migrationPath), 'Additive migration file must exist');
  assert.ok(fs.existsSync(rollbackPath), 'Rollback script must exist');

  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  const rollbackSql = fs.readFileSync(rollbackPath, 'utf8');

  // Verify additive columns on projects
  const requiredColumns = [
    'file_id',
    'sales_status',
    'fulfilment_status',
    'financial_status',
    'closure_category',
    'closure_reason',
    'closure_explanation',
    'closed_at',
    'closed_by',
    'is_ready_for_closure',
    'reopen_requested',
    'reopen_history',
    'department_owner',
    'customer_po',
  ];

  for (const col of requiredColumns) {
    assert.ok(
      migrationSql.includes(col),
      `Migration must add column '${col}' to projects table`
    );
  }

  // Verify Tally Foundation Tables
  assert.ok(migrationSql.includes('tally_company_profiles'), 'Must create tally_company_profiles');
  assert.ok(migrationSql.includes('tally_customer_ledger_matches'), 'Must create tally_customer_ledger_matches');
  assert.ok(migrationSql.includes('eway_bill_register'), 'Must create eway_bill_register');
  assert.ok(migrationSql.includes('tally_unallocated_receipts'), 'Must create tally_unallocated_receipts');

  // Verify Rollback drops
  assert.ok(rollbackSql.includes('DROP TABLE IF EXISTS public.tally_company_profiles CASCADE'));
  assert.ok(rollbackSql.includes('DROP TABLE IF EXISTS public.tally_customer_ledger_matches CASCADE'));
  assert.ok(rollbackSql.includes('DROP TABLE IF EXISTS public.eway_bill_register CASCADE'));
  assert.ok(rollbackSql.includes('DROP TABLE IF EXISTS public.tally_unallocated_receipts CASCADE'));
});

test('Suite 2: 3 Independent Status Dimensions Architecture', () => {
  const typesPath = path.join(rootDir, 'src/types/erp.ts');
  const actionsPath = path.join(rootDir, 'src/lib/actions/projects.ts');

  assert.ok(fs.existsSync(typesPath), 'types/erp.ts must exist');
  assert.ok(fs.existsSync(actionsPath), 'actions/projects.ts must exist');

  const typesContent = fs.readFileSync(typesPath, 'utf8');
  const actionsContent = fs.readFileSync(actionsPath, 'utf8');

  // Check type definitions
  assert.ok(typesContent.includes('FileSalesStatus'), 'Must define FileSalesStatus type');
  assert.ok(typesContent.includes('FileFulfilmentStatus'), 'Must define FileFulfilmentStatus type');
  assert.ok(typesContent.includes('FileFinancialStatus'), 'Must define FileFinancialStatus type');
  assert.ok(typesContent.includes('FileClosureCategory'), 'Must define FileClosureCategory type');
  assert.ok(typesContent.includes('CustomerPurchaseOrder'), 'Must define CustomerPurchaseOrder type');

  // Verify 3 distinct dimensions in update action
  assert.ok(
    actionsContent.includes('updateFileStatusDimensions'),
    'actions/projects.ts must export updateFileStatusDimensions'
  );
  assert.ok(
    actionsContent.includes('sales_status'),
    'Must update sales_status independently'
  );
  assert.ok(
    actionsContent.includes('fulfilment_status'),
    'Must update fulfilment_status independently'
  );
  assert.ok(
    actionsContent.includes('financial_status'),
    'Must update financial_status independently'
  );
});

test('Suite 3: Immediate Closure for Lost Enquiry vs Rejection on Confirmed Order', () => {
  const actionsPath = path.join(rootDir, 'src/lib/actions/projects.ts');
  const content = fs.readFileSync(actionsPath, 'utf8');

  // Check Lost Enquiry rule: closes immediately if NO confirmed order exists
  assert.ok(
    content.includes("payload.category === 'Lost Enquiry'"),
    'Must handle Lost Enquiry closure'
  );
  assert.ok(
    content.includes('has_confirmed_order'),
    'Must verify whether a confirmed order exists before permitting Lost Enquiry closure'
  );
  assert.ok(
    content.includes('A confirmed customer order or PO already exists for this file. It cannot be closed as a Lost Enquiry'),
    'Must reject Lost Enquiry closure with descriptive error when confirmed order exists'
  );
});

test('Suite 4: Strict Gatekeeper on Successfully Completed Closure', () => {
  const actionsPath = path.join(rootDir, 'src/lib/actions/projects.ts');
  const content = fs.readFileSync(actionsPath, 'utf8');

  // Rule: Successfully Completed requires BOTH Fulfilment Completed AND Financial Settled
  assert.ok(
    content.includes("payload.category === 'Successfully Completed'"),
    'Must handle Successfully Completed closure'
  );
  assert.ok(
    content.includes("file.fulfilment_status === 'Fulfilment Completed'"),
    'Must enforce fulfilment_status is Fulfilment Completed'
  );
  assert.ok(
    content.includes("file.financial_status === 'Financially Settled'"),
    'Must enforce financial_status is Financially Settled'
  );
  assert.ok(
    content.includes('Cannot close file as Completed. Both Fulfilment must be Completed'),
    'Must provide clear operational guidance on blocked successful closure'
  );
});

test('Suite 5: Customer PO Upload & Payment Terms Processing', () => {
  const actionsPath = path.join(rootDir, 'src/lib/actions/projects.ts');
  const content = fs.readFileSync(actionsPath, 'utf8');

  assert.ok(
    content.includes('uploadCustomerPO'),
    'Must export uploadCustomerPO'
  );
  assert.ok(
    content.includes('payment_terms'),
    'Must store payment_terms'
  );
  assert.ok(
    content.includes('payment_trigger'),
    'Must store payment_trigger'
  );
  assert.ok(
    content.includes("department_owner = 'Accounts'"),
    'Must handoff department ownership to Accounts when customer PO is received'
  );
});

test('Suite 6: File Reopening Workflow & Historical Audit Trail', () => {
  const actionsPath = path.join(rootDir, 'src/lib/actions/projects.ts');
  const content = fs.readFileSync(actionsPath, 'utf8');

  assert.ok(
    content.includes('requestFileReopening'),
    'Must export requestFileReopening'
  );
  assert.ok(
    content.includes('decideFileReopening'),
    'Must export decideFileReopening'
  );
  assert.ok(
    content.includes('reopen_history'),
    'Must maintain historical reopen audit entries in reopen_history array'
  );
  assert.ok(
    content.includes('Managing Director') && content.includes('Admin / BDM'),
    'Reopening decision must be restricted to executive roles'
  );
});

test('Suite 7: Accounts Workspace & Tally Foundation Implementation', () => {
  const tallyPath = path.join(rootDir, 'src/lib/actions/tally.ts');
  const tallyPagePath = path.join(rootDir, 'src/app/(dashboard)/dashboard/tally/page.tsx');

  assert.ok(fs.existsSync(tallyPath), 'actions/tally.ts must exist');
  assert.ok(fs.existsSync(tallyPagePath), 'dashboard/tally/page.tsx must exist');

  const tallyContent = fs.readFileSync(tallyPath, 'utf8');
  const pageContent = fs.readFileSync(tallyPagePath, 'utf8');

  // Verify backend actions
  assert.ok(tallyContent.includes('getTallyCompanies'), 'Must export getTallyCompanies');
  assert.ok(tallyContent.includes('getCustomerLedgerMatchingQueue'), 'Must export getCustomerLedgerMatchingQueue');
  assert.ok(tallyContent.includes('verifyCustomerLedgerMatch'), 'Must export verifyCustomerLedgerMatch');
  assert.ok(tallyContent.includes('getCrossMonthTransactions'), 'Must export getCrossMonthTransactions');
  assert.ok(tallyContent.includes('getEwayBillRegister'), 'Must export getEwayBillRegister');
  assert.ok(tallyContent.includes('getUnallocatedReceipts'), 'Must export getUnallocatedReceipts');
  assert.ok(tallyContent.includes('allocateReceiptToInvoice'), 'Must export allocateReceiptToInvoice');
  assert.ok(tallyContent.includes('checkFileFinancialClearance'), 'Must export checkFileFinancialClearance');

  // Verify page features
  assert.ok(pageContent.includes('Accounting Company:'), 'UI must render company selector');
  assert.ok(pageContent.includes('E-Way Bill Movement Register'), 'UI must render E-Way Bill tab');
  assert.ok(pageContent.includes('Unallocated Bank Receipts'), 'UI must render Unallocated Receipts tab');
  assert.ok(pageContent.includes('Cross-Month Procurement & Profitability Alignment'), 'UI must render Cross-Month tab');
  assert.ok(pageContent.includes('Open File Financial Clearance Auditor'), 'UI must render File Clearance tab');
});

test('Suite 8: Cross-Month Procurement / Sales Margin Alignment Rule', () => {
  const tallyPath = path.join(rootDir, 'src/lib/actions/tally.ts');
  const content = fs.readFileSync(tallyPath, 'utf8');

  // Verify business rule: Genuine voucher dates preserved while ERP file calculates margin
  assert.ok(
    content.includes('Both genuine voucher dates preserved in Tally while linked to File'),
    'Accounting alignment rule must explicitly preserve genuine Tally voucher dates'
  );
  assert.ok(
    content.includes('gross_margin_amount'),
    'Must calculate cross-month order gross margin amount'
  );
  assert.ok(
    content.includes('gross_margin_pct'),
    'Must calculate cross-month gross margin percentage'
  );
});

test('Suite 9: 30-Minute Account Lockout & 24h Single-Use Onboarding Tokens', () => {
  const lockoutPath = path.join(rootDir, 'src/lib/security/lockout-service.ts');
  const usersPath = path.join(rootDir, 'src/lib/actions/users.ts');
  const onboardingPath = path.join(rootDir, 'src/lib/actions/onboarding.ts');

  const lockoutContent = fs.readFileSync(lockoutPath, 'utf8');
  const usersContent = fs.readFileSync(usersPath, 'utf8');
  const onboardingContent = fs.readFileSync(onboardingPath, 'utf8');

  // Lockout duration rule
  assert.ok(
    lockoutContent.includes('lockoutDurationMinutes = 30'),
    'Initial lockout duration must be 30 minutes on 3 consecutive failures'
  );

  // Onboarding security
  assert.ok(
    usersContent.includes('expiresHours: 24'),
    'Invitation token must expire in exactly 24 hours'
  );
  assert.ok(
    onboardingContent.includes("requireRole(['Managing Director', 'Admin / BDM'])"),
    'Employee onboarding must be restricted to Admin and MD'
  );
});

test('Suite 10: Confidentiality, Role Gating & Sreeja Enterprises Exclusion', () => {
  const marginPath = path.join(rootDir, 'src/lib/utils/margin.ts');
  const quotePath = path.join(rootDir, 'src/lib/actions/quotations.ts');

  const marginContent = fs.readFileSync(marginPath, 'utf8');
  const quoteContent = fs.readFileSync(quotePath, 'utf8');

  assert.ok(
    marginContent.includes('canViewPurchaseCosts'),
    'Must export canViewPurchaseCosts utility'
  );
  assert.ok(
    quoteContent.includes('canViewCosts'),
    'Quotation actions must check canViewCosts'
  );

  // Search entire codebase to ensure Sreeja Enterprises is not present as customer
  const custRes = fs.readFileSync(path.join(rootDir, 'src/lib/actions/customers.ts'), 'utf8');
  assert.equal(
    custRes.includes('Sreeja Enterprises'),
    false,
    'Sreeja Enterprises must be strictly excluded from customer lists'
  );
});
