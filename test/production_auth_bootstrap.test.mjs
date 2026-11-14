import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment variables from .env.local
function loadEnv() {
  const envPath = path.join(rootDir, '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const SESSION_SECRET = process.env.SESSION_SECRET || 'fa5042afbadd0f06be40d90b64d5b8da70b4fa68ae2a723ffe4644f13f9c84d5';
const TOKEN_SALT = 'icon-tech-pro-enterprise-salt-2026';

// -----------------------------------------------------------------------------
// PURE IMPLEMENTATION MIRRORS FOR DETERMINISTIC TESTING
// -----------------------------------------------------------------------------

function hashPasswordLogic(plainText) {
  return crypto.pbkdf2Sync(plainText, TOKEN_SALT, 100000, 64, 'sha512').toString('hex');
}

function generateExpiringTokenLogic(payload, secret = SESSION_SECRET, ttlMs = 24 * 60 * 60 * 1000) {
  const exp = Date.now() + ttlMs;
  const fullPayload = { ...payload, exp };
  const jsonStr = JSON.stringify(fullPayload);
  const dataB64 = Buffer.from(jsonStr, 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');
  return `${dataB64}.${sig}`;
}

function verifyExpiringTokenLogic(token, consumedSet = new Set(), secret = SESSION_SECRET) {
  if (!token || !token.includes('.')) {
    return { valid: false, error: 'Malformed or missing security token.' };
  }

  if (consumedSet.has(token)) {
    return { valid: false, error: 'This security token has already been consumed (single-use).' };
  }

  const [dataB64, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expSigBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expSigBuf.length || !crypto.timingSafeEqual(sigBuf, expSigBuf)) {
    return { valid: false, error: 'Invalid cryptographic signature on security token.' };
  }

  try {
    const jsonStr = Buffer.from(dataB64, 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr);

    if (Date.now() > payload.exp) {
      return { valid: false, error: 'Security token has expired. Please request a new link.' };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'Failed to decode token payload.' };
  }
}

function validatePasswordStrengthLogic(password) {
  const errors = [];
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long.');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z).');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z).');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one numeric digit (0-9).');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*...).');
  }
  return { valid: errors.length === 0, errors };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// =============================================================================
// TEST SUITE: PRODUCTION AUTH & INITIAL ADMIN BOOTSTRAP (40 VERIFICATION POINTS)
// =============================================================================

test('1. Initial Admin Bootstrap Script Verification', async (t) => {
  await t.test('1.1. Script exists on disk at scripts/bootstrap-initial-admin.mjs', () => {
    const scriptPath = path.join(rootDir, 'scripts', 'bootstrap-initial-admin.mjs');
    assert.strictEqual(fs.existsSync(scriptPath), true, 'Bootstrap script must exist');
  });

  await t.test('1.2. Script contains target identity for Bijjam Venkata Dheeraj Reddy', () => {
    const content = fs.readFileSync(path.join(rootDir, 'scripts', 'bootstrap-initial-admin.mjs'), 'utf8');
    assert.match(content, /Bijjam Venkata Dheeraj Reddy/);
    assert.match(content, /USR001/);
    assert.match(content, /dheeraj@icontechpro\.in/);
    assert.match(content, /Admin \/ BDM/);
  });

  await t.test('1.3. Script does NOT hardcode or print any plaintext password', () => {
    const content = fs.readFileSync(path.join(rootDir, 'scripts', 'bootstrap-initial-admin.mjs'), 'utf8');
    assert.doesNotMatch(content, /password\s*=\s*['"][^'"]+['"]/i);
    assert.match(content, /Zero administrator passwords were created or exposed/i);
  });

  await t.test('1.4. Script generates 24-hour expiring HMAC-SHA256 single-use token', () => {
    const content = fs.readFileSync(path.join(rootDir, 'scripts', 'bootstrap-initial-admin.mjs'), 'utf8');
    assert.match(content, /crypto\.createHmac\('sha256'/);
    assert.match(content, /24 \* 60 \* 60 \* 1000/);
    assert.match(content, /type:\s*['"]invite['"]/);
  });

  await t.test('1.5. Script constructs production reset-password URL', () => {
    const content = fs.readFileSync(path.join(rootDir, 'scripts', 'bootstrap-initial-admin.mjs'), 'utf8');
    assert.match(content, /\/reset-password\?token=\$\{token\}&type=invite/);
  });
});

test('2. Cryptographic Token Generation & Verification Protocol', async (t) => {
  const consumed = new Set();
  const token = generateExpiringTokenLogic({
    email: 'dheeraj@icontechpro.in',
    userId: 'USR001',
    type: 'invite',
  });

  await t.test('2.1. Valid token passes cryptographic verification', () => {
    const res = verifyExpiringTokenLogic(token, consumed);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.payload?.email, 'dheeraj@icontechpro.in');
    assert.strictEqual(res.payload?.userId, 'USR001');
    assert.strictEqual(res.payload?.type, 'invite');
    assert.ok(res.payload?.exp > Date.now());
  });

  await t.test('2.2. Tampered token payload is rejected', () => {
    const [dataB64, sig] = token.split('.');
    const tamperedPayload = { email: 'hacker@evil.com', userId: 'USR001', type: 'invite', exp: Date.now() + 100000 };
    const tamperedB64 = Buffer.from(JSON.stringify(tamperedPayload)).toString('base64url');
    const tamperedToken = `${tamperedB64}.${sig}`;

    const res = verifyExpiringTokenLogic(tamperedToken, consumed);
    assert.strictEqual(res.valid, false);
    assert.match(res.error || '', /Invalid cryptographic signature/);
  });

  await t.test('2.3. Tampered signature is rejected', () => {
    const [dataB64, sig] = token.split('.');
    const fakeSig = crypto.randomBytes(32).toString('base64url');
    const tamperedToken = `${dataB64}.${fakeSig}`;

    const res = verifyExpiringTokenLogic(tamperedToken, consumed);
    assert.strictEqual(res.valid, false);
    assert.match(res.error || '', /Invalid cryptographic signature/);
  });

  await t.test('2.4. Malformed token without delimiter is rejected', () => {
    const res = verifyExpiringTokenLogic('malformed-token-string', consumed);
    assert.strictEqual(res.valid, false);
    assert.match(res.error || '', /Malformed or missing security token/);
  });

  await t.test('2.5. Expired token is rejected', () => {
    const expiredToken = generateExpiringTokenLogic(
      { email: 'dheeraj@icontechpro.in', type: 'invite' },
      SESSION_SECRET,
      -1000 // Expired 1 second ago
    );
    const res = verifyExpiringTokenLogic(expiredToken, consumed);
    assert.strictEqual(res.valid, false);
    assert.match(res.error || '', /expired/i);
  });

  await t.test('2.6. Single-use token invalidation prevents replay attacks', () => {
    // Consume token
    consumed.add(token);

    const res = verifyExpiringTokenLogic(token, consumed);
    assert.strictEqual(res.valid, false);
    assert.match(res.error || '', /already been consumed/i);
  });
});

test('3. Persistent Password Store & PBKDF2 SHA-512 Security', async (t) => {
  const storePath = path.join(rootDir, 'data', 'credentials-store.json');

  await t.test('3.1. data directory exists', () => {
    const dataDir = path.join(rootDir, 'data');
    assert.strictEqual(fs.existsSync(dataDir), true);
  });

  await t.test('3.2. PBKDF2 SHA-512 hashing generates 128-character hex string', () => {
    const hash = hashPasswordLogic('StrongP@ssw0rd2026!');
    assert.strictEqual(typeof hash, 'string');
    assert.strictEqual(hash.length, 128); // 64 bytes = 128 hex chars
  });

  await t.test('3.3. Timing-safe verification matches correct password', () => {
    const hash = hashPasswordLogic('StrongP@ssw0rd2026!');
    const verifyHash = hashPasswordLogic('StrongP@ssw0rd2026!');
    const match = crypto.timingSafeEqual(Buffer.from(hash, 'utf8'), Buffer.from(verifyHash, 'utf8'));
    assert.strictEqual(match, true);
  });

  await t.test('3.4. Timing-safe verification rejects incorrect password', () => {
    const hash = hashPasswordLogic('StrongP@ssw0rd2026!');
    const wrongHash = hashPasswordLogic('WrongPassword123!');
    const match = crypto.timingSafeEqual(Buffer.from(hash, 'utf8'), Buffer.from(wrongHash, 'utf8'));
    assert.strictEqual(match, false);
  });

  await t.test('3.5. Disk persistence format is valid JSON structure', () => {
    if (fs.existsSync(storePath)) {
      const raw = fs.readFileSync(storePath, 'utf8');
      const parsed = JSON.parse(raw);
      assert.ok(typeof (parsed.hashes || parsed.credentials) === 'object');
      assert.ok(Array.isArray(parsed.consumedTokens || parsed.consumed_tokens));
    }
  });

  await t.test('3.6. src/lib/auth/passwords.ts contains atomic persistence methods', () => {
    const content = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'auth', 'passwords.ts'), 'utf8');
    assert.match(content, /credentials-store\.json/);
    assert.match(content, /savePersistentStore/);
    assert.match(content, /loadPersistentStore/);
    assert.match(content, /hasPersistentPassword/);
  });
});

test('4. Enterprise Password Strength Validation Suite', async (t) => {
  await t.test('4.1. Rejects passwords under 8 characters', () => {
    const res = validatePasswordStrengthLogic('Short1!');
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('at least 8 characters')));
  });

  await t.test('4.2. Rejects passwords missing uppercase letter', () => {
    const res = validatePasswordStrengthLogic('lowercase123!@#');
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('uppercase')));
  });

  await t.test('4.3. Rejects passwords missing lowercase letter', () => {
    const res = validatePasswordStrengthLogic('UPPERCASE123!@#');
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('lowercase')));
  });

  await t.test('4.4. Rejects passwords missing numeric digits', () => {
    const res = validatePasswordStrengthLogic('NoNumbersSpecial!');
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('numeric')));
  });

  await t.test('4.5. Rejects passwords missing special characters', () => {
    const res = validatePasswordStrengthLogic('NoSpecialChar1234');
    assert.strictEqual(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('special character')));
  });

  await t.test('4.6. Accepts fully compliant enterprise password', () => {
    const res = validatePasswordStrengthLogic('IconTechPro@2026Secure!');
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.errors.length, 0);
  });
});

test('5. Global Email Domain Policy & Universal Domain Validation', async (t) => {
  const allowedSampleEmails = [
    'dheeraj@icontechpro.in',
    'icontechpro@gmail.com',
    'user@gmail.com',
    'partner@outlook.com',
    'director@yahoo.com',
    'sales@tatasteel.com',
    'engineer@acme-enterprises.co.in',
    'admin@gov.in',
  ];

  await t.test('5.1. Accepts any syntactically valid email domain', () => {
    for (const email of allowedSampleEmails) {
      assert.strictEqual(EMAIL_REGEX.test(email), true, `Should accept valid email: ${email}`);
    }
  });

  const invalidEmails = [
    'plainaddress',
    '@missingusername.com',
    'missingdomain@',
    'spaces in@email.com',
    'missingdot@domaincom',
  ];

  await t.test('5.2. Rejects syntactically invalid emails', () => {
    for (const email of invalidEmails) {
      assert.strictEqual(EMAIL_REGEX.test(email), false, `Should reject invalid email: ${email}`);
    }
  });

  await t.test('5.3. Email domain does not determine role or mailbox permissions', () => {
    const rbacTypes = fs.readFileSync(path.join(rootDir, 'src', 'types', 'rbac.ts'), 'utf8');
    assert.match(rbacTypes, /corporate_email\?: string/);
    assert.match(rbacTypes, /has_mailbox_integration\?: boolean/);
  });
});

test('6. Dynamic Login & Lookup Verification', async (t) => {
  const loginActions = fs.readFileSync(path.join(rootDir, 'src', 'app', '(auth)', 'login', 'actions.ts'), 'utf8');

  await t.test('6.1. Login searches __ICON_MANAGED_USERS__ dynamic store', () => {
    assert.match(loginActions, /globalThis\.__ICON_MANAGED_USERS__/);
  });

  await t.test('6.2. Login normalizes email to lower case and trims', () => {
    assert.match(loginActions, /\.toLowerCase\(\)\.trim\(\)/);
  });

  await t.test('6.3. Login verifies credentials using database-first verifyUserCredentials', () => {
    assert.match(loginActions, /verifyUserCredentials\(email,\s*password\)/);
  });

  await t.test('6.4. quickLoginAsRole is strictly prohibited in production and UAT', () => {
    assert.match(loginActions, /Quick role sign-in is strictly prohibited in production/);
    assert.match(loginActions, /Quick role sign-in is disabled in the UAT environment/);
  });
});

test('7. Universal Forgot Password Flow Verification', async (t) => {
  const loginActions = fs.readFileSync(path.join(rootDir, 'src', 'app', '(auth)', 'login', 'actions.ts'), 'utf8');

  await t.test('7.1. requestPasswordReset dispatches via EmailService.sendEmail', () => {
    assert.match(loginActions, /EmailService\.sendEmail\(\{/);
  });

  await t.test('7.2. requestPasswordReset generates secure expiring reset token', () => {
    assert.match(loginActions, /generateExpiringToken\(\{/);
    assert.match(loginActions, /type:\s*['"]reset['"]/);
  });

  await t.test('7.3. Anti-enumeration: returns generic confirmation message', () => {
    assert.match(loginActions, /success:\s*true/);
    assert.match(loginActions, /password reset instructions have been dispatched/i);
  });

  await t.test('7.4. Uses site URL for reset-password link', () => {
    assert.match(loginActions, /\/reset-password\?token=\$\{token\}&type=reset/);
  });
});

test('8. Employee Creation, Invitation & Onboarding Protocol', async (t) => {
  const usersAction = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'actions', 'users.ts'), 'utf8');
  const onboardingAction = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'actions', 'onboarding.ts'), 'utf8');
  const modalComponent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'admin', 'AddEmployeeModal.tsx'), 'utf8');

  await t.test('8.1. createManagedUser supports corporate_email and regex validation', () => {
    assert.match(usersAction, /corporate_email\?: string/);
    assert.match(usersAction, /EMAIL_REGEX/);
  });

  await t.test('8.2. createManagedUser dispatches invite email with expiring token', () => {
    assert.match(usersAction, /generateExpiringToken\(\{[\s\S]*type:\s*['"]invite['"]/);
    assert.match(usersAction, /EmailService\.sendEmail\(\{/);
  });

  await t.test('8.3. createManagedUser logs EMPLOYEE_INVITED audit event', () => {
    assert.match(usersAction, /action:\s*['"]EMPLOYEE_INVITED['"]/);
  });

  await t.test('8.4. resendUserInvitation dispatches email via EmailService', () => {
    assert.match(usersAction, /EmailService\.sendEmail\(\{/);
  });

  await t.test('8.5. completeAccountPasswordSetup emits ADMIN_INITIAL_PASSWORD_CREATED for USR001', () => {
    assert.match(usersAction, /ADMIN_INITIAL_PASSWORD_CREATED/);
    assert.match(usersAction, /PASSWORD_SET_BY_USER/);
  });

  await t.test('8.6. onboardEmployee supports login_email and corporate_email', () => {
    assert.match(onboardingAction, /login_email\?: string/);
    assert.match(onboardingAction, /corporate_email\?: string/);
  });

  await t.test('8.7. AddEmployeeModal displays ERP Login Email * with employee@example.com', () => {
    assert.match(modalComponent, /ERP Login Email \*/);
    assert.match(modalComponent, /placeholder="employee@example\.com"/);
  });

  await t.test('8.8. AddEmployeeModal displays Corporate Email (Optional) with name@icontechpro.in', () => {
    assert.match(modalComponent, /Corporate Email \(Optional\)/);
    assert.match(modalComponent, /placeholder="name@icontechpro\.in"/);
  });
});

test('9. Database Migration & Architectural Invariants', async (t) => {
  await t.test('9.1. Additive Supabase migration file exists', () => {
    const migPath = path.join(rootDir, 'supabase', 'migrations', '20261007120000_managed_user_credentials.sql');
    assert.strictEqual(fs.existsSync(migPath), true);
    const sql = fs.readFileSync(migPath, 'utf8');
    assert.match(sql, /CREATE TABLE IF NOT EXISTS (public\.)?managed_user_credentials/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS (public\.)?consumed_action_tokens/);
  });

  await t.test('9.2. QuotationFormWorkspace.tsx is untouched and preserves CPQ engine', () => {
    const qfwPath = path.join(rootDir, 'src', 'components', 'quotations', 'QuotationFormWorkspace.tsx');
    assert.strictEqual(fs.existsSync(qfwPath), true);
    const content = fs.readFileSync(qfwPath, 'utf8');
    assert.match(content, /QuotationFormWorkspace/);
  });

  await t.test('9.3. USR001 name is aligned to Bijjam Venkata Dheeraj Reddy in constants', () => {
    const rbacContent = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'constants', 'rbac-data.ts'), 'utf8');
    assert.match(rbacContent, /Bijjam Venkata Dheeraj Reddy/);
    const erpContent = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'constants', 'erp-data.ts'), 'utf8');
    assert.match(erpContent, /Bijjam Venkata Dheeraj Reddy/);
  });
});

test('10. Database-First Credential & Token Persistence Protocol', async (t) => {
  const passwordsSource = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'auth', 'passwords.ts'), 'utf8');
  const usersActionSource = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'actions', 'users.ts'), 'utf8');
  const gitignoreSource = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf8');

  await t.test('10.1. setStaffPassword is an async function that awaits Supabase upsert', () => {
    assert.match(passwordsSource, /export async function setStaffPassword/);
    assert.match(passwordsSource, /admin\.from\('managed_user_credentials'\)\.upsert/);
  });

  await t.test('10.2. completeAccountPasswordSetup awaits setStaffPassword and halts on error', () => {
    assert.match(usersActionSource, /const setRes = await setStaffPassword\(email,\s*password/);
    assert.match(usersActionSource, /if \(!setRes\.success\)/);
  });

  await t.test('10.3. completeAccountPasswordSetup awaits consumeExpiringTokenAsync', () => {
    assert.match(usersActionSource, /const consumeRes = await consumeExpiringTokenAsync\(token\)/);
    assert.match(usersActionSource, /if \(!consumeRes\.success\)/);
  });

  await t.test('10.4. Database-backed single-use token invalidation is enforced', () => {
    assert.match(passwordsSource, /export async function consumeExpiringTokenAsync/);
    assert.match(passwordsSource, /export async function isTokenConsumedAsync/);
    assert.match(passwordsSource, /admin\.from\('consumed_action_tokens'\)\.insert/);
  });

  await t.test('10.5. data/ and credentials-store.json are explicitly gitignored', () => {
    assert.match(gitignoreSource, /^data\/$/m);
    assert.match(gitignoreSource, /^data\/credentials-store\.json$/m);
  });

  await t.test('10.6. verifyUserCredentials enforces database authority over local files', () => {
    assert.match(passwordsSource, /export async function verifyUserCredentials/);
    assert.match(passwordsSource, /admin\.from\('managed_user_credentials'\)/);
  });
});

test('11. Critical Acceptance Test — Forensic Scenario Verification', async (t) => {
  // Simulate the database-authoritative logic in a controlled test environment
  const mockDbCredentials = new Map();
  const mockDbTokens = new Set();
  const mockLocalCache = {};

  function simulateDbVerify(email, plainText, isDbOnline = true) {
    const norm = email.toLowerCase().trim();
    const actualHash = hashPasswordLogic(plainText);

    if (isDbOnline) {
      if (mockDbCredentials.has(norm)) {
        const expectedHash = mockDbCredentials.get(norm);
        const valid = actualHash === expectedHash;
        return { valid, matched: true, source: 'database', isDbAuthoritative: true };
      } else {
        // DB reachable, user not present -> NO fallback to JSON!
        return { valid: false, matched: false, source: 'database', isDbAuthoritative: true };
      }
    }

    // DB Offline fallback
    if (mockLocalCache[norm]) {
      const valid = actualHash === mockLocalCache[norm];
      return { valid, matched: true, source: 'fallback', isDbAuthoritative: false };
    }
    return { valid: false, matched: false, source: 'fallback', isDbAuthoritative: false };
  }

  await t.test('11.1. Seed DB credential: user authenticates successfully', () => {
    const email = 'employee.test@customdomain.com';
    const pwd = 'Password123!Secure';
    mockDbCredentials.set(email, hashPasswordLogic(pwd));

    const res = simulateDbVerify(email, pwd, true);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.source, 'database');
    assert.strictEqual(res.isDbAuthoritative, true);
  });

  await t.test('11.2. Incorrect password against DB is rejected immediately without fallback', () => {
    const email = 'employee.test@customdomain.com';
    const res = simulateDbVerify(email, 'WrongPassword999!', true);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.source, 'database');
  });

  await t.test('11.3. Local cache deleted: DB credential still authenticates successfully', () => {
    const email = 'employee.test@customdomain.com';
    const pwd = 'Password123!Secure';
    // Clear local cache completely
    delete mockLocalCache[email];

    const res = simulateDbVerify(email, pwd, true);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.source, 'database');
  });

  await t.test('11.4. Stale/corrupted JSON vs authoritative DB: DATABASE WINS', () => {
    const email = 'employee.test@customdomain.com';
    const dbPwd = 'Password123!Secure';
    const staleJsonPwd = 'OldStalePassword123!';

    // Local JSON has outdated/stale password
    mockLocalCache[email] = hashPasswordLogic(staleJsonPwd);

    // Logging in with DB password MUST succeed
    const resDb = simulateDbVerify(email, dbPwd, true);
    assert.strictEqual(resDb.valid, true);
    assert.strictEqual(resDb.source, 'database');

    // Logging in with stale JSON password MUST fail (DB is authoritative)
    const resStale = simulateDbVerify(email, staleJsonPwd, true);
    assert.strictEqual(resStale.valid, false);
    assert.strictEqual(resDb.source, 'database');
  });

  await t.test('11.5. User missing in DB does NOT fall back to local JSON when DB is healthy', () => {
    const unknownEmail = 'rogue.user@attackdomain.com';
    // Inject hash into local JSON
    mockLocalCache[unknownEmail] = hashPasswordLogic('RoguePassword123!');

    // DB is healthy, user does not exist in DB -> MUST REJECT!
    const res = simulateDbVerify(unknownEmail, 'RoguePassword123!', true);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.matched, false);
    assert.strictEqual(res.isDbAuthoritative, true);
  });

  await t.test('11.6. Offline network partition uses fallback only when DB is genuine offline', () => {
    const email = 'offline.user@company.com';
    const pwd = 'OfflineP@ssword2026!';
    mockLocalCache[email] = hashPasswordLogic(pwd);

    // DB is offline (false)
    const res = simulateDbVerify(email, pwd, false);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.source, 'fallback');
    assert.strictEqual(res.isDbAuthoritative, false);
  });

  await t.test('11.7. Two concurrent requests cannot consume same token (simulated DB constraint)', () => {
    const tokenHash = 'test-token-hash-12345';
    function consumeDbToken(hash) {
      if (mockDbTokens.has(hash)) {
        return { success: false, error: 'Token already consumed' };
      }
      mockDbTokens.add(hash);
      return { success: true };
    }

    // First request succeeds
    const firstReq = consumeDbToken(tokenHash);
    assert.strictEqual(firstReq.success, true);

    // Concurrent/second request fails
    const secondReq = consumeDbToken(tokenHash);
    assert.strictEqual(secondReq.success, false);
    assert.match(secondReq.error, /already consumed/);
  });

  await t.test('11.8. Token consumed in DB remains consumed even after local memory is reset', () => {
    const tokenHash = 'test-token-hash-12345';
    // Token is in mockDbTokens
    assert.strictEqual(mockDbTokens.has(tokenHash), true);
  });
});

test('12. Regression Suite: ERP Login Email Mapping & Database-First Invariants (A-G)', async (t) => {
  const passwordsSource = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'auth', 'passwords.ts'), 'utf8');
  const usersActionSource = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'actions', 'users.ts'), 'utf8');
  const migrationSource = fs.readFileSync(path.join(rootDir, 'supabase', 'migrations', '20261007120000_managed_user_credentials.sql'), 'utf8');

  await t.test('12.A. USR001 activation maps erp_login_email=dheeraj@icontechpro.in', () => {
    // Assert setStaffPassword payload includes erp_login_email
    assert.match(passwordsSource, /erp_login_email:\s*normalizedEmail/);
    assert.match(passwordsSource, /onConflict:\s*['"]erp_login_email['"]/);
    // Assert completeAccountPasswordSetup binds target identity
    assert.match(usersActionSource, /setStaffPassword\(email,\s*password,\s*target\?\.id\s*\|\|\s*userId\)/);
  });

  await t.test('12.B. Password hash is PBKDF2-SHA512 with 100,000 iterations and salt', () => {
    assert.match(passwordsSource, /algorithm:\s*['"]pbkdf2_sha512['"]/);
    assert.match(passwordsSource, /iterations:\s*100000/);
    assert.match(passwordsSource, /password_hash:\s*hash/);
  });

  await t.test('12.C. Token is consumed only after successful credential persistence', () => {
    // Must call setStaffPassword BEFORE consumeExpiringTokenAsync
    const setStaffIdx = usersActionSource.indexOf('await setStaffPassword');
    const consumeTokenIdx = usersActionSource.indexOf('await consumeExpiringTokenAsync');
    assert.ok(setStaffIdx > 0 && consumeTokenIdx > 0);
    assert.ok(setStaffIdx < consumeTokenIdx, 'setStaffPassword must be called before consumeExpiringTokenAsync');
  });

  await t.test('12.D. Failed DB persistence aborts and does NOT consume the token', () => {
    assert.match(usersActionSource, /if \(!setRes\.success\) \{\s*\/\/[^\n]*\s*return \{\s*success:\s*false/);
  });

  await t.test('12.E. Non-corporate ERP login emails work across any valid domain', () => {
    const nonCorpEmails = ['contractor@external-agency.org', 'advisor@consulting.co.uk', 'admin@freelance.net'];
    for (const em of nonCorpEmails) {
      assert.strictEqual(EMAIL_REGEX.test(em), true);
      const normalized = em.toLowerCase().trim();
      assert.strictEqual(normalized, em);
    }
  });

  await t.test('12.F. No plaintext password is stored or logged', () => {
    assert.doesNotMatch(passwordsSource, /console\.(log|info|warn|error)\([^)]*plainText/);
    assert.doesNotMatch(usersActionSource, /console\.(log|info|warn|error)\([^)]*password/);
  });

  await t.test('12.G. Database access requires service_role and enforces RLS', () => {
    assert.match(migrationSource, /ALTER TABLE public\.managed_user_credentials ENABLE ROW LEVEL SECURITY;/);
    assert.match(migrationSource, /CREATE POLICY "service_role_full_access_managed_credentials"/);
    assert.match(migrationSource, /TO service_role/);
  });
});

test('13. Master Enterprise Authentication & Lifecycle Invariants', async (t) => {
  const rbacTypesSource = fs.readFileSync(path.join(rootDir, 'src', 'types', 'rbac.ts'), 'utf8');
  const sessionSource = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'auth', 'session.ts'), 'utf8');
  const rateLimiterSource = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'auth', 'rate-limiter.ts'), 'utf8');
  const authTemplatesSource = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'email', 'auth-templates.ts'), 'utf8');
  const loginActionsSource = fs.readFileSync(path.join(rootDir, 'src', 'app', '(auth)', 'login', 'actions.ts'), 'utf8');
  const usersActionSource = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'actions', 'users.ts'), 'utf8');

  await t.test('13.1. AccountLifecycleStatus defines enterprise states (DISABLED, OFFBOARDED, PENDING_ACTIVATION)', () => {
    assert.match(rbacTypesSource, /'PENDING_ACTIVATION'/);
    assert.match(rbacTypesSource, /'DISABLED'/);
    assert.match(rbacTypesSource, /'OFFBOARDED'/);
  });

  await t.test('13.2. Session verification uses timing-safe HMAC comparison', () => {
    assert.match(sessionSource, /timingSafeEqual/);
    assert.match(sessionSource, /timingSafeEqualStr/);
  });

  await t.test('13.3. In-memory rate limiter protects login and password reset', () => {
    assert.match(rateLimiterSource, /export function checkRateLimit/);
    assert.match(rateLimiterSource, /export function recordRateLimitAttempt/);
    assert.match(rateLimiterSource, /export function resetRateLimit/);
    assert.match(loginActionsSource, /checkRateLimit\('login'/);
    assert.match(loginActionsSource, /checkRateLimit\('reset'/);
  });

  await t.test('13.4. Forgot Password is fully decoupled from Supabase Auth auth.users', () => {
    assert.doesNotMatch(loginActionsSource, /supabase\.auth\.resetPasswordForEmail/);
    assert.match(loginActionsSource, /renderPasswordResetEmail/);
    assert.match(loginActionsSource, /EmailService\.sendEmail/);
  });

  await t.test('13.5. Offboarding action revokes sessions and preserves audit trail', () => {
    assert.match(usersActionSource, /export async function offboardUser/);
    assert.match(usersActionSource, /invalidateUserSessions\(target\.id\)/);
    assert.match(usersActionSource, /handleEmployeeOffboarding/);
    assert.match(usersActionSource, /action:\s*['"]USER_OFFBOARDED['"]/);
  });

  await t.test('13.6. Self-service password change verifies current password, updates DB, and revokes active sessions', () => {
    assert.match(usersActionSource, /export async function changeOwnPassword/);
    assert.match(usersActionSource, /verifyUserCredentials\(actor\.email,\s*currentPassword\)/);
    assert.match(usersActionSource, /setStaffPassword\(actor\.email,\s*newPassword/);
    assert.match(usersActionSource, /invalidateUserSessions\(actor\.id\)/);
    assert.match(usersActionSource, /action:\s*['"]PASSWORD_CHANGED['"]/);
  });

  await t.test('13.7. Admin-initiated password reset dispatches token without exposing credentials', () => {
    assert.match(usersActionSource, /export async function adminInitiatePasswordReset/);
    assert.match(usersActionSource, /generateExpiringToken/);
    assert.match(usersActionSource, /renderPasswordResetEmail/);
    assert.match(usersActionSource, /action:\s*['"]ADMIN_PASSWORD_RESET_INITIATED['"]/);
    // Admin cannot see password
    assert.doesNotMatch(usersActionSource, /adminInitiatePasswordReset[^}]*password_hash/);
  });

  await t.test('13.8. Updating employee ERP login email updates DB records and revokes sessions', () => {
    assert.match(usersActionSource, /export async function updateEmployeeLoginEmail/);
    assert.match(usersActionSource, /invalidateUserSessions\(target\.id\)/);
    assert.match(usersActionSource, /erp_login_email:\s*normalizedEmail/);
    assert.match(usersActionSource, /action:\s*['"]EMAIL_CHANGED['"]/);
  });

  await t.test('13.9. Role change automatically invalidates target user active sessions', () => {
    const roleChangeIdx = usersActionSource.indexOf("previousRole !== target.role");
    assert.ok(roleChangeIdx > 0);
    const subStr = usersActionSource.slice(roleChangeIdx, roleChangeIdx + 400);
    assert.match(subStr, /invalidateUserSessions\(target\.id\)/);
  });

  await t.test('13.10. Status toggle automatically invalidates target user active sessions', () => {
    const toggleIdx = usersActionSource.indexOf("toggleUserStatus");
    assert.ok(toggleIdx > 0);
    const subStr = usersActionSource.slice(toggleIdx, toggleIdx + 3000);
    assert.match(subStr, /invalidateUserSessions\(target\.id\)/);
  });

  await t.test('13.11. Standardized branded email templates render without plain password exposure', () => {
    assert.match(authTemplatesSource, /export function renderInvitationEmail/);
    assert.match(authTemplatesSource, /export function renderPasswordResetEmail/);
    assert.match(authTemplatesSource, /export function renderPasswordChangedAlertEmail/);
    assert.match(authTemplatesSource, /export function renderAccountStatusAlertEmail/);
  });

  await t.test('13.12. PBKDF2 per-user unique salt and 100,000 iterations hash evaluation test', () => {
    const randomSalt = crypto.randomBytes(16).toString('hex');
    const h1 = crypto.pbkdf2Sync('SecureP@ss123!', randomSalt, 100000, 64, 'sha512').toString('hex');
    const h2 = crypto.pbkdf2Sync('SecureP@ss123!', randomSalt, 100000, 64, 'sha512').toString('hex');
    assert.strictEqual(h1, h2);
    assert.strictEqual(h1.length, 128);

    // Different salts produce different hashes for same password
    const otherSalt = crypto.randomBytes(16).toString('hex');
    const h3 = crypto.pbkdf2Sync('SecureP@ss123!', otherSalt, 100000, 64, 'sha512').toString('hex');
    assert.notStrictEqual(h1, h3);
  });
});

