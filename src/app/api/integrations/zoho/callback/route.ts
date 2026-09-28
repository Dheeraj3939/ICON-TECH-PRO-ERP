import { NextResponse, type NextRequest } from 'next/server';
import { verifyOAuthState } from '@/lib/integrations/zoho-crypto';
import { getZohoOAuthCredentials } from '@/lib/integrations/zoho-env';
import { saveZohoOAuthTokens } from '@/lib/actions/zoho';
import { logAuditEvent } from '@/lib/audit/logger';
import { getAuthenticatedUser } from '@/lib/auth/session';
import type { ZohoTokenResponse } from '@/types/zoho';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const searchParams = url.searchParams;

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');
  const accountsServerParam = searchParams.get('accounts-server');

  // 0. Resolve credentials and safely determine browser redirect origin from configured ZOHO_REDIRECT_URI
  // NEVER use request.url which may inherit 0.0.0.0 binding from next start -H 0.0.0.0
  const {
    clientId,
    clientSecret,
    redirectUri,
    accountsUrl,
    apiUrl,
    hasClientId,
    hasClientSecret,
  } = getZohoOAuthCredentials();

  let redirectOrigin: string;
  try {
    const parsedRedirect = new URL(redirectUri);
    redirectOrigin = parsedRedirect.origin;
  } catch {
    redirectOrigin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }

  // Safety net: 0.0.0.0 is an unroutable bind address that causes ERR_ADDRESS_INVALID in browsers
  if (redirectOrigin.includes('0.0.0.0')) {
    redirectOrigin = redirectOrigin.replace('0.0.0.0', 'localhost');
  }

  const baseRedirectUrl = new URL('/dashboard/settings/integrations', redirectOrigin);

  // 1. Handle error returned from Zoho
  if (errorParam) {
    const errorDescription = searchParams.get('error_description') || errorParam;
    await logAuditEvent({
      userName: 'System',
      action: 'ZOHO_OAUTH_FAILED',
      module: 'INTEGRATIONS',
      details: `Zoho CRM OAuth authorization returned an error: ${errorDescription}`,
    });

    baseRedirectUrl.searchParams.set('error', `zoho_oauth_${errorParam}`);
    return NextResponse.redirect(baseRedirectUrl);
  }

  // 2. Validate authorization code
  if (!code) {
    baseRedirectUrl.searchParams.set('error', 'missing_authorization_code');
    return NextResponse.redirect(baseRedirectUrl);
  }

  // 3. Validate CSRF state parameter
  if (!state) {
    baseRedirectUrl.searchParams.set('error', 'missing_oauth_state');
    return NextResponse.redirect(baseRedirectUrl);
  }

  const verifiedState = verifyOAuthState(state);
  if (!verifiedState) {
    await logAuditEvent({
      userName: 'Security Guard',
      action: 'ZOHO_OAUTH_FAILED',
      module: 'INTEGRATIONS',
      details: 'Rejected Zoho CRM OAuth callback: Invalid or expired CSRF state signature',
    });

    baseRedirectUrl.searchParams.set('error', 'invalid_csrf_state');
    return NextResponse.redirect(baseRedirectUrl);
  }

  // 4. Retrieve current user session or state user
  const currentUser = await getAuthenticatedUser();
  const userId = currentUser?.id || verifiedState.userId;
  const userName = currentUser?.name || 'Administrator';

  // 5. Check credentials for token exchange
  if (!hasClientId || !hasClientSecret || !clientId || !clientSecret) {
    baseRedirectUrl.searchParams.set('error', 'server_oauth_credentials_missing');
    return NextResponse.redirect(baseRedirectUrl);
  }

  // Use accounts-server from callback if present and valid, otherwise fallback to configured accountsUrl
  const resolvedAccountsUrl = accountsServerParam && accountsServerParam.startsWith('https://')
    ? accountsServerParam.replace(/\/+$/, '')
    : accountsUrl;

  try {
    // 6. Server-side token exchange with Zoho Accounts Server
    const tokenEndpoint = `${resolvedAccountsUrl}/oauth/v2/token`;
    const tokenResponse = await fetch(tokenEndpoint, {
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
      console.error('Zoho token exchange failed HTTP status:', tokenResponse.status, errBody);

      await logAuditEvent({
        userName,
        action: 'ZOHO_OAUTH_FAILED',
        module: 'INTEGRATIONS',
        details: `Token exchange with Zoho failed: HTTP ${tokenResponse.status}`,
      });

      baseRedirectUrl.searchParams.set('error', 'zoho_token_exchange_failed');
      return NextResponse.redirect(baseRedirectUrl);
    }

    const tokenData: ZohoTokenResponse = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Zoho token exchange returned error payload:', tokenData.error);
      await logAuditEvent({
        userName,
        action: 'ZOHO_OAUTH_FAILED',
        module: 'INTEGRATIONS',
        details: `Zoho token endpoint returned error: ${tokenData.error}`,
      });

      baseRedirectUrl.searchParams.set('error', `zoho_token_error_${tokenData.error}`);
      return NextResponse.redirect(baseRedirectUrl);
    }

    if (!tokenData.refresh_token) {
      // In Zoho, if consent was already granted previously and prompt=consent was omitted,
      // Zoho may return only an access_token. Re-consent is required to obtain a persistent refresh token.
      await logAuditEvent({
        userName,
        action: 'ZOHO_OAUTH_FAILED',
        module: 'INTEGRATIONS',
        details: 'Zoho OAuth callback succeeded but no refresh token was issued. Re-consent is required.',
      });

      baseRedirectUrl.searchParams.set('error', 'zoho_missing_refresh_token_reconsent_required');
      return NextResponse.redirect(baseRedirectUrl);
    }

    // 7. Save encrypted tokens into integration_credentials table (single persistent source of truth)
    const effectiveApiDomain = tokenData.api_domain || apiUrl;

    const grantedScopes = tokenData.scope
      ? tokenData.scope.split(/[\s,]+/).filter(Boolean)
      : ['ZohoCRM.users.READ', 'ZohoCRM.org.READ'];

    await saveZohoOAuthTokens({
      refreshToken: tokenData.refresh_token,
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in,
      apiDomain: effectiveApiDomain,
      tokenType: tokenData.token_type,
      scopes: grantedScopes,
      userId,
      userName,
      accountsUrl: resolvedAccountsUrl,
    });

    baseRedirectUrl.searchParams.set('success', 'zoho_connected');
    return NextResponse.redirect(baseRedirectUrl);
  } catch (err: any) {
    console.error('Unexpected error in Zoho callback:', err);

    await logAuditEvent({
      userName,
      action: 'ZOHO_OAUTH_FAILED',
      module: 'INTEGRATIONS',
      details: `Unexpected error during Zoho OAuth callback: ${err.message || 'Unknown network error'}`,
    });

    baseRedirectUrl.searchParams.set('error', 'zoho_callback_internal_error');
    return NextResponse.redirect(baseRedirectUrl);
  }
}
