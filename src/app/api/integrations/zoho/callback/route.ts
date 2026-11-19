import { NextResponse, type NextRequest } from 'next/server';
import { verifyOAuthState } from '@/lib/integrations/zoho-crypto';
import { getZohoOAuthCredentials } from '@/lib/integrations/zoho-env';
import { saveZohoOAuthTokens } from '@/lib/actions/zoho';
import { logAuditEvent } from '@/lib/audit/logger';
import { getAuthenticatedUser, createSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { STAFF_MEMBERS } from '@/lib/constants/erp-data';
import { logEnterpriseAudit } from '@/lib/audit/enterprise-logger';
import type { UserRoleName } from '@/types/database';
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
    redirectUri: envRedirectUri,
    accountsUrl,
    apiUrl,
    hasClientId,
    hasClientSecret,
  } = getZohoOAuthCredentials();

  const forwardedHost = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '').split(',')[0].trim();
  const isKnownCloudHost = /^(uat\.icontechpro\.in|erp\.icontechpro\.in|icon-erp-uat-web-production\.up\.railway\.app)$/i.test(forwardedHost);
  const redirectUri = isKnownCloudHost
    ? `https://${forwardedHost}/api/integrations/zoho/callback`
    : envRedirectUri;

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

      if (verifiedState.userId === 'USER_LOGIN' || verifiedState.userId === 'login') {
        return NextResponse.redirect(`${redirectOrigin}/login?error=oauth_exchange_failed&provider=Zoho`);
      }

      baseRedirectUrl.searchParams.set('error', `zoho_token_error_${tokenData.error}`);
      return NextResponse.redirect(baseRedirectUrl);
    }

    // SPECIAL BRANCH: USER AUTHENTICATION / SIGN IN WITH ZOHO
    if (verifiedState.userId === 'USER_LOGIN' || verifiedState.userId === 'login') {
      let zohoEmail: string | null = null;
      let zohoName: string | null = null;

      // 1. Fetch user info from Zoho Accounts
      try {
        const userInfoRes = await fetch(`${resolvedAccountsUrl}/oauth/user/info`, {
          headers: {
            Authorization: `Zoho-oauthtoken ${tokenData.access_token}`,
          },
        });
        if (userInfoRes.ok) {
          const info = await userInfoRes.json();
          zohoEmail = (info.Email || info.email || info.mail || '').toLowerCase().trim();
          zohoName = info.Display_Name || (info.First_Name ? `${info.First_Name} ${info.Last_Name || ''}`.trim() : null);
        }
      } catch (e) {
        console.warn('Zoho /oauth/user/info lookup failed:', e);
      }

      // Fallback: Query CRM current user endpoint
      if (!zohoEmail) {
        try {
          const apiDomain = (tokenData.api_domain || apiUrl).replace(/\/+$/, '');
          const crmUserRes = await fetch(`${apiDomain}/crm/v3/users?type=CurrentUser`, {
            headers: {
              Authorization: `Zoho-oauthtoken ${tokenData.access_token}`,
            },
          });
          if (crmUserRes.ok) {
            const crmData = await crmUserRes.json();
            const firstUser = crmData?.users?.[0];
            if (firstUser?.email) {
              zohoEmail = firstUser.email.toLowerCase().trim();
              zohoName = firstUser.full_name || zohoName;
            }
          }
        } catch (e) {
          console.warn('Zoho CRM CurrentUser lookup failed:', e);
        }
      }

      if (!zohoEmail) {
        return NextResponse.redirect(`${redirectOrigin}/login?error=oauth_exchange_failed&provider=Zoho`);
      }

      // 2. Authoritative Employee Whitelist Verification
      let authorizedUser: {
        id: string;
        email: string;
        name: string;
        role: UserRoleName;
        status: string;
        can_login: boolean;
      } | null = null;

      if (await isSupabaseAvailable()) {
        try {
          const admin = createAdminClient();
          const { data: profile } = await admin
            .from('user_profiles')
            .select('id, full_name, email, is_active, can_login, status, roles(role_name)')
            .eq('email', zohoEmail)
            .maybeSingle();

          if (profile) {
            authorizedUser = {
              id: profile.id,
              email: profile.email,
              name: profile.full_name || zohoName || zohoEmail.split('@')[0],
              role: ((profile.roles as any)?.role_name || 'Sales Executive') as UserRoleName,
              status: profile.status || 'ACTIVE',
              can_login: profile.can_login !== false && profile.is_active !== false,
            };

            const updates: Record<string, any> = {
              last_login_at: new Date().toISOString(),
            };
            if (profile.status === 'INVITED') {
              updates.status = 'ACTIVE';
            }
            await admin.from('user_profiles').update(updates).eq('id', profile.id);
          }
        } catch (err) {
          console.warn('Zoho login user profile lookup warning:', err);
        }
      }

      // Fallback to static staff definition
      if (!authorizedUser) {
        const staticStaff = STAFF_MEMBERS.find((s) => s.email.toLowerCase() === zohoEmail);
        if (staticStaff) {
          authorizedUser = {
            id: staticStaff.id,
            email: staticStaff.email,
            name: staticStaff.name,
            role: staticStaff.role as UserRoleName,
            status: 'ACTIVE',
            can_login: true,
          };
        }
      }

      // STRICT WHITELIST DEFENSE: Reject any Zoho account not in employee whitelist
      if (!authorizedUser) {
        return NextResponse.redirect(
          `${redirectOrigin}/login?error=not_invited&email=${encodeURIComponent(zohoEmail)}&provider=Zoho`
        );
      }

      // Reject deactivated or suspended employees
      if (!authorizedUser.can_login || authorizedUser.status === 'SUSPENDED' || authorizedUser.status === 'DEACTIVATED') {
        return NextResponse.redirect(
          `${redirectOrigin}/login?error=account_deactivated&email=${encodeURIComponent(zohoEmail)}&provider=Zoho`
        );
      }

      // 3. Create authoritative ERP session
      await createSession({
        id: authorizedUser.id,
        email: authorizedUser.email,
        name: authorizedUser.name,
        role: authorizedUser.role,
      });

      await logEnterpriseAudit({
        employeeId: authorizedUser.id,
        userName: authorizedUser.name,
        role: authorizedUser.role,
        category: 'SECURITY_EVENT',
        severity: 'INFO',
        module: 'AUTH',
        action: 'USER_LOGGED_IN',
        recordType: 'ZOHO_OAUTH_LOGIN',
        recordId: authorizedUser.id,
        reason: 'Zoho Mail corporate account SSO verified against employee whitelist.',
        outcome: 'SUCCESS',
      });

      return NextResponse.redirect(`${redirectOrigin}/dashboard`);
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
      : [
          'ZohoCRM.users.READ',
          'ZohoCRM.org.READ',
          'ZohoMail.organization.READ',
          'ZohoMail.organization.accounts.READ',
          'ZohoMail.accounts.READ',
          'ZohoMail.messages.READ',
          'ZohoMail.messages.CREATE',
          'ZohoMail.messages.UPDATE',
        ];

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
