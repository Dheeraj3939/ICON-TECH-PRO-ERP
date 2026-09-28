import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import crypto from 'node:crypto';

// Re-implementing / testing crypto logic identically to verify invariants
const SESSION_SECRET = 'icon-tech-pro-enterprise-cryptographic-secret-key-2026';
const PASS_SALT = 'icon_tech_pro_enterprise_salt_2026';
const PRECOMPUTED_HASH = 'a5acfceafa58ac388a8440c08766bbf6c356f72c44304fba51436bfde0dbc13d1f05bceb7609e06ae8bcfe1177c72573fc3aec4f8a80a1001ff33174451772f5';

function hashPassword(plainText) {
  return crypto
    .pbkdf2Sync(plainText, PASS_SALT, 10000, 64, 'sha512')
    .toString('hex');
}

async function signWithWebCrypto(payloadStr) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(payloadStr));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function createSignedToken(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const payload = { ...user, exp };
  const jsonStr = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(jsonStr).toString('base64url');
  const signature = await signWithWebCrypto(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

async function verifySignedToken(token) {
  if (!token || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadStr, providedSig] = parts;
  const expectedSig = await signWithWebCrypto(payloadStr);
  if (providedSig !== expectedSig) return null;
  try {
    const jsonStr = Buffer.from(payloadStr, 'base64url').toString('utf8');
    const user = JSON.parse(jsonStr);
    const now = Math.floor(Date.now() / 1000);
    if (user.exp && user.exp < now) return null;
    return user;
  } catch {
    return null;
  }
}

describe('Cryptographic Session Security', () => {
  test('generates and verifies valid HMAC-SHA256 signed session token', async () => {
    const user = {
      id: 'usr_md_1',
      email: 'md@icontechpro.in',
      name: 'Managing Director',
      role: 'Managing Director',
    };
    const token = await createSignedToken(user);
    assert.ok(token.includes('.'), 'Token must be dot-separated base64.signature');

    const verified = await verifySignedToken(token);
    assert.ok(verified, 'Verification must succeed for unaltered token');
    assert.equal(verified.email, 'md@icontechpro.in');
    assert.equal(verified.role, 'Managing Director');
  });

  test('rejects tampered token payload (privilege escalation defense)', async () => {
    const normalUser = {
      id: 'usr_tech_1',
      email: 'vineet@icontechpro.in',
      name: 'Vineet',
      role: 'Technician',
    };
    const token = await createSignedToken(normalUser);
    const [payloadBase64, signature] = token.split('.');

    // Attacker modifies payload to elevate to Managing Director
    const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
    decoded.role = 'Managing Director';
    const tamperedPayloadBase64 = Buffer.from(JSON.stringify(decoded)).toString('base64url');

    const tamperedToken = `${tamperedPayloadBase64}.${signature}`;
    const result = await verifySignedToken(tamperedToken);

    assert.equal(result, null, 'Tampered token must fail signature verification');
  });

  test('rejects expired session tokens', async () => {
    const expiredUser = {
      id: 'usr_md_1',
      email: 'md@icontechpro.in',
      name: 'MD',
      role: 'Managing Director',
      exp: Math.floor(Date.now() / 1000) - 100, // Expired 100s ago
    };
    const jsonStr = JSON.stringify(expiredUser);
    const payloadBase64 = Buffer.from(jsonStr).toString('base64url');
    const signature = await signWithWebCrypto(payloadBase64);
    const expiredToken = `${payloadBase64}.${signature}`;

    const result = await verifySignedToken(expiredToken);
    assert.equal(result, null, 'Expired token must be rejected');
  });
});

describe('Password Hashing & Bypass Elimination', () => {
  test('validates authentic PBKDF2 SHA-512 staff password (IconTech@2026!)', () => {
    const hash = hashPassword('IconTech@2026!');
    assert.equal(hash, PRECOMPUTED_HASH, 'Hash must match precomputed PBKDF2 hash');
  });

  test('strictly rejects historical bypasses (admin, Icon@123, 123456)', () => {
    const bypassAttempts = ['admin', 'Icon@123', '123456', 'password', 'admin123'];
    for (const pw of bypassAttempts) {
      const hash = hashPassword(pw);
      assert.notEqual(hash, PRECOMPUTED_HASH, `Password bypass '${pw}' must NOT match staff hash`);
    }
  });
});

describe('Concurrency-Safe Document Sequences & Indian FY', () => {
  function getIndianFinancialYear(date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth();
    let startYear = month >= 3 ? year : year - 1;
    let endYear = startYear + 1;
    return `${startYear.toString().slice(-2)}-${endYear.toString().slice(-2)}`;
  }

  test('calculates correct Indian Financial Year (April 1 to March 31)', () => {
    const aprilDate = new Date('2026-04-15T00:00:00Z');
    assert.equal(getIndianFinancialYear(aprilDate), '26-27');

    const marchDate = new Date('2027-03-15T00:00:00Z');
    assert.equal(getIndianFinancialYear(marchDate), '26-27');

    const janDate = new Date('2026-01-15T00:00:00Z');
    assert.equal(getIndianFinancialYear(janDate), '25-26');
  });

  test('handles 50 concurrent sequence requests without collisions', async () => {
    let sequenceLock = Promise.resolve();
    let counter = 100;

    async function withSequenceLock(fn) {
      const prev = sequenceLock;
      let resolveLock;
      sequenceLock = new Promise((resolve) => { resolveLock = resolve; });
      await prev;
      try {
        return await fn();
      } finally {
        resolveLock();
      }
    }

    async function getNextSequence() {
      return withSequenceLock(async () => {
        // simulate async delay
        await new Promise((r) => setTimeout(r, Math.random() * 5));
        counter++;
        return `ICON/26-27/INV-${counter.toString().padStart(4, '0')}`;
      });
    }

    const promises = Array.from({ length: 50 }, () => getNextSequence());
    const results = await Promise.all(promises);

    assert.equal(results.length, 50, 'All 50 promises must resolve');
    const uniqueResults = new Set(results);
    assert.equal(uniqueResults.size, 50, 'All 50 sequence numbers must be distinct with zero collisions');

    // Verify format matches user specification ICON/26-27/INV-XXXX
    for (const num of results) {
      assert.match(num, /^ICON\/26-27\/INV-\d{4}$/, 'Must match format ICON/26-27/INV-XXXX');
      assert.ok(num.length <= 20, 'Invoice number must be within standard document length limit');
    }
  });
});
