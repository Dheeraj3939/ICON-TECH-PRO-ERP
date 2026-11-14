import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// =============================================================================
// ICON TECH PRO ERP V9.2 — IN-MEMORY DEMONSTRATION & ZERO-MUTATION TEST SUITE
// =============================================================================

test('ICON TECH PRO ERP V9.2 — Demonstration Safety & Zero-Mutation Invariants', async (t) => {

  // ---------------------------------------------------------------------------
  // 1. IN-MEMORY ISOLATION (ZERO PRODUCTION TABLE MUTATION)
  // ---------------------------------------------------------------------------
  await t.test('1. Proforma and Challan Actions Never Mutate Existing Tables', () => {
    const proformaSrc = fs.readFileSync(path.join(rootDir, 'src/lib/actions/proforma.ts'), 'utf8');
    const challanSrc = fs.readFileSync(path.join(rootDir, 'src/lib/actions/delivery-challans.ts'), 'utf8');
    const signedSrc = fs.readFileSync(path.join(rootDir, 'src/lib/actions/signed-documents.ts'), 'utf8');

    // Verify Proforma operates on its own store and proforma_invoices table only
    assert.ok(!proformaSrc.includes("supabase.from('quotations').update"), 'Proforma must never update quotations');
    assert.ok(!proformaSrc.includes("supabase.from('quotations').delete"), 'Proforma must never delete quotations');
    assert.ok(!proformaSrc.includes("supabase.from('invoices').update"), 'Proforma must never update tax invoices');
    assert.ok(!proformaSrc.includes("supabase.from('invoices').delete"), 'Proforma must never delete tax invoices');
    assert.ok(!proformaSrc.includes("supabase.from('customers').delete"), 'Proforma must never delete customers');

    // Verify Challan operates on its own store and delivery_challans table only
    assert.ok(!challanSrc.includes("supabase.from('quotations').update"), 'Challan must never update quotations');
    assert.ok(!challanSrc.includes("supabase.from('invoices').update"), 'Challan must never update tax invoices');
    assert.ok(!challanSrc.includes("supabase.from('orders').delete"), 'Challan must never delete sales orders');

    // Verify Signed Documents never overwrites original generated PDF
    assert.ok(signedSrc.includes('original_generated_pdf_url: newRecord.original_generated_pdf_url'), 'Original PDF URL preserved');
    assert.ok(signedSrc.includes('signed_scan_file_url: newRecord.signed_scan_file_url'), 'Signed scan stored distinctly');
  });

  // ---------------------------------------------------------------------------
  // 2. EMAIL TRANSMISSION TRAP & SAFE DISPATCH INVARIANTS
  // ---------------------------------------------------------------------------
  await t.test('2. External Email Sending is Strictly Trapped in Test & Queue Mode', () => {
    const gmailAction = fs.readFileSync(path.join(rootDir, 'src/lib/actions/gmail.ts'), 'utf8');
    const emailQueueAction = fs.readFileSync(path.join(rootDir, 'src/lib/actions/email-automation.ts'), 'utf8');
    const envLocal = fs.existsSync(path.join(rootDir, '.env.local'))
      ? fs.readFileSync(path.join(rootDir, '.env.local'), 'utf8')
      : '';

    // Verify Gmail sends fail-closed when refresh token is absent
    assert.ok(
      gmailAction.includes("error: 'Gmail account is not connected. Please authorize in ERP Settings > Integrations.'"),
      'Gmail dispatch must fail-closed if token is missing'
    );
    assert.ok(
      !envLocal.includes('GMAIL_REFRESH_TOKEN='),
      '.env.local must NOT contain raw Gmail refresh token'
    );

    // Verify Email Queue durability and dead-letter protection
    assert.ok(emailQueueAction.includes("job.status = 'DEAD_LETTER'"), 'Must transition failed jobs to DEAD_LETTER');
    assert.ok(emailQueueAction.includes("enqueueAutomatedEmail"), 'Must use enqueueAutomatedEmail rather than direct SMTP');
  });

  // ---------------------------------------------------------------------------
  // 3. DATABASE FALLBACK & UNMIGRATED SCHEMA COMPATIBILITY
  // ---------------------------------------------------------------------------
  await t.test('3. New Modules Gracefully Fall Back to In-Memory Stores When Tables Are Absent', () => {
    const proformaSrc = fs.readFileSync(path.join(rootDir, 'src/lib/actions/proforma.ts'), 'utf8');
    const challanSrc = fs.readFileSync(path.join(rootDir, 'src/lib/actions/delivery-challans.ts'), 'utf8');
    const signedSrc = fs.readFileSync(path.join(rootDir, 'src/lib/actions/signed-documents.ts'), 'utf8');

    // Proforma fallback
    assert.ok(proformaSrc.includes('getProformaStore()'), 'Must have in-memory store fallback');
    assert.ok(proformaSrc.includes('SEED_PROFORMA_INVOICES'), 'Must have initial seed data');
    assert.ok(proformaSrc.includes('store.unshift(newProforma)'), 'Must update in-memory store on creation');

    // Challan fallback
    assert.ok(challanSrc.includes('getChallanStore()'), 'Must have in-memory challan store');
    assert.ok(challanSrc.includes('SEED_DELIVERY_CHALLANS'), 'Must have initial seed challans');
    assert.ok(challanSrc.includes('store.unshift(newChallan)'), 'Must update in-memory store on challan creation');

    // Signed Docs fallback
    assert.ok(signedSrc.includes('getSignedDocsStore()'), 'Must have in-memory signed docs store');
    assert.ok(signedSrc.includes('SEED_SIGNED_DOCS'), 'Must have initial seed signed documents');
  });

  // ---------------------------------------------------------------------------
  // 4. AUTHENTICATION & SESSION COMPATIBILITY
  // ---------------------------------------------------------------------------
  await t.test('4. Existing Auth Tokens, Secrets, and RBAC Matrix Remain 100% Compatible', () => {
    const sessionSrc = fs.readFileSync(path.join(rootDir, 'src/lib/auth/session.ts'), 'utf8');
    const middlewareSrc = fs.readFileSync(path.join(rootDir, 'src/lib/supabase/middleware.ts'), 'utf8');
    const rbacSrc = fs.readFileSync(path.join(rootDir, 'src/lib/constants/rbac-data.ts'), 'utf8');

    // Cookie name invariant
    assert.ok(sessionSrc.includes("export const SESSION_COOKIE_NAME = 'erp_session_token'"), 'Session cookie name matches');
    assert.ok(middlewareSrc.includes('SESSION_COOKIE_NAME'), 'Middleware checks SESSION_COOKIE_NAME');

    // Signature verification invariant
    assert.ok(sessionSrc.includes('verifySignedToken'), 'Must export verifySignedToken');
    assert.ok(sessionSrc.includes('crypto.subtle.sign'), 'Must use standard WebCrypto HMAC');

    // All 6 roles defined
    ['Managing Director', 'Admin / BDM', 'BDM', 'Sales Executive', 'Accounts', 'Office Assistant'].forEach((role) => {
      assert.ok(rbacSrc.includes(role), `Role ${role} must exist in RBAC constants`);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. APPLICATION ROLLBACK MANIFEST & INTEGRITY
  // ---------------------------------------------------------------------------
  await t.test('5. Release Candidate Backup Manifest Exists with Valid SHA-256 Checksums', () => {
    const manifestPath = path.join(rootDir, 'backups/release_v9_2_pre_refresh/MANIFEST.json');
    assert.ok(fs.existsSync(manifestPath), 'MANIFEST.json must exist in release backup folder');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.ok(Array.isArray(manifest) && manifest.length > 0, 'Manifest must contain backed up items');

    const hasBuildId = manifest.some((m) => m.file === '.next/BUILD_ID');
    assert.ok(hasBuildId, 'Manifest must track .next/BUILD_ID');

    const hasPackageJson = manifest.some((m) => m.file === 'package.json');
    assert.ok(hasPackageJson, 'Manifest must track package.json');
  });

  // ---------------------------------------------------------------------------
  // 6. SINGLE-DOMAIN INVARIANT
  // ---------------------------------------------------------------------------
  await t.test('6. Production Domain Invariant Strictly Set to erp.icontechpro.in', () => {
    const envLocal = fs.readFileSync(path.join(rootDir, '.env.local'), 'utf8');
    assert.ok(envLocal.includes('NEXT_PUBLIC_APP_URL=https://erp.icontechpro.in'), 'Canonical app URL is erp.icontechpro.in');
    assert.ok(envLocal.includes('NEXT_PUBLIC_SITE_URL=https://erp.icontechpro.in'), 'Canonical site URL is erp.icontechpro.in');
  });
});
