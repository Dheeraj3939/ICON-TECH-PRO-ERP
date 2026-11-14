import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// =============================================================================
// ICON TECH PRO ERP V9.2 — MASTER DEEP REMEDIATION VERIFICATION TEST SUITE
// =============================================================================

test('Suite 1: Universal Database RLS & Enterprise Migration Verification', (t) => {
  const migrationPath = path.join(
    rootDir,
    'supabase/migrations/20261105000001_v9_2_comprehensive_enterprise_hardening.sql'
  );
  const rollbackPath = path.join(
    rootDir,
    'supabase/migrations/20261105000001_v9_2_comprehensive_enterprise_hardening_rollback.sql'
  );

  assert.ok(fs.existsSync(migrationPath), 'Migration file must exist');
  assert.ok(fs.existsSync(rollbackPath), 'Rollback file must exist');

  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  const rollbackSql = fs.readFileSync(rollbackPath, 'utf8');

  // Verify non-suspended helper function
  assert.ok(
    migrationSql.includes('CREATE OR REPLACE FUNCTION public.fn_is_active_non_suspended_user()'),
    'Must define fn_is_active_non_suspended_user'
  );
  assert.ok(
    migrationSql.includes('SECURITY DEFINER'),
    'fn_is_active_non_suspended_user must be SECURITY DEFINER'
  );
  assert.ok(
    migrationSql.includes("SET search_path = public, auth, pg_temp"),
    'Must set secure search_path on security definer function'
  );

  // Verify role check function
  assert.ok(
    migrationSql.includes('CREATE OR REPLACE FUNCTION public.fn_user_has_role'),
    'Must define fn_user_has_role'
  );

  // Verify that all 27 formerly un-RLS-protected tables are explicitly enabled
  const requiredTables = [
    'warranty_claims',
    'communication_inbox',
    'communication_templates',
    'ai_sales_sessions',
    'ai_sales_messages',
    'telephony_calls',
    'telephony_transcripts',
    'executive_briefings',
    'executive_schedule_configs',
    'employee_salary_history',
    'payroll_runs',
    'payslips',
    'salary_structures',
    'tax_slabs',
    'quotation_version_snapshots',
    'quotation_templates',
    'proforma_invoices',
    'proforma_invoice_items',
    'delivery_challans',
    'delivery_challan_items',
    'credit_notes',
    'credit_note_items',
    'debit_notes',
    'debit_note_items',
    'payment_allocations',
    'supplier_payables_ledger',
    'customer_receivables_ledger',
  ];

  for (const table of requiredTables) {
    assert.ok(
      migrationSql.includes(`'${table}'`) || migrationSql.includes(`public.${table}`),
      `Table public.${table} must be included in enterprise migration RLS coverage`
    );
  }
  assert.ok(
    migrationSql.includes('ENABLE ROW LEVEL SECURITY'),
    'Migration must enable row level security across tables'
  );

  // Verify covering indexes for foreign keys
  const expectedIndexes = [
    'idx_quotation_items_quotation_id',
    'idx_quotation_items_product_id',
    'idx_quotations_customer_id',
    'idx_quotations_enquiry_id',
    'idx_site_visits_customer_id',
    'idx_tech_eval_customer_id',
    'idx_invoices_customer_id',
    'idx_payments_invoice_id',
    'idx_payments_customer_id',
  ];

  for (const idx of expectedIndexes) {
    assert.ok(
      migrationSql.includes(idx),
      `Index ${idx} must be created in enterprise migration`
    );
  }

  // Verify financial integrity constraints
  assert.ok(
    migrationSql.includes('chk_invoices_grand_total_positive'),
    'Invoices table must enforce non-negative grand_total'
  );
  assert.ok(
    migrationSql.includes('chk_payments_amount_positive'),
    'Payments table must enforce positive amount constraint'
  );

  // Verify rollback script contains reverse drops
  assert.ok(rollbackSql.includes('DROP POLICY IF EXISTS'), 'Rollback must drop policies');
  assert.ok(rollbackSql.includes('DROP FUNCTION IF EXISTS public.fn_user_has_role'), 'Rollback must drop fn_user_has_role');
  assert.ok(rollbackSql.includes('DROP FUNCTION IF EXISTS public.fn_is_active_non_suspended_user'), 'Rollback must drop fn_is_active_non_suspended_user');
  assert.ok(rollbackSql.includes('chk_quotations_grand_total_positive'), 'Rollback must drop quotation constraint');
  assert.ok(rollbackSql.includes('chk_invoices_grand_total_positive'), 'Rollback must drop invoice constraint');
  assert.ok(rollbackSql.includes('chk_payments_amount_positive'), 'Rollback must drop payment constraint');
});

test('Suite 2: Server Action Authorization Verification (Static & Structural)', (t) => {
  const actionsToCheck = [
    {
      file: 'src/lib/actions/analytics.ts',
      requiredTerms: ['requireAuth()', "requireRole(['Managing Director', 'Admin / BDM'])", "requireRole(['Managing Director', 'Accounts', 'Admin / BDM'])"],
    },
    {
      file: 'src/lib/actions/executive-reporting.ts',
      requiredTerms: ["requireRole(['Managing Director', 'Admin / BDM'])"],
    },
    {
      file: 'src/lib/actions/billing.ts',
      requiredTerms: ['requireAuth()', "requireRole(['Managing Director', 'Accounts', 'Admin / BDM'])"],
    },
    {
      file: 'src/lib/actions/finance.ts',
      requiredTerms: ["requireRole(['Managing Director', 'Accounts', 'Admin / BDM'])"],
    },
    {
      file: 'src/lib/actions/procurement.ts',
      requiredTerms: ["requireRole(['Managing Director', 'Admin / BDM', 'Accounts', 'BDM'])"],
    },
    {
      file: 'src/lib/actions/customers.ts',
      requiredTerms: ['requireAuth()'],
    },
    {
      file: 'src/lib/actions/quotations.ts',
      requiredTerms: ['requireAuth()'],
    },
    {
      file: 'src/lib/actions/enquiries.ts',
      requiredTerms: ['requireAuth()'],
    },
    {
      file: 'src/lib/actions/orders.ts',
      requiredTerms: ['requireAuth()'],
    },
  ];

  for (const check of actionsToCheck) {
    const fullPath = path.join(rootDir, check.file);
    assert.ok(fs.existsSync(fullPath), `File ${check.file} must exist`);
    const content = fs.readFileSync(fullPath, 'utf8');
    for (const term of check.requiredTerms) {
      assert.ok(
        content.includes(term),
        `File ${check.file} must enforce authorization term: ${term}`
      );
    }
  }
});

test('Suite 3: Confidential Supplier Cost & Margin Redaction in Quotations', (t) => {
  const quotationsActionPath = path.join(rootDir, 'src/lib/actions/quotations.ts');
  const content = fs.readFileSync(quotationsActionPath, 'utf8');

  // Verify that getQuotationById checks user role and sanitizes purchase_price and supplier info
  assert.ok(
    content.includes('canViewCosts'),
    'getQuotationById must determine canViewCosts based on role'
  );
  assert.ok(
    content.includes('purchase_price: 0'),
    'getQuotationById must redact purchase_price to 0 for unauthorized viewers'
  );
  assert.ok(
    content.includes('supplier_id: undefined'),
    'getQuotationById must scrub supplier_id for unauthorized viewers'
  );
});

test('Suite 4: TRAI DLT Validation on SMS Communication', (t) => {
  const commActionPath = path.join(rootDir, 'src/lib/actions/communication.ts');
  const content = fs.readFileSync(commActionPath, 'utf8');

  assert.ok(
    content.includes('dlt_template_id'),
    'Communication actions must inspect dlt_template_id for SMS'
  );
  assert.ok(
    content.includes('TRAI DLT Compliance'),
    'Communication actions must cite TRAI DLT regulations when rejecting non-compliant SMS'
  );
  assert.ok(
    content.includes('provider_message_id'),
    'Webhook handling must check provider_message_id for idempotency deduplication'
  );
});

test('Suite 5: MFA AES-256-GCM Encryption at Rest & Decryption Fidelity', (t) => {
  const mfaServicePath = path.join(rootDir, 'src/lib/security/mfa-service.ts');
  const content = fs.readFileSync(mfaServicePath, 'utf8');

  assert.ok(content.includes('export function encryptMfaSecret'), 'Must export encryptMfaSecret');
  assert.ok(content.includes('export function decryptMfaSecret'), 'Must export decryptMfaSecret');

  // Extract encryption and decryption functions for direct execution
  const startIdx = content.indexOf('function getMfaEncryptionKey');
  const endIdx = content.indexOf('export function base32Encode');
  const block = content.substring(startIdx, endIdx);

  const transpiled = ts.transpileModule(block, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const exported = {};
  const runner = new Function('exports', 'require', 'crypto', 'process', transpiled);
  runner(exported, require, crypto, process);

  const { encryptMfaSecret, decryptMfaSecret } = exported;

  // Test 1: Plain secret encryption produces expected enc: format
  const plainSecret = 'JBSWY3DPEHPK3PXP'; // Standard Base32 TOTP secret
  const encrypted = encryptMfaSecret(plainSecret);
  assert.ok(encrypted.startsWith('enc:'), 'Encrypted secret must start with enc: prefix');
  const parts = encrypted.split(':');
  assert.equal(parts.length, 4, 'Encrypted secret must contain prefix, IV, authTag, and ciphertext');

  // Test 2: Decrypting the ciphertext recovers exact original Base32 secret
  const decrypted = decryptMfaSecret(encrypted);
  assert.equal(decrypted, plainSecret, 'Decrypted secret must match original Base32 secret exactly');

  // Test 3: Plaintext fallback tolerance (graceful migration without breaking unmigrated records)
  const unmigratedSecret = 'KRSXG5CTMVRXEZLU';
  assert.equal(
    decryptMfaSecret(unmigratedSecret),
    unmigratedSecret,
    'Plaintext secrets must pass through without corruption'
  );

  // Test 4: Corrupted or tampered ciphertext fails closed safely to empty string
  const tamperedEncrypted = `enc:${parts[1]}:${parts[2]}:${parts[3].slice(0, -2)}ff`;
  assert.equal(
    decryptMfaSecret(tamperedEncrypted),
    '',
    'Tampered ciphertext must fail decryption safely'
  );
});

test('Suite 6: Suspended Account Invalidation Enforcement in Session Validation', (t) => {
  const sessionPath = path.join(rootDir, 'src/lib/auth/session.ts');
  const content = fs.readFileSync(sessionPath, 'utf8');

  assert.ok(
    content.includes('is_suspended'),
    'verifySignedToken must inspect is_suspended status'
  );
  assert.ok(
    content.includes('__ICON_ACCOUNT_SECURITY__'),
    'verifySignedToken must consult account security store for suspended accounts'
  );
});

test('Suite 7: Enterprise Audit Sensitive Field Redaction & Production Fail-Closed', (t) => {
  const loggerPath = path.join(rootDir, 'src/lib/audit/enterprise-logger.ts');
  const content = fs.readFileSync(loggerPath, 'utf8');

  // Verify sensitive fields list
  const requiredRedactedFields = [
    'supplier_cost',
    'purchase_price',
    'internal_remarks',
    'aadhaar',
    'pan_number',
    'bank_account',
    'access_token',
    'refresh_token',
    'mfa_secret',
  ];

  for (const field of requiredRedactedFields) {
    assert.ok(
      content.includes(`'${field}'`),
      `Audit logger must include '${field}' in SENSITIVE_FIELD_NAMES redaction set`
    );
  }

  // Verify fail-closed option
  assert.ok(
    content.includes('MANDATORY_AUDIT_PERSISTENCE_FAILURE'),
    'Must fail closed with MANDATORY_AUDIT_PERSISTENCE_FAILURE in production'
  );
});
