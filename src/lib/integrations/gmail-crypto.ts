import crypto from 'crypto';

/**
 * Server-only cryptographic utilities for Gmail OAuth & Token Security.
 * Implements AES-256-GCM authenticated encryption for refresh tokens at rest.
 * NEVER import this file into client-side components.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM recommended

function getEncryptionKey(): Buffer {
  const envKey = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  if (envKey && envKey.trim().length >= 32) {
    // If a hex or plain key is provided, normalize to 32 bytes
    if (/^[0-9a-fA-F]{64}$/.test(envKey.trim())) {
      return Buffer.from(envKey.trim(), 'hex');
    }
    return crypto.createHash('sha256').update(envKey.trim()).digest();
  }

  // Fallback to hashing SESSION_SECRET or SUPABASE_SECRET_KEY
  const fallbackSecret = process.env.SESSION_SECRET || process.env.SUPABASE_SECRET_KEY || 'ICON-TECH-PRO-ERP-GMAIL-ENC-FALLBACK-V9.1';
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

    return { userId: data.userId };
  } catch {
    return null;
  }
}

/**
 * Create an RFC 2822 formatted email message and encode it in base64url for Gmail API.
 * Supports To, CC, BCC, Reply-To, Subject, HTML, Plain text, and Attachments.
 */
export function createRfc2822RawMessage(params: {
  from: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
  subject: string;
  body?: string;
  text?: string;
  html?: string;
  isHtml?: boolean;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
    encoding?: 'base64' | 'utf-8';
  }>;
}): string {
  const toHeader = Array.isArray(params.to) ? params.to.join(', ') : params.to;
  const ccHeader = params.cc ? (Array.isArray(params.cc) ? params.cc.join(', ') : params.cc) : undefined;
  const bccHeader = params.bcc ? (Array.isArray(params.bcc) ? params.bcc.join(', ') : params.bcc) : undefined;

  const textBody = params.text || (!params.isHtml ? params.body : undefined);
  const htmlBody = params.html || (params.isHtml ? params.body : undefined);
  const hasAttachments = Boolean(params.attachments && params.attachments.length > 0);

  const headers: string[] = [
    `From: ${params.from}`,
    `To: ${toHeader}`,
  ];

  if (ccHeader) headers.push(`Cc: ${ccHeader}`);
  if (bccHeader) headers.push(`Bcc: ${bccHeader}`);
  if (params.replyTo) headers.push(`Reply-To: ${params.replyTo}`);
  if (params.inReplyTo) headers.push(`In-Reply-To: ${params.inReplyTo}`);
  if (params.references) headers.push(`References: ${params.references}`);
  headers.push(`Subject: =?UTF-8?B?${Buffer.from(params.subject).toString('base64')}?=`);
  headers.push('MIME-Version: 1.0');

  const randomBoundary = () => `==_ICON_MIME_${Date.now()}_${crypto.randomBytes(8).toString('hex')}_==`;

  if (hasAttachments) {
    const mixedBoundary = randomBoundary();
    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
    headers.push('');

    const parts: string[] = [];

    // Body part (alternative or single)
    if (textBody && htmlBody) {
      const altBoundary = randomBoundary();
      parts.push(`--${mixedBoundary}`);
      parts.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
      parts.push('');
      parts.push(`--${altBoundary}`);
      parts.push('Content-Type: text/plain; charset=UTF-8');
      parts.push('Content-Transfer-Encoding: base64');
      parts.push('');
      parts.push(Buffer.from(textBody, 'utf8').toString('base64'));
      parts.push(`--${altBoundary}`);
      parts.push('Content-Type: text/html; charset=UTF-8');
      parts.push('Content-Transfer-Encoding: base64');
      parts.push('');
      parts.push(Buffer.from(htmlBody, 'utf8').toString('base64'));
      parts.push(`--${altBoundary}--`);
    } else {
      const isHtml = Boolean(htmlBody);
      const content = htmlBody || textBody || '';
      parts.push(`--${mixedBoundary}`);
      parts.push(`Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset=UTF-8`);
      parts.push('Content-Transfer-Encoding: base64');
      parts.push('');
      parts.push(Buffer.from(content, 'utf8').toString('base64'));
    }

    // Attachment parts
    for (const att of params.attachments!) {
      const mimeType = att.contentType || 'application/octet-stream';
      let base64Content: string;
      if (Buffer.isBuffer(att.content)) {
        base64Content = att.content.toString('base64');
      } else if (att.encoding === 'base64') {
        base64Content = att.content;
      } else {
        base64Content = Buffer.from(att.content, 'utf8').toString('base64');
      }

      parts.push(`--${mixedBoundary}`);
      parts.push(`Content-Type: ${mimeType}; name="${att.filename}"`);
      parts.push(`Content-Disposition: attachment; filename="${att.filename}"`);
      parts.push('Content-Transfer-Encoding: base64');
      parts.push('');
      parts.push(base64Content);
    }

    parts.push(`--${mixedBoundary}--`);
    const fullMessage = headers.join('\r\n') + '\r\n' + parts.join('\r\n');
    return Buffer.from(fullMessage, 'utf8').toString('base64url');
  }

  // No attachments - alternative HTML + Plain text
  if (textBody && htmlBody) {
    const altBoundary = randomBoundary();
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    headers.push('');

    const parts: string[] = [
      `--${altBoundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(textBody, 'utf8').toString('base64'),
      `--${altBoundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(htmlBody, 'utf8').toString('base64'),
      `--${altBoundary}--`,
    ];

    const fullMessage = headers.join('\r\n') + '\r\n' + parts.join('\r\n');
    return Buffer.from(fullMessage, 'utf8').toString('base64url');
  }

  // Single plain or html
  const isHtml = Boolean(htmlBody);
  const content = htmlBody || textBody || '';
  headers.push(`Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset=UTF-8`);
  headers.push('Content-Transfer-Encoding: base64');
  headers.push('');
  headers.push(Buffer.from(content, 'utf8').toString('base64'));

  const fullMessage = headers.join('\r\n');
  return Buffer.from(fullMessage, 'utf8').toString('base64url');
}
