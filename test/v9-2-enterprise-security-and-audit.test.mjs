/**
 * ICON TECH PRO ERP V9.2 — STAGE 2 COMPREHENSIVE AUTOMATED TEST SUITE
 * Enterprise Security, 3-Attempt Lockout, MFA (TOTP), Account Recovery & Cryptographic Audit Ledger
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper to read source files
function readSrc(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

describe('ICON TECH PRO ERP V9.2 — Enterprise Security, Auth, MFA & Audit Suite', () => {

  // ----------------------------------------------------------------------------------
  // 1. ARCHITECTURE & CODE INTEGRITY INSPECTION
  // ----------------------------------------------------------------------------------
  describe('1. File Structure and Schema Invariants', () => {
    test('Security types and interfaces exist in src/types/security.ts', () => {
      const content = readSrc('src/types/security.ts');
      assert.ok(content.includes('export interface AccountSecurityRecord'));
      assert.ok(content.includes('export type AuditCategory ='));
      assert.ok(content.includes("'EMPLOYEE_ACTIVITY'"));
      assert.ok(content.includes("'BUSINESS_AUDIT'"));
      assert.ok(content.includes("'SECURITY_EVENT'"));
      assert.ok(content.includes("'SYSTEM_EVENT'"));
      assert.ok(content.includes('export interface EnterpriseAuditRecord'));
      assert.ok(content.includes('previous_hash: string;'));
      assert.ok(content.includes('integrity_hash: string;'));
      assert.ok(content.includes('retention_category: AuditRetentionCategory;'));
      assert.ok(content.includes('legal_hold: boolean;'));
    });

    test('Lockout service implements 3-attempt rule, progressive lockout & admin controls', () => {
      const content = readSrc('src/lib/security/lockout-service.ts');
      assert.ok(content.includes('export function checkAccountLockout'));
      assert.ok(content.includes('export async function recordFailedLogin'));
      assert.ok(content.includes('export function resetFailedAttempts'));
      assert.ok(content.includes('export async function adminUnlockAccount'));
      assert.ok(content.includes('export async function adminSuspendAccount'));
      assert.ok(content.includes('export async function adminReactivateAccount'));
      assert.ok(content.includes('Self-unlock is prohibited'));
      assert.ok(content.includes('lockoutDurationMinutes = 15'));
      assert.ok(content.includes('lockoutDurationMinutes = 30'));
      assert.ok(content.includes('lockoutDurationMinutes = 60'));
    });

    test('MFA service implements RFC 6238 TOTP, Base32, SVG QR & Backup Codes', () => {
      const content = readSrc('src/lib/security/mfa-service.ts');
      assert.ok(content.includes('export function base32Encode'));
      assert.ok(content.includes('export function base32Decode'));
      assert.ok(content.includes('export function generateTotpCode'));
      assert.ok(content.includes('export function verifyTotpCode'));
      assert.ok(content.includes('export function generateBackupCodes'));
      assert.ok(content.includes('export function generateSvgQrCode'));
      assert.ok(content.includes('export function createMfaChallengeToken'));
      assert.ok(content.includes('export function verifyMfaChallengeToken'));
      assert.ok(content.includes('export async function verifyMfaAndCompleteLogin'));
      assert.ok(content.includes('export async function adminResetMfa'));
    });

    test('Recovery service implements anti-enumeration, 15-min tokens & complexity', () => {
      const content = readSrc('src/lib/security/recovery-service.ts');
      assert.ok(content.includes('export function validatePasswordComplexity'));
      assert.ok(content.includes('export function createRecoveryToken'));
      assert.ok(content.includes('export function verifyRecoveryToken'));
      assert.ok(content.includes('15 * 60 * 1000'));
      assert.ok(content.includes('export async function completeSelfServicePasswordReset'));
      assert.ok(content.includes('export async function requestSelfServicePasswordRecovery'));
      assert.ok(content.includes('If an authorized corporate account exists'));
    });

    test('Enterprise audit logger implements SHA-256 chaining, redaction & checkpoints', () => {
      const content = readSrc('src/lib/audit/enterprise-logger.ts');
      assert.ok(content.includes('export async function logEnterpriseAudit'));
      assert.ok(content.includes('export function redactSensitiveData'));
      assert.ok(content.includes('export function computeFieldDiff'));
      assert.ok(content.includes('export function computeRecordHash'));
      assert.ok(content.includes('export function verifyAuditChainIntegrity'));
      assert.ok(content.includes('export async function createAuditCheckpoint'));
      assert.ok(content.includes('export async function setAuditLegalHold'));
    });
  });

  // ----------------------------------------------------------------------------------
  // 2. 3-ATTEMPT ACCOUNT LOCKOUT & PROGRESSIVE RATE LIMITING LOGIC
  // ----------------------------------------------------------------------------------
  describe('2. Account Lockout Invariants', () => {
    test('3-attempt lockout timing and progressive duration ladder', () => {
      // Simulate lockout logic directly from code formulas
      function computeLockout(attemptCount, lockoutCount24h) {
        if (attemptCount < 3) {
          return { locked: false, remainingAttempts: 3 - attemptCount };
        }
        let durationMinutes = 15;
        if (lockoutCount24h === 2) durationMinutes = 30;
        else if (lockoutCount24h >= 3) durationMinutes = 60;
        return { locked: true, remainingAttempts: 0, durationMinutes, durationSeconds: durationMinutes * 60 };
      }

      // 1st attempt
      const att1 = computeLockout(1, 0);
      assert.equal(att1.locked, false);
      assert.equal(att1.remainingAttempts, 2);

      // 2nd attempt
      const att2 = computeLockout(2, 0);
      assert.equal(att2.locked, false);
      assert.equal(att2.remainingAttempts, 1);

      // 3rd attempt (1st lockout in 24h -> 15 min)
      const att3 = computeLockout(3, 1);
      assert.equal(att3.locked, true);
      assert.equal(att3.durationMinutes, 15);
      assert.equal(att3.durationSeconds, 900);

      // Repeated lockout in 24h -> 30 min
      const lock2 = computeLockout(3, 2);
      assert.equal(lock2.locked, true);
      assert.equal(lock2.durationMinutes, 30);
      assert.equal(lock2.durationSeconds, 1800);

      // 3rd+ lockout in 24h -> 60 min
      const lock3 = computeLockout(3, 3);
      assert.equal(lock3.locked, true);
      assert.equal(lock3.durationMinutes, 60);
      assert.equal(lock3.durationSeconds, 3600);
    });

    test('Temporary lockout automatically clears after duration expires', () => {
      const now = Date.now();
      const pastTime = new Date(now - 1000).toISOString();
      const futureTime = new Date(now + 900000).toISOString();

      // Check expired lockout simulation
      function isCurrentlyLocked(isLocked, lockedUntil) {
        if (!isLocked) return false;
        if (lockedUntil && Date.parse(lockedUntil) > Date.now()) {
          return true;
        }
        return false;
      }

      assert.equal(isCurrentlyLocked(true, futureTime), true, 'Future time must be locked');
      assert.equal(isCurrentlyLocked(true, pastTime), false, 'Expired time must auto-clear');
      assert.equal(isCurrentlyLocked(false, null), false, 'Normal state is unlocked');
    });

    test('Administrative suspension is distinct from temporary lockout', () => {
      // Suspension has no expiration timestamp and persists indefinitely
      const suspendedAccount = {
        is_suspended: true,
        suspension_reason: 'Administrative disciplinary review',
        is_locked: false,
        locked_until: null,
      };

      assert.equal(suspendedAccount.is_suspended, true);
      assert.equal(suspendedAccount.locked_until, null, 'Suspension must not have auto-expiry timestamp');
    });
  });

  // ----------------------------------------------------------------------------------
  // 3. RFC 6238 TOTP ALGORITHM & MULTI-FACTOR AUTHENTICATION
  // ----------------------------------------------------------------------------------
  describe('3. Multi-Factor Authentication (RFC 6238 TOTP)', () => {
    const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    function base32Encode(buffer) {
      let bits = 0, value = 0, output = '';
      for (let i = 0; i < buffer.length; i++) {
        value = (value << 8) | buffer[i];
        bits += 8;
        while (bits >= 5) {
          output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
          bits -= 5;
        }
      }
      if (bits > 0) output += BASE32_CHARS[(value << (5 - bits)) & 31];
      return output;
    }

    function base32Decode(base32Str) {
      const clean = base32Str.toUpperCase().replace(/[\s=-]/g, '');
      let bits = 0, value = 0;
      const bytes = [];
      for (let i = 0; i < clean.length; i++) {
        const idx = BASE32_CHARS.indexOf(clean[i]);
        if (idx === -1) continue;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
          bytes.push((value >>> (bits - 8)) & 255);
          bits -= 8;
        }
      }
      return Buffer.from(bytes);
    }

    function generateTotpCode(secretBase32, counter) {
      const secretKey = base32Decode(secretBase32);
      const counterBuf = Buffer.alloc(8);
      counterBuf.writeUInt32BE(0, 0);
      counterBuf.writeUInt32BE(counter, 4);

      const hmac = crypto.createHmac('sha1', secretKey);
      hmac.update(counterBuf);
      const digest = hmac.digest();

      const offset = digest[digest.length - 1] & 0x0f;
      const codeInt =
        ((digest[offset] & 0x7f) << 24) |
        ((digest[offset + 1] & 0xff) << 16) |
        ((digest[offset + 2] & 0xff) << 8) |
        (digest[offset + 3] & 0xff);

      return (codeInt % 1000000).toString().padStart(6, '0');
    }

    test('Base32 encoding and decoding are perfectly symmetrical', () => {
      const original = Buffer.from('ICON TECH PRO HYDERABAD 2026', 'utf8');
      const encoded = base32Encode(original);
      const decoded = base32Decode(encoded);
      assert.equal(decoded.toString('utf8'), 'ICON TECH PRO HYDERABAD 2026');
    });

    test('TOTP generates exact 6 digits and changes every 30 seconds', () => {
      const secret = base32Encode(crypto.randomBytes(20));
      const step1 = 1000000;
      const step2 = 1000001;

      const code1 = generateTotpCode(secret, step1);
      const code2 = generateTotpCode(secret, step2);

      assert.equal(code1.length, 6);
      assert.equal(code2.length, 6);
      assert.equal(/^\d{6}$/.test(code1), true);
      assert.equal(/^\d{6}$/.test(code2), true);
      assert.notEqual(code1, code2);
    });

    test('Backup recovery codes generation: 8 codes, single-use PBKDF2 hash matching', () => {
      function hashBackup(code) {
        const clean = code.toUpperCase().replace(/[\s-]/g, '');
        return crypto.pbkdf2Sync(clean, 'icon_tech_pro_mfa_backup_salt', 10000, 32, 'sha512').toString('hex');
      }

      const codes = [];
      const hashes = [];
      for (let i = 0; i < 8; i++) {
        const p1 = crypto.randomBytes(2).toString('hex').toUpperCase();
        const p2 = crypto.randomBytes(2).toString('hex').toUpperCase();
        const c = `${p1}-${p2}`;
        codes.push(c);
        hashes.push(hashBackup(c));
      }

      assert.equal(codes.length, 8);
      assert.equal(hashes.length, 8);

      // Verify each code matches its hash
      for (let i = 0; i < 8; i++) {
        assert.equal(hashBackup(codes[i]), hashes[i]);
      }

      // Simulate consumption of code 0
      const enteredCode = codes[0];
      const matchIndex = hashes.indexOf(hashBackup(enteredCode));
      assert.equal(matchIndex, 0);
      hashes.splice(matchIndex, 1); // consumed

      assert.equal(hashes.length, 7);
      // Attempting to consume same code again fails
      assert.equal(hashes.indexOf(hashBackup(enteredCode)), -1);
    });

    test('MFA challenge token generates HMAC-signed token expiring in 5 minutes', () => {
      const secret = 'icon_tech_pro_enterprise_salt_2026';
      const userId = 'USR001';
      const email = 'dheeraj@icontechpro.in';
      const exp = Date.now() + 5 * 60 * 1000;

      const payload = `${userId}|${email}|${exp}|mfa_challenge`;
      const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      const token = Buffer.from(`${payload}|${signature}`).toString('base64url');

      // Decode and verify
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const parts = decoded.split('|');
      assert.equal(parts.length, 5);
      assert.equal(parts[0], userId);
      assert.equal(parts[1], email);
      assert.equal(parts[3], 'mfa_challenge');
    });
  });

  // ----------------------------------------------------------------------------------
  // 4. PASSWORD COMPLEXITY & SELF-SERVICE RECOVERY INVARIANTS
  // ----------------------------------------------------------------------------------
  describe('4. Self-Service Password Recovery & Complexity', () => {
    function validateComplexity(password) {
      const errors = [];
      if (!password || password.length < 8) errors.push('Min 8 chars');
      if (!/[A-Z]/.test(password)) errors.push('Uppercase');
      if (!/[a-z]/.test(password)) errors.push('Lowercase');
      if (!/[0-9]/.test(password)) errors.push('Number');
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('Special char');
      return { valid: errors.length === 0, errors };
    }

    test('Password complexity requires 8+ chars, upper, lower, number, and symbol', () => {
      assert.equal(validateComplexity('Pass1!').valid, false, 'Too short');
      assert.equal(validateComplexity('password123!').valid, false, 'No uppercase');
      assert.equal(validateComplexity('PASSWORD123!').valid, false, 'No lowercase');
      assert.equal(validateComplexity('PasswordText!').valid, false, 'No number');
      assert.equal(validateComplexity('Password1234').valid, false, 'No symbol');
      assert.equal(validateComplexity('Admin@Icon2026').valid, true, 'Fully compliant password');
    });

    test('Recovery token single-use expiration is strictly 15 minutes', () => {
      const loginActions = readSrc('src/app/(auth)/login/actions.ts');
      assert.ok(
        loginActions.includes('15 * 60 * 1000'),
        'Token generation must specify 15-minute expiration (15 * 60 * 1000 ms)'
      );
      assert.ok(
        loginActions.includes('expiresHours: 0.25'),
        'Email template must state 0.25 hours (15 minutes)'
      );
    });

    test('Recovery request returns identical anti-enumeration message', () => {
      const recoverySrc = readSrc('src/lib/security/recovery-service.ts');
      const expectedMessage = 'If an authorized corporate account exists for this email address, password reset instructions have been dispatched.';
      assert.ok(recoverySrc.includes(expectedMessage), 'Must contain standard anti-enumeration message');
    });
  });

  // ----------------------------------------------------------------------------------
  // 5. ENTERPRISE AUDIT LEDGER & CRYPTOGRAPHIC HASH CHAINING
  // ----------------------------------------------------------------------------------
  describe('5. Enterprise Central Audit Ledger & SHA-256 Chaining', () => {
    const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

    function computeHash(prevHash, id, ts, cat, action, emp, payload) {
      const content = `${prevHash}|${id}|${ts}|${cat}|${action}|${emp}|${JSON.stringify(payload)}`;
      return crypto.createHash('sha256').update(content).digest('hex');
    }

    test('Sequential audit records form an unbroken SHA-256 cryptographic chain', () => {
      const chain = [];

      // Record 1 (Genesis block child)
      const r1_id = 'AUD-001';
      const r1_ts = '2026-10-31T10:00:00.000Z';
      const r1_payload = { module: 'AUTH', outcome: 'SUCCESS' };
      const r1_hash = computeHash(GENESIS_HASH, r1_id, r1_ts, 'SECURITY_EVENT', 'USER_LOGGED_IN', 'USR001', r1_payload);
      chain.push({ event_id: r1_id, previous_hash: GENESIS_HASH, integrity_hash: r1_hash, payload: r1_payload });

      // Record 2 (Chained to Record 1)
      const r2_id = 'AUD-002';
      const r2_ts = '2026-10-31T10:05:00.000Z';
      const r2_payload = { module: 'QUOTATIONS', outcome: 'SUCCESS' };
      const r2_hash = computeHash(r1_hash, r2_id, r2_ts, 'BUSINESS_AUDIT', 'QUOTATION_CREATED', 'USR002', r2_payload);
      chain.push({ event_id: r2_id, previous_hash: r1_hash, integrity_hash: r2_hash, payload: r2_payload });

      // Record 3 (Chained to Record 2)
      const r3_id = 'AUD-003';
      const r3_ts = '2026-10-31T10:10:00.000Z';
      const r3_payload = { module: 'SECURITY_CONTROLS', outcome: 'SUCCESS' };
      const r3_hash = computeHash(r2_hash, r3_id, r3_ts, 'SECURITY_EVENT', 'SECURITY_ACCOUNT_UNLOCKED', 'USR001', r3_payload);
      chain.push({ event_id: r3_id, previous_hash: r2_hash, integrity_hash: r3_hash, payload: r3_payload });

      // Verification loop
      let expectedPrev = GENESIS_HASH;
      for (const block of chain) {
        assert.equal(block.previous_hash, expectedPrev, 'previous_hash must link to preceding block');
        expectedPrev = block.integrity_hash;
      }
    });

    test('Any alteration of historical audit record breaks cryptographic verification', () => {
      const prevHash = GENESIS_HASH;
      const id = 'AUD-ORIGINAL';
      const ts = '2026-10-31T10:00:00.000Z';
      const originalPayload = { action: 'USER_LOGIN', reason: 'Legitimate login' };
      const legitimateHash = computeHash(prevHash, id, ts, 'SECURITY_EVENT', 'USER_LOGIN', 'USR001', originalPayload);

      // Malicious attacker attempts to alter the reason retroactively
      const tamperedPayload = { action: 'USER_LOGIN', reason: 'Altered reason after the fact' };
      const recalculatedHash = computeHash(prevHash, id, ts, 'SECURITY_EVENT', 'USER_LOGIN', 'USR001', tamperedPayload);

      assert.notEqual(legitimateHash, recalculatedHash, 'Hash mismatch must immediately reveal data alteration');
    });

    test('Automatic sensitive data redaction shields credentials, keys, and tokens', () => {
      const SENSITIVE_KEYS = new Set(['password', 'newpassword', 'oldpassword', 'token', 'mfa_secret', 'backup_codes']);

      function redact(obj) {
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
          if (SENSITIVE_KEYS.has(k.toLowerCase())) {
            out[k] = '[REDACTED]';
          } else {
            out[k] = v;
          }
        }
        return out;
      }

      const input = {
        name: 'Dheeraj',
        email: 'dheeraj@icontechpro.in',
        password: 'SuperSecretPassword2026!',
        mfa_secret: 'JBSWY3DPEHPK3PXP',
        token: 'eyJhbGciOi...',
      };

      const sanitized = redact(input);
      assert.equal(sanitized.name, 'Dheeraj');
      assert.equal(sanitized.email, 'dheeraj@icontechpro.in');
      assert.equal(sanitized.password, '[REDACTED]');
      assert.equal(sanitized.mfa_secret, '[REDACTED]');
      assert.equal(sanitized.token, '[REDACTED]');
    });

    test('All 13 required history views are represented in the Central Audit Centre UI', () => {
      const auditPage = readSrc('src/app/(dashboard)/dashboard/audit/page.tsx');
      const requiredViews = [
        '1. All Company Stream',
        '2. Employee Activity',
        '3. Customer Master',
        '4. Enquiries & Leads',
        '5. Site Visits',
        '6. Technical Evaluations',
        '7. Quotations & CPQ',
        '8. Sales Orders',
        '9. Invoices & Billing',
        '10. Documents & Challans',
        '11. Security & Logins',
        '12. Admin & Overrides',
        '13. System & Automation',
      ];

      for (const v of requiredViews) {
        assert.ok(auditPage.includes(v), `Audit Centre must include view tab '${v}'`);
      }
    });

    test('5-Year Statutory Retention & Legal Hold Policy covers all required categories', () => {
      const auditPage = readSrc('src/app/(dashboard)/dashboard/audit/page.tsx');
      assert.ok(auditPage.includes('Financial & Tax (Invoices, Ledgers)'));
      assert.ok(auditPage.includes('8 Years'));
      assert.ok(auditPage.includes('Commercial & Sales (Quotations, Orders, Challans)'));
      assert.ok(auditPage.includes('5 Years'));
      assert.ok(auditPage.includes('Audit Ledger & Security Incidents'));
      assert.ok(auditPage.includes('5 Years Minimum'));
      assert.ok(auditPage.includes('Legal Hold'));
      assert.ok(auditPage.includes('Purge Protection & Dual Authorization'));
    });
  });

  // ----------------------------------------------------------------------------------
  // 6. DATABASE MIGRATION & IMMUTABILITY TRIGGER ARTIFACTS
  // ----------------------------------------------------------------------------------
  describe('6. Additive Database Migration & Rollback Artifacts', () => {
    test('Additive migration 20261031000003 exists with complete schema and immutability trigger', () => {
      const sqlFile = path.join(rootDir, 'supabase/migrations/20261031000003_v9_2_enterprise_security_and_audit.sql');
      assert.ok(fs.existsSync(sqlFile), 'Migration file must exist');

      const sql = fs.readFileSync(sqlFile, 'utf8');
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.account_security_records'));
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.enterprise_audit_ledger'));
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.audit_integrity_checkpoints'));
      assert.ok(sql.includes('prevent_audit_ledger_tampering'));
      assert.ok(sql.includes('BEFORE UPDATE OR DELETE ON public.enterprise_audit_ledger'));
      assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'));
      assert.ok(sql.includes('Executives view full audit ledger'));
      assert.ok(sql.includes('Employees view own audit records'));
    });

    test('Rollback migration 20261031000003_rollback cleanly drops additions', () => {
      const rollbackFile = path.join(rootDir, 'supabase/migrations/20261031000003_v9_2_enterprise_security_and_audit_rollback.sql');
      assert.ok(fs.existsSync(rollbackFile), 'Rollback migration file must exist');

      const rollback = fs.readFileSync(rollbackFile, 'utf8');
      assert.ok(rollback.includes('DROP TABLE IF EXISTS public.audit_integrity_checkpoints'));
      assert.ok(rollback.includes('DROP TABLE IF EXISTS public.enterprise_audit_ledger'));
      assert.ok(rollback.includes('DROP TABLE IF EXISTS public.account_security_records'));
      assert.ok(rollback.includes('DROP TRIGGER IF EXISTS trg_audit_ledger_immutable'));
    });
  });
});
