'use server';

import { revalidatePath } from 'next/cache';
import { requireRole, getAuthenticatedUser, requireAuth, type AuthenticatedUser } from '@/lib/auth/session';
import { hasEffectivePermission } from '@/lib/actions/permissions';
import { logAuditEvent } from '@/lib/audit/logger';
import { isSupabaseAvailable } from '@/lib/supabase/health';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  encryptToken,
  decryptToken,
  generateOAuthState,
  createRfc2822RawMessage,
} from '@/lib/integrations/gmail-crypto';
import { getGmailOAuthCredentials } from '@/lib/integrations/gmail-env';
import { GmailClient } from '@/lib/integrations/gmail-client';
import type {
  GmailConnectionInfo,
  StoredGmailCredentials,
  GmailSendResult,
  GmailFolder,
  GmailLabel,
  GmailThreadDetail,
  GmailMessageDetail,
  GmailDraft,
  GmailComposePayload,
  GmailMailboxResponse,
} from '@/types/gmail';

declare global {
  // eslint-disable-next-line no-var
  var __ICON_GMAIL_INTEGRATION__: StoredGmailCredentials | null | undefined;
}

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.modify';
const TARGET_ACCOUNT_EMAIL = 'icontechpro@gmail.com';

function getCredentialsStore(): StoredGmailCredentials | null {
  if (globalThis.__ICON_GMAIL_INTEGRATION__ === undefined) {
    globalThis.__ICON_GMAIL_INTEGRATION__ = null;
  }
  return globalThis.__ICON_GMAIL_INTEGRATION__;
}

function setCredentialsStore(creds: StoredGmailCredentials | null): void {
  globalThis.__ICON_GMAIL_INTEGRATION__ = creds;
}

/**
 * Retrieve public connection status without exposing tokens or secrets.
 * Accessible to all authenticated users for status display.
 */
export async function getGmailConnectionStatus(): Promise<GmailConnectionInfo> {
  const { hasClientId, hasClientSecret, redirectUri, isPlaceholder } = getGmailOAuthCredentials();

  let creds = getCredentialsStore();

  // If memory store is empty and Supabase is online, check system_settings fallback
  if (!creds && (await isSupabaseAvailable())) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'gmail_oauth_integration')
        .maybeSingle();

      if (!error && data?.setting_value) {
        creds = data.setting_value as StoredGmailCredentials;
        setCredentialsStore(creds);
      }
    } catch {
      // Supabase table or record not present
    }
  }

  const isConnected = Boolean(creds?.encrypted_refresh_token);
  const scopes = creds?.scopes || [];
  const hasModifyScope = scopes.some((s) => s.includes('gmail.modify'));
  const needsScopeUpgrade = Boolean(isConnected && !hasModifyScope);

  return {
    connected: isConnected,
    status: isConnected ? 'CONNECTED' : 'NOT_CONNECTED',
    account_email: creds?.account_email || TARGET_ACCOUNT_EMAIL,
    scopes: scopes.length > 0 ? scopes : [GMAIL_SCOPE],
    connected_at: creds?.connected_at,
    connected_by: creds?.connected_by_name,
    expires_at: creds?.access_token_expires_at,
    has_modify_scope: hasModifyScope,
    needs_scope_upgrade: needsScopeUpgrade,
    configured_env: {
      has_client_id: hasClientId,
      has_client_secret: hasClientSecret,
      has_redirect_uri: Boolean(redirectUri && redirectUri.trim()),
      is_placeholder: isPlaceholder,
    },
  };
}

/**
 * Generate the Google OAuth 2.0 authorization URL.
 * Restricted strictly to Managing Director and Admin / BDM.
 */
export async function initiateGmailAuthorization(): Promise<{
  success: boolean;
  authorizationUrl?: string;
  error?: string;
}> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);

    const {
      clientId,
      clientSecret,
      redirectUri,
      hasClientId,
      hasClientSecret,
      isPlaceholder,
    } = getGmailOAuthCredentials();

    if (!hasClientId || !clientId) {
      return {
        success: false,
        error: isPlaceholder
          ? 'GOOGLE_CLIENT_ID still contains a template placeholder (e.g. your_client_id_here). Please copy your real Client ID from Google Cloud Console into .env.local.'
          : 'GOOGLE_CLIENT_ID is missing from .env.local. Please configure your Google OAuth Client ID.',
      };
    }

    if (!hasClientSecret || !clientSecret) {
      return {
        success: false,
        error: isPlaceholder
          ? 'GOOGLE_CLIENT_SECRET still contains a template placeholder (e.g. your_client_secret_here). Please copy your real Client Secret from Google Cloud Console into .env.local.'
          : 'GOOGLE_CLIENT_SECRET is missing from .env.local. Please configure your Google OAuth Client Secret.',
      };
    }

    const state = generateOAuthState(actor.id);

    const params = new URLSearchParams({
      client_id: clientId.trim(),
      redirect_uri: redirectUri.trim(),
      response_type: 'code',
      scope: GMAIL_SCOPE,
      access_type: 'offline', // Mandatory to receive refresh_token
      prompt: 'consent', // Mandatory to ensure refresh_token is returned and scope upgrade granted
      state,
      login_hint: TARGET_ACCOUNT_EMAIL,
    });

    const authorizationUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    await logAuditEvent({
      userName: actor.name,
      action: 'GMAIL_OAUTH_INITIATED',
      module: 'INTEGRATIONS',
      details: `Initiated Google OAuth flow for ${TARGET_ACCOUNT_EMAIL} with scope ${GMAIL_SCOPE}`,
    });

    return {
      success: true,
      authorizationUrl,
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to initiate Gmail authorization' };
  }
}

/**
 * Disconnect the active Gmail OAuth connection and purge stored credentials.
 * Restricted strictly to Managing Director and Admin / BDM.
 */
export async function disconnectGmail(): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);

    setCredentialsStore(null);

    if (await isSupabaseAvailable()) {
      try {
        const admin = createAdminClient();
        await admin
          .from('system_settings')
          .delete()
          .eq('setting_key', 'gmail_oauth_integration');
      } catch (err) {
        console.warn('Supabase system_settings delete fallback:', err);
      }
    }

    await logAuditEvent({
      userName: actor.name,
      action: 'GMAIL_OAUTH_DISCONNECTED',
      module: 'INTEGRATIONS',
      details: `Disconnected Gmail OAuth integration for ${TARGET_ACCOUNT_EMAIL}`,
    });

    revalidatePath('/dashboard/settings/integrations');
    revalidatePath('/dashboard/settings');
    revalidatePath('/dashboard/communication');
    revalidatePath('/dashboard/communication/gmail');

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to disconnect Gmail' };
  }
}

/**
 * Internal helper to obtain a fresh access token using the stored encrypted refresh token.
 */
export async function getFreshAccessToken(): Promise<{
  accessToken: string;
  expiresIn: number;
} | null> {
  let creds = getCredentialsStore();

  // If memory store is empty and Supabase is online, check system_settings fallback
  if (!creds && (await isSupabaseAvailable())) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'gmail_oauth_integration')
        .maybeSingle();

      if (!error && data?.setting_value) {
        creds = data.setting_value as StoredGmailCredentials;
        setCredentialsStore(creds);
      }
    } catch {
      // Supabase table or record not present
    }
  }

  if (!creds?.encrypted_refresh_token || !creds.iv || !creds.tag) {
    return null;
  }

  // Check if existing access token is still valid (with 60-second safety buffer)
  const now = Date.now();
  if (
    creds.encrypted_access_token &&
    creds.access_token_expires_at &&
    creds.access_token_expires_at > now + 60000
  ) {
    try {
      const decrypted = decryptToken(creds.encrypted_access_token, creds.iv, creds.tag);
      return { accessToken: decrypted, expiresIn: Math.floor((creds.access_token_expires_at - now) / 1000) };
    } catch {
      // If decryption fails, proceed to refresh
    }
  }

  // Decrypt refresh token
  const refreshToken = decryptToken(creds.encrypted_refresh_token, creds.iv, creds.tag);
  const { clientId, clientSecret, hasClientId, hasClientSecret } = getGmailOAuthCredentials();

  if (!hasClientId || !hasClientSecret || !clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured on server.');
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    console.error('Google token refresh failed:', errorBody);
    if (errorBody.includes('invalid_grant')) {
      throw new Error('Your Gmail authorization has expired or been revoked. Please reconnect Gmail in Settings > Integrations.');
    }
    throw new Error(`Failed to refresh Google access token: ${tokenResponse.status} ${tokenResponse.statusText}`);
  }

  const tokenData = await tokenResponse.json();
  const newAccessToken = tokenData.access_token;
  const expiresIn = tokenData.expires_in || 3600;

  // Cache encrypted access token
  const encAccess = encryptToken(newAccessToken);
  creds.encrypted_access_token = encAccess.ciphertext;
  creds.access_token_expires_at = Date.now() + expiresIn * 1000;
  setCredentialsStore(creds);

  return { accessToken: newAccessToken, expiresIn };
}

/**
 * Shared GmailClient instance for mailbox actions.
 */
function getGmailClientInstance(): GmailClient {
  return new GmailClient(getFreshAccessToken);
}

// ==============================================================================
// GMAIL MAILBOX ACCESS AUTHORIZATION (Section 4 & Section 23 Master Specification)
// Authorized Users ONLY:
//   1. Borra Narsimulu  - icontechpro@gmail.com (MD / Primary Account Owner)
//   2. B V Dheeraj Reddy - dheeraj@icontechpro.in (Sales Executive / Admin)
//   3. B Vineet Babu    - vineet@icontechpro.in (Sales Executive)
//   4. Manisha          - service01@icontechpro.in (Office Assistant)
// Strictly Denied by Default: Reshma, Hemalath, and other future users.
// Administrative OAuth Actions (Connect / Disconnect): Restricted strictly to MD and Admin / BDM.
// ==============================================================================

const AUTHORIZED_GMAIL_MAILBOX_EMAILS = [
  'icontechpro@gmail.com',
  'dheeraj@icontechpro.in',
  'vineet@icontechpro.in',
  'service01@icontechpro.in',
] as const;

const AUTHORIZED_GMAIL_MAILBOX_NAMES = [
  'borra narsimulu',
  'b v dheeraj reddy',
  'b vineet babu',
  'manisha',
  // Local UAT / demo session aliases
  'dheeraj',
  'vineet babu',
  'narsimha naidu',
] as const;

/**
 * Validates whether an authenticated user is explicitly authorized to access
 * the corporate shared Gmail mailbox (icontechpro@gmail.com).
 */
export async function isUserAuthorizedForGmailMailbox(user: AuthenticatedUser | null): Promise<boolean> {
  if (!user) return false;

  const normalizedEmail = (user.email || '').toLowerCase().trim();
  const normalizedName = (user.name || '').toLowerCase().trim();

  // Explicit safety check: Reshma and Hemalath must NEVER be granted mailbox access by default
  if (
    normalizedEmail === 'sales@icontechpro.in' ||
    normalizedEmail === 'reshma@icontechpro.in' ||
    normalizedEmail === 'accounts@icontechpro.in' ||
    normalizedName === 'reshma' ||
    normalizedName === 'hemalath' ||
    normalizedName === 'hemalatha'
  ) {
    // Check if an explicit active administrator override was created in user_permission_overrides
    try {
      const hasOverride = await hasEffectivePermission(
        { id: user.id, role: user.role },
        'Communications' as any,
        'view'
      );
      if (hasOverride) {
        return true;
      }
    } catch {
      // Fail closed
    }
    return false;
  }

  // 1. Direct authorization by official corporate email
  if (AUTHORIZED_GMAIL_MAILBOX_EMAILS.some((e) => e.toLowerCase() === normalizedEmail)) {
    return true;
  }

  // 2. Support legacy/demo alias md@icontechpro.in for MD in dev/test
  if (
    normalizedEmail === 'md@icontechpro.in' &&
    (user.role === 'Managing Director' || normalizedName.includes('narsim') || normalizedName.includes('borra'))
  ) {
    return true;
  }

  // 3. Match authorized staff name if email was not supplied or matched demo session
  if (AUTHORIZED_GMAIL_MAILBOX_NAMES.some((n) => n === normalizedName)) {
    return true;
  }

  // 4. Dynamic RBAC override check (user_permission_overrides)
  // An administrator can explicitly configure an individual override for a future user
  try {
    const hasOverride = await hasEffectivePermission(
      { id: user.id, role: user.role },
      'Communications' as any,
      'view'
    );
    if (hasOverride) {
      return true;
    }
  } catch {
    // Fail-safe closed
  }

  return false;
}

/**
 * Server-side authorization guard for Gmail Mailbox actions.
 * Throws a structured Error if unauthorized.
 */
export async function requireGmailMailboxAccess(): Promise<AuthenticatedUser> {
  const user = await requireAuth();
  const isAuthorized = await isUserAuthorizedForGmailMailbox(user);

  if (!isAuthorized) {
    throw new Error(
      `FORBIDDEN: User "${user.name}" (${user.email || user.role}) is not authorized to access the shared ICON TECH PRO Gmail mailbox (icontechpro@gmail.com). Access is strictly restricted to authorized personnel.`
    );
  }

  return user;
}

/**
 * Non-throwing query for UI clearance and client-side page rendering.
 */
export async function checkGmailMailboxAccessAction(): Promise<{
  authorized: boolean;
  user: { name: string; email: string; role: string } | null;
  reason?: string;
}> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { authorized: false, user: null, reason: 'Unauthenticated' };
  }

  const authorized = await isUserAuthorizedForGmailMailbox(user);
  return {
    authorized,
    user: { name: user.name, email: user.email, role: user.role },
    reason: authorized
      ? undefined
      : `Access to icontechpro@gmail.com is restricted to authorized personnel (Borra Narsimulu, B V Dheeraj Reddy, B Vineet Babu, Manisha).`,
  };
}

// ==============================================================================
// MAILBOX SERVER ACTIONS (Protected: Explicit Mailbox Authorization Guard)
// ==============================================================================

/**
 * Fetch threads for the mailbox view (Inbox, Sent, Starred, Drafts, Important, Trash, or search query).
 */
export async function getGmailMailboxThreadsAction(params: {
  folder?: GmailFolder;
  query?: string;
  pageToken?: string;
  maxResults?: number;
}): Promise<GmailMailboxResponse> {
  await requireGmailMailboxAccess();
  const client = getGmailClientInstance();
  return client.listThreads(params);
}

/**
 * Retrieve a full conversation thread by thread ID.
 */
export async function getGmailThreadDetailAction(threadId: string): Promise<GmailThreadDetail> {
  await requireGmailMailboxAccess();
  const client = getGmailClientInstance();
  return client.getThread(threadId);
}

/**
 * Retrieve single message details.
 */
export async function getGmailMessageDetailAction(messageId: string): Promise<GmailMessageDetail> {
  await requireGmailMailboxAccess();
  const client = getGmailClientInstance();
  return client.getMessage(messageId);
}

/**
 * Mark a message read or unread.
 */
export async function markGmailMessageReadAction(
  messageId: string,
  read: boolean = true
): Promise<GmailMessageDetail> {
  const actor = await requireGmailMailboxAccess();
  const client = getGmailClientInstance();
  const result = await client.markRead(messageId, read);

  await logAuditEvent({
    userName: actor.name,
    action: 'GMAIL_MESSAGE_READ_TOGGLED',
    module: 'INTEGRATIONS',
    details: `Marked message ${messageId} as ${read ? 'READ' : 'UNREAD'}`,
  });

  revalidatePath('/dashboard/communication/gmail');
  return result;
}

/**
 * Star or unstar a message.
 */
export async function starGmailMessageAction(
  messageId: string,
  starred: boolean = true
): Promise<GmailMessageDetail> {
  const actor = await requireGmailMailboxAccess();
  const client = getGmailClientInstance();
  const result = await client.starMessage(messageId, starred);

  await logAuditEvent({
    userName: actor.name,
    action: 'GMAIL_MESSAGE_STARRED_TOGGLED',
    module: 'INTEGRATIONS',
    details: `${starred ? 'Starred' : 'Unstarred'} message ${messageId}`,
  });

  revalidatePath('/dashboard/communication/gmail');
  return result;
}

/**
 * Archive a message by removing it from INBOX.
 */
export async function archiveGmailMessageAction(messageId: string): Promise<GmailMessageDetail> {
  const actor = await requireGmailMailboxAccess();
  const client = getGmailClientInstance();
  const result = await client.archiveMessage(messageId);

  await logAuditEvent({
    userName: actor.name,
    action: 'GMAIL_MESSAGE_ARCHIVED',
    module: 'INTEGRATIONS',
    details: `Archived message ${messageId}`,
  });

  revalidatePath('/dashboard/communication/gmail');
  return result;
}

/**
 * Move a message to Trash.
 */
export async function trashGmailMessageAction(messageId: string): Promise<{ success: boolean }> {
  const actor = await requireGmailMailboxAccess();
  const client = getGmailClientInstance();
  const result = await client.trashMessage(messageId);

  await logAuditEvent({
    userName: actor.name,
    action: 'GMAIL_MESSAGE_TRASHED',
    module: 'INTEGRATIONS',
    details: `Moved message ${messageId} to Trash`,
  });

  revalidatePath('/dashboard/communication/gmail');
  return result;
}

/**
 * Restore a message from Trash.
 */
export async function untrashGmailMessageAction(messageId: string): Promise<{ success: boolean }> {
  const actor = await requireGmailMailboxAccess();
  const client = getGmailClientInstance();
  const result = await client.untrashMessage(messageId);

  await logAuditEvent({
    userName: actor.name,
    action: 'GMAIL_MESSAGE_UNTRASHED',
    module: 'INTEGRATIONS',
    details: `Restored message ${messageId} from Trash`,
  });

  revalidatePath('/dashboard/communication/gmail');
  return result;
}

/**
 * Create a new draft in Gmail.
 */
export async function createGmailDraftAction(payload: GmailComposePayload): Promise<GmailDraft> {
  const actor = await requireGmailMailboxAccess();
  const client = getGmailClientInstance();
  const draft = await client.createDraft(payload);

  await logAuditEvent({
    userName: actor.name,
    action: 'GMAIL_DRAFT_CREATED',
    module: 'INTEGRATIONS',
    details: `Created draft ${draft.id} with subject: ${payload.subject || '(No Subject)'}`,
  });

  revalidatePath('/dashboard/communication/gmail');
  return draft;
}

/**
 * Update an existing draft in Gmail.
 */
export async function updateGmailDraftAction(
  draftId: string,
  payload: GmailComposePayload
): Promise<GmailDraft> {
  const actor = await requireGmailMailboxAccess();
  const client = getGmailClientInstance();
  const draft = await client.updateDraft(draftId, payload);

  await logAuditEvent({
    userName: actor.name,
    action: 'GMAIL_DRAFT_UPDATED',
    module: 'INTEGRATIONS',
    details: `Updated draft ${draftId}`,
  });

  revalidatePath('/dashboard/communication/gmail');
  return draft;
}

/**
 * Send an existing draft.
 */
export async function sendGmailDraftAction(draftId: string): Promise<GmailSendResult> {
  const actor = await requireGmailMailboxAccess();
  const client = getGmailClientInstance();
  const result = await client.sendDraft(draftId);

  await logAuditEvent({
    userName: actor.name,
    action: 'GMAIL_DRAFT_SENT',
    module: 'INTEGRATIONS',
    details: `Sent draft ${draftId} (Message ID: ${result.messageId})`,
  });

  revalidatePath('/dashboard/communication/gmail');
  revalidatePath('/dashboard/communication');
  return result;
}

/**
 * Send a new email, reply, or forward directly through the mailbox compose drawer.
 */
export async function sendGmailMailboxEmailAction(
  payload: GmailComposePayload
): Promise<GmailSendResult> {
  const actor = await requireGmailMailboxAccess();
  const client = getGmailClientInstance();
  const result = await client.sendMessage(payload);

  const isReply = Boolean(payload.threadId && payload.inReplyTo);
  const actionName = isReply ? 'GMAIL_EMAIL_REPLIED' : 'GMAIL_EMAIL_SENT';

  await logAuditEvent({
    userName: actor.name,
    action: actionName,
    module: 'INTEGRATIONS',
    details: `${isReply ? 'Replied to thread' : 'Sent email'} ${payload.threadId || ''} to ${Array.isArray(payload.to) ? payload.to.join(', ') : payload.to} (Message ID: ${result.messageId})`,
  });

  revalidatePath('/dashboard/communication/gmail');
  revalidatePath('/dashboard/communication');
  return result;
}

/**
 * Fetch all Gmail labels for the sidebar.
 */
export async function getGmailLabelsAction(): Promise<GmailLabel[]> {
  await requireGmailMailboxAccess();
  const client = getGmailClientInstance();
  return client.getLabels();
}

/**
 * Retrieve raw attachment data buffer (server action helper).
 */
export async function getGmailAttachmentAction(
  messageId: string,
  attachmentId: string
): Promise<{ base64Data: string; size: number }> {
  await requireGmailMailboxAccess();
  const client = getGmailClientInstance();
  const { data, size } = await client.getAttachment(messageId, attachmentId);
  return {
    base64Data: data.toString('base64'),
    size,
  };
}

// ==============================================================================
// EXISTING VERIFIED FUNCTIONS (Preserved for backward-compatibility)
// ==============================================================================

/**
 * Send an email via the authorized Gmail account using Gmail REST API.
 * Supports To, CC, BCC, Reply-To, HTML, Plain text, and Attachments.
 * Used by email-service.ts for ERP transactional documents.
 */
export async function sendGmailMessage(params: {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
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
}): Promise<GmailSendResult> {
  try {
    let authInfo = await getFreshAccessToken();
    if (!authInfo) {
      return {
        success: false,
        error: 'Gmail account is not connected. Please authorize in ERP Settings > Integrations.',
      };
    }

    const rawMessage = createRfc2822RawMessage({
      from: TARGET_ACCOUNT_EMAIL,
      to: params.to,
      cc: params.cc,
      bcc: params.bcc,
      replyTo: params.replyTo,
      subject: params.subject,
      body: params.body,
      text: params.text,
      html: params.html,
      isHtml: params.isHtml,
      attachments: params.attachments,
    });

    let response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authInfo.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawMessage }),
    });

    // If 401 Unauthorized, force refresh once
    if (response.status === 401) {
      const creds = getCredentialsStore();
      if (creds) {
        creds.access_token_expires_at = 0;
      }
      authInfo = await getFreshAccessToken();
      if (authInfo) {
        response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authInfo.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw: rawMessage }),
        });
      }
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gmail send API error:', errText);
      return {
        success: false,
        error: `Gmail API Error (${response.status}): ${errText.slice(0, 300)}`,
      };
    }

    const result = await response.json();

    return {
      success: true,
      messageId: result.id,
      threadId: result.threadId,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to dispatch email via Gmail API',
    };
  }
}

/**
 * Send the verification test email from icontechpro@gmail.com to icontechpro@gmail.com.
 * Restricted to Managing Director and Admin / BDM.
 */
export async function sendGmailTestEmail(): Promise<GmailSendResult> {
  try {
    const actor = await requireRole(['Managing Director', 'Admin / BDM']);

    const result = await sendGmailMessage({
      to: TARGET_ACCOUNT_EMAIL,
      subject: 'ICON TECH PRO ERP - Gmail Integration Test',
      body: 'This is a test email from ICON TECH PRO ERP verifying active Gmail REST API connectivity.',
      isHtml: false,
    });

    if (result.success) {
      await logAuditEvent({
        userName: actor.name,
        action: 'GMAIL_TEST_EMAIL_SENT',
        module: 'INTEGRATIONS',
        details: `Sent verification test email to ${TARGET_ACCOUNT_EMAIL} (Message ID: ${result.messageId})`,
      });
    } else {
      await logAuditEvent({
        userName: actor.name,
        action: 'GMAIL_TEST_EMAIL_FAILED',
        module: 'INTEGRATIONS',
        details: `Test email dispatch failed for ${TARGET_ACCOUNT_EMAIL}: ${result.error}`,
      });
    }

    return result;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to send test email',
    };
  }
}

/**
 * Save newly exchanged OAuth credentials from callback route.
 * Internal server-side helper called by callback route.
 */
export async function saveGmailOAuthTokens(params: {
  refreshToken: string;
  accessToken?: string;
  expiresIn?: number;
  userId: string;
  userName: string;
  scopes?: string[];
}): Promise<boolean> {
  const encRefresh = encryptToken(params.refreshToken);
  let encAccessCipher: string | undefined;

  if (params.accessToken) {
    const encAccess = encryptToken(params.accessToken);
    encAccessCipher = encAccess.ciphertext;
  }

  const assignedScopes = params.scopes && params.scopes.length > 0 ? params.scopes : [GMAIL_SCOPE];

  const stored: StoredGmailCredentials = {
    account_email: TARGET_ACCOUNT_EMAIL,
    encrypted_refresh_token: encRefresh.ciphertext,
    encrypted_access_token: encAccessCipher,
    access_token_expires_at: params.expiresIn ? Date.now() + params.expiresIn * 1000 : undefined,
    scopes: assignedScopes,
    iv: encRefresh.iv,
    tag: encRefresh.tag,
    connected_at: new Date().toISOString(),
    connected_by_id: params.userId,
    connected_by_name: params.userName,
  };

  setCredentialsStore(stored);

  // Persist to system_settings in Supabase if online
  if (await isSupabaseAvailable()) {
    try {
      const admin = createAdminClient();
      await admin.from('system_settings').upsert({
        setting_key: 'gmail_oauth_integration',
        setting_value: stored,
        description: 'Google OAuth 2.0 Credentials for icontechpro@gmail.com',
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Failed to upsert to system_settings:', err);
    }
  }

  await logAuditEvent({
    userName: params.userName,
    action: 'GMAIL_OAUTH_COMPLETED',
    module: 'INTEGRATIONS',
    details: `Successfully connected Google OAuth for ${TARGET_ACCOUNT_EMAIL} with scope ${assignedScopes.join(', ')}`,
  });

  return true;
}
