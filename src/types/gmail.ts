export type GmailConnectionStatus = 'CONNECTED' | 'NOT_CONNECTED' | 'ERROR' | 'TOKEN_EXPIRED';

export interface GmailConnectionInfo {
  connected: boolean;
  status: GmailConnectionStatus;
  account_email: string;
  scopes: string[];
  connected_at?: string;
  connected_by?: string;
  expires_at?: number;
  last_error?: string;
  has_modify_scope?: boolean;
  needs_scope_upgrade?: boolean;
  configured_env?: {
    has_client_id: boolean;
    has_client_secret: boolean;
    has_redirect_uri: boolean;
    is_placeholder?: boolean;
  };
}

export interface StoredGmailCredentials {
  account_email: string;
  encrypted_refresh_token: string;
  encrypted_access_token?: string;
  access_token_expires_at?: number;
  scopes: string[];
  iv: string;
  tag: string;
  connected_at: string;
  connected_by_id: string;
  connected_by_name: string;
}

export interface GmailSendResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  error?: string;
  details?: string;
}

export type GmailFolder = 'INBOX' | 'STARRED' | 'SENT' | 'DRAFTS' | 'IMPORTANT' | 'TRASH';

export interface GmailLabel {
  id: string;
  name: string;
  type: 'system' | 'user';
  messagesTotal?: number;
  messagesUnread?: number;
}

export interface GmailAttachmentMeta {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  snippet: string;
  timestamp: number;
  dateFormatted: string;
  labelIds: string[];
  isUnread: boolean;
  isStarred: boolean;
  isImportant: boolean;
  isDraft: boolean;
  isTrash: boolean;
  isSent: boolean;
  hasAttachments: boolean;
  attachmentCount: number;
  attachments: GmailAttachmentMeta[];
}

export interface GmailMessageDetail extends GmailMessageSummary {
  bodyText: string;
  bodyHtml: string;
  messageIdHeader?: string;
  inReplyTo?: string;
  references?: string;
}

export interface GmailThreadSummary {
  id: string;
  snippet: string;
  historyId?: string;
  messageCount: number;
  messages: GmailMessageSummary[];
  lastMessageDate: number;
  participants: string[];
  hasAttachments: boolean;
  isUnread: boolean;
  isStarred: boolean;
  isImportant: boolean;
  labelIds: string[];
}

export interface GmailThreadDetail {
  id: string;
  historyId?: string;
  messageCount: number;
  messages: GmailMessageDetail[];
}

export interface GmailDraft {
  id: string;
  message: GmailMessageDetail;
  updatedAt: string;
}

export interface GmailComposePayload {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
    encoding?: 'base64' | 'utf-8';
  }>;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  draftId?: string;
}

export interface GmailMailboxResponse {
  threads: GmailThreadSummary[];
  nextPageToken?: string;
  resultSizeEstimate: number;
  folder: GmailFolder;
  query?: string;
}
