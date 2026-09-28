import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { generateOAuthState } from '@/lib/integrations/gmail-crypto';
import { getGmailOAuthCredentials } from '@/lib/integrations/gmail-env';
import { logAuditEvent } from '@/lib/audit/logger';

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.modify';
const TARGET_ACCOUNT_EMAIL = 'icontechpro@gmail.com';

/**
 * GET /api/integrations/gmail/connect
 * OAuth 2.0 Authorization Endpoint for Gmail Integration (LOCAL/UAT).
 * 
 * Flow:
 * 1. Checks user authentication & executive role ('Managing Director', 'Admin / BDM').
 * 2. Validates GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET presence in .env.local (and verifies not placeholder).
 * 3. Generates cryptographic anti-CSRF state token (HMAC-SHA256 with 15-minute TTL).
 * 4. Builds Google OAuth consent URL with access_type=offline and prompt=consent.
 * 5. Logs audit event and redirects browser to Google.
 */
export async function GET(request: NextRequest) {
  const baseRedirectUrl = new URL('/dashboard/settings/integrations', request.url);

  // 1. Verify User Authentication
  const user = await getAuthenticatedUser();
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnUrl', '/dashboard/settings/integrations');
    return NextResponse.redirect(loginUrl);
  }

  // 2. Enforce Role Authority
  const allowedRoles = ['Managing Director', 'Admin / BDM'];
  if (!allowedRoles.includes(user.role)) {
    await logAuditEvent({
      userName: user.name,
      action: 'GMAIL_OAUTH_FAILED',
      module: 'INTEGRATIONS',
      details: `Unauthorized attempt to initiate Gmail OAuth by user with role: ${user.role}`,
    });
    baseRedirectUrl.searchParams.set('error', 'unauthorized_role');
    return NextResponse.redirect(baseRedirectUrl);
  }

  // 3. Verify Server Environment Credentials (with placeholder check)
  const {
    clientId,
    clientSecret,
    redirectUri,
    hasClientId,
    hasClientSecret,
    isPlaceholder,
  } = getGmailOAuthCredentials();

  if (isPlaceholder) {
    baseRedirectUrl.searchParams.set('error', 'placeholder_credentials');
    return NextResponse.redirect(baseRedirectUrl);
  }

  if (!hasClientId || !clientId) {
    baseRedirectUrl.searchParams.set('error', 'missing_client_id');
    return NextResponse.redirect(baseRedirectUrl);
  }

  if (!hasClientSecret || !clientSecret) {
    baseRedirectUrl.searchParams.set('error', 'missing_client_secret');
    return NextResponse.redirect(baseRedirectUrl);
  }

  // 4. Generate Anti-CSRF Cryptographic State
  const state = generateOAuthState(user.id);

  // 5. Construct Google OAuth 2.0 Authorization URL
  const params = new URLSearchParams({
    client_id: clientId.trim(),
    redirect_uri: redirectUri.trim(),
    response_type: 'code',
    scope: GMAIL_SCOPE,
    access_type: 'offline', // Mandatory to receive refresh_token
    prompt: 'consent', // Mandatory to ensure refresh_token is returned even if previously authorized
    state,
    login_hint: TARGET_ACCOUNT_EMAIL,
  });

  const authorizationUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  // 6. Log Audit Event
  await logAuditEvent({
    userName: user.name,
    action: 'GMAIL_OAUTH_INITIATED',
    module: 'INTEGRATIONS',
    details: `Initiated Google OAuth authorization flow for ${TARGET_ACCOUNT_EMAIL} via GET /api/integrations/gmail/connect`,
  });

  // 7. Redirect to Google Consent Screen
  return NextResponse.redirect(authorizationUrl);
}
