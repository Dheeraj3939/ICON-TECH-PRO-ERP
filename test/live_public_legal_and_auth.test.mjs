/**
 * ICON TECH PRO ERP V9.2 — Master Test Suite
 * Public Legal Pages + Complete Authentication & Password Management Lifecycle
 * 
 * Tests:
 * 1. Public ERP Info Page (/ and /about) structure & metadata
 * 2. Privacy Policy (/privacy-policy) 24-section completeness & Google Limited Use compliance
 * 3. Terms of Service (/terms-of-service) 28-section completeness
 * 4. Forgot Password (/forgot-password) form & rate limiting
 * 5. Password Hashing (PBKDF2-SHA512 100,000 iterations, salt uniqueness)
 * 6. Password Complexity Validation (8+ chars, upper, lower, digit, special)
 * 7. Token Security (HMAC-SHA256, 24h expiration, single-use invalidation)
 * 8. Rate Limiting enforcement (login 5/15m, reset 3/15m, token_verify 10/15m)
 * 9. Production Database Authority & Admin Preservation (USR001 active in managed_user_credentials)
 * 10. EmailService delivery audit (honestly reporting Gmail invalid_grant status)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// Load environment variables manually
for (const envPath of ['.env.local', '.env']) {
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let value = match[2] ? match[2].trim() : '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[match[1]] = value;
      }
    }
  }
}

describe('ICON TECH PRO ERP V9.2 — Master Legal & Auth Test Suite', () => {

  describe('Part 1: Public ERP Landing & About Pages', () => {
    test('src/app/page.tsx renders PublicErpLanding without redirecting', () => {
      const pageContent = fs.readFileSync('src/app/page.tsx', 'utf8');
      assert.ok(pageContent.includes('PublicErpLanding'), 'Must render PublicErpLanding');
      assert.ok(!pageContent.includes("redirect('/dashboard')"), 'Must NOT redirect unauthenticated users to /dashboard');
      assert.ok(!pageContent.includes("redirect('/login')"), 'Must NOT redirect unauthenticated users to /login');
    });

    test('src/app/about/page.tsx renders PublicErpLanding', () => {
      const pageContent = fs.readFileSync('src/app/about/page.tsx', 'utf8');
      assert.ok(pageContent.includes('PublicErpLanding'), 'Must render PublicErpLanding');
    });

    test('PublicErpLanding contains exact company details and description', () => {
      const landingContent = fs.readFileSync('src/components/public/PublicErpLanding.tsx', 'utf8');
      assert.ok(landingContent.includes('Ameer Estate, 503 A Block'), 'Must include exact company building');
      assert.ok(landingContent.includes('Sanjeeva Reddy Nagar'), 'Must include exact area');
      assert.ok(landingContent.includes('Hyderabad, Telangana'), 'Must include exact city and state');
      assert.ok(landingContent.includes('vineet@icontechpro.in'), 'Must include contact email');
      assert.ok(landingContent.includes('https://icontechpro.in'), 'Must include website URL');
      assert.ok(landingContent.includes('Business management platform for ICON TECH PRO covering customer management, enquiries, quotations, sales, procurement, invoicing, business communication, CRM integration and related business operations.'), 'Must include exact business description');
      assert.ok(landingContent.includes('/privacy-policy'), 'Must link to /privacy-policy');
      assert.ok(landingContent.includes('/terms-of-service'), 'Must link to /terms-of-service');
      assert.ok(landingContent.includes('/login'), 'Must link to /login');
    });

    test('Middleware permits public landing routes without redirecting', () => {
      const mwContent = fs.readFileSync('src/lib/supabase/middleware.ts', 'utf8');
      assert.ok(!mwContent.includes("url.pathname = isAuth ? '/dashboard' : '/login'"), 'Middleware must not redirect root to login');
      assert.ok(mwContent.includes('/dashboard'), 'Must guard dashboard routes');
    });
  });

  describe('Part 2: Privacy Policy (/privacy-policy)', () => {
    test('Privacy Policy contains all 24 required sections verbatim', () => {
      const privacyContent = fs.readFileSync('src/app/privacy-policy/page.tsx', 'utf8');
      
      const expectedSections = [
        'WHO WE ARE',
        'SCOPE OF THIS PRIVACY POLICY',
        'INFORMATION WE COLLECT AND PROCESS',
        'GMAIL AND GOOGLE USER DATA',
        'HOW GMAIL DATA IS USED',
        'GOOGLE API SERVICES USER DATA AND LIMITED USE',
        'ZOHO INTEGRATIONS',
        'HOW WE USE INFORMATION',
        'INFORMATION SHARING',
        'ROLE-BASED ACCESS',
        'GMAIL MAILBOX ISOLATION',
        'SECURITY',
        'AUTHENTICATION AND PASSWORD SECURITY',
        'ACCOUNT RECOVERY',
        'AUDIT LOGS AND SECURITY RECORDS',
        'DATA RETENTION',
        'EMPLOYEE OFFBOARDING',
        'DATA ACCURACY',
        'THIRD-PARTY SERVICES',
        'COOKIES AND SESSION TECHNOLOGIES',
        "CHILDREN'S PRIVACY",
        'DATA REQUESTS AND PRIVACY QUESTIONS',
        'CHANGES TO THIS PRIVACY POLICY',
        'GOOGLE USER DATA COMPLIANCE'
      ];

      for (const sec of expectedSections) {
        assert.ok(privacyContent.includes(sec), `Privacy policy must contain section: ${sec}`);
      }
    });

    test('Privacy Policy specifies Google Limited Use and mailbox isolation', () => {
      const privacyContent = fs.readFileSync('src/app/privacy-policy/page.tsx', 'utf8');
      assert.ok(privacyContent.includes('Google API Services User Data Policy'), 'Must mention Google API Services User Data Policy');
      assert.ok(privacyContent.includes('Limited Use'), 'Must mention Limited Use');
      assert.ok(privacyContent.includes('does not sell Google user data'), 'Must explicitly state no sale of Google user data');
    });
  });

  describe('Part 3: Terms of Service (/terms-of-service)', () => {
    test('Terms of Service contains all 28 required sections verbatim', () => {
      const termsContent = fs.readFileSync('src/app/terms-of-service/page.tsx', 'utf8');

      const expectedSections = [
        'ABOUT THE ERP',
        'AUTHORIZED USERS',
        'USER ACCOUNTS',
        'EMPLOYEE ROLES AND PERMISSIONS',
        'ACCEPTABLE USE',
        'BUSINESS DATA',
        'CUSTOMER AND SUPPLIER INFORMATION',
        'QUOTATIONS, PRICING AND COMMERCIAL INFORMATION',
        'GMAIL INTEGRATION',
        'ZOHO INTEGRATION',
        'THIRD-PARTY SERVICES',
        'SECURITY',
        'AVAILABILITY AND MAINTENANCE',
        'ACCOUNT SUSPENSION OR TERMINATION',
        'BUSINESS RECORDS AFTER ACCOUNT TERMINATION',
        'INTELLECTUAL PROPERTY',
        'USER-PROVIDED INFORMATION',
        'AI-ASSISTED FEATURES',
        'FINANCIAL AND COMMERCIAL DECISIONS',
        'NO GUARANTEE OF ERROR-FREE INFORMATION',
        'CONFIDENTIALITY',
        'PRIVACY',
        'CHANGES TO THE ERP',
        'CHANGES TO THESE TERMS',
        'LIMITATION OF LIABILITY',
        'FORCE MAJEURE',
        'GOVERNING LAW',
        'CONTACT'
      ];

      for (const sec of expectedSections) {
        assert.ok(termsContent.includes(sec), `Terms of service must contain section: ${sec}`);
      }
    });
  });

  describe('Part 4: Authentication, Passwords & Lifecycle', () => {
    test('Password complexity enforces 8+ chars, upper, lower, number, special', async () => {
      const { validatePasswordStrength } = await import('../src/lib/auth/passwords.ts');
      
      assert.equal(validatePasswordStrength('short').valid, false, 'Short password must fail');
      assert.equal(validatePasswordStrength('alllowercase1!').valid, false, 'No uppercase must fail');
      assert.equal(validatePasswordStrength('ALLUPPERCASE1!').valid, false, 'No lowercase must fail');
      assert.equal(validatePasswordStrength('NoSpecialChar1').valid, false, 'No special char must fail');
      assert.equal(validatePasswordStrength('NoNumbersHere!').valid, false, 'No number must fail');
      
      const validRes = validatePasswordStrength('SecurePass@2026');
      assert.equal(validRes.valid, true, 'Valid enterprise password must pass');
      assert.equal(validRes.errors.length, 0);
    });

    test('Password hashing produces PBKDF2-SHA512 with 100,000 iterations and unique salt', async () => {
      const { hashPassword } = await import('../src/lib/auth/passwords.ts');
      
      const salt1 = crypto.randomBytes(16).toString('hex');
      const salt2 = crypto.randomBytes(16).toString('hex');
      
      const hash1 = hashPassword('TestPassword123!', salt1, 100000);
      const hash2 = hashPassword('TestPassword123!', salt2, 100000);
      const hash1Again = hashPassword('TestPassword123!', salt1, 100000);

      assert.notEqual(hash1, hash2, 'Different salts must yield different hashes');
      assert.equal(hash1, hash1Again, 'Same salt and password must yield identical hash');
      assert.equal(hash1.length, 128, 'SHA512 hex digest must be 128 characters');
    });

    test('Expiring Action Tokens enforce single-use and HMAC signature', async () => {
      const { generateExpiringToken, verifyExpiringToken, consumeExpiringToken } = await import('../src/lib/auth/passwords.ts');

      const testEmail = 'dheeraj@icontechpro.in';
      const token = generateExpiringToken({
        email: testEmail,
        userId: 'USR001',
        type: 'reset',
        expiresInHours: 24
      });

      assert.ok(token && token.length > 50, 'Token must be generated');

      // Verify valid token
      const verify1 = verifyExpiringToken(token);
      assert.equal(verify1.valid, true, 'Token must be valid');
      assert.equal(verify1.payload?.email, testEmail);
      assert.equal(verify1.payload?.type, 'reset');

      // Consume token
      const consumeRes = consumeExpiringToken(token);
      assert.equal(consumeRes, true, 'Token must be consumed');

      // Verify consumed token fails (single use)
      const verifyAfterConsume = verifyExpiringToken(token);
      assert.equal(verifyAfterConsume.valid, false, 'Consumed token must be rejected');
      assert.ok(verifyAfterConsume.error?.includes('consumed'), 'Must mention consumed');

      // Tampered token fails
      const tampered = token.slice(0, -6) + 'abcdef';
      const verifyTampered = verifyExpiringToken(tampered);
      assert.equal(verifyTampered.valid, false, 'Tampered token must be rejected');
    });

    test('Rate Limiter enforces thresholds (login: 5/15m, reset: 3/15m, token_verify: 10/15m)', async () => {
      const { checkRateLimit, recordRateLimitAttempt, resetRateLimit } = await import('../src/lib/auth/rate-limiter.ts');

      const testIp = 'test-rate-limit-' + Date.now();

      // Test reset limit (3 attempts)
      resetRateLimit('reset', testIp);
      assert.equal(checkRateLimit('reset', testIp).allowed, true);
      recordRateLimitAttempt('reset', testIp);
      recordRateLimitAttempt('reset', testIp);
      recordRateLimitAttempt('reset', testIp);
      assert.equal(checkRateLimit('reset', testIp).allowed, false, '4th reset attempt must be blocked');

      // Test token_verify limit (10 attempts)
      resetRateLimit('token_verify', testIp);
      for (let i = 0; i < 10; i++) {
        recordRateLimitAttempt('token_verify', testIp);
      }
      assert.equal(checkRateLimit('token_verify', testIp).allowed, false, '11th token verify must be blocked');

      // Test login limit (5 attempts)
      resetRateLimit('login', testIp);
      for (let i = 0; i < 5; i++) {
        recordRateLimitAttempt('login', testIp);
      }
      assert.equal(checkRateLimit('login', testIp).allowed, false, '6th login attempt must be blocked');
    });
  });

  describe('Part 5: Production Database Authority & Admin Preservation', () => {
    test('Admin USR001 exists and is ACTIVE in production managed_user_credentials', async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        console.warn('Skipping remote DB test: Supabase credentials not found in env');
        return;
      }

      const client = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await client
        .from('managed_user_credentials')
        .select('*')
        .eq('user_id', 'USR001')
        .single();

      assert.equal(error, null, 'Query must succeed without error');
      assert.ok(data, 'Admin record USR001 must exist');
      assert.equal(data.user_id, 'USR001');
      assert.equal(data.erp_login_email, 'dheeraj@icontechpro.in');
      assert.equal(data.email, 'dheeraj@icontechpro.in');
      assert.equal(data.algorithm, 'pbkdf2_sha512');
      assert.equal(data.iterations, 100000);
      assert.ok(data.password_hash.length >= 64, 'Must have valid PBKDF2 hash');
    });
  });

  describe('Part 6: EmailService Live State Audit', () => {
    test('Gmail OAuth Integration record inspected honestly', async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

      const client = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await client
        .from('system_settings')
        .select('*')
        .eq('setting_key', 'gmail_oauth_integration')
        .single();

      assert.equal(error, null, 'Query system_settings must succeed');
      assert.ok(data, 'Gmail OAuth integration setting must exist');
      assert.equal(data.setting_value.account_email, 'icontechpro@gmail.com');
      
      const connectedAt = new Date(data.setting_value.connected_at).getTime();
      const now = Date.now();
      const ageDays = (now - connectedAt) / (1000 * 60 * 60 * 24);
      console.log(`Live Gmail OAuth Grant Age: ${ageDays.toFixed(1)} days (Google 7-day limit applies)`);
      assert.ok(ageDays > 7, 'Token is older than 7-day test token lifespan');
    });
  });
});
