import {
  createRfc2822RawMessage,
} from '@/lib/integrations/gmail-crypto';
import {
  parseGmailMessage,
  parseGmailThread,
  summarizeGmailThread,
  decodeBase64Url,
} from '@/lib/integrations/gmail-parser';
import type {
  GmailFolder,
  GmailLabel,
  GmailThreadSummary,
  GmailThreadDetail,
  GmailMessageDetail,
  GmailDraft,
  GmailComposePayload,
  GmailSendResult,
  GmailMailboxResponse,
} from '@/types/gmail';

const TARGET_ACCOUNT_EMAIL = 'icontechpro@gmail.com';

/**
 * Interface to obtain fresh access tokens from the token storage layer.
 */
type TokenProvider = () => Promise<{ accessToken: string; expiresIn: number } | null>;

/**
 * Core Gmail REST API Client.
 * Server-only service providing complete mailbox operations using the Google OAuth credentials
 * for icontechpro@gmail.com under https://www.googleapis.com/auth/gmail.modify.
 */
export class GmailClient {
  private getToken: TokenProvider;

  constructor(tokenProvider: TokenProvider) {
    this.getToken = tokenProvider;
  }

  /**
   * Internal authenticated fetch with automatic 401 retry on token refresh.
   */
  private async fetchGmailApi<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const tokenInfo = await this.getToken();
    if (!tokenInfo || !tokenInfo.accessToken) {
      throw new Error(
        'Gmail account is not connected or authorization has expired. Please authorize in ERP Settings > Integrations.'
      );
    }

    const url = endpoint.startsWith('http')
      ? endpoint
      : `https://gmail.googleapis.com/gmail/v1/users/me/${endpoint.replace(/^\//, '')}`;

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${tokenInfo.accessToken}`);
    if (!headers.has('Content-Type') && options.method && options.method !== 'GET') {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401 && retryCount === 0) {
      // Force token refresh and retry once
      return this.fetchGmailApi<T>(endpoint, options, retryCount + 1);
    }

    if (!response.ok) {
      let errText = '';
      try {
        const errJson = await response.json();
        errText = errJson.error?.message || JSON.stringify(errJson);
      } catch {
        errText = await response.text();
      }

      if (response.status === 403 && errText.toLowerCase().includes('insufficient')) {
        throw new Error(
          'Gmail Mailbox scope not granted. Please click "Upgrade Mailbox Access" in Settings > Integrations to authorize mailbox reading.'
        );
      }

      throw new Error(`Gmail API Error (${response.status}): ${errText.slice(0, 300)}`);
    }

    // Return empty object for 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  /**
   * Retrieve all standard and user labels with message statistics.
   */
  async getLabels(): Promise<GmailLabel[]> {
    const res = await this.fetchGmailApi<{ labels?: any[] }>('labels');
    if (!res.labels || !Array.isArray(res.labels)) return [];

    return res.labels.map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type === 'system' ? 'system' : 'user',
      messagesTotal: l.messagesTotal,
      messagesUnread: l.messagesUnread,
    }));
  }

  /**
   * List conversation threads for a specific folder or search query.
   */
  async listThreads(params: {
    folder?: GmailFolder;
    query?: string;
    pageToken?: string;
    maxResults?: number;
  }): Promise<GmailMailboxResponse> {
    const folder = params.folder || 'INBOX';
    const maxResults = params.maxResults || 25;

    // Construct folder query filter
    const folderQueries: Record<GmailFolder, string> = {
      INBOX: 'in:inbox',
      STARRED: 'is:starred',
      SENT: 'in:sent',
      DRAFTS: 'is:draft',
      IMPORTANT: 'is:important',
      TRASH: 'in:trash',
    };

    let fullQuery = folderQueries[folder] || 'in:inbox';
    if (params.query && params.query.trim()) {
      fullQuery += ` ${params.query.trim()}`;
    }

    const queryParams = new URLSearchParams({
      q: fullQuery,
      maxResults: String(maxResults),
    });
    if (params.pageToken) {
      queryParams.set('pageToken', params.pageToken);
    }

    const listRes = await this.fetchGmailApi<{
      threads?: Array<{ id: string; snippet?: string; historyId?: string }>;
      nextPageToken?: string;
      resultSizeEstimate?: number;
    }>(`threads?${queryParams.toString()}`);

    const rawThreads = listRes.threads || [];
    if (rawThreads.length === 0) {
      return {
        threads: [],
        nextPageToken: listRes.nextPageToken,
        resultSizeEstimate: listRes.resultSizeEstimate || 0,
        folder,
        query: params.query,
      };
    }

    // Fetch full thread details in batches of 8 for performance and rich summary
    const detailedThreads: GmailThreadSummary[] = [];
    const batchSize = 8;
    for (let i = 0; i < rawThreads.length; i += batchSize) {
      const batch = rawThreads.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (t) => {
          try {
            const rawThread = await this.fetchGmailApi<any>(`threads/${t.id}?format=full`);
            return summarizeGmailThread(rawThread);
          } catch (err) {
            console.warn(`Failed to fetch thread detail for ${t.id}:`, err);
            return {
              id: t.id,
              snippet: t.snippet || '',
              messageCount: 1,
              messages: [],
              lastMessageDate: Date.now(),
              participants: [],
              hasAttachments: false,
              isUnread: false,
              isStarred: false,
              isImportant: false,
              labelIds: [],
            } as GmailThreadSummary;
          }
        })
      );
      detailedThreads.push(...batchResults);
    }

    return {
      threads: detailedThreads,
      nextPageToken: listRes.nextPageToken,
      resultSizeEstimate: listRes.resultSizeEstimate || detailedThreads.length,
      folder,
      query: params.query,
    };
  }

  /**
   * Retrieve full conversation thread with all parsed message details.
   */
  async getThread(threadId: string): Promise<GmailThreadDetail> {
    const raw = await this.fetchGmailApi<any>(`threads/${threadId}?format=full`);
    return parseGmailThread(raw);
  }

  /**
   * Retrieve a single parsed Gmail message.
   */
  async getMessage(messageId: string): Promise<GmailMessageDetail> {
    const raw = await this.fetchGmailApi<any>(`messages/${messageId}?format=full`);
    return parseGmailMessage(raw);
  }

  /**
   * Add or remove labels from a message (e.g. UNREAD, STARRED, INBOX).
   */
  async modifyMessageLabels(
    messageId: string,
    addLabelIds: string[] = [],
    removeLabelIds: string[] = []
  ): Promise<GmailMessageDetail> {
    const res = await this.fetchGmailApi<any>(`messages/${messageId}/modify`, {
      method: 'POST',
      body: JSON.stringify({
        addLabelIds,
        removeLabelIds,
      }),
    });
    return parseGmailMessage(res);
  }

  /**
   * Mark a message as read or unread.
   */
  async markRead(messageId: string, isRead = true): Promise<GmailMessageDetail> {
    return isRead
      ? this.modifyMessageLabels(messageId, [], ['UNREAD'])
      : this.modifyMessageLabels(messageId, ['UNREAD'], []);
  }

  /**
   * Star or unstar a message.
   */
  async starMessage(messageId: string, starred = true): Promise<GmailMessageDetail> {
    return starred
      ? this.modifyMessageLabels(messageId, ['STARRED'], [])
      : this.modifyMessageLabels(messageId, [], ['STARRED']);
  }

  /**
   * Archive a message by removing the INBOX label.
   */
  async archiveMessage(messageId: string): Promise<GmailMessageDetail> {
    return this.modifyMessageLabels(messageId, [], ['INBOX']);
  }

  /**
   * Move a message to Trash (non-destructive; does not permanently delete).
   */
  async trashMessage(messageId: string): Promise<{ success: boolean }> {
    await this.fetchGmailApi<any>(`messages/${messageId}/trash`, {
      method: 'POST',
    });
    return { success: true };
  }

  /**
   * Restore a message from Trash.
   */
  async untrashMessage(messageId: string): Promise<{ success: boolean }> {
    await this.fetchGmailApi<any>(`messages/${messageId}/untrash`, {
      method: 'POST',
    });
    return { success: true };
  }

  /**
   * Create a new draft in Gmail.
   */
  async createDraft(payload: GmailComposePayload): Promise<GmailDraft> {
    const raw = createRfc2822RawMessage({
      from: TARGET_ACCOUNT_EMAIL,
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject,
      body: payload.body,
      isHtml: payload.isHtml,
      attachments: payload.attachments,
      inReplyTo: payload.inReplyTo,
      references: payload.references,
    });

    const bodyObj: any = {
      message: {
        raw,
      },
    };
    if (payload.threadId) {
      bodyObj.message.threadId = payload.threadId;
    }

    const res = await this.fetchGmailApi<any>('drafts', {
      method: 'POST',
      body: JSON.stringify(bodyObj),
    });

    const parsedMsg = res.message ? parseGmailMessage(res.message) : ({} as any);
    return {
      id: res.id,
      message: parsedMsg,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Update an existing draft.
   */
  async updateDraft(draftId: string, payload: GmailComposePayload): Promise<GmailDraft> {
    const raw = createRfc2822RawMessage({
      from: TARGET_ACCOUNT_EMAIL,
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject,
      body: payload.body,
      isHtml: payload.isHtml,
      attachments: payload.attachments,
      inReplyTo: payload.inReplyTo,
      references: payload.references,
    });

    const bodyObj: any = {
      message: {
        raw,
      },
    };
    if (payload.threadId) {
      bodyObj.message.threadId = payload.threadId;
    }

    const res = await this.fetchGmailApi<any>(`drafts/${draftId}`, {
      method: 'PUT',
      body: JSON.stringify(bodyObj),
    });

    const parsedMsg = res.message ? parseGmailMessage(res.message) : ({} as any);
    return {
      id: res.id,
      message: parsedMsg,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Send an existing draft.
   */
  async sendDraft(draftId: string): Promise<GmailSendResult> {
    const res = await this.fetchGmailApi<any>('drafts/send', {
      method: 'POST',
      body: JSON.stringify({ id: draftId }),
    });

    return {
      success: true,
      messageId: res.id,
      threadId: res.threadId,
    };
  }

  /**
   * Send a new message, reply to a thread, or forward an email.
   */
  async sendMessage(payload: GmailComposePayload): Promise<GmailSendResult> {
    const raw = createRfc2822RawMessage({
      from: TARGET_ACCOUNT_EMAIL,
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.subject,
      body: payload.body,
      isHtml: payload.isHtml,
      attachments: payload.attachments,
      inReplyTo: payload.inReplyTo,
      references: payload.references,
    });

    const bodyObj: any = { raw };
    if (payload.threadId) {
      bodyObj.threadId = payload.threadId;
    }

    const res = await this.fetchGmailApi<any>('messages/send', {
      method: 'POST',
      body: JSON.stringify(bodyObj),
    });

    return {
      success: true,
      messageId: res.id,
      threadId: res.threadId,
    };
  }

  /**
   * Fetch an attachment buffer on-demand from the Gmail API.
   * Does NOT store anything permanently on disk.
   */
  async getAttachment(
    messageId: string,
    attachmentId: string
  ): Promise<{ data: Buffer; size: number }> {
    const res = await this.fetchGmailApi<{ data?: string; size?: number }>(
      `messages/${messageId}/attachments/${attachmentId}`
    );

    if (!res.data) {
      throw new Error('Attachment content could not be retrieved from Gmail API.');
    }

    const base64 = res.data.replace(/-/g, '+').replace(/_/g, '/');
    const buffer = Buffer.from(base64, 'base64');
    return {
      data: buffer,
      size: res.size || buffer.length,
    };
  }
}
