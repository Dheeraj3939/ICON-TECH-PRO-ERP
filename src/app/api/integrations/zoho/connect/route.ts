import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { generateOAuthState } from '@/lib/integrations/zoho-crypto';
import { getZohoOAuthCredentials } from '@/lib/integrations/zoho-env';
import { logAuditEvent } from '@/lib/audit/logger';

/**
 * Initiates the Zoho CRM OAuth 2.0 authorization flow.
 * Accessible to Managing Director and Admin / BDM.
 */
export async function GET(request: NextRequest) {
  const baseRedirectUrl = new URL('/dashboard/settings/integrations', request.url);

  // 1. Authenticate user
  const user = await getAuthenticatedUser();
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnUrl', '/dashboard/settings/integrations');
    return NextResponse.redirect(loginUrl);
  }

  // 2. Enforce Role-Based Access Control
  const allowedRoles = ['Managing Director', 'Admin / BDM'];
  if (!allowedRoles.includes(user.role)) {
    baseRedirectUrl.searchParams.set('error', 'unauthorized_role');
    return NextResponse.redirect(baseRedirectUrl);
  }

  // 3. Resolve Environment Credentials
  const {
    clientId,
    clientSecret,
    redirectUri,
    accountsUrl,
    hasClientId,
    hasClientSecret,
    isPlaceholder,
  } = getZohoOAuthCredentials();

  if (isPlaceholder) {
    baseRedirectUrl.searchParams.set('error', 'zoho_placeholder_credentials');
    return NextResponse.redirect(baseRedirectUrl);
  }

  if (!hasClientId || !clientId) {
    baseRedirectUrl.searchParams.set('error', 'zoho_missing_client_id');
    return NextResponse.redirect(baseRedirectUrl);
  }

  if (!hasClientSecret || !clientSecret) {
    baseRedirectUrl.searchParams.set('error', 'zoho_missing_client_secret');
    return NextResponse.redirect(baseRedirectUrl);
  }

  // 4. Generate Anti-CSRF Cryptographic State
  const state = generateOAuthState(user.id);

  // 5. Check if consent was explicitly requested
  const searchParams = request.nextUrl.searchParams;
  const promptConsent = searchParams.get('prompt') === 'consent';

  // 6. Construct Zoho OAuth 2.0 Authorization URL
  const params = new URLSearchParams({
    client_id: clientId.trim(),
    redirect_uri: redirectUri.trim(),
    response_type: 'code',
    access_type: 'offline', // Mandatory to receive refresh_token
    scope: 'ZohoCRM.users.READ,ZohoCRM.org.READ',
    state,
  });

  if (promptConsent) {
    params.set('prompt', 'consent');
  }

  const authorizationUrl = `${accountsUrl}/oauth/v2/auth?${params.toString()}`;

  // 7. Log Audit Event
  await logAuditEvent({
    userName: user.name,
    action: 'ZOHO_OAUTH_INITIATED',
    module: 'INTEGRATIONS',
    details: `Initiated Zoho CRM OAuth authorization flow for accounts URL: ${accountsUrl}`,
  });

  // 8. Redirect to Zoho Consent Screen
  return NextResponse.redirect(authorizationUrl);
}
