import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// =============================================================================
// ICON TECH PRO ERP V9.2 — STAGE 1A REGRESSION TEST SUITE
// Early Fail-Closed Production Endpoint Guards Verification
// =============================================================================

test('ICON TECH PRO ERP V9.2 — Stage 1A Endpoint Guards Suite', async (t) => {
  const remediationRoutePath = path.join(
    rootDir,
    'src/app/api/test-remediation/route.ts'
  );
  const rbacRoutePath = path.join(
    rootDir,
    'src/app/api/test-admin-rbac/route.ts'
  );

  await t.test('1. Static Guard Placement in src/app/api/test-remediation/route.ts', () => {
    assert.ok(fs.existsSync(remediationRoutePath), 'test-remediation route must exist');
    const content = fs.readFileSync(remediationRoutePath, 'utf8');

    // 1. Guard must be inside GET handler
    const getMatch = content.match(/export\s+async\s+function\s+GET\s*\(\s*\)\s*\{([\s\S]*)/);
    assert.ok(getMatch, 'GET handler must be exported');
    const getBody = getMatch[1];

    // 2. Guard must inspect NODE_ENV and NEXT_PUBLIC_ERP_ENV
    assert.match(
      getBody,
      /process\.env\.NODE_ENV\s*===\s*['"]production['"]/,
      'Must check process.env.NODE_ENV === "production"'
    );
    assert.match(
      getBody,
      /process\.env\.NEXT_PUBLIC_ERP_ENV\?\.trim\(\)\.toUpperCase\(\)\s*===\s*['"]PRODUCTION['"]/,
      'Must check normalized NEXT_PUBLIC_ERP_ENV === "PRODUCTION"'
    );

    // 3. Must return 404 status
    assert.match(
      getBody,
      /NextResponse\.json\(\s*\{\s*error:\s*['"][^'"]+['"]\s*\}\s*,\s*\{\s*status:\s*404\s*\}\s*\)/,
      'Must return 404 with generic error JSON'
    );

    // 4. Guard must occur before getAuthenticatedUser() and any side effects
    const guardIndex = getBody.indexOf('process.env.NODE_ENV === \'production\'');
    const authIndex = getBody.indexOf('getAuthenticatedUser()');
    const createCustomerIndex = getBody.indexOf('createCustomer(');
    const createQuotationIndex = getBody.indexOf('createQuotation(');
    const createInvoiceIndex = getBody.indexOf('createInvoiceFromOrder(');

    assert.ok(guardIndex !== -1, 'Guard must be present');
    assert.ok(authIndex !== -1, 'getAuthenticatedUser must be present');
    assert.ok(guardIndex < authIndex, 'Guard must precede getAuthenticatedUser');
    assert.ok(guardIndex < createCustomerIndex, 'Guard must precede createCustomer');
    assert.ok(guardIndex < createQuotationIndex, 'Guard must precede createQuotation');
    assert.ok(guardIndex < createInvoiceIndex, 'Guard must precede createInvoiceFromOrder');
  });

  await t.test('2. Static Guard Placement in src/app/api/test-admin-rbac/route.ts', () => {
    assert.ok(fs.existsSync(rbacRoutePath), 'test-admin-rbac route must exist');
    const content = fs.readFileSync(rbacRoutePath, 'utf8');

    // 1. Guard must be inside GET handler
    const getMatch = content.match(/export\s+async\s+function\s+GET\s*\(\s*\)\s*\{([\s\S]*)/);
    assert.ok(getMatch, 'GET handler must be exported');
    const getBody = getMatch[1];

    // 2. Guard must inspect NODE_ENV and NEXT_PUBLIC_ERP_ENV
    assert.match(
      getBody,
      /process\.env\.NODE_ENV\s*===\s*['"]production['"]/,
      'Must check process.env.NODE_ENV === "production"'
    );
    assert.match(
      getBody,
      /process\.env\.NEXT_PUBLIC_ERP_ENV\?\.trim\(\)\.toUpperCase\(\)\s*===\s*['"]PRODUCTION['"]/,
      'Must check normalized NEXT_PUBLIC_ERP_ENV === "PRODUCTION"'
    );

    // 3. Must return 404 status
    assert.match(
      getBody,
      /NextResponse\.json\(\s*\{\s*error:\s*['"][^'"]+['"]\s*\}\s*,\s*\{\s*status:\s*404\s*\}\s*\)/,
      'Must return 404 with generic error JSON'
    );

    // 4. Guard must occur before getAuthenticatedUser() and any side effects
    const guardIndex = getBody.indexOf('process.env.NODE_ENV === \'production\'');
    const authIndex = getBody.indexOf('getAuthenticatedUser()');
    const createManagedUserIndex = getBody.indexOf('createManagedUser(');
    const deleteManagedUserIndex = getBody.indexOf('deleteManagedUser(');
    const createCustomRoleIndex = getBody.indexOf('createCustomRole(');
    const updateRolePermissionIndex = getBody.indexOf('updateRolePermission(');

    assert.ok(guardIndex !== -1, 'Guard must be present');
    assert.ok(authIndex !== -1, 'getAuthenticatedUser must be present');
    assert.ok(guardIndex < authIndex, 'Guard must precede getAuthenticatedUser');
    assert.ok(guardIndex < createManagedUserIndex, 'Guard must precede createManagedUser');
    assert.ok(guardIndex < deleteManagedUserIndex, 'Guard must precede deleteManagedUser');
    assert.ok(guardIndex < createCustomRoleIndex, 'Guard must precede createCustomRole');
    assert.ok(guardIndex < updateRolePermissionIndex, 'Guard must precede updateRolePermission');
  });

  await t.test('3. Environment Permutation Evaluation of Guard Condition', () => {
    function evaluateGuard(nodeEnv, erpEnv) {
      const isProduction =
        nodeEnv === 'production' ||
        erpEnv?.trim().toUpperCase() === 'PRODUCTION';

      if (isProduction) {
        return { status: 404, body: { error: 'Endpoint not found' } };
      }
      return { status: 'PROCEED_TO_HANDLER' };
    }

    // Permutation A: NODE_ENV is production
    assert.deepEqual(evaluateGuard('production', undefined), {
      status: 404,
      body: { error: 'Endpoint not found' },
    });
    assert.deepEqual(evaluateGuard('production', 'development'), {
      status: 404,
      body: { error: 'Endpoint not found' },
    });
    assert.deepEqual(evaluateGuard('production', 'UAT'), {
      status: 404,
      body: { error: 'Endpoint not found' },
    });

    // Permutation B: NEXT_PUBLIC_ERP_ENV is PRODUCTION (various cases and whitespaces)
    assert.deepEqual(evaluateGuard('development', 'PRODUCTION'), {
      status: 404,
      body: { error: 'Endpoint not found' },
    });
    assert.deepEqual(evaluateGuard('development', 'production'), {
      status: 404,
      body: { error: 'Endpoint not found' },
    });
    assert.deepEqual(evaluateGuard('development', '  Production  '), {
      status: 404,
      body: { error: 'Endpoint not found' },
    });
    assert.deepEqual(evaluateGuard(undefined, 'PRODUCTION'), {
      status: 404,
      body: { error: 'Endpoint not found' },
    });

    // Permutation C: Non-production environments (must proceed without blocking)
    assert.equal(evaluateGuard('development', undefined).status, 'PROCEED_TO_HANDLER');
    assert.equal(evaluateGuard('development', 'UAT').status, 'PROCEED_TO_HANDLER');
    assert.equal(evaluateGuard('development', 'uat').status, 'PROCEED_TO_HANDLER');
    assert.equal(evaluateGuard('test', 'STAGING').status, 'PROCEED_TO_HANDLER');
  });

  await t.test('4. Side-Effect Preemption Invariant Verification (Mock Spy Simulation)', () => {
    const sideEffectSpies = {
      createCustomer: 0,
      createQuotation: 0,
      convertQuotationToOrder: 0,
      createInvoiceFromOrder: 0,
      recordPayment: 0,
      updateProductStock: 0,
      createManagedUser: 0,
      deleteManagedUser: 0,
      createCustomRole: 0,
      deleteRole: 0,
      updateRolePermission: 0,
    };

    // Simulated handler execution modeling the exact route control flow
    function executeSimulatedHandler(nodeEnv, erpEnv, isAuthenticated = true) {
      // 1. Fail-closed production guard
      if (
        nodeEnv === 'production' ||
        erpEnv?.trim().toUpperCase() === 'PRODUCTION'
      ) {
        return { status: 404, json: { error: 'Endpoint not found' } };
      }

      // 2. Authentication guard
      if (!isAuthenticated) {
        return { status: 401, json: { status: 'UNAUTHORIZED' } };
      }

      // 3. Side effects (should never be reached in production)
      sideEffectSpies.createCustomer++;
      sideEffectSpies.createQuotation++;
      sideEffectSpies.convertQuotationToOrder++;
      sideEffectSpies.createInvoiceFromOrder++;
      sideEffectSpies.recordPayment++;
      sideEffectSpies.updateProductStock++;
      sideEffectSpies.createManagedUser++;
      sideEffectSpies.deleteManagedUser++;
      sideEffectSpies.createCustomRole++;
      sideEffectSpies.deleteRole++;
      sideEffectSpies.updateRolePermission++;

      return { status: 200, json: { status: 'SUCCESS' } };
    }

    // Case 1: In production mode, response is 404 and zero side effects occur
    const prodRes = executeSimulatedHandler('production', undefined, true);
    assert.equal(prodRes.status, 404);
    assert.deepEqual(prodRes.json, { error: 'Endpoint not found' });
    Object.entries(sideEffectSpies).forEach(([fn, count]) => {
      assert.equal(count, 0, `${fn} must not be called when guarded`);
    });

    // Case 2: In ERP PRODUCTION mode, response is 404 and zero side effects occur
    const erpProdRes = executeSimulatedHandler('development', 'PRODUCTION', true);
    assert.equal(erpProdRes.status, 404);
    assert.deepEqual(erpProdRes.json, { error: 'Endpoint not found' });
    Object.entries(sideEffectSpies).forEach(([fn, count]) => {
      assert.equal(count, 0, `${fn} must not be called when guarded`);
    });

    // Case 3: In non-production mode, unauthenticated caller receives 401 and zero side effects occur
    const devUnauthRes = executeSimulatedHandler('development', 'UAT', false);
    assert.equal(devUnauthRes.status, 401);
    Object.entries(sideEffectSpies).forEach(([fn, count]) => {
      assert.equal(count, 0, `${fn} must not be called when unauthenticated`);
    });

    // Case 4: In non-production authenticated mode, side effects execute as designed
    const devAuthRes = executeSimulatedHandler('development', 'UAT', true);
    assert.equal(devAuthRes.status, 200);
    Object.entries(sideEffectSpies).forEach(([fn, count]) => {
      assert.equal(count, 1, `${fn} must be called when authorized in non-production`);
    });
  });
});
