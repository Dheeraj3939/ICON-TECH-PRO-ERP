'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth, getAuthenticatedUser, type AuthenticatedUser } from '@/lib/auth/session';
import { logAuditEvent } from '@/lib/audit/logger';
import {
  isUserAuthorizedForGmailMailbox,
  getGmailConnectionStatus,
  requireGmailMailboxAccess,
  getGmailMailboxThreadsAction,
  getGmailMessageDetailAction,
  markGmailMessageReadAction,
  starGmailMessageAction,
  archiveGmailMessageAction,
  trashGmailMessageAction,
  createGmailDraftAction,
  sendGmailMailboxEmailAction,
  getGmailAttachmentAction,
} from '@/lib/actions/gmail';
import {
  getEmployeeMailboxMappings,
  getZohoOrganizationRecord,
} from '@/lib/integrations/zoho/employee-mapping';
import { getZohoMailClient } from '@/lib/integrations/zoho/mail-client';
import { getStoredZohoCredentials } from '@/lib/integrations/zoho/token-manager';
import type {
  MailProvider,
  MailFolder,
  MailMessage,
  MailAttachment,
} from '@/components/mail/mock-mail-data';
import type { GmailFolder } from '@/types/gmail';

// ==============================================================================
// TYPES & CONTRACTS
// ==============================================================================

export interface UnifiedMailboxStatus {
  authenticated: boolean;
  user: {
    id: string;
    name: string;
    role: string;
    email: string;
  } | null;
  gmail: {
    authorized: boolean;
    connected: boolean;
    status: 'CONNECTED' | 'NOT_CONNECTED' | 'DENIED' | 'TOKEN_EXPIRED';
    mailboxEmail: string;
    personalAddress: string;
    reason?: string;
  };
  zoho: {
    authorized: boolean;
    connected: boolean;
    status: 'CONNECTED' | 'NOT_CONNECTED' | 'PENDING_ADMIN_CONSENT' | 'DENIED' | 'NOT_MAPPED';
    mailboxEmail: string;
    zuid?: string;
    isSharedMailbox?: boolean;
    mappingStatus?: string;
    reason?: string;
  };
}

// Map UI folders to Gmail folders
const UI_TO_GMAIL_FOLDER: Record<MailFolder, GmailFolder> = {
  inbox: 'INBOX',
  starred: 'STARRED',
  sent: 'SENT',
  drafts: 'DRAFTS',
  archive: 'INBOX', // Archive in Gmail is searched without INBOX label
  trash: 'TRASH',
};

// ==============================================================================
// 1. DYNAMIC EMPLOYEE MAILBOX RESOLUTION
// ==============================================================================

/**
 * Dynamically resolves an employee's authorized Gmail & Zoho mailbox identities.
 * Strictly prevents cross-mailbox access and enforces RBAC isolation.
 */
export async function resolveUserMailboxIdentity(
  user: AuthenticatedUser | null
): Promise<UnifiedMailboxStatus> {
  if (!user) {
    return {
      authenticated: false,
      user: null,
      gmail: {
        authorized: false,
        connected: false,
        status: 'DENIED',
        mailboxEmail: '',
        personalAddress: '',
        reason: 'Authentication required',
      },
      zoho: {
        authorized: false,
        connected: false,
        status: 'DENIED',
        mailboxEmail: '',
        reason: 'Authentication required',
      },
    };
  }

  const normalizedUserEmail = (user.email || '').toLowerCase().trim();
  const normalizedUserName = (user.name || '').toLowerCase().trim();

  // 1. Resolve Gmail Identity
  const isGmailAuth = await isUserAuthorizedForGmailMailbox(user);
  const gmailConn = await getGmailConnectionStatus();

  // Corporate personal alias for Gmail dispatch
  let personalGmailAddress = normalizedUserEmail || 'icontechpro@gmail.com';
  if (normalizedUserName.includes('narsim') || normalizedUserName.includes('borra')) {
    personalGmailAddress = 'icontechpro@gmail.com';
  }

  const gmailStatus: UnifiedMailboxStatus['gmail'] = {
    authorized: isGmailAuth,
    connected: isGmailAuth && gmailConn.connected,
    status: !isGmailAuth
      ? 'DENIED'
      : gmailConn.connected
      ? 'CONNECTED'
      : 'NOT_CONNECTED',
    mailboxEmail: 'icontechpro@gmail.com',
    personalAddress: personalGmailAddress,
    reason: isGmailAuth
      ? undefined
      : `Access to icontechpro@gmail.com is restricted to authorized personnel (Borra Narsimulu, B V Dheeraj Reddy, B Vineet Babu, Manisha).`,
  };

  // 2. Resolve Zoho Mail Identity via employee_zoho_mailbox_mappings
  const allMappings = await getEmployeeMailboxMappings();
  const zohoCreds = await getStoredZohoCredentials();
  const hasZohoRefreshToken = Boolean(zohoCreds?.encrypted_refresh_token);

  // Match mapping by employee_id first, then corporate email
  const userMapping =
    allMappings.find((m) => m.employee_id === user.id) ||
    allMappings.find(
      (m) =>
        m.email_address.toLowerCase() === normalizedUserEmail &&
        m.mapping_status !== 'DEACTIVATED'
    );

  let zohoStatus: UnifiedMailboxStatus['zoho'];

  if (!userMapping) {
    // If no explicit mapping exists, check if user is an unmapped staff member
    zohoStatus = {
      authorized: false,
      connected: false,
      status: 'NOT_MAPPED',
      mailboxEmail: normalizedUserEmail || 'Unmapped',
      reason: `No Zoho Mailbox mapped for employee ${user.name}. Contact administrator to link mailbox in Settings > Integrations > Zoho Organization.`,
    };
  } else if (
    userMapping.mapping_status === 'DEACTIVATED' ||
    userMapping.mailbox_status === 'SUSPENDED'
  ) {
    // Offboarded / Deactivated employee
    zohoStatus = {
      authorized: false,
      connected: false,
      status: 'DENIED',
      mailboxEmail: userMapping.email_address,
      zuid: userMapping.zoho_user_id,
      mappingStatus: userMapping.mapping_status,
      reason: `Mailbox access revoked. Employee ${user.name} has been offboarded or suspended.`,
    };
  } else {
    // Active mapping found
    const isZohoConnected = hasZohoRefreshToken;
    zohoStatus = {
      authorized: true,
      connected: isZohoConnected,
      status: isZohoConnected
        ? 'CONNECTED'
        : 'PENDING_ADMIN_CONSENT',
      mailboxEmail: userMapping.email_address,
      zuid: userMapping.zoho_user_id,
      isSharedMailbox: userMapping.mailbox_type === 'SHARED',
      mappingStatus: userMapping.mapping_status,
      reason: isZohoConnected
        ? undefined
        : 'Zoho Mail pending administrator OAuth authorization. Please connect in Settings > Integrations.',
    };
  }

  return {
    authenticated: true,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email,
    },
    gmail: gmailStatus,
    zoho: zohoStatus,
  };
}

/**
 * Public Server Action to retrieve the current employee's unified mailbox status.
 */
export async function getUnifiedMailboxStatusAction(): Promise<UnifiedMailboxStatus> {
  const user = await getAuthenticatedUser();
  return resolveUserMailboxIdentity(user);
}

// ==============================================================================
// 2. UNIFIED MAILBOX MESSAGES (READ)
// ==============================================================================

/**
 * Helper to parse sender display name and email address from RFC headers.
 */
function parseSenderString(str: string): { name: string; email: string } {
  if (!str) return { name: 'Unknown', email: '' };
  const match = str.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    return {
      name: match[1].replace(/^["']|["']$/g, '').trim() || match[2],
      email: match[2].trim(),
    };
  }
  return { name: str.split('@')[0], email: str.trim() };
}

/**
 * Fetch unified mailbox messages for the requested provider and folder.
 * Enforces server-side authorization and maps to normalized MailMessage structure.
 */
export async function getUnifiedMailMessagesAction(params: {
  provider: MailProvider;
  folder: MailFolder;
  query?: string;
  pageToken?: string;
}): Promise<{
  success: boolean;
  messages: MailMessage[];
  status?: string;
  error?: string;
}> {
  const user = await requireAuth();
  const identity = await resolveUserMailboxIdentity(user);

  // 1. Audit Log: Mailbox accessed
  await logAuditEvent({
    userName: user.name,
    action: 'MAILBOX_ACCESSED',
    module: 'COMMUNICATIONS',
    details: `Accessed ${params.provider.toUpperCase()} mailbox (${params.folder}) for user ${user.name}`,
  });

  // -------------------------------------------------------------
  // GMAIL PROVIDER DISPATCH
  // -------------------------------------------------------------
  if (params.provider === 'gmail') {
    if (!identity.gmail.authorized) {
      return {
        success: false,
        messages: [],
        status: 'DENIED',
        error: identity.gmail.reason || 'Access to corporate Gmail is restricted.',
      };
    }

    if (!identity.gmail.connected) {
      return {
        success: false,
        messages: [],
        status: 'NOT_CONNECTED',
        error: 'Gmail account is not connected. Connect in ERP Settings > Integrations.',
      };
    }

    try {
      const gmailFolder = UI_TO_GMAIL_FOLDER[params.folder] || 'INBOX';
      const gmailRes = await getGmailMailboxThreadsAction({
        folder: gmailFolder,
        query: params.query,
        pageToken: params.pageToken,
        maxResults: 25,
      });

      const normalizedMessages: MailMessage[] = [];

      for (const thread of gmailRes.threads) {
        const topMessage =
          thread.messages[thread.messages.length - 1] || thread.messages[0];
        if (!topMessage) continue;

        const sender = parseSenderString(topMessage.from);
        const recipient = parseSenderString(topMessage.to?.[0] || '');

        normalizedMessages.push({
          id: topMessage.id,
          provider: 'gmail',
          folder: params.folder,
          fromName: sender.name,
          fromEmail: sender.email,
          toName: recipient.name || 'ICON TECH PRO Team',
          toEmail: recipient.email || 'icontechpro@gmail.com',
          cc: topMessage.cc?.join(', '),
          bcc: topMessage.bcc?.join(', '),
          subject: topMessage.subject || '(No Subject)',
          preview: topMessage.snippet || '',
          body: topMessage.snippet || '',
          timestamp: topMessage.dateFormatted || new Date(topMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          dateStr: topMessage.dateFormatted || 'Recently',
          isUnread: topMessage.isUnread,
          isStarred: topMessage.isStarred,
          hasAttachments: topMessage.hasAttachments,
          attachments: (topMessage.attachments || []).map((att) => ({
            name: att.filename,
            size: `${Math.max(1, Math.round(att.size / 1024))} KB`,
            type: att.mimeType,
          })),
          tags: topMessage.isImportant ? ['Important'] : [],
        });
      }

      return {
        success: true,
        messages: normalizedMessages,
        status: 'OK',
      };
    } catch (err: any) {
      return {
        success: false,
        messages: [],
        status: 'ERROR',
        error: err.message || 'Failed to fetch messages from Gmail API',
      };
    }
  }

  // -------------------------------------------------------------
  // ZOHO MAIL PROVIDER DISPATCH
  // -------------------------------------------------------------
  if (params.provider === 'zoho') {
    if (!identity.zoho.authorized) {
      return {
        success: false,
        messages: [],
        status: identity.zoho.status,
        error: identity.zoho.reason || 'Unauthorized for Zoho Mail.',
      };
    }

    if (!identity.zoho.connected) {
      return {
        success: false,
        messages: [],
        status: 'PENDING_ADMIN_CONSENT',
        error:
          'Zoho Mail organization authorization is pending administrator consent. Please authorize in Settings > Integrations > Zoho Organization.',
      };
    }

    try {
      const mailClient = getZohoMailClient();
      const accountId = identity.zoho.zuid || identity.zoho.mailboxEmail;

      const zohoRes = await mailClient.fetchMailboxMessages({
        accountId,
        folder: params.folder,
        query: params.query,
      });

      if (!zohoRes.success) {
        return {
          success: false,
          messages: [],
          status: zohoRes.status === 401 ? 'PENDING_ADMIN_CONSENT' : 'ERROR',
          error: zohoRes.error || 'Failed to load Zoho Mail messages',
        };
      }

      const normalizedMessages: MailMessage[] = (zohoRes.messages || []).map((m: any) => {
        const sender = parseSenderString(m.fromAddress || m.sender || '');
        const recipient = parseSenderString(m.toAddress || '');

        return {
          id: String(m.messageId || m.id),
          provider: 'zoho',
          folder: params.folder,
          fromName: sender.name,
          fromEmail: sender.email,
          toName: recipient.name || user.name,
          toEmail: recipient.email || identity.zoho.mailboxEmail,
          cc: m.ccAddress,
          bcc: m.bccAddress,
          subject: m.subject || '(No Subject)',
          preview: m.summary || m.snippet || '',
          body: m.content || m.summary || '',
          timestamp: m.receivedTime ? new Date(Number(m.receivedTime)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
          dateStr: m.receivedTime ? new Date(Number(m.receivedTime)).toLocaleDateString() : 'Recently',
          isUnread: m.status !== 'read',
          isStarred: Boolean(m.flag === 'flagged'),
          hasAttachments: Boolean(m.hasAttachment),
          attachments: (m.attachments || []).map((a: any) => ({
            name: a.attachmentName || a.name || 'Attachment',
            size: a.size ? `${Math.round(a.size / 1024)} KB` : '1.0 MB',
            type: a.contentType || 'application/octet-stream',
          })),
          tags: ['Zoho Mail'],
        };
      });

      return {
        success: true,
        messages: normalizedMessages,
        status: 'OK',
      };
    } catch (err: any) {
      return {
        success: false,
        messages: [],
        status: 'ERROR',
        error: err.message || 'Failed to communicate with Zoho Mail API',
      };
    }
  }

  return { success: false, messages: [], error: `Unknown provider: ${params.provider}` };
}

// ==============================================================================
// 3. UNIFIED MESSAGE DETAIL (READ)
// ==============================================================================

/**
 * Retrieve full message content for the reading pane.
 */
export async function getUnifiedMessageDetailAction(params: {
  provider: MailProvider;
  messageId: string;
}): Promise<{
  success: boolean;
  message?: MailMessage;
  error?: string;
}> {
  const user = await requireAuth();
  const identity = await resolveUserMailboxIdentity(user);

  if (params.provider === 'gmail') {
    if (!identity.gmail.authorized || !identity.gmail.connected) {
      return { success: false, error: 'Gmail access not authorized or connected.' };
    }

    try {
      const detail = await getGmailMessageDetailAction(params.messageId);
      const sender = parseSenderString(detail.from);
      const recipient = parseSenderString(detail.to?.[0] || '');

      return {
        success: true,
        message: {
          id: detail.id,
          provider: 'gmail',
          folder: 'inbox',
          fromName: sender.name,
          fromEmail: sender.email,
          toName: recipient.name || 'ICON TECH PRO',
          toEmail: recipient.email || 'icontechpro@gmail.com',
          cc: detail.cc?.join(', '),
          bcc: detail.bcc?.join(', '),
          subject: detail.subject,
          preview: detail.snippet,
          body: detail.bodyText || detail.snippet,
          timestamp: detail.dateFormatted,
          dateStr: detail.dateFormatted,
          isUnread: detail.isUnread,
          isStarred: detail.isStarred,
          hasAttachments: detail.hasAttachments,
          attachments: (detail.attachments || []).map((att) => ({
            name: att.filename,
            size: `${Math.max(1, Math.round(att.size / 1024))} KB`,
            type: att.mimeType,
          })),
          tags: [],
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to load Gmail message content.' };
    }
  }

  if (params.provider === 'zoho') {
    if (!identity.zoho.authorized || !identity.zoho.connected) {
      return { success: false, error: 'Zoho Mail access not authorized or connected.' };
    }

    try {
      const mailClient = getZohoMailClient();
      const accountId = identity.zoho.zuid || identity.zoho.mailboxEmail;
      const res = await mailClient.fetchMessageDetail(accountId, params.messageId);

      if (!res.success || !res.message) {
        return { success: false, error: res.error || 'Failed to load Zoho message content.' };
      }

      const m = res.message;
      const sender = parseSenderString(m.fromAddress || m.sender || '');
      const recipient = parseSenderString(m.toAddress || '');

      return {
        success: true,
        message: {
          id: String(m.messageId || params.messageId),
          provider: 'zoho',
          folder: 'inbox',
          fromName: sender.name,
          fromEmail: sender.email,
          toName: recipient.name || user.name,
          toEmail: recipient.email || identity.zoho.mailboxEmail,
          cc: m.ccAddress,
          bcc: m.bccAddress,
          subject: m.subject || '(No Subject)',
          preview: m.summary || '',
          body: m.content || m.summary || '',
          timestamp: 'Delivered',
          dateStr: 'Today',
          isUnread: false,
          isStarred: Boolean(m.flag === 'flagged'),
          hasAttachments: Boolean(m.hasAttachment),
          attachments: (m.attachments || []).map((a: any) => ({
            name: a.attachmentName || a.name || 'Attachment',
            size: '1.0 MB',
            type: a.contentType || 'application/octet-stream',
          })),
          tags: ['Zoho Mail'],
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to load Zoho message details.' };
    }
  }

  return { success: false, error: `Invalid provider: ${params.provider}` };
}

// ==============================================================================
// 4. UNIFIED COMPOSE & DISPATCH (SEND)
// ==============================================================================

/**
 * Send an email from the user's authorized mailbox.
 * Validates recipient syntax, sender authorization, and writes audit logs.
 */
export async function sendUnifiedMailAction(payload: {
  provider: MailProvider;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  threadId?: string;
  attachments?: MailAttachment[];
}): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const user = await requireAuth();
  const identity = await resolveUserMailboxIdentity(user);

  // Validate recipients
  const toList = payload.to
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  if (toList.length === 0) {
    return { success: false, error: 'Recipient email address (To) is required.' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const recipient of toList) {
    if (!emailRegex.test(recipient)) {
      return { success: false, error: `Invalid recipient email address format: "${recipient}"` };
    }
  }

  // -------------------------------------------------------------
  // GMAIL DISPATCH
  // -------------------------------------------------------------
  if (payload.provider === 'gmail') {
    if (!identity.gmail.authorized) {
      return { success: false, error: identity.gmail.reason || 'Unauthorized for Gmail dispatch.' };
    }
    if (!identity.gmail.connected) {
      return { success: false, error: 'Gmail is disconnected. Please authorize in Settings > Integrations.' };
    }

    try {
      const sendResult = await sendGmailMailboxEmailAction({
        to: toList,
        cc: payload.cc ? payload.cc.split(',').map((e) => e.trim()).filter(Boolean) : undefined,
        bcc: payload.bcc ? payload.bcc.split(',').map((e) => e.trim()).filter(Boolean) : undefined,
        subject: payload.subject,
        body: payload.body,
        threadId: payload.threadId,
        inReplyTo: payload.inReplyTo,
      });

      await logAuditEvent({
        userName: user.name,
        action: 'MAIL_SENT',
        module: 'COMMUNICATIONS',
        details: `Sent Gmail email to ${toList.join(', ')} with subject: "${payload.subject}" (Message ID: ${sendResult.messageId})`,
      });

      revalidatePath('/dashboard/mail');
      return { success: true, messageId: sendResult.messageId };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to dispatch email via Gmail.' };
    }
  }

  // -------------------------------------------------------------
  // ZOHO MAIL DISPATCH
  // -------------------------------------------------------------
  if (payload.provider === 'zoho') {
    if (!identity.zoho.authorized) {
      return { success: false, error: identity.zoho.reason || 'Unauthorized for Zoho Mail.' };
    }
    if (!identity.zoho.connected) {
      return {
        success: false,
        error:
          'Zoho Mail organization authorization is pending administrator consent. Real email dispatch cannot proceed until consent is completed.',
      };
    }

    try {
      const mailClient = getZohoMailClient();
      const accountId = identity.zoho.zuid || identity.zoho.mailboxEmail;

      const sendResult = await mailClient.sendMailMessage({
        accountId,
        fromAddress: identity.zoho.mailboxEmail,
        toAddress: toList,
        ccAddress: payload.cc,
        bccAddress: payload.bcc,
        subject: payload.subject,
        content: payload.body,
      });

      if (!sendResult.success) {
        return {
          success: false,
          error: sendResult.error || 'Failed to dispatch email via Zoho Mail API.',
        };
      }

      await logAuditEvent({
        userName: user.name,
        action: 'MAIL_SENT',
        module: 'COMMUNICATIONS',
        details: `Sent Zoho email from ${identity.zoho.mailboxEmail} to ${toList.join(', ')} with subject: "${payload.subject}" (Message ID: ${sendResult.messageId})`,
      });

      revalidatePath('/dashboard/mail');
      return { success: true, messageId: sendResult.messageId };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to send message via Zoho Mail.' };
    }
  }

  return { success: false, error: `Invalid provider: ${payload.provider}` };
}

// ==============================================================================
// 5. UNIFIED DRAFT MANAGEMENT
// ==============================================================================

/**
 * Save draft in the active provider mailbox.
 */
export async function saveUnifiedDraftAction(payload: {
  provider: MailProvider;
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
}): Promise<{
  success: boolean;
  draftId?: string;
  error?: string;
}> {
  const user = await requireAuth();
  const identity = await resolveUserMailboxIdentity(user);

  if (payload.provider === 'gmail') {
    if (!identity.gmail.authorized || !identity.gmail.connected) {
      return { success: false, error: 'Gmail access not authorized or connected.' };
    }

    try {
      const draft = await createGmailDraftAction({
        to: payload.to ? [payload.to] : [],
        cc: payload.cc ? [payload.cc] : undefined,
        bcc: payload.bcc ? [payload.bcc] : undefined,
        subject: payload.subject || '',
        body: payload.body || '',
      });

      await logAuditEvent({
        userName: user.name,
        action: 'MAIL_DRAFT_CREATED',
        module: 'COMMUNICATIONS',
        details: `Created Gmail draft ${draft.id} for user ${user.name}`,
      });

      return { success: true, draftId: draft.id };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to save draft in Gmail.' };
    }
  }

  if (payload.provider === 'zoho') {
    if (!identity.zoho.authorized || !identity.zoho.connected) {
      return { success: false, error: 'Zoho Mail access not authorized or connected.' };
    }

    try {
      const mailClient = getZohoMailClient();
      const accountId = identity.zoho.zuid || identity.zoho.mailboxEmail;
      const res = await mailClient.saveMailDraft({
        accountId,
        fromAddress: identity.zoho.mailboxEmail,
        toAddress: payload.to,
        ccAddress: payload.cc,
        bccAddress: payload.bcc,
        subject: payload.subject,
        content: payload.body,
      });

      if (!res.success) {
        return { success: false, error: res.error || 'Failed to save Zoho draft.' };
      }

      await logAuditEvent({
        userName: user.name,
        action: 'MAIL_DRAFT_CREATED',
        module: 'COMMUNICATIONS',
        details: `Created Zoho draft ${res.draftId} for user ${user.name}`,
      });

      return { success: true, draftId: res.draftId };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to save draft in Zoho.' };
    }
  }

  return { success: false, error: `Invalid provider: ${payload.provider}` };
}

// ==============================================================================
// 6. UNIFIED MESSAGE ACTIONS (STAR, ARCHIVE, TRASH, READ)
// ==============================================================================

export async function toggleUnifiedStarAction(params: {
  provider: MailProvider;
  messageId: string;
  starred: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  const identity = await resolveUserMailboxIdentity(user);

  if (params.provider === 'gmail') {
    if (!identity.gmail.authorized || !identity.gmail.connected) {
      return { success: false, error: 'Gmail access not authorized or connected.' };
    }
    await starGmailMessageAction(params.messageId, params.starred);
    await logAuditEvent({
      userName: user.name,
      action: 'MAIL_MESSAGE_STARRED',
      module: 'COMMUNICATIONS',
      details: `${params.starred ? 'Starred' : 'Unstarred'} message ${params.messageId}`,
    });
    return { success: true };
  }

  if (params.provider === 'zoho') {
    if (!identity.zoho.authorized || !identity.zoho.connected) {
      return { success: false, error: 'Zoho Mail access not authorized or connected.' };
    }
    const mailClient = getZohoMailClient();
    const accountId = identity.zoho.zuid || identity.zoho.mailboxEmail;
    await mailClient.updateMessageFlag({
      accountId,
      messageId: params.messageId,
      action: params.starred ? 'star' : 'unstar',
    });
    await logAuditEvent({
      userName: user.name,
      action: 'MAIL_MESSAGE_STARRED',
      module: 'COMMUNICATIONS',
      details: `${params.starred ? 'Starred' : 'Unstarred'} Zoho message ${params.messageId}`,
    });
    return { success: true };
  }

  return { success: false, error: 'Unknown provider' };
}

export async function archiveUnifiedMessageAction(params: {
  provider: MailProvider;
  messageId: string;
}): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  const identity = await resolveUserMailboxIdentity(user);

  if (params.provider === 'gmail') {
    if (!identity.gmail.authorized || !identity.gmail.connected) {
      return { success: false, error: 'Gmail access not authorized or connected.' };
    }
    await archiveGmailMessageAction(params.messageId);
    await logAuditEvent({
      userName: user.name,
      action: 'MAIL_MESSAGE_ARCHIVED',
      module: 'COMMUNICATIONS',
      details: `Archived Gmail message ${params.messageId}`,
    });
    return { success: true };
  }

  if (params.provider === 'zoho') {
    if (!identity.zoho.authorized || !identity.zoho.connected) {
      return { success: false, error: 'Zoho Mail access not authorized or connected.' };
    }
    const mailClient = getZohoMailClient();
    const accountId = identity.zoho.zuid || identity.zoho.mailboxEmail;
    await mailClient.updateMessageFlag({
      accountId,
      messageId: params.messageId,
      action: 'archive',
    });
    await logAuditEvent({
      userName: user.name,
      action: 'MAIL_MESSAGE_ARCHIVED',
      module: 'COMMUNICATIONS',
      details: `Archived Zoho message ${params.messageId}`,
    });
    return { success: true };
  }

  return { success: false, error: 'Unknown provider' };
}

export async function trashUnifiedMessageAction(params: {
  provider: MailProvider;
  messageId: string;
}): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  const identity = await resolveUserMailboxIdentity(user);

  if (params.provider === 'gmail') {
    if (!identity.gmail.authorized || !identity.gmail.connected) {
      return { success: false, error: 'Gmail access not authorized or connected.' };
    }
    await trashGmailMessageAction(params.messageId);
    await logAuditEvent({
      userName: user.name,
      action: 'MAIL_MESSAGE_TRASHED',
      module: 'COMMUNICATIONS',
      details: `Moved Gmail message ${params.messageId} to trash`,
    });
    return { success: true };
  }

  if (params.provider === 'zoho') {
    if (!identity.zoho.authorized || !identity.zoho.connected) {
      return { success: false, error: 'Zoho Mail access not authorized or connected.' };
    }
    const mailClient = getZohoMailClient();
    const accountId = identity.zoho.zuid || identity.zoho.mailboxEmail;
    await mailClient.updateMessageFlag({
      accountId,
      messageId: params.messageId,
      action: 'trash',
    });
    await logAuditEvent({
      userName: user.name,
      action: 'MAIL_MESSAGE_TRASHED',
      module: 'COMMUNICATIONS',
      details: `Moved Zoho message ${params.messageId} to trash`,
    });
    return { success: true };
  }

  return { success: false, error: 'Unknown provider' };
}

export async function markUnifiedMessageReadAction(params: {
  provider: MailProvider;
  messageId: string;
  read: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  const identity = await resolveUserMailboxIdentity(user);

  if (params.provider === 'gmail') {
    if (!identity.gmail.authorized || !identity.gmail.connected) {
      return { success: false, error: 'Gmail access not authorized or connected.' };
    }
    await markGmailMessageReadAction(params.messageId, params.read);
    return { success: true };
  }

  if (params.provider === 'zoho') {
    if (!identity.zoho.authorized || !identity.zoho.connected) {
      return { success: false, error: 'Zoho Mail access not authorized or connected.' };
    }
    const mailClient = getZohoMailClient();
    const accountId = identity.zoho.zuid || identity.zoho.mailboxEmail;
    await mailClient.updateMessageFlag({
      accountId,
      messageId: params.messageId,
      action: params.read ? 'read' : 'unread',
    });
    return { success: true };
  }

  return { success: false, error: 'Unknown provider' };
}

// ==============================================================================
// 7. UNIFIED ATTACHMENTS (DOWNLOAD WITH RBAC GUARD)
// ==============================================================================

export async function downloadUnifiedAttachmentAction(params: {
  provider: MailProvider;
  messageId: string;
  attachmentId: string;
}): Promise<{
  success: boolean;
  base64Data?: string;
  mimeType?: string;
  error?: string;
}> {
  const user = await requireAuth();
  const identity = await resolveUserMailboxIdentity(user);

  if (params.provider === 'gmail') {
    if (!identity.gmail.authorized || !identity.gmail.connected) {
      return { success: false, error: 'Unauthorized to download Gmail attachments.' };
    }
    const res = await getGmailAttachmentAction(params.messageId, params.attachmentId);
    await logAuditEvent({
      userName: user.name,
      action: 'MAIL_ATTACHMENT_ACCESSED',
      module: 'COMMUNICATIONS',
      details: `Downloaded attachment ${params.attachmentId} from Gmail message ${params.messageId}`,
    });
    return {
      success: true,
      base64Data: res.base64Data,
      mimeType: 'application/octet-stream',
    };
  }

  if (params.provider === 'zoho') {
    if (!identity.zoho.authorized || !identity.zoho.connected) {
      return { success: false, error: 'Unauthorized to download Zoho attachments.' };
    }
    const mailClient = getZohoMailClient();
    const accountId = identity.zoho.zuid || identity.zoho.mailboxEmail;
    const res = await mailClient.fetchAttachment(accountId, params.messageId, params.attachmentId);

    if (!res.success) {
      return { success: false, error: res.error || 'Failed to download attachment from Zoho.' };
    }

    await logAuditEvent({
      userName: user.name,
      action: 'MAIL_ATTACHMENT_ACCESSED',
      module: 'COMMUNICATIONS',
      details: `Downloaded attachment ${params.attachmentId} from Zoho message ${params.messageId}`,
    });

    return {
      success: true,
      base64Data: res.data ? Buffer.from(JSON.stringify(res.data)).toString('base64') : '',
      mimeType: 'application/octet-stream',
    };
  }

  return { success: false, error: 'Unknown provider' };
}
