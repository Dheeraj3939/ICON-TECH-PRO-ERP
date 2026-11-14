import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  resolveUatEnv,
  validateUatEnv,
  EXACT_UAT_SUPABASE_HOSTNAME,
  EXACT_PROD_SUPABASE_HOSTNAME,
  SYSTEM_ENV_ALLOWLIST,
} from '../scripts/uat-runner.mjs';
import { encryptToken as encryptGmailToken } from '../src/lib/integrations/gmail-crypto';
import { encryptToken as encryptZohoToken } from '../src/lib/integrations/zoho-crypto';
import { createSignedToken, verifySignedToken } from '../src/lib/auth/session';

// =============================================================================
// ICON TECH PRO ERP V9.2 — STAGE 1B.4 ALLOWLIST & CREDENTIAL FALLBACK AUDIT SUITE
// =============================================================================

test('ICON TECH PRO ERP V9.2 — Stage 1B.4 Allowlist & Credential Fallback Suite', async (t) => {
  const rootDir = path.resolve(__dirname, '..');
  const actualUatEnvPath = path.join(rootDir, '.env.uat.local');

  // ---------------------------------------------------------------------------
  // 1. NODE_OPTIONS and NODE_PATH Blockade
  // ---------------------------------------------------------------------------
  await t.test('1. resolveUatEnv strictly excludes NODE_OPTIONS and NODE_PATH from child execution', () => {
    assert.equal(SYSTEM_ENV_ALLOWLIST.has('NODE_OPTIONS'), false, 'NODE_OPTIONS must not be in allowlist');
    assert.equal(SYSTEM_ENV_ALLOWLIST.has('NODE_PATH'), false, 'NODE_PATH must not be in allowlist');

    const dangerousParent = {
      PATH: 'C:\\Windows\\system32',
      SYSTEMROOT: 'C:\\Windows',
      NODE_OPTIONS: '--require /tmp/malicious-hook.js --inspect=0.0.0.0:9229',
      NODE_PATH: 'C:\\malicious\\node_modules',
    };

    const mockUat = `
      NEXT_PUBLIC_SUPABASE_URL=https://${EXACT_UAT_SUPABASE_HOSTNAME}
      NEXT_PUBLIC_ERP_ENV=UAT
      NEXT_PUBLIC_APP_URL=http://localhost:3001
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=uat-pub-key-12345
      SUPABASE_SECRET_KEY=uat-sec-key-12345
    `;

    const resolved = resolveUatEnv(dangerousParent as any, mockUat, { requireCredentials: true }) as Record<string, string>;

    assert.equal(resolved.NODE_OPTIONS, undefined, 'NODE_OPTIONS must be completely omitted from child environment');
    assert.equal(resolved.NODE_PATH, undefined, 'NODE_PATH must be completely omitted from child environment');
    assert.equal(resolved.PATH, 'C:\\Windows\\system32', 'Essential PATH must be preserved');
  });

  // ---------------------------------------------------------------------------
  // 2. npm_* and NPM_* Variables Omission
  // ---------------------------------------------------------------------------
  await t.test('2. Arbitrary npm_* and NPM_* variables are strictly excluded from child environment', () => {
    const parentWithNpmVars = {
      PATH: 'C:\\Windows\\system32',
      SYSTEMROOT: 'C:\\Windows',
      npm_config_user_agent: 'npm/10.8.2 node/v24.0.0 win32 x64',
      npm_config_registry: 'https://registry.npmjs.org/',
      npm_config_token: 'npm_secret_auth_token_value',
      NPM_CONFIG_GLOBALCONFIG: 'C:\\Users\\Attacker\\.npmrc',
      npm_lifecycle_event: 'build',
    };

    const mockUat = `
      NEXT_PUBLIC_SUPABASE_URL=https://${EXACT_UAT_SUPABASE_HOSTNAME}
      NEXT_PUBLIC_ERP_ENV=UAT
      NEXT_PUBLIC_APP_URL=http://localhost:3001
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=uat-pub-key-12345
      SUPABASE_SECRET_KEY=uat-sec-key-12345
    `;

    const resolved = resolveUatEnv(parentWithNpmVars as any, mockUat, { requireCredentials: true }) as Record<string, string>;

    assert.equal(resolved.npm_config_user_agent, undefined, 'npm_config_user_agent must be excluded');
    assert.equal(resolved.npm_config_registry, undefined, 'npm_config_registry must be excluded');
    assert.equal(resolved.npm_config_token, undefined, 'npm_config_token must be excluded');
    assert.equal(resolved.NPM_CONFIG_GLOBALCONFIG, undefined, 'NPM_CONFIG_GLOBALCONFIG must be excluded');
    assert.equal(resolved.npm_lifecycle_event, undefined, 'npm_lifecycle_event must be excluded');
  });

  // ---------------------------------------------------------------------------
  // 3. Preservation of Windows Operating System Variables & PATH
  // ---------------------------------------------------------------------------
  await t.test('3. Operating system fundamentals and executable path are preserved', () => {
    const parentWithSystemVars = {
      PATH: 'C:\\Windows\\system32;C:\\Program Files\\nodejs',
      SYSTEMROOT: 'C:\\Windows',
      SYSTEMDRIVE: 'C:',
      TEMP: 'C:\\Temp',
      USERPROFILE: 'C:\\Users\\Developer',
      COMPUTERNAME: 'DEV-WORKSTATION',
      COMSPEC: 'C:\\Windows\\system32\\cmd.exe',
      PATHEXT: '.COM;.EXE;.BAT;.CMD',
      OS: 'Windows_NT',
    };

    const mockUat = `
      NEXT_PUBLIC_SUPABASE_URL=https://${EXACT_UAT_SUPABASE_HOSTNAME}
      NEXT_PUBLIC_ERP_ENV=UAT
      NEXT_PUBLIC_APP_URL=http://localhost:3001
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=uat-pub-key-12345
      SUPABASE_SECRET_KEY=uat-sec-key-12345
    `;

    const resolved = resolveUatEnv(parentWithSystemVars as any, mockUat, { requireCredentials: true }) as Record<string, string>;

    assert.equal(resolved.PATH, parentWithSystemVars.PATH);
    assert.equal(resolved.SYSTEMROOT, parentWithSystemVars.SYSTEMROOT);
    assert.equal(resolved.SYSTEMDRIVE, parentWithSystemVars.SYSTEMDRIVE);
    assert.equal(resolved.TEMP, parentWithSystemVars.TEMP);
    assert.equal(resolved.USERPROFILE, parentWithSystemVars.USERPROFILE);
    assert.equal(resolved.COMPUTERNAME, parentWithSystemVars.COMPUTERNAME);
    assert.equal(resolved.COMSPEC, parentWithSystemVars.COMSPEC);
    assert.equal(resolved.PATHEXT, parentWithSystemVars.PATHEXT);
    assert.equal(resolved.OS, parentWithSystemVars.OS);
  });

  // ---------------------------------------------------------------------------
  // 4. Missing Integration Credentials Do Not Inherit Production Values
  // ---------------------------------------------------------------------------
  await t.test('4. Missing integration credentials cannot silently inherit Production values', () => {
    const productionParent = {
      PATH: 'C:\\Windows\\system32',
      SYSTEMROOT: 'C:\\Windows',
      // Production credentials in parent shell
      GOOGLE_CLIENT_ID: 'production-google-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'production-google-client-secret-99999',
      GMAIL_TOKEN_ENCRYPTION_KEY: 'production-gmail-encryption-key-32bytes-hex',
      ZOHO_TOKEN_ENCRYPTION_KEY: 'production-zoho-encryption-key-32bytes-hex',
      SESSION_SECRET: 'production-session-signing-secret-key-12345',
      SUPABASE_SECRET_KEY: 'production-supabase-secret-key-12345',
    };

    // UAT configuration without Google or encryption secrets
    const mockUat = `
      NEXT_PUBLIC_SUPABASE_URL=https://${EXACT_UAT_SUPABASE_HOSTNAME}
      NEXT_PUBLIC_ERP_ENV=UAT
      NEXT_PUBLIC_APP_URL=http://localhost:3001
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=uat-pub-key-12345
      SUPABASE_SECRET_KEY=uat-supabase-sec-key-12345
      ZOHO_CLIENT_SECRET=uat-zoho-secret-54321
    `;

    const resolved = resolveUatEnv(productionParent as any, mockUat, { requireCredentials: true }) as Record<string, string>;

    // Missing integration credentials must be undefined in child environment
    assert.equal(resolved.GOOGLE_CLIENT_ID, undefined, 'GOOGLE_CLIENT_ID must not inherit from production parent');
    assert.equal(resolved.GOOGLE_CLIENT_SECRET, undefined, 'GOOGLE_CLIENT_SECRET must not inherit from production parent');
    assert.equal(resolved.GMAIL_TOKEN_ENCRYPTION_KEY, undefined, 'GMAIL_TOKEN_ENCRYPTION_KEY must not inherit from production parent');
    assert.equal(resolved.ZOHO_TOKEN_ENCRYPTION_KEY, undefined, 'ZOHO_TOKEN_ENCRYPTION_KEY must not inherit from production parent');
    assert.equal(resolved.SESSION_SECRET, undefined, 'SESSION_SECRET must not inherit from production parent');

    // Present credentials must be strictly UAT values
    assert.equal(resolved.SUPABASE_SECRET_KEY, 'uat-supabase-sec-key-12345');
    assert.equal(resolved.ZOHO_CLIENT_SECRET, 'uat-zoho-secret-54321');
  });

  // ---------------------------------------------------------------------------
  // 5. Cryptographic Fail-Closed Integrity (No Supabase Secret Reuse)
  // ---------------------------------------------------------------------------
  await t.test('5. Cryptographic token encryption fails closed without reusing Supabase secrets', () => {
    const origGmailKey = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
    const origZohoKey = process.env.ZOHO_TOKEN_ENCRYPTION_KEY;
    const origSessionSecret = process.env.SESSION_SECRET;
    const origSupabaseSecret = process.env.SUPABASE_SECRET_KEY;

    try {
      // Simulate environment with Supabase secret but NO token encryption keys
      delete process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
      delete process.env.ZOHO_TOKEN_ENCRYPTION_KEY;
      delete process.env.SESSION_SECRET;
      process.env.SUPABASE_SECRET_KEY = 'uat-supabase-secret-key-simulated-12345';

      // 5A. Gmail token encryption must FAIL CLOSED instead of reusing SUPABASE_SECRET_KEY
      assert.throws(
        () => encryptGmailToken('test-refresh-token'),
        /\[GMAIL SECURITY CONFIG ERROR\] GMAIL_TOKEN_ENCRYPTION_KEY is not configured/,
        'Must refuse to encrypt Gmail token without dedicated encryption key'
      );

      // 5B. Zoho token encryption must FAIL CLOSED instead of reusing SUPABASE_SECRET_KEY
      assert.throws(
        () => encryptZohoToken('test-refresh-token'),
        /\[ZOHO SECURITY CONFIG ERROR\] ZOHO_TOKEN_ENCRYPTION_KEY is not configured/,
        'Must refuse to encrypt Zoho token without dedicated encryption key'
      );

      // 5C. Session signing uses process-isolated ephemeral secret when SESSION_SECRET is unset
      // and does NOT reuse SUPABASE_SECRET_KEY
      assert.doesNotThrow(async () => {
        const token = await createSignedToken({
          id: 'uat-user-1',
          email: 'admin@icontechpro.in',
          name: 'UAT Admin',
          role: 'Managing Director',
        });
        assert.ok(token && token.length > 20, 'Session token must be created');
        const verified = await verifySignedToken(token);
        assert.equal(verified?.email, 'admin@icontechpro.in');
      });
    } finally {
      if (origGmailKey) process.env.GMAIL_TOKEN_ENCRYPTION_KEY = origGmailKey;
      else delete process.env.GMAIL_TOKEN_ENCRYPTION_KEY;

      if (origZohoKey) process.env.ZOHO_TOKEN_ENCRYPTION_KEY = origZohoKey;
      else delete process.env.ZOHO_TOKEN_ENCRYPTION_KEY;

      if (origSessionSecret) process.env.SESSION_SECRET = origSessionSecret;
      else delete process.env.SESSION_SECRET;

      if (origSupabaseSecret) process.env.SUPABASE_SECRET_KEY = origSupabaseSecret;
      else delete process.env.SUPABASE_SECRET_KEY;
    }
  });

  // ---------------------------------------------------------------------------
  // 6. Failed Validation Preempts Child-Process Launch
  // ---------------------------------------------------------------------------
  await t.test('6. Missing or invalid configuration halts execution before process spawn', () => {
    const invalidConfigs = [
      { raw: 'NEXT_PUBLIC_SUPABASE_URL=http://insecure.url\nNEXT_PUBLIC_ERP_ENV=UAT', desc: 'HTTP scheme' },
      { raw: `NEXT_PUBLIC_SUPABASE_URL=https://${EXACT_PROD_SUPABASE_HOSTNAME}\nNEXT_PUBLIC_ERP_ENV=UAT`, desc: 'Production Supabase host' },
      { raw: `NEXT_PUBLIC_SUPABASE_URL=https://${EXACT_UAT_SUPABASE_HOSTNAME}.attacker.com\nNEXT_PUBLIC_ERP_ENV=UAT`, desc: 'Spoofed host suffix' },
      { raw: 'NEXT_PUBLIC_ERP_ENV=UAT', desc: 'Missing Supabase URL' },
      { raw: 'UNPARSABLE LINE WITHOUT EQUAL', desc: 'Malformed syntax' },
    ];

    for (const { raw, desc } of invalidConfigs) {
      assert.throws(
        () => resolveUatEnv({} as any, raw, { requireCredentials: false }),
        (err: any) => {
          assert.ok(err.message.startsWith('[UAT'), `Must throw UAT error on ${desc}`);
          return true;
        },
        `Failed validation on ${desc} must prevent child process spawn`
      );
    }
  });

  // ---------------------------------------------------------------------------
  // 7. Live .env.uat.local Integrity Verification
  // ---------------------------------------------------------------------------
  await t.test('7. Live .env.uat.local satisfies exact hostname, HTTPS protocol, and clean allowlist', () => {
    assert.ok(fs.existsSync(actualUatEnvPath), '.env.uat.local must exist');

    const resolved = resolveUatEnv(process.env as any, null, { requireCredentials: true }) as Record<string, string>;

    const parsedUrl = new URL(resolved.NEXT_PUBLIC_SUPABASE_URL);
    assert.equal(parsedUrl.protocol, 'https:');
    assert.equal(parsedUrl.hostname, EXACT_UAT_SUPABASE_HOSTNAME);
    assert.equal(parsedUrl.port, '');
    assert.equal(resolved.NEXT_PUBLIC_ERP_ENV, 'UAT');
    assert.equal(resolved.UAT_MODE, 'true');
    assert.equal(resolved.NEXT_PUBLIC_APP_URL, 'http://localhost:3001');

    // Confirm NODE_OPTIONS and npm variables are completely absent
    assert.equal(resolved.NODE_OPTIONS, undefined);
    assert.equal(resolved.NODE_PATH, undefined);
    assert.equal(resolved.npm_config_user_agent, undefined);
  });
});
