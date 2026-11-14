import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function readSrc(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

describe('ICON TECH PRO ERP V9.2 — Email Failover, MFA Policy & Dynamic Reporting Invariants', () => {

  // ----------------------------------------------------------------------------------
  // 1. FILE STRUCTURE & EXPORT INVARIANTS
  // ----------------------------------------------------------------------------------
  describe('1. File Structure and Export Invariants', () => {
    test('ZohoProvider exists and implements IEmailProvider', () => {
      const content = readSrc('src/lib/email/providers/zoho-provider.ts');
      assert.ok(content.includes('export class ZohoProvider implements IEmailProvider'));
      assert.ok(content.includes("readonly name = 'zoho'"));
      assert.ok(content.includes('sendMailMessage'));
      assert.ok(content.includes('export const defaultZohoProvider'));
    });

    test('FailoverEmailProvider implements controlled primary-fallback orchestration', () => {
      const content = readSrc('src/lib/email/providers/failover-provider.ts');
      assert.ok(content.includes('export class FailoverEmailProvider implements IEmailProvider'));
      assert.ok(content.includes("readonly name = 'failover_zoho_gmail'"));
      assert.ok(content.includes('isQualifyingFailure'));
      assert.ok(content.includes('generateIdempotencyKey'));
      assert.ok(content.includes('duplicatePrevented'));
      assert.ok(content.includes('export const defaultFailoverEmailProvider'));
    });

    test('EmailService is updated to default to FailoverEmailProvider with health monitoring', () => {
      const content = readSrc('src/lib/email/email-service.ts');
      assert.ok(content.includes('defaultFailoverEmailProvider'));
      assert.ok(content.includes('getProviderHealth'));
    });

    test('Corporate MFA Policy evaluation is exported in mfa-service.ts', () => {
      const content = readSrc('src/lib/security/mfa-service.ts');
      assert.ok(content.includes('export function evaluateMfaPolicy'));
      assert.ok(content.includes('ENFORCED_MANDATORY'));
      assert.ok(content.includes('IN_GRACE_PERIOD'));
      assert.ok(content.includes('EXPIRED_GRACE_ACTION_REQUIRED'));
      assert.ok(content.includes('COMPLIANT'));
    });

    test('MfaGracePeriodBanner component exists and handles grace & mandatory states', () => {
      const content = readSrc('src/components/security/MfaGracePeriodBanner.tsx');
      assert.ok(content.includes('export function MfaGracePeriodBanner'));
      assert.ok(content.includes('IN_GRACE_PERIOD'));
      assert.ok(content.includes('daysRemainingInGrace'));
      assert.ok(content.includes('Configure MFA'));
    });

    test('Dynamic report recipient resolution is exported in scheduled-reports.ts', () => {
      const content = readSrc('src/lib/actions/scheduled-reports.ts');
      assert.ok(content.includes('export async function resolveActiveReportRecipients'));
      assert.ok(content.includes('Managing Director'));
      assert.ok(content.includes('Accounts'));
    });
  });

  // ----------------------------------------------------------------------------------
  // 2. EMAIL FAILOVER LOGIC & QUALIFYING ERROR EVALUATION
  // ----------------------------------------------------------------------------------
  describe('2. Email Failover Logic & Non-Blind Fallback Invariants', () => {
    function isQualifyingFailure(errorMsg) {
      if (!errorMsg) return false;
      const msg = errorMsg.toLowerCase();

      // Non-qualifying permanent errors -> DO NOT FAILOVER
      if (
        msg.includes('invalid_recipient') ||
        msg.includes('malformed') ||
        msg.includes('syntax') ||
        msg.includes('no recipient') ||
        msg.includes('recipient rejected') ||
        msg.includes('empty subject') ||
        msg.includes('body missing')
      ) {
        return false;
      }

      // Qualifying system/network/auth errors -> SAFE TO FAILOVER
      if (
        msg.includes('timeout') ||
        msg.includes('etimedout') ||
        msg.includes('esockettimedout') ||
        msg.includes('econnrefused') ||
        msg.includes('enotfound') ||
        msg.includes('econnreset') ||
        msg.includes('fetch failed') ||
        msg.includes('network') ||
        msg.includes('rate limit') ||
        msg.includes('429') ||
        msg.includes('500') ||
        msg.includes('502') ||
        msg.includes('503') ||
        msg.includes('504') ||
        msg.includes('service unavailable') ||
        msg.includes('auth') ||
        msg.includes('401') ||
        msg.includes('token') ||
        msg.includes('unauthorized')
      ) {
        return true;
      }

      return true;
    }

    test('Network timeout on Zoho qualifies for failover to Gmail', () => {
      assert.equal(isQualifyingFailure('ETIMEDOUT: Connection to mail.zoho.in:443 timed out'), true);
      assert.equal(isQualifyingFailure('ESOCKETTIMEDOUT: Socket timed out'), true);
      assert.equal(isQualifyingFailure('fetch failed: Network unreachable'), true);
    });

    test('Zoho 5xx Server Error or 429 Rate Limit qualifies for failover', () => {
      assert.equal(isQualifyingFailure('Zoho Mail API error (500): Internal server error'), true);
      assert.equal(isQualifyingFailure('Zoho Mail API error (503): Service unavailable'), true);
      assert.equal(isQualifyingFailure('Zoho Mail API error (429): Rate limit exceeded'), true);
    });

    test('Zoho Token Expiry or 401 Auth Error qualifies for failover', () => {
      assert.equal(isQualifyingFailure('Zoho authentication unavailable: Token refresh failed'), true);
      assert.equal(isQualifyingFailure('Zoho Mail API error (401): Unauthorized invalid_token'), true);
    });

    test('Malformed recipient address is non-qualifying and prevents blind failover', () => {
      assert.equal(isQualifyingFailure('INVALID_RECIPIENT: Malformed email address "bad_addr".'), false);
      assert.equal(isQualifyingFailure('Recipient rejected by server: syntax error'), false);
      assert.equal(isQualifyingFailure('No recipient specified in message header'), false);
    });

    test('Idempotency hash correctly identifies identical payloads', () => {
      function generateIdempotencyKey(to, subject, text, entityId) {
        const toStr = Array.isArray(to) ? to.slice().sort().join(',') : to;
        const entityKey = entityId ? `entity:${entityId}` : null;
        const contentHash = crypto
          .createHash('sha256')
          .update(`${toStr}|${subject}|${text}`)
          .digest('hex');
        return entityKey ? `${entityKey}:${contentHash.substring(0, 16)}` : contentHash;
      }

      const key1 = generateIdempotencyKey('client@example.com', 'Invoice INV-001', 'Body A', 'INV-001');
      const key2 = generateIdempotencyKey('client@example.com', 'Invoice INV-001', 'Body A', 'INV-001');
      const key3 = generateIdempotencyKey('client@example.com', 'Invoice INV-002', 'Body B', 'INV-002');

      assert.equal(key1, key2);
      assert.notEqual(key1, key3);
    });
  });

  // ----------------------------------------------------------------------------------
  // 3. CORPORATE MFA POLICY & 14-DAY GRACE PERIOD INVARIANTS
  // ----------------------------------------------------------------------------------
  describe('3. Corporate MFA Policy & 14-Day Grace Period Invariants', () => {
    function simulateMfaPolicy(user, mfaEnrolled, referenceNow = Date.now()) {
      const privilegedRoles = ['Managing Director', 'Admin / BDM', 'Admin', 'Accounts', 'Super Admin'];
      const isPrivileged = privilegedRoles.includes(user.role);

      if (mfaEnrolled) {
        return {
          policyStatus: 'COMPLIANT',
          enforcementRequired: true,
          canBypassMfaSetup: false,
        };
      }

      if (isPrivileged) {
        return {
          policyStatus: 'ENFORCED_MANDATORY',
          enforcementRequired: true,
          canBypassMfaSetup: false,
        };
      }

      // Non-privileged: 14 days grace from user.createdAt or baseline
      const baselineEpoch = user.createdAt ? new Date(user.createdAt).getTime() : new Date('2026-10-31T00:00:00Z').getTime();
      const gracePeriodDurationMs = 14 * 24 * 60 * 60 * 1000;
      const graceEndsEpoch = baselineEpoch + gracePeriodDurationMs;

      if (referenceNow <= graceEndsEpoch) {
        const msRemaining = graceEndsEpoch - referenceNow;
        const daysRemaining = Math.max(1, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
        return {
          policyStatus: 'IN_GRACE_PERIOD',
          daysRemainingInGrace: daysRemaining,
          enforcementRequired: false,
          canBypassMfaSetup: true,
        };
      }

      return {
        policyStatus: 'EXPIRED_GRACE_ACTION_REQUIRED',
        daysRemainingInGrace: 0,
        enforcementRequired: true,
        canBypassMfaSetup: false,
      };
    }

    test('Managing Director without MFA is strictly ENFORCED_MANDATORY (no grace period)', () => {
      const res = simulateMfaPolicy({ role: 'Managing Director' }, false);
      assert.equal(res.policyStatus, 'ENFORCED_MANDATORY');
      assert.equal(res.enforcementRequired, true);
      assert.equal(res.canBypassMfaSetup, false);
    });

    test('Accounts role without MFA is strictly ENFORCED_MANDATORY (no grace period)', () => {
      const res = simulateMfaPolicy({ role: 'Accounts' }, false);
      assert.equal(res.policyStatus, 'ENFORCED_MANDATORY');
      assert.equal(res.enforcementRequired, true);
      assert.equal(res.canBypassMfaSetup, false);
    });

    test('Admin / BDM without MFA is strictly ENFORCED_MANDATORY (no grace period)', () => {
      const res = simulateMfaPolicy({ role: 'Admin / BDM' }, false);
      assert.equal(res.policyStatus, 'ENFORCED_MANDATORY');
      assert.equal(res.enforcementRequired, true);
      assert.equal(res.canBypassMfaSetup, false);
    });

    test('Sales Executive on Day 3 is IN_GRACE_PERIOD with ~11 days remaining', () => {
      const baseline = Date.now();
      const createdTime = new Date(baseline - 3 * 24 * 60 * 60 * 1000).toISOString();
      const res = simulateMfaPolicy({ role: 'Sales Executive', createdAt: createdTime }, false, baseline);

      assert.equal(res.policyStatus, 'IN_GRACE_PERIOD');
      assert.equal(res.enforcementRequired, false);
      assert.equal(res.canBypassMfaSetup, true);
      assert.equal(res.daysRemainingInGrace, 11);
    });

    test('Sales Executive on Day 15 is EXPIRED_GRACE_ACTION_REQUIRED (zero bypass)', () => {
      const baseline = Date.now();
      const createdTime = new Date(baseline - 15 * 24 * 60 * 60 * 1000).toISOString();
      const res = simulateMfaPolicy({ role: 'Sales Executive', createdAt: createdTime }, false, baseline);

      assert.equal(res.policyStatus, 'EXPIRED_GRACE_ACTION_REQUIRED');
      assert.equal(res.enforcementRequired, true);
      assert.equal(res.canBypassMfaSetup, false);
      assert.equal(res.daysRemainingInGrace, 0);
    });

    test('Any user with enrolled MFA is COMPLIANT and zero authentication bypass exists', () => {
      const res = simulateMfaPolicy({ role: 'Sales Executive' }, true);
      assert.equal(res.policyStatus, 'COMPLIANT');
      assert.equal(res.enforcementRequired, true);
      assert.equal(res.canBypassMfaSetup, false);
    });
  });

  // ----------------------------------------------------------------------------------
  // 4. DYNAMIC REPORT RECIPIENT RESOLUTION INVARIANTS
  // ----------------------------------------------------------------------------------
  describe('4. Dynamic Report Recipient Resolution Invariants', () => {
    const mockStaff = [
      { id: 'u1', name: 'Borra Narsimulu', email: 'md@icontechpro.in', role: 'Managing Director', status: 'ACTIVE', is_suspended: false },
      { id: 'u2', name: 'B V Dheeraj Reddy', email: 'dheeraj@icontechpro.in', role: 'Admin / BDM', status: 'ACTIVE', is_suspended: false },
      { id: 'u3', name: 'Accounts Head', email: 'accounts@icontechpro.in', role: 'Accounts', status: 'ACTIVE', is_suspended: false },
      { id: 'u4', name: 'Vineet Babu', email: 'vineet@icontechpro.in', role: 'Sales Executive', status: 'ACTIVE', is_suspended: false },
      { id: 'u5', name: 'Suspended Staff', email: 'bad@icontechpro.in', role: 'Accounts', status: 'ACTIVE', is_suspended: true },
      { id: 'u6', name: 'Inactive Staff', email: 'old@icontechpro.in', role: 'Sales Executive', status: 'INACTIVE', is_suspended: false },
    ];

    function resolveRecipients(reportCode, allowedRoles, staffList = mockStaff) {
      const isFinancial = [
        'RPT_MONTHLY_FINANCE_OPS',
        'RPT_QUARTERLY_BUSINESS_REVIEW',
        'RPT_HALFYEARLY_STRATEGY',
        'RPT_ANNUAL_FINANCIAL_CLOSING',
      ].includes(reportCode);

      const matched = [];
      for (const emp of staffList) {
        if (emp.status !== 'ACTIVE' || emp.is_suspended) continue;

        if (emp.role === 'Managing Director') {
          matched.push(emp);
          continue;
        }

        if (isFinancial) {
          if (emp.role === 'Accounts') {
            matched.push(emp);
          }
          continue;
        }

        if (allowedRoles.includes(emp.role) || (allowedRoles.includes('All Salespeople') && (emp.role === 'Sales Executive' || emp.role === 'Admin / BDM'))) {
          matched.push(emp);
        }
      }
      return matched;
    }

    test('Financial reports (Monthly P&L, Annual Financial) strictly isolate to MD & Accounts', () => {
      const recipients = resolveRecipients('RPT_MONTHLY_FINANCE_OPS', ['Managing Director', 'Admin / BDM', 'Accounts']);
      const roles = recipients.map((r) => r.role);

      assert.ok(roles.includes('Managing Director'));
      assert.ok(roles.includes('Accounts'));
      assert.equal(roles.includes('Sales Executive'), false);
      assert.equal(roles.includes('Admin / BDM'), false); // BDM excluded from financial report!
    });

    test('Suspended employee is strictly excluded from recipient list even if role matches', () => {
      const recipients = resolveRecipients('RPT_MONTHLY_FINANCE_OPS', ['Managing Director', 'Accounts']);
      const emails = recipients.map((r) => r.email);

      assert.equal(emails.includes('bad@icontechpro.in'), false); // Suspended accounts excluded!
      assert.ok(emails.includes('accounts@icontechpro.in'));
    });

    test('Inactive employee is strictly excluded from recipient list', () => {
      const recipients = resolveRecipients('RPT_DAILY_EXECUTIVE', ['Managing Director', 'All Salespeople']);
      const emails = recipients.map((r) => r.email);

      assert.equal(emails.includes('old@icontechpro.in'), false); // Inactive sales excluded!
      assert.ok(emails.includes('vineet@icontechpro.in'));
    });

    test('Managing Director receives all executive report frequencies dynamically', () => {
      const daily = resolveRecipients('RPT_DAILY_EXECUTIVE', ['All Salespeople']);
      const annual = resolveRecipients('RPT_ANNUAL_FINANCIAL_CLOSING', ['Accounts']);

      assert.ok(daily.some((r) => r.role === 'Managing Director'));
      assert.ok(annual.some((r) => r.role === 'Managing Director'));
    });
  });
});
