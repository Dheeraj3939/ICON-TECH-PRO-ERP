import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseEnvContent,
  validateUatEnv,
  resolveUatEnv,
  sanitizeDisplayUrl,
  UAT_PROJECT_ID,
  PROD_PROJECT_ID,
  CORE_REQUIRED_KEYS,
  CREDENTIAL_REQUIRED_KEYS,
} from '../scripts/uat-runner.mjs';

// =============================================================================
// ICON TECH PRO ERP V9.2 — STAGE 1B.2 FAIL-CLOSED UAT CONFIG VALIDATION SUITE
// =============================================================================

test('ICON TECH PRO ERP V9.2 — Stage 1B.2 Fail-Closed Validation Suite', async (t) => {
  const rootDir = path.resolve(__dirname, '..');
  const actualUatEnvPath = path.join(rootDir, '.env.uat.local');

  // ---------------------------------------------------------------------------
  // 1. Missing .env.uat.local File Triggers Fail-Closed Rejection
  // ---------------------------------------------------------------------------
  await t.test('1. resolveUatEnv halts immediately if .env.uat.local does not exist', () => {
    const nonExistentPath = path.join(rootDir, '.env.uat.nonexistent.local');
    assert.throws(
      () => resolveUatEnv({} as any, null, { envPath: nonExistentPath }),
      (err: any) => {
        assert.match(err.message, /\[UAT FATAL CONFIG ERROR\] UAT environment file not found/);
        return true;
      },
      'Must fail closed when UAT environment file is missing'
    );
  });

  // ---------------------------------------------------------------------------
  // 2. Empty or Whitespace-Only File Rejection
  // ---------------------------------------------------------------------------
  await t.test('2. resolveUatEnv halts if UAT configuration is empty or whitespace-only', () => {
    assert.throws(
      () => resolveUatEnv({} as any, '   \n# Only comments\n   \n', { requireCredentials: false }),
      (err: any) => {
        assert.match(err.message, /\[UAT FATAL CONFIG ERROR\] UAT environment file is empty/);
        return true;
      },
      'Must reject empty UAT environment file'
    );
  });

  // ---------------------------------------------------------------------------
  // 3. Syntax Validation: Rejection of Malformed .env Syntax
  // ---------------------------------------------------------------------------
  await t.test('3. parseEnvContent throws clear sanitized errors on malformed entries', () => {
    // Missing '='
    assert.throws(
      () => parseEnvContent('INVALID_LINE_WITHOUT_EQUALS'),
      (err: any) => {
        assert.match(err.message, /missing '='/);
        return true;
      }
    );

    // Invalid variable name (starts with digit)
    assert.throws(
      () => parseEnvContent('123_BAD_VARIABLE=test'),
      (err: any) => {
        assert.match(err.message, /invalid variable name/);
        return true;
      }
    );

    // Unclosed double quote
    assert.throws(
      () => parseEnvContent('FOO="unclosed quote string'),
      (err: any) => {
        assert.match(err.message, /unclosed quote/);
        return true;
      }
    );

    // Trailing content after quote
    assert.throws(
      () => parseEnvContent('FOO="valid" trailing_garbage'),
      (err: any) => {
        assert.match(err.message, /unexpected trailing content after quote/);
        return true;
      }
    );

    // Multiline parsing succeeds
    const multi = parseEnvContent('MULTI="line1\nline2"\nSINGLE=foo') as Record<string, string>;
    assert.equal(multi.MULTI, 'line1\nline2');
    assert.equal(multi.SINGLE, 'foo');
  });

  // ---------------------------------------------------------------------------
  // 4. Supabase Project ID Validation & Production Blockade
  // ---------------------------------------------------------------------------
  await t.test('4. validateUatEnv strictly validates UAT project ID and rejects production project ID', () => {
    // Production project ID must be unconditionally blocked
    assert.throws(
      () =>
        validateUatEnv({
          NEXT_PUBLIC_SUPABASE_URL: `https://${PROD_PROJECT_ID}.supabase.co`,
          NEXT_PUBLIC_ERP_ENV: 'UAT',
        }, { requireCredentials: false }),
      (err: any) => {
        assert.match(err.message, /targets the PRODUCTION Supabase project/);
        assert.match(err.message, new RegExp(PROD_PROJECT_ID));
        return true;
      },
      'Must reject production Supabase project ID'
    );

    // Unknown or untrusted project ID must be rejected
    assert.throws(
      () =>
        validateUatEnv({
          NEXT_PUBLIC_SUPABASE_URL: 'https://unauthorized-project.supabase.co',
          NEXT_PUBLIC_ERP_ENV: 'UAT',
        }, { requireCredentials: false }),
      (err: any) => {
        assert.match(err.message, /does not target the authorized UAT Supabase project/);
        assert.match(err.message, new RegExp(UAT_PROJECT_ID));
        return true;
      },
      'Must reject non-UAT Supabase project'
    );

    // Malformed URL must be rejected
    assert.throws(
      () =>
        validateUatEnv({
          NEXT_PUBLIC_SUPABASE_URL: 'not-a-valid-url',
          NEXT_PUBLIC_ERP_ENV: 'UAT',
        }, { requireCredentials: false }),
      (err: any) => {
        assert.match(err.message, /does not target the authorized UAT Supabase project|not a valid URL/);
        return true;
      }
    );

    // Valid UAT project ID must be accepted
    const valid = validateUatEnv({
      NEXT_PUBLIC_SUPABASE_URL: `https://${UAT_PROJECT_ID}.supabase.co`,
      NEXT_PUBLIC_ERP_ENV: 'UAT',
    }, { requireCredentials: false });
    assert.equal(valid, true);
  });

  // ---------------------------------------------------------------------------
  // 5. Mandatory Environment Keys Enforcement
  // ---------------------------------------------------------------------------
  await t.test('5. validateUatEnv enforces presence of all core and credential keys', () => {
    // Missing NEXT_PUBLIC_SUPABASE_URL
    assert.throws(
      () => validateUatEnv({ NEXT_PUBLIC_ERP_ENV: 'UAT' }, { requireCredentials: false }),
      /Missing required configuration key in environment: "NEXT_PUBLIC_SUPABASE_URL"/
    );

    // Invalid NEXT_PUBLIC_ERP_ENV (e.g. PRODUCTION)
    assert.throws(
      () =>
        validateUatEnv({
          NEXT_PUBLIC_SUPABASE_URL: `https://${UAT_PROJECT_ID}.supabase.co`,
          NEXT_PUBLIC_ERP_ENV: 'PRODUCTION',
        }, { requireCredentials: false }),
      /NEXT_PUBLIC_ERP_ENV must be "UAT"/
    );

    // Missing SUPABASE_SECRET_KEY when requireCredentials is true
    assert.throws(
      () =>
        validateUatEnv({
          NEXT_PUBLIC_SUPABASE_URL: `https://${UAT_PROJECT_ID}.supabase.co`,
          NEXT_PUBLIC_ERP_ENV: 'UAT',
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-pub-key-sample-12345',
          NEXT_PUBLIC_APP_URL: 'http://localhost:3001',
        }, { requireCredentials: true }),
      /Missing required credential key in environment: "SUPABASE_SECRET_KEY"/
    );

    // Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    assert.throws(
      () =>
        validateUatEnv({
          NEXT_PUBLIC_SUPABASE_URL: `https://${UAT_PROJECT_ID}.supabase.co`,
          NEXT_PUBLIC_ERP_ENV: 'UAT',
          SUPABASE_SECRET_KEY: 'test-secret-sample-12345',
          NEXT_PUBLIC_APP_URL: 'http://localhost:3001',
        }, { requireCredentials: true }),
      /Missing required credential key in environment: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"/
    );

    // Production domain in NEXT_PUBLIC_APP_URL
    assert.throws(
      () =>
        validateUatEnv({
          NEXT_PUBLIC_SUPABASE_URL: `https://${UAT_PROJECT_ID}.supabase.co`,
          NEXT_PUBLIC_ERP_ENV: 'UAT',
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-pub-key-sample-12345',
          SUPABASE_SECRET_KEY: 'test-secret-sample-12345',
          NEXT_PUBLIC_APP_URL: 'https://erp.icontechpro.in',
        }, { requireCredentials: true }),
      /NEXT_PUBLIC_APP_URL targets production domain/
    );
  });

  // ---------------------------------------------------------------------------
  // 6. Inherited Production Variable Bleed Prevention (Anti-Bleed)
  // ---------------------------------------------------------------------------
  await t.test('6. resolveUatEnv prevents inherited production variables from silently filling missing UAT config', () => {
    // Parent shell has production configuration
    const dangerousParentShell = {
      NEXT_PUBLIC_SUPABASE_URL: `https://${PROD_PROJECT_ID}.supabase.co`,
      SUPABASE_SECRET_KEY: 'prod-secret-must-never-leak',
      SUPABASE_SERVICE_ROLE_KEY: 'prod-service-role-must-never-leak',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'prod-pub-must-never-leak',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'prod-anon-must-never-leak',
      NEXT_PUBLIC_ERP_ENV: 'PRODUCTION',
      ERP_ENV: 'PRODUCTION',
      NEXT_PUBLIC_APP_URL: 'https://erp.icontechpro.in',
      COMPUTERNAME: 'PRESERVED-HOST',
    };

    // Scenario A: UAT file is missing NEXT_PUBLIC_SUPABASE_URL entirely
    const mockUatWithoutUrl = `
      NEXT_PUBLIC_ERP_ENV=UAT
      NEXT_PUBLIC_APP_URL=http://localhost:3001
      SUPABASE_SECRET_KEY=uat-secret-sample-12345
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=uat-pub-sample-12345
    `;

    assert.throws(
      () => resolveUatEnv(dangerousParentShell as any, mockUatWithoutUrl, { requireCredentials: true }),
      (err: any) => {
        // Must fail closed on file validation and NOT fall back to dangerousParentShell's URL!
        assert.match(err.message, /Missing required configuration key.*NEXT_PUBLIC_SUPABASE_URL/);
        return true;
      },
      'Must NOT fall back to parent shell production URL when missing in UAT file'
    );

    // Scenario B: UAT file is missing SUPABASE_SECRET_KEY
    const mockUatWithoutSecret = `
      NEXT_PUBLIC_SUPABASE_URL=https://${UAT_PROJECT_ID}.supabase.co
      NEXT_PUBLIC_ERP_ENV=UAT
      NEXT_PUBLIC_APP_URL=http://localhost:3001
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=uat-pub-sample-12345
    `;

    assert.throws(
      () => resolveUatEnv(dangerousParentShell as any, mockUatWithoutSecret, { requireCredentials: true }),
      (err: any) => {
        // Must fail closed and NOT adopt parent shell's production secret!
        assert.match(err.message, /Missing required credential key.*SUPABASE_SECRET_KEY/);
        return true;
      },
      'Must NOT fall back to parent shell production secret key'
    );

    // Scenario C: Valid UAT file correctly purges and overrides all production keys
    const validUatMock = `
      NEXT_PUBLIC_SUPABASE_URL=https://${UAT_PROJECT_ID}.supabase.co
      NEXT_PUBLIC_ERP_ENV=UAT
      NEXT_PUBLIC_APP_URL=http://localhost:3001
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=uat-pub-sample-12345
      SUPABASE_SECRET_KEY=uat-secret-sample-12345
    `;

    const resolved = resolveUatEnv(dangerousParentShell as any, validUatMock, { requireCredentials: true }) as Record<string, string>;

    assert.equal(resolved.NEXT_PUBLIC_SUPABASE_URL, `https://${UAT_PROJECT_ID}.supabase.co`);
    assert.equal(resolved.NEXT_PUBLIC_ERP_ENV, 'UAT');
    assert.equal(resolved.ERP_ENV, 'UAT');
    assert.equal(resolved.UAT_MODE, 'true');
    assert.equal(resolved.NEXT_PUBLIC_APP_URL, 'http://localhost:3001');
    assert.equal(resolved.SUPABASE_SECRET_KEY, 'uat-secret-sample-12345');
    assert.equal(resolved.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, 'uat-pub-sample-12345');
    // Mirroring checks
    assert.equal(resolved.SUPABASE_SERVICE_ROLE_KEY, 'uat-secret-sample-12345', 'Must mirror UAT secret, NOT parent prod key');
    assert.equal(resolved.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'uat-pub-sample-12345', 'Must mirror UAT pub key, NOT parent prod key');
    assert.equal(resolved.COMPUTERNAME, 'PRESERVED-HOST', 'Allowlisted system variables must be preserved');
  });

  // ---------------------------------------------------------------------------
  // 7. Sanitized Display URL Output
  // ---------------------------------------------------------------------------
  await t.test('7. sanitizeDisplayUrl never exposes paths, query parameters, or credentials', () => {
    const sanitized1 = sanitizeDisplayUrl('https://user:password@subdomain.example.com:8443/secret/path?token=12345');
    assert.equal(sanitized1, 'https://subdomain.example.com:8443');

    const sanitized2 = sanitizeDisplayUrl('https://njylssodwvaonbeebvjq.supabase.co');
    assert.equal(sanitized2, 'https://njylssodwvaonbeebvjq.supabase.co');

    const sanitized3 = sanitizeDisplayUrl('invalid-url-string');
    assert.equal(sanitized3, '[malformed-url]');
  });

  // ---------------------------------------------------------------------------
  // 8. Live Integration: Actual .env.uat.local Verification
  // ---------------------------------------------------------------------------
  await t.test('8. Live .env.uat.local passes full strict validation and isolates from production', () => {
    assert.ok(fs.existsSync(actualUatEnvPath), '.env.uat.local must exist in project root');

    // Run resolution on actual .env.uat.local
    const resolved = resolveUatEnv(process.env as any, null, { requireCredentials: true }) as Record<string, string>;

    assert.equal(resolved.NEXT_PUBLIC_ERP_ENV, 'UAT');
    assert.equal(resolved.ERP_ENV, 'UAT');
    assert.equal(resolved.UAT_MODE, 'true');
    assert.ok(resolved.NEXT_PUBLIC_SUPABASE_URL.includes(UAT_PROJECT_ID), 'Must contain UAT project ID');
    assert.ok(!resolved.NEXT_PUBLIC_SUPABASE_URL.includes(PROD_PROJECT_ID), 'Must NOT contain production project ID');
    assert.ok(typeof resolved.SUPABASE_SECRET_KEY === 'string' && resolved.SUPABASE_SECRET_KEY.length > 10);
    assert.ok(typeof resolved.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === 'string' && resolved.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.length > 10);
    assert.equal(resolved.NEXT_PUBLIC_APP_URL, 'http://localhost:3001');
    assert.equal(resolved.NEXT_PUBLIC_SITE_URL, 'http://localhost:3001');
  });
});
