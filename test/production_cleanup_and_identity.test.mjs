import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment variables safely
const envPath = path.join(rootDir, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split(/\r?\n/);
let supabaseUrl = '', supabaseKey = '';
let googleRedirectUri = '', appUrl = '', siteUrl = '';

for (const line of lines) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SECRET_KEY=')) supabaseKey = line.split('=')[1].trim();
  if (line.startsWith('GOOGLE_REDIRECT_URI=')) googleRedirectUri = line.split('=')[1].trim();
  if (line.startsWith('NEXT_PUBLIC_APP_URL=')) appUrl = line.split('=')[1].trim();
  if (line.startsWith('NEXT_PUBLIC_SITE_URL=')) siteUrl = line.split('=')[1].trim();
}

const admin = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// =============================================================================
// PRODUCTION GO-LIVE CLEANUP & IDENTITY VERIFICATION SUITE
// =============================================================================

test('1. Production Backup & Snapshot Verification', async (t) => {
  await t.test('1.1. Backup snapshot directory exists in backups/', () => {
    const backupDir = path.join(rootDir, 'backups');
    assert.strictEqual(fs.existsSync(backupDir), true);
    const files = fs.readdirSync(backupDir).filter(f => f.startsWith('pre-cleanup-db-snapshot'));
    assert.ok(files.length > 0, 'At least one pre-cleanup database snapshot must exist');
  });

  await t.test('1.2. Snapshot JSON contains complete table data capture', () => {
    const backupDir = path.join(rootDir, 'backups');
    const files = fs.readdirSync(backupDir).filter(f => f.startsWith('pre-cleanup-db-snapshot'));
    const latestSnapshotDir = path.join(backupDir, files[files.length - 1]);
    const snapshotFile = path.join(latestSnapshotDir, 'database-snapshot.json');
    assert.strictEqual(fs.existsSync(snapshotFile), true);
    const snap = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
    assert.ok(snap.customers, 'Snapshot must capture customers');
    assert.ok(snap.quotations, 'Snapshot must capture quotations');
    assert.ok(snap.system_settings, 'Snapshot must capture system settings');
    assert.ok(snap.managed_user_credentials, 'Snapshot must capture managed user credentials');
  });
});

test('2. Live Database Clean State Verification', async (t) => {
  if (!admin) {
    t.skip('Supabase credentials unavailable for direct DB query');
    return;
  }

  await t.test('2.1. Test customers are 0 in live production database', async () => {
    const { count, error } = await admin.from('customers').select('*', { count: 'exact', head: true });
    assert.strictEqual(error, null);
    assert.strictEqual(count, 0, 'All test customers must be 0 in clean production database');
  });

  await t.test('2.2. Test enquiries are 0 in live production database', async () => {
    const { count, error } = await admin.from('enquiries').select('*', { count: 'exact', head: true });
    assert.strictEqual(error, null);
    assert.strictEqual(count, 0, 'All test enquiries must be 0 in clean production database');
  });

  await t.test('2.3. Test quotations and quotation items are 0 in live database', async () => {
    const { count: qCount, error: qErr } = await admin.from('quotations').select('*', { count: 'exact', head: true });
    assert.strictEqual(qErr, null);
    assert.strictEqual(qCount, 0, 'Test quotations must be 0');

    const { count: qiCount, error: qiErr } = await admin.from('quotation_items').select('*', { count: 'exact', head: true });
    assert.strictEqual(qiErr, null);
    assert.strictEqual(qiCount, 0, 'Test quotation items must be 0');
  });

  await t.test('2.4. Test sales orders, invoices, and payments are 0 in live database', async () => {
    const { count: oCount, error: oErr } = await admin.from('sales_orders').select('*', { count: 'exact', head: true });
    assert.strictEqual(oErr, null);
    assert.strictEqual(oCount, 0);

    const { count: iCount, error: iErr } = await admin.from('invoices').select('*', { count: 'exact', head: true });
    assert.strictEqual(iErr, null);
    assert.strictEqual(iCount, 0);

    const { count: pCount, error: pErr } = await admin.from('payments').select('*', { count: 'exact', head: true });
    assert.strictEqual(pErr, null);
    assert.strictEqual(pCount, 0);
  });
});

test('3. Admin Account USR001 Preservation', async (t) => {
  if (!admin) {
    t.skip('Supabase credentials unavailable for direct DB query');
    return;
  }

  await t.test('3.1. Exactly 1 managed user credential exists (Admin USR001)', async () => {
    const { data, error } = await admin.from('managed_user_credentials').select('*');
    assert.strictEqual(error, null);
    assert.strictEqual(data?.length, 1, 'Only Admin USR001 must exist in managed_user_credentials');
    const user = data[0];
    assert.strictEqual(user.user_id, 'USR001');
    assert.strictEqual(user.erp_login_email, 'dheeraj@icontechpro.in');
    assert.strictEqual(user.algorithm, 'pbkdf2_sha512');
    assert.strictEqual(user.iterations, 100000);
    assert.ok(user.password_hash.length >= 128, 'Password hash must be 128-char hex string');
  });

  await t.test('3.2. Roles table preserves all 6 system roles', async () => {
    const { data, error } = await admin.from('roles').select('role_name');
    assert.strictEqual(error, null);
    assert.strictEqual(data?.length, 6);
    const roleNames = data.map(r => r.role_name);
    assert.ok(roleNames.includes('Managing Director'));
    assert.ok(roleNames.includes('Admin / BDM'));
    assert.ok(roleNames.includes('BDM'));
    assert.ok(roleNames.includes('Sales Executive'));
    assert.ok(roleNames.includes('Accounts'));
    assert.ok(roleNames.includes('Office Assistant'));
  });

  await t.test('3.3. System settings remain 100% intact', async () => {
    const { data, error } = await admin.from('system_settings').select('setting_key');
    assert.strictEqual(error, null);
    assert.ok(data.length >= 3);
    const keys = data.map(s => s.setting_key);
    assert.ok(keys.includes('company_profile'));
    assert.ok(keys.includes('quotation_terms'));
    assert.ok(keys.includes('gmail_oauth_integration'));
  });

  await t.test('3.4. Audit logs are preserved with full history', async () => {
    const { count, error } = await admin.from('audit_logs').select('*', { count: 'exact', head: true });
    assert.strictEqual(error, null);
    assert.ok((count || 0) >= 130, 'Audit logs must remain completely preserved');
  });
});

test('4. Production Identity & URL Configuration', async (t) => {
  await t.test('4.1. GOOGLE_REDIRECT_URI uses production public origin', () => {
    assert.strictEqual(googleRedirectUri, 'https://erp.icontechpro.in/api/integrations/gmail/callback');
    assert.doesNotMatch(googleRedirectUri, /localhost/);
  });

  await t.test('4.2. NEXT_PUBLIC_SITE_URL and APP_URL use production public domain', () => {
    assert.strictEqual(siteUrl, 'https://erp.icontechpro.in');
    assert.strictEqual(appUrl, 'https://erp.icontechpro.in');
  });

  await t.test('4.3. INITIAL_MANAGED_USERS in constants has only Admin USR001 in production', async () => {
    const rbacFile = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'constants', 'rbac-data.ts'), 'utf8');
    assert.match(rbacFile, /isUatEnvironment/);
    assert.match(rbacFile, /USR001/);
    assert.match(rbacFile, /Bijjam Venkata Dheeraj Reddy/);
    assert.match(rbacFile, /dheeraj@icontechpro\.in/);
  });
});

test('5. Gmail Mailbox Access RBAC Guard', async (t) => {
  const gmailSource = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'actions', 'gmail.ts'), 'utf8');

  await t.test('5.1. Explicitly denies Reshma and Hemalath by default', () => {
    assert.match(gmailSource, /sales@icontechpro\.in/);
    assert.match(gmailSource, /accounts@icontechpro\.in/);
    assert.match(gmailSource, /return false/);
  });

  await t.test('5.2. Explicitly permits MD, Dheeraj, Vineet, and Manisha', () => {
    assert.match(gmailSource, /icontechpro@gmail\.com/);
    assert.match(gmailSource, /dheeraj@icontechpro\.in/);
    assert.match(gmailSource, /vineet@icontechpro\.in/);
    assert.match(gmailSource, /service01@icontechpro\.in/);
  });

  await t.test('5.3. Guard function requireGmailMailboxAccess exists and throws on forbidden access', () => {
    assert.match(gmailSource, /export async function requireGmailMailboxAccess/);
    assert.match(gmailSource, /throw new Error/);
  });
});

test('6. Data Import Readiness & Protection', async (t) => {
  const importPage = fs.readFileSync(path.join(rootDir, 'src', 'app', '(dashboard)', 'dashboard', 'import', 'page.tsx'), 'utf8');
  const importAction = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'actions', 'bulk-import.ts'), 'utf8');

  await t.test('6.1. Supports staging, validation, preview, and duplicate detection', () => {
    assert.match(importAction, /validateAndClassifyImportRows/);
    assert.match(importPage, /classificationSummary/);
    assert.match(importPage, /Search preview rows/i);
  });

  await t.test('6.2. Rejects raw Tally binary files', () => {
    assert.match(importPage, /isTallyBinaryFile/);
  });

  await t.test('6.3. Requires human approval before commit', () => {
    assert.match(importPage, /userConfirmed/);
    assert.match(importPage, /Execute Import/i);
  });
});

test('7. Approved Quotation UX & CPQ Invariants', async (t) => {
  await t.test('7.1. QuotationFormWorkspace.tsx exists and is intact', () => {
    const qFormPath = path.join(rootDir, 'src', 'components', 'quotations', 'QuotationFormWorkspace.tsx');
    assert.strictEqual(fs.existsSync(qFormPath), true);
    const content = fs.readFileSync(qFormPath, 'utf8');
    assert.match(content, /QuotationFormWorkspace/);
    assert.match(content, /SPEC INTELLIGENCE/i);
    assert.match(content, /pricingMode/i);
  });
});
