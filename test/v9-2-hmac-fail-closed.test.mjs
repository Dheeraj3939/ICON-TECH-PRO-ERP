import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// =============================================================================
// ICON TECH PRO ERP V9.2 — MANDATORY HMAC PRODUCTION FAIL-CLOSED TEST SUITE
// =============================================================================

// Extract functions directly from source code to test exact live implementation
const loggerSource = fs.readFileSync(path.join(rootDir, 'src/lib/audit/enterprise-logger.ts'), 'utf8');

// Verify that the required functions exist in the source code
assert.ok(loggerSource.includes('export function isProductionRuntime'), 'Must export isProductionRuntime');
assert.ok(loggerSource.includes('export function getCheckpointHmacSecret'), 'Must export getCheckpointHmacSecret');
assert.ok(loggerSource.includes('export function verifyAuditCheckpoint'), 'Must export verifyAuditCheckpoint');

// Extract the exact implementation block
const startIdx = loggerSource.indexOf('export function isProductionRuntime');
const endIdx = loggerSource.indexOf('export function detectRecordTampering');
const targetBlock = loggerSource.substring(startIdx, endIdx);

// Transpile with TypeScript compiler to ensure 100% exact fidelity with zero manual regex
const transpiled = ts.transpileModule(targetBlock, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

const exported = {};
const moduleRunner = new Function('exports', 'require', 'crypto', transpiled);
moduleRunner(exported, require, crypto);

const { isProductionRuntime, getCheckpointHmacSecret, verifyAuditCheckpoint } = exported;

test('ICON TECH PRO ERP V9.2 — HMAC Production Fail-Closed Hardening', async (t) => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalErpEnv = process.env.NEXT_PUBLIC_ERP_ENV;
  const originalHmacSecret = process.env.AUDIT_CHECKPOINT_HMAC_SECRET;
  const originalSessionSecret = process.env.ERP_SESSION_SECRET;

  function restoreEnv() {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.NEXT_PUBLIC_ERP_ENV = originalErpEnv;
    process.env.AUDIT_CHECKPOINT_HMAC_SECRET = originalHmacSecret;
    process.env.ERP_SESSION_SECRET = originalSessionSecret;
  }

  t.afterEach(() => {
    restoreEnv();
  });

  // ---------------------------------------------------------------------------
  // 1. PRODUCTION RUNTIME DETECTION & ANTI-DOWNGRADE INVARIANTS
  // ---------------------------------------------------------------------------
  await t.test('1. Production runtime detection cannot be downgraded', () => {
    // NODE_ENV=production must always be detected as production
    process.env.NODE_ENV = 'production';
    delete process.env.NEXT_PUBLIC_ERP_ENV;
    assert.equal(isProductionRuntime(), true, 'NODE_ENV=production must be detected as production');

    // NEXT_PUBLIC_ERP_ENV cannot downgrade a production NODE_ENV
    process.env.NEXT_PUBLIC_ERP_ENV = 'development';
    assert.equal(isProductionRuntime(), true, 'Cannot downgrade production with NEXT_PUBLIC_ERP_ENV=development');

    process.env.NEXT_PUBLIC_ERP_ENV = 'UAT';
    assert.equal(isProductionRuntime(), true, 'Cannot downgrade production with NEXT_PUBLIC_ERP_ENV=UAT');

    process.env.NEXT_PUBLIC_ERP_ENV = 'test';
    assert.equal(isProductionRuntime(), true, 'Cannot downgrade production with NEXT_PUBLIC_ERP_ENV=test');

    // NEXT_PUBLIC_ERP_ENV=PRODUCTION promotes any runtime to production
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_ERP_ENV = 'PRODUCTION';
    assert.equal(isProductionRuntime(), true, 'NEXT_PUBLIC_ERP_ENV=PRODUCTION must be detected as production');

    // Test/development when neither is production
    process.env.NODE_ENV = 'test';
    delete process.env.NEXT_PUBLIC_ERP_ENV;
    assert.equal(isProductionRuntime(), false, 'Test runtime without production flag is non-production');
  });

  // ---------------------------------------------------------------------------
  // 2. PRODUCTION WITH VALID DEDICATED SECRET (PASS)
  // ---------------------------------------------------------------------------
  await t.test('2. Production with valid dedicated secret (>= 32 chars) passes', () => {
    process.env.NODE_ENV = 'production';
    const validSecret = 'a1b2c3d4e5f60718293a4b5c6d7e8f90_valid_production_secret';
    process.env.AUDIT_CHECKPOINT_HMAC_SECRET = validSecret;

    const resolved = getCheckpointHmacSecret();
    assert.equal(resolved, validSecret, 'Must return the trimmed dedicated secret');
  });

  // ---------------------------------------------------------------------------
  // 3. PRODUCTION WITH MISSING DEDICATED SECRET (FAIL CLOSED)
  // ---------------------------------------------------------------------------
  await t.test('3. Production with missing dedicated secret fails closed', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.AUDIT_CHECKPOINT_HMAC_SECRET;

    assert.throws(
      () => getCheckpointHmacSecret(),
      /SECURITY_CONFIGURATION_ERROR.*Mandatory AUDIT_CHECKPOINT_HMAC_SECRET is missing or invalid in production runtime/
    );
  });

  // ---------------------------------------------------------------------------
  // 4. PRODUCTION WITH WHITESPACE-ONLY SECRET (FAIL CLOSED)
  // ---------------------------------------------------------------------------
  await t.test('4. Production with whitespace-only secret fails closed', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUDIT_CHECKPOINT_HMAC_SECRET = '                                    '; // 36 spaces

    assert.throws(
      () => getCheckpointHmacSecret(),
      /SECURITY_CONFIGURATION_ERROR.*Mandatory AUDIT_CHECKPOINT_HMAC_SECRET is missing or invalid in production runtime/
    );
  });

  // ---------------------------------------------------------------------------
  // 5. PRODUCTION WITH SECRET SHORTER THAN 32 CHARACTERS (FAIL CLOSED)
  // ---------------------------------------------------------------------------
  await t.test('5. Production with secret shorter than 32 characters fails closed', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUDIT_CHECKPOINT_HMAC_SECRET = 'short_secret_only_24_chars';

    assert.throws(
      () => getCheckpointHmacSecret(),
      /minimum 32 non-whitespace characters required/
    );
  });

  // ---------------------------------------------------------------------------
  // 6. PRODUCTION WITH ONLY ERP_SESSION_SECRET (FAIL CLOSED)
  // ---------------------------------------------------------------------------
  await t.test('6. Production with only ERP_SESSION_SECRET fails closed (no fallback)', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.AUDIT_CHECKPOINT_HMAC_SECRET;
    process.env.ERP_SESSION_SECRET = 'a_very_long_session_secret_that_has_more_than_32_characters_long';

    assert.throws(
      () => getCheckpointHmacSecret(),
      /Fallback keys and internal salts are strictly prohibited/
    );
  });

  // ---------------------------------------------------------------------------
  // 7. PRODUCTION WITH HARDCODED FALLBACK UNAVAILABLE (FAIL CLOSED)
  // ---------------------------------------------------------------------------
  await t.test('7. Production with hardcoded fallback unavailable fails closed', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.AUDIT_CHECKPOINT_HMAC_SECRET;
    delete process.env.ERP_SESSION_SECRET;

    assert.throws(
      () => getCheckpointHmacSecret(),
      /SECURITY_CONFIGURATION_ERROR/
    );
  });

  // ---------------------------------------------------------------------------
  // 8. DEVELOPMENT / TEST WITHOUT DEDICATED SECRET (FALLBACK PERMITTED)
  // ---------------------------------------------------------------------------
  await t.test('8. Development without dedicated secret permits safe test harness fallback', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.NEXT_PUBLIC_ERP_ENV;
    delete process.env.AUDIT_CHECKPOINT_HMAC_SECRET;
    delete process.env.ERP_SESSION_SECRET;

    const fallback = getCheckpointHmacSecret();
    assert.equal(fallback, 'icon_tech_pro_enterprise_salt_2026', 'Test harness fallback allowed in test environment');
  });

  // ---------------------------------------------------------------------------
  // 9. CHECKPOINT SIGNING AND VERIFICATION WITH DEDICATED KEY
  // ---------------------------------------------------------------------------
  await t.test('9. Checkpoint signing and verification work with dedicated key', () => {
    process.env.NODE_ENV = 'test';
    const testSecret = 'test_secret_key_with_at_least_32_chars_length_12345';
    process.env.AUDIT_CHECKPOINT_HMAC_SECRET = testSecret;

    const mockCheckpoint = {
      checkpoint_id: 'CHK-TEST-001',
      block_height: 1,
      head_hash: 'abc123def456',
      timestamp: new Date().toISOString(),
      event_count: 5,
      signed_digest: '',
    };

    // Sign using dedicated key
    mockCheckpoint.signed_digest = crypto
      .createHmac('sha256', testSecret)
      .update(`${mockCheckpoint.checkpoint_id}|${mockCheckpoint.block_height}|${mockCheckpoint.head_hash}|${mockCheckpoint.timestamp}|${mockCheckpoint.event_count}`)
      .digest('hex');

    const result = verifyAuditCheckpoint(mockCheckpoint);
    assert.equal(result.isValid, true, 'Verification must succeed with matching dedicated key');

    // Verification fails if key does not match
    const invalidResult = verifyAuditCheckpoint(mockCheckpoint, 'different_override_key_that_does_not_match_32_chars');
    assert.equal(invalidResult.isValid, false, 'Verification must fail with mismatched key');
  });

  // ---------------------------------------------------------------------------
  // 10. HISTORICAL CHECKPOINTS VERIFIABLE WITH ORIGINAL KEY OVERRIDE
  // ---------------------------------------------------------------------------
  await t.test('10. Existing historical checkpoints remain verifiable with secretOverride', () => {
    process.env.NODE_ENV = 'production';
    const activeProdKey = 'active_production_key_generation_2_32_chars_minimum';
    const historicalKey = 'historical_key_generation_1_32_chars_minimum';

    process.env.AUDIT_CHECKPOINT_HMAC_SECRET = activeProdKey;

    const historicalCheckpoint = {
      checkpoint_id: 'CHK-HISTORICAL-001',
      block_height: 1,
      head_hash: 'genesis_head_hash_123456',
      timestamp: '2026-10-01T00:00:00.000Z',
      event_count: 10,
      signed_digest: '',
    };

    // Sign under historical key
    historicalCheckpoint.signed_digest = crypto
      .createHmac('sha256', historicalKey)
      .update(`${historicalCheckpoint.checkpoint_id}|${historicalCheckpoint.block_height}|${historicalCheckpoint.head_hash}|${historicalCheckpoint.timestamp}|${historicalCheckpoint.event_count}`)
      .digest('hex');

    // Active key should fail
    const activeResult = verifyAuditCheckpoint(historicalCheckpoint);
    assert.equal(activeResult.isValid, false, 'Historical checkpoint must not match active key if rotated');

    // Historical key override must succeed
    const historicalResult = verifyAuditCheckpoint(historicalCheckpoint, historicalKey);
    assert.equal(historicalResult.isValid, true, 'Historical checkpoint must verify cleanly with historical key');
  });
});
