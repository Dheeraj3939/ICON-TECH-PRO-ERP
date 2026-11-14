import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import nextConfig, { getDistDir, isUatEnvironment } from '../next.config';
import { parseEnvContent, resolveUatEnv } from '../scripts/uat-runner.mjs';

// =============================================================================
// ICON TECH PRO ERP V9.2 — STAGE 1B.1 UAT ENVIRONMENT PRECEDENCE AUDIT SUITE
// =============================================================================

test('ICON TECH PRO ERP V9.2 — Stage 1B.1 UAT Precedence & Overrides Suite', async (t) => {
  const rootDir = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(rootDir, 'package.json');
  const prodBuildDir = path.join(rootDir, '.next');

  const env = process.env as Record<string, string | undefined>;
  const origErpEnv = process.env.NEXT_PUBLIC_ERP_ENV;
  const origGenericEnv = process.env.ERP_ENV;
  const origUatMode = process.env.UAT_MODE;
  const origNodeEnv = process.env.NODE_ENV;

  function restoreEnv() {
    if (origErpEnv !== undefined) {
      env.NEXT_PUBLIC_ERP_ENV = origErpEnv;
    } else {
      delete env.NEXT_PUBLIC_ERP_ENV;
    }
    if (origGenericEnv !== undefined) {
      env.ERP_ENV = origGenericEnv;
    } else {
      delete env.ERP_ENV;
    }
    if (origUatMode !== undefined) {
      env.UAT_MODE = origUatMode;
    } else {
      delete env.UAT_MODE;
    }
    env.NODE_ENV = origNodeEnv;
  }

  // ---------------------------------------------------------------------------
  // 1. Parser verification
  // ---------------------------------------------------------------------------
  await t.test('1. parseEnvContent accurately parses raw environment strings', () => {
    const raw = `
      # Comment line
      NEXT_PUBLIC_ERP_ENV=UAT
      NEXT_PUBLIC_SUPABASE_URL="https://njylssodwvaonbeebvjq.supabase.co"
      NEXT_PUBLIC_APP_URL='http://localhost:3001'
      EMPTY_VAL=
    `;
    const parsed = parseEnvContent(raw) as Record<string, string>;
    assert.equal(parsed.NEXT_PUBLIC_ERP_ENV, 'UAT');
    assert.equal(parsed.NEXT_PUBLIC_SUPABASE_URL, 'https://njylssodwvaonbeebvjq.supabase.co');
    assert.equal(parsed.NEXT_PUBLIC_APP_URL, 'http://localhost:3001');
    assert.equal(parsed.EMPTY_VAL, '');
  });

  // ---------------------------------------------------------------------------
  // 2. Conflicting Parent Shell Variable Override Verification
  // ---------------------------------------------------------------------------
  await t.test('2. resolveUatEnv strictly overrides conflicting parent shell variables', () => {
    const conflictingParentEnv = {
      NODE_ENV: 'production',
      NEXT_PUBLIC_ERP_ENV: 'PRODUCTION',
      ERP_ENV: 'PRODUCTION',
      NEXT_PUBLIC_SUPABASE_URL: 'https://xogynsnfzsvimwtvvhpx.supabase.co',
      NEXT_PUBLIC_APP_URL: 'https://erp.icontechpro.in',
      COMPUTERNAME: 'PRESERVED-HOST',
    };

    const mockUatEnvContent = `
      NEXT_PUBLIC_SUPABASE_URL=https://njylssodwvaonbeebvjq.supabase.co
      NEXT_PUBLIC_APP_URL=http://localhost:3001
      NEXT_PUBLIC_ERP_ENV=UAT
    `;

    const resolved = resolveUatEnv(conflictingParentEnv as any, mockUatEnvContent) as Record<string, string>;

    // Assert that UAT values unconditionally win over parent production values
    assert.equal(resolved.NEXT_PUBLIC_ERP_ENV, 'UAT', 'NEXT_PUBLIC_ERP_ENV must be overridden to UAT');
    assert.equal(resolved.ERP_ENV, 'UAT', 'ERP_ENV must be overridden to UAT');
    assert.equal(resolved.UAT_MODE, 'true', 'UAT_MODE must be forced to true');
    assert.equal(
      resolved.NEXT_PUBLIC_SUPABASE_URL,
      'https://njylssodwvaonbeebvjq.supabase.co',
      'Supabase URL must point to UAT project, overriding production URL'
    );
    assert.equal(
      resolved.NEXT_PUBLIC_APP_URL,
      'http://localhost:3001',
      'App URL must point to localhost:3001'
    );
    assert.equal(resolved.COMPUTERNAME, 'PRESERVED-HOST', 'Allowlisted system vars must be preserved');

    // Verify distDir selection with resolved environment
    assert.equal(getDistDir(resolved.NEXT_PUBLIC_ERP_ENV), '.next-uat');
    assert.equal(isUatEnvironment(resolved.NEXT_PUBLIC_ERP_ENV), true);
  });

  // ---------------------------------------------------------------------------
  // 3. UAT_MODE Direct Flag Precedence in next.config.ts
  // ---------------------------------------------------------------------------
  await t.test('3. isUatEnvironment and getDistDir respect UAT_MODE flag even if ERP_ENV is unset', () => {
    try {
      delete env.NEXT_PUBLIC_ERP_ENV;
      delete env.ERP_ENV;
      env.UAT_MODE = 'true';

      assert.equal(isUatEnvironment(), true, 'isUatEnvironment must be true when UAT_MODE is true');
      assert.equal(getDistDir(), '.next-uat', 'getDistDir must be .next-uat when UAT_MODE is true');
    } finally {
      restoreEnv();
    }
  });

  // ---------------------------------------------------------------------------
  // 4. Production Isolation Guarantee (Production Commands Never Select UAT)
  // ---------------------------------------------------------------------------
  await t.test('4. Production environment strictly selects .next and disables UAT mode', () => {
    try {
      delete env.UAT_MODE;
      env.NEXT_PUBLIC_ERP_ENV = 'PRODUCTION';
      env.NODE_ENV = 'production';

      assert.equal(isUatEnvironment(), false, 'Production environment must NOT be treated as UAT');
      assert.equal(getDistDir(), '.next', 'Production must strictly target .next build directory');
    } finally {
      restoreEnv();
    }
  });

  // ---------------------------------------------------------------------------
  // 5. Webpack Alias Verification for UAT vs Production
  // ---------------------------------------------------------------------------
  await t.test('5. Webpack alias configuration cleanly separates UAT mock data and production data', () => {
    try {
      env.NEXT_PUBLIC_ERP_ENV = 'UAT';
      delete env.UAT_MODE;

      const dummyWebpackConfig = { resolve: { alias: {} } };
      const modifiedConfig = nextConfig.webpack?.(dummyWebpackConfig as any, {} as any) || dummyWebpackConfig;

      const aliases = (modifiedConfig as any).resolve.alias;
      assert.ok(aliases, 'Aliases must be defined in UAT');
      assert.match(
        aliases['@/lib/constants/erp-data$'],
        /erp-data\.uat\.ts$/,
        'Must alias erp-data to erp-data.uat.ts in UAT'
      );
      assert.match(
        aliases['@/lib/constants/hr-data$'],
        /hr-data\.uat\.ts$/,
        'Must alias hr-data to hr-data.uat.ts in UAT'
      );
    } finally {
      restoreEnv();
    }
  });

  // ---------------------------------------------------------------------------
  // 6. Package.json Script Target Verification
  // ---------------------------------------------------------------------------
  await t.test('6. package.json delegates UAT commands to scripts/uat-runner.mjs', () => {
    assert.ok(fs.existsSync(packageJsonPath), 'package.json must exist');
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const scripts = pkg.scripts || {};

    assert.equal(
      scripts['build:uat'],
      'node ./scripts/uat-runner.mjs build',
      'build:uat must route through scripts/uat-runner.mjs'
    );
    assert.equal(
      scripts['start:uat'],
      'node ./scripts/uat-runner.mjs start -p 3001',
      'start:uat must route through scripts/uat-runner.mjs'
    );
    assert.equal(
      scripts['dev:uat'],
      'node ./scripts/uat-runner.mjs dev -p 3001',
      'dev:uat must route through scripts/uat-runner.mjs'
    );

    // Production commands must never reference uat-runner
    assert.equal(scripts['build'], 'next build', 'build must be plain next build');
    assert.equal(scripts['start'], 'next start', 'start must be plain next start');
  });

  // ---------------------------------------------------------------------------
  // 7. Production Build Directory Preservation
  // ---------------------------------------------------------------------------
  await t.test('7. Production build directory .next exists and remains unmodified', () => {
    assert.ok(fs.existsSync(prodBuildDir), 'Production .next directory must exist');
    const stat = fs.statSync(prodBuildDir);
    assert.ok(stat.isDirectory(), '.next must be a directory');
    const manifestPath = path.join(prodBuildDir, 'build-manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'Production build-manifest.json must remain present');
  });
});
