import fs from 'fs';
import path from 'path';
import type { ZohoOAuthCredentials } from '@/types/zoho';

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
    trimmed === 'your_zoho_client_id' ||
    trimmed === 'your_zoho_client_secret'
  );
}

/**
 * Dynamically resolves environment variables for Zoho CRM OAuth.
 * If process.env has a placeholder or is missing, checks .env.local on disk so
 * credentials saved by the administrator are immediately picked up.
 */
export function getZohoOAuthCredentials(): ZohoOAuthCredentials & {
  rawClientId: string | null;
  rawClientSecret: string | null;
} {
  let clientId = process.env.ZOHO_CLIENT_ID?.trim() || null;
  let clientSecret = process.env.ZOHO_CLIENT_SECRET?.trim() || null;
  let redirectUri = process.env.ZOHO_REDIRECT_URI?.trim() || 'http://localhost:3000/api/integrations/zoho/callback';
  let accountsUrl = process.env.ZOHO_ACCOUNTS_URL?.trim() || 'https://accounts.zoho.in';
  let apiUrl = process.env.ZOHO_API_URL?.trim() || 'https://www.zohoapis.in';

  // Check if current process.env is missing or placeholder
  const isProcessIdPlaceholder = isPlaceholderCredential(clientId);
  const isProcessSecretPlaceholder = isPlaceholderCredential(clientSecret);

  // If missing or placeholder in memory, attempt to read live from .env.local
  if (!clientId || isProcessIdPlaceholder || !clientSecret || isProcessSecretPlaceholder) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
          const eqIdx = trimmed.indexOf('=');
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');

          if (key === 'ZOHO_CLIENT_ID') {
            clientId = val;
            if (!isPlaceholderCredential(val)) {
              process.env.ZOHO_CLIENT_ID = val;
            }
          }
          if (key === 'ZOHO_CLIENT_SECRET') {
            clientSecret = val;
            if (!isPlaceholderCredential(val)) {
              process.env.ZOHO_CLIENT_SECRET = val;
            }
          }
          if (key === 'ZOHO_REDIRECT_URI' && val) {
            redirectUri = val;
            process.env.ZOHO_REDIRECT_URI = val;
          }
          if (key === 'ZOHO_ACCOUNTS_URL' && val) {
            accountsUrl = val;
            process.env.ZOHO_ACCOUNTS_URL = val;
          }
          if (key === 'ZOHO_API_URL' && val) {
            apiUrl = val;
            process.env.ZOHO_API_URL = val;
          }
        }
      }
    } catch {
      // Fallback silently if file read fails
    }
  }

  // Strip trailing slashes from URLs
  accountsUrl = accountsUrl.replace(/\/+$/, '');
  apiUrl = apiUrl.replace(/\/+$/, '');

  const isClientPlaceholder = isPlaceholderCredential(clientId);
  const isSecretPlaceholder = isPlaceholderCredential(clientSecret);

  const hasClientId = Boolean(clientId && !isClientPlaceholder);
  const hasClientSecret = Boolean(clientSecret && !isSecretPlaceholder);
  const isPlaceholder = Boolean((clientId && isClientPlaceholder) || (clientSecret && isSecretPlaceholder));

  return {
    clientId: hasClientId ? clientId : null,
    clientSecret: hasClientSecret ? clientSecret : null,
    redirectUri,
    accountsUrl,
    apiUrl,
    hasClientId,
    hasClientSecret,
    isPlaceholder,
    rawClientId: clientId,
    rawClientSecret: clientSecret,
  };
}
