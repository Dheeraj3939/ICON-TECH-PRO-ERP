import crypto from 'crypto';

/**
 * Server-only cryptographic utilities for Zoho CRM OAuth & Token Security.
 * Implements AES-256-GCM authenticated encryption for refresh tokens at rest.
 * NEVER import this file into client-side components.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM recommended

function getEncryptionKey(): Buffer {
  const envKey = process.env.ZOHO_TOKEN_ENCRYPTION_KEY || process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  if (envKey && envKey.trim().length >= 32) {
    if (/^[0-9a-fA-F]{64}$/.test(envKey.trim())) {
      return Buffer.from(envKey.trim(), 'hex');
    }
    return crypto.createHash('sha256').update(envKey.trim()).digest();
  }

  // Fallback to hashing SESSION_SECRET or SUPABASE_SECRET_KEY
  const fallbackSecret =
    process.env.SESSION_SECRET ||
    process.env.SUPABASE_SECRET_KEY ||
    'ICON-TECH-PRO-ERP-ZOHO-ENC-FALLBACK-V9.1';
  return crypto.createHash('sha256').update(fallbackSecret).digest();
}

/**
 * Encrypt sensitive token using AES-256-GCM.
 */
export function encryptToken(token: string): { ciphertext: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    tag,
  };
}

/**
 * Decrypt token using AES-256-GCM with authentication tag validation.
 */
export function decryptToken(ciphertext: string, ivHex: string, tagHex: string): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Generate a cryptographically signed CSRF state parameter for OAuth 2.0 flow.
 */
export function generateOAuthState(userId: string): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(16).toString('hex');
  const payload = JSON.stringify({ userId, timestamp, random });
  const payloadBase64 = Buffer.from(payload).toString('base64url');

  const key = getEncryptionKey();
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(payloadBase64);
  const signature = hmac.digest('hex');

  return `${payloadBase64}.${signature}`;
}

/**
 * Verify and decode an OAuth state parameter.
 * Returns userId if valid, or null if tampered/expired (15 minute TTL).
 */
export function verifyOAuthState(stateString: string): { userId: string } | null {
  if (!stateString || !stateString.includes('.')) return null;

  const [payloadBase64, providedSig] = stateString.split('.');
  const key = getEncryptionKey();
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(payloadBase64);
  const expectedSig = hmac.digest('hex');

  if (providedSig !== expectedSig) return null;

  try {
    const jsonStr = Buffer.from(payloadBase64, 'base64url').toString('utf8');
    const data = JSON.parse(jsonStr);

    // 15-minute expiration
    const now = Date.now();
    if (!data.timestamp || now - data.timestamp > 15 * 60 * 1000) {
      return null;
    }

    if (!data.userId || typeof data.userId !== 'string') {
      return null;
    }

    return { userId: data.userId };
  } catch {
    return null;
  }
}
