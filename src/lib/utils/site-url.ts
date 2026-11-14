import { headers } from 'next/headers';

const ALLOWED_CLOUD_HOST_REGEX =
  /^(uat\.icontechpro\.in|erp\.icontechpro\.in|icon-erp-uat-web-production\.up\.railway\.app|localhost(:\d+)?|127\.0\.0\.1(:\d+)?)$/i;

/**
 * Resolves the authoritative external base URL for OAuth callbacks, password reset links,
 * and employee invitation links. Prefers the incoming allowlisted request host so both
 * Railway *.up.railway.app URLs and custom domains work seamlessly.
 */
export async function getResolvedSiteUrl(fallbackOrigin?: string): Promise<string> {
  try {
    const h = await headers();
    const rawHost = (h.get('x-forwarded-host') || h.get('host') || '').split(',')[0].trim();
    if (rawHost && ALLOWED_CLOUD_HOST_REGEX.test(rawHost)) {
      const protoHeader = (h.get('x-forwarded-proto') || '').split(',')[0].trim();
      const isLocal = rawHost.startsWith('localhost') || rawHost.startsWith('127.0.0.1');
      const proto = isLocal ? protoHeader || 'http' : 'https';
      return `${proto}://${rawHost}`;
    }
  } catch {
    // headers() unavailable outside request context (e.g., CLI scripts / unit tests)
  }

  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    fallbackOrigin?.trim();

  if (envUrl && !envUrl.includes('0.0.0.0')) {
    return envUrl.replace(/\/+$/, '');
  }

  return 'https://icon-erp-uat-web-production.up.railway.app';
}
