import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';

// Modules under test
import { createSignedToken, verifySignedToken } from '../src/lib/auth/session';
import { verifyStaffPassword, hashPassword } from '../src/lib/auth/passwords';
import { DEFAULT_ROLE_PERMISSIONS, INITIAL_MANAGED_USERS } from '../src/lib/constants/rbac-data';
import { encryptToken as encryptGmailToken, decryptToken as decryptGmailToken } from '../src/lib/integrations/gmail-crypto';
import { encryptToken as encryptZohoToken, decryptToken as decryptZohoToken } from '../src/lib/integrations/zoho-crypto';
import { resolveUatEnv } from '../scripts/uat-runner.mjs';

test('ICON TECH PRO ERP V9.2 — Stage 2.2 Local UAT Readiness & BDM Separation Suite', async (t) => {

  await t.test('1. Session Secret Loading: strictly loads process.env.SESSION_SECRET and rejects database key reuse', async () => {
    const savedSessionSecret = process.env.SESSION_SECRET;
    const savedSupabaseKey = process.env.SUPABASE_SECRET_KEY;

    try {
      // Configure a dedicated 32-byte session secret
      const dedicatedSecret = crypto.randomBytes(32).toString('hex');
      process.env.SESSION_SECRET = dedicatedSecret;
      process.env.SUPABASE_SECRET_KEY = 'sb_secret_different_database_key_that_must_not_be_used';

      const token = await createSignedToken({
        id: 'USR007',
        email: 'bdm-uat@example.invalid',
        name: 'Synthetic BDM Lead (UAT)',
        role: 'BDM',
      });

      assert.ok(token, 'Token must be issued');
      assert.ok(token.includes('.'), 'Token must be dot-separated payload and signature');

      const verified = await verifySignedToken(token);
      assert.ok(verified, 'Token must be verified with dedicated SESSION_SECRET');
      assert.equal(verified?.role, 'BDM');
      assert.equal(verified?.email, 'bdm-uat@example.invalid');

      // Now verify that changing SESSION_SECRET invalidates the token (proving it depends strictly on SESSION_SECRET)
      process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
      const rejected = await verifySignedToken(token);
      assert.equal(rejected, null, 'Token must be invalid when SESSION_SECRET changes');
    } finally {
      process.env.SESSION_SECRET = savedSessionSecret;
      process.env.SUPABASE_SECRET_KEY = savedSupabaseKey;
    }
  });

  await t.test('2. Integration Token Encryption Keys: fail closed when keys are unconfigured, refusing DB key fallback', () => {
    const savedGmailKey = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
    const savedZohoKey = process.env.ZOHO_TOKEN_ENCRYPTION_KEY;
    const savedSupabaseKey = process.env.SUPABASE_SECRET_KEY;

    try {
      delete process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
      delete process.env.ZOHO_TOKEN_ENCRYPTION_KEY;
      process.env.SUPABASE_SECRET_KEY = 'sb_secret_database_key_which_must_never_be_reused';

      // Gmail crypto must fail closed
      assert.throws(
        () => encryptGmailToken('test-token'),
        /\[GMAIL SECURITY CONFIG ERROR\]/,
        'Gmail encryption must fail closed without GMAIL_TOKEN_ENCRYPTION_KEY'
      );
      assert.throws(
        () => decryptGmailToken('fake', '0123456789abcdef0123456789abcdef', '0123456789abcdef0123456789abcdef'),
        /\[GMAIL SECURITY CONFIG ERROR\]/,
        'Gmail decryption must fail closed without GMAIL_TOKEN_ENCRYPTION_KEY'
      );

      // Zoho crypto must fail closed
      assert.throws(
        () => encryptZohoToken('test-token'),
        /\[ZOHO SECURITY CONFIG ERROR\]/,
        'Zoho encryption must fail closed without ZOHO_TOKEN_ENCRYPTION_KEY'
      );
      assert.throws(
        () => decryptZohoToken('fake', '0123456789abcdef0123456789abcdef', '0123456789abcdef0123456789abcdef'),
        /\[ZOHO SECURITY CONFIG ERROR\]/,
        'Zoho decryption must fail closed without ZOHO_TOKEN_ENCRYPTION_KEY'
      );
    } finally {
      process.env.GMAIL_TOKEN_ENCRYPTION_KEY = savedGmailKey;
      process.env.ZOHO_TOKEN_ENCRYPTION_KEY = savedZohoKey;
      process.env.SUPABASE_SECRET_KEY = savedSupabaseKey;
    }
  });

  await t.test('3. Synthetic BDM Identity: isolated to UAT and uses non-routable RFC 2606 domain', async () => {
    const bdmUser = INITIAL_MANAGED_USERS.find((u: any) => u.role === 'BDM');
    // Note: If running without process.env.NEXT_PUBLIC_ERP_ENV=UAT preset, check the UAT branch
    if (process.env.NEXT_PUBLIC_ERP_ENV?.toUpperCase() === 'UAT') {
      assert.ok(bdmUser, 'UAT INITIAL_MANAGED_USERS must contain a dedicated BDM user');
      assert.equal(bdmUser.id, 'USR007');
      assert.equal(bdmUser.role, 'BDM');
      assert.equal(bdmUser.email, 'bdm-uat@example.invalid');
      assert.ok(bdmUser.email.endsWith('.invalid'), 'Must use RFC 2606 non-routable .invalid domain');
      assert.equal(bdmUser.status, 'ACTIVE');
      assert.equal(bdmUser.can_login, true);
    } else {
      // In non-UAT default, verify production only has USR001
      const prodBdm = INITIAL_MANAGED_USERS.find((u: any) => u.email === 'bdm-uat@example.invalid');
      assert.equal(prodBdm, undefined, 'Production must never include synthetic UAT users');
      assert.equal(INITIAL_MANAGED_USERS.length, 1, 'Production INITIAL_MANAGED_USERS contains only primary admin');
    }
  });

  await t.test('4. RBAC Separation: BDM strictly denied Admin, User Management, and Settings permissions', () => {
    const bdmPerms = DEFAULT_ROLE_PERMISSIONS['BDM'];
    const adminPerms = DEFAULT_ROLE_PERMISSIONS['Admin / BDM'];

    assert.ok(bdmPerms, 'BDM permissions must exist in DEFAULT_ROLE_PERMISSIONS');
    assert.ok(adminPerms, 'Admin/BDM permissions must exist in DEFAULT_ROLE_PERMISSIONS');

    // Administrative modules: BDM must have false for ALL actions
    const restrictedModules = [
      'User Management',
      'System Settings',
      'Role & Permission Management',
      'Invoices & Billing',
      'Payments',
    ];

    for (const mod of restrictedModules) {
      assert.deepEqual(
        bdmPerms[mod],
        { view: false, create: false, edit: false, delete: false, approve: false, export: false },
        `BDM must have zero permissions on ${mod}`
      );
    }

    // Admin / BDM must have full permissions on those same modules
    assert.equal(adminPerms['User Management'].view, true);
    assert.equal(adminPerms['User Management'].create, true);
    assert.equal(adminPerms['User Management'].delete, true);
    assert.equal(adminPerms['System Settings'].edit, true);

    // BDM delete restriction across ALL modules
    for (const [modName, actions] of Object.entries(bdmPerms)) {
      assert.equal(actions.delete, false, `BDM must have delete: false on ${modName}`);
    }

    // BDM approval privileges: only Quotations and Sales Orders
    assert.equal(bdmPerms['Quotations'].approve, true, 'BDM can approve Quotations');
    assert.equal(bdmPerms['Sales Orders'].approve, true, 'BDM can approve Sales Orders');
  });

  await t.test('5. BDM Password Verification: verifies against PBKDF2 precomputed hash', () => {
    // Testing invalid password fails
    assert.equal(
      verifyStaffPassword('bdm-uat@example.invalid', 'wrongpassword'),
      false,
      'Invalid password must be rejected'
    );

    // Dynamic password update can set and verify password
    const dynamicSecret = 'TestBdmSecret@2026';
    if (!globalThis.__ICON_DYNAMIC_PASSWORD_HASHES__) {
      globalThis.__ICON_DYNAMIC_PASSWORD_HASHES__ = {};
    }
    globalThis.__ICON_DYNAMIC_PASSWORD_HASHES__['bdm-uat@example.invalid'] = hashPassword(dynamicSecret);

    assert.equal(
      verifyStaffPassword('bdm-uat@example.invalid', dynamicSecret),
      true,
      'Dynamic staff password update must verify successfully'
    );
  });

  await t.test('6. UAT Runner: correctly injects SESSION_SECRET when defined in UAT env', () => {
    const mockEnv = [
      'NEXT_PUBLIC_SUPABASE_URL=https://njylssodwvaonbeebvjq.supabase.co',
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publish_test_key_0123456789abcdef',
      'SUPABASE_SECRET_KEY=sb_secret_test_key_0123456789abcdef',
      'NEXT_PUBLIC_ERP_ENV=UAT',
      'NEXT_PUBLIC_APP_URL=http://localhost:3001',
      'SESSION_SECRET=a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    ].join('\n');

    const resolved = resolveUatEnv({}, mockEnv, { requireCredentials: true });
    assert.equal(
      resolved.SESSION_SECRET,
      'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      'resolveUatEnv must preserve and pass through SESSION_SECRET'
    );
    assert.equal(resolved.NEXT_PUBLIC_ERP_ENV, 'UAT');
    assert.equal(resolved.UAT_MODE, 'true');
  });

});
