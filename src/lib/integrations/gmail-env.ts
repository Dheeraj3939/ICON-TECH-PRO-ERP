import fs from 'fs';
import path from 'path';

/**
 * Checks if an environment value is a placeholder or template value rather than real credentials.
 */
export function isPlaceholderCredential(val: string | undefined | null): boolean {
  if (!val || typeof val !== 'string') return true;
  const trimmed = val.trim().toLowerCase();
  if (trimmed.length === 0) return true;
  return (
    trimmed.includes('your_client_id') ||
    trimmed.includes('your-client-id') ||
    trimmed.includes('your_client_secret') ||
    trimmed.includes('your-client-secret') ||
    trimmed.includes('placeholder') ||
    trimmed.startsWith('<') ||
    trimmed.endsWith('>') ||
    trimmed === 'your_client_id_here.apps.googleusercontent.com' ||
    trimmed === 'your_client_secret_here'
  );
}

/**
 * Dynamically resolves environment variables for Gmail OAuth.
 * If process.env has a placeholder or is missing, checks .env.local on disk so
 * credentials saved by the user are immediately picked up without needing a server reboot.
 */
export function getGmailOAuthCredentials(): {
  clientId: string | null;
  clientSecret: string | null;
  redirectUri: string;
  hasClientId: boolean;
  hasClientSecret: boolean;
  isPlaceholder: boolean;
  rawClientId: string | null;
  rawClientSecret: string | null;
} {
  let clientId = process.env.GOOGLE_CLIENT_ID?.trim() || null;
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || null;
  const isUat = process.env.NEXT_PUBLIC_ERP_ENV?.trim().toUpperCase() === 'UAT';
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  const defaultOrigin = configuredOrigin || (isUat ? 'http://localhost:3001' : 'https://erp.icontechpro.in');
  const defaultRedirectUri = `${defaultOrigin.replace(/\/+$/, '')}/api/integrations/gmail/callback`;
  let redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || defaultRedirectUri;

  // Check if current process.env is missing or placeholder
  const isProcessIdPlaceholder = isPlaceholderCredential(clientId);
  const isProcessSecretPlaceholder = isPlaceholderCredential(clientSecret);

  // If missing or placeholder in memory, attempt to read live from .env.local
  if (!clientId || isProcessIdPlaceholder || !clientSecret || isProcessSecretPlaceholder) {
    try {
      const envFileName = isUat ? '.env.uat.local' : '.env.local';
      const envPath = path.resolve(process.cwd(), envFileName);
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
          const eqIdx = trimmed.indexOf('=');
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');

          if (key === 'GOOGLE_CLIENT_ID') {
            clientId = val;
            if (!isPlaceholderCredential(val)) {
              process.env.GOOGLE_CLIENT_ID = val;
            }
          }
          if (key === 'GOOGLE_CLIENT_SECRET') {
            clientSecret = val;
            if (!isPlaceholderCredential(val)) {
              process.env.GOOGLE_CLIENT_SECRET = val;
            }
          }
          if (key === 'GOOGLE_REDIRECT_URI' && val) {
            redirectUri = val;
            process.env.GOOGLE_REDIRECT_URI = val;
          }
        }
      }
    } catch {
      // Fallback silently if file read fails
    }
  }

  const isClientPlaceholder = isPlaceholderCredential(clientId);
  const isSecretPlaceholder = isPlaceholderCredential(clientSecret);

  const hasClientId = Boolean(clientId && !isClientPlaceholder);
  const hasClientSecret = Boolean(clientSecret && !isSecretPlaceholder);
  const isPlaceholder = Boolean((clientId && isClientPlaceholder) || (clientSecret && isSecretPlaceholder));

  return {
    clientId: hasClientId ? clientId : null,
    clientSecret: hasClientSecret ? clientSecret : null,
    redirectUri,
    hasClientId,
    hasClientSecret,
    isPlaceholder,
    rawClientId: clientId,
    rawClientSecret: clientSecret,
  };
}
