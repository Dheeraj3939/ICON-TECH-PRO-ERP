import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const PASS_SALT = 'icon_tech_pro_enterprise_salt_2026';

// Precomputed PBKDF2 SHA-512 hashes for legacy / fallback compatibility
const PRECOMPUTED_HASH = 'a5acfceafa58ac388a8440c08766bbf6c356f72c44304fba51436bfde0dbc13d1f05bceb7609e06ae8bcfe1177c72573fc3aec4f8a80a1001ff33174451772f5';

const STAFF_PASSWORD_HASHES: Record<string, string> = {
  // Official Staff Master Emails
  'icontechpro@gmail.com': PRECOMPUTED_HASH, // Borra Narsimulu (MD)
  'dheeraj@icontechpro.in': PRECOMPUTED_HASH, // B V Dheeraj Reddy (Admin / Sales)
  'vineet@icontechpro.in': PRECOMPUTED_HASH,  // B Vineet Babu (Sales Executive)
  'sales@icontechpro.in': PRECOMPUTED_HASH,   // Reshma (Sales Executive)
  'accounts@icontechpro.in': PRECOMPUTED_HASH,// Hemalath (Accounts)
  'service01@icontechpro.in': PRECOMPUTED_HASH,// Manisha (Office Assistant)
  // Backward-compatible test/demo aliases
  'md@icontechpro.in': PRECOMPUTED_HASH,
  'reshma@icontechpro.in': PRECOMPUTED_HASH,
  'admin@icontechpro.in': PRECOMPUTED_HASH,
  // Synthetic UAT-only test identities (RFC 2606 / RFC 6761 non-routable .invalid)
  'bdm-uat@example.invalid': PRECOMPUTED_HASH,
};

export function hashPassword(
  plainText: string,
  salt: string = PASS_SALT,
  iterations: number = 100000
): string {
  return crypto
    .pbkdf2Sync(plainText, salt, iterations, 64, 'sha512')
    .toString('hex');
}

export interface StoredCredentialRecord {
  user_id?: string;
  email: string;
  password_hash: string;
  password_algorithm: 'pbkdf2_sha512';
  created_at: string;
  updated_at: string;
  password_changed_at: string;
}

interface CredentialsStoreFile {
  credentials: Record<string, StoredCredentialRecord>;
  consumed_tokens: string[];
}

declare global {
  // eslint-disable-next-line no-var
  var __ICON_DYNAMIC_PASSWORD_HASHES__: Record<string, string> | undefined;
  // eslint-disable-next-line no-var
  var __ICON_CONSUMED_TOKENS__: Set<string> | undefined;
  // eslint-disable-next-line no-var
  var __ICON_PERSISTENT_STORE_LOADED__: boolean | undefined;
}

const STORE_PATH = path.resolve(process.cwd(), 'data', 'credentials-store.json');

function ensureDataDir(): void {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
  }
}

function loadPersistentStore(): void {
  if (globalThis.__ICON_PERSISTENT_STORE_LOADED__) return;

  if (!globalThis.__ICON_DYNAMIC_PASSWORD_HASHES__) {
    globalThis.__ICON_DYNAMIC_PASSWORD_HASHES__ = {};
  }
  if (!globalThis.__ICON_CONSUMED_TOKENS__) {
    globalThis.__ICON_CONSUMED_TOKENS__ = new Set();
  }

  try {
    ensureDataDir();
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      const data: CredentialsStoreFile = JSON.parse(raw);

      if (data.credentials && typeof data.credentials === 'object') {
        for (const [em, rec] of Object.entries(data.credentials)) {
          if (rec?.password_hash) {
            globalThis.__ICON_DYNAMIC_PASSWORD_HASHES__[em.toLowerCase().trim()] = rec.password_hash;
          }
        }
      }

      if (Array.isArray(data.consumed_tokens)) {
        for (const tok of data.consumed_tokens) {
          globalThis.__ICON_CONSUMED_TOKENS__.add(tok);
        }
      }
    }
  } catch (err) {
    console.warn('[CredentialsStore] Failed to read persistent store from disk:', err);
  }

  globalThis.__ICON_PERSISTENT_STORE_LOADED__ = true;
}

function savePersistentStore(): void {
  try {
    ensureDataDir();
    const currentHashes = globalThis.__ICON_DYNAMIC_PASSWORD_HASHES__ || {};
    const consumedArr: string[] = Array.from(globalThis.__ICON_CONSUMED_TOKENS__ || new Set<string>());

    let existingData: CredentialsStoreFile = { credentials: {}, consumed_tokens: [] };
    if (fs.existsSync(STORE_PATH)) {
      try {
        existingData = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
      } catch {}
    }

    const now = new Date().toISOString();
    for (const [em, hash] of Object.entries(currentHashes)) {
      const prev = existingData.credentials[em];
      existingData.credentials[em] = {
        user_id: prev?.user_id,
        email: em,
        password_hash: hash,
        password_algorithm: 'pbkdf2_sha512',
        created_at: prev?.created_at || now,
        updated_at: now,
        password_changed_at: prev?.password_changed_at || now,
      };
    }

    const tokenSet = new Set<string>(existingData.consumed_tokens || []);
    for (const tok of consumedArr) {
      tokenSet.add(tok);
    }
    existingData.consumed_tokens = Array.from(tokenSet);

    // Atomic write
    const tempPath = `${STORE_PATH}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(existingData, null, 2), 'utf8');
    fs.renameSync(tempPath, STORE_PATH);
  } catch (err) {
    console.warn('[CredentialsStore] Failed to write persistent store to disk:', err);
  }
}

function getDynamicHashes(): Record<string, string> {
  loadPersistentStore();
  return globalThis.__ICON_DYNAMIC_PASSWORD_HASHES__!;
}

function getConsumedTokens(): Set<string> {
  loadPersistentStore();
  return globalThis.__ICON_CONSUMED_TOKENS__!;
}

export interface VerifyCredentialResult {
  valid: boolean;
  matched: boolean;
  source: 'database' | 'fallback' | 'static';
  error?: string;
  isDbAuthoritative: boolean;
}

/**
 * Checks if a user has established an active custom/persistent password.
 */
export async function hasPersistentPassword(email: string): Promise<boolean> {
  const normalized = email.toLowerCase().trim();

  // Database-first check
  try {
    const { isSupabaseAvailable } = await import('@/lib/supabase/health');
    if (await isSupabaseAvailable()) {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('managed_user_credentials')
        .select('user_id')
        .eq('email', normalized)
        .maybeSingle();

      if (!error && data) return true;
    }
  } catch {}

  loadPersistentStore();
  const dynamic = getDynamicHashes();
  return Boolean(dynamic[normalized]);
}

/**
 * Synchronous backward-compatible check for persistent password in local cache.
 */
export function hasPersistentPasswordSync(email: string): boolean {
  loadPersistentStore();
  const normalized = email.toLowerCase().trim();
  const dynamic = getDynamicHashes();
  return Boolean(dynamic[normalized]);
}

/**
 * Persistently stores a user's PBKDF2 SHA-512 password hash.
 * DATABASE-FIRST: Awaits confirmed Supabase upsert before updating cache or returning success.
 */
export async function setStaffPassword(
  email: string,
  plainText: string,
  userId?: string
): Promise<{ success: boolean; hash?: string; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const salt = crypto.randomBytes(16).toString('hex');
  const iterations = 100000;
  const hash = hashPassword(plainText, salt, iterations);

  // 1. Await Supabase persistence into managed_user_credentials
  try {
    const { isSupabaseAvailable } = await import('@/lib/supabase/health');
    const isOnline = await isSupabaseAvailable();

    if (isOnline) {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const admin = createAdminClient();
      const now = new Date().toISOString();

      const { error: upsertError } = await admin.from('managed_user_credentials').upsert(
        {
          user_id: userId || `USR-${normalizedEmail}`,
          erp_login_email: normalizedEmail,
          email: normalizedEmail,
          password_hash: hash,
          salt: salt,
          algorithm: 'pbkdf2_sha512',
          password_algorithm: 'pbkdf2_sha512',
          iterations: 100000,
          password_changed_at: now,
          updated_at: now,
        },
        { onConflict: 'erp_login_email' }
      );

      if (upsertError) {
        console.error('[AUTH] Failed to persist credential to Supabase managed_user_credentials:', upsertError.message);
        return {
          success: false,
          error: `Database credential persistence failed: ${upsertError.message}. Password setup aborted.`,
        };
      }
    } else {
      console.warn('[AUTH] Supabase offline: writing credential to local fallback cache only');
    }
  } catch (err: any) {
    console.error('[AUTH] Database error during password persistence:', err.message);
    return {
      success: false,
      error: `Database connection error: ${err.message}. Password setup aborted.`,
    };
  }

  // 2. Only after confirmed DB response (or offline mode), update local memory and disk cache
  const dynamic = getDynamicHashes();
  dynamic[normalizedEmail] = hash;
  savePersistentStore();

  return { success: true, hash };
}

/**
 * Authoritative Database-First credential verification.
 * 1. Checks Supabase managed_user_credentials table.
 * 2. If user exists in DB, evaluates PBKDF2 hash using per-user salt and iterations (with legacy fallback).
 * 3. If DB is reachable and user is NOT in DB, checks static staff or rejects (NO fallback to JSON).
 * 4. Falls back to local JSON ONLY if database genuinely suffered network/infrastructure failure.
 */
export async function verifyUserCredentials(
  email: string,
  plainText: string
): Promise<VerifyCredentialResult> {
  const normalizedEmail = email.toLowerCase().trim();

  // 1. DATABASE-FIRST: Query Supabase managed_user_credentials
  let dbChecked = false;
  try {
    const { isSupabaseAvailable } = await import('@/lib/supabase/health');
    const isOnline = await isSupabaseAvailable();

    if (isOnline) {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const admin = createAdminClient();

      const { data, error } = await admin
        .from('managed_user_credentials')
        .select('password_hash, salt, iterations, user_id, erp_login_email, email')
        .or(`erp_login_email.eq.${normalizedEmail},email.eq.${normalizedEmail}`)
        .maybeSingle();

      if (!error) {
        dbChecked = true;

        if (data && data.password_hash) {
          // Found managed user in DB!
          const expectedHash = data.password_hash;
          const expBuf = Buffer.from(expectedHash, 'utf8');

          const targetSalt = (data.salt && data.salt.trim().length > 0) ? data.salt.trim() : PASS_SALT;
          const targetIterations = (typeof data.iterations === 'number' && data.iterations > 0) ? data.iterations : 100000;

          const candidate = hashPassword(plainText, targetSalt, targetIterations);
          const candidateBuf = Buffer.from(candidate, 'utf8');
          let valid = candidateBuf.length === expBuf.length && crypto.timingSafeEqual(candidateBuf, expBuf);

          // Backward-compatibility: If not valid and salt was PASS_SALT / empty, also check legacy 10,000 iterations
          if (!valid && (!data.salt || data.salt === PASS_SALT)) {
            const legacyCandidate = hashPassword(plainText, PASS_SALT, 10000);
            const legacyBuf = Buffer.from(legacyCandidate, 'utf8');
            valid = legacyBuf.length === expBuf.length && crypto.timingSafeEqual(legacyBuf, expBuf);
          }

          if (valid) {
            // DATABASE WINS: Sync local cache with authoritative hash
            const dynamic = getDynamicHashes();
            dynamic[normalizedEmail] = expectedHash;
            savePersistentStore();
            return { valid: true, matched: true, source: 'database', isDbAuthoritative: true };
          } else {
            return { valid: false, matched: true, source: 'database', isDbAuthoritative: true, error: 'Invalid password' };
          }
        } else {
          // DB is reachable, but user is NOT in managed_user_credentials!
          // Check if this is a legacy static staff member
          if (STAFF_PASSWORD_HASHES[normalizedEmail]) {
            const staticHash = STAFF_PASSWORD_HASHES[normalizedEmail];
            const expBuf = Buffer.from(staticHash, 'utf8');
            let candidate = hashPassword(plainText, PASS_SALT, 100000);
            let buf = Buffer.from(candidate, 'utf8');
            let valid = buf.length === expBuf.length && crypto.timingSafeEqual(buf, expBuf);
            if (!valid) {
              candidate = hashPassword(plainText, PASS_SALT, 10000);
              buf = Buffer.from(candidate, 'utf8');
              valid = buf.length === expBuf.length && crypto.timingSafeEqual(buf, expBuf);
            }
            return { valid, matched: true, source: 'static', isDbAuthoritative: true };
          }

          // User does NOT exist in DB and is NOT static staff.
          // DO NOT fall through to JSON! Prevent credential downgrade.
          return { valid: false, matched: false, source: 'database', isDbAuthoritative: true, error: 'User credential not found' };
        }
      } else {
        console.warn('[AUTH] Supabase managed_user_credentials query error:', error.message);
      }
    }
  } catch (err: any) {
    console.warn('[AUTH] Supabase connectivity failed during credential check:', err.message);
  }

  // 2. EMERGENCY OFFLINE FALLBACK:
  // Reached ONLY if Supabase is genuinely unreachable / offline
  console.warn(`[AUTH] Supabase unavailable. Checking emergency offline fallback for: ${normalizedEmail}`);
  const dynamic = getDynamicHashes();
  const fallbackHash = dynamic[normalizedEmail] || STAFF_PASSWORD_HASHES[normalizedEmail];
  if (!fallbackHash) {
    return { valid: false, matched: false, source: 'fallback', isDbAuthoritative: false, error: 'No offline credential available' };
  }

  const expBuf = Buffer.from(fallbackHash, 'utf8');
  let candidate = hashPassword(plainText, PASS_SALT, 100000);
  let actualBuf = Buffer.from(candidate, 'utf8');
  let valid = actualBuf.length === expBuf.length && crypto.timingSafeEqual(actualBuf, expBuf);
  if (!valid) {
    candidate = hashPassword(plainText, PASS_SALT, 10000);
    actualBuf = Buffer.from(candidate, 'utf8');
    valid = actualBuf.length === expBuf.length && crypto.timingSafeEqual(actualBuf, expBuf);
  }

  return { valid, matched: true, source: 'fallback', isDbAuthoritative: false };
}

/**
 * Synchronous staff password verification (used for local tests and fallback checks).
 */
export function verifyStaffPassword(email: string, plainText: string): boolean {
  const normalizedEmail = email.toLowerCase().trim();
  const dynamic = getDynamicHashes();
  const expectedHash = dynamic[normalizedEmail] || STAFF_PASSWORD_HASHES[normalizedEmail];
  if (!expectedHash) return false;

  const expBuf = Buffer.from(expectedHash, 'utf8');

  // Check 100,000 iterations
  const actualHash100k = hashPassword(plainText, PASS_SALT, 100000);
  const actualBuf100k = Buffer.from(actualHash100k, 'utf8');
  if (actualBuf100k.length === expBuf.length && crypto.timingSafeEqual(actualBuf100k, expBuf)) {
    return true;
  }

  // Check 10,000 iterations (legacy fallback)
  const actualHash10k = hashPassword(plainText, PASS_SALT, 10000);
  const actualBuf10k = Buffer.from(actualHash10k, 'utf8');
  if (actualBuf10k.length === expBuf.length && crypto.timingSafeEqual(actualBuf10k, expBuf)) {
    return true;
  }

  return false;
}

/**
 * Enterprise Password Complexity Requirements:
 * - At least 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character
 */
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];
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

  return {
    valid: errors.length === 0,
    errors,
  };
}

const TOKEN_SECRET = process.env.SESSION_SECRET || 'icon-tech-pro-enterprise-token-secret-2026';

export interface ExpiringTokenPayload {
  email: string;
  userId?: string;
  type: 'invite' | 'reset';
  exp: number;
}

/**
 * Generates an HMAC-signed single-use expiring token (default 24 hours).
 */
export function generateExpiringToken(
  payload: Omit<ExpiringTokenPayload, 'exp'>,
  ttlMs = 24 * 60 * 60 * 1000
): string {
  const exp = Date.now() + ttlMs;
  const fullPayload: ExpiringTokenPayload = { ...payload, exp };
  const jsonStr = JSON.stringify(fullPayload);
  const dataB64 = Buffer.from(jsonStr, 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(dataB64).digest('base64url');
  return `${dataB64}.${sig}`;
}

/**
 * Checks if an action token has already been consumed (Database-First).
 */
export async function isTokenConsumedAsync(token: string): Promise<boolean> {
  // 1. Fast in-memory check
  const inMemory = getConsumedTokens().has(token);
  if (inMemory) return true;

  // 2. Database query to consumed_action_tokens
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  try {
    const { isSupabaseAvailable } = await import('@/lib/supabase/health');
    if (await isSupabaseAvailable()) {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('consumed_action_tokens')
        .select('token_signature, token_hash')
        .or(`token_signature.eq.${token},token_hash.eq.${tokenHash}`)
        .maybeSingle();

      if (!error && data) {
        getConsumedTokens().add(token);
        savePersistentStore();
        return true;
      }
    }
  } catch (err) {
    console.warn('[AUTH] Failed to query consumed_action_tokens from DB:', err);
  }

  return false;
}

/**
 * Verifies and decodes an HMAC-signed token, enforcing expiration and database-backed single-use.
 */
export async function verifyExpiringTokenAsync(token: string): Promise<{
  valid: boolean;
  payload?: ExpiringTokenPayload;
  error?: string;
}> {
  if (!token || !token.includes('.')) {
    return { valid: false, error: 'Malformed or missing security token.' };
  }

  const [dataB64, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(dataB64).digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expSigBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expSigBuf.length || !crypto.timingSafeEqual(sigBuf, expSigBuf)) {
    return { valid: false, error: 'Invalid cryptographic signature on security token.' };
  }

  let payload: ExpiringTokenPayload;
  try {
    const jsonStr = Buffer.from(dataB64, 'base64url').toString('utf8');
    payload = JSON.parse(jsonStr);
  } catch {
    return { valid: false, error: 'Failed to decode token payload.' };
  }

  if (Date.now() > payload.exp) {
    return { valid: false, error: 'Security token has expired. Please request a new link.' };
  }

  // Database-backed single-use verification
  const consumed = await isTokenConsumedAsync(token);
  if (consumed) {
    return { valid: false, error: 'This security token has already been consumed (single-use).' };
  }

  return { valid: true, payload };
}

/**
 * Atomically marks a token as consumed in Supabase before marking locally.
 * Returns failure if database insert fails or token was already consumed.
 */
export async function consumeExpiringTokenAsync(token: string): Promise<{ success: boolean; error?: string }> {
  const verification = await verifyExpiringTokenAsync(token);
  if (!verification.valid) {
    return { success: false, error: verification.error || 'Token invalid or already consumed.' };
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // 1. Await database record in consumed_action_tokens
  try {
    const { isSupabaseAvailable } = await import('@/lib/supabase/health');
    if (await isSupabaseAvailable()) {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const admin = createAdminClient();
      const expiresAt = new Date(verification.payload?.exp || Date.now() + 86400000).toISOString();

      const { error } = await admin.from('consumed_action_tokens').insert({
        token_signature: token,
        token_hash: tokenHash,
        token_payload: JSON.stringify(verification.payload || {}),
        consumed_by_email: verification.payload?.email || null,
        action_type: verification.payload?.type || 'action',
        purpose: verification.payload?.type || 'action',
        expires_at: expiresAt,
      });

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: 'This security token has already been consumed (single-use concurrent collision).' };
        }
        console.error('[AUTH] Failed to record consumed token in DB:', error.message);
        return { success: false, error: `Failed to record consumed security token in database: ${error.message}` };
      }
    }
  } catch (err: any) {
    console.error('[AUTH] Error inserting consumed token in DB:', err.message);
    return { success: false, error: `Database unavailable to invalidate security token: ${err.message}` };
  }

  // 2. Mark in local cache only after DB confirms
  getConsumedTokens().add(token);
  savePersistentStore();

  return { success: true };
}

/**
 * Synchronous token verification for local tests and offline fallback.
 */
export function verifyExpiringToken(token: string): {
  valid: boolean;
  payload?: ExpiringTokenPayload;
  error?: string;
} {
  if (!token || !token.includes('.')) {
    return { valid: false, error: 'Malformed or missing security token.' };
  }

  const consumed = getConsumedTokens();
  if (consumed.has(token)) {
    return { valid: false, error: 'This security token has already been consumed (single-use).' };
  }

  const [dataB64, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(dataB64).digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expSigBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expSigBuf.length || !crypto.timingSafeEqual(sigBuf, expSigBuf)) {
    return { valid: false, error: 'Invalid cryptographic signature on security token.' };
  }

  try {
    const jsonStr = Buffer.from(dataB64, 'base64url').toString('utf8');
    const payload: ExpiringTokenPayload = JSON.parse(jsonStr);

    if (Date.now() > payload.exp) {
      return { valid: false, error: 'Security token has expired. Please request a new link.' };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'Failed to decode token payload.' };
  }
}

/**
 * Synchronous token consumption for local tests and offline fallback.
 */
export function consumeExpiringToken(token: string): boolean {
  const verification = verifyExpiringToken(token);
  if (!verification.valid) return false;
  getConsumedTokens().add(token);
  savePersistentStore();
  return true;
}

/**
 * Rehydrates local credential cache from authoritative Supabase managed_user_credentials.
 * Database entries overwrite local entries (DATABASE WINS).
 */
export async function rehydrateCredentialCacheFromDatabase(): Promise<number> {
  try {
    const { isSupabaseAvailable } = await import('@/lib/supabase/health');
    if (!(await isSupabaseAvailable())) return 0;

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    const { data, error } = await admin.from('managed_user_credentials').select('*');
    if (error || !data) return 0;

    loadPersistentStore();
    const dynamic = getDynamicHashes();

    for (const row of data) {
      const emailKey = (row.erp_login_email || row.email || '').toLowerCase().trim();
      if (emailKey && row.password_hash) {
        // DATABASE WINS: authoritative DB overwrite
        dynamic[emailKey] = row.password_hash;
      }
    }

    savePersistentStore();
    return data.length;
  } catch (err) {
    console.warn('[AUTH] Rehydration from Supabase failed:', err);
    return 0;
  }
}
