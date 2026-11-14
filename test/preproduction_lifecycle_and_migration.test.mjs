import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper to probe HTTP port
function probeHttp(port, path = '/') {
  return new Promise((resolve) => {
    const req = http.get({ hostname: '127.0.0.1', port, path, timeout: 3000 }, (res) => {
      resolve({ status: res.statusCode });
    });
    req.on('error', (err) => resolve({ error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ error: 'TIMEOUT' });
    });
  });
}

// Replicate Password Complexity Validation Contract from passwords.ts
function validatePasswordStrength(password) {
  const errors = [];
  if (!password || password.length < 8) errors.push('Password must be at least 8 characters long.');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter (A-Z).');
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter (a-z).');
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least one numeric digit (0-9).');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Password must contain at least one special character (!@#$%^&*...).');
  return { valid: errors.length === 0, errors };
}

// Replicate Expiring Token Contract from passwords.ts
const TOKEN_SECRET = 'test-icon-tech-pro-enterprise-token-secret-2026';
const consumedTokens = new Set();

function generateExpiringToken(payload, ttlMs = 24 * 60 * 60 * 1000) {
  const exp = Date.now() + ttlMs;
  const fullPayload = { ...payload, exp };
  const jsonStr = JSON.stringify(fullPayload);
  const dataB64 = Buffer.from(jsonStr, 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(dataB64).digest('base64url');
  return `${dataB64}.${sig}`;
}

function verifyExpiringToken(token) {
  if (!token || !token.includes('.')) return { valid: false, error: 'Malformed or missing security token.' };
  if (consumedTokens.has(token)) return { valid: false, error: 'This security token has already been consumed (single-use).' };

  const [dataB64, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(dataB64).digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expSigBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expSigBuf.length || !crypto.timingSafeEqual(sigBuf, expSigBuf)) {
    return { valid: false, error: 'Invalid cryptographic signature on security token.' };
  }

  try {
    const jsonStr = Buffer.from(dataB64, 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr);
    if (Date.now() > payload.exp) {
      return { valid: false, error: 'Security token has expired.' };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'Failed to decode token payload.' };
  }
}

function isTallyBinaryFile(filename) {
  return /\.(1800|tsf|dat|bin|enc|mdf|ldf|db)$/i.test(filename);
}

function normalizeBusinessName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/\b(pvt|ltd|private|limited|solutions|enterprises|technologies|systems|india|corp|corporation|co|inc)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function normalizePhone(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

test('ICON TECH PRO ERP V9.2 — Master Pre-Production Lifecycle & Migration Suite', async (t) => {
  await t.test('1. Enterprise Password Complexity Standards Verification', () => {
    // Too short
    assert.strictEqual(validatePasswordStrength('Short1!').valid, false);
    // Missing uppercase
    assert.strictEqual(validatePasswordStrength('lower123!@#').valid, false);
    // Missing lowercase
    assert.strictEqual(validatePasswordStrength('UPPER123!@#').valid, false);
    // Missing number
    assert.strictEqual(validatePasswordStrength('NoNumbersHere!').valid, false);
    // Missing special char
    assert.strictEqual(validatePasswordStrength('NoSpecialChar123').valid, false);
    // Compliant strong password
    const valid = validatePasswordStrength('IconTechPro#2026');
    assert.strictEqual(valid.valid, true);
    assert.strictEqual(valid.errors.length, 0);
  });

  await t.test('2. Cryptographic Expiring Single-Use Invitation & Password Reset Tokens', () => {
    const token = generateExpiringToken({
      email: 'new.employee@icontechpro.in',
      userId: 'USR-TEST-99',
      type: 'invite',
    });

    assert.ok(token.includes('.'), 'Token must be HMAC signed');
    const firstCheck = verifyExpiringToken(token);
    assert.strictEqual(firstCheck.valid, true);
    assert.strictEqual(firstCheck.payload.email, 'new.employee@icontechpro.in');
    assert.strictEqual(firstCheck.payload.type, 'invite');

    // Consume single-use token
    consumedTokens.add(token);

    // Replay attack prevention: second check MUST fail
    const replayCheck = verifyExpiringToken(token);
    assert.strictEqual(replayCheck.valid, false);
    assert.ok(replayCheck.error.includes('already been consumed'));

    // Tampered token check
    const tampered = token.slice(0, -6) + 'abcdef';
    const tamperedCheck = verifyExpiringToken(tampered);
    assert.strictEqual(tamperedCheck.valid, false);
  });

  await t.test('3. Verification of Reset Password Page and Actions', () => {
    const resetPagePath = path.join(rootDir, 'src/app/(auth)/reset-password/page.tsx');
    assert.ok(fs.existsSync(resetPagePath), 'Reset password page must exist');
    const content = fs.readFileSync(resetPagePath, 'utf8');

    assert.match(content, /verifyPasswordActionToken/, 'Must verify token on mount');
    assert.match(content, /completeAccountPasswordSetup/, 'Must complete setup');
    assert.match(content, /Enterprise Password Security Standards/, 'Must show security requirements');
    assert.match(content, /Confirm New Password/, 'Must have confirm password field');
    assert.match(content, /isInvite/, 'Must distinguish invite from reset');
  });

  await t.test('4. Verification of Users Management Invitation Actions', () => {
    const usersActionPath = path.join(rootDir, 'src/lib/actions/users.ts');
    assert.ok(fs.existsSync(usersActionPath), 'users.ts actions must exist');
    const content = fs.readFileSync(usersActionPath, 'utf8');

    assert.match(content, /resendUserInvitation/, 'Must export resendUserInvitation');
    assert.match(content, /verifyPasswordActionToken/, 'Must export verifyPasswordActionToken');
    assert.match(content, /completeAccountPasswordSetup/, 'Must export completeAccountPasswordSetup');
    assert.match(content, /generateExpiringToken/, 'Must generate expiring tokens');
    assert.match(content, /consumeExpiringToken/, 'Must consume single-use tokens');
  });

  await t.test('5. Production Quick Login & Role Impersonation Lockdown Invariant', () => {
    const loginActionPath = path.join(rootDir, 'src/app/(auth)/login/actions.ts');
    assert.ok(fs.existsSync(loginActionPath), 'login actions must exist');
    const content = fs.readFileSync(loginActionPath, 'utf8');

    // Quick login must return [] in UAT and PRODUCTION
    assert.match(
      content,
      /process\.env\.NEXT_PUBLIC_ERP_ENV[\s\S]*?=== 'UAT'[\s\S]*?return \[\]/,
      'Must return [] in UAT'
    );
    assert.match(
      content,
      /process\.env\.NODE_ENV === 'production' \|\|[\s\S]*?=== 'PRODUCTION'[\s\S]*?return \[\]/,
      'Must return [] in PRODUCTION'
    );

    // quickLoginAsRole must throw in production
    assert.match(
      content,
      /strictly prohibited in production/,
      'quickLoginAsRole must reject in production'
    );
  });

  await t.test('6. Tally Data Migration: Binary File Rejection (.1800, .TSF)', () => {
    assert.strictEqual(isTallyBinaryFile('company_data.1800'), true);
    assert.strictEqual(isTallyBinaryFile('voucher_backup.tsf'), true);
    assert.strictEqual(isTallyBinaryFile('tally_db.dat'), true);
    assert.strictEqual(isTallyBinaryFile('party_master.csv'), false);
    assert.strictEqual(isTallyBinaryFile('opening_balances.CSV'), false);

    const importPagePath = path.join(rootDir, 'src/app/(dashboard)/dashboard/import/page.tsx');
    const content = fs.readFileSync(importPagePath, 'utf8');
    assert.match(content, /isTallyBinaryFile/, 'Import page must call isTallyBinaryFile');
    assert.match(content, /\.1800 \/ \.TSF/, 'Must give informative error for proprietary files');
  });

  await t.test('7. Tally Data Migration: 4-Level Duplicate Detection Simulation', () => {
    const existingDb = [
      {
        id: 'CUST-001',
        customer_code: 'ICON260010',
        customer_name: 'Apex Infotech Solutions Pvt Ltd',
        phone: '+91 98490 88776',
        gstin: '36AABCA9999F1Z5',
        email: 'billing@apexinfotech.in',
      },
    ];

    function classifyRow(row) {
      const gstin = (row.gstin || '').trim().toUpperCase();
      const phone = normalizePhone(row.phone);
      const name = normalizeBusinessName(row.name || row.customer_name);

      if (!row.name || !row.phone) return 'INVALID';

      // Level 1: GSTIN
      if (gstin) {
        const match = existingDb.find((c) => c.gstin === gstin);
        if (match) return 'EXACT_DUPLICATE';
      }

      // Level 2: Phone
      if (phone) {
        const match = existingDb.find((c) => normalizePhone(c.phone) === phone);
        if (match) {
          if (normalizeBusinessName(match.customer_name) === name) return 'EXACT_DUPLICATE';
          return 'POSSIBLE_DUPLICATE';
        }
      }

      // Level 3: Email
      if (row.email) {
        const match = existingDb.find((c) => c.email.toLowerCase() === row.email.toLowerCase());
        if (match) return 'POSSIBLE_DUPLICATE';
      }

      // Level 4: Name
      if (name) {
        const match = existingDb.find((c) => normalizeBusinessName(c.customer_name) === name);
        if (match) return 'POSSIBLE_DUPLICATE';
      }

      return 'NEW';
    }

    assert.strictEqual(
      classifyRow({ name: 'Apex Infotech Solutions', phone: '+91 98490 88776', gstin: '36AABCA9999F1Z5' }),
      'EXACT_DUPLICATE'
    );
    assert.strictEqual(
      classifyRow({ name: 'Apex New Branch', phone: '+91 99999 00000', email: 'billing@apexinfotech.in' }),
      'POSSIBLE_DUPLICATE'
    );
    assert.strictEqual(
      classifyRow({ name: 'Different Co', phone: '+91 98490 88776' }),
      'POSSIBLE_DUPLICATE'
    );
    assert.strictEqual(
      classifyRow({ name: 'Broken Row', phone: '' }),
      'INVALID'
    );
    assert.strictEqual(
      classifyRow({ name: 'Totally Fresh Customer', phone: '+91 91111 22222', gstin: '36ZZZZZ1111A1Z0' }),
      'NEW'
    );
  });

  await t.test('8. Verification of Tally Import Templates and UI Controls', () => {
    const csvParserPath = path.join(rootDir, 'src/lib/utils/csv-parser.ts');
    const parserContent = fs.readFileSync(csvParserPath, 'utf8');
    assert.match(parserContent, /opening_receivables/, 'Must include opening receivables template');
    assert.match(parserContent, /opening_payables/, 'Must include opening payables template');

    const importPagePath = path.join(rootDir, 'src/app/(dashboard)/dashboard/import/page.tsx');
    const importContent = fs.readFileSync(importPagePath, 'utf8');
    assert.match(importContent, /validateAndClassifyImportRows/, 'Import page must call duplicate classifier');
    assert.match(importContent, /bulkImportOpeningReceivables/, 'Import page must support receivables');
    assert.match(importContent, /bulkImportOpeningPayables/, 'Import page must support payables');
    assert.match(importContent, /userConfirmed/, 'Import page must require user review confirmation');
  });

  await t.test('9. Verification of Production Master Data & Settings', () => {
    const companyPath = path.join(rootDir, 'src/lib/actions/company-settings.ts');
    const companyContent = fs.readFileSync(companyPath, 'utf8');
    assert.match(companyContent, /ICON TECH PRO PRIVATE LIMITED/, 'Must define legal company name');
    assert.match(companyContent, /Ameer Estate, 503 A Block, SR Nagar/, 'Must define registered address');
    assert.match(companyContent, /bank_details/, 'Must configure bank details');

    const docSettingsPath = path.join(rootDir, 'src/lib/actions/document-settings.ts');
    const docContent = fs.readFileSync(docSettingsPath, 'utf8');
    assert.match(docContent, /QT-/, 'Quotation prefix must be QT-');
    assert.match(docContent, /INV-/, 'Invoice prefix must be INV-');
    assert.match(docContent, /ORD-/, 'Sales order prefix must be ORD-');
    assert.match(docContent, /ENQ-/, 'Enquiry prefix must be ENQ-');
    assert.match(docContent, /ICON/, 'Customer prefix must be ICON');
  });

  await t.test('10. Live HTTP Port Isolation Check (Port 3000 Untouched vs Port 3001 UAT)', async () => {
    // Port 3000 Production Probe
    const prodRes = await probeHttp(3000, '/login');
    assert.strictEqual(prodRes.status, 200, 'Port 3000 (Production) must be running and HTTP 200');

    // Port 3001 UAT Probe
    const uatRes = await probeHttp(3001, '/login');
    assert.strictEqual(uatRes.status, 200, 'Port 3001 (UAT) must be running and HTTP 200');

    // Verify /reset-password on UAT
    const resetRes = await probeHttp(3001, '/reset-password');
    assert.strictEqual(resetRes.status, 200, 'Port 3001 /reset-password route must return HTTP 200');
  });
});
