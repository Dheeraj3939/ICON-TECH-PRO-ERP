import test from 'node:test';
import assert from 'node:assert/strict';
import { GET as getRemediationRoute } from '../src/app/api/test-remediation/route';
import { GET as getAdminRbacRoute } from '../src/app/api/test-admin-rbac/route';

// =============================================================================
// ICON TECH PRO ERP V9.2 — STAGE 1A.1 RUNTIME VERIFICATION SUITE
// Direct In-Process Runtime Invocation of Actual Route GET Handlers
// =============================================================================

test('ICON TECH PRO ERP V9.2 — Stage 1A.1 Actual Route Handler Runtime Verification', async (t) => {
  const origNodeEnv = process.env.NODE_ENV;
  const origErpEnv = process.env.NEXT_PUBLIC_ERP_ENV;
  const env = process.env as Record<string, string | undefined>;

  function restoreEnv() {
    env.NODE_ENV = origNodeEnv;
    if (origErpEnv !== undefined) {
      process.env.NEXT_PUBLIC_ERP_ENV = origErpEnv;
    } else {
      delete process.env.NEXT_PUBLIC_ERP_ENV;
    }
  }

  // ===========================================================================
  // 1. Runtime Verification of actual GET handler: /api/test-remediation
  // ===========================================================================
  await t.test('1A. /api/test-remediation runtime returns 404 when NODE_ENV="production"', async () => {
    try {
      env.NODE_ENV = 'production';
      delete process.env.NEXT_PUBLIC_ERP_ENV;

      const response = await getRemediationRoute();

      assert.ok(response instanceof Response, 'Must return a standard Web API Response object');
      assert.equal(response.status, 404, 'HTTP status must be exactly 404');
      const body = await response.json();
      assert.deepEqual(body, { error: 'Endpoint not found' }, 'Body must contain generic error message');
    } finally {
      restoreEnv();
    }
  });

  await t.test('1B. /api/test-remediation runtime returns 404 when NEXT_PUBLIC_ERP_ENV="PRODUCTION"', async () => {
    try {
      env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_ERP_ENV = 'PRODUCTION';

      const response = await getRemediationRoute();

      assert.equal(response.status, 404, 'HTTP status must be 404');
      const body = await response.json();
      assert.deepEqual(body, { error: 'Endpoint not found' });
    } finally {
      restoreEnv();
    }
  });

  await t.test('1C. /api/test-remediation runtime returns 404 with whitespace and lowercase ERP_ENV', async () => {
    try {
      env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_ERP_ENV = '   production   ';

      const response = await getRemediationRoute();

      assert.equal(response.status, 404, 'HTTP status must be 404');
      const body = await response.json();
      assert.deepEqual(body, { error: 'Endpoint not found' });
    } finally {
      restoreEnv();
    }
  });

  await t.test('1D. /api/test-remediation passes guard in non-production mode (proceeds to auth check)', async () => {
    try {
      env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_ERP_ENV = 'UAT';

      // The guard must pass and attempt to evaluate session/auth.
      // Outside an active HTTP request scope, cookies() throws a Next.js context error,
      // proving execution moved past the production guard and reached authentication before any side effect.
      await assert.rejects(
        async () => {
          await getRemediationRoute();
        },
        (err: Error) => {
          assert.match(
            err.message,
            /cookies.*outside a request scope|Invariant: AsyncLocalStorage accessed in runtime/i,
            'Must proceed to getAuthenticatedUser() -> cookies() call'
          );
          return true;
        }
      );
    } finally {
      restoreEnv();
    }
  });

  // ===========================================================================
  // 2. Runtime Verification of actual GET handler: /api/test-admin-rbac
  // ===========================================================================
  await t.test('2A. /api/test-admin-rbac runtime returns 404 when NODE_ENV="production"', async () => {
    try {
      env.NODE_ENV = 'production';
      delete process.env.NEXT_PUBLIC_ERP_ENV;

      const response = await getAdminRbacRoute();

      assert.ok(response instanceof Response, 'Must return a standard Web API Response object');
      assert.equal(response.status, 404, 'HTTP status must be exactly 404');
      const body = await response.json();
      assert.deepEqual(body, { error: 'Endpoint not found' });
    } finally {
      restoreEnv();
    }
  });

  await t.test('2B. /api/test-admin-rbac runtime returns 404 when NEXT_PUBLIC_ERP_ENV="PRODUCTION"', async () => {
    try {
      env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_ERP_ENV = 'PRODUCTION';

      const response = await getAdminRbacRoute();

      assert.equal(response.status, 404, 'HTTP status must be 404');
      const body = await response.json();
      assert.deepEqual(body, { error: 'Endpoint not found' });
    } finally {
      restoreEnv();
    }
  });

  await t.test('2C. /api/test-admin-rbac runtime returns 404 with whitespace and lowercase ERP_ENV', async () => {
    try {
      env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_ERP_ENV = '   production   ';

      const response = await getAdminRbacRoute();

      assert.equal(response.status, 404, 'HTTP status must be 404');
      const body = await response.json();
      assert.deepEqual(body, { error: 'Endpoint not found' });
    } finally {
      restoreEnv();
    }
  });

  await t.test('2D. /api/test-admin-rbac passes guard in non-production mode (proceeds to auth check)', async () => {
    try {
      env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_ERP_ENV = 'UAT';

      // The guard must pass and attempt to evaluate session/auth.
      // Outside an active HTTP request scope, cookies() throws a Next.js context error,
      // proving execution moved past the production guard and reached authentication before any side effect.
      await assert.rejects(
        async () => {
          await getAdminRbacRoute();
        },
        (err: Error) => {
          assert.match(
            err.message,
            /cookies.*outside a request scope|Invariant: AsyncLocalStorage accessed in runtime/i,
            'Must proceed to getAuthenticatedUser() -> cookies() call'
          );
          return true;
        }
      );
    } finally {
      restoreEnv();
    }
  });
});
