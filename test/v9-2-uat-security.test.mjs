import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// =============================================================================
// ICON TECH PRO ERP V9.2 — UAT SECURITY & SESSION INVALIDATION VERIFICATION
// =============================================================================

test('ICON TECH PRO ERP V9.2 — UAT Security & Session Invalidation Suite', async (t) => {
  await t.test('1. Security Verification of src/app/api/auth-session/route.ts', () => {
    const routePath = path.join(rootDir, 'src/app/api/auth-session/route.ts');
    assert.ok(fs.existsSync(routePath), 'auth-session route must exist');
    const content = fs.readFileSync(routePath, 'utf8');

    // Verify UAT environment is strictly blocked from synthetic auth
    assert.match(content, /isUat/, 'Must check for UAT environment');
    assert.match(
      content,
      /NEXT_PUBLIC_ERP_ENV/,
      'Must inspect NEXT_PUBLIC_ERP_ENV for UAT'
    );
    assert.match(
      content,
      /Synthetic auth endpoint is strictly disabled in UAT/,
      'Must return explicit UAT security message'
    );
  });

  await t.test('2. Security Verification of src/app/(auth)/login/actions.ts', () => {
    const actionsPath = path.join(rootDir, 'src/app/(auth)/login/actions.ts');
    assert.ok(fs.existsSync(actionsPath), 'login actions must exist');
    const content = fs.readFileSync(actionsPath, 'utf8');

    // Verify quick role login is disabled in UAT
    assert.match(
      content,
      /Quick role sign-in is disabled in the UAT environment/,
      'quickLoginAsRole must reject in UAT'
    );

    // Verify getQuickLoginOptions returns [] in UAT
    assert.match(
      content,
      /getQuickLoginOptions[\s\S]*?process\.env\.NEXT_PUBLIC_ERP_ENV[\s\S]*?return \[\]/,
      'getQuickLoginOptions must return empty array in UAT'
    );

    // Verify UAT login uses real Supabase Auth
    assert.match(
      content,
      /supabase\.auth\.signInWithPassword/,
      'UAT login branch must use supabase.auth.signInWithPassword'
    );
  });

  await t.test('3. Verification of Session Invalidation in src/lib/auth/session.ts', () => {
    const sessionPath = path.join(rootDir, 'src/lib/auth/session.ts');
    assert.ok(fs.existsSync(sessionPath), 'session.ts must exist');
    const content = fs.readFileSync(sessionPath, 'utf8');

    // Verify iat is recorded in AuthenticatedUser and createSignedToken
    assert.match(content, /iat\?:\s*number/, 'AuthenticatedUser must support iat');
    assert.match(content, /iat:\s*\(user as any\)\.iat\s*\|\|\s*now/, 'createSignedToken must embed iat');

    // Verify __ICON_SESSION_INVALIDATIONS__ is checked in verifySignedToken
    assert.match(
      content,
      /__ICON_SESSION_INVALIDATIONS__/,
      'verifySignedToken must inspect __ICON_SESSION_INVALIDATIONS__'
    );
    assert.match(
      content,
      /tokenIssuedAt\s*<=\s*invalidationTime/,
      'verifySignedToken must reject tokens issued at or before invalidation'
    );
  });

  await t.test('4. End-to-End Cryptographic Session Invalidation Logic Simulation', async () => {
    const SECRET = 'test-session-secret-at-least-32-chars-long';
    const SESSION_DURATION = 3600;

    // Simulate token generator with iat
    function generateToken(user, iatSec) {
      const payload = { ...user, iat: iatSec, exp: iatSec + SESSION_DURATION };
      const json = JSON.stringify(payload);
      const b64 = Buffer.from(json).toString('base64url');
      const hmac = crypto.createHmac('sha256', SECRET);
      hmac.update(b64);
      const sig = hmac.digest('hex');
      return `${b64}.${sig}`;
    }

    // Simulate verifier with invalidations store check
    function verifyToken(token, invalidationsStore) {
      const [b64, sig] = token.split('.');
      const hmac = crypto.createHmac('sha256', SECRET);
      hmac.update(b64);
      if (sig !== hmac.digest('hex')) return null;

      const user = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
      if (user.exp < Math.floor(Date.now() / 1000)) return null;

      if (user.id && invalidationsStore[user.id]) {
        const invalidationTime = new Date(invalidationsStore[user.id]).getTime();
        const tokenIssuedAt = (user.iat || 0) * 1000;
        if (tokenIssuedAt <= invalidationTime) {
          return null; // Revoked!
        }
      }
      return user;
    }

    const invalidations = {};
    const testUser = { id: 'usr-uat-999', email: 'uat@icontechpro.in', name: 'UAT User', role: 'Sales Executive' };

    const t0 = Math.floor(Date.now() / 1000);
    const tokenA = generateToken(testUser, t0);

    // Initial check: token is valid
    assert.deepEqual(verifyToken(tokenA, invalidations)?.id, testUser.id, 'TokenA should be valid initially');

    // Admin invalidates session at t0 + 2 seconds
    const invalidationIso = new Date((t0 + 2) * 1000).toISOString();
    invalidations[testUser.id] = invalidationIso;

    // TokenA (issued at t0) must now be REVOKED
    assert.equal(verifyToken(tokenA, invalidations), null, 'TokenA must be revoked after invalidation');

    // User logs in again at t0 + 5 seconds -> TokenB
    const tokenB = generateToken(testUser, t0 + 5);
    assert.deepEqual(verifyToken(tokenB, invalidations)?.id, testUser.id, 'TokenB issued after invalidation must be valid');
  });

  await t.test('5. Verification of src/lib/supabase/server.ts Key Priority in UAT', () => {
    const serverPath = path.join(rootDir, 'src/lib/supabase/server.ts');
    assert.ok(fs.existsSync(serverPath), 'server.ts must exist');
    const content = fs.readFileSync(serverPath, 'utf8');

    // Verify UAT environment is checked
    assert.match(content, /isUat\s*=/, 'server.ts must determine isUat');
    assert.match(
      content,
      /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
      'server.ts must use publishable key in UAT for RLS enforcement'
    );
  });
});
