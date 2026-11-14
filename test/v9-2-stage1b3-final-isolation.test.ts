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
  EXACT_UAT_SUPABASE_HOSTNAME,
  EXACT_PROD_SUPABASE_HOSTNAME,
  SYSTEM_ENV_ALLOWLIST,
  CORE_REQUIRED_KEYS,
  CREDENTIAL_REQUIRED_KEYS,
} from '../scripts/uat-runner.mjs';

// =============================================================================
// ICON TECH PRO ERP V9.2 — STAGE 1B.3 FINAL UAT ISOLATION AUDIT SUITE
// =============================================================================

test('ICON TECH PRO ERP V9.2 — Stage 1B.3 Final UAT Isolation Suite', async (t) => {
  const rootDir = path.resolve(__dirname, '..');
  const actualUatEnvPath = path.join(rootDir, '.env.uat.local');

  // ---------------------------------------------------------------------------
  // 1. Hostname Spoofing & Host Impersonation Blockade
  // ---------------------------------------------------------------------------
  await t.test('1. validateUatEnv strictly blocks hostname spoofing and host impersonation', () => {
    // 1A. Suffix subdomain spoofing (attacker control via public suffix)
    assert.throws(
      () =>
        validateUatEnv({
          NEXT_PUBLIC_SUPABASE_URL: `https://${EXACT_UAT_SUPABASE_HOSTNAME}.attacker.com`,
          NEXT_PUBLIC_ERP_ENV: 'UAT',
        }, { requireCredentials: false }),
      /does not match the exact authorized UAT Supabase host/
    );

    // 1B. Prefix subdomain spoofing
    assert.throws(
      () =>
        validateUatEnv({
          NEXT_PUBLIC_SUPABASE_URL: `https://rogue.${EXACT_UAT_SUPABASE_HOSTNAME}`,
          NEXT_PUBLIC_ERP_ENV: 'UAT',
        }, { requireCredentials: false }),
      /does not match the exact authorized UAT Supabase host/
    );

    // 1C. Query parameter spoofing
    assert.throws(
      () =>
        validateUatEnv({
          NEXT_PUBLIC_SUPABASE_URL: `https://attacker.org/?redirect=${EXACT_UAT_SUPABASE_HOSTNAME}`,
          NEXT_PUBLIC_ERP_ENV: 'UAT',
        }, { requireCredentials: false }),
      /does not match the exact authorized UAT Supabase host/
    );

    // 1D. Path spoofing
    assert.throws(
      () =>
        validateUatEnv({
          NEXT_PUBLIC_SUPABASE_URL: `https://attacker.org/${EXACT_UAT_SUPABASE_HOSTNAME}`,
          NEXT_PUBLIC_ERP_ENV: 'UAT',
        }, { requireCredentials: false }),
      /does not match the exact authorized UAT Supabase host/
    );

    // 1E. Userinfo spoofing
    assert.throws(
      () =>
        validateUatEnv({
          NEXT_PUBLIC_SUPABASE_URL: `https://${EXACT_UAT_SUPABASE_HOSTNAME}@attacker.org`,
          NEXT_PUBLIC_ERP_ENV: 'UAT',
        }, { requireCredentials: false }),
      /does not match the exact authorized UAT Supabase host/
    );

    // 1F. Non-standard port spoofing
    assert.throws(
      () =>
        validateUatEnv({
          NEXT_PUBLIC_SUPABASE_URL: `https://${EXACT_UAT_SUPABASE_HOSTNAME}:8443`,
          NEXT_PUBLIC_ERP_ENV: 'UAT',
        }, { requireCredentials: false }),
      /specifies unexpected non-standard port/
    );

    // 1G. Embedded credentials in valid host
    assert.throws(
      () =>
        validateUatEnv({
          NEXT_PUBLIC_SUPABASE_URL: `https://user:password@${EXACT_UAT_SUPABASE_HOSTNAME}`,
          NEXT_PUBLIC_ERP_ENV: 'UAT',
        }, { requireCredentials: false }),
      /must not contain embedded basic auth credentials/
    );

    // 1H. Production Host Rejection
    assert.throws(
      () =>
        validateUatEnv({
          NEXT_PUBLIC_SUPABASE_URL: `https://${EXACT_PROD_SUPABASE_HOSTNAME}`,
          NEXT_PUBLIC_ERP_ENV: 'UAT',
        }, { requireCredentials: false }),
      /targets the PRODUCTION Supabase project/
    );
  });

  // ---------------------------------------------------------------------------
  // 2. Protocol Validation: Strict HTTPS Enforcement
  // ---------------------------------------------------------------------------
  await t.test('2. validateUatEnv strictly enforces HTTPS protocol and rejects insecure schemes', () => {
    // Insecure HTTP
    assert.throws(
      () =>
        validateUatEnv({
          NEXT_PUBLIC_SUPABASE_URL: `http://${EXACT_UAT_SUPABASE_HOSTNAME}`,
          NEXT_PUBLIC_ERP_ENV: 'UAT',
        }, { requireCredentials: false }),
      /must use HTTPS protocol, received "http:"/
    );

    // FTP scheme
    assert.throws(
      () =>
        validateUatEnv({
          NEXT_PUBLIC_SUPABASE_URL: `ftp://${EXACT_UAT_SUPABASE_HOSTNAME}`,
          NEXT_PUBLIC_ERP_ENV: 'UAT',
        }, { requireCredentials: false }),
      /must use HTTPS protocol, received "ftp:"/
    );

    // WebSocket scheme
    assert.throws(
      () =>
        validateUatEnv({
          NEXT_PUBLIC_SUPABASE_URL: `ws://${EXACT_UAT_SUPABASE_HOSTNAME}`,
          NEXT_PUBLIC_ERP_ENV: 'UAT',
        }, { requireCredentials: false }),
      /must use HTTPS protocol, received "ws:"/
    );

    // Valid HTTPS
    const valid = validateUatEnv({
      NEXT_PUBLIC_SUPABASE_URL: `https://${EXACT_UAT_SUPABASE_HOSTNAME}`,
      NEXT_PUBLIC_ERP_ENV: 'UAT',
    }, { requireCredentials: false });
    assert.equal(valid, true);
  });

  // ---------------------------------------------------------------------------
  // 3. Child Environment Construction via Strict System Allowlist
  // ---------------------------------------------------------------------------
  await t.test('3. resolveUatEnv constructs child environment strictly from SYSTEM_ENV_ALLOWLIST and validated UAT values', () => {
    const parentEnvWithArbitrarySecrets = {
      PATH: 'C:\\Windows\\system32;C:\\Program Files\\nodejs',
      SYSTEMROOT: 'C:\\Windows',
      TEMP: 'C:\\Temp',
      USERPROFILE: 'C:\\Users\\Developer',
      COMPUTERNAME: 'DEV-WORKSTATION',
      npm_config_user_agent: 'npm/10.8.2 node/v24.0.0 win32 x64',
      // Arbitrary external secrets that must NEVER be inherited
      AWS_SECRET_ACCESS_KEY: 'AKIA_PROD_DANGEROUS_SECRET',
      STRIPE_SECRET_KEY: 'sk_live_9999999999999',
      GITHUB_TOKEN: 'ghp_arbitraryPersonalAccessToken',
      DATABASE_URL: 'postgres://production_admin:pass@db.icontechpro.in:5432/icon_erp',
      RANDOM_DEV_SECRET: 'do_not_leak_into_child',
      // Production app secrets
      SUPABASE_SECRET_KEY: 'prod-secret-must-not-leak',
      ZOHO_CLIENT_SECRET: 'prod-zoho-secret-must-not-leak',
      GOOGLE_CLIENT_SECRET: 'prod-google-secret-must-not-leak',
    };

    const mockUatConfig = `
      NEXT_PUBLIC_SUPABASE_URL=https://${EXACT_UAT_SUPABASE_HOSTNAME}
      NEXT_PUBLIC_ERP_ENV=UAT
      NEXT_PUBLIC_APP_URL=http://localhost:3001
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=uat-publishable-key-test-12345
      SUPABASE_SECRET_KEY=uat-secret-key-test-12345
      ZOHO_CLIENT_SECRET=uat-zoho-client-secret-54321
    `;

    const resolved = resolveUatEnv(parentEnvWithArbitrarySecrets as any, mockUatConfig, { requireCredentials: true }) as Record<string, string>;

    // A. Allowlisted system variables MUST be preserved
    assert.equal(resolved.PATH, parentEnvWithArbitrarySecrets.PATH);
    assert.equal(resolved.SYSTEMROOT, parentEnvWithArbitrarySecrets.SYSTEMROOT);
    assert.equal(resolved.TEMP, parentEnvWithArbitrarySecrets.TEMP);
    assert.equal(resolved.COMPUTERNAME, parentEnvWithArbitrarySecrets.COMPUTERNAME);
    assert.equal(resolved.npm_config_user_agent, undefined, 'Arbitrary npm_* variables must not be inherited');

    // B. Arbitrary external secrets MUST be completely absent
    assert.equal(resolved.AWS_SECRET_ACCESS_KEY, undefined, 'AWS secret must not be inherited');
    assert.equal(resolved.STRIPE_SECRET_KEY, undefined, 'Stripe secret must not be inherited');
    assert.equal(resolved.GITHUB_TOKEN, undefined, 'GitHub token must not be inherited');
    assert.equal(resolved.DATABASE_URL, undefined, 'Production database URL must not be inherited');
    assert.equal(resolved.RANDOM_DEV_SECRET, undefined, 'Random dev secrets must not be inherited');

    // C. Missing UAT integration secret (GOOGLE_CLIENT_SECRET) must NOT inherit parent value
    assert.equal(resolved.GOOGLE_CLIENT_SECRET, undefined, 'Missing UAT integration credential must NOT inherit production parent value');

    // D. Present UAT integration secret (ZOHO_CLIENT_SECRET) must use UAT value, not parent value
    assert.equal(resolved.ZOHO_CLIENT_SECRET, 'uat-zoho-client-secret-54321');

    // E. Supabase secrets must be UAT values
    assert.equal(resolved.SUPABASE_SECRET_KEY, 'uat-secret-key-test-12345');
    assert.equal(resolved.SUPABASE_SERVICE_ROLE_KEY, 'uat-secret-key-test-12345');
  });

  // ---------------------------------------------------------------------------
  // 4. Failed Validation Preempts Child-Process Launch
  // ---------------------------------------------------------------------------
  await t.test('4. resolveUatEnv throws before process spawn on invalid configuration', () => {
    // Test that validation failure synchronously throws and preempts spawn
    const invalidConfigs = [
      { content: 'NEXT_PUBLIC_SUPABASE_URL=http://insecure.url', reason: 'insecure protocol' },
      { content: 'NEXT_PUBLIC_SUPABASE_URL=https://xogynsnfzsvimwtvvhpx.supabase.co', reason: 'production URL' },
      { content: 'NEXT_PUBLIC_SUPABASE_URL=https://attacker.org', reason: 'wrong host' },
      { content: 'MALFORMED LINE NO EQUAL', reason: 'malformed syntax' },
    ];

    for (const { content, reason } of invalidConfigs) {
      assert.throws(
        () => resolveUatEnv({} as any, content, { requireCredentials: false }),
        (err: any) => {
          assert.ok(err.message.startsWith('[UAT'), `Must throw UAT error on ${reason}`);
          return true;
        },
        `Must fail synchronously on ${reason}`
      );
    }
  });

  // ---------------------------------------------------------------------------
  // 5. Live .env.uat.local Verification
  // ---------------------------------------------------------------------------
  await t.test('5. Live .env.uat.local satisfies exact hostname, HTTPS protocol, and clean allowlist', () => {
    assert.ok(fs.existsSync(actualUatEnvPath), '.env.uat.local must exist');

    const resolved = resolveUatEnv(process.env as any, null, { requireCredentials: true }) as Record<string, string>;

    const parsedUrl = new URL(resolved.NEXT_PUBLIC_SUPABASE_URL);
    assert.equal(parsedUrl.protocol, 'https:');
    assert.equal(parsedUrl.hostname, EXACT_UAT_SUPABASE_HOSTNAME);
    assert.equal(parsedUrl.port, '');
    assert.equal(resolved.NEXT_PUBLIC_ERP_ENV, 'UAT');
    assert.equal(resolved.UAT_MODE, 'true');
    assert.equal(resolved.NEXT_PUBLIC_APP_URL, 'http://localhost:3001');
    assert.equal(resolved.NEXT_PUBLIC_SITE_URL, 'http://localhost:3001');

    // Confirm allowlist isolation on live resolution
    assert.equal(resolved.AWS_SECRET_ACCESS_KEY, undefined);
    assert.equal(resolved.DATABASE_URL, undefined);
  });
});
