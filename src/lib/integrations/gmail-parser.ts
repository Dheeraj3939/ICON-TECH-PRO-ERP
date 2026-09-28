import type {
  GmailMessageSummary,
  GmailMessageDetail,
  GmailThreadSummary,
  GmailThreadDetail,
  GmailAttachmentMeta,
} from '@/types/gmail';

/**
 * Decodes a base64url encoded string from the Gmail API into a UTF-8 string.
 */
export function decodeBase64Url(data?: string | null): string {
  if (!data) return '';
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf8');
  } catch (err) {
    console.error('Failed to decode base64url string:', err);
    return '';
  }
}

/**
 * Parses header values case-insensitively from a Gmail message payload.
 */
export function getHeader(
  headers: Array<{ name: string; value: string }> | undefined,
  name: string
): string {
  if (!headers || !Array.isArray(headers)) return '';
  const match = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return match ? match.value : '';
}

/**
 * Parses comma-separated email list (e.g. from To, Cc, Bcc headers).
 */
export function parseEmailList(headerValue: string): string[] {
  if (!headerValue || !headerValue.trim()) return [];
  return headerValue
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
}

/**
 * Recursively extracts plain text, HTML body, and attachment metadata from a MIME payload tree.
 */
export function extractMimeContent(payload: any): {
  bodyText: string;
  bodyHtml: string;
  attachments: GmailAttachmentMeta[];
} {
  let bodyText = '';
  let bodyHtml = '';
  const attachments: GmailAttachmentMeta[] = [];

  function walk(part: any) {
    if (!part) return;

    const mimeType = (part.mimeType || '').toLowerCase();
    const filename = part.filename || '';
    const attachmentId = part.body?.attachmentId;
    const size = part.body?.size || 0;

    // Check if this part is a downloadable attachment
    if (filename && (attachmentId || size > 0)) {
      attachments.push({
        id: part.partId || `att-${attachments.length + 1}`,
        filename,
        mimeType: mimeType || 'application/octet-stream',
        size,
        attachmentId: attachmentId || '',
      });
      return;
    }

    // Body content extraction
    if (part.body && part.body.data) {
      const decoded = decodeBase64Url(part.body.data);
      if (mimeType === 'text/plain' && !bodyText) {
        bodyText = decoded;
      } else if (mimeType === 'text/html' && !bodyHtml) {
        bodyHtml = decoded;
      }
    }

    // Recursive traversal of subparts
    if (part.parts && Array.isArray(part.parts)) {
      for (const subPart of part.parts) {
        walk(subPart);
      }
    }
  }

  walk(payload);

  // If only HTML exists, create a clean plain text fallback
  if (!bodyText && bodyHtml) {
    bodyText = bodyHtml
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return { bodyText, bodyHtml, attachments };
}

/**
 * Parses a raw Gmail API message object into an ERP GmailMessageDetail.
 */
export function parseGmailMessage(rawMessage: any): GmailMessageDetail {
  const headers = rawMessage.payload?.headers || [];
  const labelIds: string[] = rawMessage.labelIds || [];

  const from = getHeader(headers, 'From') || 'Unknown Sender';
  const to = parseEmailList(getHeader(headers, 'To'));
  const cc = parseEmailList(getHeader(headers, 'Cc'));
  const bcc = parseEmailList(getHeader(headers, 'Bcc'));
  const subject = getHeader(headers, 'Subject') || '(No Subject)';
  const dateHeader = getHeader(headers, 'Date');
  const messageIdHeader = getHeader(headers, 'Message-ID');
  const inReplyTo = getHeader(headers, 'In-Reply-To');
  const references = getHeader(headers, 'References');

  const internalDate = Number(rawMessage.internalDate) || Date.now();
  const dateFormatted = dateHeader || new Date(internalDate).toLocaleString('en-IN');

  const { bodyText, bodyHtml, attachments } = extractMimeContent(rawMessage.payload);

  const snippet = rawMessage.snippet || (bodyText ? bodyText.slice(0, 160) : '');

  const isUnread = labelIds.includes('UNREAD');
  const isStarred = labelIds.includes('STARRED');
  const isImportant = labelIds.includes('IMPORTANT');
  const isDraft = labelIds.includes('DRAFT');
  const isTrash = labelIds.includes('TRASH');
  const isSent = labelIds.includes('SENT');

  return {
    id: rawMessage.id,
    threadId: rawMessage.threadId || rawMessage.id,
    from,
    to,
    cc,
    bcc,
    subject,
    snippet,
    timestamp: internalDate,
    dateFormatted,
    labelIds,
    isUnread,
    isStarred,
    isImportant,
    isDraft,
    isTrash,
    isSent,
    hasAttachments: attachments.length > 0,
    attachmentCount: attachments.length,
    attachments,
    bodyText,
    bodyHtml,
    messageIdHeader: messageIdHeader || undefined,
    inReplyTo: inReplyTo || undefined,
    references: references || undefined,
  };
}

/**
 * Converts a raw Gmail API thread object with messages into a GmailThreadDetail.
 */
export function parseGmailThread(rawThread: any): GmailThreadDetail {
  const rawMessages: any[] = rawThread.messages || [];
  const messages = rawMessages.map(parseGmailMessage);

  return {
    id: rawThread.id,
    historyId: rawThread.historyId,
    messageCount: messages.length,
    messages,
  };
}

/**
 * Builds a GmailThreadSummary from a thread object and its messages.
 */
export function summarizeGmailThread(rawThread: any): GmailThreadSummary {
  const detail = parseGmailThread(rawThread);
  const messages = detail.messages;

  // Extract participants: names or emails without duplicates
  const participantsSet = new Set<string>();
  let hasAttachments = false;
  let isUnread = false;
  let isStarred = false;
  let isImportant = false;
  const labelIdsSet = new Set<string>();

  for (const msg of messages) {
    // Extract display name or address from "Name <email@domain>"
    const sender = msg.from.split('<')[0].replace(/"/g, '').trim() || msg.from;
    participantsSet.add(sender);

    if (msg.hasAttachments) hasAttachments = true;
    if (msg.isUnread) isUnread = true;
    if (msg.isStarred) isStarred = true;
    if (msg.isImportant) isImportant = true;

    for (const l of msg.labelIds) {
      labelIdsSet.add(l);
    }
  }

  const lastMessage = messages[messages.length - 1];
  const lastMessageDate = lastMessage ? lastMessage.timestamp : Date.now();
  const snippet = rawThread.snippet || (lastMessage ? lastMessage.snippet : '');

  return {
    id: rawThread.id,
    snippet,
    historyId: rawThread.historyId,
    messageCount: messages.length,
    messages: messages.map((m) => {
      // Exclude heavy bodyText/bodyHtml for list summary view
      const { bodyText, bodyHtml, ...summary } = m;
      return summary as GmailMessageSummary;
    }),
    lastMessageDate,
    participants: Array.from(participantsSet),
    hasAttachments,
    isUnread,
    isStarred,
    isImportant,
    labelIds: Array.from(labelIdsSet),
  };
}
