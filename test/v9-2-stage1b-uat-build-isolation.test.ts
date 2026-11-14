import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getDistDir, isUatEnvironment } from '../next.config';

// =============================================================================
// ICON TECH PRO ERP V9.2 — STAGE 1B UAT BUILD ISOLATION SUITE
// Verification of distDir Isolation and Script Environment Precedence
// =============================================================================

test('ICON TECH PRO ERP V9.2 — Stage 1B UAT Build Isolation Suite', async (t) => {
  const rootDir = path.resolve(__dirname, '..');
  const packageJsonPath = path.join(rootDir, 'package.json');
  const gitignorePath = path.join(rootDir, '.gitignore');
  const prodBuildDir = path.join(rootDir, '.next');

  const origErpEnv = process.env.NEXT_PUBLIC_ERP_ENV;
  const origGenericEnv = process.env.ERP_ENV;

  function restoreEnv() {
    if (origErpEnv !== undefined) {
      process.env.NEXT_PUBLIC_ERP_ENV = origErpEnv;
    } else {
      delete process.env.NEXT_PUBLIC_ERP_ENV;
    }
    if (origGenericEnv !== undefined) {
      process.env.ERP_ENV = origGenericEnv;
    } else {
      delete process.env.ERP_ENV;
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Functional Tests on getDistDir() and isUatEnvironment()
  // ---------------------------------------------------------------------------
  await t.test('1A. getDistDir() returns ".next-uat" for all UAT variations', () => {
    assert.equal(getDistDir('UAT'), '.next-uat');
    assert.equal(getDistDir('uat'), '.next-uat');
    assert.equal(getDistDir('  UAT  '), '.next-uat');
    assert.equal(getDistDir('  uat  '), '.next-uat');
    assert.equal(isUatEnvironment('UAT'), true);
    assert.equal(isUatEnvironment('uat'), true);
  });

  await t.test('1B. getDistDir() returns ".next" for production, development, and empty environments', () => {
    assert.equal(getDistDir('PRODUCTION'), '.next');
    assert.equal(getDistDir('production'), '.next');
    assert.equal(getDistDir('development'), '.next');
    assert.equal(getDistDir('staging'), '.next');
    assert.equal(getDistDir(''), '.next');
    assert.equal(getDistDir(undefined), '.next');
    assert.equal(isUatEnvironment('PRODUCTION'), false);
    assert.equal(isUatEnvironment(undefined), false);
  });

  await t.test('1C. Dynamic process.env inspection in getDistDir() and isUatEnvironment()', () => {
    try {
      // With NEXT_PUBLIC_ERP_ENV = 'UAT'
      process.env.NEXT_PUBLIC_ERP_ENV = 'UAT';
      delete process.env.ERP_ENV;
      assert.equal(isUatEnvironment(), true);
      assert.equal(getDistDir(), '.next-uat');

      // With generic ERP_ENV = 'UAT'
      delete process.env.NEXT_PUBLIC_ERP_ENV;
      process.env.ERP_ENV = 'UAT';
      assert.equal(isUatEnvironment(), true);
      assert.equal(getDistDir(), '.next-uat');

      // With production setting
      process.env.NEXT_PUBLIC_ERP_ENV = 'PRODUCTION';
      assert.equal(isUatEnvironment(), false);
      assert.equal(getDistDir(), '.next');

      // Unset
      delete process.env.NEXT_PUBLIC_ERP_ENV;
      delete process.env.ERP_ENV;
      assert.equal(isUatEnvironment(), false);
      assert.equal(getDistDir(), '.next');
    } finally {
      restoreEnv();
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Build Scripts Inspection in package.json
  // ---------------------------------------------------------------------------
  await t.test('2. package.json scripts strictly isolate UAT via --env-file precedence', () => {
    assert.ok(fs.existsSync(packageJsonPath), 'package.json must exist');
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    const scripts = pkg.scripts || {};

    // UAT scripts must inject .env.uat.local before next executable
    assert.ok(scripts['build:uat'], 'build:uat script must exist');
    assert.match(
      scripts['build:uat'],
      /^node\s+(?:--env-file=\.env\.uat\.local\s+)?(?:\.\/)?scripts\/uat-runner\.mjs\s+build/,
      'build:uat must route through scripts/uat-runner.mjs'
    );

    assert.ok(scripts['start:uat'], 'start:uat script must exist');
    assert.match(
      scripts['start:uat'],
      /^node\s+(?:--env-file=\.env\.uat\.local\s+)?(?:\.\/)?scripts\/uat-runner\.mjs\s+start/,
      'start:uat must route through scripts/uat-runner.mjs'
    );
    assert.match(scripts['start:uat'], /-p\s+3001/, 'start:uat must bind to port 3001');

    assert.ok(scripts['dev:uat'], 'dev:uat script must exist');
    assert.match(
      scripts['dev:uat'],
      /^node\s+(?:--env-file=\.env\.uat\.local\s+)?(?:\.\/)?scripts\/uat-runner\.mjs\s+dev/,
      'dev:uat must route through scripts/uat-runner.mjs'
    );
    assert.match(scripts['dev:uat'], /-p\s+3001/, 'dev:uat must bind to port 3001');

    // Production scripts must NOT reference .env.uat.local
    assert.doesNotMatch(
      scripts['build'],
      /\.env\.uat\.local/,
      'Production build script must never reference .env.uat.local'
    );
    assert.doesNotMatch(
      scripts['start'],
      /\.env\.uat\.local/,
      'Production start script must never reference .env.uat.local'
    );
  });

  // ---------------------------------------------------------------------------
  // 3. Git Ignore Verification
  // ---------------------------------------------------------------------------
  await t.test('3. .gitignore contains /.next-uat/ pattern', () => {
    assert.ok(fs.existsSync(gitignorePath), '.gitignore must exist');
    const content = fs.readFileSync(gitignorePath, 'utf8');
    assert.match(content, /\/\.next-uat\//, '.gitignore must ignore /.next-uat/');
  });

  // ---------------------------------------------------------------------------
  // 4. Production Build Preservation Check
  // ---------------------------------------------------------------------------
  await t.test('4. Existing production .next directory remains untouched', () => {
    assert.ok(fs.existsSync(prodBuildDir), 'Production .next directory must exist');
    const stat = fs.statSync(prodBuildDir);
    assert.ok(stat.isDirectory(), '.next must be a directory');
    // Ensure build-manifest.json or app-build-manifest exists inside .next
    const manifestPath = path.join(prodBuildDir, 'build-manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'Production build-manifest.json must remain present');
  });
});
