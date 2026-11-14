import { NextResponse, type NextRequest } from 'next/server';
import { verifyOAuthState } from '@/lib/integrations/gmail-crypto';
import { getGmailOAuthCredentials } from '@/lib/integrations/gmail-env';
import { saveGmailOAuthTokens } from '@/lib/integrations/gmail-token';
import { logAuditEvent } from '@/lib/audit/logger';
import { getAuthenticatedUser } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const searchParams = url.searchParams;

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  // 0. Resolve credentials and safely determine browser redirect origin from configured redirectUri
  const { clientId, clientSecret, redirectUri: envRedirectUri, hasClientId, hasClientSecret } = getGmailOAuthCredentials();

  const forwardedHost = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '').split(',')[0].trim();
  const isKnownCloudHost = /^(uat\.icontechpro\.in|erp\.icontechpro\.in|icon-erp-uat-web-production\.up\.railway\.app)$/i.test(forwardedHost);
  const redirectUri = isKnownCloudHost
    ? `https://${forwardedHost}/api/integrations/gmail/callback`
    : envRedirectUri;

  let redirectOrigin: string;
  try {
    const parsedRedirect = new URL(redirectUri);
    redirectOrigin = parsedRedirect.origin;
  } catch {
    redirectOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'https://erp.icontechpro.in';
  }

  if (redirectOrigin.includes('0.0.0.0')) {
    redirectOrigin = redirectOrigin.replace('0.0.0.0', 'localhost');
  }

  const baseRedirectUrl = new URL('/dashboard/settings/integrations', redirectOrigin);

  // 1. Handle error returned from Google
  if (errorParam) {
    const errorDescription = searchParams.get('error_description') || errorParam;
    await logAuditEvent({
      userName: 'System',
      action: 'GMAIL_OAUTH_FAILED',
      module: 'INTEGRATIONS',
      details: `Google OAuth authorization was declined or returned an error: ${errorDescription}`,
    });

    baseRedirectUrl.searchParams.set('error', `google_oauth_${errorParam}`);
    return NextResponse.redirect(baseRedirectUrl);
  }

  // 2. Validate authorization code
  if (!code) {
    baseRedirectUrl.searchParams.set('error', 'missing_authorization_code');
    return NextResponse.redirect(baseRedirectUrl);
  }

  // 3. Validate CSRF state
  if (!state) {
    baseRedirectUrl.searchParams.set('error', 'missing_oauth_state');
    return NextResponse.redirect(baseRedirectUrl);
  }

  const verifiedState = verifyOAuthState(state);
  if (!verifiedState) {
    await logAuditEvent({
      userName: 'Security Guard',
      action: 'GMAIL_OAUTH_FAILED',
      module: 'INTEGRATIONS',
      details: 'Rejected Google OAuth callback: Invalid or expired CSRF state signature',
    });

    baseRedirectUrl.searchParams.set('error', 'invalid_csrf_state');
    return NextResponse.redirect(baseRedirectUrl);
  }

  // 4. Retrieve current user or state user
  const currentUser = await getAuthenticatedUser();
  const userId = currentUser?.id || verifiedState.userId;
  const userName = currentUser?.name || 'Administrator';

  // 5. Exchange code for tokens
  if (!hasClientId || !hasClientSecret || !clientId || !clientSecret) {
    baseRedirectUrl.searchParams.set('error', 'server_oauth_credentials_missing');
    return NextResponse.redirect(baseRedirectUrl);
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        redirect_uri: redirectUri.trim(),
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      console.error('Google token exchange failed:', errBody);

      await logAuditEvent({
        userName,
        action: 'GMAIL_OAUTH_FAILED',
        module: 'INTEGRATIONS',
        details: `Token exchange with Google failed: ${tokenResponse.status} - ${errBody.slice(0, 200)}`,
      });

      baseRedirectUrl.searchParams.set('error', 'token_exchange_failed');
      return NextResponse.redirect(baseRedirectUrl);
    }

    const tokenData = await tokenResponse.json();

    if (!tokenData.refresh_token) {
      // In some cases if prompt=consent was omitted or previously approved, Google does not return refresh_token
      await logAuditEvent({
        userName,
        action: 'GMAIL_OAUTH_FAILED',
        module: 'INTEGRATIONS',
        details: 'Google OAuth callback succeeded but no refresh token was issued. Re-consent required.',
      });

      baseRedirectUrl.searchParams.set('error', 'missing_refresh_token_reconsent_required');
      return NextResponse.redirect(baseRedirectUrl);
    }

    // 6. Save encrypted tokens securely on server with granted scopes
    const grantedScopes = tokenData.scope ? tokenData.scope.split(' ') : ['https://www.googleapis.com/auth/gmail.modify'];
    await saveGmailOAuthTokens({
      refreshToken: tokenData.refresh_token,
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in,
      userId,
      userName,
      scopes: grantedScopes,
    });

    baseRedirectUrl.searchParams.set('success', 'gmail_connected');
    return NextResponse.redirect(baseRedirectUrl);
  } catch (err: any) {
    console.error('Unexpected error in Gmail callback:', err);

    await logAuditEvent({
      userName,
      action: 'GMAIL_OAUTH_FAILED',
      module: 'INTEGRATIONS',
      details: `Exception in Gmail OAuth callback handler: ${err.message}`,
    });

    baseRedirectUrl.searchParams.set('error', 'callback_internal_error');
    return NextResponse.redirect(baseRedirectUrl);
  }
}
